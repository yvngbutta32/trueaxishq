/**
 * Client Pulse Engine — AI Relationship Intelligence
 *
 * Computes a 0-100 health score for each client based on:
 *   - Days since last contact / booking / invoice
 *   - Invoice payment history and frequency
 *   - Revenue trajectory (30d vs 90d)
 *   - Follow-up engagement
 *
 * Then classifies the client into one of four states:
 *   - HEALTHY    (score 75-100): relationship is strong
 *   - MAINTAIN   (score 50-74): stable but could be nurtured
 *   - GOING_SILENT (score 25-49): engagement is dropping
 *   - CHURN_RISK  (score 0-24): urgent intervention needed
 *
 * Separately flags UPSELL_READY when a healthy client shows
 * high payment reliability and increasing booking frequency.
 */

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { bookings, clientPulse, clients, followUps, invoices } from "../drizzle/schema";
import { withTimeout } from "./utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PulseSignals {
  daysSinceLastContact: number;
  daysSinceLastBooking: number;
  daysSinceLastInvoice: number;
  totalInvoicesPaid: number;
  totalBookings: number;
  revenueLastThirtyDays: number;
  revenueLastNinetyDays: number;
  followUpResponseRate: number;
  clientCreatedDaysAgo: number;
}

export interface PulseResult {
  healthScore: number;
  churnRisk: boolean;
  upsellReady: boolean;
  goingSilent: boolean;
  signals: PulseSignals;
  aiInsight: string;
  aiAction: string;
  aiActionType: "re_engage" | "upsell" | "check_in" | "maintain";
}

// ─── Signal Collection ────────────────────────────────────────────────────────

