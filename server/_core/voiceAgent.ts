// ─── Voice receptionist engine (Oct 8 2026) ─────────────────────────────────────
// Honest-degradation AI phone answering. Three states, never a dead end:
//   - provider_setup_required: no Twilio env → webhooks fail closed (403)
//   - voicemail_only: Twilio configured but no LLM (or plan/owner chose
//     voicemail) → greeting + voicemail recording, still a complete experience
//   - ai_ready: LLM configured + Pro plan + agentMode "ai" → conversational
//     receptionist that answers questions and captures leads.
// $0 fixed cost: reuses the deployment's Twilio credentials and any
// OpenAI-compatible LLM the deployment already runs (including self-hosted).

import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "./env";
import { invokeLLM } from "./llm";

export const VOICE_MAX_TURNS = 6;
export const VOICE_DEFAULT_GREETING = "Thanks for calling! I'm the after-hours receptionist. How can I help you today?";

export type VoiceStatusState = "provider_setup_required" | "voicemail_only" | "ai_ready";

export function getVoiceStatus(): {
  state: VoiceStatusState;
  twilioConfigured: boolean;
  llmConfigured: boolean;
  fromNumber: string | null;
} {
  const twilioConfigured = Boolean(ENV.twilioAccountSid && ENV.twilioAuthToken);
  const llmConfigured = Boolean(ENV.forgeApiKey);
  const state: VoiceStatusState = !twilioConfigured
    ? "provider_setup_required"
    : llmConfigured
      ? "ai_ready"
      : "voicemail_only";
  return { state, twilioConfigured, llmConfigured, fromNumber: twilioConfigured ? ENV.twilioFromNumber : null };
}

// ─── Twilio request authentication ─────────────────────────────────────────────
// Twilio signs every webhook: HMAC-SHA1(authToken, fullUrl + sorted k=v pairs).
// Fail closed: no auth token configured → nothing validates → 403.

export function computeTwilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data = url + Object.keys(params).sort().map(k => k + (params[k] ?? "")).join("");
  return createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
}

export function validateTwilioSignature(url: string, params: Record<string, string>, signature: string | null): boolean {
  const token = ENV.twilioAuthToken;
  if (!token || !signature) return false;
  const expected = Buffer.from(computeTwilioSignature(token, url, params));
  const received = Buffer.from(signature);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

// ─── Conversation engine ───────────────────────────────────────────────────────

export type VoiceTurn = { role: "caller" | "agent"; text: string; at: string };

export type AgentDecision = {
  say: string;
  intent: "ask" | "lead_captured" | "info_given" | "handoff" | "end";
  callerName?: string;
  callerPhone?: string;
  serviceRequested?: string;
  preferredTime?: string;
};

const agentSchema = {
  name: "voice_agent_decision",
  schema: {
    type: "object",
    properties: {
      say: { type: "string", description: "What the receptionist speaks next. Under 80 words, warm and professional." },
      intent: { type: "string", enum: ["ask", "lead_captured", "info_given", "handoff", "end"] },
      callerName: { type: "string" },
      callerPhone: { type: "string" },
      serviceRequested: { type: "string" },
      preferredTime: { type: "string" },
    },
    required: ["say", "intent"],
    additionalProperties: false,
  },
} as const;

/** Ask the LLM for the next receptionist move. Throws if the LLM is not
 *  configured (assertApiKey inside invokeLLM) — the caller degrades to
 *  voicemail rather than pretending. */
export async function decideNextTurn(input: {
  greeting: string;
  businessInfo: string;
  turns: VoiceTurn[];
  callerSpeech: string;
}): Promise<AgentDecision> {
  const system = [
    "You are the phone receptionist for a home-service business. You answer questions,",
    "capture leads (name, phone, service, preferred time), and never invent facts.",
    "Business info you may quote: " + (input.businessInfo?.trim() || "(none provided — say you will have the owner follow up)"),
    "Rules: keep replies under 80 words. Set intent=lead_captured once you have name AND",
    "service (phone optional; we already see the caller's number). Set intent=info_given",
    "when you answered a question and there is nothing more to do. Set intent=handoff",
    "only for emergencies or angry callers: say the owner will be texted immediately.",
    "Set intent=end when the caller says goodbye. Otherwise ask one clear question (intent=ask).",
    "Never mention you are an AI unless asked directly; if asked, answer honestly.",
  ].join(" ");

  const history = input.turns.slice(-8).map(t => `${t.role === "caller" ? "Caller" : "Receptionist"}: ${t.text}`).join("\n");
  const result = await invokeLLM({
    messages: [
      { role: "system", content: system },
      { role: "user", content: (history ? history + "\n" : "") + `Caller: ${input.callerSpeech}` },
    ],
    outputSchema: agentSchema,
    maxTokens: 300,
  });
  const raw = result.choices?.[0]?.message?.content ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
  } catch {
    throw new Error("voice agent: LLM returned unparseable JSON");
  }
  const d = parsed as AgentDecision;
  if (typeof d.say !== "string" || !d.say.trim() || !agentSchema.schema.properties.intent.enum?.includes(d.intent as never)) {
    throw new Error("voice agent: LLM returned invalid decision");
  }
  return { ...d, say: d.say.trim().slice(0, 4000) };
}

/** Extract key facts from a caller's speech for lead dedup/attachment. */
export function sanitizeCallerFact(value: string | undefined, max = 300): string | null {
  const clean = (value ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, max) : null;
}

export function newCallTranscript(firstCallerSpeech: string): VoiceTurn[] {
  return [{ role: "caller", text: firstCallerSpeech.slice(0, 1000), at: new Date().toISOString() }];
}

export function appendTurn(turns: VoiceTurn[], turn: VoiceTurn): VoiceTurn[] {
  const next = [...turns, turn];
  return next.slice(-24); // bounded transcript, matches the 6-turn × bidirectional cap
}
