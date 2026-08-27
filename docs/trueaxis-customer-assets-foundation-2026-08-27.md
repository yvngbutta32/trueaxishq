# Customer Assets Foundation — 2026-08-27

## Scope

TrueAxis HQ now provides an owner-scoped customer-assets foundation. An owner can create a bounded equipment record for an owned client and view that client’s private asset context in Job Workspace.

## Privacy boundaries

Each asset is bound to both the owner workspace and one owned client. The protected list and create procedures re-check client ownership. Asset name, tag, functional-location label, and notes remain private operational data; no asset model or projection is included in client portal routes. This is a foundation for manual equipment context, not inventory control, barcode scanning, warranty management, IoT monitoring, or automatic maintenance planning.

## Validation

The reviewed additive migration `0048_opposite_purple_man.sql` created the `customerAssets` table and indexes without changing existing records. Strict TypeScript, 85 Vitest files / 229 tests, the production build, and configured bundle budgets passed.
