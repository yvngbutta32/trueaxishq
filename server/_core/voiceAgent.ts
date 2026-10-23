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

export type VoiceLanguage = "en" | "es";
export function normalizeVoiceLanguage(value: string | null | undefined): VoiceLanguage {
  return value === "es" ? "es" : "en";
}

// Default greetings disclose the AI upfront (research verdict: homeowners
// accept AI that discloses; >80% hang up on voicemail — ai-receptionist-landscape-2026.md).
export const VOICE_DEFAULT_GREETINGS: Record<VoiceLanguage, string> = {
  en: "Thanks for calling! You've reached our virtual receptionist — I'm an AI assistant, and I'm here to help. How can I help you today?",
  es: "Gracias por llamar. Ha llegado a nuestra recepcionista virtual, un asistente de inteligencia artificial. ¿En qué puedo ayudarle?",
};
// Back-compat alias for existing imports.
export const VOICE_DEFAULT_GREETING = VOICE_DEFAULT_GREETINGS.en;

/** Every spoken fixed prompt, per language. A missing key is a bug — the
 *  phrase-parity test pins en and es to the same key set. */
export const VOICE_PHRASES: Record<VoiceLanguage, Record<string, string>> = {
  en: {
    retry: "Sorry, I did not catch that. Could you say that again? You can also press zero to reach a person.",
    anythingElse: "Is there anything else I can help with?",
    leadSaved: "We have saved your details and will follow up shortly. Goodbye!",
    switchingToVoicemail: "One moment, I am switching to message mode.",
    leaveAMessage: "Let me take a message so the team can follow up.",
    callbackHours: "Please call back during business hours. Goodbye.",
    transferConnecting: "One moment, connecting you with a team member now.",
    transferUnavailable: "No one is available to take your call right now. Let me take a message so someone can follow up.",
    pressZeroHint: "Press zero at any time to reach a person.",
    callBackLater: "The number you have dialed is not accepting calls right now. Please try again later.",
    technicalProblem: "We are having a technical problem right now. Please try again in a few minutes.",
  },
  es: {
    retry: "Lo siento, no le entendí. ¿Podría repetirlo? También puede marcar cero para hablar con una persona.",
    anythingElse: "¿En qué más puedo ayudarle?",
    leadSaved: "Hemos guardado sus datos y le contactaremos pronto. ¡Adiós!",
    switchingToVoicemail: "Un momento, cambio al modo de mensajes.",
    leaveAMessage: "Permítame tomar un mensaje para que el equipo le contacte.",
    callbackHours: "Por favor, llame de nuevo en horario de atención. Adiós.",
    transferConnecting: "Un momento, le comunico con un miembro del equipo.",
    transferUnavailable: "Nadie está disponible para atender su llamada en este momento. Permítame tomar un mensaje para que alguien le contacte.",
    pressZeroHint: "Marque cero en cualquier momento para hablar con una persona.",
    callBackLater: "El número al que llama no está recibiendo llamadas en este momento. Por favor, intente más tarde.",
    technicalProblem: "Tenemos un problema técnico en este momento. Por favor, intente en unos minutos.",
  },
};
export function phrase(language: VoiceLanguage, key: keyof typeof VOICE_PHRASES.en): string {
  return VOICE_PHRASES[language][key];
}

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
  language?: string;
}): Promise<AgentDecision> {
  const language = normalizeVoiceLanguage(input.language);
  const langName = language === "es" ? "Spanish (español)" : "English";
  const system = [
    "You are the AI virtual receptionist for a home-service business. You answer questions,",
    "capture leads (name, phone, service, preferred time), and never invent facts.",
    `Respond ONLY in ${langName}, whatever language the caller uses.`,
    "Business info you may quote: " + (input.businessInfo?.trim() || "(none provided — say you will have the owner follow up)"),
    "GROUNDING RULES (absolute): you have NO access to the schedule, prices, quotes, or",
    "availability. Never state, guess, promise, or invent any price, availability, time slot,",
    "or booking confirmation. If asked about those, say you will pass the request to the team",
    "for exact details, and capture it as a lead instead.",
    "DISCLOSURE RULE: you are honest that you are an AI virtual assistant; if this is your",
    "first reply of the conversation, briefly mention you are a virtual assistant.",
    "Rules: keep replies under 80 words. Set intent=lead_captured once you have name AND",
    "service (phone optional; we already see the caller's number). Set intent=info_given",
    "when you answered a question and there is nothing more to do. Set intent=handoff",
    "only for emergencies or angry callers: say the owner will be texted immediately and offer",
    "to connect them by pressing zero if they need a person.",
    "Set intent=end when the caller says goodbye. Otherwise ask one clear question (intent=ask).",
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
