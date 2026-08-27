# Field Mode Draft Privacy — 2026-08-27

## Scope

Recoverable Field Mode client-update drafts now use `sessionStorage`, keyed to the selected job, rather than persistent browser storage. Drafts survive ordinary activity within the active browser session but are not retained as a long-lived shared-device record.

## User and privacy boundaries

Field Mode states that a draft is saved for the current browser session and that posting remains an intentional client-portal action. Offline and retry guidance now uses the same boundary. The change does not queue updates for delivery, upload files offline, or claim that client communications were sent.

## Validation

Validation passed with strict TypeScript, 82 Vitest files / 225 tests, a production build, and the configured bundle-budget gate.
