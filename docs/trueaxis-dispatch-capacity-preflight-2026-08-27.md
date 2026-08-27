# Dispatch Capacity Preflight — 2026-08-27

## Scope

The Dispatch Board now shows the owner-defined weekly planning capacity for the team member attached to a selected job assignment before a service visit is created. If that member is already over planned capacity, the scheduling dialog presents a clear exception signal while retaining the existing deliberate overlap acknowledgement.

## Boundaries

The signal is owner-only planning information. It does not represent GPS location, live availability, payroll, time-clock evidence, route optimization, an automatic assignment decision, or a client-visible promise. Client-visible visit details remain deliberately curated; staff assignment and internal dispatch information remain private.

## Validation

The release passed strict TypeScript, 75 Vitest files / 208 tests, a production build, and configured bundle-budget checks. The next field-service parity work remains map-based dispatch, route optimization, live staff availability policy, and mobile offline recovery, all of which require separate design and validation.
