import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { normalizeScheduleSuggestions } from "./scheduleSuggestions";

// Contract: LLM smartSchedule output is normalized server-side before it can
// reach the booking form. Background: the live QA sweep caught malformed
// suggestion objects ({label, why} instead of {date, time, reason}) being
// applied to the New Booking dialog, which flipped its controlled date/time
// inputs to uncontrolled (React warning) and corrupted the form.

describe("normalizeScheduleSuggestions", () => {
  it("passes well-formed suggestions through with reason trimmed to 120 chars", () => {
    const out = normalizeScheduleSuggestions({ suggestions: [
      { date: "2026-11-15", time: "10:30", reason: "No conflicts" },
      { date: "2026-11-16", time: "09:00", reason: "x".repeat(200) },
    ] });
    expect(out).toEqual([
      { date: "2026-11-15", time: "10:30", reason: "No conflicts" },
      { date: "2026-11-16", time: "09:00", reason: "x".repeat(120) },
    ]);
  });

  it("drops suggestions with missing date/time (the {label, why} shape that broke the dialog)", () => {
    const out = normalizeScheduleSuggestions({ suggestions: [
      { label: "Tuesday 10:00 AM", why: "No conflicts" },
      { date: "2026-11-15" },
      { time: "10:00" },
      { date: "2026-11-15", time: "10:00", reason: "valid one" },
    ] });
    expect(out).toEqual([{ date: "2026-11-15", time: "10:00", reason: "valid one" }]);
  });

  it("rejects badly formatted or impossible dates and times", () => {
    const out = normalizeScheduleSuggestions({ suggestions: [
      { date: "15/11/2026", time: "10:00", reason: "non-ISO date" },
      { date: "2026-13-45", time: "10:00", reason: "impossible calendar date" },
      { date: "2026-11-15", time: "2:00", reason: "missing leading zero" },
      { date: "2026-11-15", time: "24:00", reason: "out of range hour" },
      { date: "2026-11-15", time: "10:60", reason: "out of range minute" },
    ] });
    expect(out).toEqual([]);
  });

  it("handles non-array suggestions, non-object input, null entries and non-string fields", () => {
    expect(normalizeScheduleSuggestions({ suggestions: "nope" })).toEqual([]);
    expect(normalizeScheduleSuggestions(null)).toEqual([]);
    expect(normalizeScheduleSuggestions(42)).toEqual([]);
    expect(normalizeScheduleSuggestions({ suggestions: [null, 7, "x", { date: 11, time: "10:00" }] })).toEqual([]);
  });

  it("caps at 5 suggestions", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ date: `2026-11-1${i}`, time: "10:00", reason: "r" }));
    expect(normalizeScheduleSuggestions({ suggestions: many })).toHaveLength(5);
  });
});

describe("smartSchedule wiring (source pins)", () => {
  const routers = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../client/src/pages/dashboard/SchedulingPanel.tsx", import.meta.url), "utf8");

  it("the router normalizes parsed LLM output instead of passing parsed.suggestions through", () => {
    expect(routers).toContain("normalizeScheduleSuggestions(parsed)");
    expect(routers).not.toContain("parsed.suggestions ?? []");
    expect(routers).toContain('import { normalizeScheduleSuggestions } from "./scheduleSuggestions"');
  });

  it("the client only renders apply buttons for suggestions with date AND time", () => {
    expect(panel).toContain("smartSuggestions.filter(s => s && s.date && s.time)");
    // the apply button must write through the same fields it renders
    expect(panel).toContain("date: s.date, time: s.time");
  });
});
