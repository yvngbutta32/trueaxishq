import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { doPublicBookingIntervalsOverlap } from "../shared/publicBookingRules";

// Contract: the public booking page must disable exactly the slots the server
// would reject. Found by the live click-everything sweep: the page only checked
// exact date+time matches while booking.submit enforces interval overlap
// (service duration + buffer), so customers could pick a slot shown as
// available and get a 409 "overlaps an existing appointment" on submit.

describe("doPublicBookingIntervalsOverlap semantics (the rule both ends must share)", () => {
  // Slot strings are the published PUBLIC_BOOKING_TIME_SLOTS format ("9:00 AM").

  it("a 90-minute booking at 9:00 AM blocks a 10:00 AM start but not an 11:00 AM start", () => {
    expect(doPublicBookingIntervalsOverlap("10:00 AM", 90, "9:00 AM", 90)).toBe(true);
    expect(doPublicBookingIntervalsOverlap("11:00 AM", 90, "9:00 AM", 90)).toBe(false);
  });

  it("buffer minutes extend the occupied interval (9:00 AM x60 blocks 10:00 AM only with buffer)", () => {
    expect(doPublicBookingIntervalsOverlap("10:00 AM", 60, "9:00 AM", 60)).toBe(false); // touching, not overlapping
    expect(doPublicBookingIntervalsOverlap("10:00 AM", 60 + 15, "9:00 AM", 60 + 15)).toBe(true); // buffers close the gap
  });

  it("exact-slot match always overlaps itself", () => {
    expect(doPublicBookingIntervalsOverlap("2:30 PM", 60, "2:30 PM", 60)).toBe(true);
  });

  it("unparseable times or zero-length intervals are treated as occupied (fail closed)", () => {
    expect(doPublicBookingIntervalsOverlap("whenever", 60, "9:00 AM", 60)).toBe(true);
    expect(doPublicBookingIntervalsOverlap("10:00 AM", 0, "9:00 AM", 60)).toBe(true);
  });

  it("cross-format overlap: dashboard 24h booking times block matching public AM/PM slots", () => {
    // "09:00" (dashboard format) and "9:00 AM" (public slot) are the same moment.
    expect(doPublicBookingIntervalsOverlap("9:00 AM", 60, "09:00", 60)).toBe(true);
    // A 60-minute dashboard booking at 09:00 leaves 10:00 AM free (touching).
    expect(doPublicBookingIntervalsOverlap("10:00 AM", 60, "09:00", 60)).toBe(false);
    // A 90-minute dashboard booking at 09:00 blocks 10:00 AM.
    expect(doPublicBookingIntervalsOverlap("10:00 AM", 60, "09:00", 90)).toBe(true);
  });
});

describe("public booking slot occupancy wiring (source pins)", () => {
  const routers = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
  const bookingPage = readFileSync(new URL("../client/src/pages/BookingPage.tsx", import.meta.url), "utf8");

  it("booking.getPage returns duration and mirrors the submit conflict query (not status='scheduled' only)", () => {
    expect(routers).toContain("db.select({ date: bookings.date, time: bookings.time, duration: bookings.duration })");
    // getPage and submit must agree on which bookings occupy slots.
    expect(routers).toMatch(/bookedSlots[\s\S]{0,900}NOT IN \('cancelled', 'no_show'\)/);
    expect(routers).toMatch(/doPublicBookingIntervalsOverlap\(input\.preferredTime, selectedService\.durationMinutes \+ publishedSchedule\.bufferMinutes/);
  });

  it("BookingPage disables slots with the same shared overlap rule, not exact time matches", () => {
    expect(bookingPage).toContain("doPublicBookingIntervalsOverlap");
    expect(bookingPage).toContain("const slotOccupied = (isoDate: string, time: string)");
    expect(bookingPage).toContain("doPublicBookingIntervalsOverlap(time, formServiceDurationMins + bufferMins, slot.time, (slot.duration ?? 60) + bufferMins)");
    // both the date grid and the time grid must use it
    expect(bookingPage).toContain("publishedSchedule.timeSlots.every(time => slotOccupied(isoDate, time))");
    expect(bookingPage).toContain("slotOccupied(form.preferredDate, time)");
    // the old exact-match occupancy check must be gone
    expect(bookingPage).not.toContain("slot.time === time");
  });
});
