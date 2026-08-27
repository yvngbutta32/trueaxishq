# Private Dispatch Route Preview — 2026-08-27

## Scope

The owner Dispatch Board can now draw a driving route preview across two or more resolved, active service-visit site labels. Stops follow the current scheduled visit order; the implementation expressly disables waypoint optimization.

## Guardrails

The route is an owner-only planning preview. It does not expose location data in the client portal, change a visit, contact a client, optimize route order, use live traffic, track staff, or promise an ETA. The UI clearly handles insufficient resolved sites, provider route failures, and explicit route clearing.

## Validation

Validation passed with strict TypeScript, 79 Vitest files / 219 tests, a production build, and the configured bundle-budget gate. Real route behavior depends on resolvable site labels and the mapped provider service at runtime; authenticated owner workflow verification remains an external test gate.
