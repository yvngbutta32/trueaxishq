# TrueAxis HQ Dominance Roadmap — October 23, 2026

**Method**: every claim below is sourced from fact files in
`docs/working-notes/research/comp-2026-10/` (13 platforms deep-dived, market
census, review mining, AI-receptionist landscape, feature matrices — 9 research
agents + direct verification, Oct 23 2026). Standing directive honored: facts
and proven examples only, no hype.

**Where we stand today** (competitive-scorecard-2026-10-23.md): product
capability **8.6 — #1 of 12**. Market reality **8.1 — #3**, behind Jobber (8.2)
and ServiceTitan (8.1). The entire gap is the Traction category (1/10 vs 7-9:
zero customers, zero reviews, not deployed).

**Market structure** (census): global FSM software $5.1–6.6B in 2026, growing
10.7–12.5%/yr. Fragmented — top 5 hold <35%. ServiceTitan 15–18%, Thryv 4–5%,
Jobber 3–5%, HCP 2–4%, Buildertrend 2–3%. Dominance is achievable in the
freelancer/small-crew segment precisely because nobody owns it.

---

## Part 1 — How to surpass each competitor (all verified)

### 1. Jobber (the real rival: $1.5B val, ~$150M ARR, 4.6/5 support)
Their verified edge: Client Hub polish, Copilot AI coach, 4.6/5 support.
Their verified cracks (review-mining + jobber-deep):
- ~30% of negative reviews = tier hikes/add-on paywalls; 2-way SMS at $139+/mo,
  Open API at $499/mo (their own pricing pages).
- Offline is VIEW-ONLY on mobile — no editing, no invoicing.
- **No native inventory/purchase-order job costing** — their users' #1 request.
Surpass plan:
- **Build**: parts inventory + PO job costing (their #1 request, unfulfilled;
  we already have inventory/POs in Tier 2 scope — finish job-costing roll-up).
- **Market**: the paywall math table (their $139 texting + $29 receptionist vs
  our $49 Starter with both included = ~$120/mo savings documented).
- **Support**: they win on support reputation; our counter is being the product
  that never needs support (honest errors, first-hour guarantee, no lock-in).

### 2. ServiceTitan (enterprise, 15–18% share — do NOT fight head-on)
Their verified edge: Dispatch Pro (~6% drive-time cut), Pricebook Pro
benchmarks, Affirm financing (12% higher close rates), $1.1B revenue.
Their verified cracks: $245–500/tech/mo + $5k–50k setup, 2–16 week onboarding,
~40% of negative reviews = price/increases, documented exodus of 2–15 tech
crews to FieldPulse/Projul/HCP/Jobber to save $8–15k+/yr.
Surpass plan:
- **Position**: the landing zone for "ServiceTitan refugees" — $49–299 flat,
  unlimited users, 60-minute onboarding, month-to-month. Their churn is our
  acquisition channel.
- **Build later**: consumer financing (Affirm-class) — proven 12% close-rate
  lift; Stripe supports it, wire when volume justifies.

### 3. Housecall Pro ($1.1B val, ~$100M ARR)
Their verified edge: Sales Builder visual proposals, mature marketing
automation (postcards), 4.7/5 mobile app.
Their verified cracks: Android latency/crashes vs iOS, QBO gated to $149/mo
tier with duplicate bugs, payout holds, MAX overage $35/user, multi-branch
management is their users' #1 request.
Surpass plan:
- **Ship**: Agency sub-accounts (done, Oct 9) — directly answers their users'
  most-requested feature.
- **Market**: "works identically on every phone" (PWA, no Android second class).

### 4. ServiceM8 (job-volume pricing, iOS-first)
Their verified edge: flawless iOS UX, QR asset check-ins, Xero/MYOB depth,
$0–29 entry.
Their verified cracks: Android is stripped-down (~35% of negative reviews),
job-tier overage friction, weak multi-day projects.
Surpass plan:
- **Already beat them**: unlimited jobs vs job quotas, full offline editing on
  any device, flat pricing, Agency plan.
- **Build**: QR asset check-in labels on client equipment (their signature
  feature; our inventory system is the natural home — small build, big moat).

### 5. Buildertrend (construction, PE-backed ~$150M rev)
Their verified edge: Selections/Change Orders, Gantt for long projects, AI
job costing.
Their verified cracks: $399–499 base, quotes hitting $15–17k/yr, **subcontractor
portal adoption friction is a top-3 complaint** — subs refuse account
registration; mobile slowness.
Surpass plan:
- **Already beat them**: our sub-contractor flow is a **no-login token link**
  (scope-only projection) — literally Buildertrend's users' #1 request
  ("magic-link / no-login options").
- **Market**: construction-lite for small GCs (hybrid phases cover multi-day).

### 6. Workiz (VoIP-native)
Their edge: Genius Phone embedded telephony, multilingual Genius Answering.
Their cracks: opaque sales-gated pricing, per-minute/SMS/AI-token add-ons,
sync lag.
Surpass plan: transparent bundled minutes (300/1000/2500) with honest meters —
their users' #1 request is transparent all-in pricing.

### 7. FieldPulse (ClearPath workflows)
Their edge: customizable pipelines, advanced estimating.
Their cracks: steep setup curve, quote-gated pricing, QBO Desktop sync errors.
Surpass plan: first-hour onboarding guarantee vs their setup curve; publish
pricing (we always have).

