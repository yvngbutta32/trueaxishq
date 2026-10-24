import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PLAN_LIST, type PlanId } from "../shared/plans";
import { QBO_PAYING_PLANS, QBO_SYNC_DEMAND_THRESHOLD } from "../shared/qboDemandGate";

const root = resolve(import.meta.dirname, "..");
const schemaSource = readFileSync(resolve(root, "drizzle/schema.ts"), "utf8");
const migrationSource = readFileSync(resolve(root, "drizzle/0088_qbo_sync_request.sql"), "utf8");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const catalogSource = readFileSync(resolve(root, "shared/integrationCatalog.ts"), "utf8");
const hubSource = readFileSync(resolve(root, "client/src/pages/IntegrationHub.tsx"), "utf8");
const integrations = routerSource.slice(routerSource.indexOf("integrations: router({"), routerSource.indexOf("// ── Unified Job Workspace"));

describe("QBO sync demand gate (deliberately deferred until demand is proven)", () => {
  it("pins the threshold from the dominance research: 10 paying companies", () => {
    expect(QBO_SYNC_DEMAND_THRESHOLD).toBe(10);
  });

  it("derives paying plans from the sold ladder so the gate can never drift", () => {
    expect(QBO_PAYING_PLANS).toEqual(PLAN_LIST.map(plan => plan.id));
    expect(new Set(QBO_PAYING_PLANS as readonly PlanId[]).size).toBeGreaterThan(0);
    expect((QBO_PAYING_PLANS as readonly string[])).not.toContain("free");
    expect((QBO_PAYING_PLANS as readonly string[])).not.toContain("unknown");
  });

  it("stores one request per company with the plan snapshotted at request time", () => {
    expect(schemaSource).toContain("export const qboSyncRequests = mysqlTable");
    expect(schemaSource).toContain('uniqueIndex("qboSyncRequests_userId_unique_idx").on(t.userId)');
    expect(schemaSource).toContain('index("qboSyncRequests_plan_idx").on(t.planId)');
    expect(migrationSource).toContain("UNIQUE KEY `qboSyncRequests_userId_unique_idx` (`userId`)");
  });

  it("makes the request idempotent and scoped to the signed-in company", () => {
    const proc = integrations.slice(integrations.indexOf("requestQuickBooksSync: protectedProcedure"), integrations.indexOf("quickBooksSyncDemand: protectedProcedure"));
    expect(proc).toContain("eq(qboSyncRequests.userId, ctx.user.id)");
    expect(proc).toContain("alreadyRequested: true as const");
    expect(proc).toContain("planId: ctx.user.planId ?? \"unknown\"");
  });

  it("exposes honest counts only — never who asked", () => {
    const proc = integrations.slice(integrations.indexOf("quickBooksSyncDemand: protectedProcedure"), integrations.indexOf("prepare: protectedProcedure"));
    expect(proc).toContain("threshold: QBO_SYNC_DEMAND_THRESHOLD");
    expect(proc).toContain("payingRequests");
    expect(proc).toContain("myRequest");
    expect(proc).not.toContain("businessName");
  });

  it("counts only sold-ladder plans as paying demand", () => {
    const proc = integrations.slice(integrations.indexOf("quickBooksSyncDemand: protectedProcedure"), integrations.indexOf("prepare: protectedProcedure"));
    expect(proc).toContain("(QBO_PAYING_PLANS as readonly string[]).includes(row.planId)");
  });

  it("tells the truth in the catalog: CSV works today, native sync is demand-gated", () => {
    const entry = catalogSource.slice(catalogSource.indexOf("quickbooks: {"), catalogSource.indexOf("gmail: {"));
    expect(entry).toContain("CSV exports work today");
    expect(entry).toContain("10+ paying companies");
    expect(entry).not.toMatch(/two-way sync (is )?(live|available|connected)/);
  });

  it("shows the demand counter and request action in the Integration Hub", () => {
    expect(hubSource).toContain("quickBooksSyncDemand");
    expect(hubSource).toContain("Request native sync");
    expect(hubSource).toContain("Sync requested — counted");
    expect(hubSource).toContain("Invoices → Accounting export");
  });
});
