// Live e2e for the Oct 23 2026 QR asset check-in labels. Runs against a booted
// production build on :3998. Every scenario exercises the real HTTP path:
// owner tRPC login → one-click label (token mint + QR PNG), public scan page
// data, service request capture into the owner queue, honest 404s, and the
// deactivation kill-switch.
import { createHmac } from "node:crypto";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const BASE = "http://localhost:3998";
const OWNER_EMAIL = "e2e-asset-qr@test.local";
const OWNER_PASSWORD = "E2e-QrLabels-2026!";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const db = await mysql.createConnection({ host: "127.0.0.1", user: "trueaxis", password: "trueaxis", database: "trueaxis" });

// ── Seed a clean owner + client + two assets ─────────────────────────────────
await db.query("DELETE FROM assetServiceRequests WHERE userId IN (SELECT id FROM users WHERE email = ?)", [OWNER_EMAIL]).catch(() => {});
await db.query("DELETE FROM customerAssets WHERE userId IN (SELECT id FROM users WHERE email = ?)", [OWNER_EMAIL]).catch(() => {});
await db.query("DELETE FROM clients WHERE userId IN (SELECT id FROM users WHERE email = ?)", [OWNER_EMAIL]).catch(() => {});
await db.query("DELETE FROM users WHERE email = ?", [OWNER_EMAIL]).catch(() => {});
const passwordHash = bcrypt.hashSync(OWNER_PASSWORD, 10);
const [u] = await db.query(
  "INSERT INTO users (openId, email, planId, businessName, phone, passwordHash, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)",
  [`e2e-${OWNER_EMAIL}`, OWNER_EMAIL, "pro", "E2E HVAC Co", "+15125550001", passwordHash, new Date(), new Date()]);
const ownerId = u.insertId;
const [c] = await db.query(
  "INSERT INTO clients (userId, name, email, phone, createdAt, updatedAt) VALUES (?,?,?,?,?,?)",
  [ownerId, "Dana Client", "dana.client@example.com", "+15125550009", new Date(), new Date()]);
const clientId = c.insertId;
const [a1] = await db.query(
  "INSERT INTO customerAssets (userId, clientId, name, assetTag, functionalLocation, notes, active, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)",
  [ownerId, clientId, "Rooftop HVAC Unit", "AC-001", "Roof hatch", "PRIVATE: capacitor is weak, quote on next visit", 1, new Date(), new Date()]);
const assetId = a1.insertId;
const [a2] = await db.query(
  "INSERT INTO customerAssets (userId, clientId, name, assetTag, notes, active, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)",
  [ownerId, clientId, "Retired Boiler", "BOI-9", "PRIVATE note", 0, new Date(), new Date()]);
const retiredAssetId = a2.insertId;

// ── Owner login (real auth path) ──────────────────────────────────────────────
const loginRes = await fetch(`${BASE}/api/trpc/auth.login?batch=1`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ "0": { json: { email: OWNER_EMAIL, password: OWNER_PASSWORD } } }),
});
let cookie = (loginRes.headers.getSetCookie?.() ?? []).map(c => c.split(";")[0]).join("; ");
if (!cookie) {
  // Fall back to the raw set-cookie header shape
  const raw = loginRes.headers.get("set-cookie");
  cookie = raw ? raw.split(";")[0] : "";
}
check("owner login via real auth path", loginRes.status === 200 && cookie.length > 10, `status=${loginRes.status}`);

// tRPC helpers (superjson batch shape; queries need GET, mutations POST)
const trpc = async (op, input) => {
  const res = await fetch(`${BASE}/api/trpc/${op}?batch=1`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ "0": { json: input } }),
  });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch {}
  return { res, body, text };
};
const trpcQuery = async (op, input) => {
  const res = await fetch(`${BASE}/api/trpc/${op}?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: input } }))}`, {
    method: "GET",
    headers: { Cookie: cookie },
  });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch {}
  return { res, body, text };
};

// ── Scenario 1: one-click label mints a token and renders a QR PNG ───────────
{
  const { res, body } = await trpc("customerAssets.labelQr", { id: assetId });
  const dataUrl = body?.[0]?.result?.data?.json?.dataUrl ?? body?.[0]?.result?.dataUrl ?? "";
  const scanUrl = body?.[0]?.result?.data?.json?.scanUrl ?? body?.[0]?.result?.scanUrl ?? "";
  const ok = res.status === 200 && dataUrl.startsWith("data:image/png;base64,") && scanUrl.endsWith(`/asset/`) === false && scanUrl.includes("/asset/");
  check("labelQr: mints token + renders QR PNG in one call", ok, `scanUrl=${scanUrl.slice(0, 60)}`);
  const [row] = await db.query("SELECT scanToken FROM customerAssets WHERE id=?", [assetId]);
  const token = row?.[0]?.scanToken ?? "";
  check("labelQr: 64-hex token persisted on the asset row", /^[0-9a-f]{64}$/.test(token), token.slice(0, 16) + "…");
  globalThis.__token = token;

  // Idempotent: same token on a second call, no double-mint
  await trpc("customerAssets.labelQr", { id: assetId });
  const token2raw = await db.query("SELECT scanToken FROM customerAssets WHERE id=?", [assetId]);
  check("labelQr: idempotent (same token on reprint)", token2raw[0][0]?.scanToken === token);
}

