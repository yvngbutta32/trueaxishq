/**
 * TrueAxis HQ — Live connection diagnostics for SMTP and Stripe.
 *
 * Pure classification helpers shared by the system router's testConnections
 * procedure and its tests. Owner-credentialed providers are validated for
 * real (handshake + auth / authenticated API ping) with hard timeouts so a
 * dead provider can never hang the dashboard.
 */

export type ConnectionErrorKind = "auth" | "connectivity" | "tls" | "timeout" | "unknown";

const SMTP_CONNECTIVITY_CODES = new Set([
  "ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENETUNREACH", "ENOTFOUND", "EAI_AGAIN", "EPIPE",
]);

/** Classify a nodemailer failure so the owner sees a human-usable cause, not a stack trace. */
export function classifySmtpError(code: string | undefined, message: string | undefined): ConnectionErrorKind {
  const normalizedCode = code?.toUpperCase() ?? "";
  const normalizedMessage = message?.toLowerCase() ?? "";

  if (normalizedCode === "EAUTH" || normalizedMessage.includes("invalid login") || normalizedMessage.includes("authentication") || /535/.test(normalizedMessage)) return "auth";
  if (SMTP_CONNECTIVITY_CODES.has(normalizedCode)) return "connectivity";
  if (normalizedCode === "ETIMEDOUT") return "timeout";
  if (normalizedMessage.includes("certificate") || normalizedMessage.includes("tls")) return "tls";
  return "unknown";
}

/** Classify a Stripe API failure the same way. */
export function classifyStripeError(err: { type?: string; statusCode?: number; message?: string }): ConnectionErrorKind {
  if (err.type === "StripeAuthenticationError" || err.statusCode === 401 || err.statusCode === 403) return "auth";
  if (err.type === "StripeAPIConnectionError" || err.type === "StripeConnectionError") return "connectivity";
  if (err.type === "StripeRateLimitError") return "timeout";
  return "unknown";
}

class TimeoutSignal extends Error {}

/**
 * Race an async operation against a hard deadline so dead providers can't
 * hang the request. Real provider failures (auth, TLS, connectivity) are
 * preserved for classification; only the deadline becomes a "timeout".
 */
export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<{ ok: true; value: T } | { ok: false; errorKind: "timeout" | "error"; error: unknown }> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const value = await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutSignal(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
    return { ok: true, value };
  } catch (error) {
    return { ok: false, errorKind: error instanceof TimeoutSignal ? "timeout" : "error", error };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
