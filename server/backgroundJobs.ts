/**
 * Background Jobs — runs on server startup, fires every hour
 * 1. Recurring invoice auto-generation
 * 2. Overdue invoice auto-detection
 * 3. Follow-up reminder auto-scheduling
 * 4. Follow-up rules auto-send (new)
 * 5. Monthly business report email (new, runs on 1st of month)
 * All jobs are idempotent and safe to run repeatedly.
 */
import { eq, and, lte, sql } from "drizzle-orm";
import { getDb, resetDbConnection } from "./db";
import {
  invoices,
  recurringInvoices,
  notifications,
  followUps,
  followUpRules,
  users,
  clients,
  bookings,
  invoicePayments,
  jobRunGuards,
  backgroundJobRuns,
} from "../drizzle/schema";
import { sendEmail, invoiceReminderEmail, followUpEmail, monthlyReportEmail, bookingReminderEmail, postSessionCheckInEmail, wasAcceptedByConfiguredSmtp } from "./_core/email";
import { getRecurringInvoiceDeliveryOutcome } from "./recurringInvoiceDeliveryOutcome";
import { processDueAutomations } from "./automationEngine";
import { randomBytes } from "node:crypto";
import { ENV } from "./_core/env";

// ─── Invoice number generator ─────────────────────────────────────────────────
function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const suffix = randomBytes(5).toString("hex").toUpperCase();
  return `INV-${year}${month}-${suffix}`;
}

// ─── Next due date calculator ─────────────────────────────────────────────────
function nextDueDate(
  from: Date,
  frequency: "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly"
): Date {
  const d = new Date(from);
  switch (frequency) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "biweekly":
      d.setDate(d.getDate() + 14);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}

// ─── Job: Generate recurring invoices ────────────────────────────────────────
async function runRecurringInvoices() {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const db = await getDb();
      if (!db) return;

      const now = new Date();
      const due = await db
        .select()
        .from(recurringInvoices)
        .where(
          and(
            eq(recurringInvoices.active, true),
            lte(recurringInvoices.nextDueAt, now)
          )
        );

      for (const rec of due) {
        try {
          const invoiceNumber = generateInvoiceNumber();
          const dueAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          const dueDateStr = dueAt.toISOString().split("T")[0];
          const [result] = await db.insert(invoices).values({
            userId: rec.userId,
            clientId: rec.clientId ?? null,
            invoiceNumber,
            clientName: rec.clientName,
            clientEmail: rec.clientEmail ?? null,
            service: rec.description ?? "Recurring Service",
            amount: rec.amount,
            status: "draft",
            dueDate: dueDateStr,
            notes: `Auto-generated recurring invoice (${rec.frequency})`,
          });
          const invoiceId = (result as any).insertId;

          const newNextDue = nextDueDate(rec.nextDueAt, rec.frequency);
          await db
            .update(recurringInvoices)
            .set({ nextDueAt: newNextDue, lastInvoiceId: invoiceId })
            .where(eq(recurringInvoices.id, rec.id));

          let emailResult = null;
          if (rec.clientEmail) {
            emailResult = await sendEmail({
              to: rec.clientEmail,
              subject: `Invoice ${invoiceNumber} from TrueAxis HQ`,
              html: invoiceReminderEmail({
                clientName: rec.clientName,
                invoiceNumber,
                amount: rec.amount,
                dueDate: dueAt.toLocaleDateString(),
              }),
            });
          }

          const deliveryOutcome = getRecurringInvoiceDeliveryOutcome({ hasClientEmail: Boolean(rec.clientEmail), emailResult });
          if (deliveryOutcome.invoiceStatus === "sent") {
            await db.update(invoices)
              .set({ status: "sent" })
              .where(and(eq(invoices.id, Number(invoiceId)), eq(invoices.userId, rec.userId)));
          }
          await db.insert(notifications).values({
            userId: rec.userId,
            title: "Recurring Invoice Generated",
            body: `Invoice ${invoiceNumber} for ${rec.clientName} ($${rec.amount}) ${deliveryOutcome.ownerNotice}`,
            type: emailResult?.success && emailResult.mode === "smtp" ? "success" : "info",
            link: "/dashboard",
          });

          // Recurring invoice generated successfully
        } catch (err) {
          console.error(`[Jobs] Failed to generate recurring invoice ${rec.id}:`, err);
        }
      }
      return;
    } catch (err: any) {
      const isTransient = err?.code === "ECONNRESET" || err?.code === "ETIMEDOUT" || err?.code === "ECONNREFUSED";
      console.error(`[Jobs] runRecurringInvoices error (attempt ${attempt}/2):`, { code: err?.code, message: err?.message });
      if (isTransient && attempt < 2) {
        resetDbConnection();
        await new Promise((r) => setTimeout(r, 500));
      } else {
        return;
      }
    }
  }
}

