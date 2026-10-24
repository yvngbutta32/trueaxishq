// Live e2e for the Oct 23 2026 QBO sync demand gate. Native QuickBooks sync is
// deliberately deferred until 10+ paying companies ask — this exercises the
// real HTTP path: owner tRPC login → demand status → idempotent request →
// honest counters (paying vs total) → CSV export still works with no request.
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const BASE = "http://localhost:3998";
const OWNER_EMAIL = "e2e-qbo-demand@test.local";
const OWNER_PASSWORD = "E2e-QboDemand-2026!";
const FREE_EMAIL = "e2e-qbo-demand-free@test.local";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const db = await mysql.createConnection({ host: "127.0.0.1", user: "trueaxis", password: "trueaxis", database: "trueaxis" });

// ── Seed a clean pro-plan owner + a free-plan company ──────────────────────────
for (const email of [OWNER_EMAIL, FREE_EMAIL]) {
  const [rows] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
  if (rows.length) {
    await db.query("DELETE FROM qboSyncRequests WHERE userId = ?", [rows[0].id]).catch(() => {});
    await db.query("DELETE FROM users WHERE id = ?", [rows[0].id]).catch(() => {});
  }
}
const passwordHash = bcrypt.hashSync(OWNER_PASSWORD, 10);
const [u] = await db.query(
  "INSERT INTO users (openId, email, planId, businessName, passwordHash, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)",
  [`e2e-${OWNER_EMAIL}`, OWNER_EMAIL, "pro", "E2E Pro HVAC", passwordHash, new Date(), new Date()]);
const ownerId = u.insertId;
const [free] = await db.query(
  "INSERT INTO users (openId, email, planId, businessName, passwordHash, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)",
  [`e2e-${FREE_EMAIL}`, FREE_EMAIL, "free", "Free Tier Co", bcrypt.hashSync("E2e-Free-2026!", 10), new Date(), new Date()]);

// baseline demand before any of our users request
const [baseline] = await db.query("SELECT COUNT(*) AS n FROM qboSyncRequests");
const baselineRequests = baseline[0].n;

// ── Owner login (real auth path) ──────────────────────────────────────────────
const loginRes = await fetch(`${BASE}/api/trpc/auth.login?batch=1`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ "0": { json: { email: OWNER_EMAIL, password: OWNER_PASSWORD } } }),
});
let cookie = (loginRes.headers.getSetCookie?.() ?? []).map(c => c.split(";")[0]).join("; ");
if (!cookie) cookie = (loginRes.headers.get("set-cookie") ?? "").split(";")[0];
check("owner login via real auth path", loginRes.status === 200 && cookie.length > 10, `status=${loginRes.status}`);

const trpc = async (op, input) => {
  const res = await fetch(`${BASE}/api/trpc/${op}?batch=1`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ "0": { json: input } }),
  });
  const text = await res.text();
  let body = null; try { body = JSON.parse(text); } catch {}
  return { res, body, text };
};
const trpcQuery = async (op, input) => {
  const res = await fetch(`${BASE}/api/trpc/${op}?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: input } }))}`, {
    method: "GET",
    headers: { Cookie: cookie },
  });
  const text = await res.text();
  let body = null; try { body = JSON.parse(text); } catch {}
  return { res, body, text };
};
const data0 = body => body?.["0"]?.result?.data?.json;

// ── The gate ───────────────────────────────────────────────────────────────────
const demand0 = data0((await trpcQuery("integrations.quickBooksSyncDemand", undefined)).body);
check("demand starts honest: threshold 10, this company not yet counted", demand0?.threshold === 10 && demand0?.myRequest === null,
  `threshold=${demand0?.threshold} total=${demand0?.totalRequests} mine=${JSON.stringify(demand0?.myRequest)}`);

const req1 = data0((await trpc("integrations.requestQuickBooksSync", undefined)).body);
check("request registered", req1?.registered === true && req1?.alreadyRequested === false, JSON.stringify(req1));

const req2 = data0((await trpc("integrations.requestQuickBooksSync", undefined)).body);
check("second request is idempotent (one per company)", req2?.registered === true && req2?.alreadyRequested === true, JSON.stringify(req2));

const demand1 = data0((await trpcQuery("integrations.quickBooksSyncDemand", undefined)).body);
check("pro-plan request counts as paying demand", demand1?.myRequest != null && demand1?.payingRequests >= baselineRequests + 1 && demand1?.totalRequests === baselineRequests + 1,
  `total=${demand1?.totalRequests} paying=${demand1?.payingRequests} baseline=${baselineRequests}`);

// A free-plan company asks: counted in total, NOT as paying
const freeLogin = await fetch(`${BASE}/api/trpc/auth.login?batch=1`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ "0": { json: { email: FREE_EMAIL, password: "E2e-Free-2026!" } } }),
});
const freeCookie = (freeLogin.headers.getSetCookie?.() ?? []).map(c => c.split(";")[0]).join("; ");
const freeReq = await fetch(`${BASE}/api/trpc/integrations.requestQuickBooksSync?batch=1`, {
  method: "POST", headers: { "Content-Type": "application/json", Cookie: freeCookie },
  body: JSON.stringify({ "0": { json: null } }),
});
let freeBody = null; try { freeBody = JSON.parse(await freeReq.text()); } catch {}
check("free-plan company can register interest", freeBody?.["0"]?.result?.data?.json?.registered === true, `status=${freeReq.status}`);

const demand2 = data0((await trpcQuery("integrations.quickBooksSyncDemand", undefined)).body);
check("free-plan interest is visible but never counted as paying", demand2?.totalRequests === baselineRequests + 2 && demand2?.payingRequests === baselineRequests + 1,
  `total=${demand2?.totalRequests} paying=${demand2?.payingRequests}`);

// The demand payload never exposes who asked
const demandRaw = JSON.stringify(demand2);
check("demand payload exposes counts only — no company names", !demandRaw.includes("E2E Pro HVAC") && !demandRaw.includes("Free Tier Co"));

// CSV export needs no request and still works (the today-path)
const export1 = data0((await trpcQuery("invoices.accountingExport", {})).body);
check("QuickBooks-format CSV export works without any request", !!export1?.quickBooksInvoicesCsv && export1.fileName.startsWith("trueaxis-accounting-"),
  `file=${export1?.fileName}`);

// Anonymous callers cannot touch the gate
const anonReq = await fetch(`${BASE}/api/trpc/integrations.requestQuickBooksSync?batch=1`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ "0": { json: null } }),
});
check("anonymous request attempt is rejected", anonReq.status === 401, `status=${anonReq.status}`);

// ── cleanup ─────────────────────────────────────────────────────────────────────
await db.query("DELETE FROM qboSyncRequests WHERE userId IN (?, ?)", [ownerId, free.insertId]);
await db.query("DELETE FROM users WHERE id IN (?, ?)", [ownerId, free.insertId]);
await db.end();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
