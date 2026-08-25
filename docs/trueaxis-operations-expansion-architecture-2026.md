# TrueAxis HQ Operations Expansion Architecture

**Prepared:** August 25, 2026  
**Scope:** Close the product-depth gaps identified in the competitor scorecard without misrepresenting unconfigured third-party connections or building unsafe cross-owner access.

## Product Decision

TrueAxis HQ will expand in three connected layers rather than copy unrelated competitor feature lists. The first layer is an **owner-managed team and capacity model**. The second is a **service-visit and dispatch-planning model**. The third is an **integration readiness model** that exposes supported connection categories and truthful connection state without fabricating OAuth, API, GPS, mapping, or synchronization status.

> The first release is intentionally **owner-operated**. Team members are operational roster records, not immediately authenticated cross-tenant users. This preserves the existing owner-scoped data boundary while creating a migration path to future staff authentication and permissions.

## Existing Foundation

The existing product already has owner-scoped `jobs`, `jobTasks`, `jobActivities`, `jobPhotos`, `timeEntries`, `expenses`, `bookings`, and client portal proof timelines. Job creation and mutations verify the job owner; task and photo writes apply final owner predicates. This is a suitable foundation for operational coordination because assignment and visit entities can inherit the same `userId` owner scope.

## Data Model

| Entity | Purpose | Key safety and integrity rules |
|---|---|---|
| `teamMembers` | Owner-managed roster entry for an employee, contractor, or partner. Stores display name, operational role, active status, color, optional contact reference, and weekly capacity. | Every row includes `userId`; no linked worker can access data merely because their email matches. Capacity is bounded and positive; inactive members cannot receive new assignments. |
| `jobAssignments` | Connects a team member to a job, with role, assignment state, and optional planned minutes. | The job and member must be owned by the same `userId`; duplicate active job/member assignment is rejected; every transition adds a job activity. |
| `serviceVisits` | Schedulable visit within a job. Stores planned start/end, visit status, assigned member reference, site label, and owner-private dispatch note. | The parent job and optional member must be owner-scoped; start must precede end; visits are not exposed to client portal unless a curated job update is posted. No GPS or routing claim is made. |
| `integrationConnections` | Owner-scoped metadata for a supported provider category and connection readiness. | The initial release stores only safe status metadata, not provider credentials or tokens. Status can never become `connected` solely from owner input; connection confirmation belongs to a later authenticated provider callback. |

## Operational States

| Model | States |
|---|---|
| Team member | `active`, `inactive` |
| Job assignment | `assigned`, `acknowledged`, `declined`, `completed` |
| Service visit | `scheduled`, `en_route`, `in_progress`, `completed`, `cancelled` |
| Integration connection | `not_connected`, `needs_configuration`, `connected`, `error` |

The `en_route` state is an owner-recorded operating signal only. It does **not** imply real-time GPS tracking, optimized routing, or automated customer ETA messaging. This keeps dispatch UX useful today while preserving a truthful boundary against specialized field platforms.

## Capacity and Dispatch Rules

1. **Capacity is calculated, not guessed.** A member’s planned load is the sum of scheduled, en-route, and in-progress visits that overlap the selected weekly interval. `weeklyCapacityMinutes` is owner-defined and the UI shows the resulting load ratio.
2. **Conflicts are visible, not silently blocked.** A member can be assigned to overlapping visits only after the owner sees a conflict warning. This supports real-world exceptions while preventing invisible scheduling errors.
3. **Jobs remain the financial and client-trust system of record.** A visit is an execution unit within a job; invoices, proof photos, activity, profitability, and portal updates remain tied to the job.
4. **Client visibility is curated.** Assignment names, private dispatch notes, internal capacity, and visit logistics stay internal. The owner chooses whether to create a client-visible job update.
5. **No unsafe staff access.** The owner retains all write authority in this release. Future staff login requires explicit membership, role permissions, session boundaries, and scoped access tests.

## Integration Readiness Catalog

| Provider category | Initial catalog entry | Current truthful state |
|---|---|---|
| Calendar | Google Calendar, Outlook Calendar | Google Calendar code exists but needs owner authorization; Outlook is a future connector. |
| Accounting | QuickBooks | Planned catalog item; no connection is represented as active without provider authorization. |
| Communications | Gmail, Outlook, Slack, Twilio | SMTP abstraction exists but no configured delivery provider; provider connection flows remain future work. |
| Automation | Zapier-style webhook/no-code connection | Catalog-only until a user-authorized connector or webhook endpoint is implemented and verified. |
| Payments | Stripe | Checkout/webhook code exists; live status remains provider-dependent until sandbox claim and signed-webhook validation. |

HoneyBook publicly lists integrations spanning accounting, calendar, email, meetings, marketing, and no-code automation; Bonsai lists accounting integrations; field incumbents advertise deeper dispatch, routing, and mobile synchronization. [1] [2] [3] The catalog is therefore a deliberate **honest foundation**, not a claim of present parity.

## Delivery Sequence

| Phase | Autonomous deliverable | Not claimed yet |
|---|---|---|
| Team and capacity | Roster, role, availability/capacity, job assignments, workload view, activity history | Staff login, granular staff permissions, payroll, time-clock enforcement |
| Dispatch coordination | Visits, date-based dispatch board, member assignment, conflict warning, internal visit state, curated client update link | GPS, automated routing, vehicle tracking, live ETA, native technician app |
| Integrations | Provider catalog, readiness states, secure metadata structure, owner UX for future connection | Live OAuth/API connection without user authorization and provider testing |

## References

[1]: https://www.honeybook.com/ "HoneyBook — AI-powered client relationship platform"
[2]: https://www.hellobonsai.com/projects "Bonsai — Project management software"
[3]: https://www.housecallpro.com/features/dispatching-software/ "Housecall Pro — Dispatching software"
