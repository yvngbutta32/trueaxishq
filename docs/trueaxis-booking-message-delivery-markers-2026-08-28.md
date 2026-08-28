# Booking-Message Delivery-Marker Correction

**Date:** 2026-08-28  
**Scope:** Internal booking reminder and post-session check-in marker handling

## Observed correction

The booking reminder and post-session check-in jobs now capture the existing email helper result. They set `reminderSentAt` or `checkInSentAt` only when a configured SMTP provider has accepted the message. A console fallback or an SMTP failure leaves the corresponding marker unset, so the internal record is not represented as an externally sent message.

The booking selection windows, booking identifiers, recipient requirement, job-owned query conditions, and message content remain unchanged. The update adds no retry, delivery confirmation, attendance, scheduling, or provider-reliability behavior.

## Observed validation

| Validation | Observed result |
|---|---|
| TypeScript | `pnpm check` completed successfully. |
| Focused coverage | Booking, follow-up, and recurring delivery-state checks: **4 files / 7 tests passed**. |
| Full regression suite | `pnpm test -- --reporter=dot`: **110 files / 301 tests passed**. |
| Production build | `pnpm run build` completed successfully. |
| Bundle budget | `pnpm run check:bundle` passed: entry **517.0/560 KiB**, dashboard **584.1/650 KiB**, home **112.6/140 KiB**, charts **424.7/500 KiB**, CSS **232.6/240 KiB**. |

## Explicit limits

No SMTP provider, booking recipient, scheduled job, database marker, inbox, calendar, attendance record, retry, or production environment was exercised. This does not establish message delivery, inbox placement, client receipt, scheduler reliability, provider behavior, or production operation.
