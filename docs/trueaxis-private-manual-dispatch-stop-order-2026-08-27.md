# Private Manual Dispatch Stop Order

**Date:** 2026-08-27  
**Scope:** Owner-only Dispatch Board refinement

## Verified behavior

Owners can now arrange up to twelve currently active service-visit site labels into a deliberate stop sequence for the **current browser session**. Keyboard-accessible earlier/later controls update that sequence, and the private map route preview consumes the same order after locations resolve. The map resolver records locations by visit identifier before constructing the route, preventing asynchronous geocoding completion order from deciding the route sequence.

## Boundaries

| Area | Current behavior | Explicit non-claim |
|---|---|---|
| Stop order | Owner-controlled and limited to the active browser session. | It does not persist, optimize, or automatically dispatch work. |
| Route preview | Uses the chosen private sequence with waypoint optimization disabled. | It does not use live traffic, GPS, technician tracking, or calculate a client-facing ETA. |
| Data exposure | The control is present only in the protected Dispatch Board. | Route order and location context are not added to any client portal or client-status flow. |
| Record integrity | Reordering clears only the displayed map route. | It does not change service-visit times, job assignment, client updates, or stored records. |

## Validation record

Strict TypeScript checking passed. Focused Dispatch Board route-preview and map-preview coverage passed: **2 files / 6 tests**. The full Vitest suite passed: **95 files / 254 tests**. The production build and configured bundle budgets also passed.
