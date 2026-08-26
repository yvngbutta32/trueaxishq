import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isProposalExpired } from "../shared/proposalValidity";

const root = resolve(import.meta.dirname, "..");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const ownerSource = readFileSync(resolve(root, "client/src/pages/Proposals.tsx"), "utf8");

describe("proposal validity-date enforcement", () => {
  it("keeps no-date proposals active and expires only after the final UTC millisecond", () => {
    expect(isProposalExpired(null, new Date("2026-08-26T00:00:00.000Z"))).toBe(false);
    expect(isProposalExpired("2026-08-26", new Date("2026-08-26T23:59:59.999Z"))).toBe(false);
    expect(isProposalExpired("2026-08-26", new Date("2026-08-27T00:00:00.000Z"))).toBe(true);
    expect(isProposalExpired("invalid", new Date("2026-08-26T00:00:00.000Z"))).toBe(true);
  });

  it("enforces the existing date on token-scoped viewing and signing with no public record disclosure", () => {
    const proposalRouter = routerSource.slice(routerSource.indexOf("proposals: router({"), routerSource.indexOf("  // ── Workflow Automations"));
    expect(proposalRouter).toContain("if (isProposalExpired(row.validUntil)) throw new TRPCError({ code: \"NOT_FOUND\", message: \"Proposal not found or link has expired.\" })");
    expect(proposalRouter).toContain("This proposal is no longer available for signature.");
    expect(ownerSource).toContain("available through the end of this UTC date");
  });
});
