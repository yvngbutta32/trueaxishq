# Private Route-Order Suggestion Evidence

**Date:** 2026-08-27  
**Decision:** Use the existing browser-side Maps Directions service only as an owner-triggered, manually reviewable private order suggestion.

Google documents that `optimizeWaypoints: true` may rearrange supplied intermediate waypoints and return the resulting index order in `waypoint_order`; its current Routes API similarly returns the optimized intermediate waypoint indexes when requested.[1] [2] The existing project map implementation already uses the browser-side Maps SDK and route library.

## Product decision

TrueAxis HQ will call the existing route service only after an owner explicitly chooses **Suggest a private order**. The suggestion is applied only to the current browser-session stop order, clearly disclosed as a map-provider suggestion, and remains reversible through the existing manual arrows and reset control. The implementation will not persist a route, write service visits, dispatch work, expose a client ETA, use GPS or staff location, request traffic-aware behavior, or represent a provider suggestion as an operational guarantee.

## Acceptance conditions

| Condition | Required behavior |
|---|---|
| Input | At least three resolved private stops on the owner-selected planning day. |
| Control | The owner invokes the suggestion; it is never automatic. |
| Result | Returned waypoint indexes are checked for a complete, valid permutation before session order changes. |
| Recovery | A provider error leaves the existing manual order untouched and offers plain-language retry guidance. |
| Privacy | Site labels, location coordinates, route order, and response data stay inside the protected Dispatch Board. |
| Scope | No live traffic, location tracking, route persistence, automated dispatch, field navigation, or client-facing promise is added. |

## References

[1]: https://developers.google.com/maps/documentation/javascript/legacy/directions "Google Maps JavaScript API: Directions Service"
[2]: https://developers.google.com/maps/documentation/routes/opt-way "Google Maps Routes API: Optimize the order of stops"
