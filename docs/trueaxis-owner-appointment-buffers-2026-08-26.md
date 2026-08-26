# TrueAxis HQ — Owner Appointment Buffers

**Prepared:** August 26, 2026  
**Evidence labels:** Implemented and validated; Scope boundary

## Operational Improvement

Owners can now configure a zero-to-120-minute appointment buffer alongside their published booking days and half-hour time slots. The buffer is applied to the client’s selected service duration and to existing scheduled appointment durations when the server evaluates a new same-day public booking request.

The owner setting is stored inside the existing booking availability configuration and safely defaults to zero minutes for every legacy workspace. The new control is explicit: it reserves time after an appointment for availability checking, but does not change a historic booking record, a calendar provider, or a client-visible appointment start time.

## Implemented Behavior

| Boundary | Behavior |
|---|---|
| Owner control | Owners select 0, 15, 30, 45, 60, 90, or 120 minutes in Booking Page settings. |
| Safe parsing | Stored buffer values outside the bounded integer range recover to zero minutes. |
| Server authority | Public booking extends both candidate and scheduled same-day duration intervals by the current owner buffer before determining overlap. |
| Existing safeguard | Unique start-slot enforcement remains in place as the transactional fallback after the interval check. |
| Public privacy | No additional appointment metadata is returned to the public booking page. |

## Validation Evidence

| Gate | Result |
|---|---|
| Deterministic suite | **72 test files / 197 tests passed**. |
| Strict TypeScript | Passed. |
| Production build | Passed. |
| Bundle budget | Passed: application entry 516.0 KiB / 560 KiB; dashboard route 580.9 KiB / 650 KiB; home route 112.6 KiB / 140 KiB; charts vendor 424.7 KiB / 500 KiB; CSS 222.8 KiB / 240 KiB. |

## Deliberate Boundary

The buffer does not synchronize external calendars, model travel routes, vary by staff member, apply geography, send automatic notices, or guarantee real-time availability. The final server conflict check remains necessary because another client can book after the page is loaded.
