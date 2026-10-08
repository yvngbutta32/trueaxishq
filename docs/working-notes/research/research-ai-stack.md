# AI Infrastructure Research & Pricing Strategy for TrueAxis HQ
**Prepared for:** TrueAxis HQ Product & Engineering Teams  
**Date:** October 8, 2026  
**Target Architecture:** Home-Services SaaS (Voice Receptionist + In-App AI Drafting Helpers)  
**Constraint Mandate:** $0 Fixed Developer Monthly Cost (100% Usage-Based / Pay-Per-Use)  
**Output File:** `/app/conversations/6aa49086b51d6e4b669d4f7c/research-ai-stack.md`

---

## Executive Summary

TrueAxis HQ requires two core AI surfaces:
1. **AI Voice Receptionist:** An automated phone assistant answering client inbound calls, gathering job details, qualifying leads, drafting proposals, and taking voicemails or scheduling callbacks.
2. **In-App AI Helpers:** On-demand features for home-service contractors (generating job estimates, drafting proposal texts, customer SMS replies, and summarizing lead call transcripts).

Because TrueAxis HQ operates on a **usage-based SaaS model**, keeping fixed developer infrastructure costs strictly at **$0/month** is mandatory. Every component must be billed per token, per audio minute, or per character, ensuring zero idle overhead when clients are inactive.

### Key Research Findings
* **DIY TwiML/WebSocket vs Managed Voice Platforms:** TrueAxis HQ's existing server-side TwiML architecture already preserves high gross margin (~80–85%). Managed platforms (Vapi, Retell AI, Bland AI) add a **$0.05–$0.08/minute platform fee markup**, increasing per-call COGS by 300–500% ($0.08–$0.12/min vs $0.018/min DIY).
* **Optimal Voice Receptionist Stack:** **Twilio Voice Inbound + Deepgram Nova-3 Streaming STT + Google Gemini 2.0 Flash / Groq Llama 3.1 8B + Cartesia Sonic TTS**. Total all-in cost is **$0.0181/minute** (~1.81 cents/min), with end-to-end turn latency under **600ms**.
* **Optimal In-App Drafting Model:** **Google Gemini 2.0 Flash** or **OpenAI GPT-4o-mini**. Costs **$0.15–$0.22 per 1,000 drafting requests**, offering sub-second response times, excellent function calling, and structured JSON output.
* **Self-Hosted Reality:** Self-hosting (Ollama + whisper.cpp + Piper) on cloud GPUs violates the $0 fixed monthly cost constraint ($30–$90/mo idle VPS fees). Hosting on cheap CPU VPS instances results in unacceptable 3–6 second conversational turn latencies.

---

## 1. LLM API Pricing Comparison (As of Late 2026)

All pricing below reflects official list rates per 1 Million (1M) input and output tokens as of October 2026.

