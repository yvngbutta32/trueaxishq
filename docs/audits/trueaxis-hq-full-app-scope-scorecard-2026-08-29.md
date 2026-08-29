# TrueAxis HQ — Full-App Scope and Competitor Scorecard

**Assessment date:** 2026-08-29  
**Assessment type:** Evidence-led source, test, local-browser, and public-source review  
**Decision status:** Product-readiness assessment; not a certification, market ranking, or production acceptance decision

## Executive assessment

TrueAxis HQ is an **early-stage service-business operations application with a broad functional surface and several deliberately strengthened privacy boundaries**. It currently covers much of the owner workflow from intake through client, job, proof-of-work, invoice, and follow-up preparation. It also contains a deliberately limited staff workspace and a token-scoped client portal. The strongest evidence-backed distinction is not feature breadth; it is the recent work on **default-private sharing, tenant predicates, and truthfulness of delivery/integration states**.

The evidence does **not** support calling the product a universal replacement for HoneyBook, Bonsai, Jobber, Housecall Pro, Dubsado, or ServiceTitan. Those established products publicly document mature mobile, provider, accounting, payment, implementation, and/or field-dispatch ecosystems that were not reproduced or externally validated here.[1] [2] [3] [4] [5] [6] TrueAxis HQ is best characterized today as a **promising, locally validated foundation**, not as launch-proven operational software.

> **Evidence-capped overall comparison score: 4.9 / 10.** This is an internal relative capability-and-readiness score, not a customer rating, security grade, availability measurement, or prediction of commercial success. It intentionally caps areas that lack provider, production, mobile, independent security, and cross-account validation.

## Method and scoring rules

The score considers the current source surface, latest recorded local validation, public route review, and current public competitor documentation. It does not award points for a route name, a mocked state, or marketing copy alone. **7–10** requires relevant behavior to be validated beyond local code paths; **4–6** means a meaningful implemented surface with important unvalidated or incomplete operating dependencies; **0–3** indicates absent, placeholder, or unsupported scope.

| Evidence class | How it affected the score | Limitation |
|---|---|---|
| Current source and route/procedure inventory | Establishes that a capability surface exists. | Does not establish correct production behavior or usability. |
| Focused tests and latest full suite | Confirms selected local contracts. The latest relevant checkpoint recorded 120 passing test files / 348 tests, TypeScript, production build, and bundle budgets. | Tests are not an independent security audit, device matrix, or production load test. |
| Controlled local browser journeys | Confirms selected owner, client, and staff steps, including privacy states. | Uses local disposable data and sessions; not a production, concurrent-device, or broad client test. |
| Competitor official pages | Establish documented competitor capability breadth. | Vendor documentation does not independently prove competitor quality or fit. |
| Public review pages | Identifies attributable examples and recurring themes worth investigating. | Review themes are non-representative and are not used to declare competitor reliability. |

## Current product scope

The application has public entry points for booking, invoice payment, portal links, proposal action, intake forms, testimonials, staff access, account login/registration/recovery, and policy/help pages. Its protected owner routes include a dashboard, billing, jobs, clients, scheduling, team/capacity, dispatch, outreach, deals, insights, settings, and administrative surfaces. A separate `/staff` route provides the limited field workspace. The current router is also organized into separate areas for authentication, clients, customer assets, inspection templates/responses, invoices, bookings, follow-ups, analytics, security, calendar feeds, portals, contracts, time, recurring services, job photos, staff access, dispatch, integrations, webhooks, and jobs.

