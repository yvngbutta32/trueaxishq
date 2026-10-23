import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  VOICE_LANGUAGES, VOICE_DEFAULT_GREETINGS, VOICE_PHRASES, languageMenuChoices,
  normalizeVoiceLanguage, voiceLanguageMeta,
} from "./_core/voiceAgent";
import { buildSay, buildGather, sayVoiceFor, gatherLocale } from "./_core/voiceTwiML";
import { VOICE_LANGUAGE_CODES } from "../shared/voiceLanguageOptions";

// Ten-language support (Oct 23 2026) — "used by everyone seamlessly": the 10
// most-spoken languages of the US+Canada SMB market, per US Census ACS +
// StatCan 2021. Every STT/TTS code below was verified against Twilio's own
// SDK type unions (twilio-node 5.13.1: GatherLanguage / SayVoice /
// SayLanguage) — an unsupported pair would break live calls. These tests pin
// the exact strings so the registry can never drift from what Twilio accepts.

const read = (f: string) => readFileSync(resolve(__dirname, f), "utf-8");

// Extracted verbatim from twilio-node 5.13.1 lib/twiml/VoiceResponse.d.ts
// (type GatherLanguage) on Oct 23 2026. Provenance: npm-installed, official SDK.
const TWILIO_GATHER_LOCALES = new Set([
  "af-ZA","am-ET","ar-AE","ar-BH","ar-DZ","ar-EG","ar-IL","ar-IQ","ar-JO","ar-KW","ar-LB","ar-MA","ar-OM","ar-PS","ar-QA","ar-SA","ar-TN","az-AZ","bg-BG","bn-BD","bn-IN","ca-ES","cs-CZ","da-DK","de-DE","el-GR","en-AU","en-CA","en-GB","en-GH","en-IE","en-IN","en-KE","en-NG","en-NZ","en-PH","en-SG","en-TZ","en-US","en-ZA","es-AR","es-BO","es-CL","es-CO","es-CR","es-DO","es-EC","es-ES","es-GT","es-HN","es-MX","es-NI","es-PA","es-PE","es-PR","es-PY","es-SV","es-US","es-UY","es-VE","et-EE","eu-ES","fa-IR","fi-FI","fil-PH","fr-CA","fr-FR","gl-ES","gu-IN","he-IL","hi-IN","hr-HR","hu-HU","hy-AM","id-ID","is-IS","it-IT","ja-JP","jv-ID","ka-GE","km-KH","kn-IN","ko-KR","lo-LA","lt-LT","lv-LV","mk-MK","ml-IN","mn-MN","mr-IN","ms-MY","my-MM","nar-IQ","nb-NO","ne-NP","nl-BE","nl-NL","pa-guru-IN","pl-PL","pt-BR","pt-PT","ro-RO","ru-RU","si-LK","sk-SK","sl-SI","sq-AL","sr-RS","su-ID","sv-SE","sw-KE","sw-TZ","ta-IN","ta-LK","ta-MY","ta-SG","te-IN","th-TH","tr-TR","uk-UA","ur-IN","ur-PK","uz-UZ","vi-VN","yue-Hant-HK","zh","cmn-Hans-CN","zh-TW","cmn-Hant-TW","zu-ZA",
]);

// The exact voice/language pairs verified against twilio-node 5.13.1
// (SayVoice/SayLanguage unions) on Oct 23 2026.
const EXPECTED_TTS: Record<string, { voice: string | null; language: string }> = {
  en: { voice: null, language: "en-US" },
  es: { voice: "Polly.Mia", language: "es-MX" },
  fr: { voice: "Polly.Chantal", language: "fr-CA" },
  zh: { voice: "Polly.Zhiyu", language: "zh-CN" },
  yue: { voice: "Google.yue-HK-Standard-A", language: "yue-HK" },
  fil: { voice: "Google.fil-PH-Standard-A", language: "fil-PH" },
  vi: { voice: "Google.vi-VN-Standard-A", language: "vi-VN" },
  ar: { voice: "Google.ar-XA-Standard-A", language: "ar-XA" },
  ko: { voice: "Polly.Seoyeon", language: "ko-KR" },
  pa: { voice: "Google.pa-IN-Standard-A", language: "pa-IN" },
};

const CODES = VOICE_LANGUAGES.map(l => l.code);

