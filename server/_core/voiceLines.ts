/* Managed business lines — platform-purchased Twilio numbers, bundled into
 * the client's subscription. The client never opens a Twilio account, never
 * enters credentials, and never pays Twilio directly. Costs land on the
 * operator's Twilio account (no fixed fees; usage only) and are covered by
 * the plan price, guarded by fair-use caps (see shared/plans.ts).
 *
 * Bring-your-own-number (paste our webhook URL into the client's existing
 * Twilio number) keeps working with no line row and no caps — those minutes
 * bill to the client's own Twilio account, not ours.
 */
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../db";
import { voiceCalls, voiceLines } from "../../drizzle/schema";
import { ENV } from "./env";
import { voiceLineMinutesFor } from "../../shared/plans";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const TWILIO_API = "https://api.twilio.com/2010-04-01/Accounts";

/** Deployment-level readiness. Both must be true before any line can be
 *  purchased: the operator's Twilio credentials and this deployment's public
 *  https origin (to wire webhook URLs onto the number). */
export function getVoiceLineStatus(): { configured: boolean; publicUrl: boolean; available: boolean } {
  const configured = Boolean(ENV.twilioAccountSid && ENV.twilioAuthToken);
  const publicUrl = /^https:\/\/.+/.test(ENV.siteOrigin);
  return { configured, publicUrl, available: configured && publicUrl };
}

/** Minutes consumed on this account's calls in the current calendar month. */
export async function monthlyMinutesUsed(db: Db, userId: number): Promise<number> {
  const monthStart = new Date();
  monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ seconds: sql<number>`COALESCE(SUM(${voiceCalls.durationSeconds}), 0)` })
    .from(voiceCalls)
    .where(and(eq(voiceCalls.userId, userId), gte(voiceCalls.startedAt, monthStart)));
  return Math.round((Number(row?.seconds ?? 0) / 60) * 10) / 10;
}

export async function getActiveLine(db: Db, userId: number) {
  const [line] = await db
    .select().from(voiceLines)
    .where(and(eq(voiceLines.userId, userId), eq(voiceLines.status, "active")))
    .limit(1);
  return line ?? null;
}

/** Buys a local number on the operator's Twilio account and points its Voice
 *  URL at this deployment's voice webhooks for the given user. */
export async function buyLineNumber(
  db: Db,
  userId: number,
  areaCode: string,
): Promise<{ success: true; phoneNumber: string } | { success: false; error: string }> {
  const { configured, publicUrl } = getVoiceLineStatus();
  if (!configured) return { success: false, error: "Voice lines are not configured on this deployment. The operator must set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN." };
  if (!publicUrl) return { success: false, error: "This deployment's public URL is not configured. The operator must set PUBLIC_BASE_URL (https origin) before lines can be provisioned." };
  if (await getActiveLine(db, userId)) return { success: false, error: "This account already has a business line." };

  const auth = Buffer.from(`${ENV.twilioAccountSid}:${ENV.twilioAuthToken}`).toString("base64");
  const params = new URLSearchParams({
    AreaCode: areaCode,
    VoiceUrl: `${ENV.siteOrigin}/api/voice/answer?u=${userId}`,
    VoiceMethod: "POST",
    VoiceFallbackUrl: `${ENV.siteOrigin}/api/voice/completed?u=${userId}&mode=voicemail`,
    VoiceFallbackMethod: "POST",
  });
  try {
    const response = await fetch(`${TWILIO_API}/${ENV.twilioAccountSid}/IncomingPhoneNumbers.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const data = await response.json().catch(() => ({})) as { sid?: string; phone_number?: string; message?: string };
    if (!response.ok || !data.sid || !data.phone_number) {
      return { success: false, error: data.message ? `Twilio: ${data.message}` : `Twilio rejected the purchase (HTTP ${response.status}). No charge was made.` };
    }
    await db.insert(voiceLines).values({ userId, phoneNumber: data.phone_number, twilioSid: data.sid, areaCode });
    return { success: true, phoneNumber: data.phone_number };
  } catch (err) {
    return { success: false, error: `Could not reach Twilio: ${err instanceof Error ? err.message : "network error"}` };
  }
}

/** Releases the account's line back to Twilio (number is surrendered) and
 *  marks the row released. Honest failure keeps the row active. */
export async function releaseLineNumber(db: Db, userId: number): Promise<{ success: boolean; error?: string }> {
  const line = await getActiveLine(db, userId);
  if (!line) return { success: false, error: "No active line to release." };
  const auth = Buffer.from(`${ENV.twilioAccountSid}:${ENV.twilioAuthToken}`).toString("base64");
  try {
    const response = await fetch(`${TWILIO_API}/${ENV.twilioAccountSid}/IncomingPhoneNumbers/${line.twilioSid}.json`, {
      method: "DELETE",
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { message?: string };
      return { success: false, error: data.message ? `Twilio: ${data.message}` : `Twilio refused the release (HTTP ${response.status}).` };
    }
  } catch (err) {
    return { success: false, error: `Could not reach Twilio: ${err instanceof Error ? err.message : "network error"}` };
  }
  await db.update(voiceLines).set({ status: "released" }).where(eq(voiceLines.id, line.id));
  return { success: true };
}

/** Line overview for the client's voice card. */
export async function getLineOverview(db: Db, userId: number, planId: string | null | undefined) {
  const line = await getActiveLine(db, userId);
  const minutesIncluded = voiceLineMinutesFor(planId);
  const minutesUsed = line ? await monthlyMinutesUsed(db, userId) : 0;
  return {
    line: line ? { phoneNumber: line.phoneNumber, areaCode: line.areaCode, createdAt: line.createdAt } : null,
    minutesIncluded,
    minutesUsed,
    overFairUse: Boolean(line) && minutesIncluded > 0 && minutesUsed >= minutesIncluded,
  };
}
