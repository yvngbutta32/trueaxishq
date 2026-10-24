import { readFileSync } from "node:fs";
import { readDashboardBundle } from "./dashboardBundle";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("operational command navigation", () => {
  it("keeps core operational destinations available through the global command palette", () => {
    const palette = readFileSync(resolve(process.cwd(), "client/src/components/GlobalSearch.tsx"), "utf8");

    for (const panel of ["clients", "scheduling", "jobs", "team", "dispatch", "billing", "insights", "integrations", "webhooks"]) {
      expect(palette).toContain(`panel: "${panel}"`);
    }
    expect(palette).toContain("OPERATIONAL_SHORTCUTS");
    expect(palette).toContain("Find a record or jump into an operation");
  });

  it("keeps the Job Photos sidebar destination mapped to its owner panel rather than the admin route", () => {
    const dashboard = readDashboardBundle();
    const nav = readFileSync(resolve(process.cwd(), "client/src/pages/dashboard/navStructure.ts"), "utf8");
    const panelSwitch = dashboard.slice(dashboard.indexOf("switch (active)"), dashboard.indexOf("default: return null"));

    expect(nav).toContain('label: "Job Photos"');
    expect(nav).toContain('panel: "photos"');
    expect(nav).toContain('label: "Work"'); // Job Photos lives in the Work group
    // Grouped rendering (section headers per group) lives in the Sidebar render.
    expect(dashboard).toContain('role="group" aria-label={group.label}');
    expect(panelSwitch).toContain('case "photos": return (');
    expect(panelSwitch).toContain("<JobPhotosPanel />");
    expect(nav).not.toContain('panel: "admin"');
  });
});
