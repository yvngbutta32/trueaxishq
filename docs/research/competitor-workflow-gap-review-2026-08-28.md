# Competitor Workflow Gap Review

**Date:** 2026-08-28  
**Decision status:** Discovery only; no parity or performance claim.

## Official-source observations

Jobber describes a work-order model that includes job scheduling, status tracking, job details, instructions, photos, and customizable checklists. Its marketing page also describes assignment and a range of live communication, GPS, mobile, and provider-backed capabilities.[1]

Housecall Pro documents booking, schedule adjustment, technician assignment, route visualization, and automated customer updates. Its page also references GPS tracking and estimated drive time, which are outside the existing private, session-only TrueAxis route-planning boundary.[2]

HoneyBook describes team access controls, role distinctions, individualized workload views, team task/project assignment, and related automations.[3]

## Implication for a bounded TrueAxis improvement

The sources support investigating an **owner-only assignment-readiness and workload-context workflow**: a manager can review an active visit against private staff availability and selected-week capacity before deliberately assigning or revising operational responsibility. This should not be conflated with live dispatch, optimization, GPS, payroll, attendance, scheduling automation, push notifications, or provider delivery.

Before implementation, the source must be inspected to determine whether a durable service-visit assignment already exists. Any new work must enforce final owner predicates and ensure that private availability and capacity context do not appear in a client projection.

## References

[1] [Jobber — features for home service businesses](https://www.getjobber.com/features/)

[2] [Housecall Pro — service scheduling software](https://www.housecallpro.com/features/scheduling-software/)

[3] [HoneyBook — team workflow and access controls](https://www.honeybook.com/for-teams)
