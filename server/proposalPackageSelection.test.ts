import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getProposalPackageSubtotal, normalizeProposalLineItems, parseProposalPackages } from "../shared/proposalPackages";

const root = resolve(import.meta.dirname, "..");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const ownerSource = readFileSync(resolve(root, "client/src/pages/Proposals.tsx"), "utf8");
const publicSource = readFileSync(resolve(root, "client/src/pages/ProposalSign.tsx"), "utf8");

const packageJson = JSON.stringify([{ id: "good", name: "Good", description: "Core", lineItems: [{ id: "line-1", name: "Service", qty: 2, unitPrice: 125, total: 1 }] }]);

describe("token-scoped proposal package selection", () => {
  it("parses only well-formed packages and derives line totals rather than trusting client totals", () => {
    const packages = parseProposalPackages(packageJson);
    expect(packages).toHaveLength(1);
    expect(packages[0].lineItems[0].total).toBe(250);
    expect(getProposalPackageSubtotal(packages[0])).toBe(250);
    expect(normalizeProposalLineItems([{ id: "x", name: "X", qty: 1.5, unitPrice: 10, total: 999 }])[0].total).toBe(15);
    expect(parseProposalPackages(JSON.stringify([{ id: "bad", name: "Bad", lineItems: [] }]))).toEqual([]);
  });

  it("uses a token-bound selected option at signing and stores the final selection immutably", () => {
    const proposalRouter = routerSource.slice(routerSource.indexOf("proposals: router({"), routerSource.indexOf("  // ── Workflow Automations"));
    expect(proposalRouter).toContain("selectedPackageId: z.string().min(1).max(64).optional()");
    expect(proposalRouter).toContain("parseProposalPackages(row.packageOptions)");
    expect(proposalRouter).toContain("option.id === input.selectedPackageId");
    expect(proposalRouter).toContain("selectedPackage: JSON.stringify(selectedPackage)");
    expect(proposalRouter).toContain("eq(proposals.token, input.token)");
    expect(proposalRouter).toContain("eq(proposals.status, row.status)");
    expect(proposalRouter).toContain("Signed proposals cannot be edited.");
  });

  it("requires package signature before converting a package proposal and keeps client choice bounded", () => {
    expect(routerSource).toContain("A package proposal can only be converted after the client signs a selected option.");
    expect(routerSource).toContain("The signed proposal does not include a package selection.");
    expect(ownerSource).toContain("Client-selectable packages");
    expect(ownerSource).toContain("form.packageOptions.length < 3");
    expect(publicSource).toContain("Choose your proposal option");
    expect(publicSource).toContain("selectedPackageId: selectedPackageId ?? undefined");
    expect(publicSource).toContain("proposalPackages.length > 0 && !selectedPackageId");
    expect(publicSource).not.toContain("trpc.invoices.create");
  });
});
