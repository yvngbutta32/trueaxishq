# TrueAxis HQ public recovery-route audit — 2026-08-27

## Scope

Invalid public identifiers were rendered for booking, client portal, testimonial, booking management, proposal, and intake routes at desktop width (1280px) and 375px mobile width. This verifies only visible anonymous recovery states. It does not validate valid token flows, authenticated owner/staff operations, browser keyboard traversal, or assistive-technology behavior.

## Result

| Surface | Invalid route reviewed | Desktop | 375px mobile | Protected-data result |
| --- | --- | --- | --- | --- |
| Public booking | `/book/not-a-workspace` | Return action and privacy copy visible | Card and return action contained | No client, booking, or owner data shown |
| Client portal | `/portal/not-a-valid-token` | Expiry guidance and return action visible | Card and recovery copy contained | No portal, client, invoice, or booking data shown |
| Feedback | `/testimonial/not-a-valid-token` | Recovery card visible | Card and return action contained | No feedback or client data shown |
| Booking management | `/booking/manage/not-a-valid-token` | Recovery card visible | Card and return action contained | No booking data shown |
| Proposal | `/proposal/not-a-valid-token` | Recovery card visible | Card and return action contained | No proposal or client data shown |
| Intake | `/intake/not-a-valid-form` | Recovery card visible | Card and return action contained | No form configuration or response data shown |

All six inspected invalid-link states used the shared branded recovery pattern, a clear return action, and plain-language privacy guidance. No confirmed responsive repair was identified from the rendered 1280px and 375px views. Existing source-contract coverage retains the shared recovery component requirement for the corresponding public pages.
