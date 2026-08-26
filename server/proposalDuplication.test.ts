import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const ownerSource = readFileSync(resolve(root, "client/src/pages/Proposals.tsx"), "utf8");

describe("owner-safe proposal duplication", () => {
  it("restricts the source proposal to its owning workspace and creates a fresh draft token", () => {
    const proposalRouter = routerSource.slice(routerSource.indexOf("proposals: router({"), routerSource.indexOf("  // ── Workflow Automations"));
    const duplicateSection = proposalRouter.slice(proposalRouter.indexOf("duplicate: protectedProcedure"), proposalRouter.indexOf("update: protectedProcedure"));
    expect(duplicateSection).toContain("duplicate: protectedProcedure");
    expect(duplicateSection).toContain("eq(proposals.userId, ctx.user.id)");
    expect(duplicateSection).toContain("crypto.randomBytes(32).toString(\"hex\")");
    expect(duplicateSection).toContain('status: "draft"');
    expect(duplicateSection).toContain("Proposal not found.");
  });

  it("copies only reusable commercial fields and deliberately clears client and decision state", () => {
    const proposalRouter = routerSource.slice(routerSource.indexOf("proposals: router({"), routerSource.indexOf("  // ── Workflow Automations"));
    const duplicateSection = proposalRouter.slice(proposalRouter.indexOf("duplicate: protectedProcedure"), proposalRouter.indexOf("update: protectedProcedure"));
    expect(duplicateSection).toContain("clientId: null");
    expect(duplicateSection).toContain('clientName: ""');
    expect(duplicateSection).toContain("clientEmail: null");
    expect(duplicateSection).toContain("packageOptions: source.packageOptions");
    expect(duplicateSection).not.toContain("validUntil: source.validUntil");
    expect(duplicateSection).not.toContain("signedAt: source.signedAt");
    expect(duplicateSection).not.toContain("linkedInvoiceId: source.linkedInvoiceId");
    expect(duplicateSection).not.toContain("declineReason: source.declineReason");
  });

  it("wires duplication only from the protected owner proposal list", () => {
    expect(ownerSource).toContain("trpc.proposals.duplicate.useMutation");
    expect(ownerSource).toContain("Duplicate as a fresh draft");
    expect(ownerSource).toContain("Draft copy created without client or sharing details.");
  });
});
