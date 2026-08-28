# Private Asset-Linked Recurring Service Plans

**Date:** 2026-08-28  
**Scope:** Owner-only recurring service planning in Dispatch Board

## Verified behavior

Owners can now create a private recurring service plan from Dispatch Board and optionally attach an **active** customer asset that belongs to the plan job’s client. The protected creation contract resolves the owned job first, then requires matching owner, client, and active-asset predicates before storing the optional asset reference. The recurring-plan list returns only minimized private asset context—name and optional tag—for the owner workspace.

Owners still explicitly generate each next unassigned internal service visit. The plan asset reference supplies planning context; it does not change the underlying job’s existing asset link or add asset data to a service-visit record.

## Boundaries

| Area | Current behavior | Explicit non-claim |
|---|---|---|
| Asset association | Optional, owner-scoped, and restricted to an active asset for the job’s client. | It does not reassign the job, modify an asset, or allow a cross-client or foreign-owner link. |
| Recurrence | The owner defines weekly or monthly timing and explicitly generates an internal visit. | It is not automated maintenance scheduling, automatic dispatch, booking, billing, or notification. |
| Asset context | The plan list displays a private asset name/tag when one is linked. | It does not create inventory, warranty, IoT, compliance, attachment, or public service-history behavior. |
| Exposure | The form and context stay in protected Dispatch Board. | No asset context is projected into a client portal, public booking, client status, or ETA surface. |

## Validation record

Strict TypeScript checking passed. Focused recurring-plan coverage passed: **1 file / 5 tests**. The full deterministic Vitest suite passed: **98 files / 261 tests**. The production build and configured bundle budgets also passed.

## Evidence basis

The design treats recurring plans as owner-controlled planning context rather than a complete agreement or maintenance system. Microsoft’s Field Service agreement documentation distinguishes scheduled work-order generation from broader asset-management and lifecycle practices.[1]

## References

[1]: https://learn.microsoft.com/en-us/dynamics365/field-service/set-up-agreements-work-orders "Microsoft Dynamics 365 Field Service: Set up agreements to automatically generate work orders"
