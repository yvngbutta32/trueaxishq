# TrueAxis HQ — Owner-Only Margin Exception Signals

**Prepared:** August 26, 2026  
**Evidence labels:** Implemented and validated; Research-supported; External validation gate

## Operational Problem and Bounded Acceptance Criterion

The private job-cost report showed revenue basis, tracked cost, projected profit, and margin, but an owner still had to scan every row manually to identify a missing planning basis or a margin needing review. The accepted scope is a local report-review aid: the owner chooses a bounded threshold in the report dialog and sees explicit signals for missing revenue basis, negative projected profit, or margin below that threshold.

These signals are deliberately local to the owner’s current report view. They do not persist a setting, alter a job, create a notification, send email or SMS, trigger a webhook, or expose financial data through a client portal.

## Implemented and Validated

| Surface | Implemented behavior | Evidence |
|---|---|---|
| Deterministic signal logic | A pure shared helper normalizes a `0–100` threshold and prioritizes missing revenue basis, negative projected profit, then below-threshold margin. | `shared/jobMarginSignals.ts`; `server/jobMarginSignals.test.ts`. |
| Owner control | The private report dialog has a clearly labeled local threshold input. Invalid values fall back to 30%; a valid value is rounded to one decimal place. | `client/src/pages/JobWorkspace.tsx`; deterministic threshold contracts. |
| Review context | Each report row displays a plain-language signal and a non-prescriptive review explanation, or “No local signal.” | Owner Job Workspace report UI; production build. |
| Communication boundary | The interface explicitly states that the signals do not send notifications or client updates. No notification mutation was added. | Source contract; client UI text. |
| Client isolation | The feature uses the existing protected owner report only; no public procedure, public route, or portal payload was added. | Existing portal isolation contracts plus margin-signal contract. |

> A margin signal is a **review prompt**, not an accounting conclusion, final job-cost result, or automated workflow.

## Signal Rules

| Condition | Local owner signal | Rationale shown in product |
|---|---|---|
| Revenue basis is absent or zero | Revenue basis missing | Add a job budget or link an invoice before evaluating margin. |
| Projected profit is below zero | Negative projected profit | Tracked cost currently exceeds the report’s revenue basis. |
| Margin is below the local threshold | Below *N*% threshold | Review price, scope, or tracked inputs before treating this as a final result. |
| None of the above | No local signal | No automatic claim, message, or job status change is made. |

## Research-Supported Rationale

Jobber’s official product update describes target-margin profit alerts for one-off jobs intended to surface a job when its margin falls below a selected threshold.[1] Bonsai documents budget monitoring and alerts as tools for identifying potential overrun conditions before project completion.[2] Housecall Pro describes a job-costing workflow in which revenue, cost, profit, and margin are visible together as inputs change.[3]

TrueAxis HQ implements only a conservative owner-review version: local, non-persistent, non-notifying signals within the protected cost report. It does not claim automated alerts, supplier invoice matching, forecast accuracy, accounting integration, or ecosystem parity.

## Validation Evidence

| Gate | Result |
|---|---|
| Deterministic suite | **42 test files / 142 tests passed**. |
| Signal contracts | Covers threshold normalization, precedence, valid no-signal behavior, private report placement, and no-notification copy. |
| Strict TypeScript | Passed. |
| Production build | Passed. |
| Bundle budget | Passed: application entry 515.4 KiB / 560 KiB; dashboard route 573.6 KiB / 650 KiB; CSS 220.7 KiB / 240 KiB. |

## External Validation Gates and Deliberate Exclusions

This change does not validate pricing decisions, accounting accuracy, business outcomes, payroll, commissions, tax treatment, notifications, real user adoption, or provider connectivity. It adds no message-delivery promise. Existing SMTP, Stripe, integration, signed-webhook-receiver, and authenticated mobile/session validation gates remain open.

## References

[1] [Jobber Product Update — Automated job costing and profit alerts](https://productupdates.getjobber.com/149890-automated-job-costing-is-here-track-costs-and-protect-margins-automatically)

[2] [Bonsai — Budgeting and profitability](https://www.hellobonsai.com/budgeting-profitability)

[3] [Housecall Pro — Job costing software](https://www.housecallpro.com/features/job-costing/)
