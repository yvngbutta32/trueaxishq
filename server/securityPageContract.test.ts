import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const source = (rel: string) => readFileSync(resolve(root, rel), "utf8");
const securityPage = source("client/src/pages/Security.tsx");
const home = source("client/src/pages/Home.tsx");
const app = source("client/src/App.tsx");
const securityServer = source("server/security.ts");
const routers = source("server/routers.ts");
const publicApi = source("server/publicApi.ts");

describe("security marketing page (Tier 3 item 17)", () => {
  it("is published at a public route and linked from the footer", () => {
    expect(app).toContain('<Route path="/security" component={Security} />');
    expect(home).toContain('navigate("/security")');
  });

  it("makes only claims backed by shipped code — evidence boundary", () => {
    // 2FA claim
    expect(securityPage).toContain("TOTP");
    expect(routers).toMatch(/twoFactor|totp/i);
    // Session visibility + revoke claim
    expect(securityPage).toContain("revoke any of them instantly");
    expect(routers).toContain("userSessions");
    // Lockout + reset rate-limit claims
    expect(securityPage).toContain("lock the account");
    expect(securityServer).toContain("isAccountLocked");
    expect(securityServer).toContain("allowPasswordResetRequest");
    // Header hardening claims
    for (const header of ["Content-Security-Policy", "X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy"]) {
      expect(securityPage).toContain(header);
      expect(securityServer).toContain(header);
    }
    // API key claims
    expect(securityPage).toContain("SHA-256");
    expect(publicApi).toContain("hashApiKey");
    expect(publicApi).toContain("timingSafeEqual");
    expect(securityPage).toContain("fail closed");
  });

  it("is honest about certifications we do not hold", () => {
    expect(securityPage).toContain("not yet in place");
    expect(securityPage).not.toMatch(/SOC ?2 (certified|compliant)/i);
    expect(securityPage).not.toMatch(/ISO ?27001 (certified|compliant)/i);
  });

  it("gives researchers a real disclosure channel", () => {
    expect(securityPage).toContain("security@trueaxishq.com");
    expect(securityPage).toContain("Found a vulnerability?");
  });
});
