// Shared between client UI and server registry. VOICE_LANGUAGES in
// server/_core/voiceAgent.ts is the source of truth; voiceLanguages.test.ts
// pins this list against it so the two can never drift.
const CODES = ["en", "es", "fr", "zh", "yue", "fil", "vi", "ar", "ko", "pa"] as const;
const LABELS: Record<(typeof CODES)[number], string> = {
  en: "English",
  es: "Español (Spanish)",
  fr: "Français (French)",
  zh: "普通话 (Mandarin)",
  yue: "廣東話 (Cantonese)",
  fil: "Tagalog",
  vi: "Tiếng Việt (Vietnamese)",
  ar: "العربية (Arabic)",
  ko: "한국어 (Korean)",
  pa: "ਪੰਜਾਬੀ (Punjabi)",
};

export type VoiceLanguageOptionCode = (typeof CODES)[number];
export const VOICE_LANGUAGE_CODES: readonly VoiceLanguageOptionCode[] = CODES;
export const VOICE_LANGUAGE_OPTIONS: { code: VoiceLanguageOptionCode; label: string }[] =
  CODES.map(code => ({ code, label: LABELS[code] }));

export function normalizeLanguageOption(value: string | null | undefined): VoiceLanguageOptionCode {
  return value && (VOICE_LANGUAGE_CODES as readonly string[]).includes(value) ? (value as VoiceLanguageOptionCode) : "en";
}
