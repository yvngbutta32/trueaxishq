// Live e2e for the Oct 23 2026 voice hardening. Runs against a booted production
// build on :3998 with a mock OpenAI-compatible LLM on :4001. Realistic Twilio
// signatures; every scenario is the actual HTTP path a carrier would hit.
import { createHmac } from "node:crypto";
import mysql from "mysql2/promise";

const BASE = "http://localhost:3998";
const LLM_PORT = 4001;
const AUTH_TOKEN = "e2e-twilio-token";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// ── Mock LLM (OpenAI-compatible) ──────────────────────────────────────────────
const llm = (await import("node:http")).createServer((req, res) => {
  let body = "";
  req.on("data", c => (body += c));
  req.on("end", () => {
    const payload = {
      choices: [{ message: { content: JSON.stringify({
        say: "Perfecto, he guardado su solicitud de servicio.",
        intent: "lead_captured",
        callerName: "Maria Lopez",
        serviceRequested: "drenaje de agua",
        preferredTime: "manana por la manana",
      }) } }],
    };
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  });
});
await new Promise(r => llm.listen(LLM_PORT, r));

// ── Signature helper (Twilio's documented algorithm) ──────────────────────────
const sign = (url, params) =>
  createHmac("sha1", AUTH_TOKEN)
    .update(Buffer.from(url + Object.keys(params).sort().map(k => k + (params[k] ?? "")).join(""), "utf-8"))
    .digest("base64");

const postVoice = async (path, params) => {
  const url = `${BASE}${path}`;
  const body = new URLSearchParams(params).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": sign(url, params) },
    body,
  });
  return { status: res.status, text: await res.text() };
};

// ── Seed ──────────────────────────────────────────────────────────────────────
const db = await mysql.createConnection({ host: "127.0.0.1", user: "trueaxis", password: "trueaxis", database: "trueaxis" });
await db.query("DELETE FROM voiceCalls WHERE userId IN (SELECT id FROM users WHERE email LIKE 'e2e-voice-%')");
await db.query("DELETE FROM voiceSettings WHERE userId IN (SELECT id FROM users WHERE email LIKE 'e2e-voice-%')");
await db.query("DELETE FROM users WHERE email LIKE 'e2e-voice-%'");
const seed = async (email, planId, settings) => {
  const [u] = await db.query("INSERT INTO users (openId, email, planId, createdAt, updatedAt) VALUES (?,?,?,?,?)",
    [`e2e-${email}`, email, planId, new Date(), new Date()]);
  const id = u.insertId;
  await db.query(
    "INSERT INTO voiceSettings (userId, greeting, businessInfo, agentMode, voicemailEnabled, transferNumber, language) VALUES (?,?,?,?,?,?,?)",
    [id, "", "Servicio 8am-6pm", settings.agentMode, 1, settings.transferNumber ?? "", settings.language ?? "en"]);
  return id;
};
const ownerEs = await seed("e2e-voice-es@test", "pro", { agentMode: "ai", transferNumber: "+15551234567", language: "es" });
const ownerNoTransfer = await seed("e2e-voice-none@test", "pro", { agentMode: "ai", transferNumber: "", language: "en" });

// ── Scenario 1: AI answer in Spanish advertises press-zero, gathers in es-MX ──
{
  const r = await postVoice(`/api/voice/answer?u=${ownerEs}`, { CallSid: "CA-ES-1", From: "+15125550100" });
  const ok = r.status === 200 && r.text.includes('language="es-MX"') &&
    r.text.includes("recepcionista virtual") && r.text.includes("Marque cero");
  check("answer: es greeting discloses AI + es-MX STT + press-zero hint", ok, r.text.slice(60, 220));
}

// ── Scenario 2: caller presses zero → warm Dial to the configured number ──────
{
  const r = await postVoice(`/api/voice/gather?u=${ownerEs}`, { CallSid: "CA-ES-1", From: "+15125550100", Digits: "0" });
  const ok = r.status === 200 && r.text.includes("le comunico") && r.text.includes("<Dial") && r.text.includes("+15551234567");
  check("gather: press-zero dials the transfer number (Spanish)", ok);
}
// ── Scenario 2b: dial-end callback closes the call and records the transfer ───
{
  const r = await postVoice(`/api/voice/dial-end?u=${ownerEs}`, { CallSid: "CA-ES-1", From: "+15125550100", DialCallStatus: "completed", DialCallDuration: "95" });
  const [rows] = await db.query("SELECT outcome FROM voiceCalls WHERE callSid='CA-ES-1'");
  check("dial-end: records outcome=transfer + hangs up cleanly", r.status === 200 && r.text.includes("<Hangup/>") && rows[0]?.outcome === "transfer");
}

// ── Scenario 3: spoken turn → mock LLM lead capture, Spanish closing ──────────
{
  const r = await postVoice(`/api/voice/gather?u=${ownerEs}`, { CallSid: "CA-ES-2", From: "+15125550100", SpeechResult: "hola necesito un plomero" });
  // CA-ES-2 has no /answer row → the gate refuses (unknown call). Do it properly:
  if (r.status === 403) {
    await postVoice(`/api/voice/answer?u=${ownerEs}`, { CallSid: "CA-ES-2", From: "+15125550100" });
    const r2 = await postVoice(`/api/voice/gather?u=${ownerEs}`, { CallSid: "CA-ES-2", From: "+15125550100", SpeechResult: "hola necesito un plomero" });
    const [lead] = await db.query("SELECT name, source FROM leads WHERE source='voice_receptionist' ORDER BY id DESC LIMIT 1");
    const [call] = await db.query("SELECT outcome, serviceRequested FROM voiceCalls WHERE callSid='CA-ES-2'");
    const ok = r2.status === 200 && r2.text.includes("guardado") && lead[0]?.source === "voice_receptionist" && call[0]?.outcome === "lead_captured";
    check("gather: speech → LLM lead capture with Spanish closing", ok, JSON.stringify({ lead: lead[0], call: call[0] }));
  } else {
    check("gather: speech → LLM lead capture with Spanish closing", r.status === 200 && r.text.includes("guardado"));
  }
}

// ── Scenario 4: no transfer number → press zero is HONEST voicemail ──────────
{
  await postVoice(`/api/voice/answer?u=${ownerNoTransfer}`, { CallSid: "CA-EN-1", From: "+15125550100" });
  const r = await postVoice(`/api/voice/gather?u=${ownerNoTransfer}`, { CallSid: "CA-EN-1", From: "+15125550100", Digits: "0" });
  const ok = r.status === 200 && r.text.includes("No one is available") && r.text.includes("<Record") && !r.text.includes("<Dial");
  check("gather: press-zero without transfer number → honest voicemail, never fake dial", ok);
}

// ── Scenario 5: fail-closed signature still holds on the new endpoints ───────
{
  const res = await fetch(`${BASE}/api/voice/gather?u=${ownerEs}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "Digits=0" });
  check("unsigned request → 403 (fail closed)", res.status === 403);
}

llm.close();
await db.end();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
