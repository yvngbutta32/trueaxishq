/* Public review-site request engine — sends happy clients to the owner's
 * Google review link (or any review site they choose).
 *
 * Design rules, same as the rest of the app:
 *  - Honest log: every ask that was sent, failed, or was skipped lands in
 *    reviewRequests with a reason. The owner sees the truth.
 *  - TCPA: SMS only to clients with an explicit opt-in on record.
 *  - Anti-spam: never more than one ask per job, and never more than one
 *    ask per client per 90 days.
 *  - $0 fixed cost: Twilio console mode and no email config degrade to an
 *    honest skipped/failed row, never a fake "sent".
 *  - Metered: SMS sends count against the plan's bundled allowance.
 */
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import type { getDb } from "../db";
import { clients, reviewRequests, users } from "../../drizzle/schema";
import { sendMeteredSms, getSmsAllowanceOverview } from "./smsMeter";
import { sendEmail, followUpEmail, getEmailDeliveryStatus, wasAcceptedByConfiguredSmtp } from "./email";
import { normalizePhoneToE164 } from "./sms";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export const REVIEW_REQUEST_COOLDOWN_DAYS = 90;

export interface SendReviewRequestInput {
  db: Db;
  userId: number;
  clientId: number;
  jobId?: number | null;
  reviewSiteUrl: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  smsOptIn: number | boolean | null;
  serviceName: string;
}

export type SendReviewRequestResult = {
  status: "sent" | "failed" | "skipped";
  channel: "sms" | "email";
  detail: string;
};

export function validateReviewSiteUrl(raw: string | null | undefined): { ok: boolean; reason?: string; url?: string } {
  if (!raw || !raw.trim()) return { ok: false, reason: "Add your review link first (Settings → Reviews)." };
  const trimmed = raw.trim();
  if (trimmed.length > 512) return { ok: false, reason: "Review link is too long (max 512 characters)." };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "That does not look like a valid link. Paste the full https:// review URL." };
  }
  if (parsed.protocol !== "https:") return { ok: false, reason: "Review links must start with https:// so clients can trust them." };
  return { ok: true, url: trimmed };
}

/** Has this client already been asked (sent) within the cooldown window? */
export async function clientRecentlyAsked(db: Db, userId: number, clientId: number): Promise<boolean> {
  const since = new Date(Date.now() - REVIEW_REQUEST_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(reviewRequests)
    .where(and(
      eq(reviewRequests.userId, userId),
      eq(reviewRequests.clientId, clientId),
      eq(reviewRequests.status, "sent"),
      gte(reviewRequests.sentAt, since),
    ));
  return Number(row?.count ?? 0) > 0;
}

/** Does this job already have any ask on record (any status — we never retry a skipped job)? */
export async function jobAlreadyAsked(db: Db, userId: number, jobId: number): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(reviewRequests)
    .where(and(
      eq(reviewRequests.userId, userId),
      eq(reviewRequests.jobId, jobId),
    ));
  return Number(row?.count ?? 0) > 0;
}

