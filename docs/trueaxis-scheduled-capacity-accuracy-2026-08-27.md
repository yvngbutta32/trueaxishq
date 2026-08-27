# Scheduled-Capacity Accuracy — 2026-08-27

## Scope

Owner capacity calculations now separately report assignment planning load and the time assigned to active service visits that begin in the current UTC week. This prevents the interface from presenting planned assignment time as though it were scheduled field time.

## Guardrails

The current-week signal is private owner planning information. It is not a declaration of staff availability, attendance, GPS location, payroll time, or a client-visible commitment. The scheduling dialog preserves explicit conflict acknowledgement rather than automatically preventing owner decisions.

## Validation

Validation passed with strict TypeScript, 81 Vitest files / 223 tests, a production build, and the configured bundle-budget gate.
