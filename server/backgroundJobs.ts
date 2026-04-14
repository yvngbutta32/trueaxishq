/**
 * Background Jobs — runs on server startup, fires every hour
 * 1. Recurring invoice auto-generation
 * 2. Overdue invoice auto-detection
 * 3. Follow-up reminder auto-scheduling
 * All jobs are idempotent and safe to run repeatedly.
 */
import { eq, and, lte, sql } from "drizzle-orm";
import { getDb, resetDbConnection } from "./db";
import {
  invoices,
  recurringInvoices,
  notifications,
  followUps,
} from "../drizzle/schema";
import { sendEmail, invoiceReminderEmail } from "./_core/email";

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
      // Find all active recurring invoices that are due
      // nextDueAt is a timestamp column — compare with JS Date directly via Drizzle lte
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
          // Create the invoice
          const invoiceNumber = generateInvoiceNumber();
          const dueAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
          const dueDateStr = dueAt.toISOString().split("T")[0]; // YYYY-MM-DD
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

          // Advance nextDueAt
          const newNextDue = nextDueDate(rec.nextDueAt, rec.frequency);
          await db
            .update(recurringInvoices)
            .set({ nextDueAt: newNextDue, lastInvoiceId: invoiceId })
            .where(eq(recurringInvoices.id, rec.id));

          // Create in-app notification for the user
          await db.insert(notifications).values({
            userId: rec.userId,
            title: "Recurring Invoice Generated",
            body: `Invoice ${invoiceNumber} for ${rec.clientName} ($${rec.amount}) has been automatically created and sent.`,
            type: "success",
            link: "/dashboard",
          });

          // Send email reminder to client if email available
          if (rec.clientEmail) {
            await sendEmail({
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

          console.log(
            `[Jobs] Generated recurring invoice ${invoiceNumber} for user ${rec.userId}`
          );
        } catch (err) {
          console.error(
            `[Jobs] Failed to generate recurring invoice ${rec.id}:`,
            err
          );
        }
      }
      return; // success
    } catch (err: any) {
      const isTransient =
        err?.code === "ECONNRESET" ||
        err?.code === "ETIMEDOUT" ||
        err?.code === "ECONNREFUSED";
      console.error(
        `[Jobs] runRecurringInvoices error (attempt ${attempt}/2):`,
        { code: err?.code, message: err?.message }
      );
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

      // dueDate is stored as 'YYYY-MM-DD' string — use raw SQL for string comparison
      // This is the safest approach for MySQL varchar date fields
      const todayStr = new Date().toISOString().split("T")[0];
      await db.execute(
        sql`UPDATE invoices SET status = 'overdue' WHERE status = 'sent' AND dueDate IS NOT NULL AND dueDate != '' AND dueDate < ${todayStr}`
      );

      console.log(`[Jobs] Overdue detection complete for ${todayStr}`);
      return; // success
    } catch (err: any) {
      const isTransient =
        err?.code === "ECONNRESET" ||
        err?.code === "ETIMEDOUT" ||
        err?.code === "ECONNREFUSED";
      console.error(
        `[Jobs] runOverdueDetection error (attempt ${attempt}/2):`,
        { code: err?.code, message: err?.message }
      );
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

      // Use raw SQL for timestamp comparison to avoid Drizzle Date serialization issues
      const sevenDaysAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .replace("T", " ")
        .split(".")[0]; // 'YYYY-MM-DD HH:MM:SS'

      // Find draft follow-ups older than 7 days — remind user to send them
      const stale = await db.execute(
        sql`SELECT id, userId, clientName FROM followUps WHERE status = 'draft' AND createdAt <= ${sevenDaysAgoStr} LIMIT 20`
      ) as any;

      const rows: Array<{ id: number; userId: number; clientName: string }> =
        Array.isArray(stale) ? stale[0] ?? [] : stale?.rows ?? [];

      for (const fu of rows) {
        try {
          // Check if we already notified recently (avoid spam)
          const existing = await db.execute(
            sql`SELECT id FROM notifications WHERE userId = ${fu.userId} AND body LIKE ${`%${fu.clientName}%`} AND createdAt > DATE_SUB(NOW(), INTERVAL 1 DAY) LIMIT 1`
          ) as any;
          const existingRows = Array.isArray(existing)
            ? existing[0] ?? []
            : existing?.rows ?? [];
          if (existingRows.length > 0) continue;

          await db.insert(notifications).values({
            userId: fu.userId,
            title: `Unsent Follow-up: ${fu.clientName}`,
            body: `You have a draft follow-up for ${fu.clientName} that hasn't been sent yet. Head to Follow-ups to review it.`,
            type: "info",
            link: "/dashboard",
          });

          console.log(
            `[Jobs] Reminded user ${fu.userId} about stale follow-up for ${fu.clientName}`
          );
        } catch (err) {
          console.error(
            `[Jobs] Failed to notify stale follow-up ${fu.id}:`,
            err
          );
        }
      }
      return; // success
    } catch (err: any) {
      const isTransient =
        err?.code === "ECONNRESET" ||
        err?.code === "ETIMEDOUT" ||
        err?.code === "ECONNREFUSED";
      console.error(
        `[Jobs] runFollowUpReminders error (attempt ${attempt}/2):`,
        { code: err?.code, message: err?.message }
      );
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

  // Run immediately on startup
  const runAll = async () => {
    await runOverdueDetection();
    await runRecurringInvoices();
    await runFollowUpReminders();
  };

  // Initial run after 10 seconds (let server fully start)
  setTimeout(runAll, 10_000);

  // Then every hour
  setInterval(runAll, 60 * 60 * 1000);

  console.log("[Jobs] Background jobs scheduled (every 1 hour)");
}
