import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { INTEGRATION_PROVIDERS, INTEGRATION_READINESS_STATUSES, integrationCatalog } from "../shared/integrationCatalog";

describe("integration readiness catalog", () => {
  it("covers the documented ecosystem categories with a complete, non-duplicated provider catalog", () => {
    expect(new Set(INTEGRATION_PROVIDERS).size).toBe(INTEGRATION_PROVIDERS.length);
    expect(Object.keys(integrationCatalog)).toHaveLength(INTEGRATION_PROVIDERS.length);
    expect(new Set(Object.values(integrationCatalog).map(entry => entry.category))).toEqual(new Set(["calendar", "accounting", "communications", "automation", "payments"]));
    expect(INTEGRATION_READINESS_STATUSES).toContain("connected");
  });
});

describe("integration readiness trust boundary", () => {
  it("derives Google connection state from secure authorization and exposes no manual connected-state input", () => {
    const source = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const hub = readFileSync(resolve(process.cwd(), "client/src/pages/IntegrationHub.tsx"), "utf8");
    const integrationSection = source.slice(source.indexOf("integrations: router({"), source.indexOf("// ── Unified Job Workspace"));

    expect(integrationSection).toContain("googleAuthorized");
    expect(integrationSection).toContain("googleCalendarTokens");
    expect(integrationSection).toContain("status: \"needs_configuration\"");
    expect(integrationSection).not.toContain("status: z.enum");
    expect(integrationSection).toContain("eq(integrationConnections.userId, ctx.user.id)");
    expect(hub).toContain("never accepts a manual “connected” claim");
    expect(hub).toContain("Provider authorization is still required.");
  });

  it("reports missing Google Calendar configuration as a protected setup state instead of a global client query failure", () => {
    const source = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const dashboard = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");
    const googleCalendar = source.slice(source.indexOf("googleCal: router({"), source.indexOf("// ── Onboarding Status"));

    expect(googleCalendar).toContain('return { url: null, status: "setup_required" as const }');
    expect(googleCalendar).toContain('status: "ready" as const');
    expect(googleCalendar).not.toContain("GOOGLE_CLIENT_ID to be configured in Settings → Secrets");
    expect(dashboard).toContain('calAuthData?.status === "setup_required"');
    expect(dashboard).toContain("Owner setup is required before Google authorization can begin.");
    expect(dashboard).toContain("Setup required");
  });
});
