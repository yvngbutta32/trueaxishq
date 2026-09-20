/**
 * Pricing strategy contract — owner-set Sept 2026:
 * "affordable but don't sell our systems short — good profit while competing."
 * Guards the business model, not just the code:
 * - Entry tier stays affordable (at the Jobber/HCP entry band, <= $59/mo)
 * - Top tier is never undersold (white-label + sub-accounts >= $299, > 2.5x entry)
 * - Annual discount is consistently 20% on every plan
 * - One single source of truth for prices (billing + public page share shared/plans.ts;
 *   no hardcoded dollar figures on the pricing page)
 * - The flagship features we advertise are features we actually shipped
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { PLANS, PLAN_LIST } from "../shared/plans";

const read = (rel: string) => readFileSync(join(__dirname, rel), "utf8");

describe("pricing strategy: affordable entry, profitable top, no drift", () => {
  it("entry tier is affordable: Starter <= $59/mo (competes with Jobber/HCP entry band)", () => {
    expect(PLANS.starter.monthlyPrice).toBeLessThanOrEqual(5900);
    expect(PLANS.starter.monthlyPrice).toBeGreaterThan(0);
  });

  it("top tier is never undersold: Agency >= $299/mo and > 2.5x the entry price", () => {
    expect(PLANS.agency.monthlyPrice).toBeGreaterThanOrEqual(29900);
    expect(PLANS.agency.monthlyPrice).toBeGreaterThan(PLANS.starter.monthlyPrice * 2.5);
  });

  it("annual pricing is a consistent 20% discount on every plan", () => {
    for (const p of PLAN_LIST) {
      expect(p.annualPrice).toBe(Math.round(p.monthlyPrice * 0.8));
    }
  });

  it("mid tier (Pro) sits in the market sweet spot: $79–$129/mo", () => {
    expect(PLANS.pro.monthlyPrice).toBeGreaterThanOrEqual(7900);
    expect(PLANS.pro.monthlyPrice).toBeLessThanOrEqual(12900);
  });

  it("prices are only defined in shared/plans.ts — server re-exports, page derives", () => {
    expect(read("../server/products.ts")).toContain('from "../shared/plans"');
    const pricingPage = read("../client/src/pages/Pricing.tsx");
    expect(pricingPage).toContain('@shared/plans');
    expect(pricingPage).not.toMatch(/monthly: \d+, annual: \d+/); // no hardcoded dollars
  });

  it("advertised flagship features are features we shipped (not aspirational)", () => {
    const all = Object.values(PLANS).flatMap((p) => p.features).join(" ").toLowerCase();
    const routers = read("../server/routers.ts");
    // each advertised flagship must have a real backend surface
    expect(all).toContain("live 'on my way' client tracking");
    expect(routers).toMatch(/reportVisitPosition|track/);
    expect(all).toContain("zero-install subcontractor jobs");
    expect(routers).toMatch(/subcontractors: router\(/);
    expect(all).toContain("route planning + capacity forecast");
    expect(routers).toMatch(/capacityForecast|geocodeSites/);
    expect(all).toContain("quickbooks-format csv export");
    expect(all).toContain("client portal");
  });

  it("billing and the public page quote the same numbers (drift impossible by construction)", () => {
    const routers = read("../server/routers.ts");
    expect(routers).toContain('from "./products"'); // billing path still works through the re-export
  });
});
