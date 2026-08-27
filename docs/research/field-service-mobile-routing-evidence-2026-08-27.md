# Field-Service Mobile and Routing Evidence — 2026-08-27

## Official capability comparison boundary

Housecall Pro documents offline viewing of schedule and job information, while stating that offline editing is not supported. Its route product describes distinct capabilities: scheduled route planning, route optimization, real-time phone or vehicle location, and automated customer messages. These are separate operational and consent-sensitive capabilities, not interchangeable map features.[1] [2]

Its detailed mobile FAQ further states that only previously opened job information may be available offline and that offline editing is not supported. It lists customer names, addresses, history, private notes, checklists, and attachments among potentially stored fields, underscoring that offline caching has material shared-device and retention implications.[3]

Independent Jobber reviews on Capterra highlight useful counterweights to feature checklists: reviewers describe fragmented reporting, limited customization in reporting and schedules, approval-stage quote rigidity, integrations needing workarounds, and at least one report of confusing map behavior. These are individual reports rather than product-wide findings, but they support prioritizing clear operator workflows, controllable reporting, and failure/recovery states over unsupported “feature parity” claims.[4]

Microsoft’s Field Service offline guidance likewise describes offline support as a defined profile with selected local data rather than a generic browser fallback. This further supports treating full offline editing as a separate, security-sensitive synchronization system that requires a minimized data profile, encryption, retention controls, and explicit recovery testing.[5]

Microsoft’s Field Service Outlook documentation illustrates that calendar synchronization needs an explicit directionality, data-window, deletion, and duplicate/conflict policy. Its documented booking feed is one-way, uses a bounded time window, and does not delete already synchronized records when disabled. TrueAxis HQ must not describe its current subscription feed or Google authorization record as bidirectional synchronization until it implements and tests those separate policies.[6]

Stripe documents separate automatic and manual webhook retry behavior, including exponential backoff and bounded retry windows. This supports treating true provider-event reliability as an end-to-end requirement covering signed delivery, idempotent processing, observability, and controlled recovery—not merely a local payment-return screen.[7]

Stripe also documents manual recovery of undelivered events and requires applications to prevent duplicate processing when manual recovery overlaps with automatic retries. This validates the existing durable event-ID boundary while showing why the process-local retry queue is insufficient evidence for restart-safe payment-event recovery.[8]

## Product decision

TrueAxis HQ currently provides owner-only private site mapping, scheduled-order route preview with optimization disabled, capacity signals, and session-limited Field Mode draft recovery. It must not claim live GPS, traffic-aware optimization, automatic client messages, offline editing, or ETA guarantees until those individual systems, consent controls, failure states, and end-to-end behavior are implemented and validated.

## References

[1]: https://www.housecallpro.com/features/mobile-app/ "Housecall Pro Field Service Mobile App"
[2]: https://www.housecallpro.com/features/route-optimization-software/ "Housecall Pro Route Optimization Software"
[3]: https://help.housecallpro.com/en/articles/4747652-housecall-pro-mobile-faq "Housecall Pro Mobile FAQ"
[4]: https://www.capterra.com/p/127994/Jobber/reviews/ "Jobber Reviews — Capterra"
[5]: https://learn.microsoft.com/en-us/dynamics365/field-service/mobile/best-practices-limitations-offline-profile "Microsoft Field Service mobile offline profile best practices"
[6]: https://learn.microsoft.com/en-us/dynamics365/field-service/outlook-integration "Microsoft Field Service Outlook integration"
[7]: https://docs.stripe.com/webhooks "Stripe webhook delivery and retry documentation"
[8]: https://docs.stripe.com/webhooks/process-undelivered-events "Stripe undelivered webhook event processing"
