import { afterEach, describe, expect, it } from "vitest";
import { getEmailDeliveryStatus, resetEmailTransportCache } from "./_core/email";

const original = {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  from: process.env.SMTP_FROM,
};

afterEach(() => {
  for (const [key, value] of Object.entries({ SMTP_HOST: original.host, SMTP_PORT: original.port, SMTP_USER: original.user, SMTP_PASS: original.pass, SMTP_FROM: original.from })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetEmailTransportCache();
});

describe("transactional email configuration", () => {
  it("reports every missing field when credentials are incomplete", () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
    process.env.SMTP_PORT = "587";
    const status = getEmailDeliveryStatus();
    expect(status.configured).toBe(false);
    expect(status.issues).toEqual(["missing_host", "missing_user", "missing_password", "missing_sender"]);
  });

  it("reports a validated SMTP sender without exposing credentials", () => {
    process.env.SMTP_HOST = "smtp.example.test";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "smtp-user@example.test";
    process.env.SMTP_PASS = "private-secret";
    process.env.SMTP_FROM = "TrueAxis HQ <support@trueaxishq.com>";
    const status = getEmailDeliveryStatus();
    expect(status).toMatchObject({ configured: true, host: "smtp.example.test", port: 587, sender: "TrueAxis HQ <support@trueaxishq.com>", secure: false, issues: [] });
    expect(JSON.stringify(status)).not.toContain("private-secret");
  });

  it("detects implicit TLS on port 465 and rejects invalid ports or senders", () => {
    process.env.SMTP_HOST = "smtp.example.test";
    process.env.SMTP_PORT = "70000";
    process.env.SMTP_USER = "smtp-user@example.test";
    process.env.SMTP_PASS = "private-secret";
    process.env.SMTP_FROM = "not-an-email";
    const invalid = getEmailDeliveryStatus();
    expect(invalid.configured).toBe(false);
    expect(invalid.issues).toEqual(["invalid_port", "invalid_sender"]);

    process.env.SMTP_PORT = "465";
    process.env.SMTP_FROM = "TrueAxis HQ <support@example.test>";
    const secure = getEmailDeliveryStatus();
    expect(secure.configured).toBe(true);
    expect(secure.secure).toBe(true);
  });
});
