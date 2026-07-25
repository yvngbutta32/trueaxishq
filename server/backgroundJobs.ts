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
} from "../drizzle/schema";
import { sendEmail, invoiceReminderEmail, followUpEmail, monthlyReportEmail } from "./_core/email";

// ─── Invoice number generator ─────────────────────────────────────────────────
function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `INV-${year}${month}-${rand}`;
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
            status: "sent",
            dueDate: dueDateStr,
            notes: `Auto-generated recurring invoice (${rec.frequency})`,
          });
          const invoiceId = (result as any).insertId;

          const newNextDue = nextDueDate(rec.nextDueAt, rec.frequency);
          await db
            .update(recurringInvoices)
            .set({ nextDueAt: newNextDue, lastInvoiceId: invoiceId })
            .where(eq(recurringInvoices.id, rec.id));

          await db.insert(notifications).values({
            userId: rec.userId,
            title: "Recurring Invoice Generated",
            body: `Invoice ${invoiceNumber} for ${rec.clientName} ($${rec.amount}) has been automatically created and sent.`,
            type: "success",
            link: "/dashboard",
          });

          if (rec.clientEmail) {
            await sendEmail({
              to: rec.clientEmail,
              subject: `Invoice ${invoiceNumber} from SkillBridge AI`,
              html: invoiceReminderEmail({
                clientName: rec.clientName,
                invoiceNumber,
                amount: rec.amount,
                dueDate: dueAt.toLocaleDateString(),
              }),
            });
          }

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
          const cutoffDate = new Date(Date.now() - rule.triggerDays * 24 * 60 * 60 * 1000);
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
                    AND fu.createdAt > DATE_SUB(NOW(), INTERVAL ${rule.triggerDays} DAY)
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

              // Send the actual email
              await sendEmail({
                to: client.email,
                subject: rule.emailSubject,
                html: followUpEmail({
                  clientName: client.name,
                  subject: rule.emailSubject,
                  body: personalizedBody,
                }),
              });

              // Mark sent only after email delivery succeeded
              if (fuId) {
                await db.update(followUps).set({ status: "sent", sentAt: new Date() })
                  .where(eq(followUps.id, fuId));
              }

              console.log('[Jobs] Auto follow-up rule sent for user ' + rule.userId);
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

// ─── Monthly report sent-once guard ──────────────────────────────────────────
// ─── Job: Monthly business report email (runs on 1st of month) ───────────────
async function runMonthlyReport() {
  const now = new Date();
  // Only run on the 1st of the month (check within the hourly window)
  if (now.getDate() !== 1) return;

  // Prevent sending more than once per month — use DB so server restarts don't re-send
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  try {
    const guardDb = await getDb();
    if (!guardDb) return;
    const sentCheck = await guardDb.execute(
      sql`SELECT 1 FROM notifications WHERE title = ${`monthly_report_guard:${monthKey}`} LIMIT 1`
    ) as any;
    const sentRows = Array.isArray(sentCheck) ? sentCheck[0] ?? [] : sentCheck?.rows ?? [];
    if (sentRows.length > 0) {
      console.log(`[Jobs] Monthly report already sent for ${monthKey} — skipping`);
      return;
    }
    // Insert guard record before sending to prevent double-send on concurrent runs
    await guardDb.insert(notifications).values({
      userId: 0,
      title: `monthly_report_guard:${monthKey}`,
      body: monthKey,
      type: 'info',
    });
  } catch {
    console.warn('[Jobs] Could not check monthly report guard — proceeding anyway');
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
          // Revenue from paid invoices last month
          const revenueResult = await db.execute(
            sql`SELECT COALESCE(SUM(CAST(amount AS DECIMAL(10,2))), 0) as total FROM invoices WHERE userId = ${user.id} AND status = 'paid' AND paidAt BETWEEN ${lastMonthStartStr} AND ${lastMonthEndStr}`
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

          await sendEmail({
            to: user.email,
            subject: `Your ${monthLabel} Business Report — SkillBridge AI`,
            html: monthlyReportEmail({
              name: displayName,
              month: monthLabel,
              totalRevenue: `$${totalRevenue}`,
              newClients,
              invoicesPaid,
              invoicesOutstanding,
              aiInsight: `You completed ${totalBookings} booking${totalBookings !== 1 ? "s" : ""} this month.`,
              dashboardUrl: process.env.VITE_FRONTEND_FORGE_API_URL?.replace("/api", "") || "https://skillbridge-ai.com",
            }),
          });

          console.log('[Jobs] Monthly report sent for ' + monthLabel);
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
export function startBackgroundJobs() {
  console.log("[Jobs] Background job scheduler starting...");

  const runAll = async () => {
    await runOverdueDetection();
    await runRecurringInvoices();
    await runFollowUpReminders();
    await runFollowUpRules();
    await runMonthlyReport();
  };

  // Initial run after 10 seconds (let server fully start)
  setTimeout(runAll, 10_000);

  // Then every hour
  setInterval(runAll, 60 * 60 * 1000);

  console.log("[Jobs] Background jobs scheduled (every 1 hour, 5 jobs)");
}
