import type { Request, Response } from "express";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { notifyOwner } from "./_core/notification";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2026-02-25.clover" });
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const stripe = getStripe();
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    if (!webhookSecret || !sig) {
      // Allow unsigned events in development
      event = JSON.parse(req.body.toString()) as Stripe.Event;
    } else {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Webhook] Signature verification failed:", message);
    return res.status(400).json({ error: `Webhook Error: ${message}` });
  }

  // ── Test event passthrough ─────────────────────────────────────────────────
  if (event.id.startsWith("evt_test_")) {
    console.log("[Webhook] Test event detected, returning verification response");
    return res.json({ verified: true });
  }

  console.log(`[Webhook] Received: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      // ── Checkout completed ───────────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const planId = session.metadata?.plan_id ?? "starter";
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (userId) {
          const db = await getDb();
          if (db) {
            await db.update(users)
              .set({
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscriptionId,
                subscriptionStatus: "active",
                planId,
              })
              .where(eq(users.id, parseInt(userId)));
          }
          // Notify owner
          await notifyOwner({
            title: `💳 New Subscription — ${session.metadata?.customer_name ?? "Unknown"}`,
            content: `**Plan:** ${planId}\n**Email:** ${session.metadata?.customer_email ?? "Unknown"}\n**Customer ID:** ${customerId}\n**Subscription ID:** ${subscriptionId}`,
          }).catch(() => {});
        }
        break;
      }

      // ── Subscription updated ─────────────────────────────────────────────
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const status = subscription.status;
        const db = await getDb();
        if (db) {
          await db.update(users)
            .set({
              subscriptionStatus: status,
              stripeSubscriptionId: subscription.id,
            })
            .where(eq(users.stripeCustomerId, customerId));
        }
        break;
      }

      // ── Subscription cancelled / deleted ─────────────────────────────────
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const db = await getDb();
        if (db) {
          await db.update(users)
            .set({
              subscriptionStatus: "cancelled",
              planId: "free",
              stripeSubscriptionId: null,
            })
            .where(eq(users.stripeCustomerId, customerId));
        }
        await notifyOwner({
          title: "❌ Subscription Cancelled",
          content: `Customer ${customerId} cancelled their subscription (${subscription.id}).`,
        }).catch(() => {});
        break;
      }

      // ── Invoice paid ─────────────────────────────────────────────────────
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const db = await getDb();
        if (db) {
          await db.update(users)
            .set({ subscriptionStatus: "active" })
            .where(eq(users.stripeCustomerId, customerId));
        }
        break;
      }

      // ── Invoice payment failed ────────────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const db = await getDb();
        if (db) {
          await db.update(users)
            .set({ subscriptionStatus: "past_due" })
            .where(eq(users.stripeCustomerId, customerId));
        }
        await notifyOwner({
          title: "⚠️ Payment Failed",
          content: `Customer ${customerId} failed to pay invoice ${invoice.id}.`,
        }).catch(() => {});
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("[Webhook] Error processing event:", err);
    return res.status(500).json({ error: "Internal webhook processing error" });
  }

  return res.json({ received: true });
}
