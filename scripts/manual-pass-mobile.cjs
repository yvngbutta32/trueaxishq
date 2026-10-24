#!/usr/bin/env node
// Manual pass driver: one real browser session, one interaction per step, with
// per-step evidence (URL, dialog + its buttons, toast text, persistence, console
// errors since previous step) written to an ndjson log I review line by line.
// Usage: node scripts/manual-pass.cjs <panel> <passNo>
const { chromium } = require("/root/.npm/_npx/e41f203b7505f1fb/node_modules/playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.QA_BASE || "http://localhost:3998";
const EXE = "/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const EMAIL = "demo@trueaxis.hq";
const PASSWORD = "Demo-Preview-2026!";
const PANEL = process.argv[2];
const PASS = process.argv[3] || "1";
const OUT = path.join("manual-qa", `pass${PASS}-mobile`, `${PANEL}.ndjson`);
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const LIVE_PANELS = [
  ["overview", "Dashboard"], ["executive", "Operations"], ["ai", "AI Assistant"],
  ["clients", "Clients"], ["deals", "Deals"], ["outreach", "Outreach"],
  ["scheduling", "Scheduling"], ["jobs", "Jobs"], ["photos", "Job Photos"],
  ["dispatch", "Dispatch"], ["field", "Field Mode"],
  ["team", "Team"], ["subs", "Subs"],
  ["billing", "Billing"], ["inventory", "Inventory"],
  ["insights", "Insights"], ["reports", "Reports"],
  ["integrations", "Integrations"], ["webhooks", "Webhooks"], ["agency", "Sub-Accounts"],
  ["launch", "Launch"], ["import", "Import Data"], ["settings", "Settings"],
];
const DESTRUCTIVE = /delete|remove|revoke|disconnect|sign ?out|log ?out|cancel subscription|archive|resend|reset|purge|unlink|deactivate|stop tracking/i;
const SKIP_CLICK = /mark .*paid|pay now|charge|send test|send now|charge card/i;

const log = [];
const record = (entry) => { log.push(entry); fs.appendFileSync(OUT, JSON.stringify(entry) + "\n"); };

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  page.setDefaultTimeout(12000);
  let errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 200)));
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("favicon")) errors.push(`HTTP ${r.status()} ${r.url().split("?")[0].slice(-60)}`); });

  // login
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 20000 });
  await page.waitForTimeout(2000);

  const panelName = (LIVE_PANELS.find((p) => p[0] === PANEL) || [PANEL, PANEL])[1];
  await page.goto(`${BASE}/dashboard?panel=${PANEL}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const grabState = () => page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]:not([aria-hidden="true"]),[role="alertdialog"]:not([aria-hidden="true"])');
    const dlgInfo = dlg ? {
      label: (dlg.getAttribute("aria-label") || dlg.innerText.split("\n")[0] || "").slice(0, 60),
      buttons: [...dlg.querySelectorAll("button")].map((b) => (b.innerText || b.getAttribute("aria-label") || "✕").trim()).filter(Boolean).slice(0, 12),
    } : null;
    const toasts = [...document.querySelectorAll('[role="status"],[data-sonner-toast],[class*="toast"]')].map((t) => t.innerText.trim()).filter(Boolean).slice(0, 2);
    const menu = [...document.querySelectorAll('[role="menu"]')].filter((m) => m.getClientRects().length).map((m) => m.getAttribute("aria-label") || m.innerText.split("\n")[0]).slice(0, 1);
    return { path: location.pathname + location.search, dialog: dlgInfo, toasts, menu };
  });

  const stateOf = async () => ({ ...(await grabState().catch(() => ({}))), errors: errors.slice() });
  const newErrors = (before) => errors.slice(before.length);

  const waitSettle = async () => { await page.waitForTimeout(400); };
  const closeOverlays = async () => {
    let closed = 0;
    for (let i = 0; i < 6; i++) {
      const st = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]:not([aria-hidden="true"]),[role="alertdialog"]:not([aria-hidden="true"])');
        if (!d) return null;
        const cancel = [...d.querySelectorAll("button")].find((b) => /^(cancel|keep|close|go back|not now|dismiss|back)$/i.test((b.innerText || "").trim()) || /cancel|keep|close/i.test(b.getAttribute("aria-label") || ""));
        if (cancel) { cancel.click(); return "c"; }
        return "n";
      }).catch(() => null);
      if (!st) break;
      closed++;
      if (st === "n") await page.keyboard.press("Escape").catch(() => {});
      else await page.waitForTimeout(200);
    }
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(150);
    return closed;
  };
  const reGoto = async () => {
    const want = `/dashboard?panel=${PANEL}`;
    if (new URL(page.url()).pathname + new URL(page.url()).search !== want) {
      await page.goto(BASE + want, { waitUntil: "networkidle" }).catch(() => {});
      await page.waitForTimeout(1200);
    }
  };

  const enumerate = () => page.evaluate(() => {
    const out = [];
    const push = (kind, el, idx) => {
      const r = el.getBoundingClientRect();
      out.push({
        kind, idx,
        visible: el.getClientRects().length > 0 && r.width > 0 && r.height > 0,
        text: (el.getAttribute("aria-label") || el.innerText || el.placeholder || el.title || "").trim().replace(/\s+/g, " ").slice(0, 70),
        disabled: el.disabled === true || el.getAttribute("aria-disabled") === "true",
        type: el.getAttribute("type") || el.tagName.toLowerCase(),
      });
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
    if (t === "month") return "2026-11";
    if (t === "week") return "2026-W47";
    if (t === "url") return "https://qa.example.com";
    if (t === "password") return "QaFlow-2026!";
    if (t.includes("email")) return "qa-flow@trueaxis.hq";
    return "QA Test 42";
  };

  let step = 0;
  const note = (action, target, ok, detail) => record({ step: ++step, panel: panelName, action, target: (target || "").slice(0, 60), ok, ...detail });

  // PHASE A: every visible field — type, verify the value took
  const controlsA = (await enumerate()).filter((c) => c.visible && !c.disabled && ["input", "textarea", "select"].includes(c.kind));
  for (const f of controlsA) {
    const before = errors.slice();
    try {
      const loc = page.locator(f.kind === "input" ? "input:not([type='hidden']):not([type='checkbox']):not([type='radio']):not([type='file'])" : f.kind).nth(f.idx);
      await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      const val = sampleValue(f.type);
      if (f.kind === "select") {
        await loc.selectOption({ index: 1 });
        const got = await loc.inputValue();
        note("type", `${f.kind}[${f.text}]`, got !== "", { value: got, newErrors: newErrors(before) });
      } else {
        await loc.fill(val, { force: true, timeout: 4000 });
        const got = await loc.inputValue();
        note("type", `${f.kind}[${f.text}]`, got === val, { value: got, newErrors: newErrors(before) });
      }
    } catch (e) {
      note("type", `${f.kind}[${f.text}]`, false, { reason: String(e).slice(0, 110), newErrors: newErrors(before) });
    }
  }

  // PHASE B: every visible safe button — click, verify what happened
  const controlsB = (await enumerate()).filter((c) => c.kind === "button" && c.visible && !c.disabled);
  for (const b of controlsB) {
    const text = b.text || "(icon-only)";
    if (SKIP_CLICK.test(text)) { note("skip-money", text, true, { why: "money-mover (covered in flows)" }); continue; }
    const isDestructive = DESTRUCTIVE.test(text);
    const before = errors.slice();
    const preState = await stateOf();
    let clickErr = null;
    try {
      const loc = page.locator("button").nth(b.idx);
      await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      if (await loc.isDisabled().catch(() => true)) { note("skip-disabled", text, true, {}); continue; }
      await loc.click({ force: true, timeout: 4000 });
    } catch (e) { clickErr = String(e).slice(0, 110); }
    await waitSettle();
    const post = await stateOf();
    const openedDialog = post.dialog && !preState.dialog;
    const openedMenu = post.menu && post.menu.length > 0;
    const urlChanged = post.path !== preState.path;
    const toast = post.toasts.filter((t) => !preState.toasts.includes(t))[0] || null;
    const errs = newErrors(before);

    let verdict = "ok";
    if (clickErr) verdict = "dead";
    else if (errs.length) verdict = "console-error";
    else if (isDestructive && !openedDialog && !toast) verdict = "unconfirmed-destructive";

    note("click", text, verdict === "ok", { verdict, openedDialog: openedDialog ? post.dialog.label : null, dialogButtons: openedDialog ? post.dialog.buttons : null, openedMenu: openedMenu ? post.menu : null, urlChangedTo: urlChanged ? post.path : null, toast: toast ? toast.slice(0, 80) : null, newErrors: errs });

    // If a dialog opened, sweep its interior too (every field + safe button)
    if (post.dialog) {
      const dlgLoc = page.locator('[role="dialog"]:not([aria-hidden="true"]),[role="alertdialog"]:not([aria-hidden="true"])').first();
      const inner = await dlgLoc.evaluate((d) => {
        const out = [];
        const push = (kind, el, idx) => {
          const r = el.getBoundingClientRect();
          out.push({ kind, idx, visible: el.getClientRects().length > 0 && r.width > 0 && r.height > 0, text: (el.getAttribute("aria-label") || el.innerText || el.placeholder || "").trim().replace(/\s+/g, " ").slice(0, 60), type: el.getAttribute("type") || el.tagName.toLowerCase(), disabled: el.disabled === true });
        };
        d.querySelectorAll("button").forEach((el, i) => push("button", el, i));
        d.querySelectorAll("input:not([type='hidden']):not([type='checkbox']):not([type='radio']):not([type='file'])").forEach((el, i) => push("input", el, i));
        d.querySelectorAll("textarea").forEach((el, i) => push("textarea", el, i));
        d.querySelectorAll("select").forEach((el, i) => push("select", el, i));
        return out;
      }).catch(() => []);
      const baseVisible = new Set(inner.filter((c) => c.visible).map((c) => c.kind + c.text));
      for (const f of inner.filter((c) => c.visible && !c.disabled && ["input", "textarea", "select"].includes(c.kind))) {
        const b4 = errors.slice();
        try {
          const loc = dlgLoc.locator(f.kind === "input" ? "input:not([type='hidden']):not([type='checkbox']):not([type='radio']):not([type='file'])" : f.kind).nth(f.idx);
          const val = sampleValue(f.type);
          if (f.kind === "select") await loc.selectOption({ index: 1 });
          else await loc.fill(val, { force: true, timeout: 3000 });
          note("dlg-type", `[in ${post.dialog.label}] ${f.text}`, true, { newErrors: newErrors(b4) });
        } catch (e) { note("dlg-type", `[in ${post.dialog.label}] ${f.text}`, false, { reason: String(e).slice(0, 90), newErrors: newErrors(b4) }); }
      }
      for (const ib of inner.filter((c) => c.kind === "button" && c.visible && !c.disabled)) {
        const itext = ib.text || "(icon-only)";
        if (SKIP_CLICK.test(itext) || DESTRUCTIVE.test(itext)) { note("dlg-skip", `[in ${post.dialog.label}] ${itext}`, true, { why: "money/destructive" }); continue; }
        const b4 = errors.slice();
        const st0 = await stateOf();
        let ce = null;
        try { await dlgLoc.locator("button").nth(ib.idx).click({ force: true, timeout: 3000 }); }
        catch (e) { ce = String(e).slice(0, 90); }
        await waitSettle();
        const st1 = await stateOf();
        const dlgStill = st1.dialog && st0.dialog;
        note("dlg-click", `[in ${post.dialog.label}] ${itext}`, !ce && newErrors(b4).length === 0, { clickErr: ce, dialogClosed: !st1.dialog, toast: st1.toasts.filter((t) => !st0.toasts.includes(t))[0]?.slice(0, 80) || null, newErrors: newErrors(b4) });
        if (!st1.dialog) break; // dialog gone (submitted/closed) — stop interior sweep
      }
    }

    const closed = await closeOverlays().catch(() => 0);
    if (closed > 0) record({ step: ++step, panel: panelName, action: "close-overlays", target: "after " + text, ok: true, closed });
    await reGoto();
  }

  record({ step: ++step, panel: panelName, action: "summary", ok: errors.length === 0, totalErrors: errors.length });
  await browser.close();
  const bad = log.filter((l) => l.ok === false);
  console.log(`MANUAL MOBILE PASS ${PASS} [${panelName}]: steps=${log.length} bad=${bad.length}`);
  for (const b of bad) console.log(`  ✗ step ${b.step} ${b.action} "${b.target}" ${b.verdict || ""} ${b.reason || ""} ${JSON.stringify(b.newErrors || []).slice(0, 140)}`);
  process.exit(0);
})().catch((e) => { console.error("DRIVER CRASH", e); process.exit(1); });
