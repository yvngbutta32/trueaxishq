// ─── Public voice webhooks (Oct 8 2026) ─────────────────────────────────────────
// Twilio-facing endpoints for the voice receptionist. Signature-validated,
// fail-closed, owner-scoped via ?u=<userId> (each owner configures their own
// Twilio number's Voice URL). Zero new dependencies: hand-built TwiML.

import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { users, voiceCalls, voiceSettings, voiceLines, leads, auditLogs } from "../drizzle/schema";
import { getPlanTier } from "./_core/entitlements";
import { getActiveLine, monthlyMinutesUsed } from "./_core/voiceLines";
import { voiceLineMinutesFor } from "../shared/plans";
import { sendPushToUser } from "./_core/push";
import {
  getVoiceStatus, validateTwilioSignature, decideNextTurn, newCallTranscript, appendTurn,
  sanitizeCallerFact, VOICE_MAX_TURNS, VOICE_DEFAULT_GREETING, type VoiceTurn,
} from "./_core/voiceAgent";
import { renderTwiML, buildSay, buildGather, buildRecord, buildHangup } from "./_core/voiceTwiML";

export const voiceApiRouter = Router();

type Body = Record<string, string>;
const asBody = (req: Request): Body => {
  const out: Body = {};
  for (const [k, v] of Object.entries(req.body ?? {})) if (typeof v === "string") out[k] = v;
  return out;
};

const baseUrl = (req: Request): string => {
  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "";
  const isLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\b)/.test(host);
  const proto = req.get("x-forwarded-proto") ?? (isLocal ? req.protocol : "https");
  return `${proto}://${host}`;
};

/** A live caller must never get dead air: any unexpected error in a handler
 *  still produces spoken TwiML + hangup (and is logged). Express does not
 *  catch async throws for us — proven by the live e2e hang this fixed. */
const withGracefulVoice = (handler: (req: Request, res: Response) => Promise<unknown>) =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error("voice webhook error:", error instanceof Error ? error.message : error);
      if (!res.headersSent) gracefulFailure(res);
    }
  };

const twiml = (res: Response, children: string[]) => {
  res.type("text/xml").send(renderTwiML(children));
};

const gracefulFailure = (res: Response) =>
  twiml(res, [buildSay("We are having a technical problem right now. Please try again in a few minutes."), buildHangup()]);

