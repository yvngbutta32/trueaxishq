# TrueAxis HQ durable Stripe event recovery — 2026-08-27

## Delivered foundation

TrueAxis HQ now records a bounded, encrypted Stripe event recovery envelope in its database before returning a successful response to a verified Stripe webhook. The ledger retains the stable provider event ID, event type, processing state, attempt count, next eligible processing time, bounded error evidence, completion time, and a short processing lease. Existing historical idempotency rows remain `processed` through the additive default.

The former process-local retry queue and timer were removed. The application claims eligible durable records atomically, prevents a live processing lease from being duplicated, reclaims only a stale processing lease, retries processing a maximum of five times with increasing delays, and marks exhausted records as `terminal`. A terminal record creates an owner notification for investigation. The owner-admin recovery view deliberately exposes status and bounded diagnostic information only; it does not expose the encrypted event envelope or customer data.

## Operational boundaries

The foundation provides durable **application processing state**, not a guarantee of payment completion, provider delivery, or downstream business completion. Verified Stripe events are acknowledged only after durable receipt succeeds; if storage is unavailable, the application returns a retryable failure instead. The current application opportunistically processes due work when a verified Stripe event arrives and lets the owner run a limited due-event recovery check from the restricted admin console.

> A managed periodic worker is intentionally not enabled in this milestone. The local email/password authentication model must first be reconciled with a securely authenticated managed scheduler callback. No `setInterval`-based retry loop is used for this recovery path.

## Validation and remaining gate

Migration `0053_talented_rockslide.sql` is additive: it adds recovery state, encrypted payload storage, timestamps, bounded attempt evidence, and a due-work index to the existing Stripe event ledger without deleting or changing existing event IDs. Strict TypeScript, focused Stripe policy/recovery tests, the 90-file / 241-test deterministic suite, production build, and configured bundle budgets passed.

Stripe’s official guidance describes database-backed event processing state, duplicate suppression, and returning success for previously processed events during overlapping retries. [1] A controlled Stripe test checkout and signed-webhook sequence, including replay and restart-path verification, is still required before making claims about live provider recovery.

## References

[1]: https://docs.stripe.com/webhooks/process-undelivered-events "Stripe: Process undelivered webhook events"
