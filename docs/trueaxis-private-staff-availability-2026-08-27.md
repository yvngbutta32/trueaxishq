# TrueAxis HQ private staff availability — 2026-08-27

## Delivered behavior

Owners can now create and remove time-bounded private availability blocks for active team members in Dispatch Board. Each block carries a UTC start and end, plus an optional private reason. Overlapping blocks for the same owner and team member are rejected. Existing service visits are marked with a private availability-overlap indicator when their scheduled window intersects a block. Team Operations also presents the same condition as a minimized owner planning exception without revealing the block reason.

When an owner creates or reschedules a visit that overlaps a private availability block, the protected server contract requires the same deliberate exception acknowledgment already used for visit collisions. The activity metadata records that an availability exception was acknowledged, without copying block reason or availability details into a client-facing stream.

| Boundary | Implemented rule |
| --- | --- |
| Ownership | Availability blocks, team-member lookup, list, create, delete, and conflict checks finish with the authenticated owner ID. |
| Time semantics | UTC start/end must form a positive interval; same-member block overlap is rejected. |
| Conflict handling | The system flags overlap and requires explicit owner acknowledgment; it does not auto-reassign, cancel, or notify. |
| Data minimization | Dispatch exposes only a boolean availability-conflict indicator on a visit; client portals receive no availability records, reasons, or signals. |
| Lifecycle | Only active team members may receive new blocks; blocks are removable private planning records. |

## Validation

Strict TypeScript checking passed. Focused availability, team, and capacity coverage passed with **11 tests**. The complete suite passed with **95 test files and 253 tests**. The production build and configured bundle-budget check passed.

## Deliberate non-goals

This is an owner-managed scheduling aid. It does not implement staff self-service, leave approval, recurring work hours, attendance, payroll, route optimization, traffic, ETA, GPS, real-time location, auto-assignment, automatic reassignment, external calendar synchronization, client notification, client portal availability data, or compliance claims. Microsoft’s broader field-service resource model includes distinct work-hours, capacity, location, skills, and availability functions; TrueAxis HQ intentionally implements only the narrow private exception-block pattern. [1]

## References

[1]: https://learn.microsoft.com/en-us/dynamics365/field-service/set-up-bookable-resources "Microsoft Learn: Set up bookable resources"
