const publicRecoveryPrefixes = [
  "/book/",
  "/booking/manage/",
  "/intake/",
  "/portal/",
  "/proposal/",
  "/testimonial/",
] as const;

/**
 * A public, token or slug-based link can legitimately resolve to NOT_FOUND when
 * it has expired, was revoked, or was mistyped. Those pages render their own
 * recovery experience, so they should be observable as informational recovery
 * events rather than reported as global application failures.
 */
export function isExpectedPublicRecoveryPath(pathname: string): boolean {
  return publicRecoveryPrefixes.some((prefix) => pathname.startsWith(prefix));
}
