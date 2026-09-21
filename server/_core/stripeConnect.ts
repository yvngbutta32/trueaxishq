import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { stripeAccounts } from "../../drizzle/schema";
import type { StripeAccount } from "../../drizzle/schema";

// ── Stripe Connect boundary ─────────────────────────────────────────────────
// Hard architectural rule: CLIENT money (invoice payments, booking deposits,
// portal payments) always lands in the freelancer's OWN connected Stripe
// account. The platform's STRIPE_SECRET_KEY is used exclusively for SaaS
// subscription billing. There is no fallback that would route a customer's
// payment into the platform account — if a connected account is missing or not
// yet enabled, client-payment flows fail honestly.

export async function getStripeAccountForUser(userId: number): Promise<StripeAccount | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(stripeAccounts)
    .where(eq(stripeAccounts.userId, userId)).limit(1);
  return row ?? null;
}

/** Returns the connected account id, or fails honestly. Never falls back to the platform account. */
export async function requireClientPaymentsAccount(userId: number): Promise<string> {
  const row = await getStripeAccountForUser(userId);
  if (!row) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "To collect client payments, connect your own Stripe account first (Integration Hub → Payments). Invoices can also be marked paid manually at no cost.",
    });
  }
  if (!row.chargesEnabled) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Your Stripe account is still finishing onboarding. Complete it from Integration Hub → Payments, then try again.",
    });
  }
  return row.stripeAccountId;
}
