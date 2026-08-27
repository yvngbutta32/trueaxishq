# Private Availability-Block Correction

**Date:** 2026-08-27  
**Scope:** TrueAxis HQ owner Dispatch Board only

## Implemented behavior

Owners can now correct an existing private availability block’s start, end, and optional private reason from the Dispatch Board. The selected team member is intentionally fixed during correction, so a timing correction cannot silently reassign a private absence or availability exception to another roster record.

The protected update procedure first resolves the block using both its identifier and the authenticated owner identifier. It rejects invalid time windows and any overlap with another private block for that same owner and team member, excluding the record being corrected. Service-visit availability overlap indicators are derived from the current persisted window, so they recalculate on later owner queries without changing a visit or notifying a client.

## Boundaries

| Area | Current behavior | Explicit non-claim |
|---|---|---|
| Correction | Owner may update time boundaries and a bounded private reason | It does not change the associated team member, jobs, appointments, assignments, or client records. |
| Conflict signal | Existing dispatch and Team Operations views derive overlap from the corrected block | It does not automatically reschedule, block a visit, assign staff, or notify a client. |
| Privacy | Block data remains protected owner planning data | It is excluded from client portals, public routes, staff access views, maps, and route previews. |
| Field operations | Supports deliberate owner schedule review | It is not GPS, location tracking, payroll, attendance, calendar sync, optimized routing, or offline functionality. |

## Validation record

The implementation passed strict TypeScript checking. Focused availability, Team Operations, and scheduled-capacity coverage passed: **3 files / 12 tests**. The full Vitest suite passed: **95 files / 254 tests**. The production build and configured bundle budgets also passed.

Authenticated owner/staff responsive walkthroughs, real-device Field Mode validation, and provider-backed calendar synchronization remain separate gates.
