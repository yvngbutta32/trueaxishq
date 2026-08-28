# Asset-Linked Recurring Service Planning Evidence

**Date:** 2026-08-28  
**Decision:** Add only a private owner-controlled customer-asset reference to the existing recurring service-plan and generated-job flow.

Microsoft’s Field Service guidance states that specifying a customer asset in a recurring agreement’s work details can define recurring work for particular equipment and contribute to service history.[1] Its agreements overview distinguishes recurring work generation, automated resource scheduling, invoices, inventory, warranties, entitlements, and other agreement capabilities as separate system areas.[2]

## Product boundary

TrueAxis HQ will preserve the existing, owner-controlled recurring-plan behavior and link **one active same-client private asset** when an owner deliberately selects it. Generated owner jobs can carry that existing private asset context. This does not create a maintenance agreement, customer entitlement, inventory record, warranty claim, invoice schedule, automatic booking, scheduling optimization, GPS workflow, portal projection, notification, or remote service state.

## Acceptance conditions

| Condition | Required behavior |
|---|---|
| Ownership | The recurring plan, asset, and generated job must be scoped to the final owner predicate. |
| Client isolation | The linked asset must belong to the same client as the recurring plan. |
| Lifecycle | Only active assets are selectable for a new or updated recurring-plan link; a retained existing link is not silently reassigned. |
| Generation | An existing selected asset reference passes to the manually generated owner job. |
| Privacy | Asset identity and location fields remain absent from client portals and client-facing status paths. |
| Scope | The feature remains manual service context—not autonomous maintenance or work scheduling. |

## References

[1]: https://learn.microsoft.com/en-us/dynamics365/field-service/set-up-agreements-work-orders "Microsoft Learn: Set up agreements to automatically generate work orders"
[2]: https://learn.microsoft.com/en-us/dynamics365/field-service/agreements-overview "Microsoft Learn: Customer agreements overview"