describe("registry: 10 languages, every code Twilio-verifiable", () => {
  it("exactly the ten market languages, in census-ranked order", () => {
    expect(CODES).toEqual(["en", "es", "fr", "zh", "yue", "fil", "vi", "ar", "ko", "pa"]);
  });
  it("every STT locale exists in Twilio's GatherLanguage union", () => {
    for (const lang of VOICE_LANGUAGES) {
      expect(TWILIO_GATHER_LOCALES.has(lang.gatherLocale)).toBe(true);
      expect(gatherLocale(lang.code)).toBe(lang.gatherLocale);
    }
  });
  it("every TTS voice/language pair matches the verified pairs exactly", () => {
    for (const lang of VOICE_LANGUAGES) {
      expect(lang.sayVoice).toBe(EXPECTED_TTS[lang.code].voice);
      expect(lang.sayLanguage).toBe(EXPECTED_TTS[lang.code].language);
      expect(sayVoiceFor(lang.code)).toEqual({ voice: lang.sayVoice, language: lang.sayLanguage });
    }
  });
  it("each language has 9 spoken digit words and a {d} menu template", () => {
    for (const lang of VOICE_LANGUAGES) {
      expect(lang.digitWords.length).toBe(9);
      expect(new Set(lang.digitWords).size).toBe(9); // no duplicate spoken digits
      expect(lang.menuEntry).toContain("{d}");
    }
  });
  it("shared UI list never drifts from the server registry", () => {
    expect([...VOICE_LANGUAGE_CODES]).toEqual(CODES);
  });
  it("normalize accepts all ten, degrades anything else to English", () => {
    for (const code of CODES) expect(normalizeVoiceLanguage(code)).toBe(code);
    expect(normalizeVoiceLanguage("de")).toBe("en"); // German: a valid language we do not ship
    expect(normalizeVoiceLanguage("EN")).toBe("en");
    expect(normalizeVoiceLanguage(null)).toBe("en");
  });
});

describe("phrase + greeting parity across all ten languages", () => {
  it("every language carries the identical non-empty key set", () => {
    const reference = Object.keys(VOICE_PHRASES.en).sort();
    expect(reference.length).toBeGreaterThanOrEqual(13);
    for (const code of CODES) {
      expect(Object.keys(VOICE_PHRASES[code as keyof typeof VOICE_PHRASES]).sort()).toEqual(reference);
      // CJK glyphs carry roughly a word each — a shorter floor there.
      const floor = ["zh", "yue", "ko"].includes(code) ? 5 : 8;
      for (const [k, v] of Object.entries(VOICE_PHRASES[code as keyof typeof VOICE_PHRASES])) {
        expect(v.length).toBeGreaterThan(floor);
        expect(v.length).toBeLessThan(400);
        expect(v).not.toMatch(/^\s/);
      }
    }
  });
  it("every language has a disclosed, non-empty default greeting", () => {
    for (const code of CODES) {
      const greeting = VOICE_DEFAULT_GREETINGS[code as keyof typeof VOICE_DEFAULT_GREETINGS];
      expect(greeting.length).toBeGreaterThan(15);
      expect(greeting.length).toBeLessThan(400);
    }
    // Disclosure stays verifiable in the Latin-script languages we can pattern-match.
    expect(VOICE_DEFAULT_GREETINGS.en).toMatch(/AI assistant/i);
    expect(VOICE_DEFAULT_GREETINGS.es).toMatch(/inteligencia artificial/i);
    expect(VOICE_DEFAULT_GREETINGS.fr).toMatch(/intelligence artificielle/i);
    expect(VOICE_DEFAULT_GREETINGS.fil).toMatch(/AI assistant/i);
  });
  it("press-zero and press-nine hints exist in every language", () => {
    for (const code of CODES) {
      const phrases = VOICE_PHRASES[code as keyof typeof VOICE_PHRASES];
      expect(phrases.pressZeroHint.length).toBeGreaterThan(8);
      expect(phrases.languageMenuHint.length).toBeGreaterThan(8);
      expect(phrases.chooseLanguage.length).toBeGreaterThan(4);
    }
  });
});

