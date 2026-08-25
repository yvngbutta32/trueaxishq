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
