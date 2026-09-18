/**
 * TrueAxis HQ — user-agent parsing for the Active Sessions panel.
 * Dependency-free best-effort classification: browser name, OS, and device type.
 * User agents are untrusted input; this never throws and always returns a string.
 */

export interface DeviceInfo {
  browser: string;
  os: string;
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
  isApp: boolean;
}

export function parseUserAgent(userAgent: string | null | undefined): DeviceInfo {
  const ua = (userAgent ?? "").trim();
  if (!ua) return { browser: "Unknown browser", os: "Unknown OS", deviceType: "unknown", isApp: false };

  // ── OS ────────────────────────────────────────────────────────────────────
  let os = "Unknown OS";
  if (/Windows NT 10/.test(ua)) os = "Windows 10/11";
  else if (/Windows NT/.test(ua)) os = "Windows";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Mac OS X|Macintosh/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/CrOS/.test(ua)) os = "ChromeOS";
  else if (/Linux;|Ubuntu|Fedora/.test(ua)) os = "Linux";

  // ── Browser ───────────────────────────────────────────────────────────────
  let browser = "Unknown browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/SamsungBrowser/.test(ua)) browser = "Samsung Internet";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = "Safari";
  else if (/curl\//i.test(ua)) browser = "curl";

  // WebView / app wrappers — the User-Agent is no longer trustworthy for typing.
  const isApp = /wv\)|WebView|TrueAxisHQ/.test(ua);

  // ── Device type ───────────────────────────────────────────────────────────
  let deviceType: DeviceInfo["deviceType"] = "desktop";
  if (/iPad|Tablet/.test(ua)) deviceType = "tablet";
  else if (/Mobi|iPhone|Android.*Mobile/.test(ua)) deviceType = "mobile";
  else if (/Android/.test(ua)) deviceType = "tablet"; // Android without "Mobile" = tablet

  return { browser, os, deviceType, isApp };
}
