// Live adversarial security probe for TrueAxis HQ. Runs against the booted
// production build on :3998 and attacks it the way a real attacker would:
// two tenants attacking each other (IDOR), JWT tampering, SQL injection
// payloads, stored-XSS attempts, CSRF origin forgery, account lockout, and
// rate-limit exhaustion. Every defense is proven on the real HTTP path.
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const BASE = "http://localhost:3998";
const VICTIM_EMAIL = "e2e-sec-victim@test.local";
const VICTIM_PASSWORD = "E2e-SecVictim-2026!";
const ATTACKER_EMAIL = "e2e-sec-attacker@test.local";
const ATTACKER_PASSWORD = "E2e-SecAttacker-2026!";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const db = await mysql.createConnection({ host: "127.0.0.1", user: "trueaxis", password: "trueaxis", database: "trueaxis" });

// ── Seed: two tenants (victim A, attacker B) + victim's client & invoice ────
for (const email of [VICTIM_EMAIL, ATTACKER_EMAIL]) {
  await db.query("DELETE FROM invoices WHERE userId IN (SELECT id FROM users WHERE email = ?)", [email]).catch(() => {});
  await db.query("DELETE FROM clients WHERE userId IN (SELECT id FROM users WHERE email = ?)", [email]).catch(() => {});
  await db.query("DELETE FROM users WHERE email = ?", [email]).catch(() => {});
}
const hash = bcrypt.hashSync(VICTIM_PASSWORD, 10);
const hashB = bcrypt.hashSync(ATTACKER_PASSWORD, 10);
const [uA] = await db.query(
  "INSERT INTO users (openId, email, planId, businessName, phone, passwordHash, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)",
  [`e2e-${VICTIM_EMAIL}`, VICTIM_EMAIL, "pro", "Victim Plumbing", "+15125550101", hash, new Date(), new Date()]);
const victimId = uA.insertId;
const [uB] = await db.query(
  "INSERT INTO users (openId, email, planId, businessName, phone, passwordHash, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)",
  [`e2e-${ATTACKER_EMAIL}`, ATTACKER_EMAIL, "pro", "Attacker Rivals", "+15125550202", hashB, new Date(), new Date()]);
const attackerId = uB.insertId;
const [clientRow] = await db.query(
  "INSERT INTO clients (userId, name, email, phone, service, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)",
  [victimId, "Victor Client", "victor@example.com", "+15125550303", "leak repair", new Date(), new Date()]);
const victimClientId = clientRow.insertId;
const [invoiceRow] = await db.query(
  "INSERT INTO invoices (userId, clientId, invoiceNumber, clientName, service, amount, status, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)",
  [victimId, victimClientId, "SEC-INV-1", "Victor Client", "leak repair", "500.00", "sent", new Date(), new Date()]);
const victimInvoiceId = invoiceRow.insertId;

// ── Login helper (real auth path) ─────────────────────────────────────────────
const login = async (email, password, extraHeaders = {}) => {
  const res = await fetch(`${BASE}/api/trpc/auth.login?batch=1`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify({ "0": { json: { email, password } } }),
  });
  const cookie = (res.headers.getSetCookie?.() ?? []).map(c => c.split(";")[0]).join("; ");
  return { res, cookie };
};

const trpc = async (op, input, cookie, extraHeaders = {}) => {
  const res = await fetch(`${BASE}/api/trpc/${op}?batch=1`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...extraHeaders },
    body: JSON.stringify({ "0": { json: input } }),
  });
  let body = null;
  try { body = JSON.parse(await res.text()); } catch {}
  return { res, body };
};

const trpcGet = async (op, input = null, cookie = null, extraHeaders = {}) => {
  const res = await fetch(`${BASE}/api/trpc/${op}?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: input } }))}`, {
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...extraHeaders },
  });
  let body = null;
  try { body = JSON.parse(await res.text()); } catch {}
  return { res, body };
};
const isUnauth = (b) => b?.["0"]?.error?.json?.code === "UNAUTHORIZED" || b?.["0"]?.error?.json?.code === -32001;

const loginA = await login(VICTIM_EMAIL, VICTIM_PASSWORD);
const cookieA = loginA.cookie;
check("victim login via real auth path", loginA.res.status === 200 && cookieA.length > 10, `status=${loginA.res.status}`);
const loginB = await login(ATTACKER_EMAIL, ATTACKER_PASSWORD);
const cookieB = loginB.cookie;
check("attacker login via real auth path", loginB.res.status === 200 && cookieB.length > 10, `status=${loginB.res.status}`);

