# TrueAxis HQ Competitive Scorecard — October 23, 2026 (10 competitors)

Full-scope comparison against 10 field-service platforms, scored from fresh
web-verified research (per-competitor fact files with sources in
`docs/working-notes/research/comp-2026-10/`) and our own live-verified
codebase state. Two honest views:

- **Product capability** — 14 categories, equal weight: what the software can do.
- **Market reality** — the same 14 plus **market traction & social proof**,
  where a pre-launch product is scored honestly against platforms with
  thousands of reviews.

TrueAxis HQ state (live-verified Oct 23): 34 routes (20 dashboard panels),
86 tRPC procedures + public REST API v1, 37 server-side plan gates, 86 tables,
835 tests green, tsc/lint/build/bundle gates clean, 0 production CVEs,
fresh-install + 132-combo live sweep proof. NOT yet deployed publicly;
SMS/email/payments/voice are code-complete but await owner credentials
(`bash scripts/verify-credentials.sh` gates each one live).

## Ratings by section (scores /10)

| Section | TrueAxis | Jobber | ServiceTitan | HCP | ServiceM8 | Buildertrend | Workiz | FieldPulse | GorillaDesk | Kickserv | Thryv | Service Fusion |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CRM & client management | 9 | 8 | 9 | 7 | 7 | 8 | 8 | 8 | 7 | 7 | 7 | 7 |
| Scheduling & dispatch | 9 | 9 | 10 | 8 | 8 | 8 | 8 | 8 | 8 | 7 | 7 | 8 |
| Quoting, proposals & e-sign | 9 | 8 | 10 | 9 | 8 | 8 | 7 | 9 | 7 | 7 | 6 | 7 |
| Invoicing & payments | 7 | 9 | 9 | 9 | 8 | 8 | 8 | 8 | 8 | 8 | 7 | 8 |
| Client portal & communication | 8 | 9 | 8 | 8 | 7 | 9 | 7 | 7 | 7 | 6 | 7 | 6 |
| Mobile & field experience | 8 | 9 | 7 | 8 | 9 | 7 | 7 | 6 | 7 | 5 | 5 | 5 |
| GPS tracking & routing | 9 | 7 | 9 | 7 | 7 | 6 | 7 | 7 | 7 | 5 | 5 | 5 |
| AI capabilities | 8 | 8 | 9 | 9 | 8 | 8 | 9 | 7 | 8 | 3 | 6 | 5 |
| Automation | 9 | 8 | 9 | 9 | 7 | 6 | 7 | 7 | 7 | 6 | 8 | 7 |
| Reporting & job costing | 8 | 7 | 10 | 7 | 7 | 9 | 7 | 7 | 7 | 6 | 7 | 7 |
| Integrations & ecosystem | 7 | 9 | 9 | 8 | 8 | 8 | 7 | 8 | 6 | 8 | 7 | 8 |
| Security & trust | 10 | 6 | 7 | 6 | 6 | 6 | 5 | 5 | 5 | 5 | 5 | 5 |
| Pricing & value | 10 | 7 | 3 | 5 | 9 | 4 | 5 | 5 | 8 | 8 | 4 | 6 |
| Ease of use & onboarding | 8 | 10 | 4 | 8 | 10 | 5 | 8 | 8 | 9 | 7 | 7 | 7 |
| Market traction & social proof | 1 | 9 | 8 | 9 | 7 | 8 | 7 | 7 | 6 | 6 | 8 | 6 |
| **Product capability (14)** | **8.5** | **8.1** | **8.1** | **7.7** | **7.8** | **7.1** | **7.1** | **7.1** | **7.2** | **6.3** | **6.3** | **6.5** |
| **Market reality (15)** | **8.0** | **8.2** | **8.1** | **7.8** | **7.7** | **7.2** | **7.1** | **7.1** | **7.1** | **6.3** | **6.4** | **6.5** |

## The honest headline

**Product capability: #1 of 12** (8.5). Market reality: **#3 of 12** (8.0),
behind Jobber (8.2) and ServiceTitan (8.1). The entire gap is one category:
market traction 1 vs their 7–9. Zero customers, zero G2/Capterra reviews, no
public deployment — every competitor beats us there today, and no feature
build closes it. Deploy + first 20 happy freelancers + review profiles do.

## Rankings

| Rank | Product capability | Market reality |
|---|---|---|
| 1 | **TrueAxis HQ 8.5** | Jobber 8.2 |
| 2 | Jobber 8.1 | ServiceTitan 8.1 |
| 3 | ServiceTitan 8.1 | **TrueAxis HQ 8.0** |
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
- **Invoicing & payments (7)**: Stripe Connect routing client money to each
  freelancer's own account, Tap-to-Pay, deposits, quote-to-cash on signature.
  Caveats: no ACH/BNPL/instant payouts yet; live keys pending.
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
3. **Payments breadth**: ACH, BNPL, instant payouts exist at Jobber/HCP
   today; ours is Stripe config work once live keys exist.
4. **QBO native sync**: Kickserv, FieldPulse, Service Fusion have deep
   bi-directional sync; our CSV export covers every tier but costs a manual
   step. Decided against OAuth at launch (5–10 day Intuit review) — revisit
   on customer demand.
5. **Proven at scale**: zero users have hammered our app; their complaints
   come from real usage at volume.
