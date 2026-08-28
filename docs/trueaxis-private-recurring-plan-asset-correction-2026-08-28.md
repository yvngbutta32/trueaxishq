# Private Recurring-Plan Asset Correction

**Date:** 2026-08-28  
**Scope:** Owner-only Dispatch Board planning refinement

## Verified behavior

Owners can now correct an existing recurring service plan’s private asset context by selecting a replacement active asset for the plan job’s client or removing the context. The protected mutation resolves the plan through its owned job, validates a replacement asset’s ID, owner, client, and active state, then updates only `customerAssetId`. The plan job, recurrence, start time, active state, and existing generated internal visits are not changed.

## Boundaries

| Area | Current behavior | Explicit non-claim |
|---|---|---|
| Asset correction | An owner can replace or remove the private asset context. | It does not reassign a plan’s job or change recurrence, time, or historical visits. |
| Validation | A replacement requires an active asset matching the plan job’s client and owner. | It does not permit a foreign-owner or cross-client asset association. |
| Visibility | The dialog and asset labels are in protected Dispatch Board only. | No asset context is exposed to a client portal, booking, client status, or ETA flow. |
| Scope | The asset is planning context for a deliberate recurring workflow. | It is not maintenance automation, inventory, warranty, IoT, notification, provider synchronization, or billing. |

## Validation record

Strict TypeScript checking passed. Focused recurring-plan coverage passed: **1 file / 13 tests**. The full deterministic Vitest suite passed: **98 files / 269 tests**. The production build and configured bundle budgets also passed.
