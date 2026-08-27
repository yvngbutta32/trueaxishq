# TrueAxis HQ external-validation runbook — 2026-08-27

## Purpose

This runbook prepares the remaining real-world validation work without changing credentials, DNS, provider settings, schedules, or production data. Complete each check in a controlled test environment, record the stated evidence, and stop if any no-go condition occurs. A passed local build or automated test does not replace provider or authenticated end-to-end evidence.

## Gate sequence

| Gate | Controlled setup | Success evidence | No-go condition |
| --- | --- | --- | --- |
| SMTP sender and transactional email | Use a verified sender on the intended domain and a dedicated test mailbox. Confirm provider credentials only through the project secret manager. | A test message arrives with expected sender identity and authentication results; application diagnostics show a non-sensitive accepted outcome. | Missing or misaligned domain authentication, sender mismatch, provider rejection, bounced test message, or secrets exposed in source/logs. |
| Stripe test checkout and webhook | Use an isolated Stripe sandbox, a test customer/payment method, a production-reachable HTTPS webhook configuration, and its matching endpoint signing secret. | Checkout return is factual; Stripe’s signed event is accepted from its raw body; event ID is durably recorded before acknowledgement; duplicate/replay causes no duplicate effect; protected status reflects the verified event. | Unsigned/invalid signature accepted, wrong secret, parsed-body verification, duplicate business effects, absent durable receipt, or unexpected customer data exposure. |
| Outbound workflow receiver | Use an owner-authorized HTTPS test receiver that logs only opaque event IDs, event type, signature validity, and HTTP status. | Receiver verifies the documented HMAC against the raw body, de-duplicates by event ID, returns 2xx after accepting the event, and TrueAxis HQ records the expected attempt outcome. | Private/non-HTTPS destination accepted, receiver sees unexpected fields, signature fails, unsafe retries occur, or non-2xx behavior is not recorded. |
| Native Google Calendar synchronization | Use a dedicated calendar and a non-production owner account. Create, change, and delete known test events on each side. | Initial full sync is recorded; incremental sync persists its final-page token; pagination, deletion, duplicate prevention, disconnect, expired token (410), and full re-sync recovery are evidenced. | Treating subscription feeds as native sync, token persistence missing, missing deletion reconciliation, or no recovery after a 410 response. |
| Authenticated owner, staff, and client journeys | Use distinct, least-privilege test identities, one test client portal token, and a 375px physical-device or emulated-session check. | Screens or recordings show authorized happy path, invalid/expired recovery, denied cross-role access, protected-data minimization, visible keyboard focus, and error recovery for each role. | Any cross-workspace data exposure, role escalation, inaccessible critical control, or client access to private owner/dispatch/asset/inspection data. |

## Provider requirements

Google recommends SPF, DKIM, and DMARC for sender domains; a third-party sender must authenticate the organization’s domain correctly. Google’s DMARC guidance advises confirming SPF and/or DKIM first and allowing their authentication to operate before adding DMARC. [1] [2]

Stripe requires the endpoint signing secret, request signature, and unmodified raw request body for signature verification. Stripe recommends testing in a sandbox and can send signed simulated events through its CLI. [3] [4] Stripe sandboxes do not move real money, so their successful results establish integration behavior rather than live payment performance. [5]

Google Calendar incremental synchronization requires durable sync-token state, consistent query parameters, pagination to the final token, deleted-entry handling, and a full re-sync after a 410 invalid-token response. A Calendar watch channel also has an expiration that must be tracked if future push observation is added. [6] [7]

## Evidence handling

Store no payment card data, email credentials, webhook signing secrets, full portal tokens, full event payloads, or recipient personal data in the release evidence. Record timestamps, environment, test identity role, result, safe identifiers or redacted references, and any corrective action. Keep live-mode testing separate from sandbox testing and do not enable a live provider configuration until the corresponding sandbox sequence has passed and its results have been reviewed.

## References

[1]: https://support.google.com/mail/answer/81126?hl=en "Google Gmail Help: Email sender guidelines"
[2]: https://knowledge.workspace.google.com/admin/security/set-up-dmarc "Google Workspace: Set up DMARC"
[3]: https://docs.stripe.com/webhooks "Stripe: Receive Stripe events in your webhook endpoint"
[4]: https://docs.stripe.com/webhooks/quickstart "Stripe: Set up and deploy a webhook"
[5]: https://docs.stripe.com/testing-use-cases "Stripe: Testing use cases"
[6]: https://developers.google.com/workspace/calendar/api/guides/sync "Google Calendar API: Synchronize resources efficiently"
[7]: https://developers.google.com/workspace/calendar/api/v3/reference/events/watch "Google Calendar API: Events watch"
