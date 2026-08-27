# Private staff availability evidence — 2026-08-27

Microsoft Field Service treats availability as one input to resource scheduling, alongside work hours, capacity, location, skills, and territories. It also distinguishes temporary time off from deactivating a resource: the former blocks a time frame, while the latter removes a resource from new scheduling but does not cancel existing bookings. [1]

TrueAxis HQ will use a deliberately smaller, private owner-managed availability-block model. A block will identify a team member and UTC start/end boundaries, with an optional limited private reason. It will provide an informational conflict signal for overlapping assigned visits; it will not prevent dispatch assignments, represent approved leave, calculate work time or pay, collect GPS or device location, optimize routes, auto-reassign visits, notify clients, or appear in client portals.

| Area | Bounded TrueAxis HQ behavior | Explicitly excluded |
| --- | --- | --- |
| Entry | Owner records a time-bounded private unavailability block | Staff self-service, approval workflow, recurring work hours |
| Dispatch | Existing assigned visits are compared for overlap | Auto-assignment, routing, traffic, ETA, GPS |
| Privacy | Owner-only data and signals | Client portal, external calendar, location sharing |
| Operations | A scheduling aid, not proof of work | Payroll, attendance, timesheets, compliance |

## References

[1]: https://learn.microsoft.com/en-us/dynamics365/field-service/set-up-bookable-resources "Microsoft Learn: Set up bookable resources"
