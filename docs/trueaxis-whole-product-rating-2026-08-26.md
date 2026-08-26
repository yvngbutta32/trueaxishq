# TrueAxis HQ — Whole-Product Evidence-Led Rating

**Prepared:** August 26, 2026  
**Rating type:** Whole-product quality and launch-evidence assessment. This is not a market-share ranking, independent usability study, security certification, legal opinion, customer-satisfaction measure, or universal purchasing recommendation.

## Overall Rating: **8.7 / 10**

The **8.7 / 10** score is a weighted assessment of the current application as a whole. It recognizes the depth of implemented and tested workflows, but it deliberately deducts for the real-world evidence that code alone cannot supply: live SMTP and sender validation, actual Stripe Checkout and signed webhook confirmation, provider authorization, authenticated owner/client usability sessions, and broad responsive accessibility testing.

> **Capability depth is not the same as launch readiness.** The existing competitive capability record remains approximately **8.8 / 10** in its narrower feature-depth frame. This whole-product score is slightly lower because it includes reliability, accessibility, integration maturity, and real-session readiness evidence.

## Dimension-by-Dimension Assessment

| Dimension | Weight | Score / 10 | Evidence-supported assessment | Principal deduction |
|---|---:|---:|---|---|
| Core service-business operations | 11% | **9.0** | CRM, intake, booking, jobs, proposals, contracts, invoicing, recurring billing, expenses, time, documents, automations, analytics, onboarding, and exports are implemented. | Does not prove every workflow in a real production organization. |
| Owner experience and workflow clarity | 10% | **8.1** | Dashboard navigation, command shortcuts, checklist templates, private custom fields, draft duplication/editing, cost reports, and CSV exports support practical owner operations. | No controlled owner usability study or authenticated responsive walkthrough yet. |
| Client experience and trust | 9% | **8.3** | Token-scoped portal, proof timeline/gallery, explicitly shared documents, approvals, proposals, package choice, decline capture, and recovery states are implemented. | No real client-session study; communication delivery is not verified. |
| Security and authorization | 12% | **8.7** | Final owner predicates, scoped public tokens, trusted reset/return origins, SSRF-aware webhooks, atomic one-time flows, and fresh public-data minimization repairs are tested. | No independent penetration test, security certification, or live third-party review. |
| Privacy and data isolation | 7% | **8.7** | Owner/client scopes, explicit portal projections, client-safe activity allowlist, and selected live integrity checks materially reduce exposure risk. | Source and selected-data review cannot prove absence of every future or operational leak. |
| Reliability, recovery, and operational safeguards | 10% | **8.1** | Invalid-link recovery, final write predicates, concurrency fixes, webhook delivery evidence, bundle budgets, and deterministic tests are in place. | SMTP/Stripe/external receiver journeys and live error behavior remain unverified. |
| Engineering quality and test coverage | 8% | **8.8** | **57 test files / 174 tests**, strict TypeScript, production build, clean production dependency audit, and bundle budgets passed in the latest audit release. | Tests are largely deterministic contract/source coverage rather than full authenticated browser E2E coverage. |
| Accessibility and responsive quality | 7% | **6.2** | Recovery views and many accessible controls were implemented and selected public mobile evidence exists. | A full keyboard, screen-reader, contrast, and authenticated all-route responsive pass remains open. |
| Performance and deployment discipline | 5% | **7.7** | Current bundle budgets pass and production build succeeds; public flows use bounded queries/projections in reviewed areas. | No real-user monitoring, core web-vitals dataset, or load test evidence. |
| Integrations, payments, and communications | 8% | **5.2** | Truthful readiness catalog, OAuth-state controls, Stripe/webhook code paths, and signed outbound webhooks exist. | Live provider authorization, payment webhook, sender/domain, accounting, calendar, and communications evidence is open. |
| Field, dispatch, and team operations | 6% | **7.6** | Team/capacity, assignments, service visits, dispatch conflict signals, Field Mode, and client-safe service updates are implemented. | No GPS/routing, technician ecosystem, live team permission, or authenticated mobile-field validation. |
| Financial workflow and planning | 5% | **8.1** | Invoice workflow, receipt markup, time/expense tracking, private job costing, portfolio reports, and local margin review signals are implemented. | No accounting sync, payroll, tax, payout reconciliation, or actual-profitability validation. |
| Differentiation and competitive positioning | 6% | **8.1** | Strongest documented themes are client-safe proof, recoverable public flows, private owner clarity, approvals, shared documents, and security-aware workflow controls. | Mature vendors retain broader proven provider ecosystems, GPS/routing, agency finance, and field operations. [1] [2] [3] [4] [5] |
| Launch readiness | 6% | **6.3** | The codebase has a clean validated autonomous baseline and deployed domains. | Critical external gates remain: controlled SMTP test, verified sender/domain, Stripe live test webhook, real webhook receiver, and authenticated responsive/end-to-end journeys. |
| **Weighted whole-product score** | **100%** | **8.7 / 10** | Weighted average = **8.674**, rounded to one decimal. | Not a claim of universal readiness or market leadership. |

## What the Score Means

TrueAxis HQ is a **high-depth, security-aware service-operations product** with unusually strong implemented protections around owner/client separation, public recovery, evidence-sharing, and operational continuity. The latest fresh audit found real issues and repaired them rather than treating prior test success as sufficient. That increases confidence in the engineering posture, while also demonstrating why the rating is evidence-labeled rather than absolute.

The score is not a claim that the app is fully launch-ready. The main score constraints are not cosmetic: email delivery, payment events, signed third-party receipt, provider connectivity, independent security review, comprehensive accessibility evaluation, real user behavior, and authenticated mobile operation require real environments and people. Those are the difference between a strong audited build and a fully evidenced production service.

## Competitor Context

The dimensions that most constrain TrueAxis HQ’s market score are also where established vendors have long-running live ecosystems: HoneyBook’s clientflow platform, Jobber’s client hub, Bonsai’s agency finance and project breadth, Dubsado’s configurable workflow depth, and Housecall Pro’s dispatch specialization. [1] [2] [3] [4] [5]

TrueAxis HQ’s strongest evidence-backed differentiation remains **client-safe work proof and trust workflows combined with owner-controlled privacy boundaries**. It should communicate those concrete strengths, not claim that competitors are obsolete or that every business will have the same outcome.

## Highest-Leverage Path to a Higher Score

| Evidence gap to close | Why it changes the score | Validation needed |
|---|---|---|
| Transactional email and verified sender | Removes a core communications/operational uncertainty. | Secure SMTP configuration, domain/sender verification, and a controlled received-email test. |
| Stripe Checkout and webhook | Validates payment-state authority under a real signed event. | Sandbox claim/configuration, genuine Checkout, and signed webhook observation. |
| Authenticated owner/client responsive journeys | Directly improves usability, accessibility, and launch-readiness evidence. | Controlled desktop and 375px owner/client walkthroughs, including Field Mode handoff. |
| Real external webhook receipt | Validates the signed-delivery contract beyond local code. | An authorized HTTPS receiver and retained delivery evidence. |
| Independent accessibility/security assessment | Changes confidence more than additional feature volume. | Representative route audit, keyboard/screen-reader checks, and independent security review. |

## References

[1] [HoneyBook product platform](https://www.honeybook.com/)

[2] [Jobber Client Hub](https://www.getjobber.com/features/client-hub/)

[3] [Bonsai project management](https://www.hellobonsai.com/projects)

[4] [Dubsado platform](https://www.dubsado.com/)

[5] [Housecall Pro dispatching software](https://www.housecallpro.com/features/dispatching-software/)
