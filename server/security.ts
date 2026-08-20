/**
 * TrueAxis HQ — Comprehensive Security System
 *
 * Layers:
 * 1. IP blocklist (permanent + temporary auto-block)
 * 2. Per-IP rate limiting (sliding window, auth endpoints stricter)
 * 3. Per-email failed login tracking with account lockout
 * 4. Suspicious payload pattern detection (SQLi, XSS, path traversal)
 * 5. Full security headers (CSP, HSTS, X-Frame-Options, etc.)
 * 6. DB audit log for all security events
 * 7. Owner notification on high/critical severity events
 *
 * All checks run automatically — zero admin input required.
 */

import { Request, Response, NextFunction } from "express";
import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";
import { securityEvents } from "../drizzle/schema";

// ─── Config ───────────────────────────────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS     = 60_000;   // 1-minute window
const RATE_LIMIT_MAX_GENERAL   = 600;      // general requests per window per IP
const RATE_LIMIT_MAX_AUTH      = 100;      // auth endpoints per window per IP (login/register/oauth only)
const RATE_LIMIT_MAX_AI        = 120;      // AI endpoints per window per IP
const VIOLATION_BLOCK_THRESHOLD = 15;      // violations before auto-block
const BLOCK_DURATION_MS        = 5 * 60_000; // 5-minute auto-block
const FAILED_LOGIN_LOCKOUT     = 5;        // failed attempts before account lockout
const LOCKOUT_DURATION_MS      = 10 * 60_000; // 10-minute account lockout

// ─── In-memory stores (reset on server restart — intentional for lightweight ops) ─
const requestCounts   = new Map<string, { count: number; windowStart: number }>();
const blocklist       = new Set<string>();                      // permanent manual blocks
const blockedUntil    = new Map<string, number>();              // temporary auto-blocks
const violationCounts = new Map<string, { count: number; lastAt: number }>(); // per-IP violation count + TTL
const failedLogins    = new Map<string, { count: number; firstAt: number; lockedUntil?: number }>();
const passwordResetRequests = new Map<string, { count: number; windowStart: number }>();
const PASSWORD_RESET_WINDOW_MS = 60 * 60_000;
const PASSWORD_RESET_MAX_PER_IP = 10;

