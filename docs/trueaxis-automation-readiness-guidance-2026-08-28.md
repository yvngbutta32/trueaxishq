# Automation Readiness Guidance Correction

**Date:** 2026-08-28  
**Scope:** Owner-only workflow automation copy and readiness guidance

## Verified correction

The automation workspace now describes rules as configured triggers and actions whose readiness and recorded outcomes can be reviewed. Email actions are described as queued only when configured delivery is available. The workflow explainer states that matching events are processed when the rule and its dependencies are available, rather than guaranteeing every event fires or that a business will never miss follow-up work. Timed actions direct owners to run history and clarify that provider delivery needs separate evidence.

## Boundaries

| Area | Current behavior | Explicit non-claim |
|---|---|---|
| Automation configuration | Owners can configure triggers and actions, preview them, and inspect stored run history. | It does not guarantee that each event executes or that configured actions reach an external provider. |
| Email action | The UI reflects that an email action needs configured delivery. | It does not claim SMTP delivery, inbox placement, or a recipient open. |
| Timed work | Timing is represented in the workflow rule and outcomes are recorded when processed. | It does not claim a managed durable scheduler, automatic retry completion, or a precise delivery time. |
| Scope | Guidance appears only in the protected owner workflow UI. | It does not create new client portal behavior or alter existing user data. |

## Validation record

Strict TypeScript checking passed. Focused automation-readiness coverage passed: **1 file / 1 test**. The full deterministic Vitest suite passed: **99 files / 271 tests**. The production build and configured bundle budgets also passed.