| Area | Present scope evidenced in source or controlled local use | Evidence position | Important boundary or missing validation |
|---|---|---|---|
| Lead and client operations | Contact capture, leads, client records, tags, inbox/follow-up surfaces, search, and profile/business settings. | Source surface; selected protected procedures. | No live email/CRM provider, migration, or production-volume conclusion. |
| Booking and scheduling | Public booking routes, configurable services/availability, bookings, cancellation/manage links, calendar feed, private capacity planning, dispatch board, and recurring-service planning. | Source surface; selected local views. | No calendar provider synchronization, native mobile scheduling, live field availability, or traffic-aware optimization conclusion. |
| Job execution | Jobs, task/checklist templates, task progress, client-ready reviewed summaries, customer assets, inspection templates/responses, expenses, cost reporting, approvals, documents, and proof photos. | Stronger local owner/client evidence for task, summary, and proof-photo share/unshare. | Not a substitute for a full job lifecycle, multi-user, offline, or foreign-client journey. |
| Client portal | Token-scoped portal, client messages, bookings, proposal/invoice/payment routes, reviewed job summary, explicitly shareable tasks, and proof-photo projection. | Controlled valid-token and invalid-token checks; focused portal tests. | Foreign valid-token, token revocation, client messaging, payment, and production behavior remain unverified. |
| Staff access | Owner-managed roster/capacity, private invite links, memberships, assigned work, service visits, and a restricted Field workspace. | Controlled mismatch denial, disposable registration/acceptance, limited-workspace, direct-owner-route denial, and sign-out checks. | Separate devices, concurrent sessions, mobile accessibility, and every owner route’s UI remain unverified. |
| Revenue and finance | Invoices, recurring invoices, expenses, time entries, job cost reports, Stripe route surfaces, and pricing/billing controls. | Source and targeted delivery-state tests. | Stripe sandbox is not claimed as fully configured, and no provider acceptance, payment, reconciliation, tax, accounting sync, or customer checkout outcome was established. |
| Automation and AI | Follow-up rules, automations, webhooks, AI procedures, notifications, email templates, monthly reports, and integration status/settings. | Source surface plus delivery-state and configuration-state corrections. | Background execution, provider acceptance, deliverability, retried webhooks, and real AI quality are not established. |
| Security and privacy | Protected procedures, owner predicates, session revocation, password reset/session invalidation, client-portal minimization, private-by-default task/photo/summary controls, staff invited-email verification, and staff owner-route exclusion. | Recent focused tests and controlled local journeys. | No penetration test, third-party audit, production monitoring, legal/privacy review, or exhaustive authorization proof. |
| UX, accessibility, and performance | Keyboard-reachable sign-in control, focus states, responsive public-route captures, owner/staff route repairs, build budgets, and a current 120-file test suite. | Local desktop and selected 375px public rendering; local build budgets. | Authenticated owner mobile view, screen-reader evaluation, cross-browser/device testing, field conditions, and load testing remain open. |

## Evidence-led scorecard

The comparison is weighted toward the service-business workflows in the user’s product brief. Competitor columns are **relative maturity estimates based on public documented breadth**, not independently audited scores. TrueAxis HQ’s score is deliberately lower where implementation exists but operational proof is absent.

| Dimension | Weight | TrueAxis HQ | HoneyBook | Bonsai | Jobber | Housecall Pro | Dubsado | ServiceTitan | Rationale for TrueAxis HQ score |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Lead-to-client workflow | 14% | 6.0 | 8.5 | 8.4 | 8.4 | 8.0 | 8.2 | 8.7 | Substantial routes and CRM-like procedures exist, but live intake conversion and communication delivery are unverified. |
| Booking and scheduling | 12% | 5.0 | 8.2 | 7.8 | 8.8 | 8.6 | 7.4 | 9.0 | Booking, availability, cancellation, and planning are present; calendar sync, live assignment, mobile, and actual provider journeys are not. |
| Jobs, field execution, and dispatch | 16% | 5.0 | 6.5 | 7.8 | 8.9 | 8.8 | 6.8 | 9.5 | Jobs, assets, inspections, private capacity, staff assignments, and photos are present; no native mobile/offline, GPS, or production dispatch operations. |
| Client experience and portal | 12% | 5.5 | 8.3 | 8.0 | 8.6 | 8.5 | 7.8 | 8.8 | Explicit reviewed sharing and minimization are a strength; scope and portal journeys are narrower and not broadly validated. |
| Finance, payments, and reporting | 14% | 4.8 | 8.3 | 8.4 | 8.4 | 8.5 | 8.1 | 9.2 | Invoices, expenses, time, and costing exist; provider-backed payments, accounting, settlement, and advanced reporting do not have operational evidence. |
| Automation and integrations | 12% | 4.0 | 8.5 | 8.1 | 8.5 | 8.5 | 8.0 | 9.2 | Workflows, webhooks, and settings exist, but credentials, scheduled execution, delivery, and sync remain distinct gates. |
| Security and data minimization | 10% | 5.8 | 7.5 | 7.3 | 7.6 | 7.5 | 7.2 | 8.2 | Recent local evidence for share controls, owner predicates, sessions, and staff boundaries is meaningful; independent assurance and production testing are absent. |
| Mobile, accessibility, and usability validation | 5% | 4.0 | 8.2 | 6.8 | 8.6 | 8.3 | 6.2 | 8.7 | Some responsive/public and keyboard improvements exist, but authenticated mobile, assistive-tech, and cross-device validation are incomplete. |
| Operational quality and release confidence | 5% | 5.0 | 8.3 | 8.0 | 8.5 | 8.4 | 7.8 | 9.0 | Type checks, tests, builds, budgets, and targeted local journeys provide a base; production observability, SLOs, load tests, and deployment evidence are missing. |
| **Weighted comparison score** | **100%** | **4.9** | **8.0** | **7.9** | **8.4** | **8.3** | **7.5** | **9.0** | **TrueAxis HQ is a foundation with meaningful workflows, not a verified substitute for the mature operating ecosystems.** |

