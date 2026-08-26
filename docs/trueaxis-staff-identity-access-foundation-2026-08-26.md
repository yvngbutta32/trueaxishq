# TrueAxis HQ — Staff Identity and Role-Based Access Foundation

**Prepared:** August 26, 2026  
**Evidence labels:** Implemented and validated; Scope boundary

## Operational Improvement

TrueAxis HQ previously had an owner-managed team roster for capacity, assignments, and dispatch planning. Those roster entries intentionally did not create a user account or workspace access. This release adds a separate, explicit staff identity layer so a roster email alone remains insufficient for access.

Owners can create a seven-day private staff access link for an active roster member with an email address. The product does not send that link automatically. A new user registers through the email-bound token, while an existing user signs in and accepts the same token. The final server predicates require an unrevoked, unaccepted, unexpired invite matching the signed-in or registering email.

## Least-Privilege Model

| Access surface | Owner | Authenticated staff member |
|---|---|---|
| Roster, capacity, dispatch planning | Full owner workspace controls | Not exposed |
| Assigned jobs | Full owner job workspace | Only the member’s assigned job number, title, status, planning note, target date, and assignment state |
| Service visits | Full visit and dispatch controls | Only visits attached to the member, with title, schedule, job reference, status, and site label |
| Assignment status | Owner can manage all assignment settings | Can acknowledge, decline, or complete only their own valid next assignment state |
| Finance / private CRM / dispatch notes | Owner-only | Not exposed |
| Client portal | Existing token-scoped client flow | No staff membership or roster access exposed |

## Implemented Controls

| Control | Behavior |
|---|---|
| Separate models | Additive `workspaceStaffInvites` and `workspaceStaffMemberships` tables sit alongside—not inside—the roster model. |
| Bound invite | A 256-bit random token is email-bound, owner-scoped, revocable, expires after seven days, and has a final acceptance predicate. |
| Trusted link origin | The owner link generator requires a recognized TrueAxis HQ origin before returning the credential-bearing URL. |
| Uniqueness | One active membership per `(owner, user)` and one linked staff identity per `(owner, roster member)` are database-enforced. |
| Revocation | Revoking staff access deactivates the roster record and current access, and revokes outstanding invitations. |
| Scoped work | The server verifies an active membership plus matching roster entry on every staff work query and assignment update. |
| Transition safety | A staff status change must win the expected current assignment state before a staff-authored activity event is recorded. |

## Validation Evidence

| Gate | Result |
|---|---|
| Migration | Reviewed additive `0043_short_blue_blade.sql` applied successfully after correcting the generated duplicate token uniqueness declaration before any live schema change. |
| Focused contracts | Covers separate roster/membership models, owner-scoped invite creation/revocation, trusted origin, final email-bound invite predicate, assigned-work scope, and private-field exclusions. |
| Deterministic suite | **72 test files / 197 tests passed**. |
| Strict TypeScript | Passed. |
| Production build | Passed. |
| Bundle budget | Passed: application entry 516.0 KiB / 560 KiB; dashboard route 577.3 KiB / 650 KiB; home route 112.6 KiB / 140 KiB; charts vendor 424.7 KiB / 500 KiB; CSS 222.8 KiB / 240 KiB. |

## Deliberate Boundary

This is a staff access foundation, not enterprise RBAC parity. It does not claim SSO, SCIM, custom permission matrices, timesheet approval, payroll, GPS, routing, client contact access, full owner-dashboard reuse, external identity-provider synchronization, automatic invitation delivery, or staff mobile adoption. Real owner/staff authenticated walkthroughs remain an external validation gate.
