// Live e2e for the Oct 23 2026 PO job-costing roll-up (Jobber's #1 unfulfilled
// request). Runs against a booted production build on :3998. Every scenario
// exercises the real HTTP path: owner tRPC login → inventory + purchase
// orders linked to a job → the roll-up that lands in jobs.get, the portfolio
// cost report, and the CSV export, plus ownership and draft-only guards.
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const BASE = "http://localhost:3998";
const OWNER_EMAIL = "e2e-po-cost@test.local";
const OWNER_PASSWORD = "E2e-PoCosting-2026!";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const db = await mysql.createConnection({ host: "127.0.0.1", user: "trueaxis", password: "trueaxis", database: "trueaxis" });

// ── Seed a clean owner + client ───────────────────────────────────────────────
const cleanup = async () => {
  const [rows] = await db.query("SELECT id FROM users WHERE email = ?", [OWNER_EMAIL]);
  if (!rows.length) return;
  const ownerId = rows[0].id;
  const [jobRows] = await db.query("SELECT id FROM jobs WHERE userId = ?", [ownerId]);
  const jobIds = jobRows.map(r => r.id);
  if (jobIds.length) {
    await db.query("DELETE FROM jobActivities WHERE jobId IN (?)", [jobIds]).catch(() => {});
    await db.query("DELETE FROM inventoryMovements WHERE jobId IN (?)", [jobIds]).catch(() => {});
    await db.query("DELETE FROM purchaseOrderItems WHERE userId = ?", [ownerId]).catch(() => {});
    await db.query("DELETE FROM purchaseOrders WHERE userId = ?", [ownerId]).catch(() => {});
    await db.query("DELETE FROM jobs WHERE id IN (?)", [jobIds]).catch(() => {});
  }
  await db.query("DELETE FROM inventoryMovements WHERE userId = ?", [ownerId]).catch(() => {});
  await db.query("DELETE FROM inventoryItems WHERE userId = ?", [ownerId]).catch(() => {});
  await db.query("DELETE FROM inventoryLocations WHERE userId = ?", [ownerId]).catch(() => {});
  await db.query("DELETE FROM clients WHERE userId = ?", [ownerId]).catch(() => {});
  await db.query("DELETE FROM users WHERE id = ?", [ownerId]).catch(() => {});
};
await cleanup();
// Also clear the cross-tenant probe user from any previous run
const [prevOther] = await db.query("SELECT id FROM users WHERE email = ?", ["e2e-po-cost-other@test.local"]);
if (prevOther?.id) {
  await db.query("DELETE FROM inventoryLocations WHERE userId = ?", [prevOther.id]).catch(() => {});
  await db.query("DELETE FROM users WHERE id = ?", [prevOther.id]).catch(() => {});
}
const passwordHash = bcrypt.hashSync(OWNER_PASSWORD, 10);
const [u] = await db.query(
  "INSERT INTO users (openId, email, planId, businessName, phone, passwordHash, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)",
  [`e2e-${OWNER_EMAIL}`, OWNER_EMAIL, "pro", "E2E Plumbing Co", "+15125550002", passwordHash, new Date(), new Date()]);
const ownerId = u.insertId;
const [c] = await db.query(
  "INSERT INTO clients (userId, name, email, phone, createdAt, updatedAt) VALUES (?,?,?,?,?,?)",
  [ownerId, "Riley Client", "riley.client@example.com", "+15125550019", new Date(), new Date()]);
const clientId = c.insertId;

// ── Owner login (real auth path) ──────────────────────────────────────────────
const loginRes = await fetch(`${BASE}/api/trpc/auth.login?batch=1`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ "0": { json: { email: OWNER_EMAIL, password: OWNER_PASSWORD } } }),
});
let cookie = (loginRes.headers.getSetCookie?.() ?? []).map(c => c.split(";")[0]).join("; ");
if (!cookie) cookie = (loginRes.headers.get("set-cookie") ?? "").split(";")[0];
check("owner login via real auth path", loginRes.status === 200 && cookie.length > 10, `status=${loginRes.status}`);

// tRPC helpers (superjson batch shape; queries need GET, mutations POST)
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

// ── Job + inventory setup ─────────────────────────────────────────────────────
const job = data0((await trpc("jobs.create", { clientId, title: "Bathroom repipe", status: "in_progress", budgetAmount: 1000 })).body);
check("job created", !!job?.id, `jobNumber=${job?.jobNumber}`);

const loc = data0((await trpc("inventory.createLocation", { name: "Main Warehouse", type: "warehouse" })).body);
const locationId = loc?.id ?? loc?.locationId;
check("inventory location created", !!locationId, JSON.stringify(loc).slice(0, 80));
const item = data0((await trpc("inventory.createItem", { name: "Copper pipe 10ft", sku: "COP-10", unit: "each", unitCost: 10, unitPrice: 25, reorderPoint: 2 })).body);
const itemId = item?.id;
check("inventory item created", !!itemId, JSON.stringify(item).slice(0, 80));

await trpc("inventory.receiveStock", { itemId, locationId, quantity: 20, unitCost: 10, note: "Opening stock" });

// Stock consumed onto the job: 2 × $10 = $20 materials cost
const consume = await trpc("inventory.consumeForJob", { itemId, locationId, jobId: job.id, quantity: 2 });
check("stock consumed onto the job", consume.res.status === 200 && !data0(consume.body)?.error, `status=${consume.res.status}`);

