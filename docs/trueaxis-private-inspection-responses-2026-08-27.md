# TrueAxis HQ private inspection responses — 2026-08-27

## Scope

TrueAxis HQ records a private inspection response only for an authenticated owner’s job that has a linked customer asset. The response is bound to the owner, job, client, linked asset, selected active template, template version, ordered answers, and a field-definition snapshot created at save time.

## Integrity and isolation criteria

The response procedure resolves the job with a final owner predicate, requires that the submitted asset is the exact asset linked to that job, and checks that the asset belongs to both the same owner and the job’s client. It also requires an active owner-owned template. Server-side validation parses the stored template definition, rejects answer IDs absent from that template and duplicate answer IDs, and requires values for template fields marked required. Accepted answers are normalized to the template’s stored field order.

The field-definition snapshot is stored with each response so saved labels and required markers do not depend on future template-revision behavior. The current template workflow remains creation and lifecycle control only; a future editing or revision feature must preserve the existing version-and-snapshot contract rather than overwrite historical response context.

## Private interface and exclusions

The protected Job Workspace provides the only response entry and history interface. It requires an existing linked asset, presents only active templates, labels the records as internal, and handles loading, empty, and error states. The client portal router and client-facing components do not project inspection responses.

This release does **not** add attachments, photos, signatures, client delivery, client review, compliance certification, maintenance automation, notifications, offline storage or synchronization, inventory, or provider integrations. It does not claim that an inspection is complete, externally reviewed, or suitable for any regulated process.

## Release validation

Before publication, validation must include strict TypeScript, focused private inspection-response coverage, the full deterministic test suite, production build, and configured bundle-budget checks. The reviewed additive migrations are `0051_spicy_union_jack.sql` for the private response table and indexes, plus `0052_brave_earthquake.sql` for the response field-definition snapshot. Neither migration changes existing asset, job, client, or portal records.
