# TrueAxis HQ managed retry scheduling boundary — 2026-08-27

## Decision

Managed periodic recovery has **not** been activated for durable Stripe events or outbound workflow webhooks. The existing manual due-event and due-delivery controls remain the supported recovery path for this release.

## Evidence

The project includes the Heartbeat client helper, but its self-contained email/password authentication stack does not include the SDK-based cron caller authentication required by the managed scheduling contract. In particular, there is no compatible request-authentication implementation that establishes the trusted cron identity and task UID required to scope a scheduled callback safely. Adding an endpoint that trusts request payload, a static guessed header, ordinary user cookies, or a process-local timer would weaken the authenticated recovery boundary or fail under autoscaling.

| Required property | Current state | Decision |
| --- | --- | --- |
| Durable event state | Delivered for Stripe and outbound workflow retries | Retain |
| Manual bounded recovery | Delivered through owner-protected controls | Retain |
| Cron caller authentication with task UID | Not compatible with the current self-contained auth core | Defer |
| Project-managed periodic trigger | Requires a deployed, authenticated `/api/scheduled/*` callback | Do not create |
| In-process timer | Not durable on autoscaling infrastructure | Prohibited |

> A future scheduling milestone must first introduce a reviewed cron-authentication adapter that validates a managed cron identity, obtains an unforgeable task UID, looks up the designated recovery configuration only by that UID, and returns idempotent JSON responses. It must be published before any schedule is created or activated.

This is a security and reliability boundary, not an assertion that external providers, downstream receivers, or automatic recovery are complete.
