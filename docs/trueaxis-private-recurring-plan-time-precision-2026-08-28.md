# Private Recurring Service-Plan Time Precision

**Date:** 2026-08-28  
**Scope:** Owner-only Dispatch Board recurring planning

## Verified behavior

Owners can now select a validated `HH:mm` **UTC** start time when creating a private weekly or monthly recurring plan. The schema stores this value with a backward-compatible `09:00` UTC default for existing plans. Creation uses the selected time for the first planned visit, and subsequent explicit next-visit generation uses the stored plan time rather than a hard-coded default.

The Dispatch Board displays the plan time as UTC and clarifies that the generated service-visit timeline renders timestamps in the viewer’s local time.

## Boundaries

| Area | Current behavior | Explicit non-claim |
|---|---|---|
| Time input | Owner selects a bounded UTC time for a private plan. | It does not configure a workspace time-zone policy or perform time-zone conversion rules beyond normal local display. |
| Generation | Explicit visit generation preserves the stored UTC start time. | It does not automatically create, dispatch, assign, or reschedule a visit. |
| Exposure | Plan time remains in protected Dispatch Board planning context. | It is not sent to a client portal, native calendar, external provider, or client-facing ETA/status workflow. |
| Compatibility | Existing plans receive the database default of 09:00 UTC. | No historical visit timestamp is rewritten. |

## Validation record

The additive migration `0059_freezing_mesmero.sql` was reviewed and applied before application use. Strict TypeScript checking passed. Focused recurring-plan coverage passed: **1 file / 11 tests**. The full deterministic Vitest suite passed: **98 files / 267 tests**. The production build and configured bundle budgets also passed.
