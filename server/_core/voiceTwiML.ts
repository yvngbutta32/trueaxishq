// ─── Zero-dependency TwiML builder (Oct 8 2026) ────────────────────────────────
// The voice receptionist speaks Twilio's TwiML dialect. We generate it by hand
// with XML escaping and strict tag whitelisting — no Twilio SDK, no surprises.
// Every builder returns a string; renderTwiML() wraps them in a valid document.

import { normalizeVoiceLanguage, voiceLanguageMeta } from "./voiceAgent";

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Spoken text. English keeps the bare default <Say> voice (no named voice,
 *  no per-character TTS charge). Every other language MUST carry a matching
 *  voice + language pair — the default engine is English-only and garbles
 *  non-English text. Voice/language values come from VOICE_LANGUAGES, each
 *  verified against twilio-node's GatherLanguage/SayVoice/SayLanguage unions.
 *  Named voices bill per character used (usage-based, $0 fixed cost). */
export function buildSay(text: string, opts?: { voice?: string | null; language?: string }): string {
  const clean = text.replace(/[""''—–…]/g, "'").replace(/\s+/g, " ").trim();
  if (!clean) throw new Error("buildSay: empty text");
  if (clean.length > 4000) throw new Error("buildSay: text too long for one turn");
  const attrs = opts?.voice && opts.language ? ` voice="${xmlEscape(opts.voice)}" language="${xmlEscape(opts.language)}"` : "";
  return `<Say${attrs}>${xmlEscape(clean)}</Say>`;
}

/** STT locale per conversation language, from the verified registry. */
export function gatherLocale(language: string): string {
  return voiceLanguageMeta(normalizeVoiceLanguage(language)).gatherLocale;
}

/** TTS voice/language attributes for a conversation language, for buildSay. */
export function sayVoiceFor(language: string): { voice: string | null; language: string } {
  const meta = voiceLanguageMeta(normalizeVoiceLanguage(language));
  return { voice: meta.sayVoice, language: meta.sayLanguage };
}

/** Collect caller speech. actionUrl must be absolute on the deployment origin. */
export function buildGather(actionUrl: string, promptSay: string, opts?: { hints?: string[]; language?: string }): string {
  return buildGatherWithChildren(actionUrl, [buildSay(promptSay, opts?.language ? sayVoiceFor(opts.language) : undefined)], opts);
}

/** A Gather that speaks several <Say> children then listens — used by the
 *  language menu, where each option is announced in its own language. */
export function buildGatherWithChildren(actionUrl: string, sayChildren: string[], opts?: { hints?: string[]; language?: string }): string {
  if (!/^https?:\/\//.test(actionUrl)) throw new Error("buildGather: action URL must be absolute http(s)");
  const attrs = [
    'input="speech dtmf"',
    'speechTimeout="auto"',
    'action="' + xmlEscape(actionUrl) + '"',
    'method="POST"',
    'language="' + gatherLocale(opts?.language ?? "en") + '"',
  ];
  if (opts?.hints?.length) {
    const hints = opts.hints.slice(0, 12).map(h => h.replace(/[<>"]/g, "").trim()).filter(Boolean);
    if (hints.length) attrs.push(`hints="${xmlEscape(hints.join(","))}"`);
  }
  return `<Gather ${attrs.join(" ")}>${sayChildren.join("")}</Gather>`;
}

/** Voicemail: record a message. actionUrl receives the RecordingUrl. */
export function buildRecord(actionUrl: string, maxLengthSeconds = 120): string {
  if (!/^https?:\/\//.test(actionUrl)) throw new Error("buildRecord: action URL must be absolute http(s)");
  return `<Record action="${xmlEscape(actionUrl)}" method="POST" maxLength="${Math.min(Math.max(maxLengthSeconds, 10), 300)}" playBeep="true" transcribe="false" />`;
}

/** Warm transfer to a human (documented failure-mode fix: never drop an
 *  emergency transfer). number must be E.164; callerId must be E.164 or omitted.
 *  actionUrl receives the DialCallStatus when the transfer ends. */
export function buildDial(number: string, actionUrl: string, callerId?: string): string {
  if (!/^\+[1-9]\d{7,14}$/.test(number)) throw new Error("buildDial: number must be E.164 (e.g. +15551234567)");
  if (!/^https?:\/\//.test(actionUrl)) throw new Error("buildDial: action URL must be absolute http(s)");
  if (callerId && !/^\+[1-9]\d{7,14}$/.test(callerId)) throw new Error("buildDial: callerId must be E.164 or omitted");
  const attrs = [
    'action="' + xmlEscape(actionUrl) + '"',
    'method="POST"',
    'timeout="30"',
  ];
  if (callerId) attrs.push('callerId="' + xmlEscape(callerId) + '"');
  return `<Dial ${attrs.join(" ")}>${xmlEscape(number)}</Dial>`;
}

/** Redirect the call to another TwiML URL. Method POST keeps our signature
 *  verification intact (Twilio signs redirect requests like webhooks). */
export function buildRedirect(url: string, method: "POST" | "GET" = "POST"): string {
  if (!/^https?:\/\//.test(url)) throw new Error("buildRedirect: URL must be absolute http(s)");
  return `<Redirect method="${method}">${xmlEscape(url)}</Redirect>`;
}

export function buildHangup(): string {
  return "<Hangup/>";
}

export function renderTwiML(children: string[]): string {
  const body = children.filter(c => typeof c === "string" && c.length > 0).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}
