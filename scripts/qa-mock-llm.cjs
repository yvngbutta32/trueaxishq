#!/usr/bin/env node
// QA-only OpenAI-compatible mock LLM on :4001 (matches BUILT_IN_FORGE_API_URL
// used by the e2e/QA server env). Returns valid payloads for both voice-shape
// and smartSchedule requests.
require("node:http").createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const wantsSchedule = /schedule_suggestions|Suggest 3 optimal/i.test(body);
    // Same shape the production json_schema pins: date YYYY-MM-DD, time HH:MM.
    const d = (offset) => { const t = new Date(); t.setUTCDate(t.getUTCDate() + offset); return t.toISOString().slice(0, 10); };
    const content = wantsSchedule
      ? JSON.stringify({ suggestions: [
          { date: d(3), time: "10:00", reason: "No conflicts" },
          { date: d(4), time: "14:30", reason: "Client's preferred afternoon" },
          { date: d(6), time: "09:15", reason: "Lightest day this week" },
        ] })
      : JSON.stringify({ say: "Perfecto, he guardado su solicitud de servicio.", intent: "lead_captured", callerName: "Maria Lopez", serviceRequested: "drenaje de agua", preferredTime: "manana por la manana" });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content } }] }));
  });
}).listen(4001, () => console.log("QA mock LLM on :4001"));
