import type { Request, Response } from "express";
import Stripe from "stripe";
import { and, eq, inArray, lt, lte, or, sql } from "drizzle-orm";
import { getDb } from "./db";
import { users, invoices, stripeWebhookEvents, stripeAccounts } from "../drizzle/schema";
import { notifyOwner } from "./_core/notification";
import { decryptWebhookSecret, encryptWebhookSecret } from "./workflowWebhookDelivery";

// ─── DB-backed receipt, idempotency, and recovery ─────────────────────────────
// Every accepted Stripe event is written before returning 2xx. The encrypted
// envelope permits bounded recovery after a process restart; it does not prove
// that Stripe or any receiving business workflow completed a separate action.
const MAX_EVENT_BYTES = 120_000;
const MAX_PROCESSING_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000, 7_200_000];
const PROCESSING_LEASE_MS = 10 * 60_000;

function truncateError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Stripe event processing failed.";
  return message.replace(/[\r\n]+/g, " ").slice(0, 1_000);
}

function nextRetryTime(attemptCount: number): Date | null {
  const delay = RETRY_DELAYS_MS[Math.max(0, attemptCount - 1)];
  return delay === undefined ? null : new Date(Date.now() + delay);
}

function serializeRecoveryEnvelope(event: Stripe.Event): string {
  const serialized = JSON.stringify({ id: event.id, type: event.type, data: { object: event.data.object } });
  if (Buffer.byteLength(serialized, "utf8") > MAX_EVENT_BYTES) {
    throw new Error("Stripe event exceeds the bounded recovery envelope limit.");
  }
  return serialized;
}

function parseRecoveryEnvelope(ciphertext: string): { eventType: string; data: Stripe.Event["data"]["object"] } {
  const decrypted = decryptWebhookSecret(ciphertext);
  const parsed = JSON.parse(decrypted) as { type?: unknown; data?: { object?: unknown } };
  if (!parsed || typeof parsed.type !== "string" || !parsed.data || typeof parsed.data.object !== "object" || parsed.data.object === null) {
    throw new Error("Stored Stripe event recovery envelope is invalid.");
  }
  return { eventType: parsed.type, data: parsed.data.object as Stripe.Event["data"]["object"] };
}

async function processStoredStripeEvent(eventId: string): Promise<"processed" | "skipped" | "retryable" | "terminal"> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");
  const [event] = await db.select().from(stripeWebhookEvents).where(eq(stripeWebhookEvents.eventId, eventId)).limit(1);
  const staleBefore = new Date(Date.now() - PROCESSING_LEASE_MS);
  const canReclaimProcessingLease = event?.status === "processing" && Boolean(event.processingStartedAt && event.processingStartedAt < staleBefore);
  if (!event || event.status === "processed" || event.status === "terminal" || (event.status === "processing" && !canReclaimProcessingLease) || !event.payloadCiphertext) return "skipped";

  const claim = await db.update(stripeWebhookEvents).set({ status: "processing", processingStartedAt: new Date() })
    .where(and(eq(stripeWebhookEvents.eventId, eventId), or(
      inArray(stripeWebhookEvents.status, ["received", "retryable"]),
      and(eq(stripeWebhookEvents.status, "processing"), lt(stripeWebhookEvents.processingStartedAt, staleBefore)),
    )));
  if (!claim[0].affectedRows) return "skipped";

  try {
    const envelope = parseRecoveryEnvelope(event.payloadCiphertext);
    await processEvent(envelope.eventType, envelope.data);
    await db.update(stripeWebhookEvents).set({
      status: "processed",
      attemptCount: event.attemptCount + 1,
      completedAt: new Date(),
      processedAt: new Date(),
      processingStartedAt: null,
      nextAttemptAt: null,
      lastError: null,
    }).where(and(eq(stripeWebhookEvents.eventId, eventId), eq(stripeWebhookEvents.status, "processing")));
    console.log(`[Stripe recovery] Processed ${event.eventType} (${event.eventId}).`);
    return "processed";
  } catch (error) {
    const attemptCount = event.attemptCount + 1;
    const terminal = attemptCount >= MAX_PROCESSING_ATTEMPTS;
    const message = truncateError(error);
    await db.update(stripeWebhookEvents).set({
      status: terminal ? "terminal" : "retryable",
      attemptCount,
      processingStartedAt: null,
      nextAttemptAt: terminal ? null : nextRetryTime(attemptCount),
      lastError: message,
    }).where(and(eq(stripeWebhookEvents.eventId, eventId), eq(stripeWebhookEvents.status, "processing")));
    if (terminal) {
      await notifyOwner({ title: "Stripe event needs review", content: `Event ${event.eventId} (${event.eventType}) reached the bounded processing limit. Review the payment provider event and application logs before taking action.` }).catch(() => undefined);
      console.error(`[Stripe recovery] Terminal processing failure for ${event.eventType} (${event.eventId}).`);
      return "terminal";
    }
    console.warn(`[Stripe recovery] Retryable processing failure for ${event.eventType} (${event.eventId}).`);
    return "retryable";
  }
}

