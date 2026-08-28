# Candidate-Week Scheduling Context and Admin Route Recovery

**Date:** 2026-08-28  
**Scope:** Protected owner Dispatch Board scheduling guidance and Admin route recovery

## Observed implementation

When an owner opens the service-visit scheduling dialog and selects a job assignment, the Dispatch Board now derives the Monday 00:00 UTC week containing the candidate visit’s start time. It passes that stable week input to the existing protected capacity query. The owner sees the candidate week, the assignee’s already-scheduled duration in that week, the proposed visit duration, and the locally calculated scheduled total if the owner saves the visit.

This is context for an explicit owner decision. It does not automatically assign, reschedule, dispatch, notify, or mutate a record. Existing conflict validation and explicit overlap acknowledgement are unchanged. Private staffing, dispatch notes, availability blocks, capacity signals, routes, GPS, payroll, attendance, and client-visible data remain separated.

During unauthenticated visual verification, `/admin/dispatch` initially showed a React hook-order error. The Admin access-control navigation effect had been declared after a loading early return. It is now declared before every possible early return, preserving a stable hook order. A subsequent unauthenticated desktop render showed the Owner Access screen rather than the error boundary.

## Observed validation

| Validation | Observed result |
|---|---|
| TypeScript | `pnpm check` completed successfully. |
| Focused coverage | `adminHookOrder`, `scheduledCapacityAccuracy`, and `dispatchCapacityPreflight`: **3 files / 7 tests passed**. |
| Full regression suite | `pnpm test -- --reporter=dot`: **101 files / 277 tests passed**. |
| Production build | `pnpm run build` completed successfully. |
| Bundle budget | `pnpm run check:bundle` passed: entry **516.8/560 KiB**, dashboard **584.1/650 KiB**, home **112.6/140 KiB**, charts **424.7/500 KiB**, CSS **231.5/240 KiB**. |
| Route rendering | An unauthenticated desktop capture of `/admin/dispatch` rendered Owner Access after the repair; it did not reproduce the prior hook-order error. |

## Explicit limits

No authenticated owner, staff, or client session was used for this check; therefore the rendered scheduling dialog and its interaction flows were not browser-tested. This record does not establish production operation, staff workload accuracy, payroll or attendance accuracy, routing quality, GPS behavior, delivery, notification behavior, provider behavior, or client-side visibility.

The product-decision research is recorded in `docs/research/competitor-workflow-gap-review-2026-08-28.md`. It uses vendor feature descriptions only as context for a bounded planning improvement and does not establish feature parity or market performance.
