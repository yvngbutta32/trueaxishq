# TrueAxis HQ durable workflow webhook retries — 2026-08-27

## Delivered foundation

TrueAxis HQ now stores a bounded encrypted event envelope and endpoint snapshot for every selected owner-configured workflow webhook before its first delivery attempt. Each delivery record carries the owning workspace identifier, event identity, event type, retry state, attempt count, next eligible time, last attempt time, bounded outcome evidence, a short processing lease, and terminal time when applicable.

Delivery attempts re-check the current endpoint record under the same final owner predicate, refuse to send when the endpoint is paused, terminate retained work when the endpoint is removed, atomically claim pending, retryable, or stale processing work, and revalidate the destination’s public HTTPS address before every transmission. Successful or terminal deliveries clear the encrypted payload envelope. The owner console presents delivery status and a bounded manual due-delivery action; it never returns encrypted payload data through its API or interface.

## Retry semantics and privacy boundaries

The initial attempt and later retry processing use the stable event ID that is already sent to receivers. Non-2xx outcomes and network failures become retryable for a maximum of five attempts with increasing delays. After the bounded limit, the record becomes terminal and maintains diagnostic evidence only. A downstream 2xx response means that the endpoint accepted the HTTP request; it does not prove completion of downstream business work. Receivers must apply their own event-ID de-duplication. [1] [2]

| Included | Explicitly not included |
| --- | --- |
| Owner-scoped delivery records; encrypted, size-bounded envelopes; endpoint snapshots; atomic claims; stale-lease recovery; bounded manual recovery; terminal delivery evidence | Client-portal projection; raw payload display; attachments; automatic recipient certification; guaranteed receiver execution; external receiver validation; managed periodic retry scheduling |

> Managed periodic retries are not enabled in this milestone. The project’s self-contained email/password authentication must first be reconciled with a securely authenticated managed scheduler callback. No process-local `setInterval` retry loop is used for this workflow-delivery path.

## Validation

Migrations `0054_fresh_sabretooth.sql` and `0055_rainy_screwball.sql` are additive. They extend the existing delivery table with retry evidence, encrypted payload storage, endpoint snapshotting, a due-work index, and a processing lease without deleting previous delivery rows. Strict TypeScript, focused workflow webhook coverage, the 90-file / 241-test deterministic suite, production build, and configured bundle budgets passed.

## References

[1]: https://docs.stripe.com/webhooks/process-undelivered-events "Stripe: Process undelivered webhook events"
[2]: https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries "GitHub: Handling failed webhook deliveries"
