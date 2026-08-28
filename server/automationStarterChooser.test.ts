import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/Automations.tsx"), "utf8");

describe("automation starter chooser", () => {
  it("loads owner-reviewed starter workflows as paused drafts", () => {
    expect(source).toContain("const AUTOMATION_STARTERS");
    expect(source).toContain('active: false');
    expect(source).toContain("Start with a reviewable workflow");
    expect(source).toContain("Nothing sends or activates from this chooser.");
    expect(source).toContain("Starter loaded as a paused draft. Review it before saving.");
    expect(source).toContain('"Save Paused Draft"');
  });

  it("keeps the provider-delivery and private-workflow boundaries visible", () => {
    expect(source).toContain("Review a welcome email action before enabling configured delivery.");
    expect(source).toContain("provider delivery requires its own configured evidence");
    expect(source).not.toContain("nothing sends automatically from this chooser");
  });
});
