# TrueAxis HQ private Job Workspace worklist controls — 2026-08-27

## Delivered behavior

Job Workspace now provides an owner-only local search field and status filter for the already authorized job worklist. Search matches only the existing job number, job title, and client name; status filtering uses the current job lifecycle values. The matching count, a reset control, and a clear no-match state make the worklist easier to scan without altering jobs or making a new server request.

| Aspect | Implemented boundary |
| --- | --- |
| Scope | Filtering occurs only in the protected Job Workspace list. |
| Data access | It operates on the existing owner-scoped job query; it does not widen the server query or fetch additional records. |
| Accessibility | The search input has an associated label, keyboard-reachable reset control, visible focus treatment, and explicit no-match guidance. |
| Responsiveness | Controls stack safely in the narrow worklist and the list retains its bounded scroll area. |
| Side effects | Search, status changes, reset, and opening an existing job do not mutate a job lifecycle or create client-visible activity. |

## Validation

Strict TypeScript checking passed. Focused worklist and Job Workspace contract coverage passed with 7 tests. The full suite passed with **93 test files and 248 tests**, and the production build plus configured bundle-budget check passed. The protected owner interface was not exercised using a real authenticated session in this release; that remains a separate validation gate.

## Deliberate boundaries

This feature is a local navigation aid, not scheduling intelligence. It does not rank work, alter status, make staffing or routing recommendations, infer priority, write to any record, or expose job data in any public or client portal route.

Microsoft documents status and filtering as useful work-order list capabilities, while distinguishing such a list from the deeper job lifecycle and scheduling functions. [1] [2]

## References

[1]: https://learn.microsoft.com/en-us/dynamics365/field-service/work-order-experience "Microsoft Learn: Work order experience"
[2]: https://learn.microsoft.com/en-us/dynamics365/field-service/work-order-status-booking-status "Microsoft Learn: Work order lifecycle and system statuses"
