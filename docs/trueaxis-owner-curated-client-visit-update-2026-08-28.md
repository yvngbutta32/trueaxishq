# Owner-Curated Client Visit Update

**Date:** 2026-08-28  
**Scope:** Protected owner Dispatch Board coordination control

## Observed implementation

Owners can now select an active service visit and deliberately control its existing client-visible flag and curated update text. The control is separated from private reassignment, time correction, capacity, availability, site routing, and internal dispatch notes. It limits the text to the existing 500-character stored update field.

The protected visit update retains the final visit-and-owner predicate and rejects client-update corrections for completed or cancelled visits. Hiding the visit clears the stored client update through the existing explicit visibility policy. Saving the form only updates the portal-visible fields; it does not create email, SMS, push, calendar, or other delivery activity.

## Observed validation

| Validation | Observed result |
|---|---|
| TypeScript | `pnpm check` completed successfully. |
| Focused coverage | `clientVisibleVisitCorrection`, `clientVisibleVisit`, `serviceVisitTimeCorrection`, and `serviceVisitReassignment`: **4 files / 10 tests passed**. |
| Full regression suite | `pnpm test -- --reporter=dot`: **104 files / 286 tests passed**. |
| Production build | `pnpm run build` completed successfully. |
| Bundle budget | `pnpm run check:bundle` passed: entry **516.8/560 KiB**, dashboard **584.1/650 KiB**, home **112.6/140 KiB**, charts **424.7/500 KiB**, CSS **231.7/240 KiB**. |
| Rendered route boundary | An unauthenticated desktop capture of `/admin/dispatch` rendered restricted Admin Access without a visible error. |

## Explicit limits

No authenticated owner or client session was available for browser interaction. The curation form, active-state rule, owner scope, and portal-field exclusion were verified through source-contract tests and build checks, not an authenticated end-to-end run. This release does not establish client delivery, read receipts, acknowledgements, live location, staffing visibility, calendar synchronization, provider delivery, or production behavior.