### 8. GorillaDesk ($49–149 per ROUTE, included AI)
Their edge: route-clustering scheduling, Job Magnet lead widget, included Maya AI.
Their cracks: useless for non-route/complex jobs, basic reporting.
Surpass plan: our route optimizer + recurring invoices cover route work;
complex-job support is the wedge they can't do.

### 9. Kickserv / 10. Thryv / 11. Service Fusion
- Kickserv: Android 2.5 stars, 20-user cap. Beat: reliability + unlimited users.
- Thryv: 6–18 month contracts + cancellation fees (their users' #1 complaint is
  the lock). Beat: month-to-month, cancel anytime, $0 fixed cost guarantee.
- Service Fusion: flat pricing like ours but at $208+/mo with glitchy Android
  and add-on creep. Beat: price + reliability.

### 12. Contractor Foreman ($49–148) — the closest value player
Watch list, not a build driver: our included AI voice + SMS + payments breadth
is beyond their scope.

---

## Part 2 — Market-wide plays (from the whitespace + review-mining data)

The five biggest documented SMB pains, and our answer:

| Documented pain (source) | Our answer | Status |
|---|---|---|
| Per-seat cost spikes ($29–400/tech) | Unlimited users, flat $49–299 | shipped |
| Fragile mobile offline sync | Offline Field Mode with edit/invoice + retry | shipped |
| Sub permissions exposing data | Scope-only no-login sub links | shipped |
| After-hours lead drop-off (>40% missed calls) | AI voice receptionist + SMS, bundled | built, needs creds |
| Add-on paywall bloat ($29–99/mo each) | Everything included, honest meters | shipped |

**The proven AI wedge** (ai-receptionist-landscape-2026.md): 24/7 voice
answering is the one AI feature PROVEN in production (25–50% booking rates on
missed calls, 80–85% containment at ServiceTitan; >80% of homeowners hang up
on voicemail). Our DIY stack costs ~$0.018/min vs $29–300/mo vendor add-ons.
Hype to avoid (verified): unsupervised AI auto-dispatch and photo-based AI
quote estimators — high error rates. We already don't have them. Keep it that way.

**Three engineering mandates for the voice agent** (documented failure modes):
1. Never hallucinate slots/prices — every date/price answer must be grounded
   in real availability from our DB (add a grounding test before launch).
2. Always disclose it's AI (homeowners accept AI that discloses; they punish
   deception).
3. Instant human transfer path (their #3 failure = dropped emergency transfers).
Plus: **Spanish**. ST and Smith.ai are the only verified bilingual vendors;
Jobber/HCP/ServiceM8 are English-first. Gemini handles Spanish at the same
$0.018/min — a free differentiator against the whole SMB field.

**QBO reconsideration** (flagged, decision pending): QuickBooks sync errors
appear in the top-3 complaints of Jobber, HCP, FieldPulse, Kickserv, and
Service Fusion — it is the single most-cited recurring pain in the entire
review-mining data. We deliberately deferred native QBO at launch. Post-
launch, when ≥10 paying users ask, native QBO sync (not CSV) is the highest-
demand integration in the market. Keep CSV export until then.

---

## Part 3 — The truthful part: product dominance ≠ market dominance

We are already #1 on product capability (8.6, machine-verified). Nobody buys a
scorecard. The honest sequence to actual dominance:

1. **Deploy. (BLOCKED — owner credentials form pending since Oct 16.)**
   Nothing else in this document is real until the app is live. SMTP, Stripe
   live, Twilio, domain + Oracle deploy. This is the entire critical path.
2. **First 20 design partners from documented switch pools.** The research
   names exactly who is switching and why: ST refugees (2–15 techs fleeing
   $8–15k/yr), Jobber escapees (per-seat jumps + paywalls), Buildertrend
   GCs (sub friction), ServiceM8 Android crews. Our import wizard already
   parses all their export formats.
3. **Review velocity.** G2/Capterra profiles from day one; every platform's
   praise section is dominated by support quality — answer fast, ask every
   happy user. Traction is the one category we score 1/10 on and it is only
   earned, never built.
4. **Comparison content** targeting the documented switch searches
   ("Jobber pricing increase", "ServiceTitan alternative for small crew").
5. **Then the Part 1/2 moats compound** — every month we hold the honest-
   pricing + included-AI position while competitors raise prices (documented
   2026 hikes at Jobber/HCP/Buildertrend/ST), our position strengthens.

**Threats to monitor** (census): vertical voice-AI layers (Slang.ai-class),
Angi/Thumbtack adding dispatch SaaS, Google LSA + Gemini local dispatch. Our
defense: they all monetize per-lead/per-minute; our $0-fixed + flat pricing is
the structural counter.

## Build queue (code, in priority order)
1. Voice-agent grounding test (no hallucinated slots/prices) + AI disclosure +
   human-transfer path + Spanish option — hardens the proven wedge.
2. QR asset check-in labels (ServiceM8's signature; extends our inventory).
3. PO job costing roll-up (Jobber's #1 unfulfilled request).
4. (Post-launch, demand-gated) Native QBO sync — the market's #1 pain.
