# Market-Leadership Communication Research

**Evidence label:** Official competitor workflow documentation; scope-selection evidence only.

HoneyBook documents automation workflows with a trigger, actions, waits, conditions, preview/activation, and optional review of automated email content. Its documented triggers include inquiry, scheduling, file, booking, payment, and project-milestone events.[1] Jobber documents customizable email/text templates, quote follow-ups, visit reminders, on-my-way updates, job follow-ups, invoice follow-ups, and stored two-way conversations.[2]

TrueAxis HQ already has an automation center, preview, portal messaging, job status, client-safe service visits, and owner-created updates. It does **not** yet have verified SMTP delivery, SMS, a live provider message-reporting channel, or a basis for claiming automatic outbound client communication. The bounded autonomous opportunity is therefore an owner-reviewed, portal-delivered job-update template library—not an email/SMS automation claim.

| Competitor pattern | TrueAxis evidence-supported response | Explicit limit |
|---|---|---|
| Repeatable client updates for changing job state | Allow an owner to choose a concise status-update template, review the text, and send it through the existing token-scoped portal message flow. | No claim of email, SMS, deliverability, open tracking, or automatic send. |
| Visit/on-my-way clarity | Reuse existing client-safe service-visit status and scheduled window within an owner-reviewed portal update. | No live location, ETA, technician assignment, or routing claim. |
| Professional template consistency | Provide an editable starting message while requiring an owner decision for each send. | Not a multi-channel campaign, rule engine, or marketplace template system. |

## Implemented Boundary and Validation

Field Mode now provides four concise starting messages: **On my way**, **Work started**, **Next step**, and **Work complete**. Selecting one writes an editable local draft. The owner or field worker must still review the content and explicitly select **Post update**; the existing job update mutation posts it as a client-visible portal update. Template selection does not invoke an automation, email, SMS, webhook, location share, or delivery tracker.

**Validation:** The template selector is covered by a deterministic pure-contract test; the full suite passed **39 test files and 132 tests**, followed by strict TypeScript. An authenticated field-user session remains required for a live mobile walkthrough.

## References

[1] [HoneyBook, Client workflow automation software](https://www.honeybook.com/product/automations)

[2] [Jobber, Automated client communication for field services](https://www.getjobber.com/features/customer-communication-management/)
