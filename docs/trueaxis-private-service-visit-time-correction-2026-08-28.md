# Private Service-Visit Time Correction

**Date:** 2026-08-28  
**Scope:** Protected owner Dispatch Board timing correction

## Observed implementation

Owners can now select an active private service visit and correct only its start and end time. The form preserves the visit’s job, existing assignment, status, internal dispatch note, client-visible flag, and client update. It derives private capacity context from the UTC week containing the proposed start time.

The protected update procedure rejects timing updates for completed or cancelled visits. It retains the final visit-and-owner update predicate and applies the existing overlap and private-availability checks to the proposed window. An owner must explicitly acknowledge an intentional conflict. A successful timing update writes a private owner activity record, without sending a notification or changing a client-facing field.

## Observed validation

| Validation | Observed result |
|---|---|
| TypeScript | `pnpm check` completed successfully. |
| Focused coverage | `serviceVisitTimeCorrection`, `serviceVisitReassignment`, `dispatchCapacityPreflight`, and `scheduledCapacityAccuracy`: **4 files / 12 tests passed**. |
| Full regression suite | `pnpm test -- --reporter=dot`: **103 files / 283 tests passed**. |
| Production build | `pnpm run build` completed successfully. |
| Bundle budget | `pnpm run check:bundle` passed: entry **516.8/560 KiB**, dashboard **584.1/650 KiB**, home **112.6/140 KiB**, charts **424.7/500 KiB**, CSS **231.5/240 KiB**. |
| Rendered route boundary | An unauthenticated 375px capture of `/admin/dispatch` rendered the restricted Admin Access screen without a visible error. |

## Explicit limits

No authenticated owner, staff, or client session was available to browser-test the time-correction form. The correction itself, conflict acknowledgement, field retention, activity record, and portal exclusion are supported by source-contract tests and build checks. This record does not establish production behavior, calendar synchronization, client notification, staff acceptance, live availability, payroll, attendance, routing, GPS, ETA, provider delivery, or client-facing staff identity.
