# TrueAxis HQ — Private Job-Costing & Margin Clarity

**Prepared:** August 26, 2026  
**Evidence labels:** Implemented and validated; Research-supported; External validation gate

## Operational Problem and Bounded Acceptance Criterion

TrueAxis HQ already recorded receipt-marked proof costs and owned time-entry costs inside a job, while owner expenses were tracked in a separate workspace-wide ledger. The missing connection was a safe, optional way to attribute an owner expense to a specific job and include it in that job’s private cost summary.

The accepted scope is intentionally narrow. An owner can attribute an expense to a job they own; the Job Workspace then shows the linked costs, aggregate tracked cost, projected profit, and calculated margin. Expense and margin information must remain absent from token-scoped client portal responses, client-facing proof, invoices, and job timeline updates.

## Implemented and Validated

| Surface | Implemented behavior | Evidence |
|---|---|---|
| Data model | `expenses.jobId` is a nullable additive reference; an owner-and-job index supports scoped lookups without changing existing expenses. | `drizzle/schema.ts`; reviewed and applied `drizzle/0039_legal_komodo.sql`. |
| Owner-safe writes | Creating or assigning a job expense verifies the referenced job belongs to the authenticated owner. Clearing the association is explicit (`null`). | `server/routers.ts`; `server/jobCosting.test.ts`. |
| Private calculation | The owner Job Workspace separately totals receipt-marked proof, logged time cost, and job-attributed expenses; it then calculates total tracked cost, projected profit, and margin when a revenue basis is present. | `shared/jobCosting.ts`; deterministic unit contracts. |
| Owner UI | The Job Workspace provides a private cost-entry form, categorized list, removal control, component breakdown, and duplicate-entry caution. | `client/src/pages/JobWorkspace.tsx`; production build. |
| Client isolation | The token-scoped portal job response does not query or return expenses, total cost, or margin. | `server/jobCosting.test.ts`; existing portal contract coverage. |

The revenue basis used in this planning summary is the linked invoice amount when one exists, otherwise the job budget. It is a **planning basis**, not a statement that an invoice was paid, an amount was recognized in formal accounting, or a financial outcome is assured.

> The cost summary is owner-facing operational planning data. It deliberately does not change the client portal, invoice, public proof, or payment workflow.

## Calculation Boundary

The calculation keeps source categories visible rather than masking them in a single number. Receipt-marked proof contributes the existing receipt line-item amount; labor is the existing logged duration multiplied by its stored hourly rate; and attributed expenses contribute their saved amount. The interface asks the owner to record each cost once because adding the same receipt as both proof and an expense would overstate tracked cost.

| Component | Included | Explicitly not included |
|---|---|---|
| Revenue basis | Linked invoice amount, otherwise job budget | Payment reconciliation, payout settlement, accounting recognition, tax treatment |
| Labor | Existing job-linked time entries using their stored hourly rate | Payroll processing, benefits, changing staff rates, commissions |
| Receipt-marked proof | Existing receipt photo line-item amount | Automatic supplier-invoice matching or receipt approval workflow |
| Expenses | Owner-created expense records explicitly linked to the job | Accounting-system synchronization or expenses from another workspace |

## Research-Supported Rationale

Official documentation from Jobber describes job profitability as a combination of timesheets, line items, and job expenses, and states that job costs are internal rather than client-visible.[1] Housecall Pro similarly documents labor, material, and miscellaneous costs, including expected-versus-actual framing for pricing decisions.[2] Bonsai documents project budgets that can include time and expenses, reinforcing the owner need to inspect financial inputs together.[3]

TrueAxis HQ implements only the safe overlap supported by its present model: **private, owner-scoped job expense attribution and a transparent planning summary**. It does not claim feature parity with those platforms.

## Validation Evidence

| Gate | Result |
|---|---|
| Focused and full deterministic suite | **40 test files / 136 tests passed**. |
| Job-cost calculation contracts | Covers rounded cost aggregation, zero-revenue margin behavior, schema/index presence, owner-only job assignment, scoped read, and client-portal non-exposure. |
| Strict TypeScript | Completed with no TypeScript error surfaced. |
| Production build | Passed. |
| Bundle budget | Passed: application entry 515.4 KiB / 560 KiB; dashboard route 573.6 KiB / 650 KiB; CSS 220.1 KiB / 240 KiB. |
| Schema application | Additive `jobId` column and `expenses_owner_job_idx` index applied successfully. |

## External Validation Gates and Deliberate Exclusions

This release does not validate payroll, commissions, staff permissions, live accounting synchronization, bank feeds, tax compliance, GPS/routing, or real staff/mobile workflows. It does not provide a provider connection or make a claim about actual profitability, accounting accuracy, payment delivery, or business outcomes. Those remain external validation or future-product boundaries.

## References

[1] [Jobber Help Center — Job Costing](https://help.getjobber.com/en/articles/job-costing/)

[2] [Housecall Pro Help Center — Job Costing: Complete Set-Up Guide](https://help.housecallpro.com/en/articles/6536636-job-costing-complete-set-up-guide)

[3] [Bonsai Help Center — Project budgets](https://help.hellobonsai.com/en/articles/8916128-project-budgets)
