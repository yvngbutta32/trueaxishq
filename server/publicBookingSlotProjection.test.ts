import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");
const bookingPageSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/BookingPage.tsx"), "utf8");

describe("privacy-safe public occupied booking slots", () => {
  it("returns only bounded future date/time/duration triples from the public booking-page query", () => {
    const start = routerSource.indexOf("getPage: publicProcedure", routerSource.indexOf("booking: router({"));
    const end = routerSource.indexOf("submit: publicProcedure", start);
    const section = routerSource.slice(start, end);
    // duration is required so the client can apply the same interval-overlap
    // rule the server enforces on submit (exact-slot checks left overlapping
    // slots bookable, which submit then rejected with 409).
    expect(section).toContain("const bookedSlots = await db.select({ date: bookings.date, time: bookings.time, duration: bookings.duration })");
    // Must mirror the submit conflict query: NOT IN cancelled/no_show.
    expect(section).toContain("NOT IN ('cancelled', 'no_show')");
    expect(section).toContain("publicWindowEnd");
    expect(section).toContain("bookedSlots,");
    // Privacy: no client identity or service details leave the server.
    expect(section).not.toContain("clientId: bookings.clientId");
    expect(section).not.toContain("service: bookings.service");
  });

  it("disables occupied visible times using the shared overlap rule, not exact time matches", () => {
    expect(bookingPageSource).toContain("doPublicBookingIntervalsOverlap");
    expect(bookingPageSource).toContain("const slotOccupied = (isoDate: string, time: string)");
    expect(bookingPageSource).toContain("disabled={isOccupied}");
    expect(bookingPageSource).toContain("is unavailable");
  });

  it("disables a date when every time published for that date is occupied", () => {
    expect(bookingPageSource).toContain("const isFullyOccupied = publishedSchedule.timeSlots.every");
    expect(bookingPageSource).toContain("disabled={isFullyOccupied}");
    expect(bookingPageSource).toContain("is fully booked");
  });
});
