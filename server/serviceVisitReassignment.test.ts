import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const dispatchSource = readFileSync(resolve(process.cwd(), "client/src/pages/DispatchBoard.tsx"), "utf8");
const portalSource = readFileSync(resolve(process.cwd(), "client/src/pages/ClientPortal.tsx"), "utf8");

describe("owner-only service-visit reassignment", () => {
  it("requires an active same-owner job assignment before a visit can be reassigned", () => {
    const updateVisit = routerSource.slice(routerSource.indexOf("updateVisit: protectedProcedure"), routerSource.indexOf("cancelVisit: protectedProcedure"));

    expect(updateVisit).toContain("teamMemberId: z.number().int().positive().optional()");
    expect(updateVisit).toContain("const teamMemberId = input.teamMemberId ?? visit.teamMemberId");
    expect(updateVisit).toContain("Only active service visits can be reassigned.");
    expect(updateVisit).toContain("eq(teamMembers.id, input.teamMemberId), eq(teamMembers.userId, ctx.user.id)");
    expect(updateVisit).toContain("eq(jobAssignments.userId, ctx.user.id)");
    expect(updateVisit).toContain("eq(jobAssignments.jobId, visit.jobId)");
    expect(updateVisit).toContain("eq(jobAssignments.teamMemberId, input.teamMemberId)");
    expect(updateVisit).toContain('inArray(jobAssignments.status, ["assigned", "acknowledged"])');
  });

  it("rechecks the new assignee's active-visit and private-availability conflicts with explicit exception acknowledgement", () => {
    const updateVisit = routerSource.slice(routerSource.indexOf("updateVisit: protectedProcedure"), routerSource.indexOf("cancelVisit: protectedProcedure"));

    expect(updateVisit).toContain("eq(serviceVisits.teamMemberId, teamMemberId)");
    expect(updateVisit).toContain("eq(staffAvailabilityBlocks.teamMemberId, teamMemberId)");
    expect(updateVisit).toContain("Confirm the exception to save it.");
    expect(updateVisit).toContain("eq(serviceVisits.id, id), eq(serviceVisits.userId, ctx.user.id)");
    expect(updateVisit).toContain('eventType: "service_visit_reassigned"');
  });

  it("keeps reassignment controls and identity context out of the client portal", () => {
    expect(dispatchSource).toContain("Correct visit assignment");
    expect(dispatchSource).toContain("does not notify, dispatch, reschedule, or change client-facing fields automatically");
    expect(portalSource).not.toContain("Correct visit assignment");
    expect(portalSource).not.toContain("service_visit_reassigned");
  });
});
