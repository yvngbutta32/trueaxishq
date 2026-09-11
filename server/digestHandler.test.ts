import { describe, expect, it } from "vitest";
import { overdueDays } from "./digestHandler";

describe("daily digest overdue calculations", () => {
  it("calculates days overdue from ISO date strings", () => {
    expect(overdueDays("2026-09-01", new Date("2026-09-11T12:00:00Z"))).toBe(10);
  });

  it("does not report future or invalid dates as overdue", () => {
    expect(overdueDays("2026-09-12", new Date("2026-09-11T12:00:00Z"))).toBe(0);
    expect(overdueDays("not-a-date", new Date("2026-09-11T12:00:00Z"))).toBe(0);
  });
});
