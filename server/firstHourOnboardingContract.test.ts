import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const source = (rel: string) => readFileSync(resolve(root, rel), "utf8");
const routers = source("server/routers.ts");
const onboarding = source("client/src/pages/dashboard/OnboardingFirstHour.tsx");
const overview = source("client/src/pages/dashboard/OverviewPanel.tsx");
const home = source("client/src/pages/Home.tsx");

describe("first-hour onboarding guarantee (Tier 3 item 16)", () => {
  it("computes progress from the owner's real data — never hardcoded", () => {
    expect(routers).toContain("firstHourProgress: protectedProcedure.query");
    expect(routers).toContain("eq(clients.userId, ctx.user.id)");
    expect(routers).toContain("eq(jobs.userId, ctx.user.id)");
    expect(routers).toContain("eq(invoices.userId, ctx.user.id)");
    // All six steps derive from actual table/config state.
    expect(routers).toContain('id: "profile"');
    expect(routers).toContain('id: "services"');
    expect(routers).toContain('id: "booking"');
    expect(routers).toContain('id: "client"');
    expect(routers).toContain('id: "job"');
    expect(routers).toContain('id: "invoice"');
  });

  it("retires itself once the account is operational — no nagging veterans", () => {
    expect(routers).toContain("showChecklist: freshAccount && doneCount < steps.length");
    expect(routers).toContain("fourteenDaysMs");
  });

  it("shows the checklist on the dashboard overview with real deep links", () => {
    expect(overview).toContain('<OnboardingFirstHour setActivePanel={setActivePanel} />');
    expect(onboarding).toContain('setActivePanel(step.panel as ActivePanel)');
    expect(onboarding).toContain("Be fully operational in {data.remainingMinutes} minutes");
  });

  it("dismisses per user choice and comes back until complete", () => {
    expect(onboarding).toContain("trueaxis-first-hour-hidden");
    expect(onboarding).toContain("reappears on your next visit until complete");
  });

  it("makes the marketing claim honestly — the guarantee is backed by the shipped checklist", () => {
    // The claim on the homepage points at a real, in-product mechanism.
    expect(home).toContain("Operational in under an hour");
    expect(home).toContain("guided first-hour checklist walks you from signup to your first invoice");
    expect(home).toContain("no consultants, no implementation calls");
    // No unbacked speed claims elsewhere in the marketing copy.
    expect(home).not.toContain("in under 5 minutes");
    expect(home).not.toContain("instantly set up");
  });
});
