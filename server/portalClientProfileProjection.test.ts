import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");

describe("portal client profile projection", () => {
  it("returns only the client-safe fields consumed by the token-scoped portal", () => {
    const portalStart = routerSource.indexOf("view: publicProcedure");
    const payStart = routerSource.indexOf("payInvoice: publicProcedure", portalStart);
    const section = routerSource.slice(portalStart, payStart);
    expect(section).toContain("const [client] = await db.select({");
    expect(section).toContain("name: clients.name");
    expect(section).toContain("email: clients.email");
    expect(section).toContain("phone: clients.phone");
    expect(section).toContain("service: clients.service");
    expect(section).not.toContain("notes: clients.notes");
    expect(section).not.toContain("totalRevenue: clients.totalRevenue");
    expect(section).not.toContain("defaultRate: clients.defaultRate");
    expect(section).not.toContain("pipelineStage: clients.pipelineStage");
  });

  it("returns only client-safe invoice fields from the portal view", () => {
    const portalStart = routerSource.indexOf("view: publicProcedure");
    const payStart = routerSource.indexOf("payInvoice: publicProcedure", portalStart);
    const section = routerSource.slice(portalStart, payStart);
    expect(section).toContain("const clientInvoices = await db.select({");
    expect(section).toContain("invoiceNumber: invoices.invoiceNumber");
    expect(section).toContain("amount: invoices.amount");
    expect(section).toContain("paidAt: invoices.paidAt");
    expect(section).not.toContain("notes: invoices.notes");
    expect(section).not.toContain("payLinkToken: invoices.payLinkToken");
    expect(section).not.toContain("stripePaymentLinkUrl: invoices.stripePaymentLinkUrl");
    expect(section).not.toContain("lineItems: invoices.lineItems");
  });

  it("returns only client-safe appointment fields from portal view and availability responses", () => {
    const portalStart = routerSource.indexOf("view: publicProcedure");
    const payStart = routerSource.indexOf("payInvoice: publicProcedure", portalStart);
    const viewSection = routerSource.slice(portalStart, payStart);
    expect(viewSection).toContain("const clientBookings = await db.select({");
    expect(viewSection).toContain("service: bookings.service");
    expect(viewSection).toContain("duration: bookings.duration");
    expect(viewSection).not.toContain("notes: bookings.notes");
    expect(viewSection).not.toContain("clientEmail: bookings.clientEmail");
    expect(viewSection).not.toContain("slotKey: bookings.slotKey");

    const availabilityStart = routerSource.indexOf("getBookingAvailability: publicProcedure");
    const rescheduleStart = routerSource.indexOf("rescheduleBooking: publicProcedure", availabilityStart);
    const availabilitySection = routerSource.slice(availabilityStart, rescheduleStart);
    expect(availabilitySection).toContain("await db.select({ id: bookings.id, date: bookings.date, time: bookings.time })");
    expect(availabilitySection).not.toContain("await db.select().from(bookings)");
  });
});
