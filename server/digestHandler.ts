/**
 * Daily Digest Handler — fires at 8 AM UTC every day
 * Sends the owner a morning briefing: today's bookings, overdue invoices, follow-ups pending
 */
import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import { bookings, invoices, followUps } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";

export async function dailyDigestHandler(req: Request, res: Response) {
  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "DB unavailable" });
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", timeZone: "UTC"
    });

    // Today's date string for bookings (stored as varchar "YYYY-MM-DD")
    const todayStr = now.toISOString().slice(0, 10);

    // Get today's bookings
    const todayBookings = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.date, todayStr),
          eq(bookings.status, "scheduled")
        )
      );

    // Get overdue invoices
    const nowMs = now.getTime();
    const overdueInvoices = await db
      .select()
      .from(invoices)
      .where(eq(invoices.status, "overdue"));

    // Also get sent invoices past due date
    const sentPastDue = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.status, "sent"),
          sql`${invoices.dueDate} < ${nowMs}`
        )
      );

    const allOverdue = [...overdueInvoices, ...sentPastDue];

    // Get pending follow-ups (draft = not yet sent)
    const pendingFollowUps = await db
      .select()
      .from(followUps)
      .where(eq(followUps.status, "draft"));

    // Build digest content
    const lines: string[] = [`📅 Good morning! Here's your TrueAxis HQ digest for ${dateStr}.`, ""];

    // Today's bookings
    if (todayBookings.length === 0) {
      lines.push("📆 **Today's Sessions:** No sessions scheduled today.");
    } else {
      lines.push(`📆 **Today's Sessions (${todayBookings.length}):**`);
      for (const b of todayBookings) {
        lines.push(`  • ${b.time} — ${b.clientName} (${b.service || "Session"})`);
      }
    }

    lines.push("");

    // Overdue invoices
    if (allOverdue.length === 0) {
      lines.push("✅ **Overdue Invoices:** None — you're all caught up!");
    } else {
      const totalOwed = allOverdue.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
      lines.push(`🔴 **Overdue Invoices (${allOverdue.length}) — $${(totalOwed / 100).toFixed(2)} owed:**`);
      for (const inv of allOverdue.slice(0, 5)) {
        const daysOverdue = inv.dueDate
          ? Math.floor((nowMs - Number(inv.dueDate)) / (1000 * 60 * 60 * 24))
          : 0;
        lines.push(`  • Invoice #${inv.invoiceNumber || inv.id} — $${(Number(inv.amount || 0) / 100).toFixed(2)} (${daysOverdue}d overdue)`);
      }
      if (allOverdue.length > 5) lines.push(`  • ...and ${allOverdue.length - 5} more`);
    }

    lines.push("");

    // Pending follow-ups
    if (pendingFollowUps.length === 0) {
      lines.push("📋 **Pending Follow-Ups:** None.");
    } else {
      lines.push(`📋 **Pending Follow-Ups (${pendingFollowUps.length}):**`);
      for (const fu of pendingFollowUps.slice(0, 5)) {
        lines.push(`  • ${fu.subject || "Follow-up"} — ${fu.clientName}`);
      }
      if (pendingFollowUps.length > 5) lines.push(`  • ...and ${pendingFollowUps.length - 5} more`);
    }

    lines.push("");
    lines.push("Have a productive day! 🚀");

    const content = lines.join("\n");
    await notifyOwner({ title: `📅 Daily Digest — ${dateStr}`, content });

    return res.json({
      ok: true,
      bookings: todayBookings.length,
      overdue: allOverdue.length,
      followUps: pendingFollowUps.length
    });
  } catch (err) {
    console.error("[dailyDigest] error:", err);
    return res.status(500).json({
      error: String(err),
      timestamp: new Date().toISOString(),
    });
  }
}