export async function processDueStripeEvents(limit = 10): Promise<{ processed: number; skipped: number; retryable: number; terminal: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");
  const staleBefore = new Date(Date.now() - PROCESSING_LEASE_MS);
  const due = await db.select({ eventId: stripeWebhookEvents.eventId }).from(stripeWebhookEvents)
    .where(or(
      eq(stripeWebhookEvents.status, "received"),
      and(eq(stripeWebhookEvents.status, "retryable"), lte(stripeWebhookEvents.nextAttemptAt, new Date())),
      and(eq(stripeWebhookEvents.status, "processing"), lt(stripeWebhookEvents.processingStartedAt, staleBefore)),
    ))
    .orderBy(stripeWebhookEvents.nextAttemptAt)
    .limit(Math.min(Math.max(limit, 1), 25));
  const summary = { processed: 0, skipped: 0, retryable: 0, terminal: 0 };
  for (const event of due) summary[await processStoredStripeEvent(event.eventId)]++;
  return summary;
}

export function canAcceptUnsignedStripeEvent(environment = process.env.NODE_ENV): boolean {
  return environment === "development";
}

// ─── Core event processor ─────────────────────────────────────────────────────
async function processEvent(eventType: string, data: Stripe.Event["data"]["object"]) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable — will retry");

  switch (eventType) {
    case "account.updated": {
      const account = data as Stripe.Account;
      await db.update(stripeAccounts).set({
        chargesEnabled: Boolean(account.charges_enabled),
        payoutsEnabled: Boolean(account.payouts_enabled),
        detailsSubmitted: Boolean(account.details_submitted),
      }).where(eq(stripeAccounts.stripeAccountId, account.id));
      break;
    }
    case "checkout.session.completed": {
      const session = data as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const planId = (session.metadata?.plan_id ?? "starter") as string;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;
      const invoiceIdMeta = session.metadata?.invoice_id;
      const bookingIdMeta = session.metadata?.booking_id;

      // ── Booking deposit: mark the deposit paid on this booking only ──────
      if (bookingIdMeta && !subscriptionId) {
        const bookingIdNum = parseInt(bookingIdMeta, 10);
        if (!isNaN(bookingIdNum)) {
          const { bookings } = await import("../drizzle/schema");
          const [existingBooking] = await db.select({ id: bookings.id, depositStatus: bookings.depositStatus })
            .from(bookings).where(eq(bookings.id, bookingIdNum)).limit(1);
          if (!existingBooking || existingBooking.depositStatus === "paid") {
            console.log(`[Webhook] Booking ${bookingIdNum} deposit already paid or not found — skipping`);
            break;
          }
          await db.update(bookings).set({
            depositStatus: "paid",
            depositPaidAt: new Date(),
            updatedAt: new Date(),
          }).where(eq(bookings.id, bookingIdNum));
          notifyOwner({
            title: `💰 Booking Deposit Paid — ${session.metadata?.client_name ?? "Client"}`,
            content: `The $${(Number(session.metadata?.deposit_amount_cents ?? 0) / 100).toFixed(2)} booking deposit was paid via Stripe Checkout.`,
          }).catch(() => {});
          console.log(`[Webhook] Booking ${bookingIdMeta} deposit marked paid.`);
          break;
        }
      }

      // ── Invoice Pay Now: auto-mark the invoice as paid ────────────────────
      if (invoiceIdMeta && !subscriptionId) {
        const invIdNum = parseInt(invoiceIdMeta, 10);
        if (!isNaN(invIdNum)) {
          // Verify invoice exists and is not already paid before marking paid
          const [existingInv] = await db.select({ id: invoices.id, status: invoices.status })
            .from(invoices).where(eq(invoices.id, invIdNum)).limit(1);
          if (!existingInv || existingInv.status === "paid") {
            console.log(`[Webhook] Invoice ${invIdNum} already paid or not found — skipping`);
            break;
          }
          await db.update(invoices).set({
            status: "paid",
            paidAt: new Date(),
            updatedAt: new Date(),
          }).where(eq(invoices.id, invIdNum));
          notifyOwner({
            title: `💰 Invoice Paid — ${session.metadata?.client_name ?? "Client"}`,
            content: `Invoice #${session.metadata?.invoice_number || invoiceIdMeta} has been paid via Stripe Checkout.`,
          }).catch(() => {});
          console.log(`[Webhook] Invoice ${invoiceIdMeta} auto-marked as paid via Stripe Checkout.`);
          break;
        }
      }

      // ── Subscription checkout ─────────────────────────────────────────────
      if (userId) {
        await db.update(users).set({
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus: "active",
          planId,
          updatedAt: new Date(),
        }).where(eq(users.id, parseInt(userId, 10)));
      } else if (customerId) {
        // Fallback: match by customer ID if user_id metadata is missing
        await db.update(users).set({
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus: "active",
          planId,
          updatedAt: new Date(),
        }).where(eq(users.stripeCustomerId, customerId));
      }

      notifyOwner({
        title: `💳 New Subscription — ${session.metadata?.customer_name ?? "Unknown"}`,
        content: `**Plan:** ${planId}\n**Email:** ${session.metadata?.customer_email ?? "Unknown"}\n**Customer ID:** ${customerId}\n**Subscription ID:** ${subscriptionId}`,
      }).catch(() => {});
      break;
    }

    case "customer.subscription.updated": {
      const sub = data as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : (sub.customer as any)?.id;
      if (!customerId) break;
      // Normalize Stripe status to our enum
      const status = (["active", "past_due", "cancelled", "inactive"].includes(sub.status)
        ? sub.status
        : sub.status === "canceled" ? "cancelled"
        : sub.status === "trialing" ? "active"
        : "inactive") as "active" | "past_due" | "cancelled" | "inactive";
      await db.update(users).set({
        subscriptionStatus: status,
        stripeSubscriptionId: sub.id,
        updatedAt: new Date(),
      }).where(eq(users.stripeCustomerId, customerId));
      break;
    }

    case "customer.subscription.deleted": {
      const sub = data as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : (sub.customer as any)?.id;
      if (!customerId) break;
      await db.update(users).set({
        subscriptionStatus: "cancelled",
        planId: "free",
        stripeSubscriptionId: null,
        updatedAt: new Date(),
      }).where(eq(users.stripeCustomerId, customerId));
      notifyOwner({
        title: "❌ Subscription Cancelled",
        content: `Customer ${customerId} cancelled their subscription (${sub.id}).`,
      }).catch(() => {});
      break;
    }

    case "invoice.paid": {
      const inv = data as Stripe.Invoice;
      const customerId = typeof inv.customer === "string" ? inv.customer : (inv.customer as any)?.id;
      if (!customerId) break;
      await db.update(users).set({
        subscriptionStatus: "active",
        updatedAt: new Date(),
      }).where(eq(users.stripeCustomerId, customerId));
      break;
    }

    case "invoice.payment_failed": {
      const inv = data as Stripe.Invoice;
      const customerId = typeof inv.customer === "string" ? inv.customer : (inv.customer as any)?.id;
      if (!customerId) break;
      await db.update(users).set({
        subscriptionStatus: "past_due",
        updatedAt: new Date(),
      }).where(eq(users.stripeCustomerId, customerId));
      notifyOwner({
        title: "⚠️ Payment Failed",
        content: `Customer ${customerId} failed to pay invoice ${(inv as any).id}.`,
      }).catch(() => {});
      break;
    }

    default:
      console.log(`[Webhook] Unhandled event type: ${eventType}`);
  }
}