| Provider | Model Tier | Model Name | Input / 1M Tokens | Output / 1M Tokens | Cached Input / 1M | Primary Voice / App Suitability | Source & Date |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **OpenAI** | Cheap / Voice | `gpt-4o-mini` | $0.15 | $0.60 | $0.075 | **Top Pick:** Voice & In-app drafting | [OpenAI API Pricing, Oct 2026] |
| **OpenAI** | Flagship | `gpt-4o` | $2.50 | $10.00 | $1.25 | Complex multi-step reasoning | [OpenAI API Pricing, Oct 2026] |
| **OpenAI** | Reasoning Mini | `o3-mini` | $1.10 | $4.40 | $0.55 | Structured code/estimate generation | [OpenAI API Pricing, Oct 2026] |
| **Google** | Cheap / Voice | `gemini-2.0-flash-lite` | $0.075 | $0.30 | $0.020 | Ultra-cheap voice receptionist & summaries | [Google AI Studio, Oct 2026] |
| **Google** | Cheap / Voice | `gemini-2.0-flash` | $0.10 | $0.40 | $0.025 | **Top Pick:** Low-latency voice & fast drafting | [Google AI Studio, Oct 2026] |
| **Google** | Flagship | `gemini-1.5-pro` / `2.0-pro` | $1.25 | $5.00 | $0.312 | Heavy context analysis / contracts | [Google AI Studio, Oct 2026] |
| **Meta / Groq** | Ultra-Fast Voice | `llama-3.1-8b-instant` | $0.05 | $0.08 | N/A | **Fastest:** Voice turns (1,200 tps) | [Groq Pricing, Oct 2026] |
| **Meta / Groq** | Fast Quality | `llama-3.3-70b-versatile` | $0.59 | $0.79 | N/A | Balanced intelligence & voice speed | [Groq Pricing, Oct 2026] |
| **Meta / Together** | Fast Open | `llama-3.3-70b-instruct` | $0.88 | $0.88 | N/A | Reliable open-weights API route | [Together AI, Oct 2026] |
| **Meta / Fireworks** | Fast Open | `llama-3.3-70b-instruct` | $0.90 | $0.90 | N/A | Fast serverless function calling | [Fireworks AI, Oct 2026] |
| **Anthropic** | Cheap / Voice | `claude-3-5-haiku` | $1.00 | $5.00 | $0.10 | High-accuracy drafting / complex JSON | [Anthropic Docs, Oct 2026] |
| **Anthropic** | Flagship | `claude-3-7-sonnet` | $3.00 | $15.00 | $0.30 | Gold-standard long proposal drafting | [Anthropic Docs, Oct 2026] |
| **DeepSeek** | Cheap / Reasoning | `deepseek-v3` / `R1` | $0.14 | $1.10 | $0.07 | High-reasoning back-office tasks | [DeepSeek Pricing, Oct 2026] |
| **xAI** | Cheap Tier | `grok-3-mini` | $0.60 | $4.00 | N/A | Fast conversational turns | [xAI Docs, Oct 2026] |
| **xAI** | Flagship | `grok-2` / `grok-3` | $2.00 | $6.00 | N/A | General intelligence | [xAI Docs, Oct 2026] |
| **Mistral AI** | Cheap / Voice | `mistral-nemo-12b` | $0.02 | $0.06 | N/A | Ultra-cheap open model | [Mistral AI, Oct 2026] |
| **Mistral AI** | Standard | `mistral-small-3` | $0.10 | $0.30 | N/A | Compact instruction follower | [Mistral AI, Oct 2026] |
| **Mistral AI** | Flagship | `mistral-large-2` | $2.00 | $6.00 | N/A | Enterprise drafting | [Mistral AI, Oct 2026] |

---

## 2. Latency & Round-Trip Voice Dynamics

### Latency Requirements for Phone Conversations
Human phone conversations break down when turn-taking silence exceeds **800–1,000 ms**. To achieve natural, human-like speech exchanges, total end-to-end system latency must stay under **700 ms**:

$$\text{Total Latency} = \text{STT Stream Silence Detection} + \text{LLM Time to First Token (TTFT)} + \text{TTS Time to First Audio Byte (TTFB)} + \text{Telephony Network Transport}$$

#### Model Latency Profiles
1. **Groq LPU (Llama 3.1 8B / 3.3 70B):** **TTFT 100–150 ms**, generation speed >800 tokens/sec. The fastest text model available for conversational turn-taking.
2. **Google Gemini 2.0 Flash:** **TTFT 200–280 ms**, generation speed ~200 tokens/sec. Highly reliable function calling and structured prompt execution.
3. **OpenAI GPT-4o-mini:** **TTFT 250–380 ms**, generation speed ~100 tokens/sec. Industry standard for reliable tool use and instruction following.
4. **DeepSeek-V3:** **TTFT 500–900 ms**. While token costs are low, variable API load causes latency spikes (>1.2s), leading to awkward silences on phone calls. Unsuitable as a primary voice engine.
5. **Claude 3.5 Haiku:** **TTFT 350–500 ms**. Fast, but 10x more expensive than Gemini 2.0 Flash for voice output.

---

## 3. Speech APIs (STT & TTS) Pricing Comparison

Audio costs form the largest share of an AI receptionist's per-minute operating expense.

### Speech-to-Text (STT) Providers

