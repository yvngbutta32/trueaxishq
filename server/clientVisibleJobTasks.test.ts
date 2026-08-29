import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("client-visible job task projection", () => {
  it("keeps reviewed task visibility opt-in and default-private in the active schema and additive migration", () => {
    const schema = source("drizzle/schema.ts");
    const migration = source("drizzle/0060_exotic_black_knight.sql");

    expect(schema).toContain('clientVisible: boolean("clientVisible").notNull().default(false)');
    expect(migration).toContain("ALTER TABLE `jobTasks` ADD `clientVisible` boolean DEFAULT false NOT NULL");
    expect(migration).toContain("jobTasks_user_job_clientVisible_idx");
  });

  it("requires an owner-scoped task update and records deliberate visibility changes privately", () => {
    const router = source("server/routers.ts");
    const taskUpdate = router.slice(router.indexOf("updateTask: protectedProcedure"), router.indexOf("deleteTask: protectedProcedure"));

    expect(taskUpdate).toContain("clientVisible: z.boolean().optional()");
    expect(taskUpdate).toContain("eq(jobTasks.id, input.id), eq(jobTasks.userId, ctx.user.id)");
    expect(taskUpdate).toContain("task_visibility_changed");
    expect(taskUpdate).toContain("eq(jobTasks.id, id), eq(jobTasks.userId, ctx.user.id)");
  });

  it("projects only reviewed task progress through the active portal token scope", () => {
    const router = source("server/routers.ts");
    const portal = source("client/src/pages/ClientPortal.tsx");
    const portalQuery = router.slice(router.indexOf("getJobs: publicProcedure"), router.indexOf("respondToApproval: publicProcedure"));

    expect(portalQuery).toContain("clientVisible: jobTasks.clientVisible");
    expect(portalQuery).toContain("eq(jobTasks.clientVisible, true)");
    expect(portalQuery).toContain("eq(jobTasks.userId, portalRecord.userId)");
    expect(portalQuery).toContain("inArray(jobTasks.jobId, jobIds)");
    expect(portalQuery).not.toContain("description: jobTasks.description");
    expect(portal).toContain("Only items your provider has chosen to share appear here.");
  });

  it("provides a deliberate owner-reviewed sharing control without describing internal task content as client-visible", () => {
    const workspace = source("client/src/pages/JobWorkspace.tsx");

    expect(workspace).toContain("in the client portal");
    expect(workspace).toContain("Shared with client");
    expect(workspace).toContain("Private to your workspace");
  });
});