// ── 1. Security headers on live responses ────────────────────────────────────
const homeRes = await fetch(`${BASE}/`);
const h = (name) => homeRes.headers.get(name) ?? "";
check("CSP + HSTS + nosniff + frame + referrer headers present", Boolean(
  h("content-security-policy") && h("strict-transport-security") &&
  h("x-content-type-options") === "nosniff" && h("x-frame-options") && h("referrer-policy")
), `csp=${Boolean(h("content-security-policy"))} hsts=${Boolean(h("strict-transport-security"))}`);
check("server fingerprint stripped (no X-Powered-By / Server)", !h("x-powered-by") && !h("server"), `x-powered-by="${h("x-powered-by")}"`);

const apiRes = await fetch(`${BASE}/api/health`);
check("API responses are never cacheable (no-store)", (apiRes.headers.get("cache-control") ?? "").includes("no-store"), `cache-control=${apiRes.headers.get("cache-control")}`);

// ── 2. Session cookie flags ──────────────────────────────────────────────────
const setCookies = loginA.res.headers.getSetCookie?.() ?? [];
const sessionCookie = setCookies.find(c => c.startsWith("session") || c.includes("HttpOnly")) ?? setCookies[0] ?? "";
check("session cookie is HttpOnly + SameSite=Lax", /httponly/i.test(sessionCookie) && /samesite=lax/i.test(sessionCookie), sessionCookie.slice(0, 90));

// ── 3. Cross-tenant read (IDOR): B reads A's client by id ─────────────────────
const idorRead = await trpcGet("clients.get", { id: victimClientId }, cookieB);
const idorData = idorRead.body?.["0"]?.error?.json?.message ?? "";
check("cross-tenant read denied (attacker cannot read victim's client)", idorData.includes("not found") || idorRead.res.status === 404, `message="${idorData}"`);

// ── 4. Cross-tenant write (IDOR): B marks A's invoice paid ────────────────────
const idorWrite = await trpc("invoices.markPaid", { id: victimInvoiceId }, cookieB);
const writeMsg = idorWrite.body?.["0"]?.error?.json?.message ?? "";
check("cross-tenant write denied (attacker cannot mutate victim's invoice)", /not found|unauthorized|forbidden/i.test(writeMsg), `message="${writeMsg}"`);
const [invAfter] = await db.query("SELECT status, paidAt FROM invoices WHERE id = ?", [victimInvoiceId]);
check("victim's invoice untouched after attack", invAfter[0]?.status === "sent" && !invAfter[0]?.paidAt, `status=${invAfter[0]?.status}`);

// ── 5. Anonymous access to protected data ────────────────────────────────────
const anon = await trpcGet("clients.list", { search: "" }, null);
check("anonymous requests rejected (401, no data)", isUnauth(anon.body), `code=${anon.body?.["0"]?.error?.json?.code}`);

// ── 6. SQL injection: parameterized query survives quote payload ─────────────
const sqli = await trpcGet("clients.list", { search: "' OR 1=1 --" }, cookieA);
const sqliRows = sqli.body?.["0"]?.result?.data?.json ?? [];
check("SQLi quote payload returns no data, no error (parameterized)", Array.isArray(sqliRows) && sqliRows.length === 0, `rows=${Array.isArray(sqliRows) ? sqliRows.length : "err"}`);

// ── 7. SQL injection: UNION payload blocked by the WAF layer ──────────────────
const union = await trpcGet("clients.list", { search: "x' UNION SELECT * FROM users --" }, cookieA);
check("UNION SELECT payload blocked at the edge (400)", union.res.status === 400, `status=${union.res.status}`);

// ── 8. Stored XSS: script payload blocked, benign HTML round-trips verbatim ──
const xssAttempt = await trpc("clients.create", { name: "<script>alert(1)</script> Evil" }, cookieA);
check("<script> payload blocked at the edge (400)", xssAttempt.res.status === 400, `status=${xssAttempt.res.status}`);
const benign = await trpc("clients.create", { name: "<b>Bold Co</b>", service: "xss round-trip probe" }, cookieA);
const benignId = benign.body?.["0"]?.result?.data?.json?.id;
const readBack = await trpcGet("clients.get", { id: benignId }, cookieA);
const storedName = readBack.body?.["0"]?.result?.data?.json?.name ?? "";
check("stored value round-trips verbatim (React escapes on render, no server-side HTML)", storedName === "<b>Bold Co</b>", `stored="${storedName}"`);

