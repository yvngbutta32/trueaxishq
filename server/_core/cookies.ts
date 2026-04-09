import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isLocalRequest(req: Request): boolean {
  const hostname = req.hostname;
  return LOCAL_HOSTS.has(hostname) || hostname === "::1";
}

function isSecureRequest(req: Request) {
  // Trust Express's req.secure which respects 'trust proxy' setting
  if (req.secure) return true;
  if (req.protocol === "https") return true;

  // Fallback: check X-Forwarded-Proto header directly
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const isLocal = isLocalRequest(req);
  const isSecure = isSecureRequest(req);

  // Use SameSite=Lax for same-origin requests (frontend + API on same domain).
  // SameSite=None requires Secure=true and is only needed for cross-site cookies.
  // Lax is safer and works correctly when frontend and /api are on the same origin.
  // On localhost (dev), use SameSite=Lax without Secure so cookies work over HTTP.
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isLocal ? false : isSecure,
  };
}
