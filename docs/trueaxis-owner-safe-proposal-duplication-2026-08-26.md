# TrueAxis HQ — Owner-Safe Proposal Duplication

**Prepared:** August 26, 2026  
**Evidence labels:** Implemented and validated; Research-supported; External validation gate

## Operational Problem and Bounded Acceptance Criterion

Owners need to reuse recurring commercial content without re-entering scope, line items, pricing, package options, and notes. The accepted scope is a protected **Duplicate as a fresh draft** action on an existing workspace-owned proposal. It copies only reusable commercial content into a new proposal row and generates a new secure token.

The duplication action deliberately clears client identity, validity date, send/view/signature state, invoice linkage, package selection, decline reason, and every other public or decision outcome. It does not copy attachments, delivery history, provider state, payment state, or an external share relationship.

## Implemented and Validated

| Surface | Implemented behavior | Evidence |
|---|---|---|
| Owner predicate | Source lookup requires both proposal ID and authenticated owner ID. | `server/routers.ts`; duplication contract. |
| Fresh draft | Each duplicate receives a random fresh token and `draft` status. | Protected mutation; deterministic contract. |
| Reusable content | The duplicate carries title with a `Copy of` prefix, scope, standard line items or package alternatives, tax rate, currency, and notes. | `proposals.duplicate`. |
| Cleared data | The duplicate explicitly starts with no client ID/name/email. Validity, signature, signed package, decline reason, invoice link, viewed/send timestamps, and original token are omitted. | Server mutation and source contract. |
| Owner interface | The Proposals list includes an accessible “Duplicate as a fresh draft” action with status feedback. | `client/src/pages/Proposals.tsx`. |

Package proposals retain their available package definitions but start with empty base line items and zero planning totals, because client selection must happen again through the new token-scoped flow.

## Research-Supported Rationale

Housecall Pro documents estimate copying as a way to reuse existing estimate details while creating a separate estimate record.[1] HoneyBook documents reusable owner templates for commonly used client documents and pricing.[2] TrueAxis HQ provides a constrained record-duplication workflow, not a template library, cross-brand copying system, public template marketplace, attachment copier, or provider-connected send flow.

## Validation Evidence

| Gate | Result |
|---|---|
| Deterministic suite | **46 test files / 153 tests passed**. |
| Focused contracts | Covers owner predicate, fresh random token, draft state, reusable package content, client/decision-state clearing, and protected UI wiring. |
| Strict TypeScript | Passed. |
| Production build | Passed. |
| Bundle budget | Passed: application entry 515.4 KiB / 560 KiB; dashboard route 573.6 KiB / 650 KiB; CSS 222.6 KiB / 240 KiB. |

## External Validation Gates and Deliberate Exclusions

The code does not prove user adoption, delivery, provider behavior, payment, client consent, accounting treatment, or legal effect. It intentionally excludes files, media, delivery records, payment records, and public visibility from duplication. Existing SMTP, Stripe, external receiver, authenticated end-to-end, and mobile Field Mode validation gates remain open.

## References

[1] [Housecall Pro Help Center — How to Copy or Convert Jobs and Estimates](https://help.housecallpro.com/en/articles/2883009-how-to-copy-or-convert-jobs-and-estimates)

[2] [HoneyBook Help Center — Manage and use templates in HoneyBook](https://help.honeybook.com/en/articles/9664257-manage-and-use-templates-in-honeybook)
