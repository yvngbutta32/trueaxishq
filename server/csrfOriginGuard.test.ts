// Contract tests for the CSRF origin guard (defense-in-depth layer beyond
// SameSite=Lax). Pins the exact acceptance rules for state-changing requests
// carrying a foreign Origin header.
import { describe, expect, it } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { csrfOriginMiddleware, isAllowedRequestOrigin } from "./security";

const baseReq = (overrides: Partial<Request> = {}): Partial<Request> => ({
  method: "POST",
  hostname: "trueaxishq.com",
  headers: {},
  ...overrides,
});

const res = (): { statusCode?: number; body?: unknown } & Partial<Response> => {
  const r: Record<string, unknown> = {
    status(code: number) { r.statusCode = code; return r as unknown as Response; },
    json(payload: unknown) { r.body = payload; return r as unknown as Response; },
  };
  return r as unknown as { statusCode?: number; body?: unknown } & Partial<Response>;
};

describe("CSRF origin guard — acceptance rules", () => {
  it("allows the exact configured SITE_ORIGIN", () => {
    process.env.SITE_ORIGIN = "https://trueaxishq.com";
    const req = baseReq({ headers: { origin: "https://trueaxishq.com" } });
    expect(isAllowedRequestOrigin("https://trueaxishq.com", req as Request)).toBe(true);
    delete process.env.SITE_ORIGIN;
  });

  it("allows origins matching the request's own host (same-origin SPA)", () => {
    delete process.env.SITE_ORIGIN;
    const req = baseReq({ hostname: "app.example.com" });
    expect(isAllowedRequestOrigin("https://app.example.com", req as Request)).toBe(true);
  });

  it("allows hostname match against configured origin (www/apex + port variants)", () => {
    process.env.SITE_ORIGIN = "https://trueaxishq.com";
    const req = baseReq({ hostname: "proxy-internal" });
    expect(isAllowedRequestOrigin("https://trueaxishq.com:8443", req as Request)).toBe(true);
    delete process.env.SITE_ORIGIN;
  });

  it("allows localhost origins in non-production boots", () => {
    process.env.NODE_ENV = "development";
    const req = baseReq({ hostname: "trueaxishq.com" });
    expect(isAllowedRequestOrigin("http://localhost:5173", req as Request)).toBe(true);
    delete process.env.NODE_ENV;
  });

  it("rejects localhost origins once NODE_ENV=production (no dev bypass)", () => {
    process.env.NODE_ENV = "production";
    process.env.SITE_ORIGIN = "https://trueaxishq.com";
    const req = baseReq({ hostname: "trueaxishq.com" });
    expect(isAllowedRequestOrigin("http://localhost:5173", req as Request)).toBe(false);
    delete process.env.NODE_ENV;
    delete process.env.SITE_ORIGIN;
  });

  it("rejects foreign origins in production even without configuration", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SITE_ORIGIN;
    const req = baseReq({ headers: { origin: "https://evil.example" } });
    expect(isAllowedRequestOrigin("https://evil.example", req as Request)).toBe(false);
    delete process.env.NODE_ENV;
  });

  it("rejects malformed Origin values without crashing", () => {
    const req = baseReq();
    expect(isAllowedRequestOrigin(":::not a url:::", req as Request)).toBe(false);
  });
});

describe("CSRF origin guard — middleware behavior", () => {
  it("blocks a foreign-Origin POST with 403", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SITE_ORIGIN;
    const r = res();
    let called = false;
    csrfOriginMiddleware(
      baseReq({ headers: { origin: "https://evil.example" } }) as Request,
      r as Response,
      (() => { called = true; }) as NextFunction,
    );
    expect(called).toBe(false);
    expect(r.statusCode).toBe(403);
    delete process.env.NODE_ENV;
  });

  it("passes requests with no Origin header (non-browser clients)", () => {
    let called = false;
    csrfOriginMiddleware(
      baseReq() as Request,
      res() as Response,
      (() => { called = true; }) as NextFunction,
    );
    expect(called).toBe(true);
  });

  it("passes same-origin POSTs in production", () => {
    process.env.NODE_ENV = "production";
    process.env.SITE_ORIGIN = "https://trueaxishq.com";
    let called = false;
    csrfOriginMiddleware(
      baseReq({ headers: { origin: "https://trueaxishq.com" } }) as Request,
      res() as Response,
      (() => { called = true; }) as NextFunction,
    );
    expect(called).toBe(true);
    delete process.env.NODE_ENV;
    delete process.env.SITE_ORIGIN;
  });

  it("passes safe methods (GET/HEAD/OPTIONS) regardless of Origin", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      let called = false;
      csrfOriginMiddleware(
        baseReq({ method, headers: { origin: "https://evil.example" } }) as Request,
        res() as Response,
        (() => { called = true; }) as NextFunction,
      );
      expect(called).toBe(true);
    }
  });
});
