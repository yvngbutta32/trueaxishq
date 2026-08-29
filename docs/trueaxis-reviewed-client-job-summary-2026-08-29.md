# Reviewed Client Job Summary and Controlled Portal Journey

**Date:** 2026-08-29  
**Scope:** Default-private client job summary, owner curation, and controlled local client portal validation

## Observed correction

The token-scoped portal no longer returns the private job description. A reviewed `clientSummary` and `clientSummaryVisible` pair was added to jobs with default-private behavior. The reviewed migration `0062_lucky_purifiers.sql` adds both fields and an owner/client visibility index. Owners can edit the separate summary from Job Workspace and explicitly opt in to sharing it; the protected update retains final job-and-owner scope.

The portal projects the reviewed summary only when both a nonempty summary and explicit visibility are present. It continues to project the job title, number, status, and target date needed for client context, but excludes the private scope note and the previously documented internal records.

## Controlled local browser evidence

An authorized local owner session created a disposable job with a private scope note and one reviewed task. The owner saved a reviewed client summary with sharing enabled. The controlled client portal displayed the shared summary and the reviewed task. The owner then disabled sharing and saved; the same valid portal no longer showed the summary or the private scope note, while the reviewed task title remained visible. A separate invalid-token portal path rendered its inactive-link state.

One initial browser index click did not toggle the checkbox. A native click on the same form control followed by the normal save action successfully performed the owner unshare flow. No application source change was required for that browser-interaction discrepancy.

## Observed validation

| Validation | Observed result |
|---|---|
| Database schema | The reviewed additive client-summary migration was applied successfully during the controlled local test. |
| TypeScript | `pnpm check` completed successfully before browser validation. |
| Focused coverage | Reviewed summary and related portal isolation coverage completed successfully before browser validation. |
| Full regression suite | `pnpm test -- --reporter=dot`: **118 files / 326 tests passed**. |
| Production build | `pnpm run build` completed successfully. |
| Bundle budget | `pnpm run check:bundle` passed: entry **517.0/560 KiB**, dashboard **584.5/650 KiB**, home **112.6/140 KiB**, charts **424.7/500 KiB**, CSS **233.1/240 KiB**. |

## Explicit limits

This was a local owner and token-scoped client test using disposable data. It did not test a staff identity, a separate foreign valid client token, inactive-token revocation after issuance, proof-photo sharing, mobile authenticated rendering, provider delivery, payments, calendar behavior, deployment behavior, or production data.
