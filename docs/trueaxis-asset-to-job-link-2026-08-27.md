# Private Asset-to-Job Service Context — 2026-08-27

## Scope

Owners can now explicitly link an active customer asset to a job from the private Job Workspace. A job may have no linked asset, and the link can be cleared deliberately.

## Data isolation

Before persistence, the server confirms the job belongs to the authenticated owner and verifies that the selected active asset belongs to both that owner and the job’s client. Asset context remains excluded from public client-portal routes. This is a manual operational association only; it does not generate service history, maintenance plans, inventory movements, or client notifications.

## Validation

The reviewed additive migration `0049_huge_sleeper.sql` added the nullable job asset reference and index without changing existing jobs. Strict TypeScript, 86 Vitest files / 230 tests, the production build, and configured bundle budgets passed.
