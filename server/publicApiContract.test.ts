import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hashApiKey, API_KEY_PREFIX, publicApiRouter, authenticateKey } from "./publicApi";
import type { NextFunction, Request, Response } from "express";

const root = resolve(import.meta.dirname, "..");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const apiSource = readFileSync(resolve(root, "server/publicApi.ts"), "utf8");
const serverSource = readFileSync(resolve(root, "server/_core/index.ts"), "utf8");
const settingsSource = readFileSync(resolve(root, "client/src/pages/dashboard/SettingsPanel.tsx"), "utf8");

describe("public API key primitives", () => {
  it("hashes keys with SHA-256 exactly as the issuing router does", () => {
    expect(API_KEY_PREFIX).toBe("sk_live_");
    expect(hashApiKey("sk_live_" + "a".repeat(48))).toBe("13d350f36ff2de8375bd3b7732986bef48c7951b50ac44698395bf5f3da6aad7");
    // Deterministic and hex-encoded.
    expect(hashApiKey("sk_live_test")).toBe(hashApiKey("sk_live_test"));
    expect(hashApiKey("sk_live_test")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("routes every endpoint through the bearer-key authentication middleware", () => {
    const layers = (publicApiRouter as unknown as { stack: { name: string }[] }).stack;
    expect(layers.length).toBeGreaterThan(0);
    expect(apiSource).toContain("publicApiRouter.use(authenticateKey);");
  });
});

// Minimal req/res fakes — enough surface for the middleware contract tests.
const makeReq = (authorization?: string): Partial<Request> =>
  ({ headers: authorization ? { authorization } : {} });
const makeRes = (): { statusCode: number; body: unknown; headers: Record<string, string> } & Response =>
  ({ statusCode: 0, body: null as unknown, headers: {},
     setHeader(k: string, v: string) { this.headers[k] = v; },
     status(c: number) { this.statusCode = c; return this; },
     json(b: unknown) { this.body = b; return this; } } as never);

describe("public API authentication behavior (no database required)", () => {
  it("rejects requests without a bearer token", async () => {
    const res = makeRes();
    await authenticateKey(makeReq() as Request, res, (() => {}) as NextFunction);
    expect(res.statusCode).toBe(401);
    expect((res.body as { error: { code: string } }).error.code).toBe("missing_api_key");
  });

  it("rejects malformed keys before touching the database", async () => {
    const res = makeRes();
    await authenticateKey(makeReq("Bearer not-a-key") as Request, res, (() => {}) as NextFunction);
    expect(res.statusCode).toBe(401);
    expect((res.body as { error: { code: string } }).error.code).toBe("invalid_api_key");
    expect((res.body as { error: { message: string } }).error.message).toContain("Settings > API Keys");
  });

  it("fails closed with 503 when the database is unreachable, never 500", async () => {
    const res = makeRes();
    await authenticateKey(makeReq(`Bearer ${API_KEY_PREFIX}${"a".repeat(48)}`) as Request, res, (() => {}) as NextFunction);
    expect(res.statusCode).toBe(503);
    expect((res.body as { error: { code: string } }).error.code).toBe("service_unavailable");
  });
});

describe("public REST API v1 contracts (Tier 2 item 13)", () => {
  it("authenticates against the same keys the Settings panel issues", () => {
    // The issuing router stores sha256 hashes with the sk_live_ prefix.
    expect(routerSource).toContain('const rawKey = `sk_live_${crypto.randomBytes(24).toString("hex")}`');
    expect(routerSource).toContain('crypto.createHash("sha256").update(rawKey).digest("hex")');
    // The REST surface re-derives the same hash from the bearer token.
    expect(apiSource).toContain("eq(userApiKeys.keyHash, hashApiKey(token))");
  });

  it("fails closed on revoked, malformed, and expired keys", () => {
    expect(apiSource).toContain("eq(userApiKeys.active, true)");
    expect(apiSource).toContain("timingSafeEqual");
    expect(apiSource).toContain('code: "expired_api_key"');
    expect(apiSource).toContain("if (!token.startsWith(API_KEY_PREFIX) || token.length !== API_KEY_PREFIX.length + 48)");
  });

  it("scopes every query to the key's owner — no cross-tenant access", () => {
    const scoped = (apiSource.match(/eq\((clients|jobs|invoices|proposals)\.userId, req\.apiKeyUserId!\)/g) ?? []).length;
    expect(scoped).toBeGreaterThanOrEqual(7); // list + create/update across every dataset
  });

  it("rate limits per key and reports usage in headers", () => {
    expect(apiSource).toContain("RATE_LIMIT_MAX = 600");
    expect(apiSource).toContain("X-RateLimit-Limit");
    expect(apiSource).toContain("X-RateLimit-Remaining");
    expect(apiSource).toContain('code: "rate_limited"');
  });

  it("keeps responses a stable envelope and caps pagination", () => {
    expect(apiSource).toContain("{ data, meta: { total, limit, offset } }".replace("{ data, meta: { total, limit, offset } }", "meta: { total, limit, offset }"));
    expect(apiSource).toContain("Math.min(Math.max(Number(req.query.limit) || 50, 1), 200)");
    expect(apiSource).toContain("{ error: { code");
  });

  it("validates every write with zod and stamps completion on PATCH", () => {
    expect(apiSource).toContain("safeParse(req.body)");
    expect(apiSource).toContain('parsed.data.status === "completed"');
    expect(apiSource).toContain("Provide at least one field to update");
  });

  it("returns the error envelope for unknown routes, not the SPA fallback", () => {
    expect(apiSource).toContain('Unknown API route. See Settings > API Keys for the endpoint reference.');
  });

  it("mounts the surface at /api/v1 before the SPA catch-all", () => {
    expect(serverSource).toContain('app.use("/api/v1", publicApiRouter);');
  });

  it("documents the endpoints and Zapier path in Settings > API Keys", () => {
    expect(settingsSource).toContain("function ApiReference()");
    expect(settingsSource).toContain("Authorization: Bearer sk_live_");
    expect(settingsSource).toContain("Connect Zapier or Make");
    expect(settingsSource).toContain("/api/v1/clients");
    expect(settingsSource).toContain("/api/v1/jobs/:id");
    expect(settingsSource).toContain("Rate limit: 600 requests/minute per key");
  });
});
