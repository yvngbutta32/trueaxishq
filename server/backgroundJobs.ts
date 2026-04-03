/**
 * Background Jobs — runs on server startup, fires every hour
 * 1. Recurring invoice auto-generation
 * 2. Overdue invoice auto-detection
 * 3. Follow-up reminder auto-scheduling
 * All jobs are idempotent and safe to run repeatedly.
 */
import { eq, and, lte, sql } from "drizzle-orm";
import { getDb } from "./db";
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
  try {
    const db = await getDb();
    if (!db) return;

    const now = new Date();
    // Find all active recurring invoices that are due
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
        const dueDateStr = dueAt.toISOString().split('T')[0]; // YYYY-MM-DD
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
  } catch (err) {
    console.error("[Jobs] runRecurringInvoices error:", err);
  }
}

// ─── Job: Auto-detect overdue invoices ───────────────────────────────────────
async function runOverdueDetection() {
  try {
    const db = await getDb();
    if (!db) return;

    const now = new Date();
    // Mark sent invoices past their due date as overdue
    // dueDate is stored as 'YYYY-MM-DD' string
    const todayStr = now.toISOString().split('T')[0];
    const result = await db
      .update(invoices)
      .set({ status: "overdue" })
      .where(
        and(
          eq(invoices.status, "sent"),
          sql`${invoices.dueDate} IS NOT NULL AND ${invoices.dueDate} < ${todayStr}`
        )
      );

    const affected = (result as any)[0]?.affectedRows ?? 0;
    if (affected > 0) {
      console.log(`[Jobs] Marked ${affected} invoice(s) as overdue`);
    }
  } catch (err) {
    console.error("[Jobs] runOverdueDetection error:", err);
  }
}

// ─── Job: Notify users of draft follow-ups older than 7 days ─────────────────
async function runFollowUpReminders() {
  try {
    const db = await getDb();
    if (!db) return;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    // Find draft follow-ups older than 7 days — remind user to send them
    const stale = await db
      .select()
      .from(followUps)
      .where(
        and(
          eq(followUps.status, "draft"),
          lte(followUps.createdAt, sevenDaysAgo)
        )
      )
      .limit(20);

    for (const fu of stale) {
      try {
        // Check if we already notified recently (avoid spam)
        const existing = await db.select({ id: notifications.id }).from(notifications)
          .where(
            and(
              eq(notifications.userId, fu.userId),
              sql`${notifications.body} LIKE ${`%${fu.clientName}%`}`,
              sql`${notifications.createdAt} > ${new Date(Date.now() - 24 * 60 * 60 * 1000)}`
            )
          ).limit(1);
        if (existing.length > 0) continue;

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
        console.error(`[Jobs] Failed to notify stale follow-up ${fu.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[Jobs] runFollowUpReminders error:", err);
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
