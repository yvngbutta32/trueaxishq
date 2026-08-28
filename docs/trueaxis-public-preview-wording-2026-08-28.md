# Public Preview and Calendar-Feed Wording Correction

**Date:** 2026-08-28  
**Scope:** Public homepage text only

## Observed correction

The homepage product illustration now identifies itself as a **Workspace preview** rather than a live view. The iCal feature description now says it shares a subscription calendar feed with compatible calendar applications, rather than calling the feed live.

No route, data model, synchronization behavior, provider connection, or calendar output changed.

## Observed validation

| Validation | Observed result |
|---|---|
| TypeScript | `pnpm check` completed successfully. |
| Focused coverage | `publicEvidenceBoundaryCopy` and `publicTrustCompletionCopy`: **2 files / 5 tests passed**. |
| Full regression suite | `pnpm test -- --reporter=dot`: **105 files / 290 tests passed**. |
| Production build | `pnpm run build` completed successfully. |
| Bundle budget | `pnpm run check:bundle` passed: entry **517.0/560 KiB**, dashboard **584.1/650 KiB**, home **112.6/140 KiB**, charts **424.7/500 KiB**, CSS **231.7/240 KiB**. |
| Rendered artifact | A desktop homepage capture displayed the revised Workspace preview label without a visible layout failure. |

## Explicit limits

This correction does not establish real-time analytics, calendar synchronization, provider delivery, feed refresh behavior, client adoption, browser compatibility, or production operation. Native calendar synchronization remains an external/provider validation gate.
