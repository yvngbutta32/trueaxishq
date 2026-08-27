# Private Dispatch Map Preview — 2026-08-27

## Scope

The owner Dispatch Board now presents a private map preview for up to twelve active service visits with site labels. It resolves only existing owner-visible site labels at display time and shows the associated visit title as a map marker.

## Privacy and operational boundaries

The map is an owner planning view only. Site locations are not added to the client portal. The feature does not represent route optimization, travel-time estimates, real-time staff location, GPS tracking, or a client-facing arrival commitment. It provides clear empty and unresolved-label feedback rather than treating address resolution as guaranteed.

## Validation

Validation passed with strict TypeScript, 78 Vitest files / 216 tests, a production build, and the configured bundle-budget gate. Full route optimization and staff-location policy require a separate scoped implementation and validation plan.