export async function sendReviewRequest(input: SendReviewRequestInput): Promise<SendReviewRequestResult> {
  const { db, userId, clientId, jobId, reviewSiteUrl, clientName, clientEmail, clientPhone, smsOptIn, serviceName } = input;
  const detailFor = (status: SendReviewRequestResult["status"], channel: SendReviewRequestResult["channel"], detail: string): SendReviewRequestResult => ({ status, channel, detail });
  const record = async (result: SendReviewRequestResult) => {
    await db.insert(reviewRequests).values({
      userId, clientId, jobId: jobId ?? null,
      channel: result.channel, status: result.status,
      detail: result.detail.slice(0, 255),
      sentAt: result.status === "sent" ? new Date() : null,
    });
    return result;
  };

  if (await clientRecentlyAsked(db, userId, clientId)) {
    return record(detailFor("skipped", "email", `Already asked within the last ${REVIEW_REQUEST_COOLDOWN_DAYS} days — we don't spam clients.`));
  }
  if (jobId && await jobAlreadyAsked(db, userId, jobId)) {
    return record(detailFor("skipped", "email", "This job already has a review request on record."));
  }

  const [owner] = await db.select({ name: users.name, businessName: users.businessName }).from(users).where(eq(users.id, userId)).limit(1);
  const freelancerName = owner?.businessName || owner?.name || "your service provider";

  const optedIn = smsOptIn === 1 || smsOptIn === true;
  const phone = normalizePhoneToE164(clientPhone);
  const smsConfigured = (await import("./sms")).getSmsDeliveryStatus().configured;

  if (optedIn && phone) {
    const allowance = await getSmsAllowanceOverview(db, userId, (await db.select({ planId: users.planId }).from(users).where(eq(users.id, userId)).limit(1))[0]?.planId);
    if (allowance.overFairUse) {
      return record(detailFor("skipped", "sms", "Monthly SMS allowance is used up — request resumes next month or after an upgrade."));
    }
    const body = `${freelancerName}: Thanks for choosing us for ${serviceName}! Would you take 30 seconds to share your experience? ${reviewSiteUrl} (Reply STOP to opt out.)`;
    const smsResult = await sendMeteredSms(db, userId, { to: phone, body }, "review");
    if (smsResult.success && !smsResult.allowanceExceeded) {
      return record(detailFor("sent", "sms", smsConfigured ? "Delivered via your bundled SMS allowance." : "Recorded in console mode (no Twilio credentials configured — nothing was really sent)."));
    }
    return record(detailFor("failed", "sms", `SMS send failed: ${smsResult.error ?? "unknown error"}.`));
  }

  if (clientEmail) {
    const subject = `How did we do? Share your experience with ${freelancerName}`;
    const body = [
      `Thanks again for choosing ${freelancerName} for ${serviceName}.`,
      "If you have a moment, a quick review helps us a great deal — it takes less than a minute:",
      reviewSiteUrl,
      "If anything wasn't right, just reply to this email and we'll make it right.",
    ].join("\n");
    const html = followUpEmail({ clientName, subject, body });
    const emailResult = await sendEmail({ to: clientEmail, subject: `How did we do? Share your experience with ${freelancerName}`, html });
    if (wasAcceptedByConfiguredSmtp(emailResult)) {
      return record(detailFor("sent", "email", "Email accepted by configured SMTP."));
    }
    if (emailResult.success && emailResult.mode === "console") {
      return record(detailFor("sent", "email", "Recorded in console mode (no SMTP configured — nothing was really sent)."));
    }
    return record(detailFor("failed", "email", `Email failed: ${emailResult.error ?? "not configured"}.`));
  }

  return record(detailFor("skipped", "email", "No reachable channel: client has no SMS opt-in on record and no email address."));
}

/** Recent asks for the owner log (newest first). */
export async function recentReviewRequests(db: Db, userId: number, limit = 25) {
  return db
    .select({
      id: reviewRequests.id,
      clientId: reviewRequests.clientId,
      jobId: reviewRequests.jobId,
      channel: reviewRequests.channel,
      status: reviewRequests.status,
      detail: reviewRequests.detail,
      sentAt: reviewRequests.sentAt,
      createdAt: reviewRequests.createdAt,
    })
    .from(reviewRequests)
    .where(eq(reviewRequests.userId, userId))
    .orderBy(desc(reviewRequests.createdAt))
    .limit(limit);
}

/** Clients joined for display in the log. */
export async function reviewLogWithClientNames(db: Db, userId: number, limit = 25) {
  const rows = await recentReviewRequests(db, userId, limit);
  if (rows.length === 0) return [];
  const named = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(and(eq(clients.userId, userId), sql`${clients.id} in (${sql.join(rows.map((r) => sql`${r.clientId}`), sql`, `)})`));
  const byId = new Map(named.map((c) => [c.id, c.name]));
  return rows.map((r) => ({ ...r, clientName: byId.get(r.clientId) ?? "Client" }));
}