// ─── Job: Auto-detect overdue invoices ───────────────────────────────────────
async function runOverdueDetection() {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const db = await getDb();
      if (!db) return;

      const todayStr = new Date().toISOString().split("T")[0];
      await db.execute(
        sql`UPDATE invoices SET status = 'overdue' WHERE status = 'sent' AND dueDate IS NOT NULL AND dueDate != '' AND dueDate < ${todayStr}`
      );

      console.log(`[Jobs] Overdue detection complete for ${todayStr}`);
      return;
    } catch (err: any) {
      const isTransient = err?.code === "ECONNRESET" || err?.code === "ETIMEDOUT" || err?.code === "ECONNREFUSED";
      console.error(`[Jobs] runOverdueDetection error (attempt ${attempt}/2):`, { code: err?.code, message: err?.message });
      if (isTransient && attempt < 2) {
        resetDbConnection();
        await new Promise((r) => setTimeout(r, 500));
      } else {
        return;
      }
    }
  }
}

// ─── Job: Notify users of draft follow-ups older than 7 days ─────────────────
async function runFollowUpReminders() {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const db = await getDb();
      if (!db) return;

      const sevenDaysAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .replace("T", " ")
        .split(".")[0];

      const stale = await db.execute(
        sql`SELECT id, userId, clientName FROM followUps WHERE status = 'draft' AND createdAt <= ${sevenDaysAgoStr} LIMIT 20`
      ) as any;

      const rows: Array<{ id: number; userId: number; clientName: string }> =
        Array.isArray(stale) ? stale[0] ?? [] : stale?.rows ?? [];

      for (const fu of rows) {
        try {
          const existing = await db.execute(
            sql`SELECT id FROM notifications WHERE userId = ${fu.userId} AND body LIKE ${`%${fu.clientName}%`} AND createdAt > DATE_SUB(NOW(), INTERVAL 1 DAY) LIMIT 1`
          ) as any;
          const existingRows = Array.isArray(existing) ? existing[0] ?? [] : existing?.rows ?? [];
          if (existingRows.length > 0) continue;

          await db.insert(notifications).values({
            userId: fu.userId,
            title: `Unsent Follow-up: ${fu.clientName}`,
            body: `You have a draft follow-up for ${fu.clientName} that hasn't been sent yet. Head to Follow-ups to review it.`,
            type: "info",
            link: "/dashboard",
          });

          console.log('[Jobs] Reminded user about stale follow-up');
        } catch (err) {
          console.error(`[Jobs] Failed to notify stale follow-up ${fu.id}:`, err);
        }
      }
      return;
    } catch (err: any) {
      const isTransient = err?.code === "ECONNRESET" || err?.code === "ETIMEDOUT" || err?.code === "ECONNREFUSED";
      console.error(`[Jobs] runFollowUpReminders error (attempt ${attempt}/2):`, { code: err?.code, message: err?.message });
      if (isTransient && attempt < 2) {
        resetDbConnection();
        await new Promise((r) => setTimeout(r, 500));
      } else {
        return;
      }
    }
  }
}

