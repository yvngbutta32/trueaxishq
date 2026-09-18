# TrueAxis HQ Competitive Research Record

This living research record distinguishes official product claims from implementation recommendations. It is maintained during the August 2026 competitive excellence program.

## Primary-source findings

| Platform | Verified current positioning and capabilities | Product implication for TrueAxis HQ | Source |
|---|---|---|---|
| HoneyBook | Positions itself around a unified clientflow comprising lead capture, CRM/client management, project pipeline, online payments, proposals, contracts, invoices, scheduling, client portal, tasks, automations, and AI-supported email drafts, project recaps, meeting notes, and business trends. It also lists integrations including QuickBooks, Google Calendar, Gmail, Outlook, Zoom, Zapier, and Calendly. | TrueAxis HQ already covers much of the operational core. Its strongest differentiation opportunity is a more transparent, owner-controlled workflow experience that connects intake evidence and job photos to the same client/project record, while making automation outcomes observable. | [HoneyBook official product page](https://www.honeybook.com/) |
| Dubsado | Presents an operational system in which signed contracts can trigger invoices and project kick-off. It explicitly promotes invoices, payments, scheduling, time tracking, task management, payment reminders, forms, automations, recurring payments, and client portals. | Clients expect a continuous lead-to-contract-to-payment workflow, not isolated tools. TrueAxis HQ should make the transitions between booking, client creation, photos, documents, contracts, invoices, and portal access demonstrably reliable and recoverable. | [Dubsado official product page](https://www.dubsado.com/) |
| Moxie | Lists client management, project management, accounting, contracts and proposals, calendar, invoices, time tracking, collaborators, a mobile app, scheduling, client portal, communication, forms, templates, and AI assistance. Its portal messaging emphasizes controlled client access, selective project visibility, custom external links, proactive payment/signature nudges, e-signatures, payments, and project collaboration. | A portal cannot be only a payment surface. TrueAxis HQ can exceed this with an evidence-rich, service-business portal: verified job photos organized by phase, clear document/payment history, secure owner-selected visibility, and actionable next steps. | [Moxie official product page](https://www.withmoxie.com/) |
| 17hats | Official search result identifies an integrated quote, contract, and invoice document as well as online scheduling and customizable payment schedules. | Quote-to-cash compression is a core competitive expectation. TrueAxis HQ already supports proposals/contracts/invoices; it should emphasize one-click, traceable conversion with client-specific milestones rather than merely separate feature screens. | [17hats official feature page](https://17hats.com/features) |
| Bonsai | Presents a unified service-business platform with CRM, pipeline, scheduling, client portal, estimates, proposals, agreements, forms, projects, tasks, time tracking, timesheets, resource planning, invoicing, payments, expenses, rate cards, bookkeeping, budgets, forecasting, reporting, and accounting integrations. | Bonsai creates competitive pressure around operational breadth. Rather than expanding indiscriminately, TrueAxis HQ should make its existing capabilities faster to operate through a single project/client timeline and tighter job-photo-to-invoice evidence chain. | [Bonsai official product page](https://www.hellobonsai.com/) |
| HoneyBook client portal | Documents a centralized client space for activity, files, messages, payments, shared notes and project details, client uploads, and multi-project switching. It differentiates owner-only/private information from what is client-visible. | TrueAxis HQ should upgrade its token-secured portal toward a transparent, owner-curated client workspace. The initial work should focus on visibility controls and reliable client/booking linkage before expanding interaction breadth. | [HoneyBook portal documentation](https://help.honeybook.com/en/articles/6428603-what-clients-can-see-and-do-in-the-client-portal) |

## Current TrueAxis HQ baseline

The application currently contains owner-scoped CRM, bookings, invoices and Stripe checkout, contracts/proposals, recurring invoices, time tracking, expenses, public booking and intake, automated follow-ups, portal messaging, client portals, business intelligence, job photos, receipt OCR, and owner/admin controls. The router currently exposes more than forty capability domains.

### Launch-quality issues identified during the baseline review

| Finding | Consequence | Priority |
|---|---|---|
| Public estimate-photo confirmation accepts a public `hostUsername`, optionally accepts a booking ID, and persists no client ID. | Public uploads may remain unattached to the client and booking that created them; they therefore cannot reliably appear in the client portal. The flow needs booking-bound association and replay-resistant authorization. | P0 |
| Receipt OCR accepts an arbitrary URL from an authenticated user. | The server-side model request should be constrained to a verified, owner-scoped storage object rather than a general external URL. | P0 |
| SMTP configuration and end-to-end delivery have not been verified. | Transactional email functionality cannot be represented as externally delivered until SMTP credentials and delivery tests are confirmed. | P0 |
| Client Portal Job Photo tracker lines are stale relative to the actual `portal.getPhotos` implementation. | The tracker needs reconciliation so status accurately reflects working code and remaining association work. | P1 |

## Prioritized differentiation roadmap

| Priority | Upgrade | Why it wins | First release boundary |
|---|---|---|---|
| P0 | **Verified estimate-to-job evidence chain** | Most competitors treat uploads, portals, invoices, and projects as connected categories. TrueAxis HQ can make this a secure, verifiable workflow: client uploads become booking- and client-bound evidence, visible in the portal only when intentionally associated. | Add short-lived, limited public-upload sessions; require them for unauthenticated image uploads; attach submitted booking photos to the resulting booking and client; keep existing owner uploads unchanged. |
| P0 | **Owner-scoped receipt intelligence** | AI workflows must not become a server-side URL relay. Restrict receipt OCR to receipts the requesting owner actually owns. | Change OCR from arbitrary image URL input to a receipt photo ID lookup constrained by `userId` and stored photo type. |
| P1 | **Portal as a curated client workspace** | HoneyBook and Moxie establish expectations for selective content visibility, shared activity, files, and payments. | Build owner visibility controls and a unified project timeline after photo association is reliable. |
| P1 | **Conversion-aware clientflow automation** | HoneyBook and Dubsado connect signed documents, invoices, and automations. | Add transparent trigger runs, delivery status, and recovery controls to existing automation rules rather than opaque background behavior. |
| P2 | **Operational margin intelligence** | Bonsai’s breadth includes budgets, rate cards, forecasting, and accounting integrations. | Expand the existing revenue forecast and receipt calculator into job-level estimated-versus-actual profitability and category reporting. |

## First implementation acceptance criteria

The current implementation milestone is complete only when a public booking photo can be uploaded through a short-lived, limited session and is stored against the correct owner, booking, and client after successful booking submission. The receipt OCR request must accept a photo record ID rather than an arbitrary remote URL and must reject non-receipt or cross-owner records. Existing authenticated owner uploads, portal browsing, and invoice integration must remain operational.

## Validation record

On August 25, 2026, TypeScript validation completed without errors and Vitest completed with 32 passing tests, including new coverage for token opacity, session-specific storage key validation, and owner receipt-path validation. The public booking and intake routes also rendered their expected safe unavailable-state screens after the upgrade. A final production checkout should still include a manual booking photo submission using an active hosted booking page and a real portal token, because those flows require live user-owned data and email/Stripe configuration.

### Reconciliation validation

After reconciling the concurrent hardening checkpoint, TypeScript completed without errors and the combined suite completed with **64 passing tests**. The public booking and intake routes again rendered their expected safe unavailable-state views; the restarted service scheduled all eight background jobs without startup failure. The remaining manual verification is intentionally limited to a real owner booking link and portal token because those flows require live, user-controlled data.

After the clean release branch merged into `main`, the same TypeScript and 64-test validation gate passed again. The service restart remained clean with eight scheduled background jobs, and the public booking fallback route rendered its intended unavailable state.

## Customer-friction research — source log

The public HoneyBook listing on Capterra reported a 4.7/5 aggregate rating from 32 reviews when accessed on August 25, 2026, and disclosed that a free version and free trial were not available on that listing. The page’s individual review route returned an error in this environment, so this metadata is treated only as context rather than evidence of a complaint pattern. Source: [Capterra HoneyBook listing](https://www.capterra.com/p/162588/HoneyBook/).

### Attributable complaint patterns — initial evidence

| Platform and source | Evidence observed | Cautious product interpretation |
|---|---|---|
| **Dubsado — Software Advice** | The review summary reported 4.2/5 overall and 3.7/5 ease of use across 61 reviews. Individual verified-review complaints included a substantial setup/learning burden, confusing or risky workflow configuration, slow or uneven help when an email connection failed, calendar limitations or booking conflicts, lack of folders/conditional workflow organization, and difficulty with regional tax/integration handling. [Software Advice](https://www.softwareadvice.com/business-management/dubsado-profile/reviews/) |
| **Dubsado — Capterra** | Capterra’s moderated review list repeated themes of a steep learning curve, automation anxiety, hard-to-understand invoice and payment-plan setup, client confusion during proposal payment, scheduler limitations, and imperfect team-calendar behavior. These are individual experiences, not product-wide incidence rates. [Capterra](https://www.capterra.com/p/206389/Dubsado/reviews/?page=2) |
| **17hats — Capterra** | Across 134 moderated reviews, individual complaints included difficult initial setup, a high learning curve, wait-based support, calendar behavior that did not meet expectations, basic bookkeeping/reporting, a less polished client portal, mobile limitations, and payment for feature additions. [Capterra](https://www.capterra.com/p/144328/17hats/reviews/) |
| **Moxie — Capterra and Millo** | Capterra’s listing had only one review at access time, so it is insufficient for generalization. Its 3/5 customer-service and value scores nevertheless suggest a verification area. A Millo hands-on review, which is affiliate-supported and therefore not neutral customer-review evidence, describes some modules as intentionally simple rather than deep. This is a hypothesis to validate, not a confirmed complaint pattern. [Capterra](https://www.capterra.com/p/10026264/Moxie/) [Millo](https://millo.co/moxie-app-review) |
| **Bonsai — secondary competitive analysis** | Workamajig’s comparison article attributes complaints to light-weight modules, fragile integration dependence, slow support, glitches, pricing/add-on frustration, and shallow financial reporting. Because the publisher sells a competing platform, these claims are treated as directional prompts to validate against primary review sites rather than decisive evidence. [Workamajig](https://www.workamajig.com/blog/bonsai-software-reviews) |

### Primary review-platform corroboration

| Platform | Verified-review observations | Design requirement for TrueAxis HQ |
|---|---|---|
| **HoneyBook** | G2 displayed 250 reviews with 4.5/5 at access time and summarized recurring issues as difficult customization, payment issues, limited features, integration gaps, and expense. Individual reviewers also cited desktop/mobile feature asymmetry, hard-to-find templates, cumulative screen-load latency, missing recurring scheduling, limited mobile functions, payment-processing trouble, and the burden of learning advanced features. Capterra’s 686-review page separately included complaints about price increases, higher-tier branding controls, integration setup, and mobile-only gaps. [G2](https://www.g2.com/products/honeybook/reviews) [Capterra](https://www.capterra.com/p/162588/HoneyBook/reviews/?page=2) |
| **Bonsai** | Capterra showed 95 reviews with 4.6/5 and 4.3/5 customer service at access time. Individual reviews cited non-transparent client-side currency, difficult non-USD reporting, payment/transaction fee and payout concerns, missing portal preview, limited role granularity, incomplete client-portal and QuickBooks behavior, manual multi-region tax settings, shallow project/reporting depth, mobile feature gaps, and plan-gated branding or advanced tools. [Capterra](https://www.capterra.com/p/238825/Bonsai/reviews/) [Capterra page 2](https://www.capterra.com/p/238825/Bonsai/reviews/?page=2) |

| **Moxie / former Hectic mobile app** | The accessible Google Play page confirmed that the mobile listing remains under the Hectic App developer identity and disclosed encrypted transit plus user-deletion request availability. It did not expose review text in this environment, so it cannot support a complaint claim. Search-result snippets indicate concerns worth validating—pricing changes and increased issues—but are not included as evidence until a review page yields inspectable review content. [Google Play](https://play.google.com/store/apps/details?id=com.hecticapp.mobile&hl=en_US) |

**Evidence boundary.** Review aggregators present individual, sometimes incentivized, experiences. They establish areas to investigate and design against; they do not establish failure rates or prove that every customer shares a complaint. TrueAxis HQ should therefore address the repeated workflow pattern, not copy any competitor’s feature list or make unsupported performance claims.

## Complaint-pattern synthesis and product response

The evidence supports a clear conclusion: independent businesses do not primarily complain that their operating platform has too few menu items. They complain when **configuration takes too long**, **automation feels unsafe or inexplicable**, **payment/scheduling/client handoffs create manual rescue work**, **mobile and client surfaces hide important context**, or **a price tier conceals a needed capability**. This pattern is visible in verified review-platform material for HoneyBook, Dubsado, Bonsai, and 17hats; Moxie has insufficient accessible review text for a comparative complaint conclusion. [G2 HoneyBook](https://www.g2.com/products/honeybook/reviews) [Capterra Dubsado](https://www.capterra.com/p/206389/Dubsado/reviews/?page=2) [Capterra Bonsai](https://www.capterra.com/p/238825/Bonsai/reviews/) [Capterra 17hats](https://www.capterra.com/p/144328/17hats/reviews/)

| Rank | Customer friction to solve | Why it is credible | TrueAxis HQ response | First delivery boundary |
|---|---|---|---|---|
| 1 | **Automation anxiety and opaque outcomes** | Dubsado reviews specifically describe workflows as confusing or risky; HoneyBook users mention exhaustion learning advanced capability. | Make each rule explainable before activation: a zero-side-effect preview should show trigger, wait, recipient/type, expected action, and configuration gaps. Preserve the existing delivery history for actual runs. | Add a secure `automations.preview` procedure plus an owner-only Preview surface; keep existing Test behavior clearly labeled as a side-effecting owner notification test. |
| 2 | **Slow activation and high setup burden** | Dubsado and 17hats reviews repeatedly cite weeks, videos, workarounds, or difficult initial configuration. | Continue vertical quick-start kits, but present every default as editable, explain why it exists, and add a setup health state rather than a generic progress bar. | Extend onboarding only after validating the present kit flow with real owners; do not create another large wizard prematurely. |
| 3 | **Client-facing confusion during payment, portal, and scheduling** | Reviews cite payment routing, hidden currency, limited portal preview, client payment confusion, booking conflict, and scattered mobile capability. | Build visible owner previews and explicit client-facing status/next steps. Continue current token-scoped portal and atomic booking protections. | A separate client-experience preflight is next after automation preview; it should not expose live client data or bypass portal tokens. |
| 4 | **Support-rescue dependency after an integration or delivery failure** | Dubsado, Bonsai, and 17hats reviews describe slow help or recovery work. | Improve in-product diagnosis: delivery state, actionable error copy, configuration health, and safe retry—not generic “contact support.” | SMTP readiness remains a configuration blocker; enhance only after credentials/delivery test are available. |
| 5 | **Role, finance, and regional complexity hidden under all-in-one claims** | Bonsai reviews cite permissions, multi-currency, reporting, and tier issues; Dubsado reviews cite tax/integration behavior. | Preserve explicit user scope, job-level attribution, role design, and clear pricing communication. | Research-owner interviews should determine which regional/role needs justify deeper implementation. |

### First build decision: Automation Preview

**Automation Preview** is the first implementation because it directly counters a repeated complaint without adding irreversible actions, requires no new secrets or external vendor connection, and improves a real surface that is already present. The feature will be owner-scoped and **read-only**: it will never send an email, create a follow-up, increment a run count, or write an execution log. Its purpose is to answer, before activation: “What will happen, when, to whom, and what is missing?”

#### Repeating friction signals to test against more sources

The strongest repeating signals so far are not missing feature categories. They are **high setup burden**, **opaque or risky automations**, **slow recovery from support or integration failure**, **unreliable scheduling/client-payment handoffs**, **weak mobile or portal experience**, and **surprise cost or shallow capability after onboarding**. The next research pass must validate each signal across additional independent review sources before it becomes a TrueAxis HQ roadmap commitment.


## 5/5 competitor benchmark extension

Current competitor positioning confirms that the state of the art is a connected client-to-cash workflow, not a pile of independent tools. Jobber’s Client Hub covers work requests, quote approvals, appointment details, invoice payments, receipts, and service requests; its broader product positioning includes quoting, scheduling, invoicing, CRM, and field-service operations. Housecall Pro emphasizes scheduling, recurring jobs, automated invoicing, dispatching, and technician notifications. [Jobber Client Hub](https://www.getjobber.com/features/client-hub/) [Jobber Features](https://www.getjobber.com/features/) [Housecall Pro Features](https://www.housecallpro.com/features/)

The resulting 5/5 requirements for TrueAxis HQ are measurable: an owner must be able to preview a client-facing journey before sharing it; a client must be able to understand the next state without contacting the owner; proof-of-work must connect estimate, scheduled work, progress, completion, invoice, and payment; mobile workflows must remain usable at the point of service; and billing/email/automation failures must expose a recoverable next action rather than silently failing. These requirements extend the existing roadmap and are now captured in the 5/5 scorecard.


## Refreshed evidence — August 2026

A current HoneyBook comparison page describes Dubsado as feature-rich but more complex to set up, while positioning HoneyBook around simpler onboarding and a more seamless client experience. This supports TrueAxis HQ’s measurable focus on setup clarity, preflight checks, and next-step guidance rather than a blanket superiority claim. Source: [HoneyBook, “Dubsado Alternatives: Best Picks Compared Feature by Feature”](https://www.honeybook.com/blog/dubsado-vs-honeybook), accessed August 25, 2026.

A second current client-portal comparison result emphasized that portal evaluation depends on more than feature count, especially client clarity and usability. The page was not available for reliable text extraction in this session, so it is treated as a research lead rather than evidence and is not used for a definitive claim. Source: [Storyflow, “Best Client Portal Software for Freelancers in 2026”](https://storyflow.so/blog/best-client-portal-software-freelancers-2026), accessed August 25, 2026.
