/**
 * TrueAxis HQ — Security Middleware
 * - IP-based rate limiting (sliding window)
 * - Automatic IP blocklist for repeated violations
 * - Suspicious pattern detection (SQL injection, XSS probes, path traversal)
 * - Owner notification on attack detection
 * - All checks run automatically with zero admin input required
 */

import { Request, Response, NextFunction } from "express";
import { notifyOwner } from "./_core/notification";

// ─── In-memory stores ─────────────────────────────────────────────────────────
const requestCounts = new Map<string, { count: number; windowStart: number }>();
const blocklist = new Set<string>();
const violationCounts = new Map<string, number>();

// ─── Config ───────────────────────────────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60_000;       // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 120;       // max requests per window per IP
const AUTH_RATE_LIMIT_MAX = 10;            // stricter limit for auth endpoints
const BLOCK_THRESHOLD = 5;                 // violations before auto-block
const BLOCK_DURATION_MS = 15 * 60_000;    // 15 minutes auto-block
const blockedUntil = new Map<string, number>();

// ─── Suspicious patterns ─────────────────────────────────────────────────────
const SUSPICIOUS_PATTERNS = [
  /(\bUNION\b|\bSELECT\b|\bDROP\b|\bINSERT\b|\bDELETE\b|\bUPDATE\b)\s+/i, // SQL injection
  /<script[\s>]/i,                                                              // XSS
  /javascript:/i,                                                               // JS injection
  /\.\.[/\\]/,                                                                  // Path traversal
  /\/etc\/passwd/i,                                                             // File access
  /\/proc\/self/i,                                                              // Linux proc
  /\bexec\s*\(/i,                                                               // Code execution
  /\beval\s*\(/i,                                                               // Eval injection
];

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

function isSuspicious(req: Request): boolean {
  const toCheck = [
    req.url,
    JSON.stringify(req.query),
    typeof req.body === "object" ? JSON.stringify(req.body) : String(req.body ?? ""),
  ].join(" ");
  return SUSPICIOUS_PATTERNS.some(p => p.test(toCheck));
}

async function notifyAttack(ip: string, reason: string, req: Request) {
  const details = `IP: ${ip} | Method: ${req.method} | Path: ${req.path} | Reason: ${reason} | UA: ${req.headers["user-agent"] ?? "unknown"} | Time: ${new Date().toISOString()}`;
  console.warn(`[Security] BLOCKED — ${details}`);
  try {
    await notifyOwner({
      title: "⚠️ Security Alert — Suspicious Activity Detected",
      content: details,
    });
  } catch {
    // Notification failure should never crash the server
  }
}

function recordViolation(ip: string, req: Request, reason: string) {
  const count = (violationCounts.get(ip) ?? 0) + 1;
  violationCounts.set(ip, count);
  if (count >= BLOCK_THRESHOLD) {
    blockedUntil.set(ip, Date.now() + BLOCK_DURATION_MS);
    notifyAttack(ip, `Auto-blocked after ${count} violations (latest: ${reason})`, req);
  }
}

// ─── Cleanup stale entries every 5 minutes ───────────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [ip, until] of Array.from(blockedUntil.entries())) {
    if (now > until) {
      blockedUntil.delete(ip);
      blocklist.delete(ip);
      violationCounts.delete(ip);
    }
  }
  for (const [ip, data] of Array.from(requestCounts.entries())) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      requestCounts.delete(ip);
    }
  }
}, 5 * 60_000);

// ─── Main security middleware ─────────────────────────────────────────────────
export function securityMiddleware(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const now = Date.now();

  // 1. Check permanent blocklist
  if (blocklist.has(ip)) {
    return res.status(403).json({ error: "Access denied." });
  }

  // 2. Check temporary auto-block
  const blockExpiry = blockedUntil.get(ip);
  if (blockExpiry && now < blockExpiry) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  // 3. Rate limiting
  const isAuthRoute = req.path.startsWith("/api/oauth") || req.path.includes("auth");
  const maxRequests = isAuthRoute ? AUTH_RATE_LIMIT_MAX : RATE_LIMIT_MAX_REQUESTS;
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

  // 4. Suspicious pattern detection (skip binary/multipart)
  const contentType = req.headers["content-type"] ?? "";
  if (!contentType.includes("multipart") && !contentType.includes("octet-stream")) {
    if (isSuspicious(req)) {
      recordViolation(ip, req, "suspicious payload pattern");
      notifyAttack(ip, "Suspicious payload pattern detected", req);
      return res.status(400).json({ error: "Invalid request." });
    }
  }

  // 5. Security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  next();
}

// ─── Admin helpers ────────────────────────────────────────────────────────────
export function getSecurityStats() {
  return {
    blockedIPs: blockedUntil.size,
    permanentBlocklist: blocklist.size,
    activeWindows: requestCounts.size,
    topViolators: Array.from(violationCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count })),
  };
}

export function manualBlockIP(ip: string) {
  blocklist.add(ip);
}

export function unblockIP(ip: string) {
  blocklist.delete(ip);
  blockedUntil.delete(ip);
  violationCounts.delete(ip);
}
