import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/Automations.tsx"), "utf8");

describe("automation readiness guidance", () => {
  it("describes configured processing and provider-dependent delivery without absolute execution claims", () => {
    expect(source).toContain("Configure triggers and actions, review readiness, and inspect recorded outcomes.");
    expect(source).toContain("Queue a client email action when configured delivery is available");
    expect(source).toContain("Matching events are processed when the configured rule and dependencies are available");
    expect(source).toContain("provider delivery requires its own configured evidence");
    expect(source).not.toContain("so you never miss a follow-up or invoice");
    expect(source).not.toContain("The workflow fires every time the trigger condition is met");
  });
});