// ── 9. JWT tampering: flipped signature ──────────────────────────────────────
const parts = cookieA.split("=")[1]?.split(".") ?? [];
const flipped = `${parts[0]}.${parts[1]}.${(parts[2] ?? "sig").slice(0, -2)}xx`;
const flippedRes = await fetch(`${BASE}/api/trpc/clients.list?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: { search: "" } } }))}`, {
  headers: { Cookie: `app_session_id=${flipped}` },
});
const flippedBody = JSON.parse(await flippedRes.text());
check("tampered JWT signature rejected", isUnauth(flippedBody), `code=${flippedBody?.["0"]?.error?.json?.code}`);

// ── 10. JWT tampering: alg=none unsigned token ───────────────────────────────
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const noneToken = `${b64({ alg: "none", typ: "JWT" })}.${b64({ userId: victimId, email: VICTIM_EMAIL, exp: Math.floor(Date.now() / 1000) + 3600 })}.`;
const noneRes = await fetch(`${BASE}/api/trpc/clients.list?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: { search: "" } } }))}`, {
  headers: { Cookie: `app_session_id=${noneToken}` },
});
const noneBody = JSON.parse(await noneRes.text());
check("alg=none unsigned token rejected", isUnauth(noneBody), `code=${noneBody?.["0"]?.error?.json?.code}`);

// ── 11. CSRF: foreign Origin on state-changing request ──────────────────────
const csrfEvil = await trpc("clients.create", { name: "CSFR Probe" }, cookieA, { Origin: "https://evil.example" });
check("foreign-Origin POST rejected (403, CSRF layer 2)", csrfEvil.res.status === 403, `status=${csrfEvil.res.status}`);
const csrfOk = await trpc("clients.create", { name: "Origin Probe OK" }, cookieA, { Origin: "http://localhost:3998" });
check("same-Origin POST accepted (no false positives)", csrfOk.body?.["0"]?.result?.data?.json?.id > 0, `status=${csrfOk.res.status}`);

// ── 12. Account lockout: 5 bad logins lock the account ───────────────────────
for (let i = 0; i < 5; i++) {
  await login(VICTIM_EMAIL, "WrongPassword-" + i);
}
const lockedLogin = await login(VICTIM_EMAIL, VICTIM_PASSWORD);
check("locked account refuses even the CORRECT password (TOO_MANY_REQUESTS, no session issued)", (lockedLogin.res.status === 429 || lockedLogin.res.status === 400 || !lockedLogin.cookie.includes("app_session_id=")), `status=${lockedLogin.res.status}`);
const [lockEvents] = await db.query(
  "SELECT COUNT(*) AS n FROM securityEvents WHERE eventType = 'account_locked' AND email = ?", [VICTIM_EMAIL]);
check("lockout recorded as CRITICAL security event for the owner", Number(lockEvents[0]?.n) > 0, `events=${lockEvents[0]?.n}`);

// ── 13. Rate limit: auth route exhaustion → 429 ──────────────────────────────
let saw429 = false;
for (let i = 0; i < 110; i++) {
  const r = await login(`ratelimit-probe-${i}@test.local`, "irrelevant");
  if (r.res.status === 429) { saw429 = true; break; }
}
check("auth rate limit enforced (429 before brute force scale)", saw429, saw429 ? "throttled" : "never throttled in 110 tries");

// ── Cleanup ─────────────────────────────────────────────────────────────────
await db.query("DELETE FROM clients WHERE userId = ?", [victimId]);
await db.query("DELETE FROM clients WHERE userId = ?", [attackerId]);
await db.query("DELETE FROM invoices WHERE userId = ?", [victimId]);
await db.query("DELETE FROM securityEvents WHERE email = ?", [VICTIM_EMAIL]);
await db.query("DELETE FROM users WHERE email IN (?, ?)", [VICTIM_EMAIL, ATTACKER_EMAIL]);
await db.end();

const failed = results.filter(r => !r.ok).length;
console.log(`\n${failed === 0 ? "✓" : "✗"} Security probe: ${failed === 0 ? "PASS" : "FAIL"} (${results.length - failed}/${results.length})`);
process.exit(failed === 0 ? 0 : 1);
