# Private Route-Order Recovery

**Date:** 2026-08-27  
**Scope:** Owner-only Dispatch Board refinement

## Verified behavior

The private site preview now offers **Use scheduled order**. An owner can restore the active planning day’s session-only stop sequence to its scheduled order after moving stops manually or applying a map suggestion. The control clears the displayed route and returns the suggestion state to idle; it does not write to the database or alter a service visit.

## Boundaries

| Area | Current behavior | Explicit non-claim |
|---|---|---|
| Recovery | Restores the displayed schedule sequence for the selected private planning day. | It does not persist an order or change any visit, job, assignment, or client record. |
| Map state | Clears only the displayed private route. | It does not cancel, dispatch, reschedule, or notify anyone. |
| Scope | Applies only to the active browser session in Dispatch Board. | It adds no route optimization, GPS, traffic, technician tracking, or client ETA behavior. |

## Validation record

Strict TypeScript checking passed. Focused Dispatch Board route-preview and map-preview coverage passed: **2 files / 8 tests**. The full Vitest suite passed: **95 files / 256 tests**. The production build and configured bundle budgets also passed.
