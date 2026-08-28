# Recurring-Invoice Delivery-State Correction

**Date:** 2026-08-28  
**Scope:** Internal recurring-invoice record state and private owner notice wording

## Observed correction

Recurring invoices now begin in `draft` state. The internal job promotes an invoice to `sent` only when the existing email helper reports that a configured SMTP provider accepted the message. Invoices stay `draft` when the recurring plan has no client email, the helper uses its console fallback, or an SMTP attempt reports failure.

The owner notification now distinguishes those outcomes: no recipient means no email attempt, console fallback means no SMTP delivery attempt, failed SMTP directs an owner to review delivery setup, and successful configured SMTP is described as provider acceptance. The normal recurring due-date advance and invoice creation sequence remain unchanged. The implementation adds no retry, delivery guarantee, recipient read confirmation, or scheduler claim.

## Observed validation

| Validation | Observed result |
|---|---|
| TypeScript | `pnpm check` completed successfully. |
| Focused coverage | `recurringInvoiceDeliveryOutcome` and `recurringInvoiceDeliveryIntegration`: **2 files / 3 tests passed**. |
| Full regression suite | `pnpm test -- --reporter=dot`: **108 files / 297 tests passed**. |
| Production build | `pnpm run build` completed successfully. |
| Bundle budget | `pnpm run check:bundle` passed: entry **517.0/560 KiB**, dashboard **584.1/650 KiB**, home **112.6/140 KiB**, charts **424.7/500 KiB**, CSS **232.6/240 KiB**. |

## Explicit limits

No SMTP provider, client address, scheduled execution, invoice recipient, database record, or production environment was used. This does not establish email delivery, inbox placement, receipt, payment, retry behavior, scheduler reliability, provider behavior, or production operation.