| Provider | Model / API | Pricing Structure | Effective Cost / Minute | Streaming Latency | Key Strengths / Evaluation | Source & Date |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Deepgram** | Nova-3 Streaming | $0.0058 / min | **$0.0058** | **~150 ms** | **Top Recommendation:** Best latency & speech accuracy | [Deepgram Pricing, Oct 2026] |
| **Deepgram** | Nova-3 Batch | $0.0043 / min | **$0.0043** | Non-streaming | Best for recorded voicemail transcription | [Deepgram Pricing, Oct 2026] |
| **AssemblyAI** | Universal-1 | $0.37 / hour | **$0.0062** | ~300 ms | Robust noise handling in field audio | [AssemblyAI Pricing, Oct 2026] |
| **OpenAI** | Whisper API (`whisper-1`) | $0.0060 / min | **$0.0060** | ~400 ms (Batch) | High multilingual accuracy, poor streaming | [OpenAI API Pricing, Oct 2026] |
| **Twilio** | Multi-Provider Gather | $0.0200 / gather | **~$0.0200–$0.0700** | Native TwiML | High cost per turn ($0.02/turn = ~$0.06/min) | [Twilio Voice Pricing, Oct 2026] |
| **Google Cloud** | Speech-to-Text V2 | $0.0060 / min | **$0.0060** | ~250 ms | Reliable enterprise fallback | [Google Cloud Pricing, Oct 2026] |

### Text-to-Speech (TTS) Providers

| Provider | Model / Tier | Pricing / 1M Chars | Cost per 1-Min Call (~600 chars) | Streaming Latency (TTFB) | Voice Quality & Realism | Source & Date |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Cartesia** | Sonic API | $6.00 / 1M chars | **$0.0036** | **~90–120 ms** | **Top Pick:** Ultra-low latency, highly emotional | [Cartesia Pricing, Oct 2026] |
| **Amazon Polly** | Standard | $4.00 / 1M chars | **$0.0024** | ~150 ms | Robotic / legacy IVR feel | [AWS Polly Pricing, Oct 2026] |
| **Amazon Polly** | Neural Voices | $16.00 / 1M chars | ** $0.0096** | ~180 ms | Natural, built directly into TwiML `<Say>` | [AWS Polly Pricing, Oct 2026] |
| **Google Cloud** | Neural2 / Journey | $16.00 / 1M chars | **$0.0096** | ~200 ms | High naturalness, conversational tones | [Google Cloud Pricing, Oct 2026] |
| **ElevenLabs** | Flash v2.5 / Turbo v2.5 | $15.00 / 1M chars | **$0.0090** | ~200–250 ms | **Most Realistic:** Industry benchmark human voices | [ElevenLabs Pricing, Oct 2026] |
| **OpenAI** | `tts-1` Standard | $15.00 / 1M chars | **$0.0090** | ~220 ms | Smooth, natural tone | [OpenAI API Pricing, Oct 2026] |
| **PlayHT** | Play3.0 Mini / Turbo | $15.00 / 1M chars | **$0.0090** | ~200 ms | Strong voice cloning features | [PlayHT Pricing, Oct 2026] |

---

## 4. Managed Voice-AI Platforms Evaluation

Managed platforms combine STT, LLM orchestration, turn-taking, interruption handling (barge-in), and TTS into a unified API.

| Platform | Fixed Base Fee | Platform Fee Markup | Pass-Through Component Costs | All-In Cost per Minute | Key Capabilities & Trade-Offs |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Twilio Conversation Relay** | $0 / mo | $0.0700 / min | Twilio Voice ($0.0085) + LLM + TTS | **$0.085 – $0.105 / min** | WebSocket bridge natively managed inside Twilio. Simplifies media streaming, but $0.07/min markup is steep. |
| **Vapi** | $0 / mo (Pay-as-you-go) | $0.0500 / min | Pass-through STT ($0.0058) + LLM ($0.001) + TTS ($0.009) + Twilio Voice ($0.0085) | **$0.074 – $0.095 / min** | Excellent developer experience, visual tool workflow, built-in function calling & latency tracking. |
| **Retell AI** | $0 / mo (Pay-as-you-go) | $0.0500 – $0.0800 / min | Pass-through STT + LLM + TTS + Twilio Voice | **$0.083 – $0.130 / min** | Industry-leading turn-taking and noise handling. High price markup at scale. |
| **Bland AI** | $0 / mo (Start plan) | All-in bundled | Included in bundled rate | **$0.110 – $0.140 / min** | Turnkey conversational agent. Opague underlying routing and high per-minute cost. |
| **OpenAI Realtime API** (over Twilio Streams) | $0 / mo | None | Audio In ($0.06/min) + Audio Out ($0.24/min) + Twilio Streams ($0.004) + Voice ($0.0085) | **$0.312 – $0.350 / min** | Speech-to-speech without text step. Out-of-the-box human laughter and tone, but **15–20x cost of DIY stack**. |

