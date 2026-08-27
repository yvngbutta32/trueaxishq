# Job worklist efficiency evidence — 2026-08-27

Microsoft’s Field Service work-order guidance identifies status, service account, priority, and booked resources as high-frequency worklist information, and describes filtering as a mechanism for finding information quickly. [1] It also distinguishes a work-order lifecycle from booking status and supports progressively more detailed views rather than overloading a single worklist. [2]

For TrueAxis HQ, the bounded implementation is local filtering of the already authorized owner Job Workspace list by existing status and by a case-insensitive match over job number, job title, and client name. The control must not update jobs, change their lifecycle, make scheduling recommendations, infer priority, reveal additional client records, alter server query scope, or appear in public/client portal flows.

## References

[1]: https://learn.microsoft.com/en-us/dynamics365/field-service/work-order-experience "Microsoft Learn: Work order experience"
[2]: https://learn.microsoft.com/en-us/dynamics365/field-service/work-order-status-booking-status "Microsoft Learn: Work order lifecycle and system statuses"
