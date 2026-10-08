import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PRO_FEATURES, featureEntitlements, planUnlocksProFeature, PRO_FEATURE_LABELS } from "../shared/plans";

const source = (rel: string) => readFileSync(resolve(import.meta.dirname, rel), "utf8");

describe("plan-tier feature gating (Pro operating layer)", () => {
  it("free and Starter honestly keep every core tool; Pro/Agency unlock the advanced layer", () => {
    expect(featureEntitlements("free")).toEqual(Object.fromEntries(PRO_FEATURES.map(f => [f, false])));
    expect(featureEntitlements("starter")).toEqual(featureEntitlements("free"));
    for (const feature of PRO_FEATURES) {
      expect(planUnlocksProFeature("pro", feature)).toBe(true);
      expect(planUnlocksProFeature("agency", feature)).toBe(true);
    }
    // unknown/missing plan falls back to free, never to full access
    expect(planUnlocksProFeature(undefined, "webhooks")).toBe(false);
    expect(planUnlocksProFeature("PRO ", "webhooks")).toBe(true); // case/whitespace tolerant
  });

  it("every gated feature has an upgrade label (client lock cards render honestly)", () => {
    for (const feature of PRO_FEATURES) expect(PRO_FEATURE_LABELS[feature]).toBeTruthy();
  });

  it("every gated router enforces the feature server-side — client locks are UX only", () => {
    const routers = source("./routers.ts");
    const gates = routers.split('requirePlanFeature(db, ctx.user.id,').length - 1;
    expect(gates).toBe(31); // 28 + webhooks list/deliveries/processDue (Oct 8 2026)
    for (const feature of PRO_FEATURES) {
      expect(routers).toContain(`requirePlanFeature(db, ctx.user.id, "${feature}")`);
    }
    // core stays open to every plan — bookings, invoices, clients, proposals, portal
    const clientsCreate = routers.indexOf("clients: router({");
    const bookingsRouter = routers.indexOf("bookings: router({");
    expect(routers.slice(clientsCreate, clientsCreate + 4000)).not.toContain("requirePlanFeature");
    expect(routers.slice(bookingsRouter, bookingsRouter + 4000)).not.toContain("requirePlanFeature");
  });

  it("myEntitlements serves the single source of truth the client locks read", () => {
    const routers = source("./routers.ts");
    expect(routers).toContain("myEntitlements: protectedProcedure.query");
    expect(routers).toContain("return getEntitlements(db, ctx.user.id);");
  });

  it("terminal: connection tokens ride the FREELANCER's connected account, never the platform's", () => {
    const routers = source("./routers.ts");
    const t0 = routers.indexOf("const terminalRouter = router({");
    const block = routers.slice(t0, routers.indexOf("const appRouter"));
    expect(block).toContain("requireClientPaymentsAccount(ctx.user.id)");
    expect(block).toContain("stripe.terminal.connectionTokens.create({}, { stripeAccount: accountId })");
    expect(block).toContain("recordCardPresent");
    // card-present recording fires the same signed invoice.paid event as online payment
    expect(block).toContain('"app.invoice.paid"');
    // honest unconfigured state
    expect(block).toContain("Payments are not configured on this deployment");
  });

  it("client lock cards reflect the server gate — panels wrap in FeatureLock", () => {
    const lock = source("../client/src/components/FeatureLock.tsx");
    expect(lock).toContain("billing.myEntitlements");
    expect(source("../client/src/pages/WorkflowWebhooks.tsx")).toContain('FeatureLock feature="webhooks"');
    expect(source("../client/src/pages/dashboard/SubcontractorsPanel.tsx")).toContain('FeatureLock feature="subcontractors"');
    expect(source("../client/src/pages/IntegrationHub.tsx")).toContain("terminal.status.useQuery");
    // remaining surfaces added Oct 5 2026: every gated server feature now has an honest client affordance
    expect(source("../client/src/pages/dashboard/ReportsPanel.tsx")).toContain('FeatureLock feature="customReports"');
    expect(source("../client/src/pages/dashboard/SettingsPanel.tsx")).toContain('FeatureLock feature="restApi"');
    expect(source("../client/src/pages/dashboard/SchedulingPanel.tsx")).toContain('FeatureLock feature="capacityForecast"');
    expect(source("../client/src/pages/DispatchBoard.tsx")).toContain('FeatureLock feature="routeOptimizer"');
    expect(source("../client/src/pages/DispatchBoard.tsx")).toContain('useFeatureAllowed("liveTracking")');
    expect(source("../client/src/pages/Proposals.tsx")).toContain('useFeatureAllowed("priceBook")');
    // Oct 8 2026: webhooks read ops gated like create (was list/deliveries/processDue ungated)
    expect(source("./routers.ts")).toMatch(/webhooks: router\(\{[\s\S]{0,200}list: protectedProcedure\.query[\s\S]{0,120}requirePlanFeature\(db, ctx\.user\.id, "webhooks"\)/);
    expect(source("./routers.ts")).toMatch(/deliveries: protectedProcedure\.query[\s\S]{0,120}requirePlanFeature\(db, ctx\.user\.id, "webhooks"\)/);
    expect(source("./routers.ts")).toMatch(/processDue: protectedProcedure[\s\S]{0,300}requirePlanFeature\(db, ctx\.user\.id, "webhooks"\)/);
    // no stale "included in every plan" claim on a Pro-gated surface
    expect(source("../client/src/pages/dashboard/ReportsPanel.tsx")).not.toContain("Included in every plan");
  });
});
