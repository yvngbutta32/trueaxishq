# TrueAxis HQ 5/5 Surface Scorecard

This scorecard separates **implemented capability**, **automated evidence**, and **remaining launch verification**. A surface is not labeled launch-ready merely because its code exists.

| Surface | Acceptance criteria | Current evidence | State |
|---|---|---|---|
| Owner dashboard | Clear navigation, resilient panels, useful empty states, accessible controls, scoped metrics | Dashboard contract tests, TypeScript, build, prior responsive remediation | Strong; authenticated manual review remains |
| Client CRM | Owner-only list/search/filter/mutations with no cross-profile access | Database predicates, authorization tests, search/filter remediation | Strong |
| Public intake and booking | Clear form labels, safe unavailable states, throttled submissions, deterministic booking behavior | Public safety and booking tests; mobile unavailable-state check | Strong; live booking journey remains |
| Client portal | Revocable scoped token, clear next step, payments, appointments, messages, photos, proof timeline | Portal clarity tests, photo security tests, proof timeline tests, 375px recovery check | Strong; real-token journey remains |
| Job workspace | Unified client, booking, task, status, activity, cost, invoice, and proof context | Job workspace contract tests and client proof timeline tests | Strong; representative data journey remains |
| Billing and receipts | Owner-scoped invoices/receipts, receipt OCR restrictions, invoice attachment, safe Stripe redirect | Security tests, receipt-path tests, launch readiness signals | Code-ready; Stripe webhook and checkout verification remain |
| Automations | Preview, explicit actions, run history, retries/failure visibility, owner scoping | Automation preview and portal tests; contract coverage | Strong; real delivery observation remains |
| AI assistance | Server-side invocation, bounded inputs, transparent fallback, no arbitrary external URL relay | Receipt OCR ownership hardening and server-side helper architecture | Strong; provider behavior requires controlled test |
| Photos and uploads | Short-lived public session, ownership validation, file-type/size limits, no receipt leakage | Photo upload security tests and portal filtering | Strong |
| Admin/security | Session revocation, rate limits, trusted-proxy handling, CSP/no-store, security events | Security and session contract tests | Strong; operational monitoring remains |
| Mobile/field mode | Operable at 375px, keyboard/touch reachable, fixed UI safe-area aware, readable contrast | Public route screenshots and client portal contrast pass | Partial; authenticated dashboard and field journeys remain |
| Transactional delivery | Safe configuration diagnostics, verified sender/domain, successful inbox delivery, visible failure state | SMTP configuration tests and Launch Readiness UI | Code-prepared; provider credentials and delivery test remain |

## Benchmark interpretation

| Competitor pattern | TrueAxis HQ response | Evidence boundary |
|---|---|---|
| HoneyBook emphasizes broad clientflow coverage and simpler setup than Dubsado | TrueAxis HQ uses preflight checks, explicit next-step guidance, and a unified job/proof timeline | Product code and deterministic tests; no claim of universal ease-of-use |
| Dubsado’s breadth can create setup and automation complexity | TrueAxis HQ exposes automation previews, supported actions, and run diagnostics before activation | Automation contract tests; real operator study still needed |
| Bonsai emphasizes broad business operations and financial coverage | TrueAxis HQ connects job execution evidence to client visibility and billing context | Job/proof model and portal tests; accounting outcomes not yet validated |
| Client portals compete on selective visibility and ease of client use | TrueAxis HQ scopes portal tokens, hides receipt-only media, and presents explicit recovery and next steps | Authorization tests and mobile recovery checks; real client usability study still needed |

## Release scoring rule

A score of 5/5 requires all three layers: the capability is implemented, deterministic or automated evidence covers the critical boundary, and a controlled real-world journey has passed where external providers or authenticated data are involved. Current code quality is high, but the release cannot honestly be called fully launch-ready until the remaining SMTP, Stripe, authenticated journey, and manual accessibility gates pass.
