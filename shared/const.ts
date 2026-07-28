// ─── Brand assets ────────────────────────────────────────────────────────────
/** TrueAxis HQ primary logo (full-color, dark background). CDN-hosted, never expires.
 *  ALWAYS import this constant instead of hardcoding the URL anywhere in the codebase. */
export const TRUEAXIS_LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/logo-r1_d9d437c8.png";

// ─── Auth / session ───────────────────────────────────────────────────────────
export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
