import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const ownerSource = readFileSync(resolve(root, "client/src/pages/Proposals.tsx"), "utf8");

describe("editable duplicated proposal drafts", () => {
  it("allows protected draft updates including standard and package content while retaining the signed-record guard", () => {
    const proposalRouter = routerSource.slice(routerSource.indexOf("proposals: router({"), routerSource.indexOf("  // ── Workflow Automations"));
    const updateSection = proposalRouter.slice(proposalRouter.indexOf("update: protectedProcedure"), proposalRouter.indexOf("send: protectedProcedure"));
    expect(updateSection).toContain("packageOptions: z.array(proposalPackageSchema).max(3).optional()");
    expect(updateSection).toContain("Signed proposals cannot be edited.");
    expect(updateSection).toContain("eq(proposals.userId, ctx.user.id)");
    expect(updateSection).toContain("updates.packageOptions = normalizedPackages ? JSON.stringify(normalizedPackages) : null");
    expect(updateSection).toContain("updates.total = String(Number(existing.subtotal) * (1 + taxRate / 100))");
  });

  it("loads draft fields into the existing composer and preserves duplicate-clearing behavior before sharing", () => {
    expect(ownerSource).toContain("function openEditProposal");
    expect(ownerSource).toContain("setEditingId(proposal.id)");
    expect(ownerSource).toContain("trpc.proposals.update.useMutation");
    expect(ownerSource).toContain("Edit Proposal Draft");
    expect(ownerSource).toContain("Save Draft");
    expect(ownerSource).toContain("validUntil: form.validUntil || null");
    expect(ownerSource).toContain("Draft copy created without client or sharing details.");
  });

  it("keeps the duplicate source contract free of copied client or decision values", () => {
    const proposalsStart = routerSource.indexOf("proposals: router({");
    const duplicateStart = routerSource.indexOf("duplicate: protectedProcedure", proposalsStart);
    const duplicateSection = routerSource.slice(duplicateStart, routerSource.indexOf("update: protectedProcedure", duplicateStart));
    expect(duplicateSection).toContain('clientName: ""');
    expect(duplicateSection).not.toContain("signatureName: source.signatureName");
    expect(duplicateSection).not.toContain("declineReason: source.declineReason");
    expect(duplicateSection).not.toContain("validUntil: source.validUntil");
  });
});
