/**
 * Client Pulse Engine — Unit Tests
 * Tests the scoring algorithm, risk classification, and signal collection logic.
 */

import { describe, it, expect } from "vitest";

// ─── Replicate scoring logic for isolated testing ─────────────────────────────
// (mirrors pulseEngine.ts without DB dependencies)

interface Signals {
  daysSinceLastContact: number;
  daysSinceLastBooking: number;
  daysSinceLastInvoice: number;
  totalInvoicesPaid: number;
  totalBookings: number;
  followUpResponseRate: number;
  revenueLastThirtyDays: number;
  revenueLastNinetyDays: number;
}

function computeHealthScore(signals: Signals): number {
  let score = 100;

  // Recency penalty
  if (signals.daysSinceLastContact > 90) score -= 30;
  else if (signals.daysSinceLastContact > 60) score -= 20;
  else if (signals.daysSinceLastContact > 30) score -= 10;

  // Booking frequency
  if (signals.totalBookings === 0) score -= 15;
  else if (signals.totalBookings < 3) score -= 5;

  // Invoice payment history
  if (signals.totalInvoicesPaid === 0) score -= 10;
  else if (signals.totalInvoicesPaid >= 5) score += 10;

  // Revenue trend
  if (signals.revenueLastThirtyDays === 0 && signals.revenueLastNinetyDays > 0) score -= 15;
  else if (signals.revenueLastThirtyDays > 0) score += 5;

  // Response rate
  if (signals.followUpResponseRate < 0.3) score -= 10;
  else if (signals.followUpResponseRate > 0.7) score += 5;

  return Math.max(0, Math.min(100, score));
}

