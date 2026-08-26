# TrueAxis HQ Launch Readiness Register

## Validated in the Current Autonomous Release

The client portal provides deterministic next-step guidance and token-scoped proof-of-work data while excluding internal notes and receipt photos. Owner mutations retain final owner-scoped predicates; public photo uploads use short-lived hashed session tokens; and portal access is constrained by both workspace and client identity.

The latest autonomous sequence also added private job-cost attribution, owner-only job-cost portfolio reporting and local margin review signals, token-scoped proposal package selection, proposal validity-date enforcement, client proposal decline capture with owner-only feedback, owner-safe proposal duplication, editable duplicated drafts, and factual public acceptance/Terms copy. These additions preserve their explicit limits: they do not represent payment completion, automatic messaging, job creation, delivery, GPS, accounting sync, or universal legal enforceability.

The current deterministic baseline is **48 Vitest files / 158 tests**, strict TypeScript, successful production builds, production dependency audit evidence, and configured bundle-budget checks. The comprehensive data/error sweep remains a clean inspected baseline; see `trueaxis-comprehensive-data-error-sweep-2026.md`. Public recovery at 375px has prior evidence, but it does not substitute for authenticated mobile validation.

## Open defects and launch gates

| Area | Current state | Required evidence before general launch |
|---|---|---|
| Transactional email | Console fallback is safe; SMTP configuration validation and diagnostics are implemented | Provider credentials, verified sender/domain, and a real inbox delivery test |
| Stripe billing | Test integration exists but the sandbox must be claimed and webhook secret verified | End-to-end checkout, webhook subscription sync, failed-payment, and customer-portal checks |
| Accessibility and mobile | Core portal recovery view checked at 375px; broader route audit remains | Manual checks for booking, portal, dashboard, keyboard focus, touch targets, and error recovery |
| Proof-of-work and proposal flows | Portal guidance, proof timeline, package selection, proposal expiry, decline capture, and owner follow-up workflows are implemented and scoped | Validate representative owner/client data across proposal, signature, package choice, decline, job, progress, completion, and billing transitions |
| Product claims | Competitive roadmap is documented | Keep public claims feature-specific; do not claim universal superiority without user evidence |

## Candid assessment

TrueAxis HQ is a strong controlled-beta release with meaningful security, proposal, job-cost, client-trust, and workflow improvements. It is not yet generally launch-ready because real external delivery and payment verification have not been completed, and a full manual authenticated accessibility/responsive pass still remains. Those gates cannot be honestly marked complete from code-only validation.
