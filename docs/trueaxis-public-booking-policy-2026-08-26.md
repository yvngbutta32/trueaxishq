# TrueAxis HQ — Public Booking Policy Enforcement

**Prepared:** August 26, 2026  
**Evidence labels:** Implemented and validated; Scope boundary

## Corrected Booking Integrity Gap

The public booking page showed a fixed set of weekday half-hour choices and configured service labels, but a direct API request could previously submit a service or time outside those visible controls. The server also relied on direct JSON parsing for the stored service configuration, so malformed settings could cause inconsistent public behavior.

TrueAxis HQ now uses one shared policy for both the public booking interface and the server mutation. A booking must use a future valid ISO date, a weekday slot from the published 9:00 AM–5:00 PM half-hour window, and a service currently published by that workspace. Malformed or empty stored service configuration falls back to the product’s three conservative public defaults rather than failing open or crashing the booking page.

## Implemented Behavior

| Boundary | Enforced behavior |
|---|---|
| Public services | The booking page and server use the same sanitized owner service list. Empty or malformed stored data falls back to Coaching Session, Strategy Call, and Consultation. |
| Public slots | The booking page and server use the same weekday 9:00 AM–5:00 PM half-hour slots. Weekend, malformed-date, and out-of-window submissions are rejected. |
| Past dates | The server rejects a date before its current UTC date. |
| Slot conflict | Existing unique slot and transaction protections still reject a time already claimed by another scheduled booking. |
| Client safety | Public forms cannot use arbitrary hidden service labels or bypass the visible booking window through a direct request. |

## Validation Evidence

| Gate | Result |
|---|---|
| Focused booking policy contracts | Passed for valid weekday slots, weekends, malformed dates, unavailable times, duplicate service de-duplication, malformed settings fallback, and server enforcement. |
| Strict TypeScript | Passed. |
| Deterministic suite | **70 test files / 190 tests passed**. |
| Production build | Passed. |
| Bundle budget | Passed: application entry 515.4 KiB / 560 KiB; dashboard route 573.6 KiB / 650 KiB; home route 112.6 KiB / 140 KiB; charts vendor 424.7 KiB / 500 KiB; CSS 222.6 KiB / 240 KiB. |

## Deliberate Scope Boundary

This change **does not** claim custom per-owner calendars, time-zone conversion, calendar synchronization, blackout dates, routing, automatic confirmations, or provider availability. The existing stored `bookingAvailability` field is not represented as a fully configured owner scheduling system until a separate owner-facing configuration and real-session validation workflow is implemented. The correction truthfully enforces the schedule the product currently publishes.
