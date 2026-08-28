# Private Capacity Planning Horizon Evidence

**Date:** 2026-08-28  
**Decision scope:** Owner-only selectable capacity horizon in TrueAxis HQ

## Research basis

Microsoft describes a schedule board as a dispatcher view over resource availability and bookings, with an explicit date range and daily, weekly, or monthly time scales.[1] It also separates broader automated optimization features as an optional add-in capability rather than an inherent property of a calendar-style board.[1] For multi-day work, Microsoft distinguishes manual scheduling from a separate schedule-assistant allocation workflow.[2]

## Product decision

TrueAxis HQ will add only an **owner-selected UTC week** to the existing private capacity context. The selection will change the query window used to total active scheduled-visit overlap and private availability-block overlap. It will not create assignments, modify capacity commitments, infer attendance, or act as a route or calendar integration.

| Topic | Included in the bounded refinement | Explicitly excluded |
|---|---|---|
| Horizon | A validated Monday-start UTC week selected by an owner. | A personal time-zone policy, a shared public calendar, or stored user preference. |
| Capacity context | Existing private scheduled visit and availability-block totals, clipped to the selected week. | Payroll, attendance, contractual availability, utilization guarantees, or automatic dispatch. |
| Visibility | Protected owner Team Operations context. | Client portals, public booking, client status, GPS, traffic, routes, and native calendar synchronization. |
| Decision support | An observational planning view. | Resource optimization or provider-backed scheduling claims. |

## References

[1]: https://learn.microsoft.com/en-us/dynamics365/field-service/work-with-schedule-board "Use the schedule board in Field Service"

[2]: https://learn.microsoft.com/en-us/dynamics365/field-service/schedule-multi-day-work "Schedule work over multiple days - Field Service"