// ─── Suspicious patterns ─────────────────────────────────────────────────────
const SUSPICIOUS_PATTERNS: RegExp[] = [
  // SQL injection: require SQL context (keyword followed by another SQL keyword or identifier)
  /\b(UNION\s+SELECT|SELECT\s+\*|DROP\s+TABLE|DROP\s+DATABASE|INSERT\s+INTO|DELETE\s+FROM|UPDATE\s+\w+\s+SET)\b/i,
  /<script[\s>]/i,
  /javascript:/i,
  /\.\.[/\\]/,
  /\/etc\/passwd/i,
  /\/proc\/self/i,
  /\bexec\s*\(/i,
  /\beval\s*\(/i,
  /on(load|error|click|mouseover|focus)\s*=/i,  // HTML event injection
  /data:text\/html/i,                            // data URI injection
  /%3cscript/i,                                  // URL-encoded XSS
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getClientIp(req: Request): string {
  // Express derives req.ip using the configured trust-proxy policy. Do not
  // parse X-Forwarded-For directly: an untrusted client can forge that header.
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function isSuspicious(req: Request): boolean {
  const contentType = req.headers["content-type"] ?? "";
  if (contentType.includes("multipart") || contentType.includes("octet-stream")) return false;
  const toCheck = [
    req.url,
    JSON.stringify(req.query),
    typeof req.body === "object" ? JSON.stringify(req.body) : String(req.body ?? ""),
  ].join(" ");
  return SUSPICIOUS_PATTERNS.some(p => p.test(toCheck));
}

// ─── DB audit log (fire-and-forget, never throws) ────────────────────────────
async function logSecurityEvent(event: {
  eventType: string;
  severity: "low" | "medium" | "high" | "critical";
  ip?: string;
  userId?: number;
  email?: string;
  details?: string;
  userAgent?: string;
}) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(securityEvents).values({
      eventType: event.eventType,
      severity: event.severity,
      ip: event.ip ?? null,
      userId: event.userId ?? null,
      email: event.email ?? null,
      details: event.details ?? null,
      userAgent: event.userAgent ?? null,
      resolved: false,
    });
  } catch {
    // Never let audit logging crash the server
  }
}

// ─── Owner notification (fire-and-forget) ────────────────────────────────────
async function alertOwner(title: string, content: string) {
  try {
    await notifyOwner({ title, content });
  } catch {
    // Never let notification failure crash the server
  }
}

function recordViolation(ip: string, req: Request, reason: string) {
  const now = Date.now();
  const count = (violationCounts.get(ip)?.count ?? 0) + 1;
  violationCounts.set(ip, { count, lastAt: now });
  if (count >= VIOLATION_BLOCK_THRESHOLD) {
    blockedUntil.set(ip, Date.now() + BLOCK_DURATION_MS);
    const details = `IP: ${ip} | Method: ${req.method} | Path: ${req.path} | Reason: auto-blocked after ${count} violations (latest: ${reason}) | UA: ${req.headers["user-agent"] ?? "unknown"} | Time: ${new Date().toISOString()}`;
    console.warn(`[Security] AUTO-BLOCKED — ${details}`);
    logSecurityEvent({ eventType: "ip_blocked", severity: "high", ip, details, userAgent: req.headers["user-agent"] });
    alertOwner("⚠️ Security Alert — IP Auto-Blocked", details);
  }
}

// ─── Account lockout tracking ─────────────────────────────────────────────────
export function recordFailedLogin(email: string, ip: string, req: Request) {
  const key = email.toLowerCase();
  const now = Date.now();
  const existing = failedLogins.get(key);

  if (existing && existing.lockedUntil && now < existing.lockedUntil) {
    // Already locked — just log the attempt
    logSecurityEvent({ eventType: "failed_login_while_locked", severity: "high", ip, email: key, details: `Login attempt on locked account`, userAgent: req.headers["user-agent"] });
    return;
  }

  const count = (existing?.count ?? 0) + 1;
  const firstAt = existing?.firstAt ?? now;

  if (count >= FAILED_LOGIN_LOCKOUT) {
    const lockedUntil = now + LOCKOUT_DURATION_MS;
    failedLogins.set(key, { count, firstAt, lockedUntil });
    const details = `Email: ${key} | IP: ${ip} | Failed attempts: ${count} | Locked for 10 minutes`;
    console.warn(`[Security] ACCOUNT LOCKED — ${details}`);
    logSecurityEvent({ eventType: "account_locked", severity: "critical", ip, email: key, details, userAgent: req.headers["user-agent"] });
    alertOwner("🔒 Security Alert — Account Locked", details);
  } else {
    failedLogins.set(key, { count, firstAt });
    logSecurityEvent({ eventType: "failed_login", severity: count >= 3 ? "medium" : "low", ip, email: key, details: `Failed attempt ${count} of ${FAILED_LOGIN_LOCKOUT}`, userAgent: req.headers["user-agent"] });
    if (count >= 3) {
      alertOwner("⚠️ Security Alert — Multiple Failed Logins", `Email: ${key} | IP: ${ip} | ${count} failed attempts`);
    }
  }
}

export function isAccountLocked(email: string): { locked: boolean; remainingMs?: number } {
  const key = email.toLowerCase();
  const record = failedLogins.get(key);
  if (!record?.lockedUntil) return { locked: false };
  const remaining = record.lockedUntil - Date.now();
  if (remaining <= 0) {
    failedLogins.delete(key); // auto-clear expired lock
    return { locked: false };
  }
  return { locked: true, remainingMs: remaining };
}

export function clearFailedLogins(email: string) {
  failedLogins.delete(email.toLowerCase());
}

/**
 * Limits password-reset requests by source IP without disclosing whether an
 * account exists. The caller should preserve the generic success response.
 */
export function allowPasswordResetRequest(ip: string): boolean {
  const now = Date.now();
  const existing = passwordResetRequests.get(ip);
  if (!existing || now - existing.windowStart >= PASSWORD_RESET_WINDOW_MS) {
    passwordResetRequests.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (existing.count >= PASSWORD_RESET_MAX_PER_IP) return false;
  existing.count++;
  return true;
}

// ─── Manual IP management (called from admin procedures) ─────────────────────
export function manualBlockIP(ip: string) {
  blocklist.add(ip);
  logSecurityEvent({ eventType: "ip_blocked_manual", severity: "high", ip, details: "Manually blocked by admin" });
}

export function unblockIP(ip: string) {
  blocklist.delete(ip);
  blockedUntil.delete(ip);
  violationCounts.delete(ip);
  logSecurityEvent({ eventType: "ip_unblocked", severity: "low", ip, details: "Unblocked by admin" });
}

export function getSecurityStats() {
  return {
    blockedIPs: blockedUntil.size,
    permanentBlocklist: blocklist.size,
    activeWindows: requestCounts.size,
    lockedAccounts: Array.from(failedLogins.entries())
      .filter(([, v]) => v.lockedUntil && v.lockedUntil > Date.now())
      .map(([email, v]) => ({ email, lockedUntil: v.lockedUntil! })),
    topViolators: Array.from(violationCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([ip, data]) => ({ ip, count: data.count })),
  };
}

// ─── Cleanup stale entries every 5 minutes ───────────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [ip, until] of Array.from(blockedUntil.entries())) {
    if (now > until) { blockedUntil.delete(ip); violationCounts.delete(ip); }
  }
  for (const [ip, data] of Array.from(violationCounts.entries())) {
    if (now - data.lastAt > BLOCK_DURATION_MS) violationCounts.delete(ip);
  }
  for (const [ip, data] of Array.from(requestCounts.entries())) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW_MS * 2) requestCounts.delete(ip);
  }
  for (const [email, data] of Array.from(failedLogins.entries())) {
    if (data.lockedUntil && now > data.lockedUntil) failedLogins.delete(email);
    else if (!data.lockedUntil && now - data.firstAt > RATE_LIMIT_WINDOW_MS * 10) failedLogins.delete(email);
  }
  for (const [ip, data] of Array.from(passwordResetRequests.entries())) {
    if (now - data.windowStart >= PASSWORD_RESET_WINDOW_MS) passwordResetRequests.delete(ip);
  }
}, 5 * 60_000);

