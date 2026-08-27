import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve(import.meta.dirname, "routers.ts"), "utf8");

describe("customer asset job link", () => {
  it("requires the job and active asset to share the authenticated owner and client", () => {
    const jobsRouter = source.slice(source.indexOf("jobs: router({"));
    const procedure = jobsRouter.slice(jobsRouter.indexOf("setCustomerAsset: protectedProcedure"), jobsRouter.indexOf("listChecklistTemplates"));
    const workspace = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/JobWorkspace.tsx"), "utf8");
    expect(procedure).toContain("eq(jobs.id, input.jobId), eq(jobs.userId, ctx.user.id)");
    expect(procedure).toContain("eq(customerAssets.userId, ctx.user.id), eq(customerAssets.clientId, job.clientId), eq(customerAssets.active, true)");
    expect(procedure).toContain("eq(jobs.clientId, job.clientId)");
    expect(workspace).toContain("trpc.jobs.setCustomerAsset.useMutation");
    expect(workspace).toContain('aria-label="Link a private customer asset to this job"');
  });
});
