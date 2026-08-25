import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const GOOGLE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

type GoogleOAuthStatePayload = {
  userId: number;
  origin: string;
  expiresAt: number;
  nonce: string;
};

function isSafeApplicationOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    const isLocalHttp = parsed.protocol === "http:" && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
    return (parsed.protocol === "https:" || isLocalHttp) && parsed.origin === origin;
  } catch {
    return false;
  }
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createGoogleOAuthState(userId: number, origin: string, secret: string, now = Date.now()): string {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("Invalid Google OAuth owner.");
  if (!isSafeApplicationOrigin(origin)) throw new Error("Invalid Google OAuth origin.");
  if (!secret) throw new Error("Google OAuth state secret is not configured.");

  const payload: GoogleOAuthStatePayload = {
    userId,
    origin,
    expiresAt: now + GOOGLE_OAUTH_STATE_TTL_MS,
    nonce: randomBytes(16).toString("base64url"),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifyGoogleOAuthState(state: string, secret: string, now = Date.now()): Pick<GoogleOAuthStatePayload, "userId" | "origin"> | null {
  if (!state || !secret) return null;
  const [encodedPayload, signature, ...rest] = state.split(".");
  if (!encodedPayload || !signature || rest.length > 0) return null;

  const expectedSignature = sign(encodedPayload, secret);
  const received = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<GoogleOAuthStatePayload>;
    if (!Number.isSafeInteger(payload.userId) || !payload.userId || typeof payload.origin !== "string" || typeof payload.expiresAt !== "number") return null;
    if (payload.expiresAt < now || !isSafeApplicationOrigin(payload.origin)) return null;
    return { userId: payload.userId, origin: payload.origin };
  } catch {
    return null;
  }
}

export const GOOGLE_OAUTH_STATE_TTL = GOOGLE_OAUTH_STATE_TTL_MS;
