import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const source = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("private asset inspection template foundation", () => {
  it("persists a bounded owner-scoped template model separate from assets and portal records", () => {
    const schema = source("drizzle/schema.ts");
    expect(schema).toContain('assetInspectionTemplates = mysqlTable("assetInspectionTemplates"');
    expect(schema).toContain('index("assetInspectionTemplates_owner_active_idx").on(t.userId, t.active)');
    expect(schema).toContain('fields: text("fields").notNull()');
  });

  it("uses protected owner-scoped procedures and excludes templates from public client routes", () => {
    const router = source("server/routers.ts");
    const workspace = source("client/src/pages/JobWorkspace.tsx");
    const inspectionRouter = router.slice(router.indexOf("assetInspectionTemplates: router({"), router.indexOf("// ── Invoices"));
    const portalStart = router.indexOf("getJobs: publicProcedure");
    const portalEnd = router.indexOf("// ── Contracts", portalStart);
    const portalRouter = router.slice(portalStart, portalEnd);
    expect(inspectionRouter).toContain("list: protectedProcedure");
    expect(inspectionRouter).toContain("eq(assetInspectionTemplates.userId, ctx.user.id)");
    expect(inspectionRouter).toContain("userId: ctx.user.id");
    expect(inspectionRouter).toContain("setActive: protectedProcedure");
    expect(portalRouter).not.toContain("assetInspectionTemplates");
    expect(workspace).toContain("trpc.assetInspectionTemplates.list.useQuery");
    expect(workspace).toContain("trpc.assetInspectionTemplates.create.useMutation");
    expect(workspace).toContain("Inspection templates");
    expect(workspace).toContain("never appear in the client portal");
  });
});
