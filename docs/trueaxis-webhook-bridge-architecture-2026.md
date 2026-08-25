# TrueAxis HQ Webhook Bridge Architecture

## Purpose

The webhook bridge extends the integration ecosystem without claiming a prebuilt marketplace or unverified provider connection. Owners can register a limited set of HTTPS endpoints to receive selected operational events. This makes it possible to connect an authorized downstream workflow, automation product, or internal system while preserving clear delivery evidence inside TrueAxis HQ.

## Security and Delivery Contract

| Concern | Design decision |
|---|---|
| Tenant isolation | Every subscription and delivery row has `userId`; all list, update, delete, and delivery reads apply the authenticated-owner predicate. |
| Endpoint safety | HTTPS only; loopback, private-network, link-local, and local-development host patterns are rejected before persistence and before delivery. |
| Authentication | Each subscription receives a random signing secret once at creation. The database stores only an AES-GCM encrypted form using the server-side JWT secret as key material. |
| Signature | Delivery sends an event ID, event name, timestamp, and HMAC-SHA256 signature computed over `timestamp.payload`. |
| Reliability | Each event/subscription attempt creates a durable delivery row with timestamp, HTTP outcome, bounded response summary, and error state. Delivery failure never reverses the original TrueAxis HQ business mutation. |
| Scope | Initial events: `job.status_changed`, `service_visit.scheduled`, and `service_visit.status_changed`. No customer PII beyond the selected operational payload is required. |
| Boundary | This is an event bridge—not a claim of Zapier certification, marketplace breadth, scheduled retry, or guaranteed third-party execution. |

## Delivery Sequence

1. A core owner mutation commits its internal state.
2. The server identifies active owner subscriptions that selected the emitted event.
3. A delivery record is created for each selected subscription.
4. The server posts a signed JSON event with a short timeout and no redirect following.
5. The delivery row records success or failure. A failed downstream call is visible to the owner but never rolls back the job or visit mutation.

The implementation is event-driven and has no in-process polling or timer. A future retry queue can be added through the platform-managed scheduled-job path after deployment and the required schedule lifecycle is configured.
