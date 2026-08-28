# Managed Schedule Evidence and Reliability Gate

**Date:** 2026-08-28  
**Scope:** Current project-level scheduled execution evidence; no implementation change

## Observed application state

The server currently calls `startBackgroundJobs()` after each process starts. That function defers one run and then uses an in-process hourly interval for eight tasks: overdue detection, recurring invoices, follow-up reminders, follow-up rules, monthly reporting, booking reminders, post-session check-ins, and due automations. An in-process timer is not a durable trigger for an autoscaling web deployment; the project scheduling guidance explicitly prohibits using it for recurring work.[1]

One project-managed schedule currently exists: `daily-digest`, targeting `POST /api/scheduled/dailyDigest` at `0 0 8 * * *` (08:00 UTC). Its configured callback payload is empty. The active handler requires `x-digest-cron-secret`, while the active environment did not have `DIGEST_CRON_SECRET` configured during inspection.

## Observed run history

The scheduler history returned **14 successful** and **15 failed** executions for the existing daily-digest task. The most recent observed failed run was scheduled at `2026-08-28T08:04:24Z`, returned HTTP **403**, and completed with one attempt. Earlier observed failures returned 403 or 404. This is evidence of an unresolved scheduled-callback path; it does not establish whether any message was delivered or whether any provider behaved correctly.

## Decision boundary

No callback-authentication replacement was implemented. The current application uses local JWT/session authentication and does not include the documented cron identity verification path. Introducing a new callback acceptance scheme without verifying the platform’s request identity would risk opening a protected execution endpoint or silently losing scheduled work.

The next safe step is to adapt the documented managed-callback identity model, validate it against a controlled scheduled run, and only then replace the in-process timer. Each background task must retain its existing item-level idempotency controls, and any global runner must not cross owner boundaries.

## Explicit exclusions

This record does not claim that background processing, client notifications, transactional emails, invoice changes, automation actions, provider delivery, retries, or production availability are working. No live schedule was created, updated, paused, triggered, or deleted in this review.

## References

[1] [Manus — Schedules documentation](https://manus.im/docs/website-builder/schedules)
