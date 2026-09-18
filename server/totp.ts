/**
 * TrueAxis HQ — TOTP two-factor authentication (RFC 6238, zero dependencies).
 *
 * Implements the standard 6-digit SHA-1 time-based one-time password used by
 * Google Authenticator, Authy, 1Password, etc., plus base32 encoding and
 * backup-code generation/hashing. All crypto goes through node:crypto.
 */
import { createHmac, randomBytes, createHash, timingSafeEqual } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const DEFAULT_DIGITS = 6;
const DEFAULT_PERIOD_SECONDS = 30;

/** RFC 4648 base32 (no padding). */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of Array.from(buffer)) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

/** Decode base32 (case-insensitive, padding-insensitive). Returns null on invalid input. */
export function base32Decode(input: string): Buffer | null {
  const clean = input.replace(/=+$/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) return null;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Generate a new 20-byte (160-bit) TOTP secret as base32 — the standard Authenticator key size. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** HOTP (RFC 4226) for a specific counter — the core of TOTP. */
export function hotp(secret: Buffer, counter: number, digits = DEFAULT_DIGITS): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  counterBuffer.writeUInt32BE(counter % 2 ** 32, 4);
  const digest = createHmac("sha1", secret).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** digits).padStart(digits, "0");
}

/** TOTP code for a given epoch second. */
export function totpAt(secret: Buffer, epochSeconds: number, digits = DEFAULT_DIGITS): string {
  return hotp(secret, Math.floor(epochSeconds / DEFAULT_PERIOD_SECONDS), digits);
}

/** Current TOTP code for a base32 secret. */
export function currentTotp(base32Secret: string): string {
  const secret = base32Decode(base32Secret);
  if (!secret) throw new Error("Invalid base32 secret");
  return totpAt(secret, Math.floor(Date.now() / 1000));
}

/**
 * Verify a 6-digit code against a base32 secret with a ±1 time-step window
 * (standard Authenticator tolerance for clock drift).
 */
export function verifyTotp(base32Secret: string, code: string, toleranceSteps = 1): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const secret = base32Decode(base32Secret);
  if (!secret) return false;
  const counter = Math.floor(Date.now() / 1000 / DEFAULT_PERIOD_SECONDS);
  for (let step = -toleranceSteps; step <= toleranceSteps; step++) {
    // Timing-safe compare against each candidate.
    const candidate = hotp(secret, counter + step);
    if (timingSafeEqualStr(candidate, code)) return true;
  }
  return false;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** otpauth:// URI for QR-code provisioning in Authenticator apps. */
export function buildOtpAuthUrl(opts: { secret: string; accountLabel: string; issuer?: string }): string {
  const issuer = opts.issuer ?? "TrueAxis HQ";
  const label = encodeURIComponent(`${issuer}:${opts.accountLabel}`);
  const params = new URLSearchParams({ secret: opts.secret, issuer, algorithm: "SHA1", digits: String(DEFAULT_DIGITS), period: String(DEFAULT_PERIOD_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

const BACKUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing 0/O/1/I

/** Generate 8 human-friendly single-use backup codes (e.g. "K7Q2-M4XR-P9WD"). */
export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(12);
    const chars = Array.from(bytes, b => BACKUP_CODE_ALPHABET[b % BACKUP_CODE_ALPHABET.length]);
    codes.push([0, 4, 8].map(start => chars.slice(start, start + 4).join("")).join("-"));
  }
  return codes;
}

/** SHA-256 hex hash for backup-code storage. Dash-insensitive: "AB12-CD34" and "ab12cd34" hash identically. */
export function hashBackupCode(code: string): string {
  const normalized = code.toUpperCase().trim().replace(/[^A-Z0-9]/g, "");
  return createHash("sha256").update(normalized).digest("hex");
}
