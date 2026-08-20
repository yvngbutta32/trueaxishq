import { and, eq, gte, lte, sql } from "drizzle-orm";
import {
  automations,
  automationLogs,
  bookings,
  clients,
  followUps,
  invoices,
  proposals,
} from "../drizzle/schema";
import { getDb } from "./db";
import { followUpEmail, sendEmail } from "./_core/email";
import { notifyOwner } from "./_core/notification";

export const SUPPORTED_AUTOMATION_ACTIONS = ["send_email", "create_followup", "notify_owner"] as const;
export type SupportedAutomationAction = (typeof SUPPORTED_AUTOMATION_ACTIONS)[number];

type AutomationAction = {
  type: SupportedAutomationAction;
  config: Record<string, unknown>;
};

type AutomationTarget = {
  entityType: "client" | "booking" | "invoice" | "proposal";
  entityId: number;
  userId: number;
  clientId: number | null;
  clientName: string;
  clientEmail: string | null;
  service?: string | null;
  invoiceNumber?: string | null;
  bookingDate?: string | null;
};

function asActions(value: string): AutomationAction[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((action): action is AutomationAction =>
        action && typeof action === "object" && SUPPORTED_AUTOMATION_ACTIONS.includes(action.type)
      )
      : [];
  } catch {
    return [];
  }
}

function interpolate(value: string, target: AutomationTarget): string {
  return value
    .replaceAll("{{client_name}}", target.clientName)
    .replaceAll("{{service}}", target.service || "your service")
    .replaceAll("{{invoice_number}}", target.invoiceNumber || "your invoice")
    .replaceAll("{{booking_date}}", target.bookingDate || "your appointment");
}

async function executeActions(name: string, actions: AutomationAction[], target: AutomationTarget) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  let actionsExecuted = 0;
  const issues: string[] = [];

  for (const action of actions) {
    const message = typeof action.config.message === "string" ? interpolate(action.config.message, target) : "";
    const subject = typeof action.config.subject === "string" && action.config.subject.trim()
      ? interpolate(action.config.subject, target)
      : name;

    try {
      if (action.type === "notify_owner") {
        const delivered = await notifyOwner({
          title: typeof action.config.title === "string" && action.config.title.trim() ? interpolate(action.config.title, target) : name,
          content: message || `Automation "${name}" ran for ${target.clientName}.`,
        });
        if (!delivered) throw new Error("Owner notification service unavailable");
        actionsExecuted++;
      }

      if (action.type === "send_email") {
        if (!target.clientEmail) {
          issues.push("Skipped email: the client has no email address.");
          continue;
        }
        if (!message.trim()) {
          issues.push("Skipped email: the action has no message.");
          continue;
        }
        const result = await sendEmail({
          to: target.clientEmail,
          subject,
          html: followUpEmail({ clientName: target.clientName, subject, body: message }),
        });
        if (!result.success) throw new Error(result.error || "Email delivery failed");
        actionsExecuted++;
      }

      if (action.type === "create_followup") {
        if (!message.trim()) {
          issues.push("Skipped follow-up: the action has no message.");
          continue;
        }
        await db.insert(followUps).values({
          userId: target.userId,
          clientId: target.clientId,
          clientName: target.clientName,
          clientEmail: target.clientEmail,
          subject,
          body: message,
          status: "draft",
        });
        actionsExecuted++;
      }
    } catch (error) {
      issues.push(error instanceof Error ? error.message : "Unknown action failure");
    }
  }

  return { actionsExecuted, issues };
}

