import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseUserAgent } from "./deviceInfo";

const routersSource = readFileSync(resolve(import.meta.dirname, "./routers.ts"), "utf8");
const settingsSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/dashboard/SettingsPanel.tsx"), "utf8");

describe("parseUserAgent", () => {
  it("classifies a modern Windows Chrome desktop", () => {
    const info = parseUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36");
    expect(info.browser).toBe("Chrome");
    expect(info.os).toBe("Windows 10/11");
    expect(info.deviceType).toBe("desktop");
    expect(info.isApp).toBe(false);
  });

  it("classifies an iPhone Safari session as mobile", () => {
    const info = parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1");
    expect(info.browser).toBe("Safari");
    expect(info.os).toBe("iOS");
    expect(info.deviceType).toBe("mobile");
  });

  it("prefers Edge over the Chrome token Edge also contains", () => {
    const info = parseUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0");
    expect(info.browser).toBe("Edge");
  });

  it("treats Android-without-Mobile as a tablet", () => {
    const info = parseUserAgent("Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36");
    expect(info.os).toBe("Android");
    expect(info.deviceType).toBe("tablet");
  });

  it("never throws on missing, empty, or garbage user agents", () => {
    expect(parseUserAgent(null)).toEqual({ browser: "Unknown browser", os: "Unknown OS", deviceType: "unknown", isApp: false });
    expect(parseUserAgent("")).toEqual({ browser: "Unknown browser", os: "Unknown OS", deviceType: "unknown", isApp: false });
    expect(parseUserAgent("███ not a user agent at all ███").deviceType).toBe("desktop");
  });
});

describe("session management (source contract)", () => {
  it("lists only active, unexpired sessions and flags the current one", () => {
    const idx = routersSource.indexOf("sessions: router({");
    const block = routersSource.slice(idx, idx + 1800);
    expect(block).toContain("eq(userSessions.isActive, true)");
    expect(block).toContain("gt(userSessions.expiresAt, new Date())");
    expect(block).toContain("isCurrent");
    expect(block).not.toContain("tokenHash: row.tokenHash"); // hash itself never leaves the server
  });

  it("revokeOthers spares the current session and logs the security event", () => {
    const idx = routersSource.indexOf("revokeOthers: protectedProcedure");
    const block = routersSource.slice(idx, idx + 1400);
    expect(block).toContain('ne(userSessions.tokenHash, currentHash)');
    expect(block).toContain('"owner_revoke"');
    expect(block).toContain('"sessions_revoked"');
  });

  it("the middleware the revocation leans on checks isActive on every request", async () => {
    const authSource = readFileSync(resolve(import.meta.dirname, "./auth.ts"), "utf8");
    expect(authSource).toContain("eq(userSessions.isActive, true)");
    expect(authSource).toContain("Session has expired or been revoked");
  });

  it("settings shows the device list with a This-device badge and revoke-others button", () => {
    expect(settingsSource).toContain("Active Sessions");
    expect(settingsSource).toContain("This device");
    expect(settingsSource).toContain("sessions.revokeOthers");
    expect(settingsSource).toContain("Sign out all other devices");
  });
});