// ─── Job: Auto-send follow-up rules ──────────────────────────────────────────
// Checks all active follow-up rules and sends emails to clients who haven't
// booked in `triggerDays` days and haven't already received this rule's email.
async function runFollowUpRules() {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const db = await getDb();
      if (!db) return;

      // Get all active rules
      const rules = await db.select().from(followUpRules).where(eq(followUpRules.active, true));

      for (const rule of rules) {
        try {
          const triggerDays = Math.min(Math.max(Math.trunc(rule.triggerDays), 1), 3650);
          const cutoffDate = new Date(Date.now() - triggerDays * 24 * 60 * 60 * 1000);
          const cutoffStr = cutoffDate.toISOString().replace("T", " ").split(".")[0];

          // Find clients for this user who haven't booked since cutoff
          // and haven't received this rule's email in the last triggerDays days
          const eligibleClients = await db.execute(
            sql`
              SELECT c.id, c.name, c.email
              FROM clients c
              WHERE c.userId = ${rule.userId}
                AND c.email IS NOT NULL
                AND c.email != ''
                AND (
                  COALESCE(
                    (SELECT MAX(b.createdAt) FROM bookings b
                     WHERE b.clientId = c.id AND b.userId = c.userId),
                    '2000-01-01 00:00:00'
                  )
                ) < ${cutoffStr}
                AND NOT EXISTS (
                  SELECT 1 FROM followUps fu
                  WHERE fu.clientId = c.id
                    AND fu.userId = ${rule.userId}
                    AND fu.subject = ${rule.emailSubject}
                    AND fu.createdAt > DATE_SUB(NOW(), INTERVAL ${sql.raw(String(triggerDays))} DAY)
                )
              LIMIT 10
            `
          ) as any;

          const clientRows: Array<{ id: number; name: string; email: string }> =
            Array.isArray(eligibleClients) ? eligibleClients[0] ?? [] : eligibleClients?.rows ?? [];

          for (const client of clientRows) {
            try {
              // Get user info for email sender name
              const [user] = await db.select({ name: users.name, businessName: users.businessName })
                .from(users).where(eq(users.id, rule.userId)).limit(1);
              const senderName = user?.businessName || user?.name || "Your service provider";

              // Personalize email body
              const personalizedBody = rule.emailBody
                .replace(/\{clientName\}/g, client.name)
                .replace(/\{name\}/g, client.name)
                .replace(/\{senderName\}/g, senderName);

              // Save as draft first — only mark sent after email succeeds
              const fuInsertResult = await db.insert(followUps).values({
                userId: rule.userId,
                clientId: client.id,
                clientName: client.name,
                clientEmail: client.email,
                subject: rule.emailSubject,
                body: personalizedBody,
                status: "draft",
              });
              // MySQL returns ResultSetHeader; handle both array and direct forms
              const fuId = (fuInsertResult as any)?.insertId
                ?? (Array.isArray(fuInsertResult) ? (fuInsertResult[0] as any)?.insertId : null);

              const emailResult = await sendEmail({
                to: client.email,
                subject: rule.emailSubject,
                html: followUpEmail({
                  clientName: client.name,
                  subject: rule.emailSubject,
                  body: personalizedBody,
                }),
              });

              // A console fallback or SMTP failure leaves the owner-created draft unchanged.
              if (fuId && wasAcceptedByConfiguredSmtp(emailResult)) {
                await db.update(followUps).set({ status: "sent", sentAt: new Date() })
                  .where(eq(followUps.id, fuId));
              }

              console.log(`[Jobs] Auto follow-up rule ${wasAcceptedByConfiguredSmtp(emailResult) ? "accepted by configured SMTP" : "retained as draft without SMTP acceptance"} for user ${rule.userId}`);
            } catch (err) {
              console.error(`[Jobs] Failed to send follow-up rule to client ${client.id}:`, err);
            }
          }

          // Update lastRunAt
          await db.update(followUpRules)
            .set({ lastRunAt: new Date() })
            .where(eq(followUpRules.id, rule.id));

        } catch (err) {
          console.error(`[Jobs] Failed to process follow-up rule ${rule.id}:`, err);
        }
      }
      return;
    } catch (err: any) {
      const isTransient = err?.code === "ECONNRESET" || err?.code === "ETIMEDOUT" || err?.code === "ECONNREFUSED";
      console.error(`[Jobs] runFollowUpRules error (attempt ${attempt}/2):`, { code: err?.code, message: err?.message });
      if (isTransient && attempt < 2) {
        resetDbConnection();
        await new Promise((r) => setTimeout(r, 500));
      } else {
        return;
      }
    }
  }
}

