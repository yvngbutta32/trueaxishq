import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("owner booking conflict protection", () => {
  it("checks duration-aware intervals before creating a booking", () => {
    const source = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const section = source.slice(source.indexOf("  bookings: router({"), source.indexOf("  // ── Follow-Up Emails"));
    expect(section).toContain("doPublicBookingIntervalsOverlap(input.time, input.duration");
    expect(section).toContain('eq(bookings.status, "scheduled")');
    expect(section).toContain("overlaps an existing appointment");
  });
});
