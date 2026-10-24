import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Dashboard navigation structure contract.
 *
 * Pins the owner's information-architecture directive (Oct 24 2026):
 * "everything should have their own respectful places and similar or
 * coexisting functions should be placed close together for ease of use and
 * dashboard cleanliness."
 *
 * Guarantees:
 * - navStructure.ts is the single source of truth; sidebar + mobile consume it.
 * - Exactly the 23 live panels appear, each once — no legacy alias leaks in.
 * - Groups follow the owner's workflow order: Home → Customers → Work → Team
 *   → Money → Intelligence → System.
 * - Coexisting functions are adjacent (Deals/Outreach, Billing/Inventory,
 *   Insights/Reports, Integrations/Webhooks, Team/Subs).
 * - One-time setup tools (Launch, Import) live in System, not at the top.
 */

const nav = readFileSync("client/src/pages/dashboard/navStructure.ts", "utf8");
const shared = readFileSync("client/src/pages/dashboard/shared.tsx", "utf8");
const sidebar = readFileSync("client/src/pages/dashboard/Sidebar.tsx", "utf8");
const mobile = readFileSync("client/src/pages/dashboard/MobileNav.tsx", "utf8");

const navPanels: string[] = [...nav.matchAll(/panel: "([a-z-]+)"/g)].map(m => m[1]);
const navLabels: string[] = [...nav.matchAll(/icon: \w+,\s+label: "([^"]+)"/g)].map(m => m[1]);
const groupLabels = [...nav.matchAll(/^  \{$\n\s+label: "([^"]+)"/gm)].map(m => m[1]);

const activePanelUnion = (shared.match(/type ActivePanel = ([^;]+);/)![1])
  .split("|").map(s => s.trim().replace(/"/g, ""));
const redirectsBlock = shared.slice(
  shared.indexOf("LEGACY_PANEL_REDIRECTS"),
  shared.indexOf("};", shared.indexOf("LEGACY_PANEL_REDIRECTS")),
);
const legacyAliases = [...redirectsBlock.matchAll(/^  ([a-z]+): "/gm)].map(m => m[1]);
const legacyTargets = [...redirectsBlock.matchAll(/: "([a-z-]+)",?$/gm)].map(m => m[1]);
const livePanels = activePanelUnion.filter(p => !legacyAliases.includes(p));

const idx = (panel: string) => navPanels.indexOf(panel);

describe("navigation structure — single source of truth", () => {
  it("the desktop sidebar and the mobile sheet both consume navStructure.ts", () => {
    expect(sidebar).toContain('import { NAV_GROUPS } from "./navStructure"');
    expect(sidebar).not.toContain("const navGroups");
    expect(mobile).toContain("MOBILE_PRIMARY_TABS, MOBILE_SHEET_GROUPS");
    expect(mobile).not.toContain("const primaryTabs");
    expect(mobile).not.toContain("const sheetSections");
  });

  it("shows exactly the 23 live panels — each exactly once", () => {
    expect(navPanels).toHaveLength(23);
    expect(new Set(navPanels).size).toBe(23);
    expect(new Set(navLabels).size).toBe(navLabels.length);
    expect(new Set(navPanels)).toEqual(new Set(livePanels));
  });

  it("never surfaces legacy alias panels in the nav (they redirect)", () => {
    for (const alias of legacyAliases) {
      expect(navPanels).not.toContain(alias);
    }
  });

  it("every legacy alias redirects to a panel that is reachable in the nav", () => {
    for (const target of legacyTargets) {
      expect(navPanels).toContain(target);
    }
  });
});

describe("navigation structure — workflow grouping", () => {
  it("groups follow the owner's workflow order top to bottom", () => {
    expect(groupLabels).toEqual([
      "Home", "Customers", "Work", "Team", "Money", "Intelligence", "System",
    ]);
  });

  it("coexisting functions sit adjacent", () => {
    expect(idx("deals") + 1).toBe(idx("outreach"));       // sales pipeline together
    expect(idx("billing") + 1).toBe(idx("inventory"));   // revenue + materials cost
    expect(idx("insights") + 1).toBe(idx("reports"));    // intelligence together
    expect(idx("integrations") + 1).toBe(idx("webhooks")); // connectors together
    expect(idx("team") + 1).toBe(idx("subs"));          // labor together
  });

  it("work panels follow the delivery lifecycle: schedule → jobs → photos → dispatch → field", () => {
    expect(idx("scheduling")).toBeLessThan(idx("jobs"));
    expect(idx("jobs")).toBeLessThan(idx("photos"));
    expect(idx("photos")).toBeLessThan(idx("dispatch"));
    expect(idx("dispatch")).toBeLessThan(idx("field"));
  });

  it("keeps the daily cockpit at the top — Operations and AI Assistant in Home", () => {
    expect(navPanels.indexOf("executive")).toBeLessThan(idx("clients"));
    expect(navPanels.indexOf("ai")).toBeLessThan(idx("clients"));
  });

  it("keeps one-time setup tools in System, never at the top of the nav", () => {
    expect(navPanels.indexOf("launch")).toBeGreaterThan(idx("reports"));
    expect(navPanels.indexOf("import")).toBeGreaterThan(idx("reports"));
    expect(navPanels.indexOf("settings")).toBe(navPanels.length - 1); // Settings last, universal convention
  });
});

describe("mobile navigation", () => {
  it("pins exactly 4 fixed bottom tabs", () => {
    const primaries = [...nav.matchAll(/primaryMobile: true/g)];
    expect(primaries).toHaveLength(4);
    expect(navPanels.slice(0, 1).concat(["clients", "scheduling", "billing"]))
      .toEqual(expect.arrayContaining(
        [...nav.matchAll(/\{ icon: [^}]+?panel: "([a-z-]+)", primaryMobile: true \}/g)].map(m => m[1]),
      ));
  });

  it("the mobile sheet mirrors the desktop sidebar — no panel only reachable on one surface", () => {
    // MOBILE_SHEET_GROUPS is derived from NAV_GROUPS minus the 4 primary tabs
    expect(nav).toContain("MOBILE_SHEET_GROUPS");
    expect(nav).toContain("filter((i) => !i.primaryMobile)");
  });

  it("no quick link mislabels its destination (the old 'Billing' → settings bug)", () => {
    expect(mobile).not.toContain("CreditCard");
    expect(mobile).toContain("Public Site");
  });

  it("the nav bar stays clickable above the sheet backdrop (live QA catch: z-40 backdrop swallowed every nav button while the All-features sheet was open)", () => {
    // The backdrop is fixed inset-0 z-40 — without a higher stacking level on the
    // nav, it intercepts taps on the tabs and the All-features toggle itself.
    expect(mobile).toContain('className="fixed inset-0 z-40 bg-black/60"');
    expect(mobile).toMatch(/<nav[^>]*className="w-full relative z-50"/);
  });
});
