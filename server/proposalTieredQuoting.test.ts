import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseProposalPackages } from "../shared/proposalPackages";

const root = resolve(import.meta.dirname, "..");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const ownerSource = readFileSync(resolve(root, "client/src/pages/Proposals.tsx"), "utf8");
const publicSource = readFileSync(resolve(root, "client/src/pages/ProposalSign.tsx"), "utf8");

describe("tiered Good/Better/Best proposal quoting", () => {
  it("parses the recommended flag defensively and drops non-boolean values", () => {
    const packages = parseProposalPackages(JSON.stringify([
      { id: "good", name: "Good", recommended: "yes", lineItems: [{ id: "l1", name: "Base", qty: 1, unitPrice: 100, total: 100 }] },
      { id: "best", name: "Best", recommended: true, lineItems: [{ id: "l2", name: "Premium", qty: 1, unitPrice: 250, total: 250 }] },
    ]));
    expect(packages).toHaveLength(2);
    expect(packages.find(option => option.id === "good")?.recommended).toBeUndefined();
    expect(packages.find(option => option.id === "best")?.recommended).toBe(true);
  });

  it("accepts the recommended flag on create and update package payloads", () => {
    const schemaStart = routerSource.indexOf("const proposalPackageSchema");
    const schema = routerSource.slice(schemaStart, routerSource.indexOf("});", schemaStart) + 3);
    expect(schema).toContain("recommended: z.boolean().optional()");
  });

  it("renders tier labels and the recommended badge on the client-facing proposal", () => {
    expect(publicSource).toContain('"Good"');
    expect(publicSource).toContain('"Best"');
    expect(publicSource).toContain('"Better"');
    expect(publicSource).toContain("Recommended</span>");
    expect(publicSource).toContain("aria-label={`${option.name}");
  });

  it("derives the pre-selected recommended option without a late hook, keeping sign and render on one selection source", () => {
    expect(publicSource).toContain("const effectiveSelectedPackageId = selectedPackageId ?? recommendedPackageId;");
    expect(publicSource).toContain("selectedPackageId: effectiveSelectedPackageId ?? undefined");
    expect(publicSource).toContain("effectiveSelectedPackageId === option.id");
    // Rules-of-hooks: ProposalSign early-returns on loading/error, so any
    // useEffect below those returns crashes the public page. Derived state
    // replaces the effect; this regression is also asserted by the eslint
    // react-hooks gate added alongside this fix.
    expect(publicSource).not.toContain("useEffect(");
  });

  it("lets the owner mark exactly one option as recommended", () => {
    expect(ownerSource).toContain("Mark as recommended for the client");
    expect(ownerSource).toContain("item.id !== option.id ? { ...item, recommended: undefined } : item");
  });
});

describe("owner price book", () => {
  const priceBookRouter = routerSource.slice(routerSource.indexOf("  priceBook: router({"), routerSource.indexOf("  tags: router({"));

  it("scopes every price book operation to the requesting owner", () => {
    const matches = priceBookRouter.match(/eq\(priceBookItems\.userId, ctx\.user\.id\)/g) ?? [];
    expect(matches.length).toBe(3);
    expect(priceBookRouter).toContain(".where(eq(priceBookItems.userId, ctx.user.id))");
    expect(priceBookRouter).toContain("userId: ctx.user.id");
    expect(priceBookRouter).toContain("eq(priceBookItems.id, input.id), eq(priceBookItems.userId, ctx.user.id)");
  });

  it("validates catalog item names, categories, units, and price bounds", () => {
    expect(priceBookRouter).toContain('name: z.string().trim().min(1).max(255)');
    expect(priceBookRouter).toContain('z.enum(["job", "hour", "day", "sq_ft", "linear_ft", "each", "month", "visit"])');
    expect(priceBookRouter).toContain("z.number().min(0).max(10_000_000)");
  });

  it("rejects no-op updates and unknown-item deletions", () => {
    expect(priceBookRouter).toContain("No changes provided.");
    expect(priceBookRouter).toContain('code: "NOT_FOUND"');
  });

  it("offers price book insertion from the proposal builder", () => {
    expect(ownerSource).toContain("Price book");
    expect(ownerSource).toContain("insertFromPriceBook");
    expect(ownerSource).toContain("trpc.priceBook.list.useQuery");
  });
});