// ── Purchase order linked to the job ──────────────────────────────────────────
// 3 catalog lines @ $50 + 1 freeform @ $25 → total $175
const po = data0((await trpc("inventory.createPurchaseOrder", {
  supplierName: "Ferguson Plumbing", locationId, jobId: job.id,
  items: [
    { inventoryItemId: itemId, description: "Copper pipe 10ft", quantity: 3, unitCost: 50 },
    { description: "Custom flange", quantity: 1, unitCost: 25 },
  ],
})).body);
check("job-linked purchase order created as draft", !!po?.id, `poNumber=${po?.poNumber}`);

await trpc("inventory.submitPurchaseOrder", { id: po.id });
const receive = await trpc("inventory.receivePurchaseOrder", { id: po.id });
check("purchase order received", receive.res.status === 200 && !data0(receive.body)?.error, `status=${receive.res.status}`);

// ── The roll-up ───────────────────────────────────────────────────────────────
const detail = data0((await trpcQuery("jobs.get", { id: job.id })).body);
const f = detail?.financials;
check("jobs.get financials include materials cost", f != null && typeof f.materialCost === "number", `materialCost=${f?.materialCost}`);
check("materials = received PO $175 + consumed stock $20", f?.materialCost === 195, `got ${f?.materialCost}`);
check("totalCost includes materials", f?.totalCost === 195 && f?.revenue === 1000 && f?.profit === 805, `totalCost=${f?.totalCost} profit=${f?.profit}`);
check("material orders and movements surfaced to the owner", detail?.materialOrders?.length === 1 && detail?.materialMovements?.length === 1,
  `orders=${detail?.materialOrders?.length} movements=${detail?.materialMovements?.length}`);

const report = data0((await trpcQuery("jobs.costReport", {})).body);
const row = report?.find(r => r.jobNumber === job.jobNumber);
check("portfolio cost report row carries materials", row?.materialCost === 195, `report materialCost=${row?.materialCost}`);

const csv = data0((await trpcQuery("jobs.exportCostReport", {})).body);
check("CSV export carries the materials column", !!csv?.csv && csv.csv.includes("Materials (POs + stock)") && csv.csv.includes("195.00"), `header ok=${csv?.csv?.includes("Materials (POs + stock)")}`);

// ── Guards ─────────────────────────────────────────────────────────────────────
const foreignJob = await trpc("inventory.createPurchaseOrder", {
  supplierName: "Bad Supplier", locationId, jobId: 999999999,
  items: [{ description: "Nothing", quantity: 1, unitCost: 1 }],
});
const trpcError = body => body?.["0"]?.error?.json?.message ?? body?.["0"]?.error?.message ?? "";
const foreignOk = foreignJob.res.status === 404 && trpcError(JSON.parse(foreignJob.text)).includes("Job not found");
check("PO for a non-existent job is rejected", foreignOk, `status=${foreignJob.res.status} body=${foreignJob.text.slice(0, 120)}`);

// A second owner must not be able to link a PO to our job (cross-tenant)
const otherEmail = "e2e-po-cost-other@test.local";
await db.query("DELETE FROM users WHERE email = ?", [otherEmail]).catch(() => {});
await db.query("INSERT INTO users (openId, email, planId, businessName, passwordHash, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)",
  [`e2e-${otherEmail}`, otherEmail, "pro", "Other Co", bcrypt.hashSync("OtherPass-2026!", 10), new Date(), new Date()]);
const otherLogin = await fetch(`${BASE}/api/trpc/auth.login?batch=1`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ "0": { json: { email: otherEmail, password: "OtherPass-2026!" } } }),
});
const otherCookie = (otherLogin.headers.getSetCookie?.() ?? []).map(c => c.split(";")[0]).join("; ");
// Other owner sets up their own location first, so any rejection below is about the job link, not the location
const otherLocRes = await fetch(`${BASE}/api/trpc/inventory.createLocation?batch=1`, {
  method: "POST", headers: { "Content-Type": "application/json", Cookie: otherCookie },
  body: JSON.stringify({ "0": { json: { name: "Other Warehouse", type: "warehouse" } } }),
});
let otherLocBody = null; try { otherLocBody = JSON.parse(await otherLocRes.text()); } catch {}
const otherLocationId = otherLocBody?.["0"]?.result?.data?.json?.id;
const crossRes = await fetch(`${BASE}/api/trpc/inventory.createPurchaseOrder?batch=1`, {
  method: "POST", headers: { "Content-Type": "application/json", Cookie: otherCookie },
  body: JSON.stringify({ "0": { json: { supplierName: "Cross Co", locationId: otherLocationId, jobId: job.id, items: [{ description: "Nope", quantity: 1, unitCost: 1 }] } } }),
});
let crossBody = null; try { crossBody = JSON.parse(await crossRes.text()); } catch {}
const crossMsg = trpcError(crossBody);
check("another owner cannot link a PO to our job", crossMsg.includes("Job not found"), `msg=${crossMsg.slice(0, 80)}`);

// Draft-only PO editing: jobId cannot be re-linked after receiving
const relink = await trpc("inventory.updatePurchaseOrder", { id: po.id, jobId: null });
let relinkBody = null; try { relinkBody = JSON.parse(relink.text); } catch {}
const relinkErr = trpcError(relinkBody);
check("received PO cannot be edited (job link frozen)", relink.res.status === 400 && relinkErr.includes("Only draft"), `status=${relink.res.status} msg=${relinkErr.slice(0, 80)}`);

// The activity feed recorded the material receipt
const detail2 = data0((await trpcQuery("jobs.get", { id: job.id })).body);
const activity = (detail2?.activities ?? []).find(a => a.eventType === "material_received");
check("job activity logged for the received PO", !!activity, `found=${!!activity}`);

await cleanup();
await db.end();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
