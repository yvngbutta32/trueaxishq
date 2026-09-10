/**
 * TrueAxis HQ — Self-Contained Email/Password Authentication
 *
 * Self-hosted email/password authentication. Uses:
 * - bcryptjs for password hashing
 * - jose (already installed) for JWT session tokens
 * - Same cookie infrastructure as before
 */

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Request } from "express";
import { parse as parseCookieHeader } from "cookie";
import { getDb } from "./db";
import { users, userSessions } from "../drizzle/schema";
import { and, eq, gt } from "drizzle-orm";
import { ENV } from "./_core/env";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError, UnauthorizedError } from "@shared/_core/errors";
import type { User } from "../drizzle/schema";
import { createHash } from "node:crypto";

const BCRYPT_ROUNDS = 12;

// Dummy hash used for constant-time comparison when user is not found.
// Prevents timing-based email enumeration: without this, an attacker can
// distinguish "email not found" (fast) from "wrong password" (slow bcrypt).
const DUMMY_HASH = "$2a$12$dummyhashfortimingnormalizationXXXXXXXXXXXXXXXXXXXXXXXX";

// ─── Session token helpers ────────────────────────────────────────────────────

function getSessionSecret() {
  const secret = ENV.cookieSecret;
  if (!secret && process.env.NODE_ENV !== "production") {
    console.warn("[Auth] WARNING: JWT_SECRET not set — using insecure fallback. Set JWT_SECRET in production.");
  }
  return new TextEncoder().encode(secret || "fallback-dev-secret-change-in-prod");
}

export async function createSessionToken(userId: number, email: string): Promise<string> {
  const secretKey = getSessionSecret();
  const issuedAt = Date.now();
  const expiresInMs = ONE_YEAR_MS;
  const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);

  return new SignJWT({ userId, email, type: "email_password" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(secretKey);
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function recordSession(userId: number, token: string, req: Request): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(userSessions).values({
    userId,
    tokenHash: hashSessionToken(token),
    ip: req.ip || req.socket?.remoteAddress || null,
    userAgent: req.headers["user-agent"] ?? null,
    isActive: true,
    expiresAt: new Date(Date.now() + ONE_YEAR_MS),
  });
}

export async function revokeSession(token: string | undefined | null, reason: "logout" | "password_changed" | "admin_revoke" = "logout"): Promise<void> {
  if (!token) return;
  const db = await getDb();
  if (!db) return;
  await db.update(userSessions)
    .set({ isActive: false, invalidatedAt: new Date(), invalidationReason: reason })
    .where(and(eq(userSessions.tokenHash, hashSessionToken(token)), eq(userSessions.isActive, true)));
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<{ userId: number; email: string } | null> {
  if (!token) return null;
  try {
    const secretKey = getSessionSecret();
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
    const { userId, email } = payload as Record<string, unknown>;
    if (typeof userId !== "number" || typeof email !== "string") return null;
    return { userId, email };
  } catch {
    return null;
  }
}

// ─── Password helpers ─────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Auth operations ──────────────────────────────────────────────────────────

export async function registerUser(data: {
  name: string;
  email: string;
  password: string;
}): Promise<User> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Normalize email
  const email = data.email.trim().toLowerCase();

  // Check for existing user
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    throw new Error("EMAIL_TAKEN");
  }

  const passwordHash = await hashPassword(data.password);

  // Use email as openId for self-hosted accounts.
  const openId = `email:${email}`;

  await db.insert(users).values({
    openId,
    name: data.name.trim(),
    email,
    loginMethod: "email",
    passwordHash,
    lastSignedIn: new Date(),
  });

  const created = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!created[0]) throw new Error("Failed to create user");
  return created[0];
}

export async function loginUser(data: {
  email: string;
  password: string;
}): Promise<User> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const email = data.email.trim().toLowerCase();
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = result[0];

  if (!user) {
    // Always run bcrypt even when user is not found to prevent timing-based
    // email enumeration. The result is discarded — we always throw INVALID_CREDENTIALS.
    await verifyPassword(data.password, DUMMY_HASH);
    throw new Error("INVALID_CREDENTIALS");
  }
  if (!user.passwordHash) {
    // OAuth-only account — still run bcrypt to normalize timing
    await verifyPassword(data.password, DUMMY_HASH);
    throw new Error("NO_PASSWORD");
  }

  const valid = await verifyPassword(data.password, user.passwordHash);
  if (!valid) throw new Error("INVALID_CREDENTIALS");

  // Update lastSignedIn
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

  return user;
}

// ─── Request authentication ───────────────────────────────────────────────────

export async function authenticateRequest(req: Request): Promise<User> {
  const cookieHeader = req.headers.cookie;
  const cookies = cookieHeader ? parseCookieHeader(cookieHeader) : {};
  const sessionToken = cookies[COOKIE_NAME];

  const session = await verifySessionToken(sessionToken);
  if (!session || !sessionToken) throw UnauthorizedError("Invalid or missing session");

  const db = await getDb();
  if (!db) throw ForbiddenError("Database unavailable");

  const [storedSession] = await db.select({ id: userSessions.id })
    .from(userSessions)
    .where(and(
      eq(userSessions.userId, session.userId),
      eq(userSessions.tokenHash, hashSessionToken(sessionToken)),
      eq(userSessions.isActive, true),
      gt(userSessions.expiresAt, new Date()),
    ))
    .limit(1);
  if (!storedSession) throw UnauthorizedError("Session has expired or been revoked");

  const result = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  const user = result[0];
  if (!user) throw ForbiddenError("User not found");

  return user;
}
