# Job-Costing Gap Review

**Date:** 2026-08-28  
**Purpose:** Identify a bounded, privacy-preserving job-cost workflow candidate.

## Official-source findings

Housecall Pro describes job costing as tracking labor, materials, miscellaneous expenses, commissions, and services; it also distinguishes job inputs from invoice line items so certain costs can remain outside the customer price.[1] Its guidance states that costs tracked as material or miscellaneous job inputs do not appear on the invoice or change the job price.[1]

Jobber documents job costing using labor, line items, and job-linked expenses, and identifies job costs as internal rather than client-visible.[2] Its documentation further cautions that duplicate cost entry can make a profitability figure inaccurate.[2] Jobber’s product page describes expense tracking and receipt upload as part of its own job-costing offering; those are vendor claims, not evidence of TrueAxis HQ behavior.[3]

## Verified TrueAxis HQ implementation check

Follow-up source inspection found that this candidate is already implemented. The `expenses` table has an optional `jobId` and an owner-plus-job index. Protected expense create and update paths verify that a linked job belongs to the current owner. The protected job query owner-scopes the linked expenses, aggregates receipt, labor, and expense cost components, and returns a private financial calculation. This means an expense-to-job linkage or job-cost total would duplicate existing behavior and is not selected for new work.

## Decision boundary

This research confirms job costing as competitor context while the source inspection rules out duplicate expense-to-job work. It does not establish financial accuracy, legal or accounting suitability, profitability, customer outcomes, feature parity, or competitor performance claims.

## References

[1] [Housecall Pro — Job Costing: Complete Set-Up Guide](https://help.housecallpro.com/en/articles/6536636-job-costing-complete-set-up-guide)

[2] [Jobber Help Center — Job Costing](https://help.getjobber.com/en/articles/job-costing/)

[3] [Jobber — Job Costing Software](https://www.getjobber.com/features/job-costing-software/)
