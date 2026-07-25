/**
 * Utility helpers for the SkillBridge AI server.
 * Provides timeout wrappers, safe JSON parsing, and other shared utilities.
 */

/**
 * Wraps a promise with a timeout. Throws an error if the promise does not
 * resolve within the specified milliseconds.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = "operation"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[Timeout] ${label} exceeded ${ms}ms`));
    }, ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

/**
 * Safely parses JSON without throwing. Returns null on failure.
 */
export function safeJsonParse<T = unknown>(str: string): T | null {
  try {
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}

/**
 * Sleeps for the specified number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Truncates a string to a maximum length, appending "..." if truncated.
 */
export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + "...";
}

/**
 * Returns a sanitized version of an error message safe to send to clients.
 * Never exposes internal stack traces or system paths.
 */
export function safeErrorMessage(err: unknown, fallback = "An unexpected error occurred. Please try again."): string {
  if (err instanceof Error) {
    // Only pass through safe, user-friendly messages
    const msg = err.message;
    if (msg.length < 200 && !msg.includes("at ") && !msg.includes("/home/") && !msg.includes("node_modules")) {
      return msg;
    }
  }
  return fallback;
}
