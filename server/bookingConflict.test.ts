import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("owner booking conflict protection", () => {
  it("checks duration-aware intervals before creating a booking", () => {
    const source = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const section = source.slice(source.indexOf("  bookings: router({"), source.indexOf("  // ── Follow-Up Emails"));
    expect(section).toContain("doPublicBookingIntervalsOverlap(");
    expect(section).toContain("input.duration + bookingBufferMinutes");
    expect(section).toContain("bookingBufferMinutes");
    expect(section).toContain("getPublishedBookingSchedule(ownerSettings?.bookingAvailability)");
    expect(section).toContain('eq(bookings.status, "scheduled")');
    expect(section).toContain("overlaps an existing appointment");
    expect(section).toContain("Restoring this booking would overlap");
    expect(source).toContain("isDuplicateBookingSlotError");
    expect(source).toContain("ER_DUP_ENTRY");
    expect(section).toContain("was just taken");
  });
});
