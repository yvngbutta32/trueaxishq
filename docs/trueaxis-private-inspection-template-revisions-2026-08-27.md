# TrueAxis HQ private inspection-template revisions — 2026-08-27

## Delivered behavior

The private Job Workspace now provides a revision path for active inspection templates. An owner can open an active template, update the private template name and questions, add or remove questions, mark questions required, and create the next version. The server creates a new active template record inside a transaction and retires the source version instead of overwriting its saved field definition.

| Control | Verified behavior |
| --- | --- |
| Ownership | List, creation, revision, and lifecycle operations are protected and carry final `userId` predicates. |
| Revision chain | New templates receive a private family identifier; revision numbering advances within that family. |
| Concurrent action | The source template must still be active at the transaction’s final update, otherwise the request returns a conflict rather than producing a competing revision. |
| Lifecycle | A family cannot have two active revisions through reactivation; an owner must first deactivate the current revision. |
| Historical answers | Existing job inspection responses retain `templateVersion` and a `templateFields` snapshot captured at response creation. A later template revision does not overwrite an existing response’s rendered labels. |

## Validation

Strict TypeScript checking passed. Focused inspection template and response coverage passed with 7 tests. The full suite passed with **91 test files and 243 tests**. The production build and configured bundle budgets passed. The protected Job Workspace revision UI was not visually exercised with a real owner session in this release; authenticated owner, staff, and client end-to-end validation remains an explicit separate gate.

## Deliberate boundaries

This change is private to the owner workspace. Templates, revision controls, field definitions, and response snapshots remain excluded from public booking, public intake, proposals, feedback, and client portal projections. The release does not add inspection attachments, photo/signature capture, conditional logic, task binding, maintenance automation, offline synchronization, PDF export, client delivery, regulatory compliance, or a claim of parity with other products.

The versioning design follows the documented pattern in which a published inspection is changed through a new version rather than retroactively changing the version tied to work already created. [1]

## Reference

[1]: https://learn.microsoft.com/en-us/dynamics365/field-service/inspections-advanced "Microsoft Learn: Configure advanced options for inspections"
