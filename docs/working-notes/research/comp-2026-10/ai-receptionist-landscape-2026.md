# AI Receptionist Landscape for Home Services (October 2026)

## Overview
Analysis of AI phone answering in home services: FSM native tools vs standalone platforms vs DIY voice stacks.

## Facts

### 1. Vendor Pricing & Capabilities
* **Jobber Receptionist**: $29/mo add-on (30 conversations, $0.79/add'l; included on $249/mo Plus). Answers calls/texts 24/7, books work, creates requests in Jobber CRM. (Source: https://www.getjobber.com/pricing/ & https://www.usecarly.com/blog/jobber-ai-receptionist/)
* **ServiceTitan TI Voice Agent**: ~$2.50–$2.75/call on top of $245–$500/tech/mo tier. Native dispatch, calendar booking, emergency escalation, 80–85% containment. (Source: https://plg.servicetitan.com/va & https://fieldcamp.ai/reviews/servicetitan/)
* **Housecall Pro CSR AI**: $49–$99/mo add-on. Answers calls & web chat 24/7, schedules jobs natively in HCP calendar. (Source: https://www.housecallpro.com/features/ai-team/csr-ai/)
* **Workiz Genius Answering**: ~$150–$200/mo add-on (included in Pro plans). AI voice agent Jessica handles overflow/after-hours, logs calls, books jobs. (Source: https://www.workiz.com/pricing-plans/ & https://www.usecarly.com/blog/workiz-ai/)
* **GorillaDesk AI Agents (Maya)**: ~$3,600/yr ($300/mo) or ~$79/mo base. Handles phone, SMS, web chat, client portal for pest control booking. (Source: https://gorilladesk.com/features/activate-ai-agents/)
* **ServiceM8 Phone Agent**: $49/mo ($44/mo billed annually) + GST add-on. Voice assistant generates job cards, takes notes, sends booking links via SMS. (Source: https://support.servicem8.com/help-center/servicem8-add-ons/servicem8-phone-agent/introducing-the-servicem8-phone-agent)
* **Smith.ai**: Free tier (25 calls/mo), Pro $150/mo (75 calls, $1.60–$2.00 overage), Enterprise $500/mo (300 calls). Multi-turn CRM logging, lead qualification, bilingual. (Source: https://smith.ai/pricing/ai-receptionist)
* **Goodcall**: $79/mo per agent (100 unique callers/mo, $0.50/extra caller, unlimited minutes). Web-configured AI answering. (Source: https://www.goodcall.com/pricing)
* **Rosie AI**: $49/mo (250 mins), $149/mo (1,000 mins), $299/mo (2,500 mins). Basic Zapier CRM integration. (Source: https://heyrosie.com/pricing)
* **Numa**: Per-rooftop SaaS pricing ($500–$1,000+/mo) for commercial service centers & auto service. (Source: https://numa.com/)
* **Vapi / Retell DIY**: Orchestrated developer voice stack runs ~$0.08–$0.13/min total (STT + LLM + TTS). Raw DIY Twilio TwiML + Gemini stack costs ~$0.018/min. (Source: https://vapi.ai/pricing & https://www.lindy.ai/blog/vapi-ai)

### 2. Measured Performance Data
* **Answer Rate**: AI receptionists achieve a 100% instant answer rate vs 60–70% human answer rate during peak/after-hours overflow. (Source: https://www.goto.com/blog/top-ai-receptionist-use-cases-by-industry)
* **Containment Rate**: ServiceTitan TI Voice reports 80–85% call containment for routine inquiries and bookings without human CSR intervention. (Source: https://plg.servicetitan.com/va)
* **Booking / Conversion Rate**: Pure AI booking handles standard inbound at 35%–50% conversion (up to 84.8% on pre-qualified booking flows), compared to ~62% for experienced human CSRs handling complex calls. (Source: https://www.linkedin.com/pulse/346k-phone-call-why-ai-receptionists-costing-home-service-jeff-conlon-cttvc)

### 3. Known Failure Modes (2025–2026)
* **Hallucinated Appointments & Pricing**: AI scheduling outside technician working hours, double-booking, or promising unauthorized custom pricing. (Source: https://cetrai.com/blog/ai-receptionist-vs-answering-service)
* **Accents & Background Noise Latency**: Regional accents or job-site background noise cause speech recognition stumbles and turn latency. (Source: https://www.linkedin.com/posts/stephen-oduor-209b0823_the-8-complaint-receptionist-110-features-activity-7460308443493539840-uh8D)
* **Failed Emergency Transfers**: Dropped cold transfers when escalating after-hours emergency calls to on-call technicians. (Source: https://www.reddit.com/r/smallbusiness/comments/1ulegrs/home_service_owners_are_you_guys_actually_using/)

### 4. Consumer Sentiment
* Over 80% of homeowners hang up on voicemail without leaving a message; callers prefer immediate AI booking over voicemail, but reject AI if it pretends to be human or blocks human transfer. (Source: https://www.oncactus.com/ai-answering-service-roofing & https://optimusbusiness-solutions.com/blog/ai-receptionist-consumer-acceptance)

### 5. Multilingual Status
* ServiceTitan TI Voice and Smith.ai offer native English/Spanish bilingual routing. Housecall Pro CSR AI, Jobber Receptionist, and ServiceM8 remain primarily English native with rolling/limited multi-language support. (Source: https://help.servicetitan.com/release-hub/docs/handle-calls-from-spanish-speaking-customers-with-voice-agent-spanish-language-s & https://lobbyvoices.com/housecall-pro-ai-receptionist-alternative)
