# TrueAxis HQ — Proposal Validity-Date Enforcement

**Prepared:** August 26, 2026  
**Evidence labels:** Implemented and validated; Research-supported; External validation gate

## Operational Problem and Bounded Acceptance Criterion

Proposals already stored an optional `validUntil` date and presented it to clients, but the token-scoped server flow did not previously enforce the date at public view or signing time. The accepted scope is to make that existing date operational: a date-free proposal remains available, while a dated proposal cannot be viewed or signed after the selected date has ended.

The server evaluates a configured validity date through **23:59:59.999 UTC** on that calendar day. Expired links receive the same generic public recovery behavior as unavailable links, avoiding an additional record-disclosure signal.

## Implemented and Validated

| Surface | Implemented behavior | Evidence |
|---|---|---|
| Validity helper | A pure shared helper accepts no date, treats malformed stored values as expired, and evaluates a valid date through its final UTC millisecond. | `shared/proposalValidity.ts`; boundary contracts. |
| Token-scoped view | `proposals.getPublic` rejects an expired token link with the same generic unavailable/expired response used for missing records. | `server/routers.ts`; existing `PublicRecoveryState`. |
| Token-scoped signing | `proposals.sign` refuses a signature after expiry, before any package selection or signature state is recorded. | `server/routers.ts`; deterministic contract. |
| Owner clarity | The owner form now explains that a chosen date keeps the secure link available through the end of the selected UTC date. | `client/src/pages/Proposals.tsx`. |
| No-date continuity | Proposals without a validity date remain available under existing status and token rules. | `server/proposalValidity.test.ts`. |

## Research-Supported Rationale

Dubsado’s proposal guidance documents expiration as a control that prevents new leads from submitting a proposal after its configured date and time.[1] TrueAxis HQ implements a smaller deterministic version using the product’s existing date-only field. It does not claim relative expiration rules, per-owner time zones, password protection, delivery confirmation, payment collection, or legal enforceability.

## Validation Evidence

| Gate | Result |
|---|---|
| Deterministic suite | **44 test files / 147 tests passed**. |
| Focused contracts | Covers no-date availability, final-UTC-millisecond boundary, next-day expiry, malformed stored date failure, generic token view response, signing block, and owner clarity copy. |
| Strict TypeScript | Passed. |
| Production build | Passed. |
| Bundle budget | Passed: application entry 515.4 KiB / 560 KiB; dashboard route 573.6 KiB / 650 KiB; CSS 221.9 KiB / 240 KiB. |

## External Validation Gates and Deliberate Exclusions

This application-level control does not validate contractual enforceability, time-zone expectations for a particular business, email delivery, client consent, payment, or customer adoption. Existing provider, real-session, and mobile validation gates remain open.

## References

[1] [Dubsado Help Center — Build a proposal in 2.0](https://help.dubsado.com/en/articles/467057-build-a-proposal-in-2-0)
