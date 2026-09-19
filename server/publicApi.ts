/* TrueAxis HQ — Public REST API v1
 * Owner-generated API keys (see the Developer API panel) unlock read/write
 * access at /api/v1 for Zapier, custom scripts, and third-party integrations.
 *
 * Design rules:
 * - Every request authenticates with `Authorization: Bearer tah_live_...`.
 *   Keys are stored as SHA-256 hashes; revoked keys fail closed.
 * - Every query is owner-scoped by the key's user — no endpoint can read or
 *   write another tenant's data.
 * - A per-key in-memory rate limit (600 req/min) backs up the global /api
 *   limiter so one noisy integration can't degrade the app.
 * - Responses are stable JSON: { data } on success, { error: { code, message } }
 *   on failure, with X-RateLimit-* headers on every authenticated call.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq, isNull, like, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "./db";
import { userApiKeys, clients, jobs, invoices, proposals } from "../drizzle/schema";

export const publicApiRouter = Router();

// ── Key format & hashing ──────────────────────────────────────────────────────
// Keys are issued by the apiKeys tRPC router (Settings > API Keys):
//   sk_live_<48 hex>   — hashed with SHA-256, stored in userApiKeys.
export const API_KEY_PREFIX = "sk_live_";
export const hashApiKey = (key: string): string => createHash("sha256").update(key).digest("hex");

// ── Per-key rate limiting (in-memory sliding window) ──────────────────────────
const RATE_LIMIT_MAX = 600;
const RATE_LIMIT_WINDOW_MS = 60_000;
const keyHits = new Map<string, number[]>();
const pruneKeyHits = (mapKey: string, now: number) => {
  const hits = (keyHits.get(mapKey) ?? []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (hits.length) keyHits.set(mapKey, hits); else keyHits.delete(mapKey);
  return hits;
};

// ── Auth middleware ───────────────────────────────────────────────────────────
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiKeyUserId?: number;
      apiKeyId?: number;
    }
  }
}

export async function authenticateKey(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) {
    res.status(401).json({ error: { code: "missing_api_key", message: "Provide an API key: Authorization: Bearer sk_live_..." } });
    return;
  }
  if (!token.startsWith(API_KEY_PREFIX) || token.length !== API_KEY_PREFIX.length + 48) {
    res.status(401).json({ error: { code: "invalid_api_key", message: "This API key is malformed. Create a new key in Settings > API Keys." } });
    return;
  }
  try {
    const db = await getDb();
    if (!db) throw new Error("db unavailable");
    const [record] = await db.select().from(userApiKeys).where(and(eq(userApiKeys.keyHash, hashApiKey(token)), eq(userApiKeys.active, true))).limit(1);
    // Expired keys fail closed the same way revoked ones do.
    // Constant-time comparison on the re-derived hash prevents hash-lookup side channels.
    const expected = Buffer.from(record?.keyHash ?? "", "hex");
    const actual = Buffer.from(hashApiKey(token), "hex");
    if (!record || expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      res.status(401).json({ error: { code: "invalid_api_key", message: "This API key is invalid or has been revoked. Create a new key in Settings > API Keys." } });
      return;
    }
    if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
      res.status(401).json({ error: { code: "expired_api_key", message: "This API key has expired. Create a new key in Settings > API Keys." } });
      return;
    }
    req.apiKeyUserId = record.userId;
    req.apiKeyId = record.id;

    const now = Date.now();
    const hits = pruneKeyHits(`k${record.id}`, now);
    hits.push(now);
    keyHits.set(`k${record.id}`, hits);
    res.setHeader("X-RateLimit-Limit", String(RATE_LIMIT_MAX));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, RATE_LIMIT_MAX - hits.length)));
    if (hits.length > RATE_LIMIT_MAX) {
      res.status(429).json({ error: { code: "rate_limited", message: "API rate limit exceeded (600 requests/minute). Retry shortly." } });
      return;
    }
    // Fire-and-forget usage stamp; failures must never block the request.
    db.update(userApiKeys).set({ lastUsedAt: new Date() }).where(eq(userApiKeys.id, record.id)).catch(() => {});
    next();
  } catch {
    res.status(503).json({ error: { code: "service_unavailable", message: "Database temporarily unavailable. Try again shortly." } });
  }
}

publicApiRouter.use(authenticateKey);

// ── Helpers ──────────────────────────────────────────────────────────────────
const parsePagination = (req: Request) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  return { limit, offset };
};
const sendList = async (res: Response, rows: unknown[], total: number, limit: number, offset: number) => {
  res.json({ data: rows, meta: { total, limit, offset } });
};
const bodyError = (result: { error: z.ZodError }) => {
  const issue = result.error.issues[0];
  return `${issue.path.join(".") || "body"}: ${issue.message}`;
};

// ── Endpoints ─────────────────────────────────────────────────────────────────
publicApiRouter.get("/me", async (req, res) => {
  res.json({ data: { authenticated: true, keyId: req.apiKeyId, scope: "read_write", apiVersion: "v1" } });
});

publicApiRouter.get("/clients", async (req, res) => {
  const db = await getDb();
  if (!db) { res.status(503).json({ error: { code: "service_unavailable", message: "Database temporarily unavailable." } }); return; }
  const { limit, offset } = parsePagination(req);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const scope = and(eq(clients.userId, req.apiKeyUserId!), search ? like(clients.name, `%${search}%`) : undefined);
  const [rows, [{ count }]] = await Promise.all([
    db.select({ id: clients.id, name: clients.name, email: clients.email, phone: clients.phone, service: clients.service, status: clients.status, createdAt: clients.createdAt })
      .from(clients).where(scope).orderBy(desc(clients.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(clients).where(scope),
  ]);
  await sendList(res, rows, Number(count), limit, offset);
});

const createClientSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: z.string().trim().email("Invalid email address").max(320).optional(),
  phone: z.string().trim().max(32).optional(),
  service: z.string().trim().max(255).optional(),
});

publicApiRouter.post("/clients", async (req, res) => {
  const db = await getDb();
  if (!db) { res.status(503).json({ error: { code: "service_unavailable", message: "Database temporarily unavailable." } }); return; }
  const parsed = createClientSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: { code: "invalid_request", message: bodyError(parsed) } }); return; }
  const initials = parsed.data.name.split(/\s+/).map(part => part[0]?.toUpperCase() ?? "").slice(0, 2).join("") || "?";
  const [result] = await db.insert(clients).values({ userId: req.apiKeyUserId!, name: parsed.data.name, email: parsed.data.email || null, phone: parsed.data.phone || null, service: parsed.data.service || null, avatarInitials: initials });
  res.status(201).json({ data: { id: Number(result.insertId), name: parsed.data.name } });
});

const JOB_STATUSES = ["lead", "quoted", "approved", "scheduled", "in_progress", "awaiting_client", "completed", "cancelled"] as const;

publicApiRouter.get("/jobs", async (req, res) => {
  const db = await getDb();
  if (!db) { res.status(503).json({ error: { code: "service_unavailable", message: "Database temporarily unavailable." } }); return; }
  const { limit, offset } = parsePagination(req);
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const scope = and(eq(jobs.userId, req.apiKeyUserId!), (JOB_STATUSES as readonly string[]).includes(status) ? eq(jobs.status, status as never) : undefined);
  const [rows, [{ count }]] = await Promise.all([
    db.select({ id: jobs.id, jobNumber: jobs.jobNumber, title: jobs.title, status: jobs.status, clientId: jobs.clientId, priority: jobs.priority, startDate: jobs.startDate, targetDate: jobs.targetDate, budgetAmount: jobs.budgetAmount, createdAt: jobs.createdAt })
      .from(jobs).where(scope).orderBy(desc(jobs.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(jobs).where(scope),
  ]);
  await sendList(res, rows, Number(count), limit, offset);
});

publicApiRouter.get("/jobs/:id", async (req, res) => {
  const db = await getDb();
  if (!db) { res.status(503).json({ error: { code: "service_unavailable", message: "Database temporarily unavailable." } }); return; }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: { code: "invalid_request", message: "Job id must be a positive integer." } }); return; }
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, req.apiKeyUserId!))).limit(1);
  if (!job) { res.status(404).json({ error: { code: "not_found", message: `No job with id ${id}.` } }); return; }
  res.json({ data: job });
});

const updateJobSchema = z.object({
  status: z.enum(JOB_STATUSES).optional(),
  title: z.string().trim().min(1).max(255).optional(),
  targetDate: z.string().trim().max(32).optional(),
});

publicApiRouter.patch("/jobs/:id", async (req, res) => {
  const db = await getDb();
  if (!db) { res.status(503).json({ error: { code: "service_unavailable", message: "Database temporarily unavailable." } }); return; }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: { code: "invalid_request", message: "Job id must be a positive integer." } }); return; }
  const parsed = updateJobSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: { code: "invalid_request", message: bodyError(parsed) } }); return; }
  if (Object.keys(parsed.data).length === 0) { res.status(400).json({ error: { code: "invalid_request", message: "Provide at least one field to update (status, title, targetDate)." } }); return; }
  const updates: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.status === "completed") updates.completedAt = new Date();
  const [job] = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, req.apiKeyUserId!))).limit(1);
  if (!job) { res.status(404).json({ error: { code: "not_found", message: `No job with id ${id}.` } }); return; }
  await db.update(jobs).set(updates).where(and(eq(jobs.id, id), eq(jobs.userId, req.apiKeyUserId!)));
  res.json({ data: { id, ...parsed.data } });
});

publicApiRouter.get("/invoices", async (req, res) => {
  const db = await getDb();
  if (!db) { res.status(503).json({ error: { code: "service_unavailable", message: "Database temporarily unavailable." } }); return; }
  const { limit, offset } = parsePagination(req);
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const scope = and(eq(invoices.userId, req.apiKeyUserId!), ["draft", "sent", "paid", "overdue"].includes(status) ? eq(invoices.status, status as never) : undefined);
  const [rows, [{ count }]] = await Promise.all([
    db.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, clientName: invoices.clientName, amount: invoices.amount, status: invoices.status, dueDate: invoices.dueDate, createdAt: invoices.createdAt })
      .from(invoices).where(scope).orderBy(desc(invoices.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(invoices).where(scope),
  ]);
  await sendList(res, rows, Number(count), limit, offset);
});

const createInvoiceSchema = z.object({
  clientName: z.string().trim().min(1).max(255),
  clientEmail: z.string().trim().email("Invalid email address").max(320).optional(),
  service: z.string().trim().max(2000).optional(),
  amount: z.number().positive("Amount must be greater than zero").max(10_000_000),
  dueDate: z.string().trim().max(32).optional(),
});

publicApiRouter.post("/invoices", async (req, res) => {
  const db = await getDb();
  if (!db) { res.status(503).json({ error: { code: "service_unavailable", message: "Database temporarily unavailable." } }); return; }
  const parsed = createInvoiceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: { code: "invalid_request", message: bodyError(parsed) } }); return; }
  const now = new Date();
  const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${randomBytes(5).toString("hex").toUpperCase()}`;
  const [result] = await db.insert(invoices).values({
    userId: req.apiKeyUserId!, invoiceNumber, clientName: parsed.data.clientName,
    clientEmail: parsed.data.clientEmail || null, service: parsed.data.service || null,
    amount: String(parsed.data.amount), dueDate: parsed.data.dueDate || null,
  });
  res.status(201).json({ data: { id: Number(result.insertId), invoiceNumber } });
});

publicApiRouter.get("/proposals", async (req, res) => {
  const db = await getDb();
  if (!db) { res.status(503).json({ error: { code: "service_unavailable", message: "Database temporarily unavailable." } }); return; }
  const { limit, offset } = parsePagination(req);
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const scope = and(eq(proposals.userId, req.apiKeyUserId!), ["draft", "sent", "viewed", "signed", "declined"].includes(status) ? eq(proposals.status, status as never) : undefined);
  const [rows, [{ count }]] = await Promise.all([
    db.select({ id: proposals.id, title: proposals.title, clientName: proposals.clientName, total: proposals.total, status: proposals.status, sentAt: proposals.sentAt, createdAt: proposals.createdAt })
      .from(proposals).where(scope).orderBy(desc(proposals.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(proposals).where(scope),
  ]);
  await sendList(res, rows, Number(count), limit, offset);
});

// 404 for unknown /api/v1 paths — consistent error envelope, never the SPA fallback.
publicApiRouter.use((_req, res) => {
  res.status(404).json({ error: { code: "not_found", message: "Unknown API route. See Settings > API Keys for the endpoint reference." } });
});
