# Gemini API & QuickBooks Online Integration Research

## TOPIC A: Gemini API (Google AI Studio) Free Tier & Compatibility

### 1. Current Fast/Cheap Model & Free Tier Rate Limits (Oct 2026)
- **Model:** `gemini-2.5-flash` (or `gemini-1.5-flash`) is the primary fast, low-cost Flash workhorse model.
- **Free Tier Rate Limits (AI Studio API key):**
  - **RPM:** 10 – 15 requests per minute
  - **TPM:** 250,000 – 1,000,000 tokens per minute
  - **RPD:** 250 – 1,500 requests per day (shared across free tier endpoints)

### 2. Credit Card & Billing Requirements
- **Credit Card Needed for Free Tier:** **NO**. Google AI Studio provides free API access without entering credit card or payment billing details.
- **Upgrading to Paid Tier:** Billing account linking ($5 minimum prepayment) is required only when exceeding free tier limits or transitioning to production pay-as-you-go.

### 3. Paid Tier Token Pricing (per 1M tokens)
- **Gemini 2.5 Flash:** ~$0.075 – $0.375 / 1M input tokens, ~$0.30 – $1.875 / 1M output tokens (varies by prompt size/caching/promotional rates).
- **Gemini 1.5 Flash:** $0.35 / 1M input tokens, $1.05 / 1M output tokens (prompts ≤128k tokens).

### 4. Steps to Generate an API Key in Google AI Studio
1. Navigate to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with a standard Google account.
3. Click **"Get API key"** in the sidebar navigation.
4. Click **"Create API key"** (choose an existing GCP project or select "Create API key in new project").
5. Copy the generated API key string for use in application environment variables.

### 5. OpenAI Endpoint Compatibility
- **Compatible Base URL:** `https://generativelanguage.googleapis.com/v1beta/openai/`
- **Integration:** The OpenAI Python/JS SDK can directly invoke Gemini models by overriding `base_url` to the endpoint above and providing the Gemini API key.

---

## TOPIC B: Intuit QuickBooks Online (QBO) OAuth Integration

### 1. Developer Account & Production App Costs
- **Developer Account:** Free at [Intuit Developer Portal](https://developer.intuit.com/).
- **App Partner Program Pricing:**
  - **Builder Tier:** **$0/year** (includes up to 500,000 Core API credits/month, zero fixed cost).
  - **Paid Tiers (Silver/Gold/Platinum):** Range from $300 to $4,500/year for higher API volumes.
- **Per-Company Fees:** Intuit charges no per-connected-company fees on the Builder tier.

### 2. App Review & Go-Live Process
- **Requirements:** Developers must submit the **App Assessment Questionnaire** covering security practices, data handling, OAuth 2.0 handling, privacy policy, and user flow documentation.
- **Timeline:** Review takes **5 to 10 business days** for standard private/unlisted production access (and up to 2-3 weeks if listing on the QuickBooks App Store).

### 3. End-Customer QBO Subscription Requirements
- **Required Tier:** Any paid QBO tier (**Simple Start**, **Essentials**, **Plus**, or **Advanced**) includes full API/OAuth access for third-party connections at no extra charge to the end user.

### 4. Verdict: Build Native QBO Sync Now vs. CSV Export
- **Verdict:** **Stick with CSV Export for Launch.**
- **Rationale:** TrueAxis HQ's zero fixed cost architecture favors low-maintenance CSV exports. CSV requires zero credential management, zero API maintenance, zero app review delays, and works across all QBO tiers as well as competing accounting software (Xero, FreshBooks). Native QBO OAuth can be built post-launch once customer demand warrants the compliance and auth overhead.

---

## Sources
- [Gemini API Pricing & Rate Limits](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini Rate Limits Documentation](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Gemini OpenAI Compatibility Guide](https://ai.google.dev/gemini-api/docs/openai)
- [Google AI Studio Quickstart](https://ai.google.dev/gemini-api/docs/api-key)
- [Intuit App Partner Program & Pricing](https://developer.intuit.com/app/developer/qbo/docs/get-started)
- [Intuit App Assessment FAQ](https://help.developer.intuit.com/s/article/New-app-assessment-process-FAQ)
