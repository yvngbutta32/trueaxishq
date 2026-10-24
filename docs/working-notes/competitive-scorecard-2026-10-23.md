# TrueAxis HQ Competitive Scorecard — October 23, 2026 (10 competitors)

Full-scope comparison against 10 field-service platforms, scored from fresh
web-verified research (per-competitor fact files with sources in
`docs/working-notes/research/comp-2026-10/`) and our own live-verified
codebase state. Two honest views:

- **Product capability** — 14 categories, equal weight: what the software can do.
- **Market reality** — the same 14 plus **market traction & social proof**,
  where a pre-launch product is scored honestly against platforms with
  thousands of reviews.

TrueAxis HQ state (live-verified Oct 23, re-scored end-of-day at 07b389e):
35 routes (20 dashboard panels), 409 tRPC procedures + public REST API v1,
37 server-side plan gates, 88 tables, 89 migrations, 916 tests green,
tsc/lint/build clean, 0 production CVEs, fresh-install proof + 51 live e2e
checks across 4 suites (voice, QR labels, PO costing, QBO gate). NOT yet
deployed publicly; SMS/email/payments/voice are code-complete but await
owner credentials (`bash scripts/verify-credentials.sh` gates each one live).

**End-of-day re-score:** the full dominance roadmap shipped after the morning
snapshot (voice hardening + 10 languages, QR asset labels, PO job costing,
QBO demand gate, plus the fresh-install/migration audit). Two categories move,
from live-verified shipped code only:

- **AI capabilities 8 → 9**: the voice receptionist is now grounded (tool
  contract, no invented prices/slots), honest (mandatory AI disclosure,
  press-zero always works or honest voicemail), and 10-language (research
  verified only ServiceTitan offers bilingual, via Smith.ai at extra cost).
  Per our own review-mining, AI voice is the category's only *proven* AI
  feature, and ours implements every failure mode the research found.
  Caveat: proven in signed-webhook e2e against a mock LLM; live on a real
  deployment it needs Twilio + LLM credentials (same caveat competitors'
  marketing-claim scores carry, minus their pricing).
- **Reporting & job costing 8 → 9**: PO-to-job linking, materials cost
  roll-up with unit-cost snapshots (later receipts can't rewrite old jobs),
  portfolio cost report and CSV export — the exact feature Jobber users cite
  as their #1 unfulfilled request. Works at $0, no provider needed.
  ServiceTitan keeps 10 (enterprise-grade costing); we tie Buildertrend at 9.

Updated totals: **Product capability 8.7 (#1 of 12)**. **Market reality 8.2 —
tied with Jobber at the top, ahead of ServiceTitan 8.1.** That tie is exact
arithmetic, not optimism: our product lead (+0.6 over Jobber) exactly cancels
their traction lead (9 vs our 1). Read it honestly: it is *deployed potential*
— until there is a public deployment, real customers, and G2/Capterra reviews,
traction stays 1/10 and no feature build moves it.

## Ratings by section (scores /10)

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

## The honest headline (end-of-day re-score)

**Product capability: #1 of 12** (8.7, up from 8.6 — the dominance roadmap
shipped). Market reality: **tied #1 with Jobber** (8.2), ahead of
ServiceTitan (8.1). The tie is arithmetic: our product lead cancels their
traction lead. But traction is the only score that compounds on its own and
the only one we cannot build: zero customers, zero G2/Capterra reviews, no
public deployment. Every competitor beats us there today, and their product
scores can rise with each release too. The tie only becomes real with:
deploy (blocked on owner credentials/domain), first 20 happy freelancers,
then review velocity.

## Rankings

| Rank | Product capability | Market reality |
|---|---|---|
| 1 | **TrueAxis HQ 8.7** | **TrueAxis HQ 8.2 (tied, pre-launch)** |
| 2 | Jobber 8.1 | Jobber 8.2 (tied) |
| 3 | ServiceTitan 8.1 | ServiceTitan 8.1 |
| 4 | ServiceM8 7.8 | Housecall Pro 7.8 |
| 5 | Housecall Pro 7.7 | ServiceM8 7.7 |
| 6 | GorillaDesk 7.2 | Buildertrend 7.2 |
| 7 | Workiz / FieldPulse / Buildertrend 7.1 | Workiz / FieldPulse / GorillaDesk 7.1 |
| 8 | Service Fusion 6.5 | Service Fusion 6.5 |
| 9 | Kickserv 6.3 / Thryv 6.3 | Thryv 6.4 |
| 10 | — | Kickserv 6.3 |

## Score rationale (TrueAxis) — with honest caveats

- **Security & trust (10)**: TOTP 2FA, jti sessions, rate limiting, CSP/HSTS,
  signed webhooks, audit log, 835-test CI gate, 0 CVEs, evidence-boundary
  tests. No competitor markets anything comparable.
- **Pricing & value (10)**: $49/$129/$299 unlimited users, no contracts, no
  add-on paywalls. Verified Oct 23: Jobber paywalls texting to $139+ and API
  to $499; HCP gates API to MAX $329; ServiceTitan runs $5k–$50k setup with
  multi-year lock-in. A 10-person crew pays us $129–299 total; Jobber
  $249–499; HCP $329+.
- **GPS tracking & routing (9)**: public /track links, consented pings,
  arrival auto-revoke, route optimizer. Caveat: straight-line optimizer, not
  turn-by-turn; competitors' GPS is often a paid add-on ($20–25/vehicle at
  Service Fusion).
