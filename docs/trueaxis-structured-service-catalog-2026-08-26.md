# TrueAxis HQ — Structured Service Catalog and Duration-Aware Booking

**Prepared:** August 26, 2026  
**Evidence labels:** Implemented and validated; Research-supported; Scope boundary

## Operational Improvement

TrueAxis HQ booking services previously consisted of plain labels with an implicit 60-minute duration. The product now accepts a backward-compatible structured catalog: each service has a name, a bounded duration, an active state, and optional owner price guidance. Existing legacy string lists remain valid and are interpreted as active 60-minute services.

Owners can set a service duration, hide an inactive service from public booking, and retain an internal price note. Public booking accepts only active services; the selected duration is saved on the booking and used by the client’s calendar exports.

## Implemented Behavior

| Surface | Behavior |
|---|---|
| Legacy compatibility | Existing plain service arrays continue working with a safe 60-minute default. |
| Owner controls | The booking settings editor supports duration, active/hidden state, optional price guidance, preset additions, custom service additions, and removal. |
| Public projection | The booking page returns only active service name, duration, and optional price guidance; hidden services are excluded. |
| Server authority | The final booking mutation verifies the selected active catalog service and persists its duration. |
| Conflict safety | Same-day scheduled appointments now receive duration-aware overlap checks; the existing unique start-slot key remains the transactional final fallback. |
| Client calendar | ICS and Google Calendar exports use the selected persisted service duration rather than always assuming one hour. |

## Validation Evidence

| Gate | Result |
|---|---|
| Deterministic suite | **72 test files / 197 tests passed**. |
| Focused contracts | Covers legacy parsing, structured active/hidden services, bounded duration and price guidance, malformed fallback, interval boundary handling, selected-service validation, and persisted duration. |
| Strict TypeScript | Passed. |
| Production build | Passed. |
| Bundle budget | Passed: application entry 516.0 KiB / 560 KiB; dashboard route 579.2 KiB / 650 KiB; home route 112.6 KiB / 140 KiB; charts vendor 424.7 KiB / 500 KiB; CSS 222.8 KiB / 240 KiB. |

## Research Context

Housecall Pro documents online booking service types and duration preferences. HoneyBook documents reusable session types with duration, availability, buffers, and increments. Jobber documents direct and review-based booking flows.[1] [2] [3]

TrueAxis HQ implements the safe overlap now: owner-controlled services, duration, active public availability, and duration-aware same-day conflicts. It does not claim parity with custom calendars, third-party synchronization, routing, automatic payment collection, or the broader booking modes in these products.

## Explicit Follow-On Boundary

Owner-configured buffers between services remain a **planned, unimplemented** follow-on. The current duration conflict rule correctly prevents same-day appointment overlap but does not add a configurable travel, preparation, or recovery buffer. No buffer is described as live until it is separately implemented and validated.

## References

[1] [Housecall Pro — Getting Started with Online Booking](https://help.housecallpro.com/en/articles/11473210-getting-started-with-online-booking)

[2] [HoneyBook — Create a session type](https://help.honeybook.com/en/articles/3614050-create-a-session-type-in-honeybook)

[3] [Jobber — Online Booking](https://help.getjobber.com/en/articles/online-booking/)
