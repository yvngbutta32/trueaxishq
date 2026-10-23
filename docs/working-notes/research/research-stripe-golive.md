# Stripe Go-Live Research & Checklist (TrueAxis HQ)

## Key Findings & Verified Requirements (2026)
- **Standard Processing Fees:** 2.9% + $0.30 per successful US card transaction. No setup fees, monthly fees, or hidden charges.
- **Account Activation:** Requires business profile (EIN/LLC), bank details, and owner verification (SSN/government ID). Takes **instant to 1–2 business days**.
- **API Keys & Switching:** Test mode (`pk_test_`, `sk_test_`) vs Live mode (`pk_live_`, `sk_live_` or Restricted `rk_live_`). Switch via server environment variables.
- **Connect Express Pricing & Requirements:** $2.00/month per active account + 0.25% + $0.25 per payout. Platform MUST complete identity verification and activate Connect terms in Dashboard before issuing live connected account onboarding links.
- **Webhooks:** Endpoint defined in Dashboard (Developers → Webhooks). Requires live HTTPS domain (`https://app.trueaxishq.com/api/webhooks/stripe`). Signing secret (`whsec_...`) is revealed upon endpoint creation.
- **2026 Compliance:**
  - **PCI DSS:** Qualifies for SAQ A (Checkout/Elements handle raw card data; no card data touches TrueAxis HQ servers).
  - **KYC & 1099-K:** Stripe manages KYC for Express connected accounts. Federal 1099-K threshold remains $20,000 / 200 txns for platforms (state thresholds vary).
  - **PSD2/SCA:** Not required for US-only operations; built into Stripe Checkout automatically if international cards are used.

## Ordered Owner Checklist & Time Estimates
1. **Submit Account Activation:** Enter legal business profile, representative SSN/ID, and payout bank account. *(15 mins active; 0–48 hrs approval)*
2. **Complete Platform Connect Onboarding:** Enable Stripe Connect in live Dashboard and accept platform terms. *(10 mins)*
3. **Obtain Live API Keys:** Retrieve `pk_live_` and `sk_live_` (or restricted `rk_live_`) and add to server secrets. *(5 mins)*
4. **Deploy Application to HTTPS Domain:** Ensure production server is live on public HTTPS URL. *(15–30 mins)*
5. **Configure Live Webhook Endpoint:** Register production endpoint URL in Dashboard and copy `whsec_...` signing secret. *(5 mins)*
6. **Live Integration Verification:** Perform a test transaction ($1 charge or test coupon) and generate a live Express onboarding link. *(10 mins)*

**Total Time Estimate:** ~50–70 minutes of active setup time + up to 1–2 business days for account verification review.

## Test Mode Capabilities
- SaaS subscription flows (Starter $49, Pro $129, Agency $299) testable using standard test cards (`4242...`).
- Connected account creation and hosted Express onboarding link generation using test data.
- Local webhook testing via Stripe CLI (`stripe listen --forward-to localhost:3000/api/stripe/webhook`).

## Sources
- Stripe Pricing: https://stripe.com/pricing
- Stripe Connect Pricing: https://stripe.com/connect/pricing
- Account Activation Guide: https://docs.stripe.com/get-started/account/set-up
- Connect Express Docs: https://docs.stripe.com/connect/express-accounts
- Webhooks Guide: https://docs.stripe.com/webhooks
- PCI Compliance (SAQ A): https://stripe.com/guides/pci-compliance
- 1099-K Thresholds: https://support.stripe.com/questions/1099-k-tax-forms