## What the comparison actually says

HoneyBook, Bonsai, and Dubsado are the closer reference set for an independent service professional: each documents client intake, documents/proposals, invoicing or payments, scheduling, workflows, and a portal.[1] [2] [5] TrueAxis HQ already has a broad overlapping surface, but it lacks independent proof for the external systems that make those workflows operational—especially communication delivery, billing, contract/legal completion, and integrations.

Jobber and Housecall Pro are closer reference points for small-to-mid-sized field-service operations. Their official feature pages include field-oriented capabilities such as team coordination, dispatch, mobile use, payments, client self-service, and automation.[3] [4] TrueAxis HQ has a useful start in job workspaces, customer assets, inspections, staff capacity, restricted staff access, cost context, and reviewed proof sharing. It does **not** have current evidence for native technician mobile apps, offline behavior, GPS tracking, provider-backed messaging, payment acceptance, traffic-aware routing, or a mature accounting ecosystem.

ServiceTitan is an enterprise-oriented benchmark: its published surface includes construction, field operations, accounting/AP, inventory, pricebooks, payroll, partner integrations, APIs, and customer experience tooling.[6] That comparison is useful as a long-term capability map, but it is not a near-term parity target. Treating all ServiceTitan breadth as immediate scope would likely undermine the simpler, deliberately constrained workflow that TrueAxis HQ currently supports.

## Customer-friction themes worth solving—not copying blindly

Public review sources contain useful **individual and aggregated themes**, but do not prove a universal problem. HoneyBook’s Trustpilot page, for example, mixes positive and negative experiences while its review summary mentions speed/glitch, advanced-feature learning, and pricing concerns.[7] Capterra pages for Jobber and Housecall Pro include examples of reporting/customization, integration, performance, and connectivity friction.[8] [9] G2’s Dubsado page highlights its learning curve and includes individual reports of setup confusion, stale data, and portal/project-management usability issues.[10]

| Review-informed design opportunity | Current TrueAxis HQ position | Evidence-led next move |
|---|---|---|
| Avoid hidden or overstated automation | Recent delivery-state changes avoid calling console fallback or failure “sent.” | Keep a visible state model for draft, configured, accepted, failed, and unconfigured—not a broad “automated” badge. |
| Make privacy share decisions deliberate | Task, job summary, and proof photo workflows have explicit private/share controls. | Extend this consistency to every new portal surface and verify foreign-token cases before wider portal scope. |
| Prevent complexity from becoming a maze | Dashboard has a wide panel surface and already needed navigation-hit-target repairs. | Prioritize task-completion journeys, search, responsive authenticated layouts, and information architecture before adding broad parity modules. |
| Make data state trustworthy | Monthly reports and Calendar setup/sync wording were recently corrected. | Add full state coverage to all provider-dependent actions: status, last attempt, error, retry path, and audit record. |
| Respect field conditions | There is no verified mobile/offline field evidence. | Do not market mobile/offline/GPS functionality until native/responsive field journeys and failure modes are implemented and tested. |

## Highest-priority gap register

### Blockers before a public operational launch

1. **Provider configuration and end-to-end acceptance.** Configure and test the intended SMTP, Stripe, Calendar OAuth, and any real integration credentials in a staging environment. Verify failures, retries, recipient consent, webhook authenticity, payment lifecycle, and audit logs. Current code and local tests do not establish any of these external outcomes.

2. **Production security and reliability validation.** Run a scoped authorization review across every protected mutation and every token-scoped portal route, then add independent penetration testing, secret review, logging/alerting, backups/restore testing, rate limits, and production incident procedures. Existing focused tests are valuable but not enough for a security assurance claim.

3. **Real multi-party journey testing.** Execute at least one staging journey with separate owner, staff, and client identities and a second client tenant. Include invite mismatch, invite expiry/revocation, token revocation, portal projection, staff assignment, password reset/session invalidation, invoice/payment test mode, and calendar/provider failures. Preserve disposable data and do not use real customers for this gate.

