# Full Remediation Pass — August 2026

## Verified fixes applied

The server now derives client IP addresses through Express's configured proxy policy instead of trusting raw forwarding headers. Password-reset requests have a dedicated per-IP throttle, and all password-changing flows use one shared strength policy. Client search and status filters execute in SQL rather than filtering full user datasets in memory.

Client portal tokens now support explicit revocation, including enforcement in portal viewing, payments, job photos, messaging, and photo-upload confirmation. The database includes `revoked` and `revokedAt` fields, while the owner API can revoke a client's link.

Background jobs now use a dedicated `jobRunGuards` idempotency table, UTC monthly boundaries, bounded follow-up intervals, and isolated error boundaries for each scheduled job. API cache-control headers are registered before all API routes.

The client portal validates remote image URLs, guards malformed dates, and supports Escape and arrow-key navigation in the photo lightbox. The automation panel tolerates malformed stored action JSON, is responsive on small screens, and keeps its controls keyboard and touch discoverable.

Dashboard feature panels are lazy-loaded behind a shared fallback. This reduced the main Dashboard production chunk from approximately 987 kB to approximately 561 kB before gzip. Public landing copy no longer contains unsupported adoption, revenue, or guarantee claims.

## Validation

TypeScript compilation passed. The Vitest suite passed with 37 tests. The production build passed after chunking changes, and the development server remained healthy with eight background jobs scheduled.
