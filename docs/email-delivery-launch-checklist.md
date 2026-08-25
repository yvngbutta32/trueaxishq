# TrueAxis HQ Transactional Email Launch Checklist

TrueAxis HQ is currently safe to run in console fallback mode. When SMTP credentials are absent or incomplete, messages are not reported as successfully delivered to recipients; they are logged for operational visibility instead. When credentials are present, the application reports only non-sensitive readiness fields: host, port, sender, TLS mode, and machine-readable configuration issues. Passwords and raw provider errors are never included in the status payload or returned to callers.

## Completed without provider credentials

The email helper now validates the host, username, password presence, sender shape, and port range. It distinguishes implicit TLS on port 465 from STARTTLS-style ports such as 587, exposes safe configuration issues, resets its in-process transport cache for controlled configuration reloads and tests, sanitizes header fields against newline injection, escapes user-controlled template values, and returns a generic delivery failure message rather than leaking provider internals. Automated coverage exercises incomplete configuration, valid configuration, TLS detection, invalid ports, invalid senders, and secret non-disclosure.

## Manual provider steps still required

The owner must choose a provider, create or locate a provider-generated SMTP credential, and configure the five environment values `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` in the project Secrets panel. Brevo commonly uses `smtp-relay.brevo.com` on port `587`; Gmail commonly uses `smtp.gmail.com` on port `587` with a dedicated app password; other providers may use different values. The sender address in `SMTP_FROM` must be verified with the provider, and the sending domain should have SPF and DKIM configured before public launch.

After the values are saved, the owner should send one controlled message to an inbox they control using the password-reset or booking-confirmation flow. Confirm receipt, From and Reply-To display, links, HTML rendering, spam placement, and the absence of secrets in application logs. Then repeat the flow with a deliberately invalid provider credential to confirm the user receives a safe retryable error while operators can identify the SMTP failure from server logs.

## Launch gate

Transactional email is launch-ready only after a real inbox receives the controlled test message, the sender/domain passes provider verification, and the Stripe webhook and payment-flow checks are also complete. Until then, TrueAxis HQ should be described as beta/controlled-launch software rather than generally launch-ready.
