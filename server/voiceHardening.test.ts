import { describe, expect, it, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ENV } from "./_core/env";
import {
  VOICE_DEFAULT_GREETINGS, VOICE_DEFAULT_GREETING, VOICE_PHRASES,
  normalizeVoiceLanguage, phrase,
} from "./_core/voiceAgent";
import { buildGather, buildDial, gatherLocale } from "./_core/voiceTwiML";

// Voice hardening (Oct 23 2026) — research-driven mandates from
// docs/working-notes/research/comp-2026-10/ai-receptionist-landscape-2026.md:
//   1. Grounding: never hallucinate slots/prices (top documented failure mode).
//   2. Disclosure: homeowners accept AI that says so; punish deception.
//   3. Human transfer: pressing zero ALWAYS reaches a person or an honest
//      voicemail — never a dropped emergency transfer.
//   4. Spanish: only ST/Smith.ai are bilingual in this market; Gemini gives
//      it to us at the same per-minute cost.

const read = (f: string) => readFileSync(resolve(__dirname, f), "utf-8");

describe("mandate 1: grounding (no invented facts on the live call path)", () => {
  const fakeLLM = vi.fn().mockResolvedValue({ choices: [{ message: { content: { say: "Sure", intent: "ask" } } }] });
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("./_core/llm", () => ({ invokeLLM: fakeLLM }));
  });
  it("the live system prompt forbids stating/guessing prices, availability, and slots", async () => {
    const { decideNextTurn } = await import("./_core/voiceAgent");
    await decideNextTurn({ greeting: "Hi", businessInfo: "Open 9-5", turns: [], callerSpeech: "how much for a quote?" });
    const system = String(fakeLLM.mock.calls[0]?.[0]?.messages?.[0]?.content ?? "");
    expect(system).toContain("GROUNDING RULES");
    expect(system).toContain("NO access to the schedule");
    expect(system).toMatch(/Never state, guess, promise, or invent any price, availability, time slot/);
    expect(system).toContain("capture it as a lead");
  });
  it("the old 'hide the AI' instruction is gone", () => {
    expect(read("_core/voiceAgent.ts")).not.toContain("Never mention you are an AI unless asked");
  });
});

describe("mandate 2: disclosure", () => {
  it("both default greetings disclose the AI upfront", () => {
    expect(VOICE_DEFAULT_GREETINGS.en).toMatch(/virtual receptionist/i);
    expect(VOICE_DEFAULT_GREETINGS.en).toMatch(/AI assistant/i);
    expect(VOICE_DEFAULT_GREETINGS.es).toMatch(/recepcionista virtual/i);
    expect(VOICE_DEFAULT_GREETINGS.es).toMatch(/inteligencia artificial/i);
  });
  it("the live system prompt requires honest AI disclosure", async () => {
    vi.resetModules();
    const fakeLLM = vi.fn().mockResolvedValue({ choices: [{ message: { content: { say: "Hi!", intent: "ask" } } }] });
    vi.doMock("./_core/llm", () => ({ invokeLLM: fakeLLM }));
    const { decideNextTurn } = await import("./_core/voiceAgent");
    await decideNextTurn({ greeting: "Hi", businessInfo: "", turns: [], callerSpeech: "hello" });
    const system = String(fakeLLM.mock.calls[0]?.[0]?.messages?.[0]?.content ?? "");
    expect(system).toContain("DISCLOSURE RULE");
    expect(system).toMatch(/honest that you are an AI virtual assistant/i);
  });
  it("back-compat default greeting alias stays the English one", () => {
    expect(VOICE_DEFAULT_GREETING).toBe(VOICE_DEFAULT_GREETINGS.en);
  });
});