// ─── Main webhook handler ─────────────────────────────────────────────────────
export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeKey) {
    console.error("[Webhook] STRIPE_SECRET_KEY not configured");
    return res.status(500).json({ error: "Payment system not configured" });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2026-02-25.clover" });
  let event: Stripe.Event;

  try {
    if (!webhookSecret || !sig) {
      if (!canAcceptUnsignedStripeEvent()) {
        console.error("[Webhook] STRIPE_WEBHOOK_SECRET or Stripe signature missing outside development");
        return res.status(503).json({ error: "Webhook signature verification is not configured" });
      }
      // Development-only local event inspection. Production always requires a signed event.
      event = JSON.parse(req.body.toString()) as Stripe.Event;
    } else {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Webhook] Signature verification failed:", message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${message}` });
  }

  // Test event passthrough
  if (event.id.startsWith("evt_test_")) {
    console.log("[Webhook] Test event detected, returning verification response");
    return res.json({ verified: true });
  }

  // Receipt and idempotency guard. Existing historical rows use the additive
  // default `processed` status, so duplicate events remain safely ignored.
  const db = await getDb();
  if (!db) return res.status(503).json({ error: "Payment event storage is temporarily unavailable" });
  const [existing] = await db.select({ id: stripeWebhookEvents.id }).from(stripeWebhookEvents).where(eq(stripeWebhookEvents.eventId, event.id)).limit(1);
  if (existing) {
    console.log(`[Webhook] Duplicate event ${event.id} ignored`);
    return res.json({ received: true, duplicate: true });
  }

  try {
    await db.insert(stripeWebhookEvents).values({
      eventId: event.id,
      eventType: event.type,
      status: "received",
      payloadCiphertext: encryptWebhookSecret(serializeRecoveryEnvelope(event)),
      attemptCount: 0,
      processedAt: new Date(),
    });
  } catch (error) {
    console.error("[Webhook] Durable event receipt failed:", truncateError(error));
    return res.status(503).json({ error: "Payment event storage is temporarily unavailable" });
  }

  // Acknowledge only after the durable event receipt succeeds. Processing runs
  // separately so a restart leaves an explicit recoverable record.
  res.json({ received: true });
  void processStoredStripeEvent(event.id).catch(error => console.error("[Webhook] Durable processing start failed:", truncateError(error)));
  void processDueStripeEvents(5).catch(error => console.error("[Webhook] Due recovery check failed:", truncateError(error)));
}
