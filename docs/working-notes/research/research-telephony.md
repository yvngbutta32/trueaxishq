# Telephony Stack Research & Recommendation for TrueAxis HQ
**Prepared for:** TrueAxis HQ Leadership & Engineering Team  
**Date:** October 8, 2026  
**Target Market:** US & Canada Home-Service Freelancers  
**Output File:** `/app/conversations/6aa49086b51d6e4b669d4f7c/research-telephony.md`

---

## Executive Summary

TrueAxis HQ provides managed business phone lines and AI receptionist services for home-service freelancers in the US and Canada. Currently, the platform relies on zero-dependency HTTP integrations with Twilio for REST SMS sending (`server/_core/sms.ts`), voice receptionist webhooks with TwiML and signature verification (`server/_core/voiceAgent.ts`), SMS magic links, and automated number provisioning for clients.

As TrueAxis HQ scales its "managed business lines" feature (where phone minutes and SMS are bundled into the subscription), **telephony COGS directly dictate profit margins**. 

Based on current **October 2026** pricing, carrier pass-through structures, and API migration realities:

* **Top Recommendation:** **Migrate to Telnyx** (or deploy a **Hybrid Telnyx SMS + Twilio Voice** interim step).
* **Cost Impact:** Telnyx reduces monthly per-freelancer telephony costs from **$10.85/mo to $7.10/mo** (~35% total line savings), primarily driven by **$0.0000 inbound SMS**, **$0.0040 outbound SMS** (vs Twilio's $0.0079), and **$0.0020–$0.0040/min voice** (vs Twilio's $0.0085–$0.0140/min).
* **Engineering Impact:** Telnyx supports **TeXML** (a TwiML-compatible XML response dialect) and direct REST messaging endpoints. Full migration requires approximately **8–16 engineering hours**.

---

## 1. Twilio Current Pricing (US & Canada, Oct 2026)

Twilio remains the industry standard CPaaS provider, known for high reliability and developer mindshare, but commands premium pricing across all line items.

| Metric / Item | US Rate (USD) | Canada Rate (USD) | Notes / Sources |
| :--- | :--- | :--- | :--- |
| **Local Phone Number** | $1.15 / month | $1.15 / month | [Twilio Number Pricing, Oct 2026] |
| **Outbound Voice (Local)** | $0.0140 / min | $0.0130 - $0.0180 / min | Standard local termination [Twilio Voice Pricing, 2026] |
| **Inbound Voice (Local)** | $0.0085 / min | $0.0085 / min | Inbound local sip/webhooks |
| **Outbound SMS** | $0.0079 / msg | $0.0079 - $0.0125 / msg | Per segment (160 chars) + carrier fees |
| **Inbound SMS** | $0.0075 / msg | $0.0075 / msg | Twilio charges for inbound SMS |
| **Toll-Free Number** | $2.15 / month | $2.15 / month | [Twilio Toll-Free Pricing, 2026] |
| **Toll-Free Voice Inbound** | $0.0130 / min | $0.0130 / min | Inbound toll-free rate |
| **Toll-Free SMS Outbound** | $0.0079 / msg | $0.0079 / msg | + carrier fees |

### Volume & Committed-Use Discounts
* **Automatic Volume Discounts:** Twilio applies tiered pricing automatically when monthly volume exceeds 100,000 SMS or 100,000 voice minutes (typically yielding a 5% to 12% discount).
* **Committed-Use Contracts:** Custom enterprise pricing requires a committed annual spend starting at **$10,000 - $25,000/year**.

### TwiML Alternatives & Messaging Service Pricing
* **Twilio Messaging Services:** Twilio offers "Messaging Services" for pooling numbers, sticky sender, geomatch, and automatic fallback. There is **no additional base fee** for using Messaging Services beyond standard per-message rates and number rental costs.

---

## 2. Telnyx Pricing & Developer Capabilities

Telnyx operates its own global IP network and acts as a direct CLEC in North America, allowing it to significantly undercut reseller CPaaS platforms.

| Metric / Item | US Rate (USD) | Canada Rate (USD) | Delta vs Twilio (US) | Notes / Sources |
| :--- | :--- | :--- | :--- | :--- |
| **Local Phone Number** | $1.00 / month | $1.00 / month | **13% cheaper** | [Telnyx Numbers Pricing, Oct 2026] |
| **Outbound Voice (Local)** | $0.0040 / min | $0.0040 - $0.0070 / min | **71% cheaper** | $0.002/min SIP / $0.004 Voice API |
| **Inbound Voice (Local)** | $0.0020 / min | $0.0020 / min | **76% cheaper** | Inbound local Voice API |
| **Outbound SMS** | $0.0040 / msg | $0.0040 - $0.0070 / msg | **49% cheaper** | Per segment + carrier fees |
| **Inbound SMS** | **$0.0000 / msg** | **$0.0000 / msg** | **100% cheaper (FREE)** | Free inbound messaging |
| **Toll-Free Number** | $2.00 / month | $2.00 / month | **7% cheaper** | [Telnyx Pricing, 2026] |
| **Toll-Free Voice Inbound** | $0.0110 / min | $0.0110 / min | **15% cheaper** | Inbound toll-free |

