# TrueAxis HQ — Recurring Service Foundation

**Prepared:** August 26, 2026  
**Evidence labels:** Implemented and validated; Research-supported; Scope boundary

## Operational Capability

TrueAxis HQ now supports a bounded, owner-private recurring service foundation for planned operational visits. An owner can define a weekly or monthly plan for an existing workspace job, set a start and optional end condition, give the plan a private service name and planning note, choose a 15–480 minute duration, and explicitly generate the next internal visit when ready.

Generated visits are always **owner-planned and unassigned**. They are not a claim that a staff member is available, assigned, routed, notified, or client-visible. The owner retains the existing dispatch workflow to choose a team member after generation.

## Implemented Behavior

| Boundary | Behavior |
|---|---|
| Plan scope | Plan creation, listing, and generation require the workspace owner and a workspace-owned job. |
| Frequency | Weekly plans use a day of week; monthly plans use days 1–28. Invalid or ended schedules do not generate a visit. |
| Planning details | Service names and planning notes remain owner-private. |
| Generation | The Dispatch Board shows owner-only plans and offers an explicit **Generate unassigned visit** action. |
| Idempotency | A database uniqueness boundary on `(recurringServicePlanId, scheduledStart)` prevents concurrent duplicate generated visits; a duplicate request returns the existing visit. |
| Privacy | Generated visits use `clientVisible: false`; the public portal has no recurring-plan query or UI path. |
| Assignment | Generated visits do not populate a team member. Assignment remains a later deliberate dispatch decision. |

## Validation Evidence

| Gate | Result |
|---|---|
| Migrations | Additive recurring plan model and recurring-plan/start uniqueness boundary were reviewed and applied. |
| Deterministic suite | **73 test files / 200 tests passed**. |
| Focused contracts | Covers weekly/monthly validation, bounded next-date calculation, owner scope, idempotent existing-visit behavior, unassigned internal generation, Dispatch Board control, and absence from the client portal. |
| Strict TypeScript | Passed. |
| Production build | Passed. |
| Bundle budget | Passed: application entry 516.0 KiB / 560 KiB; dashboard route 580.9 KiB / 650 KiB; home route 112.6 KiB / 140 KiB; charts vendor 424.7 KiB / 500 KiB; CSS 222.8 KiB / 240 KiB. |

## Research Context

Jobber documents recurring jobs and recurring visit scheduling as an operations workflow; Housecall Pro documents recurring service plans as distinct from one-off visits.[1] [2] TrueAxis HQ implements the safe operational core—private plan definition and explicit internal visit generation—without claiming the broader billing, communication, calendar, or client-management ecosystems of those products.

## Deliberate Boundary

This release does not provide recurring invoices, automatic payments, subscriptions, client plan enrollment, external calendar sync, automatic visit generation on a schedule, notifications, GPS, routing, staff availability calculation, or provider-backed delivery. Those remain future scoped capabilities or external validation dependencies.

## References

[1] [Jobber Help Center — Create a recurring job](https://help.getjobber.com/en/articles/create-a-recurring-job/)

[2] [Housecall Pro — Recurring service plans](https://help.housecallpro.com/en/articles/5734511-recurring-service-plans)
