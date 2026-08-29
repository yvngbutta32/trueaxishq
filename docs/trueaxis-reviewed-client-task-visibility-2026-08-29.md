# Reviewed Client Task Visibility

**Date:** 2026-08-29  
**Scope:** Consolidated owner-reviewed job-task sharing and token-scoped portal minimization

## Observed implementation

Job tasks now have a default-private `clientVisible` field. The reviewed generated migration `0060_exotic_black_knight.sql` adds the field with a false default and the `(userId, jobId, clientVisible)` index. The database inspection after application confirmed the default-private `tinyint(1)` column and each index component.

An owner can deliberately change task visibility from the protected Job Workspace. The existing task update procedure retains its final task-and-owner predicate and writes a private `task_visibility_changed` activity record when the setting changes. The portal task query is now restricted to the token owner’s client jobs and tasks with `clientVisible = true`. It projects task progress fields only; task descriptions, private job planning, staff data, assets, inspection records, costs, routes, and internal history remain excluded.

The Job Workspace control uses explicit **Shared with client** and **Private to your workspace** states. It is presented alongside existing owner task controls without modifying client updates, documents, proof photos, or visit-sharing mechanisms. The Client Portal states that only provider-chosen items appear in the Milestones section.

## Observed validation

| Validation | Observed result |
|---|---|
| Database schema | The `clientVisible` column and `jobTasks_user_job_clientVisible_idx` index were confirmed after the reviewed additive SQL was applied. |
| TypeScript | `pnpm check` completed successfully. |
| Focused coverage | Reviewed task visibility, visit visibility, document sharing, and job-workspace contracts: **4 files / 13 tests passed**. |
| Full regression suite | `pnpm test -- --reporter=dot`: **115 files / 316 tests passed**. |
| Production build | `pnpm run build` completed successfully. |
| Bundle budget | `pnpm run check:bundle` passed: entry **517.0/560 KiB**, dashboard **584.3/650 KiB**, home **112.6/140 KiB**, charts **424.7/500 KiB**, CSS **232.7/240 KiB**. |
| Route-boundary render | At 375px, `/admin/jobs` rendered the restricted Admin Access screen and `/portal/invalid-token` rendered the inactive-link screen. |

## Explicit limits

No authenticated owner or client session, task record, portal token, migration rollback, browser interaction, provider, or production deployment was exercised. The route captures do not verify the new control or a valid portal’s task display. This does not establish client adoption, task sharing outcomes, tenant behavior beyond source and contract coverage, accessibility conformance, or production operation.