async function loadOwnerContext(userIdRaw: unknown) {
  const userId = Number(userIdRaw);
  if (!Number.isInteger(userId) || userId <= 0) return null;
  const db = await getDb();
  if (!db) throw new Error("database unavailable");
  const [user] = await db.select({ id: users.id, planId: users.planId }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null; // unknown destination: never answer calls for a made-up user id
  const [settings] = await db.select().from(voiceSettings).where(eq(voiceSettings.userId, userId)).limit(1);
  const plan = await getPlanTier(db, userId);
  const greeting = settings?.greeting?.trim() || VOICE_DEFAULT_GREETING;
  return { db, userId, greeting, businessInfo: settings?.businessInfo ?? "", agentMode: settings?.agentMode ?? "voicemail", voicemailEnabled: settings?.voicemailEnabled ?? true, plan };
}

function wantsAi(ctx: NonNullable<Awaited<ReturnType<typeof loadOwnerContext>>>): boolean {
  if (ctx.agentMode !== "ai") return false;
  if (ctx.plan !== "pro" && ctx.plan !== "agency") return false; // honest plan gate on the live call path
  return getVoiceStatus().llmConfigured;
}

// Every entry point: validate the Twilio signature first, fail closed.
const gate = (req: Request, res: Response): Body | null => {
  const body = asBody(req);
  const url = `${baseUrl(req)}${req.originalUrl}`;
  if (!validateTwilioSignature(url, body, req.get("x-twilio-signature") ?? null)) {
    res.status(403).type("text/plain").send("Forbidden: invalid or missing Twilio signature.");
    return null;
  }
  return body;
};

// POST /api/voice/answer?u=<userId> — first TwiML for an inbound call.
voiceApiRouter.post("/answer", withGracefulVoice(async (req: Request, res: Response) => {
  const body = gate(req, res);
  if (!body) return;
  let ctx;
  try { ctx = await loadOwnerContext(req.query.u); } catch { return gracefulFailure(res); }
  if (!ctx) return res.status(403).type("text/plain").send("Forbidden: unknown voice destination.");

  const sid = (body.CallSid ?? "").slice(0, 64);
  if (sid) {
    try {
      await ctx.db.insert(voiceCalls).values({ userId: ctx.userId, callSid: sid, fromNumber: (body.From ?? "").slice(0, 32), status: "answered" });
    } catch { /* duplicate SID (Twilio retry) — continue with the existing row */ }
  }

  // Fair use on platform-purchased lines only: bring-your-own numbers bill
  // to the client's own Twilio account and are never capped by us.
  const line = await getActiveLine(ctx.db, ctx.userId);
  if (line) {
    const cap = voiceLineMinutesFor(ctx.plan);
    if (cap > 0) {
      const used = await monthlyMinutesUsed(ctx.db, ctx.userId);
      if (used >= cap) {
        try { await ctx.db.update(voiceCalls).set({ outcome: "fair_use_cap", status: "completed", endedAt: new Date() }).where(eq(voiceCalls.callSid, sid)); } catch { /* row may not exist */ }
        return twiml(res, [
          buildSay("The number you have dialed is not accepting calls right now. Please try again later."),
          buildHangup(),
        ]);
      }
    }
  }

  if (wantsAi(ctx)) {
    return twiml(res, [buildGather(`${baseUrl(req)}/api/voice/gather?u=${ctx.userId}`, ctx.greeting)]);
  }
  if (ctx.voicemailEnabled) {
    return twiml(res, [buildSay(ctx.greeting), buildRecord(`${baseUrl(req)}/api/voice/completed?u=${ctx.userId}&mode=voicemail`)]);
  }
  return twiml(res, [buildSay(ctx.greeting), buildSay("Please call back during business hours. Goodbye."), buildHangup()]);
}));

// POST /api/voice/gather?u=<userId> — one conversational turn.
voiceApiRouter.post("/gather", withGracefulVoice(async (req: Request, res: Response) => {
  const body = gate(req, res);
  if (!body) return;
  let ctx;
  try { ctx = await loadOwnerContext(req.query.u); } catch { return gracefulFailure(res); }
  if (!ctx) return res.status(403).type("text/plain").send("Forbidden: unknown voice destination.");

  const sid = (body.CallSid ?? "").slice(0, 64);
  const [call] = sid ? await ctx.db.select().from(voiceCalls).where(eq(voiceCalls.callSid, sid)).limit(1) : [];
  if (!call || call.userId !== ctx.userId) return res.status(403).type("text/plain").send("Forbidden: unknown call.");

  const speech = (body.SpeechResult ?? "").trim().slice(0, 1000);
  const speechConfidence = Number(body.Confidence ?? "0");
  const turns: VoiceTurn[] = Array.isArray(call.transcriptJson) ? (call.transcriptJson as VoiceTurn[]) : [];
  const turnCount = call.turns ?? 0;
  const nextTurns = speech ? appendTurn(newCallTranscript(speech).length ? turns : turns, { role: "caller", text: speech, at: new Date().toISOString() }) : turns;

  const persist = async (patch: Partial<typeof voiceCalls.$inferInsert>) => {
    await ctx.db.update(voiceCalls).set({ ...patch, transcriptJson: nextTurns as never, turns: turnCount + 1 }).where(eq(voiceCalls.id, call.id));
  };

  // No usable speech (silence/timeout), not yet at the turn cap → ask once more.
  if (!speech && turnCount < VOICE_MAX_TURNS - 1) {
    await persist({});
    return twiml(res, [buildGather(`${baseUrl(req)}/api/voice/gather?u=${ctx.userId}`, "Sorry, I did not catch that. Could you say that again?")]);
  }

  // Turn cap reached, empty speech, or non-AI mode → wrap up honestly.
  if (!speech || turnCount >= VOICE_MAX_TURNS || !wantsAi(ctx)) {
    await persist({ status: speech ? "completed" : "voicemail", outcome: "voicemail", endedAt: new Date() });
    return twiml(res, [
      buildSay("Let me take a message so " + (sanitizeCallerFact(ctx.businessInfo.split("\n")[0], 40) ?? "the team") + " can follow up."),
      buildRecord(`${baseUrl(req)}/api/voice/completed?u=${ctx.userId}&mode=voicemail`),
    ]);
  }

  let decision;
  try {
    decision = await decideNextTurn({ greeting: ctx.greeting, businessInfo: ctx.businessInfo, turns: nextTurns, callerSpeech: speech });
  } catch {
    // LLM unavailable mid-call (misconfiguration, provider outage, bad output) → voicemail, never silence.
    await persist({ status: "completed", outcome: "voicemail", endedAt: new Date() });
    return twiml(res, [buildSay("One moment, I am switching to message mode."), buildRecord(`${baseUrl(req)}/api/voice/completed?u=${ctx.userId}&mode=voicemail`)]);
  }

  const agentTurn = appendTurn(nextTurns, { role: "agent", text: decision.say, at: new Date().toISOString() });
  const callerName = sanitizeCallerFact(decision.callerName, 120) ?? call.callerName;
  const serviceRequested = sanitizeCallerFact(decision.serviceRequested) ?? call.serviceRequested;
  const preferredTime = sanitizeCallerFact(decision.preferredTime, 200) ?? call.preferredTime;

  if (decision.intent === "lead_captured") {
    // The caller's number is the strongest contact; name+service come from the conversation.
    const email = `${(body.From ?? "").replace(/[^\d]/g, "") || "unknown"}@voice.call`;
    const [lead] = await ctx.db.insert(leads).values({
      email,
      name: callerName ?? (body.From ?? "Voice caller"),
      source: "voice_receptionist",
    });
    await ctx.db.update(voiceCalls).set({
      transcriptJson: agentTurn as never, turns: turnCount + 1, callerName, serviceRequested, preferredTime,
      status: "completed", outcome: "lead_captured", leadId: Number(lead?.insertId ?? 0) || null, endedAt: new Date(),
    }).where(eq(voiceCalls.id, call.id));
    await ctx.db.insert(auditLogs).values({
      userId: ctx.userId, action: "voice.lead.captured", entityType: "voiceCall", entityId: call.id,
      details: JSON.stringify({ callSid: sid, serviceRequested, preferredTime, speechConfidence }),
    });
    // Fire-and-forget owner notification (never blocks the call).
    void sendPushToUser(ctx.userId, "Voice lead captured", `${callerName ?? "A caller"} asked about ${serviceRequested ?? "your services"}.`, "/integration-hub").catch(() => {});
    return twiml(res, [buildSay(decision.say), buildSay("We have saved your details and will follow up shortly. Goodbye!"), buildHangup()]);
  }

  if (decision.intent === "handoff" || decision.intent === "end") {
    await ctx.db.update(voiceCalls).set({
      transcriptJson: agentTurn as never, turns: turnCount + 1, callerName, serviceRequested, preferredTime,
      status: "completed", outcome: decision.intent === "handoff" ? "handoff" : "info_given", endedAt: new Date(),
    }).where(eq(voiceCalls.id, call.id));
    if (decision.intent === "handoff") {
      void sendPushToUser(ctx.userId, "Urgent call (handoff)", decision.say.slice(0, 200), "/integration-hub").catch(() => {});
    }
    return twiml(res, [buildSay(decision.say), buildRecord(`${baseUrl(req)}/api/voice/completed?u=${ctx.userId}&mode=voicemail`), buildHangup()]);
  }

  // ask / info_given → speak and continue (or close if we just answered a question with no pending lead intent).
  await ctx.db.update(voiceCalls).set({
    transcriptJson: agentTurn as never, turns: turnCount + 1, callerName, serviceRequested, preferredTime,
  }).where(eq(voiceCalls.id, call.id));
  if (decision.intent === "info_given") {
    await ctx.db.update(voiceCalls).set({ status: "completed", outcome: "info_given", endedAt: new Date() }).where(eq(voiceCalls.id, call.id));
    return twiml(res, [buildSay(decision.say), buildGather(`${baseUrl(req)}/api/voice/gather?u=${ctx.userId}`, "Is there anything else I can help with?")]);
  }
  return twiml(res, [buildGather(`${baseUrl(req)}/api/voice/gather?u=${ctx.userId}`, decision.say)]);
}));

// POST /api/voice/completed — status callback / voicemail recording landed.
voiceApiRouter.post("/completed", withGracefulVoice(async (req: Request, res: Response) => {
  const body = gate(req, res);
  if (!body) return;
  const sid = (body.CallSid ?? "").slice(0, 64);
  try {
    const db = await getDb();
    if (!db) { res.type("text/plain").send("ok"); return; }
    const [call] = sid ? await db.select().from(voiceCalls).where(eq(voiceCalls.callSid, sid)).limit(1) : [];
    if (call) {
      await db.update(voiceCalls).set({
        status: "completed",
        outcome: call.outcome === "unknown" ? (req.query.mode === "voicemail" ? "voicemail" : call.outcome) : call.outcome,
        durationSeconds: Math.max(0, Math.min(36000, Number(body.CallDuration ?? "0") || 0)),
        recordingUrl: (body.RecordingUrl ?? "").slice(0, 500) || call.recordingUrl,
        endedAt: call.endedAt ?? new Date(),
      }).where(eq(voiceCalls.id, call.id));
    }
  } catch { /* status callbacks must never 500 Twilio */ }
  res.type("text/plain").send("ok");
}));
