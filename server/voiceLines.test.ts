import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import {
  VOICE_LINE_MINUTES,
  voiceLineMinutesFor,
} from "../shared/plans";

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("included business lines (managed voice)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("fair-use minutes: free gets no line, caps grow with plan price and cover their cost", () => {
    expect(VOICE_LINE_MINUTES.free).toBe(0);
    expect(VOICE_LINE_MINUTES.starter).toBe(300);
    expect(VOICE_LINE_MINUTES.pro).toBeGreaterThan(VOICE_LINE_MINUTES.starter);
    expect(VOICE_LINE_MINUTES.agency).toBeGreaterThan(VOICE_LINE_MINUTES.pro);
    // at ~1.4 cents/minute the cap must stay below the plan's own price margin
    expect(VOICE_LINE_MINUTES.pro * 0.014).toBeLessThan(99);
    expect(VOICE_LINE_MINUTES.starter * 0.014).toBeLessThan(49);
  });

  it("voiceLineMinutesFor falls back to free (0), never to unlimited", () => {
    expect(voiceLineMinutesFor(null)).toBe(0);
    expect(voiceLineMinutesFor(undefined)).toBe(0);
    expect(voiceLineMinutesFor("free")).toBe(0);
    expect(voiceLineMinutesFor("nonexistent")).toBe(0);
    expect(voiceLineMinutesFor("PRO")).toBe(VOICE_LINE_MINUTES.pro);
    expect(voiceLineMinutesFor("Agency")).toBe(VOICE_LINE_MINUTES.agency);
  });

  it("deployment readiness is honest: without Twilio creds or PUBLIC_BASE_URL nothing is offered", async () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "");
    vi.stubEnv("SITE_ORIGIN", "");
    const { getVoiceLineStatus } = await import("./_core/voiceLines");
    expect(getVoiceLineStatus()).toEqual({ configured: false, publicUrl: false, available: false });

    vi.stubEnv("TWILIO_ACCOUNT_SID", "ACtest");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "tok");
    vi.stubEnv("SITE_ORIGIN", "http://localhost:3997"); // not https
    vi.resetModules(); // ENV is built at import time — force a fresh read
    const again = await import("./_core/voiceLines");
    expect(again.getVoiceLineStatus()).toEqual({ configured: true, publicUrl: false, available: false });
  });

  it("buyLineNumber refuses honestly before touching Twilio when the deployment is not ready", async () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "");
    vi.stubEnv("SITE_ORIGIN", "");
    const { buyLineNumber } = await import("./_core/voiceLines");
    const result = await buyLineNumber({} as never, 1, "");
    expect(result.success).toBe(false);
    expect(result.error).toContain("operator");
    // and it never called Twilio
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const again = await buyLineNumber({} as never, 1, "");
    expect(again.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("buyLineNumber wires the purchased number to this deployment's voice webhooks for the user", async () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "ACtestsid");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "tok");
    vi.stubEnv("SITE_ORIGIN", "https://app.trueaxis.dev");
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ sid: "PN123", phone_number: "+15005550123" }),
      { status: 200 },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const inserts: unknown[] = [];
    const fakeDb = {
      select: (() => ({
        from: () => ({
          where: () => ({
            limit: async () => [], // no existing line
          }),
        }),
      })) as never,
      insert: ((table: unknown) => ({
        values: async (v: unknown) => { inserts.push({ table, v }); },
      })) as never,
    };
    const { buyLineNumber } = await import("./_core/voiceLines");
    const result = await buyLineNumber(fakeDb, 42, "512");
    expect(result).toEqual({ success: true, phoneNumber: "+15005550123" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/IncomingPhoneNumbers.json");
    expect(String(init.body)).toContain(`VoiceUrl=${encodeURIComponent("https://app.trueaxis.dev/api/voice/answer?u=42")}`);
    expect(String(init.body)).toContain("AreaCode=512");
    expect(String((init.headers as Record<string, string>).Authorization)).toContain("Basic");
    // the line is recorded against the user
    expect(inserts).toHaveLength(1);
    expect((inserts[0] as { v: { userId: number; twilioSid: string } }).v.userId).toBe(42);
    expect((inserts[0] as { v: { twilioSid: string } }).v.twilioSid).toBe("PN123");
  });

  it("a Twilio purchase rejection surfaces honestly and records nothing", async () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "ACtestsid");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "tok");
    vi.stubEnv("SITE_ORIGIN", "https://app.trueaxis.dev");
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ message: "no numbers available in that area code" }),
      { status: 400 },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const inserts: unknown[] = [];
    const fakeDb = {
      select: (() => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      })) as never,
      insert: (() => ({ values: async (v: unknown) => { inserts.push(v); } })) as never,
    };
    const { buyLineNumber } = await import("./_core/voiceLines");
    const result = await buyLineNumber(fakeDb, 7, "999");
    expect(result.success).toBe(false);
    expect(result.error).toContain("no numbers available");
    expect(inserts).toHaveLength(0);
  });

  it("the live call path caps platform lines only — bring-your-own numbers are never capped", () => {
    const voiceApi = source("./voiceApi.ts");
    // cap is evaluated only when a platform line row exists
    expect(voiceApi).toContain("const line = await getActiveLine(ctx.db, ctx.userId);");
    expect(voiceApi).toContain("if (line) {");
    expect(voiceApi).toContain("voiceLineMinutesFor(ctx.plan)");
    expect(voiceApi).toContain('"fair_use_cap"');
    expect(voiceApi).toContain("not accepting calls right now");
  });

  it("requestLine is plan-gated: free accounts get an upgrade path, not a dead end", () => {
    const routers = source("./routers.ts");
    expect(routers).toContain("voiceLineMinutesFor(planId) === 0");
    expect(routers).toContain("no Twilio account needed");
    // provisioning is audit-logged
    expect(routers).toContain('"voice.line.added"');
    expect(routers).toContain('"voice.line.released"');
  });

  it("the client card offers the line where it exists and explains honestly where it does not", () => {
    const hub = source("../client/src/pages/IntegrationHub.tsx");
    expect(hub).toContain("trpc.voice.myLine.useQuery()");
    expect(hub).toContain("Add a business line");
    expect(hub).toContain("Release number");
    expect(hub).toContain("minutesIncluded === 0");
    expect(hub).toContain("!lineData.available");
  });

  it("migration 0080 provisions voiceLines with a unique user so one line per account is enforced at the DB level", () => {
    const sql = readFileSync(new URL("../drizzle/0080_voice_lines.sql", import.meta.url), "utf8");
    expect(sql).toContain("CREATE TABLE `voiceLines`");
    expect(sql).toContain("UNIQUE KEY `voiceLines_userId_uniq` (`userId`)");
    const journal = JSON.parse(readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
    expect(journal.entries.some((e: { tag: string }) => e.tag === "0080_voice_lines")).toBe(true);
  });

  it("PUBLIC_BASE_URL is documented in the README alongside the voice setup", () => {
    const readme = source("../README.md");
    expect(readme).toContain("SITE_ORIGIN");
  });
});
