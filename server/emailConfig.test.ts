import { afterEach, describe, expect, it } from "vitest";
import { getEmailDeliveryStatus } from "./_core/email";

const original = {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  from: process.env.SMTP_FROM,
};

afterEach(() => {
  process.env.SMTP_HOST = original.host;
  process.env.SMTP_PORT = original.port;
  process.env.SMTP_USER = original.user;
  process.env.SMTP_PASS = original.pass;
  process.env.SMTP_FROM = original.from;
});

describe("transactional email configuration", () => {
  it("reports console fallback when credentials are incomplete", () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    expect(getEmailDeliveryStatus().configured).toBe(false);
  });

  it("reports a validated SMTP sender without exposing credentials", () => {
    process.env.SMTP_HOST = "smtp.example.test";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "smtp-user@example.test";
    process.env.SMTP_PASS = "private-secret";
    process.env.SMTP_FROM = "TrueAxis HQ <support@trueaxishq.com>";
    expect(getEmailDeliveryStatus()).toEqual({
      configured: true,
      host: "smtp.example.test",
      port: 587,
      sender: "TrueAxis HQ <support@trueaxishq.com>",
    });
  });
});
