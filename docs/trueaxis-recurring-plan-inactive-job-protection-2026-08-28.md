# Recurring-Plan Inactive-Job Generation Protection

**Date:** 2026-08-28  
**Scope:** Owner-only recurring service-plan safety correction

## Verified behavior

When an owner deliberately generates a future internal service visit, the protected procedure now resolves the owned plan job and rejects generation when that job has the `completed` or `cancelled` status. Existing plans and any existing generated visits remain retained. The rejection is a private conflict outcome, so no new visit is inserted and no client-facing state changes.

## Boundaries

| Area | Current behavior | Explicit non-claim |
|---|---|---|
| Job lifecycle | Completed and cancelled jobs cannot generate a future recurring visit. | It does not delete, reactivate, or modify the job, plan, asset, or historical visits. |
| Recovery | An owner must deliberately resume active work through the appropriate job workflow before a later generation attempt. | It does not automatically resume work or generate a visit. |
| Visibility | The protected mutation returns a clear private conflict message. | It does not notify a client, billing system, provider, or portal. |
| Scope | Applies to next-visit creation for owner-managed plans. | It is not maintenance automation, a calendar sync, dispatch automation, or a client promise. |

## Validation record

Strict TypeScript checking passed. Focused recurring-plan coverage passed: **1 file / 14 tests**. The full deterministic Vitest suite passed: **98 files / 270 tests**. The production build and configured bundle budgets also passed.
