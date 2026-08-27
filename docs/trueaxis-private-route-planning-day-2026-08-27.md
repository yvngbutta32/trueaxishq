# Private Route-Planning Day

**Date:** 2026-08-27  
**Scope:** Owner-only Dispatch Board refinement

## Verified behavior

The private site preview now derives available **planning days** from active service visits that have a site label. An owner selects one local planning day before arranging stops; manual stop order and the route preview therefore apply only to that day’s active visits. When the selected day changes, the displayed route is cleared and the session-only stop sequence is rebuilt from that day’s scheduled order.

## Boundaries

| Area | Current behavior | Explicit non-claim |
|---|---|---|
| Planning-day selection | A local-day selector scopes the preview and visible stop controls. | It is not a time-zone policy, shared schedule, or persisted route plan. |
| Stop order | The selected day, order, and site labels remain in the active browser session. | It does not update service-visit records, assignments, customer updates, or portal data. |
| Route preview | A chosen same-day sequence can be previewed after private geocoding succeeds. | It does not optimize routes, use traffic, track staff, use GPS, or promise an ETA. |

## Validation record

Strict TypeScript checking passed. Focused Dispatch Board route-preview and map-preview coverage passed: **2 files / 6 tests**. The full Vitest suite passed: **95 files / 254 tests**. The production build and configured bundle budgets also passed.
