import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOperationsExceptions } from "../shared/operationsPlanning";

const root = path.resolve(import.meta.dirname, "..");
const schema = fs.readFileSync(path.join(root, "drizzle/schema.ts"), "utf8");
const router = fs.readFileSync(path.join(root, "server/routers.ts"), "utf8");
const dispatchBoard = fs.readFileSync(path.join(root, "client/src/pages/DispatchBoard.tsx"), "utf8");
const clientPortal = fs.readFileSync(path.join(root, "client/src/pages/ClientPortal.tsx"), "utf8");

describe("private staff availability", () => {
  it("stores only owner-scoped bounded availability records with query indexes", () => {
    expect(schema).toContain('export const staffAvailabilityBlocks = mysqlTable("staffAvailabilityBlocks"');
    expect(schema).toContain('teamMemberId: int("teamMemberId").notNull()');
    expect(schema).toContain('startsAt: timestamp("startsAt").notNull()');
    expect(schema).toContain('endsAt: timestamp("endsAt").notNull()');
    expect(schema).toContain('reason: varchar("reason", { length: 500 })');
    expect(schema).toContain('index("staffAvailabilityBlocks_owner_member_start_idx").on(t.userId, t.teamMemberId, t.startsAt)');
  });

  it("uses owner-scoped create, delete, and overlap predicates", () => {
    const dispatchStart = router.indexOf("dispatch: router({");
    const dispatchEnd = router.indexOf("workflowWebhooks: router({", dispatchStart);
    const dispatch = router.slice(dispatchStart, dispatchEnd);

    expect(dispatch).toContain("listAvailabilityBlocks: protectedProcedure");
    expect(dispatch).toContain("createAvailabilityBlock: protectedProcedure");
    expect(dispatch).toContain("deleteAvailabilityBlock: protectedProcedure");
    expect(dispatch).toContain("eq(staffAvailabilityBlocks.userId, ctx.user.id), eq(staffAvailabilityBlocks.teamMemberId, input.teamMemberId)");
    expect(dispatch).toContain("lt(staffAvailabilityBlocks.startsAt, input.endsAt), gt(staffAvailabilityBlocks.endsAt, input.startsAt)");
    expect(dispatch).toContain("eq(staffAvailabilityBlocks.id, input.id), eq(staffAvailabilityBlocks.userId, ctx.user.id)");
    expect(dispatch).toContain("availabilityConflict");
    expect(dispatch).toContain("block.startsAt < input.scheduledEnd && block.endsAt > input.scheduledStart");
    expect(dispatch).toContain("availabilityConflictAcknowledged: availabilityConflict");
  });

  it("keeps availability signals private and clearly avoids field-operation overclaims", () => {
    expect(dispatchBoard).toContain("Private staff availability");
    expect(dispatchBoard).toContain("Private availability overlap");
    expect(dispatchBoard).toContain("not attendance, payroll, GPS, route, client-portal, or automatic reassignment data");
    expect(dispatchBoard).toContain("Add private availability block");
    expect(clientPortal).not.toContain("Private staff availability");
    expect(clientPortal).not.toContain("Private availability overlap");
  });

  it("adds a minimized owner-planning exception without carrying private block reasons", () => {
    const exceptions = buildOperationsExceptions({
      capacity: [{ id: 7, name: "Morgan Lee", active: true, weeklyCapacityMinutes: 2_400, plannedMinutes: 600 }],
      jobs: [],
      assignments: [],
      visits: [{ id: 19, teamMemberId: 7, teamMemberName: "Morgan Lee", title: "Installation", scheduledStart: new Date("2026-08-27T10:00:00.000Z"), scheduledEnd: new Date("2026-08-27T11:00:00.000Z"), status: "scheduled", availabilityConflict: true }],
    });

    expect(exceptions).toContainEqual(expect.objectContaining({ key: "availability-19", kind: "availability_overlap", severity: "warning" }));
    expect(JSON.stringify(exceptions)).not.toContain("Time off");
  });
});
