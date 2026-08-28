import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const dispatchSource = readFileSync(resolve(process.cwd(), "client/src/pages/DispatchBoard.tsx"), "utf8");
const portalSource = readFileSync(resolve(process.cwd(), "client/src/pages/ClientPortal.tsx"), "utf8");

describe("owner-curated client visit-update correction", () => {
  it("keeps client-update correction owner-scoped and limited to active visits", () => {
    const updateVisit = routerSource.slice(routerSource.indexOf("updateVisit: protectedProcedure"), routerSource.indexOf("cancelVisit: protectedProcedure"));

    expect(updateVisit).toContain("Only active service visits can have client updates corrected.");
    expect(updateVisit).toContain("const clientVisible = clientVisibleInput ?? visit.clientVisible");
    expect(updateVisit).toContain("const clientUpdate = clientVisible ?");
    expect(updateVisit).toContain("eq(serviceVisits.id, id), eq(serviceVisits.userId, ctx.user.id)");
  });

  it("offers an explicit private curation control without representing it as delivery", () => {
    expect(dispatchSource).toContain("Correct client visit update");
    expect(dispatchSource).toContain("does not send email, SMS, push, calendar, or any other delivery");
    expect(dispatchSource).toContain("Save client-visible update");
  });

  it("retains the client-safe projection and excludes private operational detail", () => {
    const portalQuery = routerSource.slice(routerSource.indexOf("getJobs: publicProcedure"), routerSource.indexOf("// ── Contracts & Proposals"));

    expect(portalQuery).toContain("clientUpdate: serviceVisits.clientUpdate");
    expect(portalQuery).not.toContain("teamMemberId: serviceVisits.teamMemberId");
    expect(portalQuery).not.toContain("dispatchNote: serviceVisits.dispatchNote");
    expect(portalSource).not.toContain("Correct client visit update");
  });
});
