import { readFileSync } from "node:fs";
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
    const dashboard = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");
    const sidebar = dashboard.slice(dashboard.indexOf("const navItems:"), dashboard.indexOf("function Sidebar"));
    const panelSwitch = dashboard.slice(dashboard.indexOf("switch (active)"), dashboard.indexOf("default: return null"));

    expect(sidebar).toContain('label: "Job Photos", panel: "photos"');
    expect(panelSwitch).toContain('case "photos": return (');
    expect(panelSwitch).toContain("<JobPhotosPanel />");
    expect(sidebar).not.toContain('label: "Job Photos",  panel: "admin"');
  });
});
