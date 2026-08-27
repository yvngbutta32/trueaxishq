# Private Inspection Templates Foundation — 2026-08-27

## Scope

TrueAxis HQ now gives owners a private inspection-template foundation in Job Workspace. An owner can define a named reusable set of bounded question prompts, stored as a versioned owner-scoped template and listed only in the private operations workspace.

## Privacy and functional boundaries

Templates are not client-portal data and do not collect inspection responses, create attachments, update an asset, generate maintenance work, notify a client, operate offline, or establish regulatory compliance. They provide only reusable owner-managed prompts for a later, separately scoped response workflow.

## Validation

The reviewed additive migration `0050_material_the_watchers.sql` created the private template table and owner-active index without altering existing records. Strict TypeScript, the 88-file / 233-test deterministic suite, production build, and configured bundle-budget checks passed.