4. **Authenticated mobile and accessibility validation.** The current evidence includes selected 375px public screens, but not the authenticated owner or staff workflows. Validate keyboard paths, screen readers, mobile browser responsiveness, touch targets, contrast, error recovery, and reduced-motion behavior before advertising field readiness.

### Next capability investments after the launch blockers

| Priority | Investment | Why it matters | Do not claim before evidence |
|---|---|---|---|
| P1 | Integration-state center | A unified, owner-scoped health surface for credentials, last attempt, accepted result, failures, and safe retry would prevent false “connected/sent” impressions. | Live sync or delivery. |
| P1 | Full portal policy matrix | Explicitly define every portal field and document/photo/task visibility rule, then test foreign valid tokens and revocation. | Universal isolation or compliance certification. |
| P1 | Mobile-first field workflow | Build and test a constrained field experience for assigned work, proof capture, checklists, and status updates. | Offline mode, GPS, native app availability, or real-time location. |
| P1 | Operational observability | Add structured error tracking, audit review, health checks tied to dependencies, backup/restore drills, and latency/error budgets. | High availability, durability, or production reliability. |
| P2 | Accounting ecosystem | Research and implement a reconciled accounting connector only after provider contract and idempotency design are reviewed. | Accounting synchronization or financial correctness. |
| P2 | Field-service depth | Consider pricebook/versioning, inventory, purchase orders, multi-location/customer hierarchy, and richer labor/cost analysis only with a focused target segment. | Enterprise field-service parity. |
| P2 | Communications maturity | Add consent-aware two-way messaging and templates with provider webhooks, delivery state, opt-out, and retention design. | SMS/email deliverability or compliance. |

## Positive, evidence-backed foundations to preserve

The product should preserve several choices already supported by local evidence. First, **private-by-default client visibility** for tasks, reviewed job summaries, and proof photos prevents implicit portal expansion. Second, the staff model requires an active roster record, active invite/membership, email-aware acceptance, and a limited Field workspace; the controlled local check showed a mismatched owner identity denied, matching staff registration, direct owner-dashboard redirection, and owner-admin boundary. Third, recent delivery and integration corrections distinguish setup-required, draft, configured, and accepted-state language instead of converting local intent into a claim of external completion.

These are more valuable than rushing to copy every feature in a competitor’s marketing page. The most credible path to a higher score is not “more modules”; it is **proving a smaller set of essential workflows under real but controlled operating conditions**.

## Rating interpretation

| Score band | Meaning in this assessment | TrueAxis HQ position |
|---|---|---|
| 9–10 | Broad mature capability plus independent reliability, security, provider, mobile, and production evidence. | Not supported. |
| 7–8 | Strong, validated product in its target segment with notable but bounded gaps. | Not supported yet. |
| 5–6 | Meaningful implemented workflow surface with important operating dependencies or validation gates unresolved. | Several domains fall here. |
| 3–4 | Narrow, early, or mostly unvalidated scope. | Integrations, field-mobile depth, and launch confidence fall here. |
| **Overall 4.9** | Weighted blend of the rows above, capped by missing external/production validation. | **Current evidence-led assessment.** |

## References

[1] [HoneyBook — clientflow platform and feature overview](https://www.honeybook.com/)  
[2] [Bonsai — unified service-business platform](https://www.hellobonsai.com/)  
[3] [Jobber — home-service feature overview](https://www.getjobber.com/features/)  
[4] [Housecall Pro — feature overview](https://www.housecallpro.com/features/)  
[5] [Dubsado — feature overview](https://www.dubsado.com/feature-overview)  
[6] [ServiceTitan — feature overview](https://www.servicetitan.com/features)  
[7] [Trustpilot — HoneyBook reviews](https://www.trustpilot.com/review/honeybook.com)  
[8] [Capterra — Jobber reviews](https://www.capterra.com/p/127994/Jobber/reviews/)  
[9] [Capterra — Housecall Pro reviews](https://www.capterra.com/p/140363/HouseCall-Pro/reviews/)  
[10] [G2 — Dubsado reviews](https://www.g2.com/products/dubsado/reviews)  
[11] [TrueAxis HQ — controlled local user-journey evidence](./user-journey-browser-access-2026-08-29.md)  
[12] [TrueAxis HQ — public-route audit findings](./public-route-audit-findings-2026-08-28.md)  
[13] [TrueAxis HQ — competitor refresh source notes](../research/competitor-scorecard-refresh-sources-2026-08-29.md)
