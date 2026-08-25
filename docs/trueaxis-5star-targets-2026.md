# TrueAxis HQ 5/5 Evidence Targets

TrueAxis HQ should compete on observable workflow outcomes rather than broad claims. The following targets define what must be measurable in product tests, controlled journeys, or production telemetry before a superiority statement is used publicly.

| Workflow | Measurable target | Evidence required | Current status |
|---|---|---|---|
| Client-to-cash | A test client can move from inquiry to booked appointment, proposal/contract, invoice, payment, and receipt without leaving the product or encountering an undocumented dead end | Controlled end-to-end journey with success and recovery paths | Partially validated; external Stripe and SMTP gates remain |
| Proof-of-work | A provider can attach scoped estimate, in-progress, and finished evidence to a job, while the client sees only permitted media and status updates | Owner/client fixture journey plus authorization tests | Implemented; representative data journey remains |
| Portal trust | Every client-facing state has a clear next action, safe expired-link recovery, and no internal notes or receipt-only media exposure | Deterministic policy tests, public-route checks, and 375px review | Strongly validated in current release |
| Automation reliability | Every workflow run records outcome, failure reason, retry state, and timestamps without duplicating idempotent actions | Run-history tests and controlled retry/failure scenarios | Implemented; production observation remains |
| Mobile execution | Core booking, portal, dashboard, field, photo, and payment journeys remain readable, keyboard-accessible, and operable at 375px | Route-by-route screenshots plus keyboard/touch review | Partial; public routes checked, authenticated routes remain |
| Security | Cross-tenant reads and writes fail closed at procedure and final database predicate boundaries; public tokens are short-lived, revocable, and scope-limited | Authorization tests, negative tests, and audit review | Strongly validated in current release |
| Delivery visibility | Email and payment integrations expose safe readiness and failure states without leaking credentials or provider internals | Configuration tests, controlled delivery, Stripe webhook verification | Code-prepared; provider verification remains |

## Positioning rule

TrueAxis HQ may claim specific advantages only when the corresponding row has feature evidence and a repeatable workflow result. It should not claim universal superiority, guaranteed revenue outcomes, or future-proof dominance. The defensible message is that TrueAxis HQ is deliberately designed to reduce tool switching, client ambiguity, manual rescue work, and cross-tenant risk, subject to real-world validation.
