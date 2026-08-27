# Private Availability-Aware Capacity Context

**Date:** 2026-08-27  
**Scope:** TrueAxis HQ owner operations only

## Implemented behavior

The Team & Capacity board now reports each roster member’s **current-week private availability-block time** alongside planned assignment and scheduled-visit context. The server includes only the aggregate number of minutes where an owner-managed availability block intersects the current UTC week. It clips blocks at the week boundary and scopes the query with the current owner’s final identifier.

The client renders the aggregate as planning context only. It does not reveal an availability-block reason, exact block time, client information, location, or encrypted/private delivery data. Existing service-visit and assignment metrics remain separate and are not modified by the availability aggregate.

## Boundaries

| Area | Current behavior | Explicit non-claim |
|---|---|---|
| Capacity context | Shows current-week blocked availability time to the owner | It does not subtract contractual capacity or change scheduling eligibility automatically. |
| Privacy | Returns only owner-scoped per-member aggregate minutes | It does not expose block reasons or details in client, staff, portal, map, or public routes. |
| Operations | Supports owner planning review beside assigned and scheduled time | It is not attendance, payroll, time-clock, GPS, routing, or real-time location functionality. |
| Scheduling | Existing overlap signals remain owner review prompts | It does not auto-assign, auto-reschedule, notify clients, synchronize a calendar, or provide offline operation. |

## Validation record

The implementation passed strict TypeScript checking. Focused staff-availability, Team Operations, and scheduled-capacity tests passed: **3 files / 12 tests**. The full Vitest suite passed: **95 files / 254 tests**. The production build and configured bundle budgets also passed.

Authenticated owner/staff session walkthroughs and controlled real-device Field Mode checks remain separate external validation gates.
