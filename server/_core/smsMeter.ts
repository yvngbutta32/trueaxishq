/* Bundled SMS fair-use metering.
 *
 * Platform-delivered SMS lands on the operator's Twilio account, so every
 * send is real spend (~$0.008 base + ~$0.004 US carrier surcharge per
 * segment). shared/plans.ts bundles an SMS allowance into each plan;
 * this module counts sends per calendar month and refuses honestly once
 * the allowance is used up — mirroring _core/voiceLines.ts for voice.
 *
 * What is metered: every platform-sent SMS with a paying-account cost —
 * booking confirmations, reminders, check-ins, subcontractor invites,
 * owner test sends. What is NOT metered: SMS login codes (a security
 * mechanism that must never depend on a marketing allowance) and console
 * mode (no credentials → no delivery → no cost → nothing recorded).
 *
 * Privacy: the smsSends table stores no bodies and no recipient numbers —
 * only a per-row count with a coarse kind tag for the usage meter.
 */
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../db";
import { smsSends, users } from "../../drizzle/schema";
import { sendSms, getSmsDeliveryStatus, wasSmsAcceptedByConfiguredTwilio, type SmsPayload, type SmsResult } from "./sms";
import { smsIncludedFor } from "../../shared/plans";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const FREE_ALLOWANCE = 50; // matches SMS_INCLUDED_MONTHLY.free

export type SmsSendKind = "booking" | "reminder" | "checkin" | "invite" | "test" | "other";

export interface MeteredSmsResult extends SmsResult {
  allowanceExceeded: boolean;
  smsIncluded: number;
  smsUsed: number;
}

/** SMS delivered against this account's allowance in the current calendar month. */
export async function monthlySmsUsed(db: Db, userId: number): Promise<number> {
  const monthStart = new Date();
  monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(smsSends)
    .where(and(eq(smsSends.userId, userId), gte(smsSends.createdAt, monthStart)));
  return Number(row?.count ?? 0);
}

export async function getSmsAllowanceOverview(db: Db, userId: number, planId: string | null | undefined) {
  const smsIncluded = smsIncludedFor(planId);
  const smsUsed = await monthlySmsUsed(db, userId);
  return {
    smsIncluded,
    smsUsed,
    overFairUse: smsUsed >= smsIncluded,
  };
}

/** Pure allowance decision, unit-tested in isolation. */
export function decideSmsAllowance(used: number, included: number): { allowed: boolean } {
  return { allowed: used < included };
}

export function smsUpgradeMessage(included: number): string {
  const shown = included.toLocaleString("en-US");
  if (included <= FREE_ALLOWANCE) {
    return `Your plan's monthly SMS allowance (${shown} messages) is used up. Upgrade in Settings → Billing — Starter includes 500 SMS/month — and texting resumes immediately.`;
  }
  return `Your plan's monthly SMS allowance (${shown} messages) is used up for this month. Upgrade in Settings → Billing for a higher allowance; sends resume at the start of next month.`;
}

/** Sends one platform-billed SMS against the account's bundled allowance.
 *  Never throws on refusal — callers treat success=false like any other
 *  delivery failure (honest smsDelivered flags), which is exactly how the
 *  rest of the app already degrades. */
export async function sendMeteredSms(
  db: Db,
  userId: number,
  payload: SmsPayload,
  kind: SmsSendKind = "other",
): Promise<MeteredSmsResult> {
  const [user] = await db.select({ planId: users.planId }).from(users).where(eq(users.id, userId)).limit(1);
  const overview = await getSmsAllowanceOverview(db, userId, user?.planId ?? null);

  const { configured } = getSmsDeliveryStatus();
  if (!configured) {
    // Console mode: no delivery, no cost, nothing metered.
    const result = await sendSms(payload);
    return { ...result, allowanceExceeded: false, ...overview };
  }

  if (!decideSmsAllowance(overview.smsUsed, overview.smsIncluded).allowed) {
    return {
      success: false,
      id: "",
      mode: "twilio",
      error: smsUpgradeMessage(overview.smsIncluded),
      allowanceExceeded: true,
      ...overview,
    };
  }

  const result = await sendSms(payload);
  if (!wasSmsAcceptedByConfiguredTwilio(result)) {
    // Twilio refused — the account was not charged, so nothing is metered.
    return { ...result, allowanceExceeded: false, ...overview };
  }
  await db.insert(smsSends).values({ userId, kind });
  return { ...result, allowanceExceeded: false, smsIncluded: overview.smsIncluded, smsUsed: overview.smsUsed + 1 };
}
