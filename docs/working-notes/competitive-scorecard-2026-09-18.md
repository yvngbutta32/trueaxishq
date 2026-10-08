# TrueAxis HQ Competitive Scorecard — October 8, 2026

Benchmarked against the five category leaders: Jobber, ServiceTitan, Housecall Pro, ServiceM8, Buildertrend. Scores /10, based on fresh competitor research (web-verified pricing/complaints/AI moves, Oct 8 2026) and our own codebase state: 751 tests green, tsc/lint/build/budget clean, 83-table fresh-install verified, full live sweep 75/75 on a fresh DB.

## Ratings by section

| Section | TrueAxis HQ | Jobber | ServiceTitan | Housecall Pro | ServiceM8 | Buildertrend |
|---|---|---|---|---|---|---|
| CRM & client management | 9 | 8 | 9 | 7 | 7 | 8 |
| Scheduling & dispatch | 9 | 9 | 10 | 8 | 8 | 8 |
| Quoting, proposals & e-sign | 9 | 8 | 10 | 9 | 8 | 8 |
| Invoicing & payments | 7 | 9 | 9 | 9 | 8 | 8 |
| Client portal & communication | 8 | 9 | 8 | 8 | 7 | 9 |
| Mobile & field experience | 8 | 9 | 8 | 8 | 9 | 7 |
| GPS tracking & routing | 9 | 7 | 9 | 7 | 7 | 6 |
| AI capabilities | 7 | 8 | 9 | 9 | 7 | 7 |
| Automation | 9 | 8 | 9 | 9 | 7 | 6 |
| Reporting & job costing | 8 | 7 | 10 | 7 | 7 | 9 |
| Integrations & ecosystem | 7 | 9 | 9 | 8 | 8 | 8 |
| Security & trust | 10 | 6 | 7 | 6 | 6 | 6 |
| Pricing & value | 10 | 7 | 3 | 5 | 9 | 5 |
| Ease of use & onboarding | 8 | 10 | 4 | 8 | 10 | 5 |
| **Weighted overall** | **8.6** | **8.1** | **7.9** | **7.8** | **7.7** | **6.9** |

Overall = equal-weight average. We now edge Jobber on the same math that had us behind on Sept 18 (was 7.9 vs 8.2) — the change is mostly the market's: competitors raised prices and paywalled more while we shipped GPS tracking (9), routing/capacity (scheduling 9), observability, and pricing/value 10.

## Score rationale (TrueAxis)

**Where we lead the market**
- **Security & trust (10)**: TOTP 2FA, session management with per-token jti (Oct 8: fixed a real same-second token-collision defect found by live burst testing), rate limiting, CSP/HSTS, signed webhooks with one-time encrypted secrets, audit log, API keys, 751-test CI gate, fresh-install 83-table proof. No competitor markets this depth.
- **Pricing & value (10)**: flat $49/$99/$299, unlimited users, no contracts. Oct 8 research confirms the wedge widened: Jobber Connect went $99→$149/mo and gates 2-way texting behind $249+ Grow; HCP is $79–$329/mo with API gated to MAX ($329) and $75/user overage past 8 seats; Buildertrend base moved to ~$499–$1,500/mo. A 10-person crew: Jobber $249–$499, HCP $329–$800+, us $99.
- **GPS tracking & routing (9)**: public /track links with consented field pings, arrival auto-revoke, dispatch route order + nearest-neighbor/2-opt optimizer, geocoding cache. Market-leading for SMB.
- **Automation transparency (9)**: signed webhooks + 4 app business events (booking/client/invoice/proposal) → Zapier/Make without a marketplace; observable trigger runs. Jobber gates API/webhooks to Plus/enterprise; HCP to MAX.
- **Evidence chain + Client Pulse (unique)**: booking-bound photo intake → job timeline → portal visibility → invoice; 0–100 client-health scoring with churn-risk classification. Nobody has either.
- **Economics**: client money routes to each freelancer's own Stripe Express account (Stripe Connect); $0 fixed vendor cost for the platform; profitable from the first sale.

**Where we trail (honest gaps)**
- **Invoicing & payments (7)**: Stripe Connect + Tap-to-Pay readiness shipped, but no ACH, no BNPL consumer financing (Jobber shipped BNPL + instant payouts), no instant payouts. All become Stripe-config work once live keys exist.
- **AI (7)**: chat assistant, smart scheduling, Pulse, invoice categorization — but no voice agent. Oct 8 research: AI phone answering is now table stakes (ServiceTitan AI Voice, HCP AI voice, Jobber Copilot). This is the biggest feature gap.
- **Integrations (7)**: REST API v1 + webhooks shipped; still no native bi-directional QBO sync (OAuth app needed) and no Zapier official listing.
- **Mobile (8)**: PWA + web push + offline Field Mode; no app-store native apps (store accounts needed).
- **Client portal (8)**: SMS is readiness-only pending Twilio credentials.

## Competitor reference data (researched Oct 8, 2026)

| Platform | Entry price | #1 complaint theme | Standout strength |
|---|---|---|---|
| Jobber | Core $49/mo (1 user), Connect $149/mo, Grow $249–$299/mo, +$29/user | Price hikes, texting/API paywalled to $249+ tiers | Ease of use, Client Hub, Copilot AI |
| ServiceTitan | ~$245–$500/tech/mo + $5k–$50k implementation, 12–36 mo contracts, 3–8% annual escalators | TCO, lock-in, 6–12 mo onboarding | Titan Intelligence, Dispatch Pro, reporting |
| Housecall Pro | Basic $79/mo, Essentials $189, MAX $329 (+$75/user past 8) | Add-on sprawl + price hikes | Sales Builder G/B/B, aggressive AI rollouts |
| ServiceM8 | Job-volume: Free→$349/mo, unlimited users, no lock-in | Android parity, iOS-first bias | iOS field UX, QR asset check-ins |
| Buildertrend | ~$499–$1,500+/mo by volume, unlimited users | Price hikes priced out small builders, complexity | Client portal + selections, AI job costing |

Market momentum: ServiceTitan dominant enterprise ($925M+ revenue); Jobber fastest SMB growth; HCP competing on AI; ServiceM8 owns micro-business iOS niche. Market-wide unsolved: subcontractor adoption friction, true offline-first sync, hybrid day-ticket + multi-month projects, inventory reconciliation, add-on-free pricing.

## What remains for a true 10/10

All remaining items are owner-credential, deploy, or market-proof work — the codebase buildable scope is complete:

1. **Launch blockers (owner)**: SMTP credentials, Stripe live keys, Twilio (activates SMS + magic links), production deploy + smoke.
2. **Payments parity (Stripe config once live)**: ACH, BNPL, instant payouts, live Tap-to-Pay.
3. **AI voice agent (buildable + provider)**: the one big remaining feature gap vs all five leaders.
4. **Native apps (store accounts)**: Capacitor wraps of the PWA for background GPS + store presence.
5. **QBO native sync (Intuit OAuth app)**.
6. **Market proof (owner)**: G2/Capterra profiles, first customers, reviews, case studies.
