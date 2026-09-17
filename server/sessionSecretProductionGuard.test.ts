import { describe, it, expect, vi, beforeEach } from "vitest";

// Mutable environment mock — auth.ts reads these values at call time, so tests
// can flip production mode and secret presence without re-importing modules.
const envMock = vi.hoisted(() => ({
  cookieSecret: "",
  isProduction: true,
  databaseUrl: "",
}));

vi.mock("./_core/env", () => ({ ENV: envMock }));

import { assertSessionSecretConfigured, createSessionToken } from "./auth";

describe("session secret production guard", () => {
  beforeEach(() => {
    envMock.cookieSecret = "";
    envMock.isProduction = true;
  });

  it("refuses to start in production when JWT_SECRET is missing", () => {
    expect(() => assertSessionSecretConfigured()).toThrow(/JWT_SECRET/);
  });

  it("never signs session tokens with the fallback secret in production", async () => {
    await expect(
      createSessionToken(1, "owner@example.com")
    ).rejects.toThrow(/JWT_SECRET/);
  });

  it("signs session tokens in production when JWT_SECRET is configured", async () => {
    envMock.cookieSecret = "verified-production-secret-value";
    expect(() => assertSessionSecretConfigured()).not.toThrow();
    const token = await createSessionToken(1, "owner@example.com");
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  it("keeps the documented development fallback for local runs", async () => {
    envMock.isProduction = false;
    envMock.cookieSecret = "";
    expect(() => assertSessionSecretConfigured()).not.toThrow();
    const token = await createSessionToken(1, "owner@example.com");
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });
});
