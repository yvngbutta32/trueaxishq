# TrueAxis HQ — Deep Adversarial Code and Data Audit

**Prepared:** August 26, 2026  
**Evidence labels:** Implemented and validated; Live data inspection; External validation gate

## Scope and Method

This review went beyond the previous comprehensive audit by tracing credential-bearing link construction, final state transitions, side-effect ordering, public response projections, public upload sessions, owner-email uniqueness, and booking submission concurrency. The review intentionally looked for defects that ordinary happy-path tests often miss: stale reads followed by writes, caller-controlled redirect origins, broad row serialization, and quota checks performed after resource creation.

The audit found and repaired **thirteen confirmed autonomous issues**. The repairs use explicit server-side predicates, transaction boundaries, trusted-origin validation, and narrowed projections. The one schema change was reviewed, additive, and applied only after a live duplicate-owner-email query returned zero rows.

## Confirmed Findings and Repairs

| Area | Confirmed issue | Repair | Evidence |
|---|---|---|---|
| Testimonial email link | Owner-provided origin could place a testimonial token inside an untrusted emailed URL. | Testimonial request links now require the trusted application-origin policy. | `testimonialRequestOriginPolicy.test.ts` |
| One-time booking reschedule | A booking could change after token consumption if an owner or another action had changed its original state. | Final update now requires scheduled status and the originally viewed date/time. | `bookingTokenAtomicConsume.test.ts` |
| Public portal messages | Broad message rows exposed owner/client IDs and read metadata to a portal token holder. | Public list now returns only ID, sender role, body, and timestamp. | `portalMessageProjection.test.ts` |
| Client approval response | Concurrent replies could attempt side effects after the request had ceased to be pending. | The response activity is written only after the conditional pending-state update wins. | `approvalAtomicResponse.test.ts` |
| Public upload quota | Parallel uploads could each pass a stale count check and exceed the session file limit. | A session slot is atomically reserved before storage. | `publicUploadQuotaAtomic.test.ts` |
| Intake upload session | Parallel form submissions could reuse the same upload session and duplicate response/photo effects. | A valid unconsumed intake session is atomically consumed before response insertion. | `intakeUploadSessionAtomicConsume.test.ts` |
| Booking upload session | Parallel booking submissions could reuse a booking upload session and duplicate downstream effects. | A valid unconsumed booking session is atomically consumed before client/booking work. | `bookingUploadSessionAtomicConsume.test.ts` |
| Booking client upsert | Public slot attempts could create client records before slot reservation; concurrent records with the same workspace email were not database-constrained. | Booking slot reservation, client upsert, and client-link update now occur in one transaction; the reviewed additive `clients_user_email_unique_idx` prevents duplicate owner-email rows. | `publicBookingClientUpsertAtomic.test.ts`; reviewed `0042_bright_molten_man.sql` |
| Public booking date | The server accepted arbitrary non-empty dates, including past dates. | Date input is constrained to ISO calendar format and rejected when before the server’s current UTC date. | `publicBookingDateValidation.test.ts` |
| Owner invoice Checkout | A caller-provided origin could control hosted-payment return URLs. | Owner invoice Checkout now uses the trusted origin policy. | `ownerInvoiceCheckoutOriginPolicy.test.ts` |
| Stripe billing portal | A caller-provided origin could control the billing-portal return URL. | Billing portal return URL now uses the trusted origin policy. | `stripeBillingPortalOriginPolicy.test.ts` |
| Client portal link generation | A caller-provided origin could wrap a portal token in an untrusted generated URL. | Generated portal URLs now require a trusted origin. | `clientPortalTokenOriginPolicy.test.ts` |
| Proposal delivery link | A caller-provided origin could wrap the public proposal token in an untrusted email URL. | Proposal delivery links now require a trusted origin. | `proposalDeliveryOriginPolicy.test.ts` |

> None of these repairs establish external delivery, payment completion, customer identity, legal enforceability, or provider availability. They are application-level controls with deterministic evidence.

## Validation Evidence

| Gate | Result |
|---|---|
| Live duplicate-owner-email preflight | Zero non-empty duplicate `(userId, email)` pairs before applying the additive unique constraint. |
| Schema change | Reviewed additive migration `0042_bright_molten_man.sql` applied successfully. |
| Strict TypeScript | Passed. |
| Deterministic suite | **69 test files / 187 tests passed**. |
| Production dependency audit | Passed; no known production vulnerabilities reported. |
| Production build | Passed. |
| Asset budget | Passed: application entry 515.4 KiB / 560 KiB; dashboard route 573.6 KiB / 650 KiB; home route 112.6 KiB / 140 KiB; charts vendor 424.7 KiB / 500 KiB; CSS 222.6 KiB / 240 KiB. |

## Remaining External Limits

The audit does not substitute for real SMTP sender and domain validation, Stripe Checkout plus signed webhook observation, authorized third-party integrations, an external signed-webhook receiver, or authenticated owner/client accessibility and mobile Field Mode journeys. Those remain deliberately open until controlled live evidence exists.
