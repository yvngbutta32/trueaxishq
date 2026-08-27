# Map-Provider Load Recovery — 2026-08-27

## Finding and correction

The shared map loader previously logged a provider-script error but left the map initialization promise unresolved. A private dispatch map could therefore remain indefinitely pending when the provider script did not load. The loader now resolves an explicit failure state, and the map component renders an accessible unavailability message.

## Dispatch impact

The owner Dispatch Board receives the failure state, clears map/route state, disables route preview, and states that dispatch scheduling and private visit data remain unchanged. The availability of a map does not gate operational scheduling.

## Validation

Validation passed with strict TypeScript, 80 Vitest files / 221 tests, a production build, and the configured bundle-budget gate.