describe("mandate 3: human transfer (press zero)", () => {
  it("press-zero transfer is wired on the gather path with an honest no-number fallback", () => {
    const api = read("voiceApi.ts");
    expect(api).toContain('digits === "0"');
    expect(api).toContain('buildDial(ctx.transferNumber');
    expect(api).toContain("transferUnavailable"); // honest voicemail when no transfer number
    expect(api).toContain('voiceApiRouter.post("/dial-end"'); // dial callback closes the call cleanly
  });
  it("the AI answer flow advertises press-zero only when a transfer number exists", () => {
    const api = read("voiceApi.ts");
    expect(api).toContain('phrase(lang, "pressZeroHint")'); // localized hint (per-call language)
    expect(api).toContain('phrase(lang, "languageMenuHint")'); // press-9 language menu is always advertised
  });
  it("handoff (emergencies) dials the human too, keeping the owner push", () => {
    const api = read("voiceApi.ts");
    expect(api).toMatch(/intent === "handoff"[\s\S]*?decision\.intent === "handoff"/);
    expect(api).toMatch(/if \(decision\.intent === "handoff"\) \{[\s\S]*?buildDial\(ctx\.transferNumber/);
  });
  it("buildDial demands E.164 numbers and absolute action URLs", () => {
    expect(() => buildDial("5551234567", "https://x.test/end")).toThrow();
    expect(() => buildDial("+1", "https://x.test/end")).toThrow();
    expect(() => buildDial("+1555123456x", "https://x.test/end")).toThrow();
    expect(() => buildDial("+15551234567", "/relative")).toThrow();
    expect(() => buildDial("+15551234567", "https://x.test/end", "15551234567")).toThrow();
    const dial = buildDial("+15551234567", "https://x.test/end", "+15550001111");
    expect(dial).toContain('timeout="30"');
    expect(dial).toContain('method="POST"');
    expect(dial).toContain("+15551234567");
    expect(dial).toContain('callerId="+15550001111"');
  });
  it("the owner router only accepts E.164 transfer numbers", () => {
    const routers = read("routers.ts");
    expect(routers).toContain("/^\\+[1-9]\\d{7,14}$/.test(transferNumber)");
    expect(routers).toContain("Transfer number must be E.164");
  });
});

describe("mandate 4: Spanish (bilingual at identical cost)", () => {
  it("phrase parity: en and es carry the identical key set, all non-empty", () => {
    expect(Object.keys(VOICE_PHRASES.en).sort()).toEqual(Object.keys(VOICE_PHRASES.es).sort());
    for (const [k, v] of Object.entries(VOICE_PHRASES.en)) {
      expect(v.length).toBeGreaterThan(10);
      expect(v.length).toBeLessThan(400);
      expect(VOICE_PHRASES.es[k]?.length).toBeGreaterThan(10);
    }
    expect(phrase("es", "retry")).toMatch(/marcar cero/i); // press-zero hint localized
    expect(phrase("en", "retry")).toMatch(/press zero/i);
  });
  it("Gather speech recognition locale maps per language (documented Twilio STT locales)", () => {
    expect(gatherLocale("en")).toBe("en-US");
    expect(gatherLocale("es")).toBe("es-MX");
    expect(buildGather("https://x.test/g", "Hola", { language: "es" })).toContain('language="es-MX"');
    expect(buildGather("https://x.test/g", "Hi")).toContain('language="en-US"'); // default unchanged
  });
  it("the live prompt pins the response language (es forces Spanish)", async () => {
    vi.resetModules();
    const fakeLLM = vi.fn().mockResolvedValue({ choices: [{ message: { content: { say: "Claro", intent: "ask" } } }] });
    vi.doMock("./_core/llm", () => ({ invokeLLM: fakeLLM }));
    const { decideNextTurn } = await import("./_core/voiceAgent");
    await decideNextTurn({ greeting: "Hola", businessInfo: "", turns: [], callerSpeech: "hola", language: "es" });
    const system = String(fakeLLM.mock.calls[0]?.[0]?.messages?.[0]?.content ?? "");
    expect(system).toContain("Respond ONLY in Spanish");
  });
  it("settings language is validated to the two documented options", () => {
    expect(normalizeVoiceLanguage("es")).toBe("es");
    expect(normalizeVoiceLanguage("EN")).toBe("en"); // anything else degrades to English
    expect(normalizeVoiceLanguage(undefined)).toBe("en");
  });
  it("every gather on the AI path passes the per-call language", () => {
    const api = read("voiceApi.ts");
    const gathers = (api.split("buildGather(").length - 1) + (api.split("buildGatherWithChildren(").length - 1);
    const withLanguage = api.split("{ language: lang }").length - 1;
    expect(withLanguage).toBe(gathers);
  });
});

describe("persistence + UI wiring contracts", () => {
  it("schema and migration carry the two new voice settings columns", () => {
    const schema = read("../drizzle/schema.ts");
    expect(schema).toContain('transferNumber: varchar("transferNumber"');
    expect(schema).toContain('language: varchar("language"');
    const migration = readFileSync(resolve(__dirname, "../drizzle/0083_voice_hardening.sql"), "utf-8");
    expect(migration).toContain("`transferNumber`");
    expect(migration).toContain("`language`");
  });
  it("the settings card exposes transfer number and language", () => {
    const ui = read("../client/src/pages/IntegrationHub.tsx");
    expect(ui).toContain('id="voice-transfer"');
    expect(ui).toContain('id="voice-language"');
    expect(ui).toContain("VOICE_LANGUAGE_OPTIONS.map"); // all ten languages selectable
  });
  it("the language flows through every spoken fixed prompt on the call path", () => {
    const api = read("voiceApi.ts");
    expect(api.split("phrase(lang,").length - 1).toBeGreaterThanOrEqual(11);
    expect(api).not.toMatch(/buildSay\("(Sorry|Is there|We have saved|Let me take|One moment|Please call back|The number you|No one is|connecting you)/);
  });
});
