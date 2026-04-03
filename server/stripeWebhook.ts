import type { Request, Response } from "express";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { users, invoices } from "../drizzle/schema";
import { notifyOwner } from "./_core/notification";

// ─── Idempotency cache — prevents duplicate processing of retried webhooks ────
const processedEvents = new Map<string, number>();
const EVENT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function isAlreadyProcessed(eventId: string): boolean {
  const ts = processedEvents.get(eventId);
  if (!ts) return false;
  if (Date.now() - ts > EVENT_CACHE_TTL_MS) {
    processedEvents.delete(eventId);
    return false;
  }
  return true;
}

function markProcessed(eventId: string) {
  processedEvents.set(eventId, Date.now());
  // Prune stale entries to prevent memory leak
  if (processedEvents.size > 10000) {
    const cutoff = Date.now() - EVENT_CACHE_TTL_MS;
    for (const [id, ts] of Array.from(processedEvents.entries())) {
      if (ts < cutoff) processedEvents.delete(id);
    }
  }
}

// ─── Retry queue for transient DB failures ────────────────────────────────────
interface RetryItem {
  eventId: string;
  eventType: string;
  data: Stripe.Event["data"]["object"];
  attempts: number;
  nextRetryAt: number;
}

const retryQueue: RetryItem[] = [];
const MAX_RETRIES = 5;
const RETRY_DELAYS_MS = [5_000, 15_000, 60_000, 300_000, 900_000];

async function flushRetryQueue() {
  const now = Date.now();
  const due = retryQueue.filter(item => item.nextRetryAt <= now);
  for (const item of due) {
    try {
      await processEvent(item.eventType, item.data);
      const idx = retryQueue.indexOf(item);
      if (idx !== -1) retryQueue.splice(idx, 1);
      markProcessed(item.eventId);
      console.log(`[Webhook Retry] ✅ ${item.eventType} (${item.eventId}) on attempt ${item.attempts + 1}`);
    } catch (err) {
      item.attempts++;
      if (item.attempts >= MAX_RETRIES) {
        console.error(`[Webhook Retry] ❌ Giving up on ${item.eventType} (${item.eventId}) after ${MAX_RETRIES} attempts`);
        notifyOwner({
          title: "⚠️ Webhook Processing Failed",
          content: `Event ${item.eventId} (${item.eventType}) failed after ${MAX_RETRIES} retries. Manual review required.`,
        }).catch(() => {});
        const idx = retryQueue.indexOf(item);
        if (idx !== -1) retryQueue.splice(idx, 1);
      } else {
        item.nextRetryAt = Date.now() + (RETRY_DELAYS_MS[item.attempts] ?? 900_000);
        console.warn(`[Webhook Retry] Retry ${item.attempts}/${MAX_RETRIES} for ${item.eventType} (${item.eventId})`);
      }
    }
  }
}

// Flush every 30 seconds
setInterval(flushRetryQueue, 30_000);

// ─── Core event processor ─────────────────────────────────────────────────────
async function processEvent(eventType: string, data: Stripe.Event["data"]["object"]) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable — will retry");

  switch (eventType) {
    case "checkout.session.completed": {
      const session = data as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const planId = (session.metadata?.plan_id ?? "starter") as string;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;
      const invoiceIdMeta = session.metadata?.invoice_id;

      // ── Invoice Pay Now: auto-mark the invoice as paid ────────────────────
      if (invoiceIdMeta && !subscriptionId) {
        const invIdNum = parseInt(invoiceIdMeta, 10);
        if (!isNaN(invIdNum)) {
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
        }).where(eq(users.id, parseInt(userId)));
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
      // Dev mode: parse unsigned event
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

  // Idempotency guard
  if (isAlreadyProcessed(event.id)) {
    console.log(`[Webhook] Duplicate event ${event.id} ignored`);
    return res.json({ received: true, duplicate: true });
  }

  // Acknowledge immediately — Stripe requires response within 30s
  res.json({ received: true });

  // Process asynchronously with retry fallback
  try {
    await processEvent(event.type, event.data.object);
    markProcessed(event.id);
    console.log(`[Webhook] ✅ Processed ${event.type} (${event.id})`);
  } catch (err) {
    console.error(`[Webhook] ❌ Failed to process ${event.type} (${event.id}):`, err);
    retryQueue.push({
      eventId: event.id,
      eventType: event.type,
      data: event.data.object,
      attempts: 1,
      nextRetryAt: Date.now() + (RETRY_DELAYS_MS[0] ?? 5_000),
    });
  }
}
