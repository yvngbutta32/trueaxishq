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

  it("allows only the owner to pause or resume a plan while generation continues to require an active record", () => {
    expect(routerSource).toContain("setActive: protectedProcedure");
    expect(routerSource).toContain("eq(recurringServicePlans.id, input.id), eq(recurringServicePlans.userId, ctx.user.id)");
    expect(routerSource).toContain("Recurring service plan not found.");
    expect(routerSource).toContain("eq(recurringServicePlans.active, true)");
  });

  it("generates only internal linked service visits and deduplicates the scheduled start", () => {
    expect(routerSource).toContain("recurringServicePlanId: plan.id");
    expect(routerSource).toContain("eq(serviceVisits.recurringServicePlanId, plan.id)");
    expect(routerSource).toContain("clientVisible: false");
    expect(routerSource).toContain("created: false");
  });

  it("stores a validated UTC plan start time and uses it for initial and later generated visits", () => {
    expect(routerSource).toContain('startTime: z.string().regex(/^([01]\\d|2[0-3]):[0-5]\\d$/).default("09:00")');
    expect(routerSource).toContain("startTime: input.startTime");
    expect(routerSource).toContain("T${input.startTime}:00.000Z");
    expect(routerSource).toContain("T${plan.startTime}:00.000Z");
  });

  it("rechecks a linked asset's owner, client, and active state before generating future work", () => {
    expect(routerSource).toContain("if (plan.customerAssetId)");
    expect(routerSource).toContain("eq(customerAssets.id, plan.customerAssetId)");
    expect(routerSource).toContain("eq(customerAssets.userId, ctx.user.id)");
    expect(routerSource).toContain("eq(customerAssets.clientId, job.clientId)");
    expect(routerSource).toContain("Linked asset is inactive or no longer belongs to this job's client.");
  });

  it("allows only the owner to replace or remove private plan asset context after final same-client active-asset checks", () => {
    expect(routerSource).toContain("setCustomerAsset: protectedProcedure");
    expect(routerSource).toContain("customerAssetId: z.number().int().positive().nullable()");
    expect(routerSource).toContain("eq(recurringServicePlans.id, input.id), eq(recurringServicePlans.userId, ctx.user.id)");
    expect(routerSource).toContain("eq(customerAssets.clientId, plan.clientId)");
    expect(routerSource).toContain("Choose an active asset belonging to this plan's job client.");
    expect(routerSource).toContain("set({ customerAssetId: input.customerAssetId");
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

  it("exposes private lifecycle controls without deleting plan history or client-facing projections", () => {
    expect(dispatchSource).toContain("recurringServicePlans.setActive.useMutation");
    expect(dispatchSource).toContain("Pause plan");
    expect(dispatchSource).toContain("Resume plan");
    expect(dispatchSource).toContain("Paused plans retain history and do not generate a new visit.");
    expect(portalSource).not.toContain("Pause plan");
    expect(portalSource).not.toContain("Resume plan");
  });

  it("keeps inactive asset guidance and generation blocking in the private dispatch surface", () => {
    expect(dispatchSource).toContain("Linked asset is inactive. Reactivate it before generating a future visit.");
    expect(dispatchSource).toContain("plan.customerAssetActive === false");
    expect(portalSource).not.toContain("Linked asset is inactive.");
  });

  it("keeps UTC time selection and display in protected recurring planning without portal projection", () => {
    expect(dispatchSource).toContain('startTime: "09:00"');
    expect(dispatchSource).toContain("Start time (UTC)");
    expect(dispatchSource).toContain("Times are saved in UTC and shown in your local time");
    expect(portalSource).not.toContain("Start time (UTC)");
  });

  it("keeps private plan asset correction controls out of the client portal", () => {
    expect(dispatchSource).toContain("recurringServicePlans.setCustomerAsset.useMutation");
    expect(dispatchSource).toContain("Correct plan asset");
    expect(dispatchSource).toContain("Remove private asset context");
    expect(portalSource).not.toContain("Correct plan asset");
    expect(portalSource).not.toContain("Remove private asset context");
  });
});