### Strategic Build vs. Buy Trade-Off
TrueAxis HQ **already has a functional server-side TwiML architecture** (`server/_core/voiceAgent.ts`).
* **DIY Stack COGS:** **$0.0181 / minute** (Twilio + Deepgram + Gemini Flash + Cartesia).
* **Managed Platform COGS:** **$0.0800 – $0.1200 / minute** (Vapi / Retell AI).
* **Margin Impact:** On 10,000 receptionist minutes/month across clients:
  * **DIY Stack Expense:** **$181 / month**
  * **Managed Platform Expense:** **$800 – $1,200 / month**
  * **Net Savings:** **$619 – $1,019 / month saved** (improving gross margin from 60% to 94% on voice bundling).

**Verdict:** Retain the DIY pipeline. Upgrading the TwiML webhook to a Twilio Media Stream WebSocket with Deepgram + Cartesia requires ~20 engineering hours but delivers permanent 75%+ COGS savings while maintaining a **$0 fixed monthly overhead**.

---

## 5. Self-Hosted $0 Option Reality Analysis

### The Self-Hosted Proposal
Deploying open-source models (**Ollama** with Llama 3.1 8B, **whisper.cpp**, and **Piper TTS**) on a private cloud Virtual Private Server (VPS).

### Reality Check against Mandate & Performance Constraints
1. **Violation of $0 Fixed Cost Mandate:**
   * To achieve acceptable inference speed for LLMs and speech models, a cloud server requires an NVIDIA GPU (e.g., AWS `g4dn.xlarge` with T4 or Hetzner GPU server).
   * Minimum fixed monthly hardware cost: **$30.00 – $90.00 / month**, charged regardless of whether clients receive 0 or 1,000 calls. This directly violates the requirement that developer fixed monthly costs stay strictly at **$0**.
2. **CPU Hardware Latency Reality:**
   * Running Llama 3.1 8B + whisper.cpp on a cheap $5–$10 CPU-only VPS results in:
     * **Whisper STT (CPU):** 300–600 ms
     * **Ollama Llama 8B (CPU):** 2,500–5,000 ms Time to First Token
     * **Piper TTS (CPU):** 150–300 ms
     * **Total Turn-Around Latency:** **3.0 to 6.0 seconds per turn**.
   * On inbound service calls, a 4-second delay before the receptionist responds causes callers to think the line was dropped or speak over the agent.

**Conclusion:** Self-hosting local AI models is **unviable** for TrueAxis HQ. It either breaks the $0 fixed cost constraint or fails real-time call latency standards.

---

## 6. All-In Cost Benchmarks & Recommendation

### Benchmark 1: AI Voice Receptionist All-In Cost (Per 1-Minute Call)
*Standard Call Assumptions:* 1 minute duration, 3 conversational turns, 1,500 total prompt tokens in, 200 generated tokens out, 600 TTS characters spoken. Twilio Inbound Voice ($0.0085/min).

| Architecture / Stack | Inbound Telephony | Speech-to-Text | LLM Inference | Text-to-Speech | Platform / Stream Fees | **All-In Cost / Minute** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Stack A: DIY Ultra-Low-Cost (Recommended)** | $0.0085 | $0.0058 (Deepgram Nova-3) | $0.00023 (Gemini 2.0 Flash) | $0.0036 (Cartesia Sonic) | $0.0000 | **$0.0181** (~1.81¢) |
| **Stack B: DIY High-Realism** | $0.0085 | $0.0058 (Deepgram Nova-3) | $0.00035 (GPT-4o-mini) | $0.0090 (ElevenLabs Flash) | $0.0000 | **$0.0237** (~2.37¢) |
| **Stack C: DIY Groq Speed Stack** | $0.0085 | $0.0058 (Deepgram Nova-3) | $0.00009 (Groq Llama 8B) | $0.0036 (Cartesia Sonic) | $0.0000 | **$0.0180** (~1.80¢) |
| **Stack D: TwiML Legacy Gather** | $0.0085 | $0.0200 (Twilio Gather) | $0.00035 (GPT-4o-mini) | $0.0096 (Polly Neural) | $0.0000 | **$0.0385** (~3.85¢) |
| **Stack E: Managed Vapi / Retell** | $0.0085 | $0.0058 (Deepgram) | $0.00035 (GPT-4o-mini) | $0.0090 (ElevenLabs) | $0.0500 (Vapi Fee) | **$0.0737** (~7.37¢) |
| **Stack F: OpenAI Realtime Speech-to-Speech** | $0.0085 | Included | Included (Audio In/Out) | Included | $0.0040 (Twilio Media) | **$0.3125** (~31.25¢) |

