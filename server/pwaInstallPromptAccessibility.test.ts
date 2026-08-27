import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("public install prompt accessibility", () => {
  it("yields to form controls and uses non-overclaiming install guidance", () => {
    const component = readFileSync(resolve(process.cwd(), "client/src/components/PWAInstallBanner.tsx"), "utf8");

    expect(component).toContain('document.addEventListener("focusin", hideForFormEntry)');
    expect(component).toContain("target instanceof HTMLInputElement");
    expect(component).toContain("target instanceof HTMLTextAreaElement");
    expect(component).toContain("target instanceof HTMLSelectElement");
    expect(component).toContain("setShowBanner(false)");
    expect(component).toContain('role="region"');
    expect(component).toContain("Install for faster access from your home screen");
    expect(component).not.toContain("offline use");
    expect(component).toContain('aria-label="Dismiss install banner"');
  });
});
