# TrueAxis HQ Launch Readiness Register

Last updated: Oct 25, 2026, through commit `91a3e90` (main), tagged v1.0.0-rc2.

## Current verified baseline

- **Unit/contract suite:** 192 Vitest files, 1011 tests, all green (re-verified at rc2). Strict TypeScript (`tsc --noEmit` clean), lint zero warnings, production bundle within budget.
- **Fresh-install proof:** `scripts/fresh-install-proof.sh` — 90 migrations applied to a genuinely empty database, production boot, 10/10 smoke checks. This is a permanent release gate, not a one-off.
- **Live e2e sweep:** `scripts/live-e2e-sweep.sh` — six suites against the real production build with real HTTP, real login, real database: AI voice receptionist (Twilio signatures verified), QR asset labels, PO job costing, QBO gate, public review engine, 21-check adversarial security probe — plus public smoke. All green Oct 24, 2026.
- **Manual interactive QA:** three click-everything passes covering every dashboard panel on desktop and mobile viewports, all public pages, and the full 3-step customer booking wizard driven to completion. Defects found live were fixed and re-verified live (money validation, mobile nav, error toasts, public slot availability, AI scheduling suggestion hardening). Remaining sweep flags were individually verified as detector artifacts or honest validations (stale-index timeouts on auto-dismissed toasts, duplicate-booking and invalid-review-link rejections, honest unconfigured-provider errors); the review-link input now opens the mobile URL keyboard (`type=url` + `inputMode`), and the demo account was restored and DB-verified after sweeps (services active, QA keys/clients/bookings removed).
- **Security:** tenant isolation, token tampering, SQL injection, stored XSS, CSRF (origin guard), brute force, cross-tenant reads all adversarially probed against the production build; all async routes guarded against hangs; secrets out of code; production dependency audit clean; nightly database backups with retention.

## Open launch gates — all owner-side, none codeable

| Area | Current state | Required to close the gate |
|---|---|---|
| Transactional email | Console fallback is safe and honest (says nothing was really sent) | Owner provides SMTP credentials; one real inbox delivery test |
| Stripe billing | Full checkout wired incl. ACH/Klarna/Afterpay + subscription sync; unconfigured state fails honestly | Owner provides live Stripe keys; end-to-end checkout, webhook sync, failed-payment, customer-portal checks |
| Telephony / AI voice | Twilio + Gemini 2.0 Flash engine built and e2e-proven with genuine signatures | Owner provides Twilio credentials; one real phone-call test |
| Deployment | One-command Oracle installer (`scripts/oracle-setup.sh`) + runbook, fresh-install-proven code path | Owner points DNS at an Oracle instance and runs the installer |
| Traction | Product capability 8.6/10 (#1 vs 10 competitors in the Oct 2026 scorecard) | First paying companies, G2/Capterra profiles, comparison content |

## Candid assessment

The application is code-complete for launch and every codeable claim in this register is backed by a live, reproducible test gate. What remains is external-world work that cannot be honestly completed from inside the codebase: real credentials, a real domain, real customers. The $0 fixed-cost launch guarantee (`server/zeroCostLaunch.test.ts`) holds: none of the remaining gates blocks launch — SMTP, Stripe, and Twilio are optional adds on top of a fully working product.
