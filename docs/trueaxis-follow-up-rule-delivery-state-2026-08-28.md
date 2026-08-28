# Follow-Up-Rule Delivery-State Correction

**Date:** 2026-08-28  
**Scope:** Internal owner-configured follow-up rule history

## Observed correction

The existing email helper now exposes a pure predicate for a configured SMTP acceptance result. The automatic follow-up path continues to create a private `draft` follow-up record first, but it now changes that record to `sent` only if the helper reports both `success: true` and `mode: "smtp"`.

Console fallback and SMTP failure leave the saved follow-up as a draft. The background-job log distinguishes configured SMTP acceptance from a draft retained without it. Existing owner-configured rule inputs, owner/client predicates, duplicate guard, draft history, and rule last-run progression remain unchanged.

## Observed validation

| Validation | Observed result |
|---|---|
| TypeScript | `pnpm check` completed successfully. |
| Focused coverage | Follow-up plus recurring delivery-state checks: **3 files / 5 tests passed**. |
| Full regression suite | `pnpm test -- --reporter=dot`: **109 files / 299 tests passed**. |
| Production build | `pnpm run build` completed successfully. |
| Bundle budget | `pnpm run check:bundle` passed: entry **517.0/560 KiB**, dashboard **584.1/650 KiB**, home **112.6/140 KiB**, charts **424.7/500 KiB**, CSS **232.6/240 KiB**. |

## Explicit limits

No SMTP provider, recipient, scheduled job, draft record, inbox, client portal session, retry, or production environment was used. This does not establish message delivery, inbox placement, recipient receipt, automation execution, scheduler reliability, provider behavior, or production operation.
