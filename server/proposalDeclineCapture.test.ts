import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const ownerSource = readFileSync(resolve(root, "client/src/pages/Proposals.tsx"), "utf8");
const publicSource = readFileSync(resolve(root, "client/src/pages/ProposalSign.tsx"), "utf8");

describe("token-scoped proposal decline capture", () => {
  it("records only a bounded optional reason under the supplied token and blocks final-state conflicts", () => {
    const proposalRouter = routerSource.slice(routerSource.indexOf("proposals: router({"), routerSource.indexOf("  // ── Workflow Automations"));
    expect(proposalRouter).toContain("decline: publicProcedure");
    expect(proposalRouter).toContain("reason: z.string().trim().max(1000).optional()");
    expect(proposalRouter).toContain("eq(proposals.token, input.token)");
    expect(proposalRouter).toContain("This proposal has already been signed.");
    expect(proposalRouter).toContain("This proposal has already been declined.");
    expect(proposalRouter).toContain("This proposal is no longer available for a decision.");
  });

  it("redacts the decline note from public proposal reads while retaining owner-only workspace access", () => {
    expect(routerSource).toContain("const { declineReason: _declineReason, ...publicProposal } = row;");
    expect(routerSource).toContain("return { ...publicProposal, continuation };");
    expect(ownerSource).toContain('p.status === "declined" && p.declineReason');
    expect(publicSource).toContain("trpc.proposals.decline.useMutation");
    expect(publicSource).toContain("optional note is shared only with the proposal owner");
  });

  it("does not add an automatic follow-up, email, SMS, or client-portal disclosure path", () => {
    const declineSection = routerSource.slice(routerSource.indexOf("decline: publicProcedure"), routerSource.indexOf("convertToInvoice: protectedProcedure"));
    expect(declineSection).not.toContain("sendEmail");
    expect(declineSection).not.toContain("notifyOwner");
    expect(publicSource).not.toContain("trpc.followUps.create");
  });
});
