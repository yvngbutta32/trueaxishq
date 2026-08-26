import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");

describe("public booking one-time token consumption", () => {
  it("consumes a valid unused reschedule token before the booking update", () => {
    const start = routerSource.indexOf("reschedule: publicProcedure");
    const end = routerSource.indexOf("cancel: publicProcedure", start);
    const section = routerSource.slice(start, end);
    expect(section).toContain("const tokenConsume = await tx.update(bookingCancelTokens).set({ used: true })");
    expect(section).toContain("eq(bookingCancelTokens.action, \"reschedule\")");
    expect(section).toContain("gt(bookingCancelTokens.expiresAt, new Date())");
    expect(section).toContain("if (!tokenConsume[0].affectedRows)");
    expect(section.indexOf("const tokenConsume")).toBeLessThan(section.indexOf("const bookingUpdate"));
    expect(section).toContain('eq(bookings.status, "scheduled")');
    expect(section).toContain("eq(bookings.date, booking.date)");
    expect(section).toContain("eq(bookings.time, booking.time)");
  });

  it("consumes a valid unused cancel token before changing the booking status", () => {
    const start = routerSource.indexOf("cancel: publicProcedure");
    const end = routerSource.indexOf("// ── Monthly Report Settings", start);
    const section = routerSource.slice(start, end);
    expect(section).toContain("eq(bookingCancelTokens.action, \"cancel\")");
    expect(section).toContain("if (!tokenConsume[0].affectedRows)");
    expect(section.indexOf("const tokenConsume")).toBeLessThan(section.indexOf("const bookingUpdate"));
  });
});
