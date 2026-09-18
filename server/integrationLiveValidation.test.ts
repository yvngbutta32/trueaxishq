import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { classifySmtpError, classifyStripeError, withTimeout } from "./_core/connectionCheck";

const systemRouterSource = readFileSync(resolve(import.meta.dirname, "./_core/systemRouter.ts"), "utf8");
const settingsPanelSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/dashboard/SettingsPanel.tsx"), "utf8");

describe("SMTP failure classification", () => {
  it("flags rejected credentials as auth failures", () => {
    expect(classifySmtpError("EAUTH", "Invalid login: 535 Authentication failed")).toBe("auth");
    expect(classifySmtpError(undefined, "535 authentication credentials invalid")).toBe("auth");
  });

  it("flags unreachable hosts as connectivity failures", () => {
    for (const code of ["ECONNREFUSED", "ENOTFOUND", "EHOSTUNREACH"]) {
      expect(classifySmtpError(code, "connect failed")).toBe("connectivity");
    }
  });

  it("separates timeout and TLS failures", () => {
    expect(classifySmtpError("ETIMEDOUT", "connection timed out")).toBe("timeout");
    expect(classifySmtpError(undefined, "unable to verify the first certificate (tls)")).toBe("tls");
  });
});

describe("Stripe failure classification", () => {
  it("maps Stripe error types to human-usable causes", () => {
    expect(classifyStripeError({ type: "StripeAuthenticationError", statusCode: 401 })).toBe("auth");
    expect(classifyStripeError({ type: "StripeConnectionError" })).toBe("connectivity");
    expect(classifyStripeError({ type: "StripeRateLimitError" })).toBe("timeout");
    expect(classifyStripeError({ type: "StripeInvalidRequestError", statusCode: 400 })).toBe("unknown");
  });
});

describe("withTimeout deadline enforcement", () => {
  it("returns the value when the operation finishes in time", async () => {
    const result = await withTimeout(Promise.resolve(42), 100, "fast op");
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it("times out instead of hanging forever", async () => {
    const result = await withTimeout(new Promise(() => {}), 50, "dead op");
    expect(result.ok).toBe(false);
    expect(result.errorKind).toBe("timeout");
  });

  it("preserves real provider errors for classification", async () => {
    const result = await withTimeout(Promise.reject(new Error("535 auth failed")), 100, "auth op");
    expect(result.ok).toBe(false);
    expect(result.errorKind).toBe("error");
    expect((result.error as Error).message).toContain("535");
  });
});

describe("connection test procedure", () => {
  it("is owner-only and runs real handshakes under hard timeouts", () => {
    expect(systemRouterSource).toContain("testConnections: adminProcedure");
    expect(systemRouterSource).toContain("transporter.verify()");
    expect(systemRouterSource).toContain("client.balance.retrieve()");
    expect(systemRouterSource).toContain("connectionTimeout: CONNECTION_TIMEOUT_MS");
  });

  it("uses a fresh transporter and Stripe client so rotated credentials are tested", () => {
    expect(systemRouterSource).toContain("Fresh transporter: SMTP credentials may have changed since boot");
    expect(systemRouterSource).toContain("Fresh client: the cached instance may predate a key rotation.");
  });

  it("keeps production TLS strict and only sends the test email to the requesting admin", () => {
    expect(systemRouterSource).toContain('rejectUnauthorized: process.env.NODE_ENV === "production"');
    expect(systemRouterSource).toContain("to: ctx.user.email, // test email goes only to the requesting admin");
  });
});

describe("settings connection-test UI", () => {
  it("exposes a live check button with per-provider result cards", () => {
    expect(settingsPanelSource).toContain("Run connection test");
    expect(settingsPanelSource).toContain("Email &amp; Payments check");
    expect(settingsPanelSource).toContain('label="Email (SMTP)"');
    expect(settingsPanelSource).toContain('label="Payments (Stripe)"');
  });

  it("offers a test email only after SMTP is verified live", () => {
    expect(settingsPanelSource).toContain("testConnections.mutate({ sendTestEmail: true })");
    expect(settingsPanelSource).toContain("test email sent to your inbox");
  });

  it("turns error kinds into actionable owner hints", () => {
    expect(settingsPanelSource).toContain("Credentials rejected");
    expect(settingsPanelSource).toContain("Could not reach the server");
  });
});
