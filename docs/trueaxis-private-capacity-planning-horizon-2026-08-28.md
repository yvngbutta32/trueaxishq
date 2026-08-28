# Private Capacity Planning Horizon

**Date:** 2026-08-28  
**Scope:** Protected owner Team Operations capacity context

## Observed implementation

The protected `team.capacity` procedure now accepts an optional ISO timestamp only when it represents **Monday at 00:00 UTC**. Without an input, it preserves the existing current-week calculation. With a validated input, the query bounds active service visits and private availability blocks to the selected seven-day UTC window, then clips every duration to that window before producing capacity totals.

Team Operations provides a labeled **Planning week (UTC)** date input. Its query input is memoized and normalizes any selected date to the corresponding UTC Monday before it is submitted. The visible labels identify scheduled and private availability totals as applying to the selected UTC week.

## Observed validation

| Validation | Observed result |
|---|---|
| TypeScript | `pnpm check` completed successfully. |
| Focused capacity coverage | `server/scheduledCapacityAccuracy.test.ts`: **1 file / 2 tests passed**. |
| Full regression suite | `pnpm test -- --reporter=dot`: **100 files / 275 tests passed**. |
| Production build | `pnpm run build` completed successfully. |
| Bundle budget | `pnpm run check:bundle` passed: entry **516.8/560 KiB**, dashboard **584.1/650 KiB**, home **112.6/140 KiB**, charts **424.7/500 KiB**, CSS **231.5/240 KiB**. |

## Explicit limits

This result is based on source inspection and local automated validation. It does **not** establish live production behavior, authenticated owner interaction, payroll or attendance accuracy, route optimization, GPS, calendar synchronization, external provider delivery, or client-facing capacity data. The horizon remains private and observational; it does not create assignments, dispatch work, or change client records.

The design rationale and official schedule-board references are retained in `docs/research/private-capacity-planning-horizon-evidence-2026-08-28.md`.
