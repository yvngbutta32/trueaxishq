import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildOperationsExceptions, getCapacitySummary, hasDispatchConflict, isCapacityBearingAssignment, visitWindowsOverlap } from "../shared/operationsPlanning";

describe("team operations planning", () => {
  it("calculates remaining capacity and flags over-capacity planning deterministically", () => {
    expect(getCapacitySummary(2_400, 1_800)).toMatchObject({ capacity: 2_400, planned: 1_800, remainingMinutes: 600, isOverCapacity: false });
    expect(getCapacitySummary(2_400, 2_700)).toMatchObject({ remainingMinutes: 0, isOverCapacity: true });
  });

  it("counts only active assignments toward a member's planned workload", () => {
    expect(isCapacityBearingAssignment("assigned")).toBe(true);
    expect(isCapacityBearingAssignment("acknowledged")).toBe(true);
    expect(isCapacityBearingAssignment("declined")).toBe(false);
    expect(isCapacityBearingAssignment("completed")).toBe(false);
  });

  it("detects overlapping non-cancelled visit windows without treating adjacent visits as conflicts", () => {
    const first = { id: 1, start: new Date("2026-08-25T09:00:00Z"), end: new Date("2026-08-25T10:00:00Z"), status: "scheduled" };
    const adjacent = { id: 2, start: new Date("2026-08-25T10:00:00Z"), end: new Date("2026-08-25T11:00:00Z"), status: "scheduled" };
    const overlapping = { id: 3, start: new Date("2026-08-25T09:30:00Z"), end: new Date("2026-08-25T10:30:00Z"), status: "scheduled" };
    expect(visitWindowsOverlap(first, adjacent)).toBe(false);
    expect(hasDispatchConflict([first], adjacent)).toBe(false);
    expect(hasDispatchConflict([first], overlapping)).toBe(true);
    expect(hasDispatchConflict([{ ...first, status: "cancelled" }], overlapping)).toBe(false);
  });

  it("turns capacity, ownerless-job, and acknowledged visit-overlap data into distinct owner exceptions", () => {
    const exceptions = buildOperationsExceptions({
      capacity: [{ id: 1, name: "Morgan", active: true, weeklyCapacityMinutes: 600, plannedMinutes: 720 }],
      jobs: [{ id: 9, jobNumber: "JOB-9", title: "Unowned install", status: "in_progress" }],
      assignments: [],
      visits: [
        { id: 1, teamMemberId: 1, teamMemberName: "Morgan", title: "Morning visit", scheduledStart: new Date("2026-08-25T09:00:00Z"), scheduledEnd: new Date("2026-08-25T10:30:00Z"), status: "scheduled" },
        { id: 2, teamMemberId: 1, teamMemberName: "Morgan", title: "Overlapping visit", scheduledStart: new Date("2026-08-25T10:00:00Z"), scheduledEnd: new Date("2026-08-25T11:00:00Z"), status: "scheduled" },
      ],
    });
    expect(exceptions.map(exception => exception.kind)).toEqual(["over_capacity", "unassigned_job", "dispatch_overlap"]);
    expect(exceptions[2].detail).toContain("Morning visit overlaps Overlapping visit");
  });
});

describe("team operations ownership contracts", () => {
  it("keeps all assignment mutations and joins within the authenticated owner boundary", () => {
    const source = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const schema = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
    expect(source).toContain("eq(jobAssignments.userId, ctx.user.id)");
    expect(source).toContain("eq(teamMembers.userId, ctx.user.id)");
    expect(source).toContain("eq(jobs.userId, ctx.user.id)");
    expect(schema).toContain("jobAssignments_owner_job_member_unique_idx");
    expect(source).toContain("team_member_assigned");
    expect(source).toContain("team_member_unassigned");
  });

  it("requires an owner-scoped active assignment before dispatching and records an explicit conflict exception", () => {
    const source = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const dispatchUi = readFileSync(resolve(process.cwd(), "client/src/pages/DispatchBoard.tsx"), "utf8");
    expect(source).toContain("Assign this team member to the job before dispatching a visit.");
    expect(source).toContain("eq(serviceVisits.userId, ctx.user.id)");
    expect(source).toContain("hasDispatchConflict");
    expect(source).toContain("conflictAcknowledged");
    expect(source).toContain("service_visit_scheduled");
    expect(dispatchUi).toContain("No GPS, routing, or automated ETA claims");
    expect(dispatchUi).toContain("allowConflict");
  });
});