// ─── Job: Monthly business report email (runs on 1st of month) ───────────────
async function runMonthlyReport() {
  const now = new Date();
  // Only run on the 1st of the month (check within the hourly window)
  if (now.getUTCDate() !== 1) return;

  // Prevent sending more than once per month — use DB so server restarts don't re-send
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  try {
    const guardDb = await getDb();
    if (!guardDb) return;
    const jobKey = `monthly_report:${monthKey}`;
    const [sentCheck] = await guardDb.select({ jobKey: jobRunGuards.jobKey })
      .from(jobRunGuards)
      .where(eq(jobRunGuards.jobKey, jobKey))
      .limit(1);
    if (sentCheck) {
      console.log(`[Jobs] Monthly report already sent for ${monthKey} — skipping`);
      return;
    }
    // Insert before sending. The primary key protects against concurrent workers.
    try {
      await guardDb.insert(jobRunGuards).values({ jobKey });
    } catch {
      console.log(`[Jobs] Monthly report guard already claimed for ${monthKey} — skipping`);
      return;
    }
  } catch (error) {
    console.error("[Jobs] Could not establish the monthly report guard; skipping to prevent duplicate sends:", error);
    return;
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const db = await getDb();
      if (!db) return;

      // Get all users who have monthly reports enabled
      const allUsers = await db.execute(
        sql`SELECT id, name, email, businessName FROM users WHERE monthlyReportEnabled = 1 AND email IS NOT NULL AND email != ''`
      ) as any;

      const userRows: Array<{ id: number; name: string; email: string; businessName: string | null }> =
        Array.isArray(allUsers) ? allUsers[0] ?? [] : allUsers?.rows ?? [];

      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      const monthLabel = lastMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      const lastMonthStartStr = lastMonth.toISOString().replace("T", " ").split(".")[0];
      const lastMonthEndStr = lastMonthEnd.toISOString().replace("T", " ").split(".")[0];

      for (const user of userRows) {
        try {
          // Revenue is collected cash, not invoice face value. This keeps
          // monthly reports consistent with the payment-ledger analytics.
          const revenueResult = await db.execute(
            sql`SELECT COALESCE(SUM(CAST(p.amount AS DECIMAL(10,2))), 0) as total
                FROM invoicePayments p
                INNER JOIN invoices i ON i.id = p.invoiceId AND i.userId = p.userId
                WHERE p.userId = ${user.id} AND p.paidAt BETWEEN ${lastMonthStartStr} AND ${lastMonthEndStr}`
          ) as any;
          const revenueRows = Array.isArray(revenueResult) ? revenueResult[0] ?? [] : revenueResult?.rows ?? [];
          const totalRevenue = parseFloat(String(revenueRows[0]?.total ?? 0)).toFixed(2);

          // New clients last month
          const newClientsResult = await db.execute(
            sql`SELECT COUNT(*) as count FROM clients WHERE userId = ${user.id} AND createdAt BETWEEN ${lastMonthStartStr} AND ${lastMonthEndStr}`
          ) as any;
          const newClientsRows = Array.isArray(newClientsResult) ? newClientsResult[0] ?? [] : newClientsResult?.rows ?? [];
          const newClients = Number(newClientsRows[0]?.count ?? 0);

          // Invoices paid last month
          const paidResult = await db.execute(
            sql`SELECT COUNT(*) as count FROM invoices WHERE userId = ${user.id} AND status = 'paid' AND paidAt BETWEEN ${lastMonthStartStr} AND ${lastMonthEndStr}`
          ) as any;
          const paidRows = Array.isArray(paidResult) ? paidResult[0] ?? [] : paidResult?.rows ?? [];
          const invoicesPaid = Number(paidRows[0]?.count ?? 0);

          // Outstanding invoices
          const outstandingResult = await db.execute(
            sql`SELECT COUNT(*) as count FROM invoices WHERE userId = ${user.id} AND status IN ('sent', 'overdue')`
          ) as any;
          const outstandingRows = Array.isArray(outstandingResult) ? outstandingResult[0] ?? [] : outstandingResult?.rows ?? [];
          const invoicesOutstanding = Number(outstandingRows[0]?.count ?? 0);

          // Total bookings last month
          const bookingsResult = await db.execute(
            sql`SELECT COUNT(*) as count FROM bookings WHERE userId = ${user.id} AND createdAt BETWEEN ${lastMonthStartStr} AND ${lastMonthEndStr}`
          ) as any;
          const bookingsRows = Array.isArray(bookingsResult) ? bookingsResult[0] ?? [] : bookingsResult?.rows ?? [];
          const totalBookings = Number(bookingsRows[0]?.count ?? 0);

          const displayName = user.businessName || user.name || "there";

          const emailResult = await sendEmail({
            to: user.email,
            subject: `Your ${monthLabel} Business Report — TrueAxis HQ`,
            html: monthlyReportEmail({
              name: displayName,
              month: monthLabel,
              totalRevenue: `$${totalRevenue}`,
              newClients,
              invoicesPaid,
              invoicesOutstanding,
              aiInsight: `You completed ${totalBookings} booking${totalBookings !== 1 ? "s" : ""} this month.`,
              dashboardUrl: ENV.siteOrigin,
            }),
          });

          console.log(`[Jobs] Monthly report ${wasAcceptedByConfiguredSmtp(emailResult) ? "accepted by configured SMTP" : "not marked sent without SMTP acceptance"} for ${monthLabel}`);
        } catch (err) {
          console.error(`[Jobs] Failed to send monthly report to user ${user.id}:`, err);
        }
      }
      return;
    } catch (err: any) {
      const isTransient = err?.code === "ECONNRESET" || err?.code === "ETIMEDOUT" || err?.code === "ECONNREFUSED";
      console.error(`[Jobs] runMonthlyReport error (attempt ${attempt}/2):`, { code: err?.code, message: err?.message });
      if (isTransient && attempt < 2) {
        resetDbConnection();
        await new Promise((r) => setTimeout(r, 500));
      } else {
        return;
      }
    }
  }
}

