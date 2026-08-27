# TrueAxis HQ private customer-asset service history — 2026-08-27

## Delivered behavior

Job Workspace now offers an owner-only, observational service-history card whenever a private customer asset is linked to the current job. It shows up to 50 existing jobs that match the same owner, client, and asset, together with their current job status, latest activity date, and a count of saved private inspection responses. Owners can open a listed job from the card.

| Boundary | Implemented control |
| --- | --- |
| Owner isolation | The protected query resolves the asset using its ID and final `userId` predicate before reading any history. |
| Client isolation | Linked jobs and response counts require the asset’s stored client ID as well as the asset ID and owner ID. |
| Data minimization | The history returns operational job summary fields and response counts only. It does not return inspection answers, template fields, asset notes, or client details. |
| Interface scope | The card is rendered only in protected Job Workspace. It has loading, empty, error, and responsive entry states. |

## Validation

Strict TypeScript checking passed. Focused asset, response, and service-history coverage passed with 9 tests. The full suite passed with **92 test files and 246 tests**. The production build and configured bundle-budget checks passed. The protected owner interface was not exercised with a real authenticated session in this release; owner, staff, and client end-to-end checks remain separate external validation gates.

## Deliberate boundaries

This is a private observational history made from existing asset-linked data. It does not create a maintenance plan, service agreement, warranty record, inventory system, sensor integration, IoT alert, attachment archive, automated notification, client portal projection, or compliance evidence. It makes no claim that the list is a comprehensive asset-management or regulatory history.

Microsoft’s field-service guidance distinguishes asset service history built from associated work-order records from separate service-agreement, inventory, and connected-device capabilities. It also frames same-account asset/work-order linkage as the normal relationship. [1] [2]

## References

[1]: https://learn.microsoft.com/en-us/dynamics365/field-service/service-history "Microsoft Learn: Build a service history for assets"
[2]: https://learn.microsoft.com/en-us/dynamics365/field-service/assets "Microsoft Learn: Work with customer assets"
