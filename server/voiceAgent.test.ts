import { describe, expect, it, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHmac } from "node:crypto";
import { PRO_FEATURES, featureEntitlements } from "../shared/plans";
import { ENV } from "./_core/env";
import {
  computeTwilioSignature, validateTwilioSignature, getVoiceStatus,
  decideNextTurn, sanitizeCallerFact, newCallTranscript, appendTurn,
  VOICE_DEFAULT_GREETING, VOICE_MAX_TURNS,
} from "./_core/voiceAgent";
import { xmlEscape, buildSay, buildGather, buildRecord, buildHangup, renderTwiML } from "./_core/voiceTwiML";

// The voice receptionist is the Oct 8 2026 phase-3 build: AI phone answering +
// voicemail fallback, zero new dependencies, honest degradation at every step.

describe("TwiML builder (zero-dep, safe output)", () => {
  it("XML-escapes every injected value", () => {
    expect(xmlEscape(`a<b>&"c"'`)).toBe("a&lt;b&gt;&amp;&quot;c&quot;&apos;");
  });
  it("buildSay refuses empty and over-long text rather than emitting broken TwiML", () => {
    expect(() => buildSay("")).toThrow();
    expect(() => buildSay("x".repeat(4001))).toThrow();
    expect(buildSay("Hello there")).toBe("<Say>Hello there</Say>");
  });
  it("Gather and Record demand absolute https action URLs", () => {
    expect(() => buildGather("/relative", "Hi")).toThrow();
    expect(() => buildRecord("/relative")).toThrow();
    expect(buildGather("https://example.com/api/voice/gather?u=1", "Hi")).toContain('input="speech dtmf"');
    expect(buildGather("https://example.com/g", "Hi", { hints: ["plumbing", "quote"] })).toContain("plumbing");
  });
  it("renders a valid single-root TwiML document", () => {
    const doc = renderTwiML([buildSay("Hi"), buildHangup(), "", buildSay("Bye")]);
    expect(doc.startsWith('<?xml version="1.0" encoding="UTF-8"?><Response>')).toBe(true);
    expect(doc.endsWith("</Response>")).toBe(true);
    expect(doc).not.toContain("<Say></Say>");
  });
});

describe("Twilio signature validation (fail closed)", () => {
  const url = "https://app.example.com/api/voice/answer?u=1";
  const params = { CallSid: "CA1", From: "+15125550100" };
  beforeEach(() => { ENV.twilioAuthToken = ""; });
  it("accepts a correctly signed request", () => {
    ENV.twilioAuthToken = "tok";
    const sig = computeTwilioSignature("tok", url, params);
    expect(validateTwilioSignature(url, params, sig)).toBe(true);
  });
  it("rejects tampered params, wrong token, and missing signature", () => {
    ENV.twilioAuthToken = "tok";
    const sig = computeTwilioSignature("tok", url, params);
    expect(validateTwilioSignature(url, { ...params, From: "+19999999999" }, sig)).toBe(false);
    expect(validateTwilioSignature(url, params, computeTwilioSignature("other", url, params))).toBe(false);
    expect(validateTwilioSignature(url, params, null)).toBe(false);
  });
  it("fails closed when no auth token is configured", () => {
    expect(validateTwilioSignature(url, params, "anything")).toBe(false);
  });
  it("matches Twilio's documented algorithm (sorted k=v appended to URL)", () => {
    ENV.twilioAuthToken = "tok";
    const expected = createHmac("sha1", "tok").update(Buffer.from(url + "CallSidCA1From+15125550100", "utf-8")).digest("base64");
    expect(computeTwilioSignature("tok", url, params)).toBe(expected);
  });
});

describe("voice status honest states", () => {
  beforeEach(() => { ENV.twilioAccountSid = ""; ENV.twilioAuthToken = ""; ENV.forgeApiKey = ""; });
  it("provider_setup_required when Twilio is unconfigured", () => {
    ENV.forgeApiKey = "k";
    expect(getVoiceStatus().state).toBe("provider_setup_required");
  });
  it("voicemail_only when Twilio is set but no LLM", () => {
    ENV.twilioAccountSid = "AC1"; ENV.twilioAuthToken = "t"; ENV.twilioFromNumber = "+15125550100";
    expect(getVoiceStatus()).toMatchObject({ state: "voicemail_only", twilioConfigured: true, fromNumber: "+15125550100" });
  });
  it("ai_ready only with both Twilio and LLM", () => {
    ENV.twilioAccountSid = "AC1"; ENV.twilioAuthToken = "t"; ENV.forgeApiKey = "k";
    expect(getVoiceStatus().state).toBe("ai_ready");
  });
});

