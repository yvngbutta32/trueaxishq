const trustedProductionHosts = new Set([
  "trueaxishq.com",
  "www.trueaxishq.com",
]);

/**
 * Checkout return URLs are created from a public token flow. Restrict them to
 * the known application hosts (and local/preview development) rather than
 * accepting any syntactically valid URL as an open post-payment redirect.
 */
export function getTrustedPaymentReturnOrigin(origin: string): string | null {
  try {
    const url = new URL(origin);
    if (url.origin !== origin || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    const local = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    const production = url.protocol === "https:" && trustedProductionHosts.has(url.hostname);
    return local || production ? origin : null;
  } catch {
    return null;
  }
}
