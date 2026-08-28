import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const dispatchSource = readFileSync(resolve(process.cwd(), "client/src/pages/DispatchBoard.tsx"), "utf8");
const portalSource = readFileSync(resolve(process.cwd(), "client/src/pages/ClientPortal.tsx"), "utf8");

describe("owner-only service-visit time correction", () => {
  it("rejects timing changes for completed or cancelled visits while retaining final owner scope", () => {
    const updateVisit = routerSource.slice(routerSource.indexOf("updateVisit: protectedProcedure"), routerSource.indexOf("cancelVisit: protectedProcedure"));

    expect(updateVisit).toContain("Only active service visits can have their time corrected.");
    expect(updateVisit).toContain("eq(serviceVisits.id, id), eq(serviceVisits.userId, ctx.user.id)");
    expect(updateVisit).toContain("const scheduledStart = input.scheduledStart ?? visit.scheduledStart");
    expect(updateVisit).toContain("const scheduledEnd = input.scheduledEnd ?? visit.scheduledEnd");
  });

  it("reuses private overlap and availability checks before saving a corrected window", () => {
    const updateVisit = routerSource.slice(routerSource.indexOf("updateVisit: protectedProcedure"), routerSource.indexOf("cancelVisit: protectedProcedure"));

    expect(updateVisit).toContain("hasDispatchConflict");
    expect(updateVisit).toContain("staffAvailabilityBlocks.teamMemberId, teamMemberId");
    expect(updateVisit).toContain("Confirm the exception to save it.");
    expect(updateVisit).toContain('eventType: "service_visit_time_corrected"');
  });

  it("keeps the time-correction control and its private planning context out of the client portal", () => {
    expect(dispatchSource).toContain("Correct visit time");
    expect(dispatchSource).toContain("does not notify, dispatch, or change client-facing fields automatically");
    expect(portalSource).not.toContain("Correct visit time");
    expect(portalSource).not.toContain("service_visit_time_corrected");
  });
});
