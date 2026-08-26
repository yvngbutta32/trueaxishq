# TrueAxis HQ — Token-Scoped Proposal Decline Capture

**Prepared:** August 26, 2026  
**Evidence labels:** Implemented and validated; Research-supported; External validation gate

## Operational Problem and Bounded Acceptance Criterion

The proposal model already had a `declined` status but a client holding a secure proposal link had no deliberate way to record that decision. The accepted scope is a token-scoped decline action with an optional bounded note. The server records the final decline only when the proposal token, validity window, and active decision state are valid. The optional note is visible to the owner in the proposal workspace and is deliberately removed from public proposal responses.

The decline action does not send email, SMS, notifications, webhooks, or automatic follow-up. It does not create a job, invoice, portal message, or payment event.

## Implemented and Validated

| Surface | Implemented behavior | Evidence |
|---|---|---|
| Token-scoped decision | A client can decline from the secure proposal page, with an optional note limited to 1,000 characters. | `client/src/pages/ProposalSign.tsx`; `proposals.decline`. |
| Server constraints | Decline requires the proposal token, fails for expired links, and refuses a proposal already signed or already declined. | `server/routers.ts`; deterministic contract. |
| Owner-only feedback | The optional reason persists in `proposals.declineReason` and appears only on the owner proposal card for a declined record. | Additive `0041_motionless_typhoid_mary.sql`; owner UI. |
| Public redaction | `getPublic` explicitly removes `declineReason` before it responds to the token holder. | `server/routers.ts`; redaction contract. |
| Client clarity | The public screen asks for an explicit confirmation and plainly says the note is shared only with the proposal owner. | Public proposal UI. |

> This is a recorded application decision, not a delivery event, a customer-relationship outcome, or a binding legal determination.

## Research-Supported Rationale

Housecall Pro documents an estimate workflow in which a customer can approve or decline and the product records the resulting status.[1] Its separate approvals guidance also describes state changes for customer decisions and distinct professional overrides.[2] TrueAxis HQ implements a narrower token-safe choice: a client can record one decline, while an optional reason is retained only for the owner workspace.

## Validation Evidence

| Gate | Result |
|---|---|
| Migration | Reviewed additive `0041_motionless_typhoid_mary.sql` applied successfully: `proposals.declineReason`. |
| Deterministic suite | **45 test files / 150 tests passed**. |
| Focused contracts | Covers bounded reason input, token binding, final-state conflicts, expiry guard, public redaction, owner-only feedback, and absence of automatic communication or follow-up calls. |
| Strict TypeScript | Passed. |
| Production build | Passed. |
| Bundle budget | Passed: application entry 515.4 KiB / 560 KiB; dashboard route 573.6 KiB / 650 KiB; CSS 222.6 KiB / 240 KiB. |

## External Validation Gates and Deliberate Exclusions

This release does not validate email or SMS delivery, client identity beyond possession of the existing token, legal effect, customer adoption, provider behavior, payment, or actual follow-up. Existing SMTP, Stripe, external receiver, authenticated owner/client, and mobile Field Mode gates remain open.

## References

[1] [Housecall Pro Help Center — How to Send an Estimate](https://help.housecallpro.com/en/articles/120533-how-to-send-an-estimate)

[2] [Housecall Pro Help Center — Estimates: Approvals and Signatures](https://help.housecallpro.com/en/articles/918072-estimates-approvals-and-signatures)
