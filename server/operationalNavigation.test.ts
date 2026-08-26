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
});
