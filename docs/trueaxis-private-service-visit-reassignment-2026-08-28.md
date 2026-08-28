# Private Service-Visit Reassignment

**Date:** 2026-08-28  
**Scope:** Protected owner Dispatch Board correction workflow

## Observed implementation

The protected `dispatch.updateVisit` mutation now accepts an optional replacement team-member identifier. A reassignment is accepted only when the existing visit is active, the replacement member is active and owned by the current workspace, and that member has an active `assigned` or `acknowledged` assignment on the visit’s existing owned job.

Before saving, the procedure recomputes active-visit and private-availability conflicts for the replacement member using the existing visit window. A conflict requires the same explicit `allowConflict` acknowledgement already used for service-visit scheduling. The final update predicate remains scoped to the visit and current owner. Successful reassignment creates a private owner activity record.

Dispatch Board now provides a **Correct visit assignment** section. It limits the candidate list to active job assignments for the selected visit’s job, omits the current member, displays the visit’s private candidate-week scheduled-load context, and requires a deliberate save action. The interface states that it does not notify, dispatch, reschedule, or change client-facing fields automatically.

## Observed validation

| Validation | Observed result |
|---|---|
| TypeScript | `pnpm check` completed successfully. |
| Focused coverage | `serviceVisitReassignment`, `dispatchCapacityPreflight`, and `scheduledCapacityAccuracy`: **3 files / 9 tests passed**. |
| Full regression suite | `pnpm test -- --reporter=dot`: **102 files / 280 tests passed**. |
| Production build | `pnpm run build` completed successfully. |
| Bundle budget | `pnpm run check:bundle` passed: entry **516.8/560 KiB**, dashboard **584.1/650 KiB**, home **112.6/140 KiB**, charts **424.7/500 KiB**, CSS **231.5/240 KiB**. |
| Rendered route boundary | An unauthenticated desktop capture of `/admin/dispatch` rendered the restricted Admin Access screen, not a Dispatch Board interaction. |

## Explicit limits

No authenticated owner, staff, or client session was available for browser interaction. The reassignment control, conflict acknowledgement, activity history, and client projection were therefore verified through source-contract tests and build checks, not an authenticated browser run. This does not establish production behavior, staff notification or acceptance, live availability, payroll, attendance, GPS, routing, ETA, provider delivery, or client-facing staff-identity behavior.
