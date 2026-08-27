import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const fieldModeSource = readFileSync(resolve(process.cwd(), "client/src/pages/FieldMode.tsx"), "utf8");
const recoverySource = readFileSync(resolve(process.cwd(), "shared/fieldModeRecovery.ts"), "utf8");

describe("Field Mode draft privacy", () => {
  it("stores recoverable client-update drafts only for the active browser session", () => {
    expect(fieldModeSource).toContain("sessionStorage.getItem(fieldModeDraftKey(jobId))");
    expect(fieldModeSource).toContain("sessionStorage.setItem(fieldModeDraftKey(jobId), value)");
    expect(fieldModeSource).not.toContain("localStorage.setItem(fieldModeDraftKey(jobId)");
    expect(recoverySource).toContain("trueaxis-field-session-draft:");
  });

  it("discloses the recovery boundary and preserves deliberate client posting", () => {
    expect(fieldModeSource).toContain("Draft saved for this browser session.");
    expect(fieldModeSource).toContain("Draft recovery is limited to this browser session.");
    expect(fieldModeSource).toContain("Posting remains a separate intentional client-portal action.");
    expect(recoverySource).toContain("saved for this browser session");
  });
});
