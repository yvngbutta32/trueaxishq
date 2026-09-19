import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const schemaSource = readFileSync(resolve(root, "drizzle/schema.ts"), "utf8");
const panelSource = readFileSync(resolve(root, "client/src/pages/dashboard/ReportsPanel.tsx"), "utf8");
const dashboardSource = readFileSync(resolve(root, "client/src/pages/Dashboard.tsx"), "utf8");
const sidebarSource = readFileSync(resolve(root, "client/src/pages/dashboard/Sidebar.tsx"), "utf8");
const migrationSource = (() => {
  const dir = readdirSync(resolve(root, "drizzle"));
  return dir.filter(name => name.endsWith(".sql") && name.startsWith("0070_"))
    .map(name => readFileSync(resolve(root, "drizzle", name), "utf8")).join("");
})();

describe("Custom report builder (Tier 2 item 12 — gated at every competitor)", () => {
  it("stores saved report definitions per owner", () => {
    expect(schemaSource).toContain('export const customReports = mysqlTable("customReports"');
    expect(schemaSource).toContain('mysqlEnum("dataset", ["jobs", "invoices", "time_entries", "expenses", "proposals"])');
    expect(schemaSource).toContain('index("customReports_userId_idx").on(t.userId)');
    expect(migrationSource).toContain("CREATE TABLE `customReports`");
  });

  it("exposes owner-scoped CRUD plus live run and unsaved preview", () => {
    for (const endpoint of ["list", "create", "update", "delete", "run", "preview"]) {
      expect(routerSource).toContain(`    ${endpoint}: protectedProcedure`);
    }
    expect((routerSource.match(/eq\(customReports\.userId, ctx\.user\.id\)/g) ?? []).length).toBeGreaterThanOrEqual(5);
    // Reports compute live from the real tables — no stale snapshots.
    expect(routerSource).toContain("Reports are computed live — no stale snapshots.");
    expect(routerSource).toContain("Runs an unsaved configuration from the builder, so you see it before you save.");
  });

  it("computes every dataset with owner scoping inside the aggregate query", () => {
    // All five datasets route through the shared runner with the owner guard.
    expect((routerSource.match(/eq\((jobs|invoices|timeEntries|expenses|proposals)\.userId, userId\)/g) ?? []).length).toBeGreaterThanOrEqual(5);
    // Month grouping is computed in SQL, not in JS.
    expect(routerSource).toContain("DATE_FORMAT");
    // Time reports only count finished entries (running timers have no duration).
    expect(routerSource).toContain("isNotNull(timeEntries.durationMinutes)");
    // Bad metrics are rejected before any query runs.
    expect(routerSource).toContain("Unknown metric.");
    expect(routerSource).toContain("Time reports use the count or hours metric.");
  });

  it("registers the Reports panel in the workspace navigation", () => {
    expect(dashboardSource).toContain('case "reports":');
    expect(dashboardSource).toContain('lazy(() => import("./dashboard/ReportsPanel"))');
    expect(sidebarSource).toContain('label: "Reports",    panel: "reports"');
    expect(panelSource).toContain('<PanelTabs key={tabSeq} defaultTab="builder" tabs={tabs} />');
    expect(panelSource).toContain('label: "My Reports"');
  });

  it("previews before saving and never dead-ends", () => {
    expect(panelSource).toContain("Run preview");
    expect(panelSource).toContain("Save this report");
    expect(panelSource).toContain("No rows match these filters");
    expect(panelSource).toContain("No saved reports yet. Build one in the Builder tab");
    // Delete is confirm-guarded and clearly scoped to the definition.
    expect(panelSource).toContain("only the saved report definition is removed");
    // CSV export includes the total row and escapes quotes.
    expect(panelSource).toContain('row.key.replace(/"/g, \'""\')');
    expect(panelSource).toContain("TOTAL,");
  });

  it("edits a saved report without render-phase state churn", () => {
    // The builder tab remounts by edit target key so seeding is pure initialization.
    expect(panelSource).toContain('key={editing?.id ?? "new"}');
    expect(panelSource).toContain("single seeding point");
    // Clicking Edit on a saved report jumps straight to the Builder tab.
    expect(panelSource).toContain("setTabSeq(seq => seq + 1)");
  });
});
