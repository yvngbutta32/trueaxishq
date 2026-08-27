import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const source = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("private customer-asset service history", () => {
  it("uses a protected asset-owned entry point and only returns same-owner, same-client asset-linked jobs", () => {
    const router = source("server/routers.ts");
    const assetRouter = router.slice(router.indexOf("customerAssets: router({"), router.indexOf("// ── Asset Inspection Templates"));
    expect(assetRouter).toContain("serviceHistory: protectedProcedure");
    expect(assetRouter).toContain("eq(customerAssets.id, input.assetId)");
    expect(assetRouter).toContain("eq(customerAssets.userId, ctx.user.id)");
    expect(assetRouter).toContain("eq(jobs.userId, ctx.user.id)");
    expect(assetRouter).toContain("eq(jobs.clientId, asset.clientId)");
    expect(assetRouter).toContain("eq(jobs.customerAssetId, asset.id)");
  });

  it("counts only private inspection-response records and omits response payloads from history entries", () => {
    const router = source("server/routers.ts");
    const assetRouter = router.slice(router.indexOf("customerAssets: router({"), router.indexOf("// ── Asset Inspection Templates"));
    expect(assetRouter).toContain("eq(assetInspectionResponses.userId, ctx.user.id)");
    expect(assetRouter).toContain("eq(assetInspectionResponses.clientId, asset.clientId)");
    expect(assetRouter).toContain("eq(assetInspectionResponses.customerAssetId, asset.id)");
    expect(assetRouter).toContain("inspectionResponseCount: countByJob.get(job.id) ?? 0");
    expect(assetRouter).not.toContain("responses: assetInspectionResponses.responses");
    expect(assetRouter).not.toContain("templateFields: assetInspectionResponses.templateFields");
  });

  it("keeps the history in private Job Workspace context and out of client portal routes", () => {
    const router = source("server/routers.ts");
    const workspace = source("client/src/pages/JobWorkspace.tsx");
    const portalStart = router.indexOf("getJobs: publicProcedure");
    const portalEnd = router.indexOf("// ── Contracts", portalStart);
    const portalRouter = router.slice(portalStart, portalEnd);
    expect(workspace).toContain("trpc.customerAssets.serviceHistory.useQuery");
    expect(workspace).toContain("Private service history");
    expect(workspace).toContain("not maintenance, inventory, warranty, sensor, or client-portal data");
    expect(portalRouter).not.toContain("serviceHistory");
    expect(portalRouter).not.toContain("assetInspectionResponses");
  });
});