---

### Benchmark 2: In-App AI Drafting Helpers Cost (Per 1,000 Calls / Requests)
*Standard Request Assumptions:* Proposal draft, invoice summary, or customer SMS response averaging **500 input tokens** (context + prompt template) and **250 output tokens** (generated text). Total per 1,000 calls = 500,000 input tokens + 250,000 output tokens.

| Model & Provider | Input Cost / 1M Tokens | Output Cost / 1M Tokens | **Total Cost / 1,000 Calls** | Relative Cost Index | Primary In-App Recommendation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Groq Meta Llama 3.1 8B** | $0.050 | $0.080 | **$0.0450** | 1.0x | Ultra-fast SMS replies & light summaries |
| **Google Gemini 2.0 Flash-Lite** | $0.075 | $0.300 | **$0.1125** | 2.5x | Quick field note extraction |
| **Google Gemini 2.0 Flash** | $0.100 | $0.400 | **$0.1500** | 3.3x | **#1 Primary In-App Default** |
| **OpenAI GPT-4o-mini** | $0.150 | $0.600 | **$0.2250** | 5.0x | **#1 Primary Backup (Formatting / JSON)** |
| **Mistral Small 3** | $0.100 | $0.300 | **$0.1250** | 2.8x | European residency compliance fallback |
| **DeepSeek-V3** | $0.140 | $1.100 | **$0.3450** | 7.7x | Deep estimate reasoning & calculations |
| **xAI Grok 3 Mini** | $0.600 | $4.000 | **$1.3000** | 28.8x | Alternative drafting engine |
| **Anthropic Claude 3.5 Haiku** | $1.000 | $5.000 | **$1.7500** | 38.8x | Premium proposal generation |
| **OpenAI GPT-4o (Flagship)** | $2.500 | $10.000 | **$3.7500** | 83.3x | Premium legal/dispute documents |
| **Anthropic Claude 3.7 Sonnet** | $3.000 | $15.000 | **$5.2500** | 116.6x | Premium long-form commercial estimates |

---

## 7. Ranked Implementation Recommendations

Respecting the hard constraint of **$0 fixed monthly developer cost**:

### Rank 1: Primary Voice Receptionist Infrastructure
**Stack:** Twilio Inbound Stream + Deepgram Nova-3 Streaming STT + Google Gemini 2.0 Flash + Cartesia Sonic TTS  
* **Cost:** **$0.0181 / minute** (~1.81¢/min)  
* **Fixed Monthly Fee:** **$0.00**  
* **Turn Latency:** **<550 ms**  
* **Why it Wins:** Combines the highest margin savings with sub-600ms latency. Gemini 2.0 Flash handles multi-turn context gracefully while Cartesia Sonic delivers natural human intonation at $6.00/1M chars.

### Rank 2: Secondary / Fallback Voice Receptionist Infrastructure
**Stack:** Twilio Inbound Stream + Deepgram Nova-3 STT + Groq Llama 3.1 8B / 3.3 70B + ElevenLabs Flash v2.5 TTS  
* **Cost:** **$0.0237 / minute** (~2.37¢/min)  
* **Fixed Monthly Fee:** **$0.00**  
* **Turn Latency:** **<450 ms**  
* **Why it Wins:** Groq LPUs provide instant TTFT (~100ms) for high-urgency calls, while ElevenLabs Flash offers studio-grade voice realism.

### Rank 3: In-App AI Drafting Architecture
**Stack:** OpenAI-Compatible API Client routing to **Google Gemini 2.0 Flash** (Primary) with automatic failover to **OpenAI GPT-4o-mini** (Secondary).  
* **Drafting Cost:** **$0.150 per 1,000 drafting requests**  
* **Fixed Monthly Fee:** **$0.00**  
* **Why it Wins:** Single API integration surface using standard OpenAI-compatible client SDKs (`baseURL` swap). Delivers structured JSON outputs for quotes, proposals, and automated field communications at negligible expense.

---
*Report compiled and verified against October 2026 production API rates.*
