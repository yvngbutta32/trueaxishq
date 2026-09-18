import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  base32Decode,
  base32Encode,
  buildOtpAuthUrl,
  generateBackupCodes,
  generateTotpSecret,
  hashBackupCode,
  hotp,
  totpAt,
  verifyTotp,
} from "./totp";

const routersSource = readFileSync(resolve(import.meta.dirname, "./routers.ts"), "utf8");
const loginSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/Login.tsx"), "utf8");
const settingsSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/dashboard/SettingsPanel.tsx"), "utf8");

// RFC 6238 Appendix B reference vectors: 20-byte ASCII secret, SHA-1.
const RFC_SECRET = Buffer.from("12345678901234567890", "ascii");

describe("RFC 6238 reference vectors", () => {
  it("matches every documented 8-digit SHA-1 vector", () => {
    expect(totpAt(RFC_SECRET, 59, 8)).toBe("94287082");
    expect(totpAt(RFC_SECRET, 1111111109, 8)).toBe("07081804");
    expect(totpAt(RFC_SECRET, 1111111111, 8)).toBe("14050471");
    expect(totpAt(RFC_SECRET, 1234567890, 8)).toBe("89005924");
    expect(totpAt(RFC_SECRET, 2000000000, 8)).toBe("69279037");
    expect(totpAt(RFC_SECRET, 20000000000, 8)).toBe("65353130");
  });

  it("matches the 6-digit truncation of the same vectors", () => {
    expect(totpAt(RFC_SECRET, 59)).toBe("287082");
    expect(totpAt(RFC_SECRET, 1111111109)).toBe("081804");
    expect(totpAt(RFC_SECRET, 20000000000)).toBe("353130");
  });

  it("rejects malformed codes instead of throwing", () => {
    expect(verifyTotp("JBSWY3DPEHPK3PXP", "")).toBe(false);
    expect(verifyTotp("JBSWY3DPEHPK3PXP", "12ab56")).toBe(false);
    expect(verifyTotp("JBSWY3DPEHPK3PXP", "1234567")).toBe(false);
    expect(verifyTotp("not-a-valid-secret!!", "123456")).toBe(false);
  });
});

describe("base32 codec", () => {
  it("round-trips arbitrary bytes", () => {
    const buf = Buffer.from([0, 1, 2, 250, 255, 16, 99]);
    expect(base32Decode(base32Encode(buf))).toEqual(buf);
  });

  it("encodes the RFC 4648 test vector", () => {
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI======".replace(/=/g, ""));
  });

  it("accepts lowercase and padded input", () => {
    expect(base32Decode("mzxw6ytboi======")).toEqual(Buffer.from("foobar"));
  });
});

describe("secret and URI generation", () => {
  it("generates 160-bit base32 secrets", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(secret)).toHaveLength(20);
  });

  it("builds a standards-compliant otpauth:// provisioning URI", () => {
    const url = buildOtpAuthUrl({ secret: "JBSWY3DPEHPK3PXP", accountLabel: "owner@example.com" });
    expect(url).toContain("otpauth://totp/TrueAxis%20HQ%3Aowner%40example.com");
    expect(url).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(url).toContain("issuer=TrueAxis+HQ");
    expect(url).toContain("digits=6");
    expect(url).toContain("period=30");
  });
});

describe("backup codes", () => {
  it("generates 8 dash-formatted codes from the confusion-free alphabet", () => {
    const codes = generateBackupCodes(8);
    expect(codes).toHaveLength(8);
    for (const code of codes) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });

  it("hashes dash- and case-insensitively so login accepts any typed form", () => {
    const [code] = generateBackupCodes(1);
    expect(hashBackupCode(code)).toBe(hashBackupCode(code.toLowerCase()));
    expect(hashBackupCode(code)).toBe(hashBackupCode(code.replace(/-/g, "")));
    expect(hashBackupCode(code)).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("two-factor login enforcement (source contract)", () => {
  it("gates both login and adminLogin behind the code after the password", () => {
    expect(routersSource).toContain("TWO_FACTOR_CODE_REQUIRED");
    // One gate per login path — standard login and admin login each demand the code.
    expect((routersSource.match(/TWO_FACTOR_CODE_REQUIRED/g) ?? []).length).toBe(2);
    expect(routersSource).toContain("if (user.twoFactorEnabled) {");
  });

  it("never returns the stored secret once enabled — status exposes only the flag", () => {
    const idx = routersSource.indexOf("status: protectedProcedure.query");
    const statusBlock = routersSource.slice(idx, idx + 260);
    expect(statusBlock).toContain("enabled");
    expect(statusBlock).not.toContain("twoFactorSecret");
  });

  it("consumes backup codes single-use and supports them at login", () => {
    expect(routersSource).toContain("isNull(twoFactorBackupCodes.usedAt)");
    expect(routersSource).toContain("set({ usedAt: new Date() })");
    expect(routersSource).toContain("twoFactorCode: z.string().regex(/^[A-Za-z0-9-]{6,14}$/).optional()");
  });

  it("requires the password to disable, and wipes secret + backup codes", () => {
    expect(routersSource).toContain("await bcrypt.compare(input.password, user.passwordHash)");
    expect(routersSource).toContain('set({ twoFactorSecret: null, twoFactorEnabled: false');
    expect(routersSource).toContain("db.delete(twoFactorBackupCodes)");
  });

  it("counts failed 2FA attempts toward the existing account lockout", () => {
    expect(routersSource).toContain('eventType: "two_factor_failed"');
  });
});

describe("two-factor UI (source contract)", () => {
  it("login reveals a code field only after the server asks, and accepts backup codes", () => {
    expect(loginSource).toContain('"TWO_FACTOR_CODE_REQUIRED"');
    expect(loginSource).toContain("maxLength={14}");
    expect(loginSource).toContain("twoFactorCode: needsTwoFactor ? twoFactorCode.trim() : undefined");
  });

  it("settings offers QR + manual key setup, one-time backup codes, and password-gated disable", () => {
    expect(settingsSource).toContain("Two-Factor Authentication");
    expect(settingsSource).toContain("twoFactor.setupStart");
    expect(settingsSource).toContain("twoFactor.setupConfirm");
    expect(settingsSource).toContain("twoFactor.disable");
    expect(settingsSource).toContain("qrDataUrl");
    expect(settingsSource).toContain("Download");
  });
});

describe("verifyTotp timing window", () => {
  it("accepts the code for the current time step", () => {
    const secret = generateTotpSecret();
    const buf = base32Decode(secret)!;
    const code = totpAt(buf, Math.floor(Date.now() / 1000));
    expect(verifyTotp(secret, code)).toBe(true);
  });

  it("rejects a code far outside the ±1 step window", () => {
    const secret = generateTotpSecret();
    const buf = base32Decode(secret)!;
    // A code from ~5 minutes ago is well outside the ±30s tolerance.
    const staleCode = totpAt(buf, Math.floor(Date.now() / 1000) - 300);
    expect(verifyTotp(secret, staleCode)).toBe(false);
  });

  it("hotp is deterministic for a given counter", () => {
    expect(hotp(RFC_SECRET, 0, 8)).toBe("84755224"); // RFC 4226 vector
    expect(hotp(RFC_SECRET, 1, 8)).toBe("94287082"); // counter 1 == TOTP at T=59
  });
});
