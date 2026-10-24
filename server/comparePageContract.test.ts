import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  COMPARE_AS_OF,
  COMPARE_BEHIND,
  COMPARE_ROWS,
  type CompetitorClaim,
} from "../shared/compareData";
import { formatChangelogDate } from "../shared/productChangelog";

const root = resolve(import.meta.dirname, "..");
const researchDir = resolve(root, "docs/working-notes/research/comp-2026-10");
const appSource = readFileSync(resolve(root, "client/src/App.tsx"), "utf8");
const homeSource = readFileSync(resolve(root, "client/src/pages/Home.tsx"), "utf8");
const compareSource = readFileSync(resolve(root, "client/src/pages/Compare.tsx"), "utf8");

const SUPERLATIVES = [
  "best ", "cheapest", "unbeatable", "blows away", "kills ", "crushes",
  "better than everyone", "superior to all", "world's", "no one else",
];

describe("public comparison page data integrity", () => {
  it("research date is pinned and recent", () => {
    expect(COMPARE_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // The page prints it, so the formatter must accept it.
    expect(formatChangelogDate(COMPARE_AS_OF).length).toBeGreaterThan(4);
  });

  it("every competitor claim is quoted verbatim from its cited research file", () => {
    for (const row of COMPARE_ROWS) {
      for (const claim of Object.values(row.competitors) as CompetitorClaim[]) {
        const file = resolve(researchDir, claim.researchFile);
        expect(existsSync(file), `missing research file ${claim.researchFile}`).toBe(true);
        const body = readFileSync(file, "utf8");
        expect(
          body.includes(claim.quote),
          `quote not found verbatim in ${claim.researchFile}: "${claim.quote}"`,
        ).toBe(true);
        expect(claim.sourceUrl).toMatch(/^https:\/\//);
        expect(claim.sourceLabel.length).toBeGreaterThan(3);
        expect(claim.summary.length).toBeGreaterThan(20);
      }
    }
  });

  it("every TrueAxis claim points at evidence that exists in the repo", () => {
    for (const row of COMPARE_ROWS) {
      expect(row.us.length).toBeGreaterThan(30);
      expect(row.usEvidence.length).toBeGreaterThanOrEqual(1);
      for (const p of row.usEvidence) {
        expect(existsSync(resolve(root, p)), `missing evidence path ${p}`).toBe(true);
      }
    }
  });

  it("our own copy contains no superlatives — comparisons, not marketing", () => {
    const ours = [
      ...COMPARE_ROWS.map((r) => `${r.feature} ${r.us}`),
      ...COMPARE_BEHIND.map((b) => `${b.area} ${b.honest}`),
    ];
    for (const text of ours) {
      for (const s of SUPERLATIVES) {
        expect(text.toLowerCase().includes(s), `superlative "${s}" in our copy: ${text}`).toBe(false);
      }
    }
  });

  it("the honesty section exists and is real (we publish what they do better)", () => {
    expect(COMPARE_BEHIND.length).toBeGreaterThanOrEqual(3);
    for (const b of COMPARE_BEHIND) {
      expect(b.area.length).toBeGreaterThan(5);
      expect(b.honest.length).toBeGreaterThan(40);
      expect(existsSync(resolve(root, b.evidence)), `missing behind-evidence ${b.evidence}`).toBe(true);
    }
  });

  it("the comparison covers the switch-pool competitors", () => {
    const keys = COMPARE_ROWS.flatMap((r) => Object.keys(r.competitors));
    for (const k of ["jobber", "housecallPro", "serviceTitan"] as const) {
      expect(keys.filter((x) => x === k).length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("comparison page wiring", () => {
  it("the /compare route exists and the page renders the shared data", () => {
    expect(appSource).toContain('path="/compare"');
    expect(compareSource).toContain("COMPARE_ROWS");
    expect(compareSource).toContain("COMPARE_BEHIND");
    expect(compareSource).toContain("COMPARE_AS_OF");
  });

  it("the site footer links to /compare", () => {
    expect(homeSource).toContain('"/compare"');
  });
});