export async function collectSignals(
  userId: number,
  clientId: number
): Promise<PulseSignals> {
  const db = await getDb();
  if (!db) {
    return {
      daysSinceLastContact: 999,
      daysSinceLastBooking: 999,
      daysSinceLastInvoice: 999,
      totalInvoicesPaid: 0,
      totalBookings: 0,
      revenueLastThirtyDays: 0,
      revenueLastNinetyDays: 0,
      followUpResponseRate: 0,
      clientCreatedDaysAgo: 0,
    };
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Get client record for createdAt and lastContactedAt
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
    .limit(1);

  if (!client) {
    return {
      daysSinceLastContact: 999,
      daysSinceLastBooking: 999,
      daysSinceLastInvoice: 999,
      totalInvoicesPaid: 0,
      totalBookings: 0,
      revenueLastThirtyDays: 0,
      revenueLastNinetyDays: 0,
      followUpResponseRate: 0,
      clientCreatedDaysAgo: 0,
    };
  }

  const clientCreatedDaysAgo = Math.floor(
    (now.getTime() - client.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Days since last contact
  const daysSinceLastContact = client.lastContactedAt
    ? Math.floor(
        (now.getTime() - client.lastContactedAt.getTime()) / (1000 * 60 * 60 * 24)
      )
    : clientCreatedDaysAgo;

  // Most recent booking
  const [lastBooking] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.userId, userId), eq(bookings.clientId, clientId)))
    .orderBy(desc(bookings.createdAt))
    .limit(1);

  const daysSinceLastBooking = lastBooking
    ? Math.floor(
        (now.getTime() - lastBooking.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      )
    : clientCreatedDaysAgo;

  // Total bookings
  const [bookingCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(bookings)
    .where(and(eq(bookings.userId, userId), eq(bookings.clientId, clientId)));
  const totalBookings = Number(bookingCount?.count ?? 0);

  // Most recent invoice
  const [lastInvoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.userId, userId), eq(invoices.clientId, clientId)))
    .orderBy(desc(invoices.createdAt))
    .limit(1);

  const daysSinceLastInvoice = lastInvoice
    ? Math.floor(
        (now.getTime() - lastInvoice.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      )
    : clientCreatedDaysAgo;

  // Total paid invoices
  const [paidCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(invoices)
    .where(
      and(
        eq(invoices.userId, userId),
        eq(invoices.clientId, clientId),
        eq(invoices.status, "paid")
      )
    );
  const totalInvoicesPaid = Number(paidCount?.count ?? 0);

  // Revenue last 30 days
  const [rev30] = await db
    .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
    .from(invoices)
    .where(
      and(
        eq(invoices.userId, userId),
        eq(invoices.clientId, clientId),
        eq(invoices.status, "paid"),
        gte(invoices.paidAt, thirtyDaysAgo)
      )
    );
  const revenueLastThirtyDays = parseFloat(rev30?.total ?? "0");

  // Revenue last 90 days
  const [rev90] = await db
    .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
    .from(invoices)
    .where(
      and(
        eq(invoices.userId, userId),
        eq(invoices.clientId, clientId),
        eq(invoices.status, "paid"),
        gte(invoices.paidAt, ninetyDaysAgo)
      )
    );
  const revenueLastNinetyDays = parseFloat(rev90?.total ?? "0");

  // Follow-up response rate (sent vs total for this client)
  const [fuTotal] = await db
    .select({ count: sql<number>`count(*)` })
    .from(followUps)
    .where(and(eq(followUps.userId, userId), eq(followUps.clientId, clientId)));
  const [fuSent] = await db
    .select({ count: sql<number>`count(*)` })
    .from(followUps)
    .where(
      and(
        eq(followUps.userId, userId),
        eq(followUps.clientId, clientId),
        eq(followUps.status, "sent")
      )
    );
  const totalFu = Number(fuTotal?.count ?? 0);
  const sentFu = Number(fuSent?.count ?? 0);
  const followUpResponseRate = totalFu > 0 ? (sentFu / totalFu) * 100 : 0;

  return {
    daysSinceLastContact,
    daysSinceLastBooking,
    daysSinceLastInvoice,
    totalInvoicesPaid,
    totalBookings,
    revenueLastThirtyDays,
    revenueLastNinetyDays,
    followUpResponseRate,
    clientCreatedDaysAgo,
  };
}

// ─── Scoring Algorithm ────────────────────────────────────────────────────────

export function computeHealthScore(signals: PulseSignals): number {
  let score = 100;

  // Penalize for days since last contact (max -40 points)
  if (signals.daysSinceLastContact > 90) score -= 40;
  else if (signals.daysSinceLastContact > 60) score -= 30;
  else if (signals.daysSinceLastContact > 30) score -= 20;
  else if (signals.daysSinceLastContact > 14) score -= 10;
  else if (signals.daysSinceLastContact > 7) score -= 5;

  // Penalize for no bookings (max -25 points)
  if (signals.totalBookings === 0 && signals.clientCreatedDaysAgo > 14) score -= 20;
  else if (signals.daysSinceLastBooking > 90) score -= 25;
  else if (signals.daysSinceLastBooking > 60) score -= 18;
  else if (signals.daysSinceLastBooking > 30) score -= 10;
  else if (signals.daysSinceLastBooking > 14) score -= 5;

  // Penalize for no invoices (max -20 points)
  if (signals.totalInvoicesPaid === 0 && signals.clientCreatedDaysAgo > 30) score -= 15;
  else if (signals.daysSinceLastInvoice > 90) score -= 20;
  else if (signals.daysSinceLastInvoice > 60) score -= 12;
  else if (signals.daysSinceLastInvoice > 30) score -= 6;

  // Reward for revenue momentum (max +15 points)
  if (signals.revenueLastThirtyDays > 0 && signals.revenueLastNinetyDays > 0) {
    const monthlyAvg = signals.revenueLastNinetyDays / 3;
    if (signals.revenueLastThirtyDays > monthlyAvg * 1.2) score += 15; // growing
    else if (signals.revenueLastThirtyDays > monthlyAvg * 0.8) score += 8; // stable
    else score -= 10; // declining
  }

  // Reward for paid invoices (max +10 points)
  if (signals.totalInvoicesPaid >= 5) score += 10;
  else if (signals.totalInvoicesPaid >= 3) score += 6;
  else if (signals.totalInvoicesPaid >= 1) score += 3;

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Risk Classification ──────────────────────────────────────────────────────

export function classifyRisks(
  score: number,
  signals: PulseSignals
): { churnRisk: boolean; upsellReady: boolean; goingSilent: boolean } {
  const churnRisk =
    score < 30 ||
    (signals.daysSinceLastContact > 60 && signals.totalInvoicesPaid > 0);

  const goingSilent =
    !churnRisk &&
    (score < 55 ||
      (signals.daysSinceLastContact > 30 && signals.daysSinceLastBooking > 30));

  const upsellReady =
    !churnRisk &&
    !goingSilent &&
    score >= 70 &&
    signals.totalInvoicesPaid >= 3 &&
    signals.daysSinceLastContact <= 30;

  return { churnRisk, upsellReady, goingSilent };
}

// ─── AI Insight Generation ────────────────────────────────────────────────────

export async function generatePulseInsight(
  clientName: string,
  score: number,
  signals: PulseSignals,
  risks: { churnRisk: boolean; upsellReady: boolean; goingSilent: boolean }
): Promise<{ insight: string; action: string; actionType: "re_engage" | "upsell" | "check_in" | "maintain" }> {
  const actionType: "re_engage" | "upsell" | "check_in" | "maintain" = risks.churnRisk
    ? "re_engage"
    : risks.upsellReady
    ? "upsell"
    : risks.goingSilent
    ? "check_in"
    : "maintain";

  const fallbacks = {
    re_engage: {
      insight: `${clientName}'s relationship health is critical. They haven't engaged in ${signals.daysSinceLastContact} days and revenue has dropped significantly.`,
      action: `Hi ${clientName}, I wanted to reach out personally — it's been a while since we last connected. I'd love to catch up and see how things are going. Would you be open to a quick 15-minute call this week?`,
    },
    upsell: {
      insight: `${clientName} is your strongest client right now. They've paid ${signals.totalInvoicesPaid} invoices on time and are actively engaged.`,
      action: `Hi ${clientName}, I've really enjoyed working with you and I wanted to share something exciting — I'm now offering a monthly retainer package that gives you priority access and a dedicated block of my time each month. Based on our work together, I think it could be a great fit. Want to hear more?`,
    },
    check_in: {
      insight: `${clientName}'s engagement has been slowing down over the past ${signals.daysSinceLastContact} days. A proactive check-in now could prevent them from going cold.`,
      action: `Hi ${clientName}, just checking in to see how everything is going on your end. I've been thinking about our last project and had a few ideas that might be helpful for you. Would love to reconnect when you have a moment!`,
    },
    maintain: {
      insight: `${clientName} has a healthy relationship score of ${score}/100. Keep up the regular touchpoints to maintain this momentum.`,
      action: `Hi ${clientName}, hope you're doing well! I wanted to share a quick update on some new services I've been offering that might be relevant to your goals. Let me know if you'd like to chat!`,
    },
  };

  try {
    const prompt = `You are a relationship intelligence assistant for a freelancer. Analyze this client relationship and provide:
1. A 1-2 sentence insight about the relationship status
2. A personalized, warm outreach message the freelancer can send

Client: ${clientName}
Health Score: ${score}/100
Days since last contact: ${signals.daysSinceLastContact}
Days since last booking: ${signals.daysSinceLastBooking}
Total paid invoices: ${signals.totalInvoicesPaid}
Total bookings: ${signals.totalBookings}
Revenue last 30 days: $${signals.revenueLastThirtyDays.toFixed(2)}
Revenue last 90 days: $${signals.revenueLastNinetyDays.toFixed(2)}
Status: ${actionType === "re_engage" ? "CHURN RISK - needs urgent re-engagement" : actionType === "upsell" ? "UPSELL READY - strong relationship, good time to pitch retainer" : actionType === "check_in" ? "GOING SILENT - engagement dropping, proactive check-in needed" : "HEALTHY - maintain relationship"}

Respond in JSON format:
{
  "insight": "1-2 sentence relationship insight",
  "action": "personalized outreach message (2-3 sentences, warm and professional)"
}`;

    const response = await withTimeout(
      invokeLLM({
        messages: [
          { role: "system", content: "You are a freelancer relationship intelligence assistant. Always respond with valid JSON." },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "pulse_insight",
            strict: true,
            schema: {
              type: "object",
              properties: {
                insight: { type: "string" },
                action: { type: "string" },
              },
              required: ["insight", "action"],
              additionalProperties: false,
            },
          },
        },
      }),
      25000
    );

    const rawContent = response.choices?.[0]?.message?.content;
    const content = typeof rawContent === 'string' ? rawContent : null;
    if (content) {
      const parsed = JSON.parse(content);
      return {
        insight: parsed.insight || fallbacks[actionType].insight,
        action: parsed.action || fallbacks[actionType].action,
        actionType,
      };
    }
  } catch {
    // Fall through to fallback
  }

  return {
    insight: fallbacks[actionType].insight,
    action: fallbacks[actionType].action,
    actionType,
  };
}

// ─── Main Compute Function ────────────────────────────────────────────────────

export async function computeClientPulse(
  userId: number,
  clientId: number,
  clientName: string
): Promise<PulseResult | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    const signals = await collectSignals(userId, clientId);
    const healthScore = computeHealthScore(signals);
    const risks = classifyRisks(healthScore, signals);
    const { insight, action, actionType } = await generatePulseInsight(
      clientName,
      healthScore,
      signals,
      risks
    );

    // Upsert into clientPulse table
    const existing = await db
      .select()
      .from(clientPulse)
      .where(and(eq(clientPulse.userId, userId), eq(clientPulse.clientId, clientId)))
      .limit(1);

    const pulseData = {
      userId,
      clientId,
      healthScore,
      churnRisk: risks.churnRisk,
      upsellReady: risks.upsellReady,
      goingSilent: risks.goingSilent,
      daysSinceLastContact: signals.daysSinceLastContact,
      daysSinceLastBooking: signals.daysSinceLastBooking,
      daysSinceLastInvoice: signals.daysSinceLastInvoice,
      totalInvoicesPaid: signals.totalInvoicesPaid,
      totalBookings: signals.totalBookings,
      followUpResponseRate: signals.followUpResponseRate.toFixed(2),
      revenueLastThirtyDays: signals.revenueLastThirtyDays.toFixed(2),
      revenueLastNinetyDays: signals.revenueLastNinetyDays.toFixed(2),
      aiInsight: insight,
      aiAction: action,
      aiActionType: actionType,
      lastComputedAt: new Date(),
    };

    if (existing.length > 0) {
      await db
        .update(clientPulse)
        .set(pulseData)
        .where(and(eq(clientPulse.userId, userId), eq(clientPulse.clientId, clientId)));
    } else {
      await db.insert(clientPulse).values(pulseData);
    }

    return {
      healthScore,
      churnRisk: risks.churnRisk,
      upsellReady: risks.upsellReady,
      goingSilent: risks.goingSilent,
      signals,
      aiInsight: insight,
      aiAction: action,
      aiActionType: actionType,
    };
  } catch (err) {
    console.error("[PulseEngine] Error computing pulse for client", clientId, err);
    return null;
  }
}

// ─── Batch Compute (all clients for a user) ───────────────────────────────────

export async function computeAllClientPulses(userId: number): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const userClients = await db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(and(eq(clients.userId, userId), eq(clients.status, "active")));

    // Process sequentially to avoid overwhelming the LLM
    for (const client of userClients) {
      await computeClientPulse(userId, client.id, client.name ?? "Client");
      // Small delay between LLM calls
      await new Promise((r) => setTimeout(r, 300));
    }
  } catch (err) {
    console.error("[PulseEngine] Batch compute error for user", userId, err);
  }
}
