# TrueAxis HQ — Privacy-Safe Public Occupied Slot Visibility

**Prepared:** August 26, 2026  
**Evidence labels:** Implemented and validated; Scope boundary

## Client Experience Improvement

The public booking page enforced conflicting slots at final submission but previously presented all published times as selectable. A client could therefore choose a slot that had already been taken and only receive feedback at the end of the flow.

The public page now receives a bounded future availability projection containing only scheduled **date/time pairs** for its workspace. The interface disables matching visible time buttons, clears a previously selected time when the client changes date, and retains server-side unique-slot enforcement as the final authority.

## Privacy Boundary

| Returned public data | Deliberately excluded |
|---|---|
| Future scheduled date | Client identity and contact data |
| Future scheduled time | Booking ID, service, notes, duration, status history, internal fields |
| Only within a 120-day public window | Owner metadata and any cross-workspace records |

The projection does not give the browser authority to create an appointment. The server continues to verify the owner’s published schedule, current booking state, and unique slot key at final submission.

## Validation Evidence

| Gate | Result |
|---|---|
| Deterministic suite | **71 test files / 192 tests passed**. |
| Focused contract | Confirms the public projection contains only scheduled future date/time pairs and the client disables occupied times. |
| Strict TypeScript | Passed. |
| Production build | Passed. |
| Bundle budget | Passed: application entry 515.4 KiB / 560 KiB; dashboard route 578.0 KiB / 650 KiB; home route 112.6 KiB / 140 KiB; charts vendor 424.7 KiB / 500 KiB; CSS 222.6 KiB / 240 KiB. |

## Deliberate Boundary

This is not real-time calendar synchronization, a hold/reservation system, staff routing, attendance tracking, or automatic confirmation. A slot can change after the page query, so the final server conflict protection remains necessary and is not presented as a provider-confirmed reservation.
