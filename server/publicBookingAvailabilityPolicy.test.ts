import { describe, expect, it } from "vitest";
import { getPublishedBookingServices, isPublishedPublicBookingSlot } from "../shared/publicBookingRules";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");

describe("public booking availability policy", () => {
  it("accepts only valid published weekday slots and rejects weekend, malformed, and unavailable times", () => {
    expect(isPublishedPublicBookingSlot("2026-08-26", "9:00 AM")).toBe(true);
    expect(isPublishedPublicBookingSlot("2026-08-29", "9:00 AM")).toBe(false);
    expect(isPublishedPublicBookingSlot("2026-08-26", "6:00 PM")).toBe(false);
    expect(isPublishedPublicBookingSlot("2026-02-30", "9:00 AM")).toBe(false);
  });

  it("uses safe configured services and falls back deterministically when stored settings are malformed", () => {
    expect(getPublishedBookingServices('["Consultation", "Strategy Call", "Consultation"]')).toEqual(["Consultation", "Strategy Call"]);
    expect(getPublishedBookingServices("not-json")).toContain("Consultation");
  });

  it("enforces the same published service and slot policies at the booking mutation", () => {
    const start = routerSource.indexOf("submit: publicProcedure", routerSource.indexOf("booking: router({"));
    const end = routerSource.indexOf("  }),\n\n  // ─── Client Pulse", start);
    const section = routerSource.slice(start, end);
    expect(section).toContain("const publishedServices = getPublishedBookingServices(host[0].bookingServices)");
    expect(section).toContain("if (!publishedServices.includes(input.service))");
    expect(section).toContain("if (!isPublishedPublicBookingSlot(input.preferredDate, input.preferredTime))");
  });
});
