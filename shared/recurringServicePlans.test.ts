import { describe, expect, it } from "vitest";
import { isValidRecurringServicePlanInput, nextRecurringServiceDate } from "./recurringServicePlans";

describe("recurring service plan helpers", () => {
  it("validates bounded weekly and monthly recurrence inputs", () => {
    expect(isValidRecurringServicePlanInput({ frequency: "weekly", weekday: 1, startDate: "2026-08-01" })).toBe(true);
    expect(isValidRecurringServicePlanInput({ frequency: "monthly", dayOfMonth: 15, startDate: "2026-08-01" })).toBe(true);
    expect(isValidRecurringServicePlanInput({ frequency: "weekly", weekday: 7, startDate: "2026-08-01" })).toBe(false);
    expect(isValidRecurringServicePlanInput({ frequency: "monthly", dayOfMonth: 31, startDate: "2026-08-01" })).toBe(false);
  });

  it("calculates the next bounded weekly or monthly service date", () => {
    expect(nextRecurringServiceDate({ frequency: "weekly", weekday: 1, startDate: "2026-08-01" }, "2026-08-26")).toBe("2026-08-31");
    expect(nextRecurringServiceDate({ frequency: "monthly", dayOfMonth: 15, startDate: "2026-08-01" }, "2026-08-26")).toBe("2026-09-15");
    expect(nextRecurringServiceDate({ frequency: "weekly", weekday: 1, startDate: "2026-08-01", endDate: "2026-08-30" }, "2026-08-26")).toBe(null);
  });
});