async function findTargets(
  trigger: string,
  userId: number,
  notBefore: Date,
  dueBefore: Date,
): Promise<AutomationTarget[]> {
  const db = await getDb();
  if (!db) return [];

  if (trigger === "client_added") {
    const rows = await db.select().from(clients).where(and(
      eq(clients.userId, userId),
      gte(clients.createdAt, notBefore),
      lte(clients.createdAt, dueBefore),
    )).limit(100);
    return rows.map(row => ({ entityType: "client", entityId: row.id, userId, clientId: row.id, clientName: row.name, clientEmail: row.email, service: row.service }));
  }

  if (trigger === "booking_confirmed") {
    const rows = await db.select().from(bookings).where(and(
      eq(bookings.userId, userId),
      gte(bookings.createdAt, notBefore),
      lte(bookings.createdAt, dueBefore),
    )).limit(100);
    return rows.map(row => ({ entityType: "booking", entityId: row.id, userId, clientId: row.clientId, clientName: row.clientName, clientEmail: row.clientEmail, service: row.service, bookingDate: row.date }));
  }

  if (trigger === "invoice_sent") {
    const rows = await db.select().from(invoices).where(and(
      eq(invoices.userId, userId),
      eq(invoices.status, "sent"),
      gte(invoices.createdAt, notBefore),
      lte(invoices.createdAt, dueBefore),
    )).limit(100);
    return rows.map(row => ({ entityType: "invoice", entityId: row.id, userId, clientId: row.clientId, clientName: row.clientName, clientEmail: row.clientEmail, service: row.service, invoiceNumber: row.invoiceNumber }));
  }

  if (trigger === "invoice_paid") {
    const rows = await db.select().from(invoices).where(and(
      eq(invoices.userId, userId),
      eq(invoices.status, "paid"),
      gte(invoices.paidAt, notBefore),
      lte(invoices.paidAt, dueBefore),
    )).limit(100);
    return rows.map(row => ({ entityType: "invoice", entityId: row.id, userId, clientId: row.clientId, clientName: row.clientName, clientEmail: row.clientEmail, service: row.service, invoiceNumber: row.invoiceNumber }));
  }

  if (trigger === "invoice_overdue") {
    const rows = await db.select().from(invoices).where(and(
      eq(invoices.userId, userId),
      eq(invoices.status, "overdue"),
      gte(invoices.updatedAt, notBefore),
      lte(invoices.updatedAt, dueBefore),
    )).limit(100);
    return rows.map(row => ({ entityType: "invoice", entityId: row.id, userId, clientId: row.clientId, clientName: row.clientName, clientEmail: row.clientEmail, service: row.service, invoiceNumber: row.invoiceNumber }));
  }

  if (trigger === "proposal_signed") {
    const rows = await db.select().from(proposals).where(and(
      eq(proposals.userId, userId),
      eq(proposals.status, "signed"),
      gte(proposals.signedAt, notBefore),
      lte(proposals.signedAt, dueBefore),
    )).limit(100);
    return rows.map(row => ({ entityType: "proposal", entityId: row.id, userId, clientId: row.clientId, clientName: row.clientName, clientEmail: row.clientEmail, service: row.title }));
  }

  return [];
}

/**
 * Processes due automation events. It is idempotent per automation + entity:
 * a successfully logged entity is never executed twice for the same rule.
 */
export async function processDueAutomations(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const activeAutomations = await db.select().from(automations).where(eq(automations.active, true)).limit(200);
  const now = new Date();

  for (const automation of activeAutomations) {
    const delayMs = Math.max(0, automation.triggerDelayHours ?? 0) * 60 * 60 * 1000;
    const dueBefore = new Date(now.getTime() - delayMs);
    const targets = await findTargets(automation.trigger, automation.userId, automation.createdAt, dueBefore);
    const actions = asActions(automation.actions);

    for (const target of targets) {
      const [priorRun] = await db.select({ id: automationLogs.id }).from(automationLogs).where(and(
        eq(automationLogs.automationId, automation.id),
        eq(automationLogs.entityType, target.entityType),
        eq(automationLogs.entityId, target.entityId),
        eq(automationLogs.status, "success"),
      )).limit(1);
      if (priorRun) continue;

      if (actions.length === 0) {
        await db.insert(automationLogs).values({
          automationId: automation.id,
          userId: automation.userId,
          trigger: automation.trigger,
          entityType: target.entityType,
          entityId: target.entityId,
          status: "skipped",
          actionsExecuted: 0,
          errorMessage: "No supported actions are configured for this automation.",
        });
        continue;
      }

      const result = await executeActions(automation.name, actions, target);
      const status = result.actionsExecuted > 0 && result.issues.length === 0 ? "success" : result.actionsExecuted > 0 ? "success" : "failed";
      await db.insert(automationLogs).values({
        automationId: automation.id,
        userId: automation.userId,
        trigger: automation.trigger,
        entityType: target.entityType,
        entityId: target.entityId,
        status,
        actionsExecuted: result.actionsExecuted,
        errorMessage: result.issues.length ? result.issues.join(" | ").slice(0, 4000) : null,
      });
      if (status === "success") {
        await db.update(automations)
          .set({ runCount: sql`${automations.runCount} + 1`, lastRunAt: new Date() })
          .where(eq(automations.id, automation.id));
      }
    }
  }
}
