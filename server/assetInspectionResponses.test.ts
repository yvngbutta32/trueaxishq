import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const source = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("private asset inspection responses", () => {
  it("persists owner, job, client, asset, template-version, and field-snapshot context with owner query indexes", () => {
    const schema = source("drizzle/schema.ts");
    expect(schema).toContain('assetInspectionResponses = mysqlTable("assetInspectionResponses"');
    expect(schema).toContain('jobId: int("jobId").notNull()');
    expect(schema).toContain('clientId: int("clientId").notNull()');
    expect(schema).toContain('customerAssetId: int("customerAssetId").notNull()');
    expect(schema).toContain('templateVersion: int("templateVersion").notNull()');
    expect(schema).toContain('templateFields: text("templateFields").notNull()');
    expect(schema).toContain('index("assetInspectionResponses_owner_job_idx").on(t.userId, t.jobId)');
    expect(schema).toContain('index("assetInspectionResponses_owner_asset_idx").on(t.userId, t.customerAssetId)');
  });

  it("requires protected owner scope and verifies job, linked asset, same client, and active owner template before insert", () => {
    const router = source("server/routers.ts");
    const responseRouter = router.slice(router.indexOf("assetInspectionResponses: router({"), router.indexOf("// ── Invoices"));
    expect(responseRouter).toContain("listForJob: protectedProcedure");
    expect(responseRouter).toContain("create: protectedProcedure");
    expect(responseRouter).toContain("eq(jobs.userId, ctx.user.id)");
    expect(responseRouter).toContain("eq(assetInspectionResponses.userId, ctx.user.id)");
    expect(responseRouter).toContain("eq(customerAssets.userId, ctx.user.id)");
    expect(responseRouter).toContain("eq(customerAssets.clientId, job.clientId)");
    expect(responseRouter).toContain("job.customerAssetId !== input.customerAssetId");
    expect(responseRouter).toContain("eq(assetInspectionTemplates.userId, ctx.user.id)");
    expect(responseRouter).toContain("eq(assetInspectionTemplates.active, true)");
    expect(responseRouter).toContain("userId: ctx.user.id");
  });

  it("validates template field IDs, prevents duplicate answers, enforces required fields, canonicalizes answer order, and snapshots the source fields", () => {
    const router = source("server/routers.ts");
    const responseRouter = router.slice(router.indexOf("assetInspectionResponses: router({"), router.indexOf("// ── Invoices"));
    expect(responseRouter).toContain("JSON.parse(template.fields)");
    expect(responseRouter).toContain("templateFieldSchema.parse");
    expect(responseRouter).toContain("submittedValues.has(response.fieldId)");
    expect(responseRouter).toContain("templateFields.some(field => field.id === response.fieldId)");
    expect(responseRouter).toContain("field.required && !submittedValues.get(field.id)?.trim()");
    expect(responseRouter).toContain("const normalizedResponses = templateFields");
    expect(responseRouter).toContain("templateFields: JSON.stringify(templateFields)");
    expect(responseRouter).toContain("templateVersion: template.version");
  });

  it("renders response entry and history only in the protected Job Workspace and keeps it out of public client portal slices", () => {
    const router = source("server/routers.ts");
    const workspace = source("client/src/pages/JobWorkspace.tsx");
    const portalStart = router.indexOf("getJobs: publicProcedure");
    const portalEnd = router.indexOf("// ── Contracts", portalStart);
    const portalRouter = router.slice(portalStart, portalEnd);
    expect(portalRouter).not.toContain("assetInspectionResponses");
    expect(workspace).toContain("trpc.assetInspectionResponses.listForJob.useQuery");
    expect(workspace).toContain("trpc.assetInspectionResponses.create.useMutation");
    expect(workspace).toContain("Job inspection responses");
    expect(workspace).toContain("never appear in the client portal");
    expect(workspace).toContain("Link a private customer asset to this job before recording an inspection response.");
  });
});
