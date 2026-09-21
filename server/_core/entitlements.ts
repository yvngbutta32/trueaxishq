import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
import { PRO_FEATURES, featureEntitlements, type ProFeature } from "../../shared/plans";

/** Reads the account's plan tier. Missing/unknown plans fall back to "free" —
 *  never to full access. */
export async function getPlanTier(db: Db, userId: number): Promise<string> {
  const [row] = await db.select({ planId: users.planId }).from(users).where(eq(users.id, userId)).limit(1);
  return (row?.planId ?? "free").trim().toLowerCase() || "free";
}

export async function getEntitlements(db: Db, userId: number) {
  const planId = await getPlanTier(db, userId);
  return { planId, features: featureEntitlements(planId) };
}

/** Server-side hard gate for Pro-plan features. Every gated router procedure
 *  calls this first, so client locks are UX only — enforcement is here. */
export async function requirePlanFeature(db: Db, userId: number, feature: ProFeature): Promise<void> {
  if (!(PRO_FEATURES as readonly string[]).includes(feature)) throw new Error(`Unknown feature gate: ${feature}`);
  const planId = await getPlanTier(db, userId);
  const features = featureEntitlements(planId);
  if (!features[feature]) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `${feature} is part of the Pro plan. Upgrade in Settings → Billing to unlock it.`,
    });
  }
}
