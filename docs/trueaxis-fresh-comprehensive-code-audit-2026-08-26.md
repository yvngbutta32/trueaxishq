# TrueAxis HQ — Fresh Comprehensive Code, Data, and Runtime Audit

**Prepared:** August 26, 2026  
**Evidence labels:** Implemented and validated; Live data inspection; External validation gate

## Scope and Method

This audit was a fresh review after the prior comprehensive sweep. It inspected public and protected procedure boundaries, final database-write predicates, caller-controlled origin handling, public response projections, job activity visibility, selected live cross-record integrity, recent runtime events, production dependencies, strict TypeScript, the deterministic suite, production build, and configured bundle budgets.

The review found and repaired **nine confirmed autonomous issues**. No migration was required and no existing data was modified. The repairs all target final server-side predicates or response projections rather than relying on client-side behavior.

## Confirmed Findings and Repairs

| Area | Confirmed issue | Repair applied | Regression evidence |
|---|---|---|---|
| Invite registration | A prior invite-code read could race with account creation, allowing concurrent attempts to pass the initial single-use check. | The registration route atomically claims an unused, unrevoked, unexpired invite before account creation and releases only an unassigned tentative claim if creation fails. | `inviteCodeAtomicClaim.test.ts` |
| Password reset token | Two concurrent reset submissions could both read an unused token before it was marked used. | The server atomically consumes a currently unused, unexpired token before the password write. | `passwordResetAtomicConsume.test.ts` |
| Password reset origin | The reset email could reflect a caller-supplied origin into a credential-bearing link. | Reset links now use the existing trusted application-origin policy, with the production TrueAxis HQ origin as safe fallback. | `passwordResetOriginPolicy.test.ts` |
| One-time booking links | Concurrent cancellation or rescheduling through a one-time link could apply duplicate or conflicting changes. | The transaction now consumes the valid one-time token before changing the booking and verifies affected rows. | `bookingTokenAtomicConsume.test.ts` |
| Client-portal booking actions | Concurrent portal cancel/reschedule actions could write from stale booking state and still emit side effects. | Both actions now condition their final write on the originally read scheduled date and time and require a successful affected-row result before notification. | `portalBookingStatePredicate.test.ts` |
| Testimonial submission | Concurrent uses of a testimonial token could create duplicate owner-facing side effects. | The final update is constrained to `requested` status and only the winning update emits side effects. | `testimonialAtomicSubmission.test.ts` |
| Portal client, invoice, and booking data | Broad row reads exposed owner-only profile, invoice, or appointment metadata within a valid portal response. | Public portal responses now use explicit client-safe projections only. | `portalClientProfileProjection.test.ts` |
| Client job timeline | Filtering only `internal_note` allowed other staffing, template, dispatch, and planning events to reach the client timeline. | A shared explicit allowlist now permits only deliberate client updates, status changes, and approval events. | `clientSafeJobActivity.test.ts`; `clientProofTimeline.test.ts` |
| Public intake form | The public intake response returned an internal owner ID through a broad form object spread. | The response now returns an explicit public-safe form projection while retaining the owner ID only for server-side host lookup. | `publicIntakeProjection.test.ts` |

> The audit did not add claims about provider delivery, payment completion, legal enforceability, automated messaging, or external service behavior. It strengthened application-level controls that can be tested locally.

## Live Data and Runtime Evidence

Selected live integrity checks returned zero mismatches for invoice-to-client ownership, job-to-client ownership, expense-to-job ownership, approval-to-client/job ownership, document-to-client ownership, and orphan job tasks. The runtime review showed expected invalid-token recovery 404 responses. The managed development environment continues to log an external port-3000 contention event; this is a sandbox/preview constraint, not an application binding defect.

| Validation gate | Result |
|---|---|
| Strict TypeScript | Passed. |
| Deterministic suite | **57 test files / 174 tests passed**. |
| Production dependency audit | Passed; no known production vulnerabilities reported. |
| Production build | Passed. |
| Asset budget | Passed: application entry 515.4 KiB / 560 KiB; dashboard route 573.6 KiB / 650 KiB; home route 112.6 KiB / 140 KiB; charts vendor 424.7 KiB / 500 KiB; CSS 222.6 KiB / 240 KiB. |
| Fresh selected live integrity checks | Zero issues across seven inspected owner-mismatch/orphan categories. |

## Remaining External Validation Gates

The audit does not replace real SMTP delivery and sender-domain validation, Stripe Checkout and signed webhook confirmation, real integration provider authorization, signed webhook receipt by an external HTTPS endpoint, or authenticated owner/client end-to-end responsive testing—including 375px Field Mode handoff. These remain external evidence gates and are not represented as complete.