// ─── Main scheduler ───────────────────────────────────────────────────────────
// ─── Job: 24-hour booking reminders ─────────────────────────────────────────
async function runBookingReminders() {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const db = await getDb();
      if (!db) return;

      // Find bookings scheduled for tomorrow (within a 25-hour window to be safe)
      const now = new Date();
      const tomorrowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
      const tomorrowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);
      const startStr = tomorrowStart.toISOString().split("T")[0];
      const endStr = tomorrowEnd.toISOString().split("T")[0];

      const upcoming = await db.execute(
        sql`SELECT b.id, b.clientName, b.clientEmail, b.service, b.date, b.time, b.userId,
                   u.name as ownerName, u.businessName, u.bookingUsername
            FROM bookings b
            JOIN users u ON u.id = b.userId
            WHERE b.status = 'scheduled'
              AND b.clientEmail IS NOT NULL AND b.clientEmail != ''
              AND b.reminderSentAt IS NULL
              AND b.date >= ${startStr} AND b.date <= ${endStr}
            LIMIT 50`
      ) as any;

      const rows: any[] = Array.isArray(upcoming) ? upcoming[0] ?? [] : upcoming?.rows ?? [];

      for (const booking of rows) {
        try {
          const freelancerName = booking.businessName || booking.ownerName || "Your service provider";
          const siteOrigin = process.env.SITE_ORIGIN || process.env.VITE_SITE_URL || "https://trueaxishq.com";
          const bookingUrl = booking.bookingUsername ? `${siteOrigin}/book/${booking.bookingUsername}` : siteOrigin;

          const emailResult = await sendEmail({
            to: booking.clientEmail,
            subject: `Reminder: Your session is tomorrow — ${booking.service || "Appointment"}`,
            html: bookingReminderEmail({
              clientName: booking.clientName,
              serviceName: booking.service || "Your session",
              date: booking.date,
              time: booking.time,
              freelancerName,
            }),
          });

          if (wasAcceptedByConfiguredSmtp(emailResult)) {
            await db.update(bookings)
              .set({ reminderSentAt: new Date() })
              .where(eq(bookings.id, booking.id));
          }

          console.log(`[Jobs] Booking reminder ${wasAcceptedByConfiguredSmtp(emailResult) ? "accepted by configured SMTP" : "not marked sent without SMTP acceptance"} for booking ${booking.id}`);
        } catch (err) {
          console.error(`[Jobs] Failed to send reminder for booking ${booking.id}:`, err);
        }
      }
      return;
    } catch (err: any) {
      const isTransient = err?.code === "ECONNRESET" || err?.code === "ETIMEDOUT" || err?.code === "ECONNREFUSED";
      console.error(`[Jobs] runBookingReminders error (attempt ${attempt}/2):`, { code: err?.code, message: err?.message });
      if (isTransient && attempt < 2) {
        resetDbConnection();
        await new Promise((r) => setTimeout(r, 500));
      } else {
        return;
      }
    }
  }
}

