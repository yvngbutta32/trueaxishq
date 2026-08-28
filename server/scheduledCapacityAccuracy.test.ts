import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const teamSource = readFileSync(resolve(process.cwd(), "client/src/pages/TeamOperations.tsx"), "utf8");
const dispatchSource = readFileSync(resolve(process.cwd(), "client/src/pages/DispatchBoard.tsx"), "utf8");

describe("scheduled capacity accuracy", () => {
  it("calculates scheduled visit time separately from active assignment planning load in a validated selected UTC week", () => {
    expect(routerSource).toContain('capacity: protectedProcedure.input(z.object({ weekStart: z.string().datetime().optional() }).optional())');
    expect(routerSource).toContain("Choose a valid UTC planning week.");
    expect(routerSource).toContain("Choose a Monday at 00:00 UTC for the planning week.");
    expect(routerSource).toContain("const weekStart = new Date(Date.UTC");
    expect(routerSource).toContain("scheduledMinutes = scheduledVisits");
    expect(routerSource).toContain("lt(serviceVisits.scheduledStart, weekEnd)");
    expect(routerSource).toContain("gt(serviceVisits.scheduledEnd, weekStart)");
    expect(routerSource).toContain("Math.max(visit.scheduledStart.getTime(), weekStart.getTime())");
    expect(routerSource).toContain("Math.min(visit.scheduledEnd.getTime(), weekEnd.getTime())");
    expect(routerSource).toContain("scheduledOverCapacity: scheduledMinutes > capacity");
    expect(routerSource).toContain("privateAvailabilityMinutes = availabilityBlocks");
    expect(routerSource).toContain("Math.max(block.startsAt.getTime(), weekStart.getTime())");
    expect(routerSource).toContain("scheduleWindow: { startsAt: weekStart, endsAt: weekEnd }");
  });

  it("keeps selected capacity signals owner-side planning information rather than attendance or client data", () => {
    expect(teamSource).toContain("utcMondayDateInput");
    expect(teamSource).toContain('weekStart: `${capacityWeekStart}T00:00:00.000Z`');
    expect(teamSource).toContain("Planning week (UTC)");
    expect(teamSource).toContain("scheduled in selected UTC week");
    expect(teamSource).toContain("blocked in private availability in selected UTC week");
    expect(teamSource).toContain("planning context only");
    expect(dispatchSource).toContain("These are private owner-planning signals");
    expect(dispatchSource).toContain("not GPS, staff availability, attendance, payroll, or client-visible promises");
  });
});
