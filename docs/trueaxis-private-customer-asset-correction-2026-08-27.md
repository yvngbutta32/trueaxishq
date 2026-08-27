# TrueAxis HQ private customer-asset correction — 2026-08-27

## Delivered behavior

Owners can now correct the current private details of a customer asset from Job Workspace: asset name, tag, functional-location label, and private notes. The edit form is directly adjacent to the asset context, uses clear labels and bounds, supports cancel and save states, and is responsive for narrow screens.

| Data boundary | Behavior |
| --- | --- |
| Authorization | The mutation is protected and finishes with both asset ID and authenticated owner ID. |
| Editable data | Only current asset name, tag, functional location, notes, and update timestamp are written. |
| Immutable associations | The correction input has no client ID and cannot transfer an asset between clients. |
| Historical integrity | It does not update job links, inspection responses, response field snapshots, or the observational service-history records derived from them. |
| Client visibility | Neither the edit procedure nor its UI is included in any client portal projection. |

## Validation

Strict TypeScript checking passed. Focused customer-asset correction, service-history, and asset tests passed with **7 tests**. The complete suite passed with **94 test files and 250 tests**; the production build and configured bundle-budget validation also passed.

## Deliberate non-goals

This is a current-record correction path. It does not create property logs, per-field change audit history, maintenance schedules, inventory, warranty, IoT, automated notifications, attachments, client editing, client sharing, or compliance claims. Microsoft distinguishes asset service history from property-log functionality; this release remains within the former’s observational boundary. [1] [2]

## References

[1]: https://learn.microsoft.com/en-us/dynamics365/field-service/assets "Microsoft Learn: Work with customer assets"
[2]: https://learn.microsoft.com/en-us/dynamics365/field-service/property-logs "Microsoft Learn: Property logs"