// ─── Main security middleware ─────────────────────────────────────────────────
export function securityMiddleware(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const now = Date.now();
  const scriptSource = process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline' https://js.stripe.com https://fonts.googleapis.com"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://fonts.googleapis.com";

  // 1. Permanent manual blocklist
  if (blocklist.has(ip)) {
    logSecurityEvent({ eventType: "blocked_request", severity: "high", ip, details: `Blocked IP attempted access: ${req.method} ${req.path}` });
    return res.status(403).json({ error: "Access denied." });
  }

  // 2. Temporary auto-block
  const blockExpiry = blockedUntil.get(ip);
  if (blockExpiry && now < blockExpiry) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  // 3. Security headers — apply to ALL responses including static assets
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      scriptSource,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://api.stripe.com https://fonts.googleapis.com https://d2xsxph8kpxj0f.cloudfront.net https://api.manus.im https://*.manus.space https://*.manus.computer wss: ws: https:",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "frame-ancestors 'self' https://*.manus.space https://*.manus.computer https://*.trueaxishq.com https://trueaxishq.com https://www.trueaxishq.com https://*.trueaxis-hq.com",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; ")
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.removeHeader("X-Powered-By");
  res.removeHeader("Server");

  // Rate limiting — only applies to /api/ routes, never to static assets
  const isApiRoute = req.path.startsWith("/api/");
  if (!isApiRoute) {
    return next();
  }
  // auth.me is a read-only session check called on every page load — use general limit
  const isAuthMeRoute = req.path.includes("auth.me") || req.path.includes("auth%2Eme");
  // Strict auth limit only for actual login/register/password mutation endpoints
  const isAuthRoute = !isAuthMeRoute && (req.path.includes("/oauth") || req.path.includes("auth.login") || req.path.includes("auth.register") || req.path.includes("auth.forgotPassword") || req.path.includes("auth.resetPassword"));
  const isAIRoute   = req.path.includes("/ai") || req.path.includes("/pulse") || req.path.includes("/followUps");
  const maxRequests = isAuthRoute ? RATE_LIMIT_MAX_AUTH : isAIRoute ? RATE_LIMIT_MAX_AI : RATE_LIMIT_MAX_GENERAL;

  const entry = requestCounts.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    requestCounts.set(ip, { count: 1, windowStart: now });
  } else {
    entry.count++;
    if (entry.count > maxRequests) {
      recordViolation(ip, req, "rate limit exceeded");
      return res.status(429).json({ error: "Too many requests. Please slow down." });
    }
  }

  // 4. Suspicious payload detection
  if (isSuspicious(req)) {
    recordViolation(ip, req, "suspicious payload");
    const details = `IP: ${ip} | ${req.method} ${req.path} | UA: ${req.headers["user-agent"] ?? "unknown"}`;
    logSecurityEvent({ eventType: "suspicious_payload", severity: "high", ip, details, userAgent: req.headers["user-agent"] });
    alertOwner("⚠️ Security Alert — Suspicious Payload Detected", details);
    return res.status(400).json({ error: "Invalid request." });
  }

  next();
}

// ─── Exported log helper for use in routers ──────────────────────────────────
export { logSecurityEvent, alertOwner };
