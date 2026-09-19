import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CHANGELOG, formatChangelogDate } from "../shared/productChangelog";
import { INCIDENT_TRACKING_BEGAN, STATUS_INCIDENTS } from "../shared/statusIncidents";

const root = resolve(import.meta.dirname, "..");
const appSource = readFileSync(resolve(root, "client/src/App.tsx"), "utf8");
const statusSource = readFileSync(resolve(root, "client/src/pages/Status.tsx"), "utf8");
const changelogSource = readFileSync(resolve(root, "client/src/pages/Changelog.tsx"), "utf8");
const homeSource = readFileSync(resolve(root, "client/src/pages/Home.tsx"), "utf8");

describe("published changelog integrity", () => {
  it("contains only real, dated, committed work — newest first", () => {
    expect(CHANGELOG.length).toBeGreaterThanOrEqual(10);
    const dates = CHANGELOG.map(entry => entry.date);
    for (const date of dates) expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (let i = 1; i < dates.length; i++) expect(dates[i - 1] >= dates[i]).toBe(true);
    // Every entry has substance — no 'various improvements' filler.
    for (const entry of CHANGELOG) {
      expect(entry.description.length).toBeGreaterThan(60);
      expect(entry.title.length).toBeGreaterThan(8);
    }
    // Recent ships are documented.
    expect(CHANGELOG.some(entry => entry.title.includes("REST API"))).toBe(true);
    expect(CHANGELOG.some(entry => entry.title.includes("report builder"))).toBe(true);
  });

  it("formats dates for public display", () => {
    expect(formatChangelogDate("2026-09-19")).toBe("September 19, 2026");
    expect(formatChangelogDate(INCIDENT_TRACKING_BEGAN)).toBe("September 18, 2026");
  });
});

describe("public status page honesty", () => {
  it("starts with a truthful, empty incident log — never a fabricated one", () => {
    expect(STATUS_INCIDENTS).toEqual([]);
    expect(INCIDENT_TRACKING_BEGAN).toBe("2026-09-18");
  });

  it("probes the real health endpoint live, with auto-refresh", () => {
    expect(statusSource).toContain('fetch("/api/health"');
    expect(statusSource).toContain("setInterval(probe, REFRESH_MS)");
    expect(statusSource).toContain('body?.status === "healthy"');
    // Degraded is reported as degraded — never spun into "operational".
    expect(statusSource).toContain('"Degraded performance');
  });

  it("renders the honest empty-state copy and announces changes screen-reader-safely", () => {
    expect(statusSource).toContain("No published incidents");
    expect(statusSource).toContain("Incident tracking began");
    // The live region carries only the status label so 60-second polls don't spam screen readers.
    expect(statusSource).toContain('aria-live="polite" className="sr-only"');
  });
});

describe("status + changelog routing and discovery (Tier 3 item 15)", () => {
  it("publishes both pages at public routes", () => {
    expect(appSource).toContain('<Route path="/status" component={Status} />');
    expect(appSource).toContain('<Route path="/changelog" component={Changelog} />');
  });

  it("links both from the marketing footer and cross-links between them", () => {
    expect(homeSource).toContain('navigate("/status")');
    expect(homeSource).toContain('navigate("/changelog")');
    expect(statusSource).toContain('navigate("/changelog")');
    expect(changelogSource).toContain('navigate("/status")');
  });

  it("renders the shared modules as the single source of truth", () => {
    expect(changelogSource).toContain("from \"@shared/productChangelog\"");
    expect(statusSource).toContain("from \"@shared/statusIncidents\"");
  });
});
