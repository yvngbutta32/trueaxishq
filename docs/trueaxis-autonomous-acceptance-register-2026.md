# TrueAxis HQ — Autonomous Acceptance Register

**Status:** active completion register

This register separates the work that can be verified from the source, database, application runtime, and public routes from the work that intrinsically requires a real email provider, payment provider, or authenticated production account. It is intentionally evidence-led: a subsystem is not treated as launch-complete merely because a screen exists.

## Acceptance Matrix

| Subsystem | Autonomous acceptance state | Evidence retained | External-account gate |
|---|---|---|---|
| Public marketing, legal, and pricing | Verified for responsive public entry, factual copy remediation, legal routes, and no fabricated testimonial-style cards | 375px route audit; public-copy remediation; production build | Legal counsel approval remains a business decision, not a code gap |
| Registration, login, password recovery, and session handling | Verified at code and public-entry level | Auth/session regression tests; static audit; 375px entry checks | Controlled account lifecycle test needs a real invited account |
| Booking, cancellation, and rescheduling | Verified for public-token safety, rate limits, and atomic availability behavior | Booking and public-safety regression suites | End-to-end booking with a real business calendar is account-dependent |
| Client Portal, messages, photos, and proof timeline | Verified for portal-token isolation, safe recovery, media restrictions, next-step guidance, and timeline filtering | Portal, photo, clarity, and proof-timeline regression suites | Client-user journey sign-off with a real token is operationally required |
| Proposals, contracts, and signing | Verified for owner isolation, public-token access boundaries, final-write predicates, and invoice conversion linkage | Public proposal and conversion contract tests | Real signature acceptance workflow sign-off requires controlled participants |
| Invoicing, time, recurring billing, and receipt calculations | Verified for owner-scoped writes, job-client attribution, invoice-number uniqueness, and duplicate collision recovery | Live invoice unique index; time-entry integrity tests; production build | Stripe webhook and payment confirmation require Stripe sandbox access |
| Jobs, tasks, photos, Field Mode, and client handoff | Verified for job isolation, photo safety, local draft recovery, retry classification, and client-visible proof timeline | Job workspace, photo-security, Field Mode, and proof-timeline tests | Authenticated 375px Field Mode walkthrough requires an owner session |
| Automation, scheduler, pulse, AI, and follow-up operations | Verified for preview/readiness behavior, action resilience, owner-scoped counters, scheduling/idempotency regressions, and LLM boundary tests | Automation, scheduler/pulse, and preflight regression suites | A controlled live delivery run depends on SMTP and any configured external calendars |
| Owner dashboard, admin, search, services, revenue, templates, and accessibility | Verified for explicit accessible names on remediated icon actions, mobile public navigation, and core admin contracts | Accessibility-control regression suite; responsive public checks | Authenticated owner-panel visual pass needs an owner session |
| Data isolation, storage, API, and security | Verified for final owner predicates in audited mutations, token-scoped public writes, safe storage keys, rate limits, session controls, and no-store API behavior | Security, session, public-safety, photo-security, and mutation-contract suites | Penetration testing by an independent specialist is a separate assurance activity |
| Email and payment delivery | Prepared, but intentionally not treated as delivered | SMTP validation/diagnostics, Launch Readiness center, Stripe integration wiring | Verified SMTP sender/domain, controlled email, claimed Stripe sandbox, webhook secret, and real test payment |

## Verified Autonomous Release Evidence

The current codebase has passed strict TypeScript compilation, a production build, and **92 deterministic Vitest checks across 20 test files** during the current completion pass. Public routes including the homepage, pricing, sign-in, registration, legal pages, and invalid Client Portal recovery have been reviewed at a 375px viewport. Expected invalid-portal responses render recovery UX and are now reported as informational recovery events rather than global client errors.

The live database includes a verified unique index on `(userId, invoiceNumber)`. The index was applied only after confirming no per-owner duplicate invoice numbers existed. The generated stale migration that contained unrelated destructive or drift-prone operations was removed from the migration journal rather than applied.

## Non-Negotiable Provider-Account Gates

The following gates cannot be honestly completed without an external-account action. They do not represent missing code; they represent delivery or live-session verification that must not be fabricated.

| Gate | Required action | Why it cannot be simulated safely |
|---|---|---|
| Transactional email delivery | Configure a verified SMTP sender/domain and provide valid SMTP credentials | Delivery, provider authentication, and sender reputation occur outside the application |
| Stripe payment confirmation | Claim the Stripe sandbox, verify the webhook secret, and perform a test payment | Stripe signs real webhook events and owns the payment state transition |
| Authenticated Field Mode audit | Sign in as an owner and complete the 375px job-to-client handoff | The route correctly requires protected business data and cannot be exposed for unauthenticated testing |
| Controlled end-to-end journey | Use a controlled owner and client account to run booking, portal, payment, reset, and document flows | The test must cross real session, token, and delivery boundaries |

> **Release claim discipline:** TrueAxis HQ may be described as comprehensively hardened and validated for autonomous code, public UX, and tested data boundaries. It must not be described as fully launch-certified until the provider-account gates above have been completed and recorded.
