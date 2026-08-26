import { describe, expect, it } from "vitest";
import { doPublicBookingIntervalsOverlap, getPublishedBookingServiceCatalog, getPublishedBookingServices, publicBookingTimeToMinutes } from "./publicBookingRules";

describe("public booking service catalog", () => {
  it("keeps legacy plain service arrays bookable with a safe default duration", () => {
    expect(getPublishedBookingServiceCatalog(JSON.stringify(["Consultation"]))).toEqual([{ name: "Consultation", durationMinutes: 60, active: true, priceGuidance: null }]);
  });

  it("accepts bounded structured records while hiding inactive services from public selection", () => {
    const catalog = getPublishedBookingServiceCatalog(JSON.stringify([
      { name: "Assessment", durationMinutes: 90, active: true, priceGuidance: "$120 visit fee" },
      { name: "Legacy", durationMinutes: 15, active: false },
    ]));
    expect(catalog[0]).toEqual({ name: "Assessment", durationMinutes: 90, active: true, priceGuidance: "$120 visit fee" });
    expect(getPublishedBookingServices(JSON.stringify(catalog))).toEqual(["Assessment"]);
  });

  it("falls back conservatively for malformed, empty, or unsafe catalog data", () => {
    expect(getPublishedBookingServiceCatalog("not-json")).toHaveLength(3);
    expect(getPublishedBookingServiceCatalog(JSON.stringify([{ name: "Bad duration", durationMinutes: 7 }]))[0]?.durationMinutes).toBe(60);
    expect(getPublishedBookingServiceCatalog(JSON.stringify([]))).toHaveLength(3);
  });

  it("calculates same-day duration intervals without treating an exact end boundary as an overlap", () => {
    expect(publicBookingTimeToMinutes("12:00 PM")).toBe(720);
    expect(doPublicBookingIntervalsOverlap("9:00 AM", 60, "10:00 AM", 30)).toBe(false);
    expect(doPublicBookingIntervalsOverlap("9:00 AM", 90, "10:00 AM", 60)).toBe(true);
    expect(doPublicBookingIntervalsOverlap("not a slot", 60, "10:00 AM", 60)).toBe(true);
  });
});
