import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const fieldModeSource = readFileSync(resolve(process.cwd(), "client/src/pages/FieldMode.tsx"), "utf8");
const recoverySource = readFileSync(resolve(process.cwd(), "shared/fieldModeRecovery.ts"), "utf8");

describe("Field Mode draft privacy", () => {
  it("stores recoverable client-update drafts on the device, per job, so dead zones never lose them", () => {
    // Drafts must survive refreshes, force-closes, and browser restarts — a
    // technician's typed update is the most expensive thing to lose offline.
    // Storage is device-scoped localStorage keyed per job (no cross-user
    // server persistence, no cross-job bleed) and is cleared on posting.
    expect(recoverySource).toContain("window.localStorage.getItem(fieldModeDraftKey(jobId))");
    expect(recoverySource).toContain("window.localStorage.setItem(fieldModeDraftKey(jobId), value)");
    expect(recoverySource).toContain("trueaxis-field-draft:");
    expect(fieldModeSource).not.toContain("sessionStorage.");
  });

  it("discloses the recovery boundary and preserves deliberate client posting", () => {
    expect(fieldModeSource).toContain("Draft saved on this device and recovered automatically, even after a restart.");
    expect(fieldModeSource).toContain("Drafts are saved on this device and survive restarts.");
    expect(fieldModeSource).toContain("Posting remains a separate intentional client-portal action.");
    expect(fieldModeSource).toContain("Clear draft");
    expect(fieldModeSource).toContain("Draft removed from this device. No client update was posted.");
  });
});
