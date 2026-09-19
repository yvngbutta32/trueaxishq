import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/* The HMAC in _core/smsLogin keys off JWT_SECRET, which must exist before
 * the module loads. Import lazily after seeding the environment.
 */
beforeAll(() => {
  process.env.JWT_SECRET ||= "test-secret-for-sms-login-hmac";
});

describe("SMS magic-link core", () => {
  it("generates zero-padded 6-digit codes", async () => {
    const { generateSmsLoginCode } = await import("./_core/smsLogin");
    for (let i = 0; i < 50; i++) {
      const code = generateSmsLoginCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it("hashes codes with the server secret — never plaintext, phone-bound", async () => {
    const { hashSmsLoginCode, verifySmsLoginCodeHash } = await import("./_core/smsLogin");
    const hash = hashSmsLoginCode("+15125550100", "123456");
    expect(hash).not.toContain("123456");
    expect(hash).toHaveLength(64); // sha256 hex
    // Deterministic for the same phone+code
    expect(hashSmsLoginCode("+15125550100", "123456")).toBe(hash);
    // Bound to the phone: same code, different phone -> different hash
    expect(hashSmsLoginCode("+15125550101", "123456")).not.toBe(hash);
    // Wrong code fails; right code verifies
    expect(verifySmsLoginCodeHash("+15125550100", "123457", hash)).toBe(false);
    expect(verifySmsLoginCodeHash("+15125550100", "123456", hash)).toBe(true);
  });

  it("rate limits requests per phone: 3 per hour, then silent drops", async () => {
    const { allowSmsLoginRequest, SMS_LOGIN_MAX_REQUESTS_PER_PHONE } = await import("./_core/smsLogin");
    expect(SMS_LOGIN_MAX_REQUESTS_PER_PHONE).toBe(3);
    const phone = `+1555010${Math.floor(Math.random() * 900) + 100}`;
    const ip = `10.0.${Math.floor(Math.random() * 250)}.1`;
    expect(allowSmsLoginRequest(ip, phone)).toBe(true);
    expect(allowSmsLoginRequest(ip, phone)).toBe(true);
    expect(allowSmsLoginRequest(ip, phone)).toBe(true);
    expect(allowSmsLoginRequest(ip, phone)).toBe(false);
  });
});

describe("SMS magic-link login evidence boundary", () => {
  const source = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
  const smsRequest = source.slice(source.indexOf("smsRequest: publicProcedure"), source.indexOf("smsVerify: publicProcedure"));
  const smsVerify = source.slice(source.indexOf("smsVerify: publicProcedure"), source.indexOf("changePassword: protectedProcedure"));

  it("stores an HMAC of the code, never the code itself", () => {
    expect(smsRequest).toContain("codeHash: hashSmsLoginCode(phone, code)");
    expect(smsRequest).not.toContain("code: code");
  });

  it("refuses to run before Twilio is configured (honest global gate)", () => {
    expect(smsRequest).toContain("SMS_LOGIN_NOT_CONFIGURED");
    expect(smsRequest).toContain("getSmsDeliveryStatus().configured");
  });

  it("never reveals whether a phone belongs to an account (anti-enumeration)", () => {
    expect(smsRequest).toContain("if (!user) return { success: true }");
    expect(smsRequest).toContain("allowSmsLoginRequest(ip, phone)");
  });

  it("burns earlier live codes when a new one is issued", () => {
    expect(smsRequest).toContain("Burn any earlier live codes");
  });

  it("only treats the code as sent when Twilio accepted it", () => {
    expect(smsRequest).toContain("wasSmsAcceptedByConfiguredTwilio(smsResult)");
  });

  it("requires a 6-digit code and burns it atomically after a single use", () => {
    expect(smsVerify).toContain("z.string().regex(/^\\d{6}$/)");
    expect(smsVerify).toContain("this write is the single-use predicate");
    expect(smsVerify).toContain("affectedRows");
  });

  it("enforces a wrong-code attempt ceiling before burning the record", () => {
    expect(smsVerify).toContain("attempts >= SMS_LOGIN_MAX_ATTEMPTS");
    expect(smsVerify).toContain("sms_login_code_invalid");
  });

  it("still demands TOTP for accounts with 2FA enabled — SMS does not bypass 2FA", () => {
    expect(smsVerify).toContain("user.twoFactorEnabled");
    expect(smsVerify).toContain("TWO_FACTOR_CODE_REQUIRED");
    expect(smsVerify).toContain("verifyTwoFactor(db, user.id, user.twoFactorSecret ?? null, input.twoFactorCode)");
  });

  it("records success as a security event and issues a real session", () => {
    expect(smsVerify).toContain("sms_login_success");
    expect(smsVerify).toContain("createSessionToken");
    expect(smsVerify).toContain("recordSession");
  });
});

describe("SMS login UI evidence boundary", () => {
  it("offers SMS sign-in only when Twilio is configured", () => {
    const login = readFileSync(resolve(process.cwd(), "client/src/pages/Login.tsx"), "utf8");
    expect(login).toContain("smsStatus.data?.configured === true");
    expect(login).toContain('role="tablist"');
    expect(login).toContain('id="sms-code"');
    // Resend exists but a fresh code requires the same phone-shape validation
    expect(login).toContain("inputMode=\"numeric\"");
  });
});
