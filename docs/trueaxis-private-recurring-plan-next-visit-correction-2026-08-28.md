# Private Recurring-Plan Next-Visit Correction

**Date:** 2026-08-28  
**Scope:** Owner-only Dispatch Board recurring planning

## Verified behavior

Owners can correct a private plan’s next eligible future visit date without changing the plan’s recurrence, stored UTC time, job, asset context, active state, or prior generated visits. The protected route resolves the plan with a final owner predicate, evaluates the proposed date against the stored weekly or monthly recurrence and plan boundaries, rejects a timestamp at or before the current time, and prevents selection when the plan already has a generated visit at that timestamp.

The protected Dispatch Board provides a clearly labeled plan selector, current timing context, a date input, and clear guidance that only an eligible future occurrence is accepted.

## Boundaries

| Area | Current behavior | Explicit non-claim |
|---|---|---|
| Next date | Owner chooses a future date already eligible under the stored plan. | It does not revise recurrence, time-zone policy, stored UTC time, job, asset, or existing visit history. |
| Validation | Server-side recurrence, future-time, duplicate-visit, and final ownership checks apply. | It does not create, reschedule, dispatch, assign, or notify a client. |
| Visibility | The control is private to Dispatch Board. | No change is made to client portals, bookings, external calendars, provider systems, or ETA/status workflows. |
| Scope | This is an owner planning correction. | It is not automatic scheduling, maintenance automation, or calendar synchronization. |

## Validation record

Strict TypeScript checking passed. Focused recurring-plan coverage passed: **1 file / 16 tests**. The full deterministic Vitest suite passed: **100 files / 275 tests**. The production build and configured bundle budgets also passed.