describe("press-9 language menu: render side == selection side", () => {
  it("the menu lists exactly the other nine languages, digits 1..9", () => {
    for (const active of CODES) {
      const choices = languageMenuChoices(active as never);
      expect(choices.map(c => c.digit)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(choices.map(c => c.language).sort()).toEqual(CODES.filter(c => c !== active).sort());
      expect(choices.every(c => c.language !== active)).toBe(true);
    }
  });
  it("every rendered entry speaks its digit inside the entry's own language", () => {
    for (const active of CODES) {
      const rendered = languageMenuChoices(active as never).map(c => {
        const meta = voiceLanguageMeta(c.language);
        return meta.menuEntry.replace("{d}", meta.digitWords[c.digit - 1]);
      });
      for (const entry of rendered) expect(entry).not.toContain("{d}");
      // Digits stay reachable: each entry template exists for all languages.
      for (const lang of VOICE_LANGUAGES) expect(lang.menuEntry).toContain("{d}");
    }
  });
});

describe("TwiML carries voice+language for non-English, bare Say for English", () => {
  it("English stays on the free default engine (no voice attribute)", () => {
    expect(buildSay("Hello")).toBe("<Say>Hello</Say>");
    const { voice } = sayVoiceFor("en");
    expect(voice).toBeNull();
  });
  it("Spanish says carry the Mia voice and es-MX language", () => {
    expect(buildSay("Hola", sayVoiceFor("es"))).toContain('voice="Polly.Mia"');
    expect(buildSay("Hola", sayVoiceFor("es"))).toContain('language="es-MX"');
  });
  it("gather prompts speak in the conversation language", () => {
    const gather = buildGather("https://x.test/g", "Merci", { language: "fr" });
    expect(gather).toContain('language="fr-CA"'); // STT
    expect(gather).toContain('voice="Polly.Chantal"'); // TTS
  });
  it("Chinese, Cantonese, Tagalog, Vietnamese, Arabic, Korean, Punjabi all emit named voices", () => {
    for (const code of ["zh", "yue", "fil", "vi", "ar", "ko", "pa"]) {
      const { voice, language } = sayVoiceFor(code);
      expect(voice).toMatch(/^(Polly|Google)\./);
      expect(buildSay("x", { voice, language })).toContain(`voice="${voice}"`);
      expect(buildSay("x", { voice, language })).toContain(`language="${language}"`);
    }
  });
});

describe("live-call wiring: caller language persists and zero stays reserved", () => {
  it("the call row carries the caller-selected language (migration 0085 + journal)", () => {
    const schema = read("../drizzle/schema.ts");
    expect(schema).toMatch(/language: varchar\("language", \{ length: 8 \}\)/);
    const migration = read("../drizzle/0085_voice_call_language.sql");
    expect(migration).toContain("ADD COLUMN `language`");
    const journal = JSON.parse(read("../drizzle/meta/_journal.json"));
    expect(journal.entries.some((e: { tag?: string }) => e.tag === "0085_voice_call_language")).toBe(true);
  });
  it("press-nine opens the menu from the gather, and the selection webhook round-trips", () => {
    const api = read("voiceApi.ts");
    expect(api).toContain('digits === "9"');
    expect(api).toContain('voiceApiRouter.post("/language"');
    expect(api).toContain("languageMenuChoices(lang).find(c => c.digit === digit)"); // render == selection mapping
    expect(api).toContain("set({ language: choice.language })");
    expect(api).toContain("buildRedirect(`${baseUrl(req)}/api/voice/answer?u=${ctx.userId}`)"); // replay greeting
  });
  it("zero stays reserved for the human transfer, even inside the language menu", () => {
    const api = read("voiceApi.ts");
    const languageHandler = api.slice(api.indexOf('voiceApiRouter.post("/language"'), api.indexOf('voiceApiRouter.post("/dial-end"'));
    expect(languageHandler).toContain('=== "0"');
    expect(languageHandler).toContain("buildDial(ctx.transferNumber");
  });
  it("every Gather on the call path passes the per-call language", () => {
    const api = read("voiceApi.ts");
    const gatherCount = (api.split("buildGather(").length - 1) + (api.split("buildGatherWithChildren(").length - 1);
    const withLang = api.split("{ language: lang }").length - 1;
    expect(withLang).toBe(gatherCount);
    expect(api).not.toContain("{ language: ctx.language }"); // per-call choice always wins
  });
  it("non-English prompts never fall back to the English default voice on the call path", () => {
    const api = read("voiceApi.ts");
    expect(api.split("say(lang,").length - 1).toBeGreaterThanOrEqual(11);
    expect(api).not.toMatch(/buildSay\(phrase\(lang/); // the say() helper injects voice+language
  });
  it("the settings card lists all ten languages and tells owners about press-9", () => {
    const ui = read("../client/src/pages/IntegrationHub.tsx");
    expect(ui).toContain("VOICE_LANGUAGE_OPTIONS.map");
    expect(ui).toContain("press 9");
    const shared = read("../shared/voiceLanguageOptions.ts");
    expect(shared).toContain('"pa"');
  });
});
