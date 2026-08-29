import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("public install prompt accessibility", () => {
  it("yields to form controls and uses non-overclaiming install guidance", () => {
    const component = readFileSync(resolve(process.cwd(), "client/src/components/PWAInstallBanner.tsx"), "utf8");

    expect(component).toContain('document.addEventListener("focusin", hideForFormEntry)');
    expect(component).toContain("showOnlyOutsideEntryContexts");
    expect(component).toContain("form, input, textarea, select, [contenteditable='true']");
    expect(component).toContain("const publicReadingRoutes = new Set");
    expect(component).toContain('"/privacy"');
    expect(component).toContain('"/terms"');
    expect(component).toContain('"/pricing"');
    expect(component).toContain("const isPublicReadingRoute = publicReadingRoutes.has(window.location.pathname)");
    expect(component).toContain("if (!hasEntryControl && !isPublicReadingRoute) setShowBanner(true)");
    expect(component).toContain("target instanceof HTMLInputElement");
    expect(component).toContain("target instanceof HTMLTextAreaElement");
    expect(component).toContain("target instanceof HTMLSelectElement");
    expect(component).toContain("setShowBanner(false)");
    expect(component).toContain('role="region"');
    expect(component).toContain("Install for faster access from your home screen");
    expect(component).not.toContain("offline use");
    expect(component).toContain('aria-label="Dismiss install banner"');
  });

  it("keeps production service-worker registration while clearing stale local development registrations", () => {
    const document = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");

    expect(document).toContain("var isDevelopment = '%MODE%' === 'development';");
    expect(document).toContain("'serviceWorker' in navigator && isDevelopment");
    expect(document).toContain("navigator.serviceWorker.getRegistrations()");
    expect(document).toContain("registration.unregister()");
    expect(document).toContain("else if ('serviceWorker' in navigator)");
    expect(document).toContain("navigator.serviceWorker.register('/sw.js', { scope: '/' })");
  });
});
