#!/usr/bin/env node
// Manual pass driver for PUBLIC pages: same per-step evidence as the dashboard
// driver, but without login, plus a full verified walk of the 3-step booking
// wizard. Usage: node scripts/manual-pass-public.cjs <passNo>
const { chromium } = require("/root/.npm/_npx/e41f203b7505f1fb/node_modules/playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.QA_BASE || "http://localhost:3998";
const EXE = "/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const PASS = process.argv[2] || "1";
const OUT = path.join("manual-qa", `pass${PASS}`, "public.ndjson");
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const PAGES = ["/", "/pricing", "/about", "/contact", "/help", "/privacy", "/terms", "/security", "/status", "/changelog", "/compare", "/login", "/staff-access", "/admin-login"];
const DESTRUCTIVE = /delete|remove|revoke|disconnect|sign ?out|log ?out|archive|resend|reset|purge|unlink|deactivate/i;
const SKIP_CLICK = /start free|get started|sign ?up|register|book a call|schedule a demo|contact sales|buy|subscribe|checkout/i;

const record = (entry) => fs.appendFileSync(OUT, JSON.stringify(entry) + "\n");

async function runPage(page, url, errors, stepRef) {
  let step = stepRef.n;
  const note = (action, target, ok, detail) => { record({ step: ++step, page: url, action, target: (target || "").slice(0, 60), ok, ...detail }); stepRef.n = step; };
  await page.goto(BASE + url, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1800);
  await page.keyboard.press("Escape").catch(() => {});

  const enumerate = () => page.evaluate(() => {
    const out = [];
    const push = (kind, el, idx) => {
      const r = el.getBoundingClientRect();
      out.push({ kind, idx, visible: el.getClientRects().length > 0 && r.width > 0 && r.height > 0, text: (el.getAttribute("aria-label") || el.innerText || el.placeholder || el.title || "").trim().replace(/\s+/g, " ").slice(0, 70), disabled: el.disabled === true, type: el.getAttribute("type") || el.tagName.toLowerCase() });
    };
    document.querySelectorAll("button").forEach((el, i) => push("button", el, i));
    document.querySelectorAll("input:not([type='hidden']):not([type='checkbox']):not([type='radio']):not([type='file'])").forEach((el, i) => push("input", el, i));
    document.querySelectorAll("textarea").forEach((el, i) => push("textarea", el, i));
    document.querySelectorAll("select").forEach((el, i) => push("select", el, i));
    return out;
  });
  const sampleValue = (t) => {
    t = (t || "").toLowerCase();
    if (t === "email") return "qa-flow@trueaxis.hq";
    if (t === "tel" || t === "phone") return "+14155550101";
    if (t === "number") return "2";
    if (t === "date") return "2026-11-15";
    if (t === "time") return "10:30";
    if (t === "datetime-local") return "2026-11-15T10:30";
    if (t.includes("email")) return "qa-flow@trueaxis.hq";
    return "QA Test 42";
  };
  const grabToasts = () => page.evaluate(() => [...document.querySelectorAll('[role="status"],[data-sonner-toast],[class*="toast"]')].map((t) => t.innerText.trim()).filter(Boolean).slice(0, 2)).catch(() => []);

  // type into every visible field
  for (const f of (await enumerate()).filter((c) => c.visible && !c.disabled && ["input", "textarea", "select"].includes(c.kind))) {
    const before = errors.slice();
    try {
      const loc = page.locator(f.kind === "input" ? "input:not([type='hidden']):not([type='checkbox']):not([type='radio']):not([type='file'])" : f.kind).nth(f.idx);
      await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      if (f.kind === "select") await loc.selectOption({ index: 1 });
      else await loc.fill(sampleValue(f.type), { force: true, timeout: 4000 });
      const got = await loc.inputValue();
      note("type", `${f.kind}[${f.text}]`, true, { value: (got || "").slice(0, 40), newErrors: errors.slice(before.length) });
    } catch (e) { note("type", `${f.kind}[${f.text}]`, false, { reason: String(e).slice(0, 100), newErrors: errors.slice(before.length) }); }
  }

  // click every visible safe button
  for (const b of (await enumerate()).filter((c) => c.kind === "button" && c.visible && !c.disabled)) {
    const text = b.text || "(icon-only)";
    if (SKIP_CLICK.test(text)) { note("skip-signup-monetization", text, true, { why: "creates account / starts paid funnel" }); continue; }
    if (DESTRUCTIVE.test(text)) { note("skip-destructive", text, true, {}); continue; }
    const before = errors.slice();
    const path0 = new URL(page.url()).pathname;
    let ce = null;
    try {
      const loc = page.locator("button").nth(b.idx);
      await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      if (await loc.isDisabled().catch(() => true)) { note("skip-disabled", text, true, {}); continue; }
      await loc.click({ force: true, timeout: 4000 });
    } catch (e) { ce = String(e).slice(0, 100); }
    await page.waitForTimeout(450);
    const path1 = new URL(page.url()).pathname;
    const toasts = await grabToasts();
    const errs = errors.slice(before.length);
    note("click", text, !ce && errs.length === 0, { clickErr: ce, urlChangedTo: path1 !== path0 ? path1 : null, toast: toasts[0]?.slice(0, 80) || null, newErrors: errs });
    // restore: go back to the page we're sweeping
    if (path1 !== path0) {
      await page.goto(BASE + url, { waitUntil: "networkidle" }).catch(() => {});
      await page.waitForTimeout(1200);
    }
  }
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 200)));
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("favicon")) errors.push(`HTTP ${r.status()} ${r.url().split("?")[0].slice(-60)}`); });
  const stepRef = { n: 0 };

  for (const url of PAGES) { await runPage(page, url, errors, stepRef); }
  const pagesBad = 0;

  // Login honest-error path: wrong password must show a real message, no crash
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "demo@trueaxis.hq");
  await page.fill('input[type="password"]', "wrong-password-on-purpose");
  const before = errors.slice();
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  const errText = await page.evaluate(() => document.body.innerText.match(/(incorrect|invalid|wrong|error|try again)[^\n]{0,50}/i)?.[0] || "");
  record({ step: ++stepRef.n, page: "/login", action: "wrong-password", target: "demo@trueaxis.hq", ok: !!errText, honestError: errText.slice(0, 70), newErrors: errors.slice(before.length) });

  // Full booking wizard, verified step by step
  await page.goto(BASE + "/book/rivera-plumbing", { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  for (const f of await page.locator("input:visible, textarea:visible").all()) {
    const t = (await f.getAttribute("type")) || "";
    await f.fill(t === "email" ? "qa-flow@trueaxis.hq" : t === "tel" ? "+14155550101" : "QA Test 42", { force: true, timeout: 3000 }).catch(() => {});
  }
  // The wizard honestly requires a service before continuing — pick the first one.
  const svc = page.locator("#service-select");
  if (await svc.isVisible().catch(() => false)) {
    await svc.selectOption({ index: 1 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  for (const name of ["Continue to date and time selection", "Continue to confirmation", "Submit booking request"]) {
    const b4 = errors.slice();
    if (name === "Continue to confirmation") {
      const dp = page.locator("[aria-label='Available dates'] button:not([disabled])").first();
      if (await dp.isVisible().catch(() => false)) { await dp.click({ force: true }); }
      const tp = page.locator("[aria-label='Available time slots'] button:not([disabled])").first();
      // Time slots load after the date is chosen — wait for them, don't race a 400ms guess.
      await tp.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
      if (await tp.isVisible().catch(() => false)) { await tp.click({ force: true }); await page.waitForTimeout(400); }
    }
    const btn = page.locator(`button[aria-label='${name}']`).first();
    let ce = null;
    try { await btn.click({ force: true, timeout: 4000 }); } catch (e) { ce = String(e).slice(0, 100); }
    await page.waitForTimeout(name === "Submit booking request" ? 2500 : 1200);
    const ok = name === "Submit booking request" ? await page.evaluate(() => /booked|thank/i.test(document.body.innerText)) : true;
    record({ step: ++stepRef.n, page: "/book/rivera-plumbing", action: "wizard-step", target: name, ok: !ce && ok, clickErr: ce, newErrors: errors.slice(b4.length) });
  }

  record({ step: ++stepRef.n, page: "summary", action: "summary", ok: errors.length === 0, totalErrors: errors.length });
  await browser.close();
  const lines = fs.readFileSync(OUT, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const bad = lines.filter((l) => l.ok === false);
  console.log(`MANUAL PUBLIC PASS ${PASS}: steps=${lines.length} bad=${bad.length}`);
  for (const b of bad) console.log(`  ✗ step ${b.step} ${b.action} [${b.page}] "${(b.target || "").slice(0, 40)}" ${b.reason || b.clickErr || ""} ${JSON.stringify(b.newErrors || []).slice(0, 120)}`);
  process.exit(0);
})().catch((e) => { console.error("DRIVER CRASH", e); process.exit(1); });
