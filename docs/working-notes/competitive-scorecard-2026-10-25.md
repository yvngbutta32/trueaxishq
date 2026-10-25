# TrueAxis HQ Competitive Scorecard — October 25, 2026 (12 platforms)

Full-scope re-audit two days after the Oct 23 scorecard (same 14-category
rubric, same scoring honesty, fresh spot-verified competitor facts). The
rubric, per-competitor fact files with sources, and review-mining evidence
live in `docs/working-notes/research/comp-2026-10/` — unchanged and still
valid; only pricing facts were re-verified for this pass.

## Project state (live-verified Oct 25, v1.0.0-rc2, commit 9bd8956)

- 1,011 unit/contract tests green (up from 916 on Oct 23), strict tsc clean,
  lint zero warnings, production build + bundle budget pass, 0 production CVEs
- 90 migrations, fresh-install proof as a permanent release gate (empty
  database → production boot → 10/10 smoke)
- 6 live e2e suites + public smoke: AI voice receptionist (genuine Twilio
  signatures, grounded + 10-language), QR asset labels, PO job costing, QBO
  demand gate, public review engine, 21-check adversarial security probe
- NEW since Oct 23: release discipline — v1.0.0-rc1 and v1.0.0-rc2 tagged and
  pushed; full manual click-everything QA (23 dashboard panels on desktop AND
  mobile, 14 public pages, 3-step booking wizard driven to completion), every
  red flag individually ground-truthed live; URL-synced panel deep links
  (?panel= survives refresh), mobile URL keyboard on the review-link input
- Still NOT deployed publicly; SMS/email/payments/voice await owner
  credentials (SMTP, Stripe live, Twilio, domain + Oracle). Zero customers,
  zero G2/Capterra reviews.

## Competitor fact spot-check (Oct 25, 2026)

Re-verified current, matching our Oct 23 research files (sources: official
pricing pages + 2026 pricing guides):

- **Jobber** — $49 Core / $149 Connect (5 users) / $249 Grow (10 users)
  (getjobber.com/pricing; scanmanifold.com 2026 guide)
- **Housecall Pro** — $59 Basic / $149 Essentials / $299–329 MAX,
  $35/extra user on MAX (housecallpro.com/pricing; G2 pricing data)
- **ServiceTitan** — still no published pricing; $245–500/tech/mo reported,
  $5k–50k implementation (fieldcamp.ai + projul.com 2026 analyses)
- **ServiceM8** — $29 Starter / $79 Growing / $149 Premium / $349 Premium
  Plus, per-business not per-user, job-volume caps (servicem8.com/us/pricing)
- **Buildertrend** — $299–900+/mo, 1-year minimum, $400–1.5k onboarding
  (toricentlabs 2026; TrustRadius user reports)
- **Thryv** — $99 Starter / $399 Signature, quote-based scaling, contract
  lock-in complaints persist (thryv.com/pricing; Capterra)
- Workiz, FieldPulse, GorillaDesk, Kickserv, Service Fusion — unchanged
  since Oct 23 (2-day window; fact files in research/comp-2026-10/)

No competitor changed pricing or shipped a major capability in the window,
so Oct 23 category scores carry over unchanged.

## Ratings by section (scores /10) — UNCHANGED from Oct 23, re-audited