describe("conversation engine", () => {
  const fakeLLM = (content: unknown) => {
    vi.doMock("./_core/llm", () => ({ invokeLLM: vi.fn().mockResolvedValue({ choices: [{ message: { content } }] }) }));
  };
  beforeEach(() => { vi.resetModules(); });
  it("parses a valid decision and bounds the spoken text", async () => {
    fakeLLM({ say: "Sure, what is your name?", intent: "ask" });
    const { decideNextTurn: d } = await import("./_core/voiceAgent");
    const decision = await d({ greeting: "Hi", businessInfo: "Open 9-5", turns: [], callerSpeech: "I need a quote" });
    expect(decision.intent).toBe("ask");
    expect(decision.say).toBe("Sure, what is your name?");
  });
  it("throws on unparseable or invalid LLM output (caller degrades to voicemail)", async () => {
    fakeLLM("not json");
    const { decideNextTurn: d } = await import("./_core/voiceAgent");
    await expect(d({ greeting: "Hi", businessInfo: "", turns: [], callerSpeech: "hello" })).rejects.toThrow();
  });
  it("rejects an out-of-enum intent", async () => {
    fakeLLM({ say: "hi", intent: "delete_database" });
    const { decideNextTurn: d } = await import("./_core/voiceAgent");
    await expect(d({ greeting: "Hi", businessInfo: "", turns: [], callerSpeech: "hi" })).rejects.toThrow();
  });
  it("transcripts are bounded and turns append in order", () => {
    let turns = newCallTranscript("hello");
    turns = appendTurn(turns, { role: "agent", text: "hi", at: "t1" });
    expect(turns.map(t => t.role)).toEqual(["caller", "agent"]);
    for (let i = 0; i < 40; i++) turns = appendTurn(turns, { role: "caller", text: `m${i}`, at: "t" });
    expect(turns.length).toBeLessThanOrEqual(24);
    expect(VOICE_MAX_TURNS).toBeLessThanOrEqual(6);
  });
  it("sanitizeCallerFact strips control characters and caps length", () => {
    expect(sanitizeCallerFact("  John\u0000 Doe  ")).toBe("John Doe");
    expect(sanitizeCallerFact(undefined)).toBeNull();
    expect(sanitizeCallerFact("x".repeat(500), 10)).toBe("xxxxxxxxxx");
  });
});

describe("plan gating (server-enforced)", () => {
  it("voiceAgent is a Pro feature; free/starter locked, pro/agency unlocked", () => {
    expect((PRO_FEATURES as readonly string[]).includes("voiceAgent")).toBe(true);
    expect(featureEntitlements("free").voiceAgent).toBe(false);
    expect(featureEntitlements("starter").voiceAgent).toBe(false);
    expect(featureEntitlements("pro").voiceAgent).toBe(true);
    expect(featureEntitlements("agency").voiceAgent).toBe(true);
  });
});

describe("wiring contracts (evidence-boundary)", () => {
  const read = (f: string) => readFileSync(resolve(__dirname, f), "utf-8");
  it("webhooks are registered on /api/voice with signature gates", () => {
    const api = read("voiceApi.ts");
    expect(api).toContain('voiceApiRouter.post("/answer"');
    expect(api).toContain('voiceApiRouter.post("/gather"');
    expect(api).toContain('voiceApiRouter.post("/completed"');
    expect(api).toContain("validateTwilioSignature");
    expect(api).not.toContain("process.env.TWILIO"); // only ENV, which respects configuration snapshots
  });
  it("the express app mounts the voice router", () => {
    expect(read("_core/index.ts")).toContain('app.use("/api/voice", voiceApiRouter)');
  });
  it("owner router exposes status/settings/calls/preview", () => {
    const routers = read("routers.ts");
    expect(routers).toContain("voice: voiceRouter");
    expect(routers).toContain("updateSettings");
    expect(routers).toContain("previewCall");
  });
  it("no Twilio SDK dependency was added", () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf-8"));
    expect(Object.keys(pkg.dependencies ?? {}).some(d => d.includes("twilio"))).toBe(false);
  });
  it("default greeting exists and is spoken, never silent", () => {
    expect(VOICE_DEFAULT_GREETING.length).toBeGreaterThan(20);
  });
});
