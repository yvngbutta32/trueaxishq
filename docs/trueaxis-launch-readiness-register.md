# TrueAxis HQ Launch Readiness Register

## Validated in the current release

The client portal now provides deterministic next-step guidance, prioritizing overdue payment recovery, then invoices awaiting review, client input requests, active work, scheduled appointments, and finally a calm up-to-date state. Its proof-of-work area connects job status, milestones, provider activities, and estimate/in-progress/finished photos through token-scoped public queries. Internal notes and receipt photos remain excluded from the client payload.

The security audit also confirmed that owner mutations use owner-scoped predicates at the final write boundary, public photo uploads use short-lived hashed session tokens, and portal data is constrained by both the portal owner and client identity. The latest release passes strict TypeScript, 74 Vitest tests across 16 files, and the production bundle. The mobile recovery screen for an invalid portal link was visually checked at 375px wide.

## Open defects and launch gates

| Area | Current state | Required evidence before general launch |
|---|---|---|
| Transactional email | Console fallback is safe; SMTP configuration validation and diagnostics are implemented | Provider credentials, verified sender/domain, and a real inbox delivery test |
| Stripe billing | Test integration exists but the sandbox must be claimed and webhook secret verified | End-to-end checkout, webhook subscription sync, failed-payment, and customer-portal checks |
| Accessibility and mobile | Core portal recovery view checked at 375px; broader route audit remains | Manual checks for booking, portal, dashboard, keyboard focus, touch targets, and error recovery |
| Proof-of-work timeline | Owner workspace and client progress center are implemented and scoped | Validate representative job data across estimate, work-in-progress, completion, and billing transitions |
| Product claims | Competitive roadmap is documented | Keep public claims feature-specific; do not claim universal superiority without user evidence |

## Candid assessment

TrueAxis HQ is a strong controlled-beta release with meaningful security and workflow improvements. It is not yet generally launch-ready because real external delivery and payment verification have not been completed, and a full manual accessibility pass still remains. Those gates cannot be honestly marked complete from code-only validation.
