import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { strongPasswordSchema } from "./passwordPolicy";
import { allowPasswordResetRequest, getClientIp } from "./security";

describe("shared password policy", () => {
  it("accepts a password with letters and a number or symbol", () => {
    expect(strongPasswordSchema.safeParse("TrueAxis2026!").success).toBe(true);
  });

  it("rejects passwords that do not meet the shared complexity policy", () => {
    expect(strongPasswordSchema.safeParse("onlyletters").success).toBe(false);
    expect(strongPasswordSchema.safeParse("12345678").success).toBe(false);
  });
});

describe("request origin safeguards", () => {
  it("uses Express-derived req.ip rather than a directly supplied forwarding header", () => {
    const req = {
      ip: "203.0.113.10",
      headers: { "x-forwarded-for": "198.51.100.50" },
      socket: { remoteAddress: "127.0.0.1" },
    } as unknown as Request;
    expect(getClientIp(req)).toBe("203.0.113.10");
  });

  it("caps password-reset requests per IP inside the hourly window", () => {
    const ip = "198.51.100.220";
    for (let count = 0; count < 10; count++) expect(allowPasswordResetRequest(ip)).toBe(true);
    expect(allowPasswordResetRequest(ip)).toBe(false);
  });
});