// ─── Job: 48-hour post-session check-in ──────────────────────────────────────
async function runPostSessionCheckIns() {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const db = await getDb();
      if (!db) return;

      // Find bookings that were 2 days ago (48 ± 1 hour window)
      const now = new Date();
      const twoDaysAgoStart = new Date(now.getTime() - 49 * 60 * 60 * 1000);
      const twoDaysAgoEnd = new Date(now.getTime() - 47 * 60 * 60 * 1000);
      const startStr = twoDaysAgoStart.toISOString().split("T")[0];
      const endStr = twoDaysAgoEnd.toISOString().split("T")[0];

      const completed = await db.execute(
        sql`SELECT b.id, b.clientName, b.clientEmail, b.service, b.userId,
                   u.name as ownerName, u.businessName, u.bookingUsername
            FROM bookings b
            JOIN users u ON u.id = b.userId
            WHERE b.status IN ('completed', 'scheduled')
              AND b.clientEmail IS NOT NULL AND b.clientEmail != ''
              AND b.checkInSentAt IS NULL
              AND b.date >= ${startStr} AND b.date <= ${endStr}
            LIMIT 50`
      ) as any;

      const rows: any[] = Array.isArray(completed) ? completed[0] ?? [] : completed?.rows ?? [];

      for (const booking of rows) {
        try {
          const freelancerName = booking.businessName || booking.ownerName || "Your service provider";
          const siteOrigin = process.env.SITE_ORIGIN || process.env.VITE_SITE_URL || "https://trueaxishq.com";
          const bookingUrl = booking.bookingUsername
            ? `${siteOrigin}/book/${booking.bookingUsername}`
            : siteOrigin;

          const emailResult = await sendEmail({
            to: booking.clientEmail,
            subject: `How did your session go? — ${booking.service || "Your recent session"}`,
            html: postSessionCheckInEmail({
              clientName: booking.clientName,
              serviceName: booking.service || "Your session",
              freelancerName,
              bookingUrl,
            }),
          });

          if (wasAcceptedByConfiguredSmtp(emailResult)) {
            await db.update(bookings)
              .set({ checkInSentAt: new Date() })
              .where(eq(bookings.id, booking.id));
          }

          console.log(`[Jobs] Post-session check-in ${wasAcceptedByConfiguredSmtp(emailResult) ? "accepted by configured SMTP" : "not marked sent without SMTP acceptance"} for booking ${booking.id}`);
        } catch (err) {
          console.error(`[Jobs] Failed to send check-in for booking ${booking.id}:`, err);
        }
      }
      return;
    } catch (err: any) {
      const isTransient = err?.code === "ECONNRESET" || err?.code === "ETIMEDOUT" || err?.code === "ECONNREFUSED";
      console.error(`[Jobs] runPostSessionCheckIns error (attempt ${attempt}/2):`, { code: err?.code, message: err?.message });
      if (isTransient && attempt < 2) {
        resetDbConnection();
        await new Promise((r) => setTimeout(r, 500));
      } else {
        return;
      }
    }
  }
}

let schedulerStarted = false;
let schedulerRunning = false;
let schedulerLastRunAt: Date | null = null;
let schedulerLastError: string | null = null;
let schedulerConsecutiveFailures = 0;

