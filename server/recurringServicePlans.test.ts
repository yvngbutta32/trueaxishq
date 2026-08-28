import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const dispatchSource = readFileSync(resolve(process.cwd(), "client/src/pages/DispatchBoard.tsx"), "utf8");
const portalSource = readFileSync(resolve(process.cwd(), "client/src/pages/ClientPortal.tsx"), "utf8");

describe("recurring service plan workflow contracts", () => {
  it("keeps plans owner scoped and validates recurrence before creation", () => {
    expect(routerSource).toContain("recurringServicePlans: router");
    expect(routerSource).toContain("eq(recurringServicePlans.userId, ctx.user.id)");
    expect(routerSource).toContain("isValidRecurringServicePlanInput(recurrenceInput)");
  });

  it("allows an optional private asset only after final owner, same-client, and active-state validation", () => {
    expect(routerSource).toContain("customerAssetId: z.number().int().positive().nullable().optional()");
    expect(routerSource).toContain("eq(customerAssets.userId, ctx.user.id)");
    expect(routerSource).toContain("eq(customerAssets.clientId, job.clientId)");
    expect(routerSource).toContain("eq(customerAssets.active, true)");
    expect(routerSource).toContain("Choose an active asset belonging to this job's client.");
    expect(routerSource).toContain("customerAssetId, name: input.name");
  });

  it("generates only internal linked service visits and deduplicates the scheduled start", () => {
    expect(routerSource).toContain("recurringServicePlanId: plan.id");
    expect(routerSource).toContain("eq(serviceVisits.recurringServicePlanId, plan.id)");
    expect(routerSource).toContain("clientVisible: false");
    expect(routerSource).toContain("created: false");
  });

  it("keeps generated visits owner-planned and exposes generation only in dispatch, not the client portal", () => {
    expect(routerSource).toContain("clientVisible: false");
    expect(dispatchSource).toContain("generateNextVisit.useMutation");
    expect(dispatchSource).toContain("Generate unassigned visit");
    expect(portalSource).not.toContain("recurringServicePlans");
  });

  it("keeps linked asset context in the protected recurring planning surface", () => {
    expect(dispatchSource).toContain("recurringServicePlans.create.useMutation");
    expect(dispatchSource).toContain("Private customer asset");
    expect(dispatchSource).toContain("Only active assets belonging to this job’s client are available.");
    expect(dispatchSource).toContain("Private asset context:");
    expect(portalSource).not.toContain("Private customer asset");
    expect(portalSource).not.toContain("Private asset context:");
  });
});
