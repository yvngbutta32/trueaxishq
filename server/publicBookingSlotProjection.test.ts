import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");
const bookingPageSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/BookingPage.tsx"), "utf8");

describe("privacy-safe public occupied booking slots", () => {
  it("returns only bounded future scheduled date/time pairs from the public booking-page query", () => {
    const start = routerSource.indexOf("getPage: publicProcedure", routerSource.indexOf("booking: router({"));
    const end = routerSource.indexOf("submit: publicProcedure", start);
    const section = routerSource.slice(start, end);
    expect(section).toContain("const bookedSlots = await db.select({ date: bookings.date, time: bookings.time })");
    expect(section).toContain('eq(bookings.status, "scheduled")');
    expect(section).toContain("publicWindowEnd");
    expect(section).toContain("bookedSlots,");
    expect(section).not.toContain("clientId: bookings.clientId");
    expect(section).not.toContain("service: bookings.service");
  });

  it("disables an occupied visible time without weakening server-side conflict protection", () => {
    expect(bookingPageSource).toContain("const isOccupied = host.bookedSlots?.some");
    expect(bookingPageSource).toContain("disabled={isOccupied}");
    expect(bookingPageSource).toContain("is unavailable");
  });

  it("disables a date when every time published for that date is occupied", () => {
    expect(bookingPageSource).toContain("const isFullyOccupied = publishedSchedule.timeSlots.every");
    expect(bookingPageSource).toContain("disabled={isFullyOccupied}");
    expect(bookingPageSource).toContain("is fully booked");
  });
});