const JOB_RETRY_DELAYS_MS = [500, 2_000, 5_000] as const;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runWithRetries(name: string, job: () => Promise<void>): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= JOB_RETRY_DELAYS_MS.length + 1; attempt++) {
    try {
      await job();
      return;
    } catch (error) {
      lastError = error;
      if (attempt > JOB_RETRY_DELAYS_MS.length) break;
      const delay = JOB_RETRY_DELAYS_MS[attempt - 1];
      console.warn(`[Jobs] ${name} failed (attempt ${attempt}); retrying in ${delay}ms:`, errorMessage(error));
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error(`${name} failed after ${JOB_RETRY_DELAYS_MS.length + 1} attempts: ${errorMessage(lastError)}`);
}

export async function getDurableBackgroundJobStatus() {
  const db = await getDb();
  if (!db) return { lastFailedJob: null, lastFailedAt: null };
  const [latestFailure] = await db
    .select({
      jobName: backgroundJobRuns.jobName,
      errorMessage: backgroundJobRuns.errorMessage,
      startedAt: backgroundJobRuns.startedAt,
    })
    .from(backgroundJobRuns)
    .where(eq(backgroundJobRuns.status, "failed"))
    .orderBy(sql`${backgroundJobRuns.startedAt} DESC`)
    .limit(1);
  return {
    lastFailedJob: latestFailure
      ? `${latestFailure.jobName}: ${latestFailure.errorMessage || "Unknown error"}`
      : null,
    lastFailedAt: latestFailure?.startedAt?.toISOString() ?? null,
  };
}

export function getBackgroundJobStatus() {
  return {
    started: schedulerStarted,
    running: schedulerRunning,
    lastRunAt: schedulerLastRunAt?.toISOString() ?? null,
    lastError: schedulerLastError,
    consecutiveFailures: schedulerConsecutiveFailures,
  };
}

async function startDurableJobRun(name: string): Promise<{ db: Awaited<ReturnType<typeof getDb>>; runId: number | null }> {
  let db: Awaited<ReturnType<typeof getDb>>;
  try {
    db = await getDb();
  } catch (error) {
    console.error(`[Jobs] Unable to connect while recording ${name} start:`, errorMessage(error));
    return { db: null, runId: null };
  }
  if (!db) return { db, runId: null };
  try {
    const [run] = await db.insert(backgroundJobRuns).values({ jobName: name, status: "running" });
    return { db, runId: Number((run as { insertId?: number }).insertId) || null };
  } catch (error) {
    console.error(`[Jobs] Unable to record ${name} start:`, error);
    return { db, runId: null };
  }
}

async function finishDurableJobRun(
  db: Awaited<ReturnType<typeof getDb>>,
  runId: number | null,
  status: "succeeded" | "failed",
  errorMessage?: string,
) {
  if (!db || !runId) return;
  try {
    await db.update(backgroundJobRuns)
      .set({ status, completedAt: new Date(), ...(errorMessage ? { errorMessage } : {}) })
      .where(eq(backgroundJobRuns.id, runId));
  } catch (error) {
    console.error(`[Jobs] Unable to record job completion (${runId}):`, error);
  }
}

export function startBackgroundJobs() {
  if (schedulerStarted) {
    console.warn("[Jobs] Background job scheduler already started; skipping duplicate startup.");
    return;
  }
  schedulerStarted = true;
  console.log("[Jobs] Background job scheduler starting...");
  const runAll = async () => {
    if (schedulerRunning) {
      console.warn("[Jobs] Previous scheduled run is still in progress; skipping this interval.");
      return;
    }
    schedulerRunning = true;
    schedulerLastError = null;
    let cycleFailures = 0;
    const jobs: Array<[string, () => Promise<void>]> = [
      ["overdue detection", runOverdueDetection],
      ["recurring invoices", runRecurringInvoices],
      ["follow-up reminders", runFollowUpReminders],
      ["follow-up rules", runFollowUpRules],
      ["monthly report", runMonthlyReport],
      ["booking reminders", runBookingReminders],
      ["post-session check-ins", runPostSessionCheckIns],
      ["workflow automations", processDueAutomations],
    ];
    try {
      for (const [name, job] of jobs) {
        const { db, runId } = await startDurableJobRun(name);
        try {
          await runWithRetries(name, job);
          await finishDurableJobRun(db, runId, "succeeded");
        } catch (error) {
          console.error(`[Jobs] ${name} failed after retries; continuing remaining schedule:`, error);
          schedulerLastError = `${name}: ${errorMessage(error)}`;
          cycleFailures++;
          await finishDurableJobRun(db, runId, "failed", schedulerLastError);
        }
      }
    } catch (error) {
      schedulerLastError = `scheduler: ${errorMessage(error)}`;
      cycleFailures++;
      console.error("[Jobs] Scheduler cycle failed unexpectedly; the next cycle remains scheduled:", error);
    } finally {
      schedulerLastRunAt = new Date();
      schedulerConsecutiveFailures = cycleFailures > 0 ? schedulerConsecutiveFailures + 1 : 0;
      schedulerRunning = false;
    }
  };
  // Initial run after 10 seconds (let server fully start)
  setTimeout(() => {
    void runAll().catch(error => {
      schedulerRunning = false;
      console.error("[Jobs] Initial scheduled run failed:", error);
    });
  }, 10_000);
  // Then every hour
  setInterval(() => {
    void runAll().catch(error => {
      schedulerRunning = false;
      console.error("[Jobs] Scheduled run failed:", error);
    });
  }, 60 * 60 * 1000);
  console.log("[Jobs] Background jobs scheduled (every 1 hour, 8 jobs)");
}
