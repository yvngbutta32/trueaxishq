# Private Route-Order Suggestion

**Date:** 2026-08-27  
**Scope:** Owner-only Dispatch Board route preparation

## Verified behavior

On an owner-selected planning day, **Suggest private order** requests a map-provider waypoint order only after every displayed private site label has resolved and at least three stops are present. The returned intermediate waypoint indexes must form a complete, in-range permutation before the browser-session stop sequence changes. The owner receives a plain-language success state and can manually adjust the arrows immediately afterward. An invalid or failed suggestion leaves the prior manual order untouched.

## Boundaries

| Area | Current behavior | Explicit non-claim |
|---|---|---|
| Invocation | An owner deliberately requests the suggestion. | It is not automatic dispatch or automatic scheduling. |
| Result | The suggestion changes the current browser-session stop sequence only after index validation. | It is not persisted and does not alter any job, visit, assignment, or customer record. |
| Review | Manual arrows remain available after a suggestion. | The provider output is not treated as a routing guarantee. |
| Privacy | Site labels, coordinates, and the returned order remain in the protected Dispatch Board. | No client route, status, ETA, GPS, traffic, or technician tracking behavior is added. |

## Validation record

Strict TypeScript checking passed. Focused Dispatch Board route-preview and map-preview coverage passed: **2 files / 7 tests**. The full Vitest suite passed: **95 files / 255 tests**. The production build and configured bundle budgets also passed.

## Evidence basis

Google’s documentation states that an enabled waypoint-order option can reorder intermediate waypoints and return the resulting indexes; that behavior is used here only as an owner-reviewed private suggestion.[1] [2]

## References

[1]: https://developers.google.com/maps/documentation/javascript/legacy/directions "Google Maps JavaScript API: Directions Service"
[2]: https://developers.google.com/maps/documentation/routes/opt-way "Google Maps Routes API: Optimize the order of stops"
