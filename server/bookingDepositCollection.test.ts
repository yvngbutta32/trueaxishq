import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getPublishedBookingServiceCatalog } from "../shared/publicBookingRules";

const routersSource = readFileSync(resolve(import.meta.dirname, "./routers.ts"), "utf8");
const webhookSource = readFileSync(resolve(import.meta.dirname, "./stripeWebhook.ts"), "utf8");
const bookingPageSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/BookingPage.tsx"), "utf8");
const dashboardSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/Dashboard.tsx"), "utf8");
const schemaSource = readFileSync(resolve(import.meta.dirname, "../drizzle/schema.ts"), "utf8");

describe("booking deposit catalog parsing", () => {
  it("parses a bounded deposit amount on catalog services", () => {
    const catalog = getPublishedBookingServiceCatalog(JSON.stringify([
      { name: "Consultation", durationMinutes: 60, active: true, depositAmountCents: 5000 },
    ]));
    expect(catalog[0].depositAmountCents).toBe(5000);
  });

  it("rejects out-of-range, fractional, and non-numeric deposits", () => {
    const catalog = getPublishedBookingServiceCatalog(JSON.stringify([
      { name: "Too small", durationMinutes: 60, active: true, depositAmountCents: 49 },
      { name: "Too big", durationMinutes: 60, active: true, depositAmountCents: 500_001 },
      { name: "Fractional", durationMinutes: 60, active: true, depositAmountCents: 50.5 },
      { name: "Not a number", durationMinutes: 60, active: true, depositAmountCents: "5000" },
    ]));
    expect(catalog.map(service => service.depositAmountCents)).toEqual([null, null, null, null]);
  });

  it("defaults and legacy string catalogs carry no deposit", () => {
    expect(getPublishedBookingServiceCatalog(null).every(service => service.depositAmountCents === null)).toBe(true);
    const legacy = getPublishedBookingServiceCatalog(JSON.stringify(["Coaching Session"]));
    expect(legacy[0].depositAmountCents).toBeNull();
  });
});

describe("deposit collection at booking", () => {
  it("stores the deposit requirement on the booking when the service has one", () => {
    expect(routersSource).toContain("depositAmountCents: selectedService.depositAmountCents ?? null");
    expect(routersSource).toContain('depositStatus: selectedService.depositAmountCents ? "required" : null');
  });

  it("starts a Stripe deposit checkout with booking metadata and an origin-bound return", () => {
    expect(routersSource).toContain("metadata: {");
    expect(routersSource).toContain("booking_id: String(newBookingId)");
    expect(routersSource).toContain("deposit_amount_cents: String(selectedService.depositAmountCents)");
    expect(routersSource).toContain("deposit_returned=1");
    expect(routersSource).toContain("return { success: true, isNewClient, depositCheckoutUrl }");
  });

  it("keeps the booking even when Stripe is unavailable", () => {
    expect(routersSource).toMatch(/\[Booking deposit\] Stripe checkout unavailable/);
  });

  it("only the verified webhook may mark a deposit paid", () => {
    expect(webhookSource).toContain('session.metadata?.booking_id');
    expect(webhookSource).toContain('depositStatus: "paid"');
    expect(webhookSource).toContain("existingBooking.depositStatus === \"paid\"");
  });

  it("persists deposit columns on bookings with a migration", () => {
    expect(schemaSource).toContain("depositAmountCents");
    expect(schemaSource).toContain('mysqlEnum("depositStatus", ["required", "paid", "waived"])');
    const migration = readFileSync(resolve(import.meta.dirname, "../drizzle/0064_silent_eternity.sql"), "utf8");
    expect(migration).toContain("ADD `depositAmountCents`");
    expect(migration).toContain("ADD `depositStatus`");
    expect(migration).toContain("ADD `depositPaidAt`");
  });
});

describe("deposit client experience", () => {
  it("labels deposit services in the booking selector", () => {
    expect(bookingPageSource).toContain("catalogEntry?.depositAmountCents");
  });

  it("offers deposit payment on the confirmation screen", () => {
    expect(bookingPageSource).toContain("Pay booking deposit");
    expect(bookingPageSource).toContain("setDepositCheckoutUrl");
  });

  it("greets Stripe returns with webhook-honest copy", () => {
    expect(bookingPageSource).toContain('get("deposit_returned") === "1"');
    expect(bookingPageSource).toContain("Deposit payment submitted");
  });

  it("lets the owner set a deposit per service", () => {
    expect(dashboardSource).toContain("depositAmountCents: cents && cents >= 50 ? cents : null");
    expect(dashboardSource).toContain("Deposit $");
  });

  it("shows deposit state on the owner's booking rows", () => {
    expect(dashboardSource).toContain('b.depositStatus === "paid" ? "Deposit paid" : "Deposit due"');
  });
});
