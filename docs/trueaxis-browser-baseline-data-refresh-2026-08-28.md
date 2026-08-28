# Browser-Baseline Development Data Refresh

**Date:** 2026-08-28  
**Scope:** Build-tooling maintenance only

## Observed change

The build-reported `baseline-browser-mapping` development dependency was refreshed from **2.8.13** to **2.11.20**, the version returned by the package registry during inspection. Development services were restarted after the dependency update.

## Observed validation

| Validation | Observed result |
|---|---|
| Production dependency audit | `pnpm audit --prod` reported **No known vulnerabilities found**. |
| TypeScript | `pnpm check` completed successfully. |
| Full regression suite | `pnpm test -- --reporter=dot`: **106 files / 294 tests passed**. |
| Production build | `pnpm run build` completed successfully and did not repeat the earlier browser-baseline data freshness warning. |
| Bundle budget | `pnpm run check:bundle` passed: entry **517.0/560 KiB**, dashboard **584.1/650 KiB**, home **112.6/140 KiB**, charts **424.7/500 KiB**, CSS **232.6/240 KiB**. |

## Explicit limits

This update refreshes browser-baseline data used by the build tool. It does not establish compatibility on any particular browser, device, operating system, assistive technology, network condition, or production deployment.
