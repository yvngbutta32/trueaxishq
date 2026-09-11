import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("durable background job runs", () => {
  it("records job execution and exposes the latest persisted failure", () => {
    const schema = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
    const jobs = readFileSync(resolve(process.cwd(), "server/backgroundJobs.ts"), "utf8");
    const health = readFileSync(resolve(process.cwd(), "server/_core/systemRouter.ts"), "utf8");
    expect(schema).toContain('export const backgroundJobRuns = mysqlTable("backgroundJobRuns"');
    expect(jobs).toContain("getDurableBackgroundJobStatus");
    expect(jobs).toContain('status: "running"');
    expect(jobs).toContain('"succeeded" | "failed"');
    expect(jobs).toContain('finishDurableJobRun(db, runId, "failed"');
    expect(health).toContain("durableBackgroundJobs");
  });
});
