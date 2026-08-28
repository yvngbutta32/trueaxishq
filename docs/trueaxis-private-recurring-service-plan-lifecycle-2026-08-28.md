# Private Recurring Service-Plan Lifecycle

**Date:** 2026-08-28  
**Scope:** Owner-only Dispatch Board planning controls

## Verified behavior

Owners can now pause or resume an existing private recurring service plan. The protected mutation applies final plan-ID and owner predicates and updates only the plan’s active state. A paused plan stays visible in the owner plan list and retains generated-visit history, but the existing next-visit generation contract rejects it because it requires an active record.

## Boundaries

| Area | Current behavior | Explicit non-claim |
|---|---|---|
| Lifecycle | An owner can pause or resume a plan without deleting it. | It does not alter historical generated visits or change a job, asset, assignment, or client record. |
| Generation | A paused plan cannot produce a next internal visit. | It does not automatically generate a visit when resumed. |
| Visibility | Lifecycle controls and status remain in protected Dispatch Board. | No client portal, client notification, billing, booking, or public maintenance-plan view is added. |
| Scope | Plans remain deliberate private planning records. | This is not an automated maintenance, inventory, warranty, IoT, or provider-sync system. |

## Validation record

Strict TypeScript checking passed. Focused recurring-plan coverage passed: **1 file / 7 tests**. The full deterministic Vitest suite passed: **98 files / 263 tests**. The production build and configured bundle budgets also passed.