- **AI (8)**: DIY TwiML voice receptionist code-complete (conversation
  engine, lead capture, voicemail all plans, managed lines with fair-use
  minutes) + chat assistant + Client Pulse. **Caveat: not live until Twilio +
  Gemini keys.** Competitors' AI voice is live today but priced: Jobber
  Receptionist $29–99/mo, ServiceM8 Phone Agent $49/mo, Workiz Genius
  Answering add-on, ServiceTitan ~$2.75/call.
- **Invoicing & payments (8)**: Stripe Connect routing client money to each
  freelancer's own account, Tap-to-Pay, deposits, quote-to-cash on signature.
  Oct 23: ACH (us_bank_account) + Klarna + Afterpay wired into all four
  client-money checkouts and ACH into SaaS subscription checkout, with a
  card-only fallback so no checkout ever breaks (payment-method eligibility
  is per-account dashboard config — free). Instant payouts (1%) are
  connected-account config. Caveat: lights up when live keys + dashboard
  methods are enabled.
- **Market traction & social proof (1)**: the honest gap. Not deployed, zero
  reviews, no app-store presence.

## Competitor reference (verified Oct 23, sources in research/comp-2026-10/)

| Platform | Entry price | AI voice status | G2 / Capterra | #1 complaint |
|---|---|---|---|---|
| Jobber | Core $49 (1 user); texting $139+; API $499 | Receptionist $29–99/mo add-on | 4.6 (530) / 4.6 (1,487) | QBO sync bugs, per-user fees, tier gating |
| ServiceTitan | ~$245–500/tech/mo + $5k–50k setup, 12–36 mo contracts | TI Voice live, ~$2.75/call | 4.4 (374) / 4.3 (342) | TCO + lock-in, forced new field app |
| Housecall Pro | $79 / $189 / $329 (+$35/user past 8); API = MAX | CSR AI paid add-on | 4.3 (190) / 4.7 (2,700+) | Peak-hour slowness, Android bugs, payout holds |
| ServiceM8 | Job-volume $29–349/mo, unlimited users | Phone Agent $49/mo add-on | 3.8 (15) / 4.5 (311) | Job-cap tier jumps, weak Android |
| Buildertrend | ~$499–1,500+/mo | AI suite incl. Advanced/Complete | 4.3 (231) / 4.5 (2,487) | Price hikes, learning curve, export pain |
| Workiz | Quote-only, ~$187–229 base + $55–65/seat | Genius Answering (built-in telephony) | 4.5 (238) / 4.4 (218) | Opaque pricing, pay-per-use fee stack |
| FieldPulse | ~$89–99/full seat/mo | Operator AI add-on, Maverick incl. | 4.7 (376) / 4.6 (506) | Mobile glitches, QBO duplicate syncs |
| GorillaDesk | $49/$99/$149 per route, free admin seats | AI receptionist + route AI included | 4.8 (43) / 4.8 (278) | SMS add-on costs, tools paywalled to Pro |
| Kickserv | $60/$119/$199 bundled users | None | 4.5 (181) / 4.4 (387) | Outdated mobile (Android ~2.8), rigid tiers |
| Thryv | $99–646+/mo + $250–490 onboarding, 6–18 mo contracts | Drafting assistant only, no voice | 4.2 (~2,050) / 4.2 (538) | Contracts, auto-renewals, cancellation penalties |
| Service Fusion | $208–533/mo flat + implementation fee | ServiceCall.ai ~$150/mo add-on | 4.1 (124) / 4.3 (308) | Android crashes, GPS $20–25/vehicle |

## Where the market still beats us (no spin)

1. **Traction** (job 1: deploy, win first customers, collect reviews — every
   competitor has a 3–5 year head start).
2. **Native app stores** (their iOS/Android apps have 100s–1,000s of reviews;
   our PWA is better-engineered offline but invisible in stores until we
   publish wrappers).
3. ~~Payments breadth~~ CLOSED Oct 23: ACH + Klarna + Afterpay now wired
   into every checkout with honest card-only fallback; instant payouts are
   connected-account config (1% fee, docs.stripe.com/connect/instant-payouts).
   Remaining difference is purely activation, not code.
4. **QBO native sync**: Kickserv, FieldPulse, Service Fusion have deep
   bi-directional sync; our CSV export covers every tier but costs a manual
   step. Decided against OAuth at launch (5–10 day Intuit review) — revisit
   on customer demand.
5. **Proven at scale**: zero users have hammered our app; their complaints
   come from real usage at volume.
