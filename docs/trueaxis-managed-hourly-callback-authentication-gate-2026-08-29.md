# Managed Hourly Callback Authentication Gate

**Date:** 2026-08-29  
**Scope:** Reliability architecture assessment; no scheduler implementation change

## Observed state

The application’s hourly maintenance sequence currently starts at server boot and uses `setTimeout` followed by `setInterval`. It invokes eight deterministic routines: overdue detection, recurring invoices, stale follow-up reminders, follow-up rules, monthly reports, booking reminders, post-session check-ins, and due workflow automations.

The project contains a managed scheduling client capable of creating a callback at `/api/scheduled/*`. However, the application’s active self-hosted authentication code validates only local email/password session JWTs stored in `userSessions`. It has no managed-cron identity branch, no cron task identifier on its authenticated user type, and no callback verification helper. The legacy bootstrap command confirmed that it cannot add the required identity support because the managed scheduling client file already exists; it points to legacy patches for files that are absent from this project.

The only existing scheduled handler uses an unrelated custom header secret. During prior inspection, that secret was not configured and the managed daily-digest task had recorded 403 failures. The scheduler helper guidance requires callbacks to derive authorization from a platform-authenticated task identity rather than caller-controlled body fields.

## Decision

No managed hourly callback was created and no endpoint was changed to trust an unverified header, body field, task name, or externally supplied identifier. The selected managed hourly callback remains the preferred architecture once its identity-verification boundary is available and can be controlled through a deployed callback run.

## Explicit limits

This assessment does not establish current scheduler execution, message delivery, background task outcomes, platform callback behavior, provider behavior, live run status, or production operation.