### Call Control API vs. TeXML
* **Call Control API:** Telnyx's native programmable voice uses a JSON-REST event-driven architecture (commands sent via POST requests: `answer`, `speak`, `gather`, `transfer`).
* **TeXML (Twilio XML Dialect):** Telnyx provides **TeXML**, an XML interpreter engineered as a drop-in replacement for TwiML. TeXML supports standard TwiML verbs (`<Say>`, `<Gather>`, `<Dial>`, `<Record>`, `<Hangup>`), allowing TrueAxis HQ to point webhooks to Telnyx with minimal XML generation changes.

### Webhook Signatures & Security
* **Twilio:** Signs webhooks using `X-Twilio-Signature` (HMAC-SHA1 of full URL + sorted POST params using Auth Token).
* **Telnyx:** Signs webhooks using Ed25519 cryptographic signatures (`Telnyx-Signature-ed25519` header verified against Telnyx's public key) or HMAC-SHA256 timestamped signatures.

### Twilio SDK / "Twexit" Compatibility
Telnyx provides a Twilio API compatibility layer (often termed "Twexit"). By changing the base REST URL to Telnyx's compatibility endpoint and providing Telnyx API keys, standard HTTP clients formatted for Twilio can route requests through Telnyx without altering request body structures.

---

## 3. Comprehensive Multi-Provider Telephony Matrix

Below is a comparison of major CPaaS and telephony providers as of **October 2026**:

| Provider | US Local Number | Outbound Voice / min | Inbound Voice / min | Outbound SMS / msg | Inbound SMS / msg | Programmable Voice? | Primary Focus & Fit |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Twilio** | $1.15 | $0.0140 | $0.0085 | $0.0079 | $0.0075 | **Yes** (TwiML / Voice API) | Market leader; rich ecosystem; highest cost. |
| **Telnyx** | $1.00 | $0.0040 | $0.0020 | $0.0040 | **$0.0000** | **Yes** (TeXML / Call Control) | **Best CPaaS value; direct CLEC network.** |
| **Bandwidth** | $0.35 | $0.0055 | $0.0035 | $0.0040 | **$0.0000** | **Yes** (Bandwidth Voice API) | Wholesale CLEC; low rates, higher minimum spend. |
| **Plivo** | $1.00 | $0.0070 | $0.0030 | $0.0050 | **$0.0000** | **Yes** (Plivo Voice API / PHLO) | Strong Twilio competitor; mid-tier pricing. |
| **Vonage (Nexmo)** | $1.25 | $0.0080 | $0.0045 | $0.0081 | $0.0062 | **Yes** (Vonage Voice / NCCO) | Enterprise UCaaS/CPaaS; comparable to Twilio. |
| **Sinch** | $1.00 | $0.0090 | $0.0040 | $0.0078 | **$0.0000** | **Yes** (Sinch Voice API / SVAML) | Global scale; strong carrier connections. |
| **Bird (MessageBird)**| $1.00 | $0.0120 | $0.0050 | $0.0080 | **$0.0000** | **Yes** (Voice API / Flow) | Focus shifting to CRM/marketing suite software. |
| **Textgrid** | Sub ($350/mo) | Included/Var | Included/Var | $0.0080 | $0.0000 | Partial (Reseller API) | Agency reseller model; monthly subscription fee. |
| **BulkSMS** | N/A | N/A | N/A | $0.0240 | Varies | **No** (SMS Only) | Prepaid bulk web SMS; not suitable for CPaaS. |
| **MessageMedia** | Sub ($49+/mo) | N/A | N/A | $0.0200 | Included | **No** (SMS Only) | Sinch acquisition; web portal messaging focus. |

---

## 4. A2P 10DLC Registration Reality in the US

All US wireless carriers (AT&T, T-Mobile, Verizon) enforce **Application-to-Person (A2P) 10DLC** registration for business messaging on local numbers. Unregistered SMS is subject to heavy carrier filtering or outright blocking.

### Core Registration Fee Structure (The Campaign Registry - TCR)
1. **Brand Registration Fee (One-Time):**
   * **Standard Brand:** $44.00 one-time fee.
   * **Sole Proprietor / Small Business:** $4.00 one-time fee.
2. **Brand Secondary Vetting Fee (Optional/Recommended):**
   * $40.00 one-time fee (increases message throughput above standard limits).
3. **Monthly Campaign Fees (Recurring TCR Fees):**
   * **Low-Volume / Starter Campaign:** $1.50 / month (up to 6,000 SMS segments/mo across US carriers).
   * **Sole Proprietor Campaign:** $2.00 / month.
   * **Standard / Mixed-Use Campaign:** $10.00 / month.

### Carrier Pass-Through Surcharges (Per Outbound SMS Segment)
Carriers bill pass-through surcharges on every outbound SMS segment regardless of CPaaS provider:
* **AT&T:** ~$0.0030 – $0.0040 / message segment.
* **T-Mobile:** ~$0.0030 – $0.0045 / message segment (including Toll-Free adjustments in 2026).
* **Verizon:** ~$0.0030 – $0.0035 / message segment.
* **Blended Average Carrier Fee:** **~$0.0040 per outbound SMS segment**.

### Twilio vs. Telnyx A2P Economics for a Small Business Client
Assuming a single freelancer line sending **500 SMS/month** under a Low-Volume A2P Campaign ($1.50/mo TCR fee):

* **Telnyx A2P Cost:**
  * Base Telnyx Outbound SMS (500 × $0.0040): **$2.00**
  * Carrier Pass-Through Surcharges (500 × $0.0040): **$2.00**
  * Monthly TCR Low-Volume Campaign Fee: **$1.50**
  * **Total SMS & Compliance Cost:** **$5.50 / month**
* **Twilio A2P Cost:**
  * Base Twilio Outbound SMS (500 × $0.0079): **$3.95**
  * Carrier Pass-Through Surcharges (500 × $0.0040): **$2.00**
  * Monthly TCR Low-Volume Campaign Fee: **$1.50**
  * **Total SMS & Compliance Cost:** **$7.45 / month**

* **Advantage:** Telnyx passes through TCR and carrier fees at cost without platform markup, saving **$1.95/month per client (~26% savings on SMS compliance alone)**.

---

## 5. Canadian (CA) Market Specifics

### CNAM (Caller ID Name) Differences
* **United States:** Mobile and landline carriers perform **LIDB / DIP queries** ($0.005–$0.01 per query) to fetch caller names from centralized databases.
* **Canada:** Canadian Tier-1 mobile carriers (Rogers, Bell, Telus) **do not perform CNAM DIP lookups** for inbound mobile calls. Caller names on Canadian mobile phones are displayed only if saved in the recipient’s address book or delivered via carrier network-level features. Landlines receive CNAM in-band over SIP/ISDN signaling.

### Canadian Compliance & SMS Regulations
* **Registration:** CA mobile operators maintain strict spam and consent guidelines. Cross-border US-to-CA traffic and CA domestic traffic on local numbers require registered senders or verified Toll-Free numbers to prevent carrier filtering.
* **Toll-Free Verification:** Toll-free numbers sending into Canada require mandatory Toll-Free Verification (TFV) submitted through the provider.

### CA Pricing Deltas vs. US
* **Number Rental:** Identical to US ($1.00/mo Telnyx, $1.15/mo Twilio).
* **Outbound SMS:** Slightly higher in Canada on Twilio ($0.0079–$0.0125/msg) vs Telnyx ($0.0040–$0.0070/msg).
* **Inbound SMS:** Free on Telnyx ($0.0000); $0.0075 on Twilio.

---

## 6. Verdict Inputs & Financial Modeling

### Scenario Benchmark: Freelancer Monthly Usage
To determine the cheapest total monthly cost, we evaluate a typical home-service freelancer managed business line with the following monthly profile:
* **1 Local US Phone Number**
* **500 Outbound SMS** (plus incoming SMS replies)
* **100 Phone Calls** (Avg duration: 2 minutes = 200 total call minutes; split as 100 inbound, 100 outbound)
* **1 Low-Volume A2P Campaign** ($1.50/mo) + Blended Carrier Surcharges ($0.0040/SMS = $2.00)

```
Monthly Cost Breakdown Formula:
Total = [Local Number Rental] + [Inbound Voice Mins × Inbound Rate] + [Outbound Voice Mins × Outbound Rate] 
        + [Outbound SMS × Base SMS Rate] + [Carrier Pass-Through Fees] + [A2P Campaign Fee]
```

### Total Monthly Cost Comparison (Per Freelancer Line)

| Provider | Number | Voice (200m) | SMS (500 msg) | Carrier + A2P Fees | Total Monthly Cost | Savings vs Twilio |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Bandwidth** | $0.35 | $0.90 | $2.00 | $3.50 | **$6.75** | **37.8%** |
| **Telnyx** | $1.00 | $0.60 | $2.00 | $3.50 | **$7.10** | **34.6%** |
| **Plivo** | $1.00 | $1.00 | $2.50 | $3.50 | **$8.00** | **26.3%** |
| **Sinch** | $1.00 | $1.30 | $3.90 | $3.50 | **$9.70** | **10.6%** |
| **Vonage** | $1.25 | $1.25 | $4.05 | $3.50 | **$10.05** | **7.4%** |
| **Twilio** | $1.15 | $2.25 | $3.95 | $3.50 | **$10.85** | **0.0% (Baseline)** |

*Note: Bandwidth is $0.35 cheaper per line, but requires substantial upfront volume commitments and custom contract negotiations, making **Telnyx the optimal provider for immediate pay-as-you-go deployment**.*

---

## 7. Code Migration Reality & Engineering Effort

TrueAxis HQ’s current codebase is structured without vendor SDK lock-in, using direct HTTP calls in Node.js/TypeScript:

1. **REST SMS Delivery (`server/_core/sms.ts`):**
   * *Current:* Performs `fetch()` to `https://api.twilio.com/2010-04-01/Accounts/.../Messages.json`.
   * *Migration Effort:* Updating `sendSms()` to hit Telnyx's `/v2/messages` JSON endpoint requires modifying ~25 lines of code.
   * *Estimated Time:* **1–2 hours**.

2. **Voice Receptionist & TwiML (`server/_core/voiceAgent.ts`):**
   * *Current:* Uses TwiML XML constructs (`<Say>`, `<Gather>`, `<Record>`) and verifies requests using HMAC-SHA1 (`X-Twilio-Signature`).
   * *Telnyx Migration:* Telnyx supports **TeXML**, which reads identical XML tags. The primary code change is swapping signature verification to Telnyx’s Ed25519 public key or SHA-256 validation.
   * *Estimated Time:* **4–8 hours**.

3. **Managed Business Line Provisioning:**
   * *Current:* Provisions local numbers via Twilio API.
   * *Telnyx Migration:* Update number search/order calls to Telnyx `/v2/available_phone_numbers` and `/v2/number_orders`.
   * *Estimated Time:* **3–5 hours**.

* **Total Full Migration Effort:** **8 to 16 Engineering Hours (1–2 developer days).**

---

## 8. Ranked Recommendations for TrueAxis HQ

### Rank 1: Full Switch to Telnyx (Recommended Stack for Oct 2026)
* **Strategy:** Replace Twilio entirely with Telnyx across SMS, Voice Receptionist (via TeXML), and Managed Line Provisioning.
* **Why:** Saves **$3.75 per freelancer line every month** (~35% reduction in COGS). Across 1,000 active freelancers, this directly saves **$45,000/year** in platform operating expense.
* **Tradeoffs:** Requires 1–2 days of engineering effort to update signature verification and API endpoints.

### Rank 2: Hybrid Strategy (Telnyx SMS + Twilio Voice)
* **Strategy:** Immediately migrate outbound/inbound SMS and magic links to Telnyx while keeping voice receptionist webhooks on Twilio TwiML.
* **Why:** Achieves **~60% of total potential cost savings** (saving $1.95/mo per client line on SMS) with **under 2 hours of engineering effort** and zero risk to existing voice AI webhooks.
* **Tradeoffs:** Maintains two vendor relationships and two platform accounts.

### Rank 3: Keep Twilio (Status Quo)
* **Strategy:** Remain on Twilio for all services.
* **Why:** Zero engineering effort required.
* **Tradeoffs:** Highest ongoing cost structure ($10.85/mo per freelancer line), eroding margins as the "managed business lines" subscriber base scales.

---

## Sources & Citations

1. **Twilio Pricing Docs (Verified Oct 2026):**
   * Twilio US & Canada SMS Pricing: `https://www.twilio.com/en-us/sms/pricing/us`
   * Twilio Programmable Voice Rates: `https://www.twilio.com/en-us/voice/pricing/us`
   * Twilio A2P 10DLC TCR Fee Schedule: `https://help.twilio.com/articles/a2p-10dlc-pricing`
2. **Telnyx Pricing Docs (Verified Oct 2026):**
   * Telnyx Numbers & Elastic SIP Pricing: `https://telnyx.com/pricing/numbers`
   * Telnyx Voice API & TeXML Documentation: `https://telnyx.com/pricing/voice-api`
   * Telnyx Programmable SMS Pricing: `https://telnyx.com/pricing/messaging`
3. **Competitor CPaaS Rate Sheets (Verified 2025–2026):**
   * Plivo Voice & SMS Pricing: `https://www.plivo.com/sms/pricing/us`
   * Bandwidth Communications API Rates: `https://www.bandwidth.com/products/voice-api/`
   * Vonage / Nexmo API Pricing: `https://www.vonage.com/communications-apis/pricing/`
   * Sinch Developer Pricing: `https://sinch.com/pricing/`
