# TrueAxis HQ - Twilio Account Activation & Regulatory Research (Oct 2026)

## 1. Owner Step-by-Step Activation Guide

### Step 1: Account Setup & Webhook Testing (Trial Phase)
1. Register account at Twilio. Trial includes ~$15.50 in free credit.
2. Verify test phone numbers (Trial restriction: outbound SMS/calls are limited strictly to verified caller IDs).
3. Test TrueAxis pre-built endpoints (`/api/voice/answer`, `/api/voice/gather`, `/api/voice/completed`) with signature verification.
4. *Trial Limitations*: Outbound calls play a trial preamble; SMS includes "Sent from Twilio trial" prefix; capped at 50–100 msgs/day.

### Step 2: Account Upgrade & Payment Setup
1. Upgrade to a paid account in Twilio Console by adding credit card payment ($20 min deposit).
2. Upgrading removes trial text/voice preambles, unlocks unverified destination numbers, and preserves trial balance.

### Step 3: Regulatory KYC & A2P 10DLC Decision

#### Option A: Verified Toll-Free Numbers (Cheapest & Fastest Launch Path)
* **Process**: Purchase US/CA Toll-Free numbers ($2.15/mo) -> Complete free Toll-Free Verification form in Trust Hub (3–7 days turnaround).
* **Pros**: Zero one-time/monthly registration fees; bypasses complex per-client 10DLC vetting; immediate operational status for SaaS platform lines.

#### Option B: Sole Proprietor 10DLC (Only for Individuals without Tax ID / EIN)
* **Process**: Trust Hub personal profile -> Sole Prop Brand ($4.50 one-time) -> Sole Prop Campaign ($15 one-time vetting + $2/mo).
* **Limitations**: Restricted to 1 phone number per campaign; max ~2,500 msgs/day; unavailable if TrueAxis or freelancer has an EIN.

#### Option C: Standard Brand 10DLC (For Registered Businesses)
* **Process**: Primary Business Profile (EIN match) -> Standard Brand ($44 one-time) -> Low-Volume ($1.50–$2/mo) or Standard Campaign ($10/mo + $15 vetting).
* **Use Case**: Required if TrueAxis provisions local 10-digit numbers for US SMS routing under business identity.

---

## 2. Twilio 2026 Cost Breakdown Table

| Item | Unit / Frequency | Cost (USD) | Notes |
| :--- | :--- | :--- | :--- |
| **US/CA Local Phone Number** | Per number / month | $1.15 | 10-digit local long code (10DLC) |
| **US/CA Toll-Free Number** | Per number / month | $2.15 | Fast path, zero registration fees |
| **Inbound Voice (Local)** | Per minute | ~$0.0085 – $0.014 | Handled by `/api/voice/*` webhooks |
| **Outbound Voice (Local)** | Per minute | ~$0.014 – $0.015 | Outbound PSTN calling |
| **Outbound SMS (Base)** | Per segment | ~$0.0079 – $0.0083 | Standard 160-char SMS segment |
| **SMS US Carrier Fees** | Per segment | ~$0.003 – $0.005 | Pass-through fee (AT&T/T-Mobile/Verizon) |
| **Toll-Free Verification** | One-time | **$0.00 (Free)** | No brand or monthly campaign fees |
| **Sole Prop Brand / Campaign** | One-time / Monthly | $4.50 reg + $15 vet / $2/mo | Non-EIN only; 1 number limit |
| **Standard Brand Registration**| One-time | $44.00 – $46.00 | Includes Secondary Vetting |
| **Standard Campaign Vetting** | One-time / Monthly | $15.00 vet / $1.50–$10/mo | Low-volume ($1.50–$2/mo) or Standard ($10/mo) |

---

## 3. Canadian Rules, Platform Reselling & KYC Requirements

### Canadian SMS Rules (CA vs US Traffic)
* **CA to CA Traffic**: Canadian carriers (Rogers, Bell, Telus) do **not** enforce A2P 10DLC registration for local CA numbers texting CA recipients. Standard CASL opt-in rules apply.
* **CA to US Traffic**: Any SMS terminating on US networks (even from CA long codes) **requires A2P 10DLC or Toll-Free Verification**.

### Platform Reselling & Line Provisioning Architecture
1. **Platform-Level Shared Campaign (Recommended for Launch)**: TrueAxis registers as a Standard Brand (ISV) with a Platform/Mixed Campaign covering transactional freelancer notification use cases. TrueAxis provisions numbers under its main account/subaccount and resells within fair-use caps (Starter 300, Pro 1000, Agency 2500).
2. **ISV Subaccount Architecture (Custom Client Campaigns)**: If freelancers send distinct promotional SMS under their own business names, Twilio requires subaccounts with individual Secondary Customer Profiles and customer-level A2P registrations.

### Express vs Standard KYC Requirements
* **Express Vetting**: Requires exact match of Legal Business Name, Address, and EIN/Tax ID with IRS records. Discrepancies cause automatic failure.
* **Standard / Manual Vetting**: Triggered on mismatch; requires submitting official tax documents (CP575, W-9) and proof of address (utility bill).

---

## 4. Primary Sources

* Twilio Free Trial: https://www.twilio.com/docs/usage/trials
* A2P 10DLC Pricing & Fees: https://help.twilio.com/articles/1260803965530-What-pricing-and-fees-are-associated-with-the-A2P-10DLC-service-
* Sole Proprietor Registration: https://help.twilio.com/articles/9550596959643-New-Changes-to-A2P-10DLC-Starter-Brands-FAQ
* ISV A2P Onboarding: https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/onboarding-isv
* Toll-Free Verification: https://www.twilio.com/en-us/phone-numbers/toll-free
* Twilio Trust Hub Profiles: https://www.twilio.com/docs/trust-hub/profiles
