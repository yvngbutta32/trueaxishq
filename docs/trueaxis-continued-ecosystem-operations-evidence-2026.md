# Continued Ecosystem and Operations Evidence

**Prepared:** August 25, 2026  
**Scope:** The second autonomous expansion pass following team/capacity, dispatch, and integration-readiness delivery.

## Implemented Depth

TrueAxis HQ now provides a secure, owner-managed outbound workflow bridge alongside actionable operational exceptions. This extends the integration surface beyond a static provider catalog while keeping connection claims and downstream execution evidence precise.

| Capability | Implemented behavior | Explicit boundary |
|---|---|---|
| Workflow webhook bridge | Owners can configure up to three public HTTPS endpoints, choose job-status and service-visit events, receive a one-time signing secret, pause/resume an endpoint, remove it, and inspect the latest 100 delivery attempts. | This is not a certified Zapier/Make marketplace, a retry scheduler, or a guarantee that a third-party endpoint will process an event. |
| Signed delivery | Event IDs, event names, timestamps, and HMAC-SHA256 signatures are sent with the JSON payload. Signing secrets are AES-GCM encrypted server-side and are not returned after creation. | Endpoint owners must validate signatures and configure their downstream system. |
| Endpoint safety | HTTPS is required; credential-bearing URLs, loopback, local, internal, link-local, private-network, carrier-grade NAT, and benchmarking network destinations are rejected before configuration and rechecked before delivery. Redirects are not followed. | Public DNS and a valid TLS endpoint remain the endpoint owner’s responsibility. |
| Durable evidence | Every selected event/subscription pair stores a pending, delivered, or failed row with bounded response/error evidence. Failure never reverses the original TrueAxis job or dispatch mutation. | A future retry queue requires platform-managed scheduling and a real deployment lifecycle. |
| Operational exceptions | Team Operations highlights active staff over planned capacity, active jobs without an active job owner, and intentionally permitted overlapping service visits. | Signals are owner-facing planning aids; they do not reassign work, change a job, or notify a client automatically. |

## Event Coverage and Authorization

The webhook bridge emits only after internal operations have been committed. The supported events are `job.status_changed`, `service_visit.scheduled`, and `service_visit.status_changed`. The event payloads carry operational identifiers and state changes rather than arbitrary client records. Subscription and delivery reads, writes, pauses, removals, and outcome updates use the authenticated owner ID; a UI request cannot set a provider or webhook endpoint to a fictitious “delivered” state.

## Validation

| Gate | Result |
|---|---|
| Deterministic regression suite | **29 test files and 112 tests passed.** New coverage verifies event parsing/deduplication, stable HMAC signing, insecure/local endpoint rejection, encrypted-secret and owner-predicate contracts, endpoint limits, event hooks, capacity exceptions, unowned active jobs, and visit overlap signals. |
| Strict TypeScript | Passed. |
| Production build | Passed in **4.94 seconds**. Workflow Webhooks remains lazy-loaded as a separate **34.86 kB / 5.67 kB gzip** interface chunk. |
| Production dependency audit | `pnpm audit --prod` reported **no known vulnerabilities**. |
| Database change | A reviewed additive migration created the owner-scoped webhook-subscription and durable delivery-evidence tables with intended indexes and per-webhook/event idempotency constraint. |

## Remaining External Gates

An authenticated owner session is still needed to visually exercise the mobile Team Operations, Dispatch Board, Integration Hub, and Workflow Webhooks panels at 375px with live owner data. A controlled public HTTPS receiving endpoint is also needed to verify an actual signed delivery. Provider-authorized calendar, accounting, mail, communications, and payment connections remain provider/account-dependent. Those gates are intentionally not represented as completed functionality.
