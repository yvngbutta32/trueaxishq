# TrueAxis HQ — Token-Scoped Proposal Package Selection

**Prepared:** August 26, 2026  
**Evidence labels:** Implemented and validated; Research-supported; External validation gate

## Operational Problem and Bounded Acceptance Criterion

TrueAxis HQ proposals previously presented one fixed collection of line items. The bounded improvement is an owner-defined choice between two or three package alternatives on one proposal. A holder of that proposal’s secure token can select **one** listed option and sign. The server records a snapshot of the selected option at signature time, recalculates its line totals, and uses that signed selection if the owner later converts that package proposal to an invoice.

The implementation deliberately excludes package templates, multiple selection, add-ons, payment collection, automatic job creation, automatic delivery, scheduling, and marketplace behavior.

## Implemented and Validated

| Surface | Implemented behavior | Evidence |
|---|---|---|
| Owner configuration | The proposal composer can enable a bounded set of **two or three** alternatives, with a name, optional description, and one or more priced line items per alternative. Ordinary fixed-price proposals remain available. | `client/src/pages/Proposals.tsx`; input validation in `server/routers.ts`. |
| Token-scoped client choice | The public proposal page presents available options as selectable cards. Signing is blocked until a package proposal has one selected option. | `client/src/pages/ProposalSign.tsx`; public-route contract. |
| Server authority | On signing, the server parses stored options, validates that the requested package ID belongs to the token’s proposal, recalculates totals from quantity and unit price, and snapshots the selected package, final line items, subtotal, and total. | `shared/proposalPackages.ts`; `server/routers.ts`. |
| Immutability | A signed proposal cannot be edited. The signing update is constrained by proposal ID, token, and prior status to avoid overwriting an already changed state. | Proposal selection regression contract. |
| Invoice conversion | A proposal with configured packages cannot convert before a signed package selection exists. After signature, conversion uses the selected package’s server-persisted line items and total. | `server/routers.ts`; selection contract. |
| Recovery and privacy | The existing token-scoped proposal recovery state remains in use. No public owner record lookup, package-template catalog, or client portal financial-record expansion was added. | `ProposalSign.tsx`; existing public recovery and portal contracts. |

> The selected package is an application-recorded proposal choice. It does **not** prove payment, deliver a service, create a job, or establish a provider-confirmed booking.

## Research-Supported Rationale

HoneyBook documents proposal packages and add-ons as part of its broader proposal workflow.[1] Dubsado documents package choices inside proposals, including a choice between one or multiple packages and optional downstream contract/invoice connections.[2] Housecall Pro documents a side-by-side multi-option sales-proposal workflow.[3]

TrueAxis HQ now implements a narrow client-choice workflow based on the safe overlap: **owner-defined alternatives, one token-scoped selection, and recorded final terms on signature**. It does not claim feature parity with the cited products or their payment, scheduling, template, financing, mobile, automation, or integration ecosystems.

## Validation Evidence

| Gate | Result |
|---|---|
| Migration | Reviewed additive `0040_fast_polaris.sql` applied successfully: `packageOptions`, `selectedPackageId`, and `selectedPackage` on proposals. |
| Deterministic suite | **43 test files / 145 tests passed**. |
| Focused contracts | Covers malformed-package rejection, server-derived totals, token-bound selection, signed immutability, selection-gated conversion, owner/UI bounds, and absence of an invoice-create action in the public choice page. |
| Strict TypeScript | Passed. |
| Production build | Passed. |
| Bundle budget | Passed: application entry 515.4 KiB / 560 KiB; dashboard route 573.6 KiB / 650 KiB; CSS 221.9 KiB / 240 KiB. |

## External Validation Gates and Deliberate Exclusions

The application code does not validate actual user consent, enforceability in a specific jurisdiction, payment completion, email delivery, accounting treatment, tax treatment, scheduling, or customer adoption. Package-template libraries, multiple option selection, add-ons, and automatic follow-up are not included. Existing SMTP, Stripe, real receiver, authenticated end-to-end, and mobile Field Mode validation gates remain open.

## References

[1] [HoneyBook — Proposal software](https://www.honeybook.com/proposal-software)

[2] [Dubsado Help Center — Build a proposal in 2.0](https://help.dubsado.com/en/articles/467057-build-a-proposal-in-2-0)

[3] [Housecall Pro Help Center — Sales Proposal Tool](https://help.housecallpro.com/en/articles/7216553-sales-proposal-tool)