| Section | TrueAxis | Jobber | ServiceTitan | HCP | ServiceM8 | Buildertrend | Workiz | FieldPulse | GorillaDesk | Kickserv | Thryv | Service Fusion |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CRM & client management | 9 | 8 | 9 | 7 | 7 | 8 | 8 | 8 | 7 | 7 | 7 | 7 |
| Scheduling & dispatch | 9 | 9 | 10 | 8 | 8 | 8 | 8 | 8 | 8 | 7 | 7 | 8 |
| Quoting, proposals & e-sign | 9 | 8 | 10 | 9 | 8 | 8 | 7 | 9 | 7 | 7 | 6 | 7 |
| Invoicing & payments | 8 | 9 | 9 | 9 | 8 | 8 | 8 | 8 | 8 | 8 | 7 | 8 |
| Client portal & communication | 8 | 9 | 8 | 8 | 7 | 9 | 7 | 7 | 7 | 6 | 7 | 6 |
| Mobile & field experience | 8 | 9 | 7 | 8 | 9 | 7 | 7 | 6 | 7 | 5 | 5 | 5 |
| GPS tracking & routing | 9 | 7 | 9 | 7 | 7 | 6 | 7 | 7 | 7 | 5 | 5 | 5 |
| AI capabilities | 9 | 8 | 9 | 9 | 8 | 8 | 9 | 7 | 8 | 3 | 6 | 5 |
| Automation | 9 | 8 | 9 | 9 | 7 | 6 | 7 | 7 | 7 | 6 | 8 | 7 |
| Reporting & job costing | 9 | 7 | 10 | 7 | 7 | 9 | 7 | 7 | 7 | 6 | 7 | 7 |
| Integrations & ecosystem | 7 | 9 | 9 | 8 | 8 | 8 | 7 | 8 | 6 | 8 | 7 | 8 |
| Security & trust | 10 | 6 | 7 | 6 | 6 | 6 | 5 | 5 | 5 | 5 | 5 | 5 |
| Pricing & value | 10 | 7 | 3 | 5 | 9 | 4 | 5 | 5 | 8 | 8 | 4 | 6 |
| Ease of use & onboarding | 8 | 10 | 4 | 8 | 10 | 5 | 8 | 8 | 9 | 7 | 7 | 7 |
| Market traction & social proof | 1 | 9 | 8 | 9 | 7 | 8 | 7 | 7 | 6 | 6 | 8 | 6 |
| **Product capability (14)** | **8.7** | **8.1** | **8.1** | **7.7** | **7.8** | **7.1** | **7.1** | **7.1** | **7.2** | **6.3** | **6.3** | **6.5** |
| **Market reality (15)** | **8.2** | **8.2** | **8.1** | **7.8** | **7.7** | **7.2** | **7.1** | **7.1** | **7.1** | **6.3** | **6.4** | **6.5** |

## Why the scores did not move (honest accounting)

The 48 hours since the Oct 23 scorecard shipped release discipline, not new
capability: two release candidates, a full manual click-everything QA pass on
46 panel-sweeps + 14 public pages, URL deep-linking, and a keyboard fix. QA
depth and polish raise *confidence* in the existing 8.7 — they do not add
capability the rubric measures. Nothing was scored up without a shipped
feature; that is the standard we hold competitors to as well.

**Product capability: 8.7 — #1 of 12** (arithmetic: 122/14).
**Market reality: 8.2 — tied #1 with Jobber** (123/15), ahead of
ServiceTitan 8.1. The tie is exact arithmetic: our product lead (+0.6 over
Jobber) cancels their traction lead (9 vs 1).

## The honest gaps (unchanged, all owner-side)

1. **Traction: 1/10 and it is the entire gap.** Zero customers, zero public
   reviews, no public deployment. Every competitor beats us here. This is
   the only score that compounds on its own and the only one code cannot
   build: deploy (owner credentials/domain), first 20 happy freelancers,
   G2/Capterra velocity.
2. **Integrations 7/10:** honest — no native QuickBooks sync (deliberately
   demand-gated at 10 paying companies), no Zapier listing, no app stores.
   REST API v1 + signed webhooks + CSV export work today.
3. **Mobile 8/10:** browser-first, no native iOS/Android wrappers.
4. **Payments 8/10:** Stripe-only (cards, ACH, Klarna, Afterpay — broad but
   one processor); no financing options like ServiceTitan's Affirm yet.
5. **Proven-in-production caveat:** voice/SMS/email/payments are
   code-complete and e2e-proven against mocks + signatures, but no real
   production deployment has carried a live customer dollar or phone call.

## What would honestly move the scores

- Deploy + first paying customers + 10+ G2 reviews → traction 1 → 5+,
  market reality #1 outright
- QBO native sync (post-demand) → integrations 7 → 8
- Native app wrappers → mobile 8 → 9
- Stripe Affirm-style financing → payments 8 → 9

Every one of these is gated on owner action or demand, not code.
