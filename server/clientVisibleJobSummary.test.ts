import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const schema = readFileSync(resolve(root, "drizzle/schema.ts"), "utf8");
const router = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const workspace = readFileSync(resolve(root, "client/src/pages/JobWorkspace.tsx"), "utf8");
const portal = readFileSync(resolve(root, "client/src/pages/ClientPortal.tsx"), "utf8");

describe("reviewed client job summaries", () => {
  it("keeps the summary default-private with an owner/client visibility index", () => {
    expect(schema).toContain('clientSummary: text("clientSummary")');
    expect(schema).toContain('clientSummaryVisible: boolean("clientSummaryVisible").notNull().default(false)');
    expect(schema).toContain('jobs_user_clientSummaryVisible_idx").on(t.userId, t.clientId, t.clientSummaryVisible)');
  });

  it("keeps private job description out of the token-scoped portal job projection", () => {
    const portalJobs = router.slice(router.indexOf("getJobs: publicProcedure"), router.indexOf("respondToApproval: publicProcedure"));
    expect(portalJobs).toContain("case when ${jobs.clientSummaryVisible} then ${jobs.clientSummary} else null end");
    expect(portalJobs).not.toContain("description: jobs.description");
    expect(portalJobs).toContain("eq(jobs.userId, portalRecord.userId)");
    expect(portalJobs).toContain("eq(jobs.clientId, portalRecord.clientId)");
  });

  it("keeps owner summary updates final-owner and same-client scoped", () => {
    const update = router.slice(router.indexOf("update: protectedProcedure", router.indexOf("jobs: router({")), router.indexOf("addTask: protectedProcedure", router.indexOf("jobs: router({")));
    expect(update).toContain("clientSummary: safeOptionalString(2000).nullable().optional()");
    expect(update).toContain("clientSummaryVisible: z.boolean().optional()");
    expect(update).toContain('eventType: "client_summary_updated"');
    expect(update).toContain("eq(jobs.userId, ctx.user.id), eq(jobs.clientId, current.clientId)");
  });

  it("renders only the reviewed summary in the portal and describes the owner control", () => {
    expect(portal).toContain("job.clientSummary");
    expect(portal).not.toContain("job.description &&");
    expect(portal).toContain("Provider-chosen summaries, milestones, updates, and proof of work");
    expect(workspace).toContain("Client job summary");
    expect(workspace).toContain("Your private scope note stays in this workspace");
    expect(workspace).toContain("Share this reviewed summary in the client portal");
  });
});
