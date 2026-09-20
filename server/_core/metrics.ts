/**
 * Zero-cost, zero-dependency request observability.
 *
 * In-memory only (restart clears it — honest caveat, surfaced in output), no
 * external APM, no PII: request labels are normalized (query strings stripped,
 * numeric/hex path segments collapsed to :id/:token) so tokens and IDs never
 * land in metrics. Memory is bounded: per-label latency samples are capped and
 * labels themselves are capped with oldest eviction.
 */

interface LabelStats {
  count: number;
  errors: number;
  /** latency samples (ms), capped ring */
  samples: number[];
  sampleStart: number;
  lastStatus: number;
  lastAt: number;
}

interface RequestRecord {
  label: string;
  status: number;
  ms: number;
  at: number;
}

const MAX_LABELS = 500;
const MAX_SAMPLES_PER_LABEL = 600;
const MAX_SLOW_RECENT = 50;
const MAX_ERRORS_RECENT = 50;
const SLOW_THRESHOLD_MS = 1000;
const ONE_MINUTE_MS = 60_000;

const labels = new Map<string, LabelStats>();
const startedAt = Date.now();
let totalRequests = 0;
let totalErrors = 0;
let recent: RequestRecord[] = []; // all requests last ~60s, for rps
let slowRecent: RequestRecord[] = [];
let errorRecent: RequestRecord[] = [];

/**
 * Normalize a request path into a stable, PII-free label.
 * /api/track/abc123... -> /api/track/:token ; /api/v1/clients/42 -> :id
 */
export function normalizeRequestLabel(method: string, path: string): string {
  const clean = (path || "/").split("?")[0];
  const segments = clean.split("/").map((seg) => {
    if (!seg) return seg;
    if (/^\d+$/.test(seg)) return ":id";
    // long hex (tracking tokens, sub tokens, api keys)
    if (/^[0-9a-f]{16,}$/i.test(seg)) return ":token";
    return seg;
  });
  return `${method} ${segments.join("/")}`.slice(0, 120);
}

function getLabelStats(label: string): LabelStats {
  let stats = labels.get(label);
  if (!stats) {
    if (labels.size >= MAX_LABELS) {
      // evict the oldest-touched label to bound memory
      let oldestKey: string | null = null;
      let oldestAt = Infinity;
      labels.forEach((v, k) => {
        if (v.lastAt < oldestAt) {
          oldestAt = v.lastAt;
          oldestKey = k;
        }
      });
      if (oldestKey) labels.delete(oldestKey);
    }
    stats = { count: 0, errors: 0, samples: [], sampleStart: 0, lastStatus: 0, lastAt: 0 };
    labels.set(label, stats);
  }
  return stats;
}

export function recordRequest(input: { label: string; status: number; ms: number }): void {
  const { label, status, ms } = input;
  const now = Date.now();
  totalRequests += 1;
  const isError = status >= 400;
  if (isError) totalErrors += 1;

  const stats = getLabelStats(label);
  stats.count += 1;
  if (isError) stats.errors += 1;
  stats.lastStatus = status;
  stats.lastAt = now;

  // bounded latency ring
  if (stats.samples.length === 0) stats.sampleStart = now;
  stats.samples.push(ms);
  if (stats.samples.length > MAX_SAMPLES_PER_LABEL) {
    stats.samples.splice(0, stats.samples.length - MAX_SAMPLES_PER_LABEL);
  }

  const record: RequestRecord = { label, status, ms, at: now };
  recent.push(record);
  if (ms >= SLOW_THRESHOLD_MS) {
    slowRecent.push(record);
    if (slowRecent.length > MAX_SLOW_RECENT) slowRecent.shift();
  }
  if (isError) {
    errorRecent.push(record);
    if (errorRecent.length > MAX_ERRORS_RECENT) errorRecent.shift();
  }
  // prune the one-minute window lazily
  while (recent.length > 0 && now - recent[0].at > ONE_MINUTE_MS) recent.shift();
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[idx] * 10) / 10;
}

function summarizeSamples(samples: number[]): { p50: number; p95: number; p99: number; avg: number } {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    avg: samples.length ? Math.round((samples.reduce((a, b) => a + b, 0) / samples.length) * 10) / 10 : 0,
  };
}

export interface OpsMetrics {
  uptimeSeconds: number;
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
  requestsPerMinute: number;
  overall: { p50: number; p95: number; p99: number; avg: number };
  statusClasses: { ok2xx: number; redirect3xx: number; client4xx: number; server5xx: number };
  topRoutes: Array<{
    label: string;
    count: number;
    errors: number;
    p95: number;
    avg: number;
    lastStatus: number;
  }>;
  slowestRecent: Array<{ label: string; ms: number; status: number; at: number }>;
  errorsRecent: Array<{ label: string; status: number; at: number }>;
  memoryNotes: {
    labelCap: number;
    sampleCapPerLabel: number;
    note: string;
  };
}

/** Owner-facing snapshot. In-memory only: restart resets counters. */
export function getOpsMetrics(): OpsMetrics {
  const now = Date.now();
  const overallSamples: number[] = [];
  labels.forEach((s) => overallSamples.push(...s.samples));
  const overall = summarizeSamples(overallSamples);
  // status classes from the last-minute window (representative of current traffic)
  const statusClasses = { ok2xx: 0, redirect3xx: 0, client4xx: 0, server5xx: 0 };
  for (const r of recent) {
    if (r.status < 300) statusClasses.ok2xx += 1;
    else if (r.status < 400) statusClasses.redirect3xx += 1;
    else if (r.status < 500) statusClasses.client4xx += 1;
    else statusClasses.server5xx += 1;
  }

  const topRoutes: OpsMetrics["topRoutes"] = [];
  labels.forEach((s, label) => {
    const sum = summarizeSamples(s.samples);
    topRoutes.push({ label, count: s.count, errors: s.errors, p95: sum.p95, avg: sum.avg, lastStatus: s.lastStatus });
  });
  topRoutes.sort((a, b) => b.count - a.count);
  topRoutes.length = Math.min(topRoutes.length, 12);

  return {
    uptimeSeconds: Math.floor((now - startedAt) / 1000),
    totalRequests,
    totalErrors,
    errorRate: totalRequests ? Math.round((totalErrors / totalRequests) * 1000) / 10 : 0,
    requestsPerMinute: recent.length,
    overall,
    statusClasses,
    topRoutes,
    slowestRecent: slowRecent.map(({ label, ms, status, at }) => ({ label, ms, status, at })),
    errorsRecent: errorRecent.map(({ label, status, at }) => ({ label, status, at })),
    memoryNotes: {
      labelCap: MAX_LABELS,
      sampleCapPerLabel: MAX_SAMPLES_PER_LABEL,
      note: "In-memory metrics only — counters reset on restart. No external APM, no PII stored (labels are path-normalized).",
    },
  };
}

/** Test hook: reset all in-memory state. */
export function __resetMetricsForTests(): void {
  labels.clear();
  recent = [];
  slowRecent = [];
  errorRecent = [];
  totalRequests = 0;
  totalErrors = 0;
}
