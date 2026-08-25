# TrueAxis HQ — 5/5 Product Scorecard

**Prepared:** August 25, 2026  
**Purpose:** Establish a defensible quality bar for the full product rather than equating feature count with product excellence.

## Quality Standard

A surface earns a 5/5 only when it is useful, understandable, secure, resilient, responsive, accessible, and observable in production. A workflow is not considered complete merely because its happy path compiles or a database mutation exists.

| Dimension | 5/5 acceptance standard | Evidence required |
|---|---|---|
| Feature depth | The workflow covers the complete customer outcome from setup through completion, including recovery and handoff. | Route audit, user journey test, competitor comparison |
| Usability | A first-time owner can understand the next action without training or hidden configuration. | Guided-flow review and mobile/desktop screenshots |
| Client trust | Client-facing states explain what happened, what happens next, and how to get help. | Portal/booking/payment/error-state review |
| Security | Every read and write is authenticated or deliberately public, scoped by owner/client/token, rate-limited where appropriate, and protected against replay. | Authorization tests, schema review, abuse-path tests |
| Reliability | External failures are bounded, visible, recoverable, and idempotent. | Failure-path tests, health checks, structured logs |
| Accessibility | Keyboard, screen-reader, contrast, focus, reduced-motion, and touch-target requirements are satisfied. | Automated checks plus manual route review |
| Mobile execution | Core work is practical one-handed on a phone, including camera, time, status, and payment tasks. | 375px/768px screenshots and touch-flow review |
| Performance | Initial public surfaces are fast, growing lists are paginated, and expensive work is bounded or asynchronous. | Build output, request/log review, pagination audit |
| Operations | Email, billing, automation, and monitoring expose configuration and delivery state without leaking secrets. | Launch-readiness checks and controlled production tests |

## Current Baseline

TrueAxis HQ already contains an unusually broad client-to-cash foundation: CRM, public intake, booking, proposals, contracts, invoices, recurring invoices, time tracking, expenses, AI assistance, automations, job workspace, proof-of-work photos and receipts, client portal, Stripe integration, local authentication, audit/security controls, and PWA support. The current validation surface includes TypeScript compilation and a 68-test Vitest suite.

The audit also confirms that broad capability does not equal a 5/5 release by itself. Transactional email still depends on real SMTP configuration and controlled delivery testing; Stripe still requires live/test-mode webhook verification; production end-to-end journeys remain necessary; and the managed WebDev checkpoint has a stale workspace-history conflict even though the combined source is present in GitHub main. These are release controls, not items to conceal behind marketing language.

## State-of-the-Art Build Priorities

| Priority | Build | Why it can outperform commodity all-in-one tools | 5/5 definition of done |
|---|---|---|---|
| 1 | Client Experience Preflight | Lets an owner inspect client-visible booking, portal, payments, email, and automation readiness before sharing a link. | Read-only, owner-scoped, no client data leakage, actionable remediation, mobile-safe UI, tests for blocked/ready states. |
| 2 | Proof-of-Work Timeline | Connects estimate, scheduled work, WIP, receipts, finished work, approval, invoice, and payment into one legible story. | Immutable actor/timestamp trail, client-safe visibility, attachment ownership, approval and recovery states. |
| 3 | Field Mode reliability | Makes camera, checklist, time, status, and receipt capture useful in real on-site work. | Large touch targets, upload retry, clear offline/degraded states, no duplicate actions, responsive screenshots. |
| 4 | Transparent automation | Explains what a rule will do before execution and makes actual delivery inspectable. | Read-only preview, action-level outcome, safe test semantics, retries/errors visible, owner-scoped logs. |
| 5 | Client trust and payment recovery | Makes overdue, failed, rescheduled, and incomplete states actionable rather than dead ends. | Clear next steps, token-safe actions, idempotent billing transitions, owner/client notifications, audit trail. |

## Audit Conclusion

The build direction is strong, but “5/5 across the board” must be treated as a release program with evidence gates. The next implementation milestone is the Client Experience Preflight because it improves multiple recurring complaint categories at once—setup ambiguity, portal confusion, payment uncertainty, and automation opacity—without introducing a risky external dependency or exposing client records.
