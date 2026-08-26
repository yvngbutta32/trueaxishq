# Revocable Owner Calendar Feed Hardening — 2026-08-26

## Scope

TrueAxis HQ now provides a separate owner-managed calendar subscription credential. The dashboard no longer presents an identifier-based `/api/calendar/{userId}.ics` address as a shareable subscription link. Existing authenticated owner exports and the previously repaired client-portal calendar path remain separate authorization mechanisms.

## Security and privacy controls

| Control | Implemented behavior |
| --- | --- |
| Opaque route | Private subscriptions use `/api/calendar/feed/{credential}.ics`; the route does not expose or accept an owner identifier. |
| One-way storage | A 32-byte random credential is SHA-256 hashed before persistence. The raw credential is returned only when an owner creates or rotates a feed. |
| Owner scope | Status, create, rotate, and revoke operations are protected and bound to the authenticated owner's user ID. |
| Rotation and revocation | Rotation replaces the stored hash, invalidating the prior URL. Revocation removes public subscription access under a final active-record predicate. |
| Minimal calendar output | The credential feed contains service-level appointment summaries and scheduling times only; it omits client names, email addresses, and booking notes. |
| Token separation | Owner credentials are not client portal tokens, user IDs, or API keys. Portal-token exports remain scoped to the relevant client. |

## Evidence

The live table was empty before conversion from the initial raw-token draft to `tokenHash`, so the reviewed migration renamed the column without transforming issued credentials. Validation completed with strict TypeScript, 74 Vitest files / 205 tests, a production build, and the configured bundle-budget gate.

## Non-goals and remaining boundaries

This release does not implement Google, Apple, or Outlook API synchronization, and it does not guarantee third-party calendar delivery or refresh behavior. Provider delivery, Stripe Checkout and signed-webhook walkthroughs, a real external signed-webhook receiver, and authenticated owner/client responsive end-to-end journeys remain external validation gates.
