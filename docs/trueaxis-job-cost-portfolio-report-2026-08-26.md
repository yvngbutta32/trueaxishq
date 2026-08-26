# TrueAxis HQ — Owner-Only Job-Cost Portfolio Report

**Prepared:** August 26, 2026  
**Evidence labels:** Implemented and validated; Research-supported; External validation gate

## Operational Problem and Bounded Acceptance Criterion

After adding private costs to individual jobs, an owner still needed a concise way to compare those inputs across the workspace without copying records into a spreadsheet. The accepted scope is a protected report that lists only workspace-owned jobs, optionally filters by job status, presents its inputs and calculations clearly, and provides a conservative CSV export.

The report must not create a public route, reveal job costs to token-scoped clients, claim accounting reconciliation, or include unnecessary client contact details, receipt URLs, source file keys, or internal notes.

## Implemented and Validated

| Surface | Implemented behavior | Evidence |
|---|---|---|
| Owner report | `jobs.costReport` returns up to 10,000 workspace-owned jobs with status, revenue basis, revenue, cost components, total tracked cost, projected profit, and margin. | `server/routers.ts`; `server/jobCostPortfolioReport.test.ts`. |
| Filtering | The owner can select an existing job lifecycle status or view all statuses. | Protected input validation and Job Workspace report dialog. |
| Private CSV | `jobs.exportCostReport` generates a server-side CSV with conservative job-cost fields. Every cell is quoted, quotes are escaped, and formula-like prefixes are neutralized. | `server/jobCostCsvExport.ts`; regression contract. |
| Owner UI | The Job Workspace offers a Cost report action, accessible loading and empty states, a tabular report, and CSV download. | `client/src/pages/JobWorkspace.tsx`; production build. |
| Client isolation | The report has no public procedure or route. The existing token-scoped portal job response does not receive the report or cost/margin data. | `server/jobCostPortfolioReport.test.ts`; prior portal contracts. |

## Calculation and Export Boundaries

The report reuses the private per-job calculation already implemented in the Job Workspace. The revenue basis is a linked invoice amount when available, otherwise the job budget; it is labeled in each row to avoid presenting a planning value as settled accounting revenue. “Projected profit” is revenue basis minus tracked receipt, time, and attributed-expense costs. Margin is omitted when no revenue basis exists.

| Included in CSV | Intentionally excluded |
|---|---|
| Job number, job title, client name, status, target date, revenue basis, cost components, projected profit, margin, update time | Client email/phone, internal notes, receipt URLs, file keys, portal tokens, payment credentials, payroll details, accounting identifiers |

## Research-Supported Rationale

Housecall Pro documents reporting that compares job revenue, labor, material, miscellaneous cost, total cost, gross profit, and margin across jobs.[1] Jobber describes profitability using job-level inputs such as timesheets and expenses and identifies that job costs are internal.[2] Bonsai’s reporting materials describe project margin, budget, revenue, expense, and CSV-report workflows.[3]

TrueAxis HQ now provides a narrower owner-only portfolio comparison and export that aligns with its existing data model. It does not claim parity with mature report customization, accounting, payroll, commission, or provider ecosystems.

## Validation Evidence

| Gate | Result |
|---|---|
| Deterministic suite | **41 test files / 139 tests passed**. |
| Focused contracts | Covers protected procedures, owner predicates, capped result size, formula-neutralized CSV, conservative columns, and portal non-exposure. |
| Strict TypeScript | Passed after resolving nullable database-field handling in the report aggregation. |
| Production build | Passed. |
| Bundle budget | Passed: application entry 515.4 KiB / 560 KiB; dashboard route 573.6 KiB / 650 KiB; CSS 220.2 KiB / 240 KiB. |

## External Validation Gates and Deliberate Exclusions

This report does not prove accounting accuracy, payment reconciliation, tax treatment, payroll, commissions, staff permissions, bank feeds, live accounting synchronization, financial advice, or business outcomes. The existing provider and authenticated-session gates remain unchanged.

## References

[1] [Housecall Pro Help Center — Job Costing Reports](https://help.housecallpro.com/en/articles/6596631-job-costing-reports)

[2] [Jobber Help Center — Job Costing](https://help.getjobber.com/en/articles/job-costing/)

[3] [Bonsai — Reporting](https://www.hellobonsai.com/reporting)
