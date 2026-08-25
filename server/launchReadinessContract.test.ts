import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("launch readiness contract", () => {
  it("reports setup signals without returning SMTP credentials", () => {
    const start = routerSource.indexOf("launchReadiness: protectedProcedure");
    const end = routerSource.indexOf("updateProfile: protectedProcedure", start);
    const source = routerSource.slice(start, end);
    expect(source).toContain("getEmailDeliveryStatus()");
    expect(source).toContain("eq(clientPortalTokens.revoked, false)");
    expect(source).toContain("email: { configured: email.configured, sender: email.sender, host: email.host, port: email.port, secure: email.secure, issues: email.issues }");
    expect(source).not.toContain("SMTP_PASS");
    expect(source).not.toContain("SMTP_USER");
  });

  it("registers Launch Readiness as a protected owner workspace", () => {
    expect(dashboardSource).toContain('panel: "launch"');
    expect(dashboardSource).toContain('<LaunchReadiness onNavigate={setActiveWithScroll} />');
  });
});
