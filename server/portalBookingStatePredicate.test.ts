import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");

describe("client portal booking mutation state predicates", () => {
  it("reschedules only the unchanged booking state before emitting side effects", () => {
    const start = routerSource.indexOf("rescheduleBooking: publicProcedure");
    const end = routerSource.indexOf("cancelBooking: publicProcedure", start);
    const section = routerSource.slice(start, end);
    expect(section).toContain("const rescheduleResult = await db.update(bookings)");
    expect(section).toContain("eq(bookings.date, booking.date)");
    expect(section).toContain("eq(bookings.time, booking.time)");
    expect(section).toContain("if (!rescheduleResult[0].affectedRows)");
    expect(section.indexOf("if (!rescheduleResult[0].affectedRows)")).toBeLessThan(section.indexOf("Booking Rescheduled"));
  });

  it("cancels only the unchanged booking state before emitting side effects", () => {
    const start = routerSource.indexOf("cancelBooking: publicProcedure");
    const end = routerSource.indexOf("getPhotos: publicProcedure", start);
    const section = routerSource.slice(start, end);
    expect(section).toContain("const cancelResult = await db.update(bookings)");
    expect(section).toContain("eq(bookings.date, booking.date)");
    expect(section).toContain("eq(bookings.time, booking.time)");
    expect(section).toContain("if (!cancelResult[0].affectedRows)");
    expect(section.indexOf("if (!cancelResult[0].affectedRows)")).toBeLessThan(section.indexOf("Booking Cancelled"));
  });
});
