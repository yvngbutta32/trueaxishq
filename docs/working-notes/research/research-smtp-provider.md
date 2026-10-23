# Transactional SMTP Provider Research — TrueAxis HQ

## Executive Summary & Recommendation
- **Top Recommendation:** **Brevo** (formerly Sendinblue)
  - **Rationale:** Free forever with 300 emails/day (~9,000/month), zero credit card required at signup, instant activation, native SMTP relay, and strong B2B deliverability. Fits TrueAxis HQ's launch volume (<300/day) with strict $0/month fixed cost.
- **Backup Pick:** **Amazon SES**
  - **Rationale:** Strictly usage-based ($0.10 per 1,000 emails; 3,000 free/mo for first 12 months) with zero fixed monthly subscription fee. Requires credit card on file and 24–48 hour AWS manual support approval to exit Sandbox mode.

---

## Detailed Provider Analysis

### Top Pick Verification: Brevo
- **Free Tier Caps:** 300 emails/day (hard daily cap, resets at 00:00 UTC; up to ~9,300 emails/month).
- **Credit Card Required:** No credit card required at signup.
- **Signup & Review:** Instant signup; automated initial spam filter check upon domain authentication.
- **Deliverability Reputation:** High sender reputation for B2B transactional mail.
- **DNS Requirements:**
  - **SPF:** `v=spf1 include:spf.brevo.com ~all`
  - **DKIM:** TXT record with host `mail._domainkey` (value generated in Brevo dashboard).
  - **DMARC:** `v=DMARC1; p=none;` at `_dmarc.trueaxishq.com`.

### Provider Comparison Table

| Provider | Free Tier Limits | Credit Card? | Instant Setup? | Zero Fixed Cost Status | Notes & Sources |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Brevo** *(Top Pick)* | 300/day (~9k/mo) | No | Yes | **PASS** ($0/mo) | Native SMTP relay; strong deliverability. [Brevo Pricing](https://www.brevo.com/pricing/) |
| **Amazon SES** *(Backup)* | 3,000/mo (12 mo); then $0.10/1k | Yes | No (24-48h Sandbox review) | **PASS** (Pure usage-based) | 62k/mo EC2 free tier **does not apply** to Oracle Cloud / non-AWS servers. Paid rate: $0.10/1k. [AWS SES Pricing](https://aws.amazon.com/ses/pricing/) |
| **Resend** | 3,000/mo (100/day cap) | No | Yes | **PASS** ($0/mo) | Modern DX, but 100/day daily cap restricts launch surges. [Resend Pricing](https://resend.com/pricing) |
| **SendGrid** | **RETIRED** (60-day trial at 100/day) | No for trial | Yes | **FAIL** ($19.95/mo after trial) | Twilio retired free tier in May 2025. Violates zero fixed cost rule. [SendGrid Changes](https://www.twilio.com/en-us/changelog/sendgrid-free-plan) |
| **Zoho Mail** | 5 mailboxes (webmail only) | No | Yes | **FAIL** (Prohibits app SMTP) | Free tier is webmail/IMAP only; automated app transactional SMTP is blocked/restricted. [Zoho Pricing](https://www.zoho.com/mail/zohomail-pricing.html) |
| **Gmail Workspace** | 500/day (Free) / 2,000/day (Workspace) | No / Yes | Yes | **PASS** (Free Gmail) / **FAIL** (Workspace sub) | Requires 2FA + App Password. Exposes personal email; lacks webhook logs. [Google App Passwords](https://support.google.com/mail/answer/185833) |

---

## Step-by-Step Guide: Brevo Setup for TrueAxis HQ (5 Steps)

1. **Sign Up:** Register for a free account at [brevo.com](https://www.brevo.com) (no credit card required).
2. **Add Domain:** Navigate to **Senders & IPs** > **Domains**, add `trueaxishq.com`.
3. **Configure DNS Records:** In your domain DNS manager (e.g. Cloudflare/Route53), add:
   - **SPF (TXT):** `v=spf1 include:spf.brevo.com ~all`
   - **DKIM (TXT):** Host `mail._domainkey.trueaxishq.com` with key value from Brevo dashboard.
   - **DMARC (TXT):** Host `_dmarc.trueaxishq.com` with `v=DMARC1; p=none;`. Then click **Authenticate Domain**.
4. **Generate SMTP Key:** Go to **SMTP & API Keys**, click **Generate a new SMTP key**, name it `TrueAxisHQ-App`, and copy the key.
5. **Configure App Credentials:** Save the SMTP parameters to your environment variables (`.env`).

---

## Resulting SMTP Environment Variables

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-brevo-account-email@trueaxishq.com
SMTP_PASS=xsmtpsib-YOUR-GENERATED-BREVO-SMTP-KEY
SMTP_FROM=noreply@trueaxishq.com
```

---

## Alternative: Gmail Workspace SMTP (Tiny Volume)
- **App Password Requirements:** 2-Step Verification (2FA) must be enabled on the Google Account. Generate a 16-character App Password under Google Account Security > 2-Step Verification > App Passwords.
- **Daily Caps:** Personal Gmail (`@gmail.com`): 500 emails/day; Paid Google Workspace: 2,000 emails/day.
- **Limitations:** Exposes owner's email address, lacks bounce webhooks/logs, risk of account throttle if flagged as spam.
