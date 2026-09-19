/* SMS magic-link login core: one-time 6-digit codes, HMAC-hashed at rest.
 * Mirrors the password-reset contract (never reveals whether a phone belongs
 * to an account) and the email/SMS delivery contract (console-mode degrade is
 * never treated as a sent message).
 */
import { createHmac, randomInt } from "node:crypto";
import { ENV } from "./env";

/** Code lifetime — short, like a TOTP window. */
export const SMS_LOGIN_CODE_TTL_MS = 10 * 60 * 1000;
/** Max wrong-code attempts before the issued code is burned. */
export const SMS_LOGIN_MAX_ATTEMPTS = 5;
/** Per-IP request ceiling per hour (matches password-reset posture). */
export const SMS_LOGIN_MAX_REQUESTS_PER_IP = 10;
/** Per-phone request ceiling per hour — silent, no enumeration. */
export const SMS_LOGIN_MAX_REQUESTS_PER_PHONE = 3;

const REQUEST_WINDOW_MS = 60 * 60 * 1000;
const ipRequests = new Map<string, { count: number; windowStart: number }>();
const phoneRequests = new Map<string, { count: number; windowStart: number }>();

function allowFrom(map: Map<string, { count: number; windowStart: number }>, key: string, max: number): boolean {
  const now = Date.now();
  const entry = map.get(key);
  if (!entry || now - entry.windowStart >= REQUEST_WINDOW_MS) {
    map.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

/** Sliding-window limiter: per-IP AND per-phone, both must pass. Silent drops look identical to sends. */
export function allowSmsLoginRequest(ip: string, phone: string): boolean {
  return allowFrom(ipRequests, ip, SMS_LOGIN_MAX_REQUESTS_PER_IP) && allowFrom(phoneRequests, phone, SMS_LOGIN_MAX_REQUESTS_PER_PHONE);
}

/** Generates a cryptographically random 6-digit code (000000-999999, fixed width). */
export function generateSmsLoginCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** HMAC-SHA256 with the server secret — a leaked database alone cannot reveal codes. */
export function hashSmsLoginCode(phone: string, code: string): string {
  if (!ENV.cookieSecret) throw new Error("Server secret is not configured — cannot protect SMS login codes.");
  return createHmac("sha256", ENV.cookieSecret).update(`${phone}:${code}`).digest("hex");
}

/** Constant-time comparison for the code hash. */
export function verifySmsLoginCodeHash(phone: string, code: string, expectedHash: string): boolean {
  const actual = hashSmsLoginCode(phone, code);
  if (actual.length !== expectedHash.length) return false;
  let mismatch = 0;
  for (let i = 0; i < actual.length; i++) mismatch |= actual.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  return mismatch === 0;
}
