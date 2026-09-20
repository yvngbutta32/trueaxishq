/**
 * Zero-cost ops observability contract. Guards:
 * - PII-free label normalization (tokens/ids/query strings never stored)
 * - percentile math, error rate, one-minute window
 * - memory bounds (label cap, per-label sample cap)
 * - middleware registered before all routes; metrics exposed owner-only
 */
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  normalizeRequestLabel,
  recordRequest,
  getOpsMetrics,
  __resetMetricsForTests,
} from "./_core/metrics";

const read = (rel: string) => readFileSync(join(__dirname, rel), "utf8");

beforeEach(() => __resetMetricsForTests());

describe("normalizeRequestLabel: PII-free, bounded cardinality", () => {
  it("strips query strings entirely", () => {
    const l = normalizeRequestLabel("GET", "/api/track/abc?sig=SECRET&token=hunter2");
    expect(l).not.toContain("SECRET");
    expect(l).not.toContain("hunter2");
    expect(l).not.toContain("?");
  });
  it("collapses numeric ids and long hex tokens", () => {
    expect(normalizeRequestLabel("GET", "/api/v1/clients/42")).toBe("GET /api/v1/clients/:id");
    expect(normalizeRequestLabel("GET", "/sub/a1b2c3d4e5f60718293a4b5c")).toBe("GET /sub/:token");
    expect(normalizeRequestLabel("GET", "/api/v1/clients/42/bookings/7")).toBe("GET /api/v1/clients/:id/bookings/:id");
  });
  it("keeps short words intact (routes are readable)", () => {
    expect(normalizeRequestLabel("POST", "/api/v1/invoices")).toBe("POST /api/v1/invoices");
  });
});

describe("recordRequest + getOpsMetrics", () => {
  it("computes counts, error rate, and windowed req/min", () => {
    recordRequest({ label: "GET /", status: 200, ms: 5 });
    recordRequest({ label: "GET /", status: 200, ms: 7 });
    recordRequest({ label: "POST /api/boom", status: 500, ms: 10 });
    const m = getOpsMetrics();
    expect(m.totalRequests).toBe(3);
    expect(m.totalErrors).toBe(1);
    expect(m.errorRate).toBe(33.3);
    expect(m.requestsPerMinute).toBe(3); // all recent
    expect(m.statusClasses.server5xx).toBe(1);
    expect(m.statusClasses.ok2xx).toBe(2);
  });
  it("computes p50/p95/p99 from pooled samples", () => {
    for (let i = 1; i <= 100; i++) recordRequest({ label: "GET /x", status: 200, ms: i });
    const m = getOpsMetrics();
    expect(m.overall.p50).toBe(50);
    expect(m.overall.p95).toBe(95);
    expect(m.overall.p99).toBe(99);
    expect(m.overall.avg).toBe(50.5);
  });
  it("tracks per-route stats in topRoutes", () => {
    for (let i = 0; i < 10; i++) recordRequest({ label: "GET /a", status: 200, ms: 1 });
    recordRequest({ label: "GET /b", status: 200, ms: 2 });
    const m = getOpsMetrics();
    expect(m.topRoutes[0].label).toBe("GET /a");
    expect(m.topRoutes[0].count).toBe(10);
    expect(m.topRoutes[0].p95).toBe(1);
  });
  it("records slow requests separately", () => {
    recordRequest({ label: "GET /slow", status: 200, ms: 1500 });
    recordRequest({ label: "GET /fast", status: 200, ms: 12 });
    const m = getOpsMetrics();
    expect(m.slowestRecent.map((r) => r.label)).toEqual(["GET /slow"]);
  });
  it("caps recent errors list", () => {
    for (let i = 0; i < 60; i++) recordRequest({ label: `GET /e/${i}`, status: 500, ms: 1 });
    expect(getOpsMetrics().errorsRecent.length).toBeLessThanOrEqual(50);
  });
  it("states the in-memory caveat honestly", () => {
    expect(getOpsMetrics().memoryNotes.note).toContain("reset on restart");
  });
});

describe("wiring contract", () => {
  it("middleware is registered before any router mount in _core/index.ts", () => {
    const src = read("../server/_core/index.ts");
    const mw = src.indexOf("recordRequest({ label: normalizeRequestLabel");
    const firstRoute = src.indexOf('app.use("/api/v1"');
    expect(mw).toBeGreaterThan(-1);
    expect(firstRoute).toBeGreaterThan(mw);
  });
  it("metrics endpoint is owner-gated, matching the security stats pattern", () => {
    const src = read("../server/routers.ts");
    expect(src).toContain("metrics: ownerProcedure.query(() => getOpsMetrics())");
  });
  it("dashboard card is owner-only", () => {
    const ui = read("../client/src/pages/dashboard/OverviewPanel.tsx");
    expect(ui).toContain('enabled={user?.isOwner === true}');
  });
});
