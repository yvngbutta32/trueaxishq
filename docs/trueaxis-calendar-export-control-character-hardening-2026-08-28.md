# Calendar Export Control-Character Hardening

**Date:** 2026-08-28  
**Scope:** Server-side iCalendar text output; no provider integration change

## Observed implementation

Calendar text escaping now normalizes CRLF and lone carriage-return characters to a logical newline before escaping iCalendar text values. Backslashes, semicolons, commas, and the normalized newline are then escaped as before. This prevents a raw carriage return in a service name, client value, business name, or other emitted text field from creating an unintended iCalendar content line.

The private owner feed remains addressed by a revocable opaque credential whose SHA-256 hash is stored for lookup. Its event output remains service-only. The separate portal-token path remains constrained to the token’s client and continues to omit client contact information and private notes.

## Research context

The iCalendar specification defines a format for exchanging calendaring and scheduling information; it is not a provider synchronization protocol.[1] Google documents subscription by URL only for a public calendar and requires sharing approval for a private Google calendar, so this release does not claim Google subscription compatibility for a private TrueAxis feed.[2] Microsoft distinguishes an imported `.ics` snapshot from a subscribed online calendar and states that subscription refresh timing is controlled by the client service, potentially taking more than 24 hours.[3]

## Observed validation

| Validation | Observed result |
|---|---|
| TypeScript | `pnpm check` completed successfully. |
| Focused coverage | `icalExportPrivacy`: **1 file / 6 tests passed**. |
| Full regression suite | `pnpm test -- --reporter=dot`: **105 files / 292 tests passed**. |
| Production build | `pnpm run build` completed successfully. |
| Bundle budget | `pnpm run check:bundle` passed: entry **517.0/560 KiB**, dashboard **584.1/650 KiB**, home **112.6/140 KiB**, charts **424.7/500 KiB**, CSS **231.7/240 KiB**. |

## Explicit limits

No calendar-provider account, feed request, subscription, refresh, revocation, or client portal browser session was exercised. This code-level correction does not establish native calendar synchronization, delivery, refresh timing, universal calendar-client compatibility, provider behavior, or production operation.

## References

[1] [IETF RFC 5545 — Internet Calendaring and Scheduling Core Object Specification](https://datatracker.ietf.org/doc/html/rfc5545)

[2] [Google Calendar Help — Subscribe to someone else’s calendar](https://support.google.com/calendar/answer/37100?hl=en&co=GENIE.Platform%3DDesktop)

[3] [Microsoft Support — Import or subscribe to a calendar in Outlook](https://support.microsoft.com/en-us/outlook/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web)