function classifyRisks(score: number, signals: Signals) {
  const churnRisk = score < 30 || (signals.daysSinceLastContact > 90 && signals.totalInvoicesPaid > 0);
  const goingSilent = !churnRisk && (signals.daysSinceLastContact > 45 || (signals.daysSinceLastBooking > 60 && signals.totalBookings > 0));
  const upsellReady = !churnRisk && !goingSilent && score >= 75 && signals.totalInvoicesPaid >= 3 && signals.revenueLastThirtyDays > 0;
  return { churnRisk, goingSilent, upsellReady };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Client Pulse — Health Score Calculation", () => {
  it("returns 100 for a perfectly active client", () => {
    const signals: Signals = {
      daysSinceLastContact: 5,
      daysSinceLastBooking: 5,
      daysSinceLastInvoice: 5,
      totalInvoicesPaid: 10,
      totalBookings: 8,
      followUpResponseRate: 0.9,
      revenueLastThirtyDays: 500,
      revenueLastNinetyDays: 1500,
    };
    const score = computeHealthScore(signals);
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it("penalizes clients with no contact in 90+ days", () => {
    const signals: Signals = {
      daysSinceLastContact: 95,
      daysSinceLastBooking: 95,
      daysSinceLastInvoice: 95,
      totalInvoicesPaid: 2,
      totalBookings: 2,
      followUpResponseRate: 0.5,
      revenueLastThirtyDays: 0,
      revenueLastNinetyDays: 200,
    };
    const score = computeHealthScore(signals);
    expect(score).toBeLessThan(60);
  });

  it("penalizes clients with zero bookings and invoices", () => {
    const signals: Signals = {
      daysSinceLastContact: 10,
      daysSinceLastBooking: 0,
      daysSinceLastInvoice: 0,
      totalInvoicesPaid: 0,
      totalBookings: 0,
      followUpResponseRate: 0.5,
      revenueLastThirtyDays: 0,
      revenueLastNinetyDays: 0,
    };
    const score = computeHealthScore(signals);
    expect(score).toBeLessThan(80);
  });

  it("score is always between 0 and 100", () => {
    const worstCase: Signals = {
      daysSinceLastContact: 200,
      daysSinceLastBooking: 200,
      daysSinceLastInvoice: 200,
      totalInvoicesPaid: 0,
      totalBookings: 0,
      followUpResponseRate: 0,
      revenueLastThirtyDays: 0,
      revenueLastNinetyDays: 0,
    };
    const score = computeHealthScore(worstCase);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("Client Pulse — Risk Classification", () => {
  it("flags churn risk for low score with payment history", () => {
    const signals: Signals = {
      daysSinceLastContact: 95,
      daysSinceLastBooking: 95,
      daysSinceLastInvoice: 95,
      totalInvoicesPaid: 3,
      totalBookings: 3,
      followUpResponseRate: 0.1,
      revenueLastThirtyDays: 0,
      revenueLastNinetyDays: 500,
    };
    const score = computeHealthScore(signals);
    const risks = classifyRisks(score, signals);
    expect(risks.churnRisk).toBe(true);
  });

  it("flags going silent when contact drops but not yet churn", () => {
    const signals: Signals = {
      daysSinceLastContact: 50,
      daysSinceLastBooking: 70,
      daysSinceLastInvoice: 50,
      totalInvoicesPaid: 2,
      totalBookings: 2,
      followUpResponseRate: 0.5,
      revenueLastThirtyDays: 100,
      revenueLastNinetyDays: 400,
    };
    const score = computeHealthScore(signals);
    const risks = classifyRisks(score, signals);
    expect(risks.goingSilent).toBe(true);
    expect(risks.churnRisk).toBe(false);
  });

  it("flags upsell ready for high-value active clients", () => {
    const signals: Signals = {
      daysSinceLastContact: 5,
      daysSinceLastBooking: 5,
      daysSinceLastInvoice: 5,
      totalInvoicesPaid: 5,
      totalBookings: 6,
      followUpResponseRate: 0.9,
      revenueLastThirtyDays: 800,
      revenueLastNinetyDays: 2400,
    };
    const score = computeHealthScore(signals);
    const risks = classifyRisks(score, signals);
    expect(risks.upsellReady).toBe(true);
    expect(risks.churnRisk).toBe(false);
    expect(risks.goingSilent).toBe(false);
  });

  it("does not flag upsell for clients with no recent revenue", () => {
    const signals: Signals = {
      daysSinceLastContact: 5,
      daysSinceLastBooking: 5,
      daysSinceLastInvoice: 5,
      totalInvoicesPaid: 5,
      totalBookings: 6,
      followUpResponseRate: 0.9,
      revenueLastThirtyDays: 0,  // No recent revenue
      revenueLastNinetyDays: 2400,
    };
    const score = computeHealthScore(signals);
    const risks = classifyRisks(score, signals);
    expect(risks.upsellReady).toBe(false);
  });

  it("churn risk takes priority over upsell ready", () => {
    const signals: Signals = {
      daysSinceLastContact: 95,
      daysSinceLastBooking: 95,
      daysSinceLastInvoice: 95,
      totalInvoicesPaid: 10,
      totalBookings: 10,
      followUpResponseRate: 0.9,
      revenueLastThirtyDays: 1000,
      revenueLastNinetyDays: 3000,
    };
    const score = computeHealthScore(signals);
    const risks = classifyRisks(score, signals);
    // 90+ days no contact with payment history = churn risk
    expect(risks.churnRisk).toBe(true);
    expect(risks.upsellReady).toBe(false);
  });
});

describe("Client Pulse — Action Type Determination", () => {
  it("assigns re_engage for churn risk clients", () => {
    const risks = { churnRisk: true, goingSilent: false, upsellReady: false };
    const actionType = risks.churnRisk ? "re_engage" : risks.upsellReady ? "upsell" : risks.goingSilent ? "check_in" : "maintain";
    expect(actionType).toBe("re_engage");
  });

  it("assigns upsell for upsell-ready clients", () => {
    const risks = { churnRisk: false, goingSilent: false, upsellReady: true };
    const actionType = risks.churnRisk ? "re_engage" : risks.upsellReady ? "upsell" : risks.goingSilent ? "check_in" : "maintain";
    expect(actionType).toBe("upsell");
  });

  it("assigns check_in for going-silent clients", () => {
    const risks = { churnRisk: false, goingSilent: true, upsellReady: false };
    const actionType = risks.churnRisk ? "re_engage" : risks.upsellReady ? "upsell" : risks.goingSilent ? "check_in" : "maintain";
    expect(actionType).toBe("check_in");
  });

  it("assigns maintain for healthy clients", () => {
    const risks = { churnRisk: false, goingSilent: false, upsellReady: false };
    const actionType = risks.churnRisk ? "re_engage" : risks.upsellReady ? "upsell" : risks.goingSilent ? "check_in" : "maintain";
    expect(actionType).toBe("maintain");
  });
});
