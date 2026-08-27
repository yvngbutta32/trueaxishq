# Outbound webhook delivery and retry evidence — 2026-08-27

## Cross-provider findings

Webhook delivery is an at-least-once transport concern rather than confirmation that a downstream business system completed its work. Stripe advises database-backed processing states to avoid processing the same event twice when manual and automatic delivery retries overlap. It also advises returning a successful response for events already processed. [1]

GitHub documents that it does not automatically redeliver failed webhook deliveries and recommends scheduled inspection, failure identification, redelivery, and investigation of recurring failures. [2] Shopify documents retry limits, delivery failure metrics, response-time visibility, per-delivery attempt information, and terminal subscription removal after repeated failures. [3]

| Design implication | TrueAxis HQ boundary |
| --- | --- |
| Stable per-delivery identity is needed to support receiver de-duplication. | Preserve the existing unique `(webhookId, eventId)` delivery contract. |
| Retries require durable state rather than process memory. | Persist only a bounded, encrypted event envelope plus attempt count, next-attempt time, terminal status, and response evidence. |
| A 2xx transport response is not proof of business completion. | Report a delivery as **accepted by the endpoint**, never as a completed downstream workflow. |
| Repeated failure needs visible terminal treatment. | Separate retryable pending work from terminal failure and expose limited owner-only delivery evidence. |
| Payload retention expands privacy exposure. | Retain only reviewed operational event fields, encrypted at rest, with explicit size limits and owner-scoped access. No client-portal projection. |

## Preconditions for implementation

The existing delivery model has endpoint HTTPS and public-address checks, encrypted endpoint signing secrets, bounded response evidence, and final owner scope in the owner console. It currently performs one attempt in-process and stores neither a retry schedule nor an outbound payload. A durable retry implementation therefore requires an additive database model, authenticated managed scheduling, idempotent claiming, bounded retry policy, and owner-only visibility.

TrueAxis HQ has not been validated against a real external signed receiver. Until a controlled receiver test demonstrates a real retry and downstream idempotency path, no delivery guarantee or receiver-side completion claim is appropriate.

## References

[1]: https://docs.stripe.com/webhooks/process-undelivered-events "Stripe: Process undelivered webhook events"
[2]: https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries "GitHub: Handling failed webhook deliveries"
[3]: https://shopify.dev/docs/apps/build/webhooks/troubleshoot "Shopify: Troubleshoot webhooks"
