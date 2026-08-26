# TrueAxis HQ — Proposal Draft Editing Correction

**Prepared:** August 26, 2026  
**Evidence labels:** Implemented and validated; Correction

## Corrected Workflow Gap

The owner-safe duplication release created a deliberately client-free fresh draft. During follow-on review, the proposal workspace lacked a direct way to populate and save that draft before sharing it. This was a confirmed workflow gap because a fresh draft needs client details and owner adjustments before it can become a useful proposal.

The correction reuses the existing Proposal composer. Owners can now open a draft, load its content into the form, edit standard or package-based commercial data, clear an optional validity date, and save the protected update. Signed proposals remain non-editable.

## Implemented and Validated

| Surface | Corrected behavior | Evidence |
|---|---|---|
| Draft entry point | Draft proposals now expose an accessible **Edit draft** action. | `client/src/pages/Proposals.tsx`. |
| Composer loading | The existing proposal form loads client fields, title, scope, standard line items, package options, tax, currency, validity date, and notes from the selected draft. | Owner composer logic; focused contract. |
| Protected persistence | `proposals.update` now accepts bounded package options, supports clearing `validUntil`, recalculates ordinary proposal totals when tax changes, and remains owner-scoped. | `server/routers.ts`. |
| Package behavior | Editing packages normalizes package line items; turning packages on clears base planning totals; turning them off retains a usable standard line-item starter. | Server and owner UI contracts. |
| Integrity guard | Signed proposals still cannot be edited. Duplicate-cleared data remains cleared until the owner explicitly supplies new values. | Regression contracts. |

## Validation Evidence

| Gate | Result |
|---|---|
| Deterministic suite | **47 test files / 156 tests passed**. |
| Focused contracts | Covers protected standard/package updates, signed-record guard, composer loading, fresh-draft clearing, and updated total calculation. |
| Strict TypeScript | Passed. |
| Production build | Passed. |
| Bundle budget | Passed: application entry 515.4 KiB / 560 KiB; dashboard route 573.6 KiB / 650 KiB; CSS 222.6 KiB / 240 KiB. |

## Boundary

The correction does not add automatic sending, email delivery, payments, contracts, scheduling, client portal access, or external-provider behavior. It restores the owner workflow necessary to prepare a freshly duplicated draft before the already existing send action is intentionally chosen.
