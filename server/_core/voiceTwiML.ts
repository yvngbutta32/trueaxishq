// ─── Zero-dependency TwiML builder (Oct 8 2026) ────────────────────────────────
// The voice receptionist speaks Twilio's TwiML dialect. We generate it by hand
// with XML escaping and strict tag whitelisting — no Twilio SDK, no surprises.
// Every builder returns a string; renderTwiML() wraps them in a valid document.

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Spoken text. voice/pick "Polly" voices cost extra on some engines; the default
 *  engine is included with Twilio calls, so we never request a named voice. */
export function buildSay(text: string): string {
  const clean = text.replace(/[""''—–…]/g, "'").replace(/\s+/g, " ").trim();
  if (!clean) throw new Error("buildSay: empty text");
  if (clean.length > 4000) throw new Error("buildSay: text too long for one turn");
  return `<Say>${xmlEscape(clean)}</Say>`;
}

/** STT locale per conversation language. Both are documented Twilio <Gather>
 *  STT locales (twilio.com/docs/voice/twiml/gather language appendix);
 *  es-MX matches North American Spanish callers. */
export function gatherLocale(language: string): string {
  return language === "es" ? "es-MX" : "en-US";
}

/** Collect caller speech. actionUrl must be absolute on the deployment origin. */
export function buildGather(actionUrl: string, promptSay: string, opts?: { hints?: string[]; language?: string }): string {
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
  return `<Gather ${attrs.join(" ")}>${buildSay(promptSay)}</Gather>`;
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

export function buildHangup(): string {
  return "<Hangup/>";
}

export function buildRedirect(url: string): string {
  if (!/^https?:\/\//.test(url)) throw new Error("buildRedirect: absolute URL required");
  return `<Redirect method="POST">${xmlEscape(url)}</Redirect>`;
}

export function renderTwiML(children: string[]): string {
  const body = children.filter(c => typeof c === "string" && c.length > 0).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}
