import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("reusable job checklist templates", () => {
  it("keeps templates and their task items owner-scoped", () => {
    const schema = source("drizzle/schema.ts");
    const router = source("server/routers.ts");
    const jobRouter = router.slice(router.indexOf("jobs: router({"));

    expect(schema).toContain('jobChecklistTemplates = mysqlTable("jobChecklistTemplates"');
    expect(schema).toContain('jobChecklistTemplateItems = mysqlTable("jobChecklistTemplateItems"');
    expect(schema).toContain('index("jobChecklistTemplates_owner_idx").on(t.userId)');
    expect(schema).toContain('index("jobChecklistTemplateItems_owner_template_idx").on(t.userId, t.templateId)');
    expect(jobRouter).toContain("createChecklistTemplateFromJob: protectedProcedure");
    expect(jobRouter).toContain("eq(jobChecklistTemplates.userId, ctx.user.id)");
    expect(jobRouter).toContain("eq(jobChecklistTemplateItems.userId, ctx.user.id)");
  });

  it("copies only checklist titles from an owner job and applies only a verified owner template to a new job", () => {
    const router = source("server/routers.ts");
    const jobRouter = router.slice(router.indexOf("jobs: router({"));

    expect(jobRouter).toContain("Add at least one checklist item before saving a template.");
    expect(jobRouter).toContain("title: task.title, sortOrder: index");
    expect(jobRouter).toContain("templateId: z.number().int().positive().optional()");
    expect(jobRouter).toContain("Checklist template not found.");
    expect(jobRouter).toContain('status: "todo" as const');
    expect(jobRouter).toContain("checklist_template_applied");
    expect(jobRouter).not.toContain("clientId: job.clientId, templateId");
  });

  it("keeps template controls in the owner job workspace and describes their narrow copy boundary", () => {
    const workspace = source("client/src/pages/JobWorkspace.tsx");

    expect(workspace).toContain("Save as template");
    expect(workspace).toContain("Start with an empty checklist");
    expect(workspace).toContain("Client, schedule, notes, proof, and completed states are not copied.");
    expect(workspace).toContain("createChecklistTemplateFromJob");
  });
});
