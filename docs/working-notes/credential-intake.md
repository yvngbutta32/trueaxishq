# TrueAxis HQ — Launch Credential Intake Playbook

Everything in this document is fact-checked (Oct 2026) with sources in
`docs/working-notes/research/`. The app is code-complete; every remaining
launch item is an owner account or credential. Zero fixed cost is preserved:
every pick below is free-tier or pure usage-based.

**The moment any credential lands:** put it in `.env`, then run

```bash
bash scripts/verify-credentials.sh
```

Each provider is live-probed against the real service — never mocked — and
prints PASS/FAIL plus exactly what it unlocked. Nothing ships with dead keys.

## What unlocks what (verified)

| Credential | Unlocks | Fixed cost | Source |
| --- | --- | --- | --- |
| `SMTP_*` (Brevo) | Email confirmations, invoices, password resets, magic links | $0 — 300/day free, no credit card | research-smtp-provider.md |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | SaaS subscriptions + client Connect payments | $0 — 2.9%+30¢ per transaction, usage only | research-stripe-golive.md |
| `TWILIO_ACCOUNT_SID/AUTH_TOKEN` (+ from number) | SMS confirmations, reminders, magic links, AI voice receptionist | $0 fixed — per-segment/minute usage | research-twilio-activation.md |
| `BUILT_IN_FORGE_API_URL/KEY` (Gemini) | AI assistant + voice conversation engine | $0 — free tier needs no credit card | research-gemini-qbo.md |
| `GOOGLE_CLIENT_ID/SECRET` | Native Google Calendar sync (ICS export works without) | $0 | research-gemini-qbo.md |
| `SITE_ORIGIN` + domain | Voice webhooks, OAuth redirects, public links | ~$10/yr domain (only unavoidable cost) | oracle-deploy-runbook.md |

## Owner checklist, in dependency order

### 1. Domain (~10 min, ~$10/yr)
Buy the domain, point an A record at the Oracle instance IP (runbook step 6).
`SITE_ORIGIN=https://app.trueaxishq.com` — must be explicit https.

### 2. Oracle deploy (scripted)
Run `scripts/oracle-setup.sh` per `docs/working-notes/oracle-deploy-runbook.md`
(single command: Node + MariaDB + Caddy auto-HTTPS + systemd). Then
`bash scripts/smoke.sh` from anywhere — 10 checks.

### 3. SMTP — Brevo (5 steps, ~15 min active)
1. Sign up free at brevo.com — **no credit card required**.
2. Senders & IPs → Domains → add the domain.
3. Add DNS records: SPF `v=spf1 include:spf.brevo.com ~all`, DKIM
   (`mail._domainkey` value from dashboard), DMARC `v=DMARC1; p=none;`.
4. SMTP & API → Generate a new SMTP key.
5. Fill `.env`: `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`,
   `SMTP_USER=<brevo login email>`, `SMTP_PASS=<smtp key>`,
   `SMTP_FROM=TrueAxis HQ <no-reply@trueaxishq.com>`.
   (SendGrid's free tier is retired — do not use.)

### 4. Stripe (~50–70 min active + 0–48h verification)
1. Create account → activate: business profile (EIN/LLC), representative
   SSN/ID, payout bank account.
2. Enable Connect in the live dashboard, accept platform terms (platform must
   be identity-verified before issuing live Connect onboarding links).
3. Copy live keys → `STRIPE_SECRET_KEY=sk_live_...`.
4. **After deploy:** Developers → Webhooks → add endpoint
   `https://<domain>/api/stripe/webhook`, copy the `whsec_...` →
   `STRIPE_WEBHOOK_SECRET`. (The endpoint URL only exists after step 2.)
5. Run verify-credentials.sh, then a $1 live test charge + one live Express
   onboarding link.
6. **Enable extra payment methods (free, recommended):** in the Stripe
   Dashboard under Settings → Payment methods, activate US bank payments
   (ACH), Klarna, and Afterpay. Every client checkout (invoice pay link,
   public pay, booking deposit, client portal) automatically offers them —
   the app passes card + us_bank_account + klarna + afterpay_clearpay and
   falls back to card-only for accounts without them enabled. Freelancers
   can also flip on Instant Payouts (1% fee) in their own connected-account
   settings; that is their choice, not platform code.

### 5. Gemini AI key (~5 min, no credit card)
1. aistudio.google.com → Get API key → Create API key.
2. `.env`: `BUILT_IN_FORGE_API_URL=https://generativelanguage.googleapis.com/v1beta/openai/`
   `BUILT_IN_FORGE_API_KEY=<key>`. The app's LLM core already targets
   `gemini-2.5-flash` on any OpenAI-compatible endpoint.

### 6. Twilio (~20 min active; compliance per research)
1. Create account (trial: ~$15.50 credit; trial sends only to verified
   numbers — good for endpoint testing).
2. Upgrade to paid ($20 min deposit) to remove trial preambles.
3. Launch compliance path (cheapest verified): **toll-free numbers +
   free Toll-Free Verification** in Trust Hub ($2.15/mo per number, 3–7 day
   review) — bypasses A2P 10DLC brand/campaign fees for the platform line
   product. Standard-brand 10DLC ($44 one-time + $10/mo campaign) only if
   local 10-digit numbers under business identity become necessary.
4. `.env`: `TWILIO_ACCOUNT_SID=AC...`, `TWILIO_AUTH_TOKEN=...`,
   `TWILIO_FROM_NUMBER=+18...` (the verified toll-free).

### 7. Google Calendar OAuth (optional, ~15 min)
Google Cloud Console → OAuth client (Web) with the production origin +
`/api/calendar/callback` redirect → `GOOGLE_CLIENT_ID/SECRET`.

### Decided NOT to build now (fact-based)
- **QuickBooks Online OAuth**: free Builder tier exists, but go-live review
  takes 5–10 business days and every customer needs a paid QBO subscription;
  CSV export already covers all tiers and competitors (Xero, FreshBooks).
  Revisit post-launch on customer demand. (research-gemini-qbo.md)

## Verification workflow for every credential

```bash
bash scripts/verify-credentials.sh          # all groups, live probes
bash scripts/verify-credentials.sh .env.prod # any env file
```

Pinned by `server/verifyCredentialsContract.test.ts`: every launch provider
has a live probe, unconfigured groups SKIP (never crash), rejected keys FAIL,
Stripe live vs test keys are distinguished, and every credential read is
set -u safe.
