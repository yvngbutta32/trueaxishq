# TrueAxis HQ — Owner-Configured Booking Availability

**Prepared:** August 26, 2026  
**Evidence labels:** Implemented and validated; Scope boundary

## Operational Improvement

The product already stored a booking-availability field but did not provide owner controls or apply that value consistently to public date and time choices. This release turns the existing setting into an explicit, bounded public schedule.

An owner can now select the weekdays and the 9:00 AM–5:00 PM half-hour slots that appear on the public booking page. The public date picker, time buttons, and server mutation read the same parsed schedule. A direct request cannot select a service, weekday, or time that is not currently published for the workspace.

## Implemented Behavior

| Surface | Implemented behavior |
|---|---|
| Owner settings | The existing Booking Page settings area provides accessible selected/unselected controls for Monday–Sunday and the fixed half-hour public time set. At least one weekday and one time remain selected. |
| Stored schedule | The existing `bookingAvailability` value stores a bounded `{ weekdays, timeSlots }` JSON object. Invalid, malformed, or empty stored data safely falls back to the conservative weekday schedule. |
| Public booking page | The visible future date and time choices now derive from the owner’s stored schedule. The previous unsupported “local timezone” statement was replaced with factual published-time language. |
| Server authority | Public booking validates the configured service, non-past date, the owner’s weekday/time schedule, and existing unique-slot protections before booking side effects. |
| Type safety | Shared literal time-slot types align dashboard settings, the public page, and server input validation. |

## Validation Evidence

| Gate | Result |
|---|---|
| Deterministic suite | **70 test files / 190 tests passed**. |
| Focused contracts | Covers valid and invalid schedules, malformed-setting recovery, valid weekday slots, weekend/unavailable-time rejection, service validation, and final server policy enforcement. |
| Strict TypeScript | Passed. |
| Production build | Passed. |
| Bundle budget | Passed: application entry 515.4 KiB / 560 KiB; dashboard route 578.0 KiB / 650 KiB; home route 112.6 KiB / 140 KiB; charts vendor 424.7 KiB / 500 KiB; CSS 222.6 KiB / 240 KiB. |

## Deliberate Boundary

This feature does not provide external calendar synchronization, custom arbitrary slot creation, duration-specific availability, travel buffers, routing, time-zone conversion, automatic messages, or provider-confirmed scheduling. Those require a separately scoped workflow and, for live integrations, authorized real-provider validation.
