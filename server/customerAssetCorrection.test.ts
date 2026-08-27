import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const router = fs.readFileSync(path.join(root, "server/routers.ts"), "utf8");
const workspace = fs.readFileSync(path.join(root, "client/src/pages/JobWorkspace.tsx"), "utf8");
const portal = fs.readFileSync(path.join(root, "client/src/pages/ClientPortal.tsx"), "utf8");

describe("private customer-asset correction", () => {
  it("updates only bounded current asset fields behind a final owner predicate", () => {
    const assetStart = router.indexOf("customerAssets: router({");
    const assetEnd = router.indexOf("assetInspectionTemplates: router({", assetStart);
    const assetRouter = router.slice(assetStart, assetEnd);
    const updateStart = assetRouter.indexOf("update: protectedProcedure");
    const updateEnd = assetRouter.indexOf("setActive: protectedProcedure", updateStart);
    const updateMutation = assetRouter.slice(updateStart, updateEnd);

    expect(updateMutation).toContain('id: z.number().int().positive(), name: safeString(255), assetTag: safeOptionalString(128), functionalLocation: safeOptionalString(255), notes: safeOptionalString(2000)');
    expect(updateMutation).toContain("eq(customerAssets.id, input.id), eq(customerAssets.userId, ctx.user.id)");
    expect(updateMutation).toContain("assetTag: input.assetTag || null");
    expect(updateMutation).toContain("functionalLocation: input.functionalLocation || null");
    expect(updateMutation).toContain("notes: input.notes || null");
    expect(updateMutation).not.toContain("clientId: input.clientId");
    expect(updateMutation).not.toContain("set({ clientId");
  });

  it("keeps the correction form private, clear about immutable associations, and absent from the portal", () => {
    expect(workspace).toContain("Correct private asset details");
    expect(workspace).toContain("Client association and existing job or inspection history are not changed.");
    expect(workspace).toContain("Save private details");
    expect(workspace).toContain("Private note");
    expect(portal).not.toContain("Correct private asset details");
    expect(portal).not.toContain("Save private details");
  });
});
