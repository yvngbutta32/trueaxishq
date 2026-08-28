# Recurring-Plan Inactive-Asset Generation Protection

**Date:** 2026-08-28  
**Scope:** Owner-only recurring service-plan safety correction

## Verified behavior

When an owner triggers next-visit generation for a recurring plan linked to a customer asset, the protected procedure now rechecks the linked asset’s ID, owner, client, and active state against the plan’s owned job. If the asset is inactive or does not match the job’s client, no future internal service visit is created. Existing plans and previously generated visits remain retained.

Dispatch Board returns minimized private active-state context. It disables generation and explains the required asset reactivation when a linked asset is inactive.

## Boundaries

| Area | Current behavior | Explicit non-claim |
|---|---|---|
| Asset lifecycle | A deactivated linked asset blocks future internal visit generation. | It does not delete or alter recurring-plan history, job history, or existing visits. |
| Scope | Validation applies only in protected owner planning flows. | It does not add maintenance automation, inventory, warranty, IoT, notification, or client portal behavior. |
| Recovery | An owner may reactivate the same private asset through existing lifecycle controls, then deliberately generate a future visit. | It does not automatically resume or generate work. |

## Validation record

Strict TypeScript checking passed. Focused recurring-plan coverage passed: **1 file / 9 tests**. The full deterministic Vitest suite passed: **98 files / 265 tests**. The production build and configured bundle budgets also passed.
