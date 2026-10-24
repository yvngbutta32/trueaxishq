import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * Contract: the "Run connection test" control (system.testConnections, an
 * adminProcedure) must never be rendered as a clickable dead-end for
 * non-admin users. Found live during the Oct 24 manual QA sweep: a regular
 * (non-admin) user saw the button, clicked it, and always received
 * "You do not have required permission (10002)".
 */
const settingsPath = join(process.cwd(), "client", "src", "pages", "dashboard", "SettingsPanel.tsx");
const src = readFileSync(settingsPath, "utf8");

describe("settings connection-test owner gate", () => {
  it("SettingsPanel knows the viewer's owner status", () => {
    expect(src).toMatch(/user\?\.isOwner === true/);
  });

  it("the connection-test card is gated so non-admins never see a dead-end 403 button", () => {
    // The gate variable must exist...
    expect(src).toMatch(/isOwner \? \(/);
    // ...and both admin-only controls (run test, send test email) must sit inside the gated branch.
    const gatedBranch = src.slice(src.indexOf("isOwner ? ("));
    const sendIdx = gatedBranch.indexOf("Send test email");
    const runIdx = gatedBranch.indexOf('"Run connection test"');
    const branchEnd = gatedBranch.indexOf(") : ("); // first non-owner alternative
    expect(branchEnd).toBeGreaterThan(0);
    expect(sendIdx).toBeGreaterThan(-1);
    expect(sendIdx).toBeLessThan(branchEnd);
    expect(runIdx).toBeGreaterThan(-1);
    expect(runIdx).toBeLessThan(branchEnd);
  });

  it("non-admins get an honest explanation instead of the buttons", () => {
    const gatedBranch = src.slice(src.indexOf("isOwner ? ("));
    expect(gatedBranch).toMatch(/Admin sign-in required/i);
  });

  it("the mutation only fires from the gated branch (no ungated testConnections.mutate on the settings page)", () => {
    const mutates = [...src.matchAll(/testConnections\.mutate\(/g)].length;
    // exactly three gated call sites: send test email, run test, (any inline variant)
    expect(mutates).toBeGreaterThanOrEqual(2);
    const firstMutateIdx = src.indexOf("testConnections.mutate(");
    const gateIdx = src.indexOf("isOwner ? (");
    expect(gateIdx).toBeGreaterThan(-1);
    expect(firstMutateIdx).toBeGreaterThan(gateIdx);
  });
});
