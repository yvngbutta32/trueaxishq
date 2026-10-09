import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PLANS, PLAN_LIST, VOICE_LINE_MINUTES, SMS_INCLUDED_MONTHLY, SUB_ACCOUNT_LIMITS,
  PRO_FEATURES, planUnlocksProFeature, FEATURE_MIN_PLAN,
} from "../shared/plans";

const source = (rel: string) => readFileSync(resolve(import.meta.dirname, rel), "utf8");

// Every price-card claim must be true in the product: enforced by a gate,
// metered by an allowance, or shipped in the client. This suite exists so a
// feature string can never drift back to vaporware (Oct 2026 audit found the
// Agency card advertising sub-accounts, white-label, SLA support, custom AI
// training and revenue sharing — none of which shipped).
describe("tier truth-in-advertising (price cards match shipped reality)", () => {
  const starterCard = PLANS.starter.features.join(" ");
  const proCard = PLANS.pro.features.join(" ");
  const agencyCard = PLANS.agency.features.join(" ");
  const allCards = PLAN_LIST.map(p => p.features.join(" ")).join(" ");

  it("Starter's flagship claim is real: live tracking is Starter-gated, not Pro", () => {
    expect(starterCard).toContain("Live 'on my way' client tracking");
    expect(FEATURE_MIN_PLAN.liveTracking).toBe("starter");
    expect(planUnlocksProFeature("starter", "liveTracking")).toBe(true);
    expect(planUnlocksProFeature("free", "liveTracking")).toBe(false);
    expect(planUnlocksProFeature("pro", "liveTracking")).toBe(true);
  });

  it("bundled allowances on the cards match the enforced code constants", () => {
    expect(starterCard).toContain("500 bundled SMS");
    expect(SMS_INCLUDED_MONTHLY.starter).toBe(500);
    expect(proCard).toContain("2,000 bundled SMS");
    expect(SMS_INCLUDED_MONTHLY.pro).toBe(2000);
    expect(agencyCard).toContain("5,000 bundled SMS");
    expect(SMS_INCLUDED_MONTHLY.agency).toBe(5000);
    expect(starterCard).toContain("300 bundled voice minutes");
    expect(VOICE_LINE_MINUTES.starter).toBe(300);
    expect(proCard).toContain("1,000 bundled minutes"); // minutes ride the voice receptionist line
    expect(VOICE_LINE_MINUTES.pro).toBe(1000);
    expect(agencyCard).toContain("2,500 bundled voice minutes");
    expect(VOICE_LINE_MINUTES.agency).toBe(2500);
  });

  it("every Pro-gated feature is advertised on the Pro card — no silent upsells", () => {
    // the $129 card must tell buyers what the tier actually unlocks
    for (const marker of [
      /route planning/i, /capacity forecast/i, /price book/i, /custom report/i,
      /subcontractor/i, /webhook/i, /REST API/i, /voice receptionist/i,
    ]) expect(proCard).toMatch(marker);
  });

  it("no tier advertises anything the product does not ship", () => {
    const vaporware = [
      "Shared client database", "lead scoring", "Dedicated account manager",
      "SLA", "Custom AI training", "Revenue sharing", "Custom integrations",
      "Up to 20", "(5/month)", "Unlimited active clients",
    ];
    for (const claim of vaporware) {
      expect(allCards).not.toContain(claim);
    }
  });

  it("Agency's sub-account claim is shipped: gated, capped, and isolated (not vaporware)", () => {
    expect(agencyCard).toContain("Up to 10 managed client workspaces (sub-accounts)");
    expect(SUB_ACCOUNT_LIMITS.agency).toBe(10);
    expect(FEATURE_MIN_PLAN.subAccounts).toBe("agency");
    expect(planUnlocksProFeature("pro", "subAccounts")).toBe(false); // Pro cannot create subs
    expect(planUnlocksProFeature("agency", "subAccounts")).toBe(true);
    const routers = source("./routers.ts");
    expect(routers).toContain("agencyRouter = router({");
    for (const op of ["listSubAccounts", "createSubAccount", "setSubAccountStatus", "resetSubAccountPassword"]) {
      const at = routers.indexOf(`${op}: protectedProcedure`);
      expect(at).toBeGreaterThan(-1);
      expect(routers.slice(at, at + 400)).toContain('requirePlanFeature(db, ctx.user.id, "subAccounts")');
    }
  });

  it("Agency's white-label claim is shipped: the public booking page strips TrueAxis branding", () => {
    expect(agencyCard).toContain("White-label booking pages");
    const t0 = source("./routers.ts").indexOf("getPage: publicProcedure");
    const pageBlock = source("./routers.ts").slice(t0, t0 + 3000);
    expect(pageBlock).toContain('whiteLabel = (hostPlanId ?? "").trim().toLowerCase() === "agency"');
    // planId itself never leaves the server
    expect(pageBlock).toContain("const { planId: hostPlanId, ...host } = result[0];");
    const page = source("../client/src/pages/BookingPage.tsx");
    expect(page).toContain("const whiteLabel = pageQuery.data?.whiteLabel === true;");
    expect(page).toContain("whiteLabel ? \"\" : \" — TrueAxis HQ\""); // document.title
    expect(page).toMatch(/whiteLabel\n\s*\? <span/); // header logo branches on it
  });
});
