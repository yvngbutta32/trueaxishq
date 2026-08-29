# Reviewed Client Proof-Photo Visibility

**Date:** 2026-08-29  
**Scope:** Consolidated owner-curated portal sharing for job proof photos

## Observed implementation

Job photos now have a default-private `clientVisible` field. The reviewed generated migration `0061_fresh_valeria_richards.sql` adds the field with a false default and the `(userId, jobId, clientVisible)` index. The database inspection after application confirmed the default-private `tinyint(1)` column and index components.

Owners can now deliberately reveal or hide an owned, non-receipt proof photo from the protected Job Workspace. The server resolves the owned job and photo, requires that the photo is linked to that job and belongs to the same client, rejects receipt photos, retains final owner, job, and client predicates in its update, and records a private visibility activity only when the setting changes. Linking a photo to a job resets it to private so sharing is reviewed for that job.

Both token-scoped portal photo projections now require `clientVisible = true` and retain the existing `estimate`, `wip`, and `finished` type constraint. Receipt photos and photo storage keys remain excluded. The owner interface uses the existing visual system with explicit **Shared with client** and **Private to your workspace** controls; the portal now states that proof photos are provider-chosen.

## Evidence context

Current Jobber and Housecall Pro documentation shows that client portals commonly provide customer access to work, appointment, quote, and invoice information.[1] [2] This is context for the reviewed-sharing decision only. It does not establish TrueAxis feature parity, the same authentication model, customer outcomes, or provider behavior.

## Observed validation

| Validation | Observed result |
|---|---|
| Database schema | The `clientVisible` column and `jobPhotos_user_job_clientVisible_idx` index were confirmed after the reviewed additive SQL was applied. |
| TypeScript | `pnpm check` completed successfully. |
| Focused coverage | Reviewed proof-photo/task/visit/document portal checks: **5 files / 17 tests passed**. |
| Full regression suite | `pnpm test -- --reporter=dot`: **116 files / 320 tests passed**. |
| Production build | `pnpm run build` completed successfully. |
| Bundle budget | `pnpm run check:bundle` passed: entry **517.0/560 KiB**, dashboard **584.3/650 KiB**, home **112.6/140 KiB**, charts **424.7/500 KiB**, CSS **232.7/240 KiB**. |
| Route-boundary render | At 375px, `/admin/jobs` rendered the restricted Admin Access screen and `/portal/invalid-token` rendered the inactive-link screen. |

## Explicit limits

No authenticated owner or client session, photo record, valid portal token, photo upload, browser interaction, provider, or production deployment was exercised. The route captures do not verify the new owner control or a valid portal photo gallery. This does not establish client adoption, task or photo sharing outcomes, accessibility conformance, provider delivery, tenant behavior beyond source and contract coverage, or production operation.

## References

[1] [Jobber Help Center — What Do Your Clients See in Client Hub?](https://help.getjobber.com/en/articles/what-do-your-clients-see-in-client-hub/)

[2] [Housecall Pro — Online Client Portal](https://www.housecallpro.com/features/customer-portal/)
