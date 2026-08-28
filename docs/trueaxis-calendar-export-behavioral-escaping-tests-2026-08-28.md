# Calendar Export Behavioral Escaping Tests

**Date:** 2026-08-28  
**Scope:** Test-strengthening refinement for existing calendar export

## Observed change

The iCalendar text-escaping helper is now exported as a narrow pure function for direct testing. The focused privacy test executes the helper with CRLF, lone carriage return, newline, semicolon, comma, and backslash input. It verifies the resulting value contains literal iCalendar escapes and no raw carriage-return or newline control characters.

The existing source-contract assertions for opaque owner feed credentials and token-scoped client projections remain in place. No route, token format, ownership rule, event projection, provider connection, or calendar behavior changed.

## Observed validation

| Validation | Observed result |
|---|---|
| TypeScript | `pnpm check` completed successfully. |
| Focused coverage | `icalExportPrivacy`: **1 file / 6 tests passed**, including the direct escaping assertion. |
| Full regression suite | `pnpm test -- --reporter=dot`: **105 files / 292 tests passed**. |
| Production build | `pnpm run build` completed successfully. |
| Bundle budget | `pnpm run check:bundle` passed: entry **517.0/560 KiB**, dashboard **584.1/650 KiB**, home **112.6/140 KiB**, charts **424.7/500 KiB**, CSS **231.7/240 KiB**. |

## Explicit limits

The direct function test does not exercise a calendar-provider request, subscription, refresh, revocation, token rotation, client portal interaction, synchronization, or production deployment behavior.