// ── Scenario 2: public scan GET — safe projection only ──────────────────────
{
  const token = globalThis.__token;
  const res = await fetch(`${BASE}/api/asset/${token}`);
  const json = await res.json().catch(() => null);
  const d = json?.data ?? {};
  const hasSafe = res.status === 200 && d.businessName === "E2E HVAC Co" && d.assetName === "Rooftop HVAC Unit" && d.assetTag === "AC-001";
  const noPrivate = !JSON.stringify(json).includes("PRIVATE") && !JSON.stringify(json).includes("Dana") && !JSON.stringify(json).includes("dana.client") && !JSON.stringify(json).includes("+15125550009");
  check("public GET: business + asset identity, zero private leakage", hasSafe && noPrivate, `servicesCompleted=${d.servicesCompleted}`);
  const [[stamp]] = await db.query("SELECT lastScanAt FROM customerAssets WHERE id=?", [assetId]);
  check("public GET: scan stamped on the asset row", Boolean(stamp?.lastScanAt));
}

// ── Scenario 3: unknown / malformed tokens are honest 404s ───────────────────
{
  const bad404 = await fetch(`${BASE}/api/asset/${"0".repeat(64)}`);
  const malformed = await fetch(`${BASE}/api/asset/not-a-token`);
  check("unknown + malformed tokens → honest 404 (no enumeration)", bad404.status === 404 && malformed.status === 404,
    `${bad404.status}/${malformed.status}`);
}

// ── Scenario 4: customer requests service → owner queue + audit ─────────────
{
  const token = globalThis.__token;
  const res = await fetch(`${BASE}/api/asset/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "request_service", name: "Marcus Requester", phone: "(512) 555-0123", message: "Unit is humming loudly since Tuesday." }),
  });
  const json = await res.json().catch(() => null);
  const [rows] = await db.query("SELECT id, name, phone, message, handled FROM assetServiceRequests WHERE assetId=? ORDER BY id DESC LIMIT 1", [assetId]);
  const [audit] = await db.query("SELECT action FROM auditLogs WHERE userId=? AND action='asset.qr.request' ORDER BY id DESC LIMIT 1", [ownerId]);
  check("request_service: 201 + row in owner queue", res.status === 201 && rows[0]?.name === "Marcus Requester" && rows[0]?.handled === 0, `status=${res.status}`);
  check("request_service: audit-logged for the owner", Boolean(audit[0]));

  // Validation: bad phone rejected before the queue is touched
  const bad = await fetch(`${BASE}/api/asset/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "request_service", name: "X", phone: "123", message: "hi" }),
  });
  check("request_service: invalid phone/name rejected (400)", bad.status === 400, `status=${bad.status}`);
}

// ── Scenario 5: owner queue sees the request; resolution is owner-scoped ─────
{
  const { body } = await trpcQuery("customerAssets.serviceRequests", { handled: false });
  const rows = body?.[0]?.result?.data?.json ?? body?.[0]?.result?.data ?? [];
  const match = Array.isArray(rows) && rows.find(r => r.name === "Marcus Requester");
  check("owner queue: request visible with asset context", Boolean(match?.assetName === "Rooftop HVAC Unit"), `assetName=${match?.assetName}`);
  const { res } = await trpc("customerAssets.resolveServiceRequest", { id: match.id, handled: true });
  const [[resolved]] = await db.query("SELECT handled FROM assetServiceRequests WHERE id=?", [match.id]);
  check("owner queue: resolve marks handled", res.status === 200 && resolved?.handled === 1);
}

// ── Scenario 6: deactivating the asset kills the public label ─────────────────
{
  // Mint a label for the retired (inactive) asset via direct SQL simulating an
  // earlier mint, then confirm the public API refuses it.
  await db.query("UPDATE customerAssets SET scanToken=? WHERE id=?", [createHmac("sha256", "e2e").update(String(retiredAssetId)).digest("hex"), retiredAssetId]);
  const res = await fetch(`${BASE}/api/asset/${createHmac("sha256", "e2e").update(String(retiredAssetId)).digest("hex")}`);
  check("deactivated asset: label 404s (kill switch works)", res.status === 404, `status=${res.status}`);
}

// ── Scenario 7: the public page itself renders for a valid token ─────────────
{
  const token = globalThis.__token;
  const res = await fetch(`${BASE}/asset/${token}`);
  const html = await res.text();
  check("public scan page route serves HTML", res.status === 200 && (html.includes("<div id=\"root\">") || html.includes("<title>")), `status=${res.status}`);
}

// ── Cleanup ───────────────────────────────────────────────────────────────────
await db.query("DELETE FROM assetServiceRequests WHERE userId=?", [ownerId]);
await db.query("DELETE FROM customerAssets WHERE userId=?", [ownerId]);
await db.query("DELETE FROM clients WHERE userId=?", [ownerId]);
await db.query("DELETE FROM users WHERE id=?", [ownerId]);
await db.end();

const failed = results.filter(r => !r.ok);
console.log(`\n${failed.length === 0 ? "ALL PASS" : "FAILURES"}: ${results.length - failed.length}/${results.length}`);
process.exit(failed.length ? 1 : 0);
