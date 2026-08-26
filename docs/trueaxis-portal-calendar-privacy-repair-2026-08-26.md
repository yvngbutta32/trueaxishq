# TrueAxis HQ — Portal Calendar Privacy Repair

**Prepared:** August 26, 2026  
**Evidence labels:** Implemented and validated; Security correction

## Confirmed Finding

The calendar export route accepted a client portal token alongside an owner session. Although the token was tied to an owner workspace, the route previously returned every booking in that workspace—including other clients’ names, email addresses, and private notes—to a holder of any valid portal token.

This was corrected as an application-level privacy defect. It is not characterized as an external-security certification or an assessment of third-party calendar behavior.

## Repair

| Access mode | Calendar scope |
|---|---|
| Authenticated owner session | Existing owner workspace calendar, including owner-visible booking details. |
| Valid non-revoked, unexpired portal token | Only bookings matching that token’s `clientId`; event summaries include service name only; contact data and notes are omitted. |
| Revoked, expired, invalid, or wrong-owner token | Unauthorized response. |

The route now explicitly checks `revoked: false`, records the portal token’s client scope, applies that client scope to the booking query, and renders a client-safe ICS event. The owner session behavior is preserved.

## Validation Evidence

| Gate | Result |
|---|---|
| Regression coverage | Added an ICS privacy contract that checks active-token scope, client filter, and removal of portal-client contact and note output. |
| Deterministic suite | **74 test files / 202 tests passed**. |
| Strict TypeScript | Passed. |
| Production build | Passed. |
| Bundle budget | Passed: application entry 516.0 KiB / 560 KiB; dashboard route 580.9 KiB / 650 KiB; home route 112.6 KiB / 140 KiB; charts vendor 424.7 KiB / 500 KiB; CSS 222.8 KiB / 240 KiB. |

## Remaining Scope Boundary

The owner session endpoint still identifies the workspace calendar by user ID, but it requires the owner’s valid session. A separately scoped owner calendar-feed credential with rotation and revocation remains planned. This repair does not create a public calendar feed or make any claim about third-party calendar synchronization.
