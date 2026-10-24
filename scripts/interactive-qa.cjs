// TrueAxis HQ — exhaustive interactive QA harness.
// Drives the real production build in headless Chromium:
//   - logs in through the real UI
//   - opens every live panel through the REAL sidebar (tests the new nav)
//   - clicks every non-destructive button in every panel + public page
//   - types into every input/textarea and exercises every select
//   - destructive buttons: verify confirm-dialog gating (we cancel), or
//     disabled-without-selection; flags anything that fires unconfirmed
//   - records console errors, uncaught page errors, failed requests (5xx),
//     dead controls and unconfirmed destructive actions
// Run: node scripts/interactive-qa.cjs <stage>   (desktop|public|mobile|flows|all)

const { chromium } = require("/root/.npm/_npx/e41f203b7505f1fb/node_modules/playwright");
const BASE = process.env.BASE_URL || "http://localhost:3998";
const EMAIL = "demo@trueaxis.hq";
const PASSWORD = "Demo-Preview-2026!";
const EXE = "/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";

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

const DESTRUCTIVE = /delete|remove|revoke|disconnect|sign ?out|log ?out|cancel subscription|archive|resend|reset|purge|unlink|deactivate|stop tracking|disconnect/i;
const SKIP_CLICK = /mark .*paid|pay now|charge|send test|send now|charge card/i; // money-movers: handled in flows

const report = {
  startedAt: new Date().toISOString(),
  interactions: 0,
  clicked: [], typedFields: 0, dialogsCancelled: 0, modalsClosed: 0,
  consoleErrors: [], pageErrors: [], failedRequests: [],
  unconfirmedDestructive: [], deadControls: [], notes: [],
};

function log(...a) { console.log(...a); }

async function attachCollectors(page, label) {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const t = msg.text();
      // React overlay/dev noise we don't care about in prod build
      if (t.includes("Download the React DevTools")) return;
      report.consoleErrors.push({ page: label, text: t.slice(0, 400) });
    }
  });
  page.on("pageerror", (err) => {
    const s = String(err && err.message || err);
    // tRPC error boundary toast is fine (4xx are honest gates); real JS crashes land here
    report.pageErrors.push({ page: label, text: s.slice(0, 400) });
  });
  page.on("response", (res) => {
    if (res.status() >= 500) report.failedRequests.push({ page: label, status: res.status(), url: res.url().slice(0, 200) });
  });
  page.on("requestfailed", (req) => {
    const e = req.failure() && req.failure().errorText;
    if (e && !/ERR_ABORTED|net::ERR_ABORTED/.test(e)) {
      report.failedRequests.push({ page: label, status: e, url: req.url().slice(0, 200) });
    }
  });
}

// Enumerate all interactive controls in DOM order, with locators stable within this sweep.
async function enumerateControls(page) {
  return page.evaluate(() => {
    const out = [];
    const push = (kind, el, idx) => {
      const r = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 1, height: 1 };
      const visible = el.getClientRects().length > 0 && r.width > 0 && r.height > 0;
      const text = (el.getAttribute("aria-label") || el.innerText || el.value || el.placeholder || el.title || "").trim().replace(/\s+/g, " ").slice(0, 80);
      out.push({
        kind, idx, visible, text,
        disabled: el.disabled === true || el.getAttribute("aria-disabled") === "true",
        type: el.getAttribute("type") || el.tagName.toLowerCase(),
      });
    };
    document.querySelectorAll("button:not([aria-hidden='true'])").forEach((el, i) => push("button", el, i));
    document.querySelectorAll("a[href]").forEach((el, i) => push("link", el, i));
    document.querySelectorAll("input:not([type='hidden']):not([type='checkbox']):not([type='radio']):not([type='file'])").forEach((el, i) => push("input", el, i));
    document.querySelectorAll("textarea").forEach((el, i) => push("textarea", el, i));
    document.querySelectorAll("select").forEach((el, i) => push("select", el, i));
    return out;
  });
}

function sampleValue(control) {
  const t = (control.type || "").toLowerCase();
  if (t === "email") return "qa-flow@trueaxis.hq";
  if (t === "tel" || t === "phone") return "+14155550101";
  if (t === "number") return "2";
  if (t === "date") return "2026-11-15";
  if (t === "time") return "10:30";
  if (t === "url") return "https://qa.example.com";
  if (t === "password") return "QaFlow-2026!";
  if (control.text && /email/i.test(control.text)) return "qa-flow@trueaxis.hq";
  return "QA Test 42";
}

// Close whatever overlay appeared: confirm dialog, modal, drawer, menu.
async function closeOverlays(page) {
  let closed = 0;
  for (let attempt = 0; attempt < 6; attempt++) {
    const state = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"],[role="alertdialog"]');
      if (!dialog || dialog.getAttribute("aria-hidden") === "true") return null;
      const cancelBtn = [...dialog.querySelectorAll("button")].find((b) =>
        /^(cancel|keep|close|go back|not now|dismiss|back)$/i.test((b.innerText || "").trim()) ||
        /cancel|keep|close/i.test(b.getAttribute("aria-label") || ""));
      const xBtn = [...dialog.querySelectorAll("button")].find((b) => (b.innerText || "").trim() === "✕" || (b.getAttribute("aria-label") || "").toLowerCase().includes("close"));
      if (cancelBtn) { cancelBtn.click(); return "cancel"; }
      if (xBtn) { xBtn.click(); return "x"; }
      return "dialog-no-cancel";
    });
    if (!state) break;
    closed++;
    if (state === "dialog-no-cancel") {
      await page.keyboard.press("Escape");
    } else {
      await page.waitForTimeout(150);
    }
  }
  // any lingering fixed overlay (menus, popovers) — Escape once
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(80);
  return closed;
}

async function hasOpenDialog(page) {
  return page.evaluate(() => {
    const d = document.querySelector('[role="dialog"],[role="alertdialog"]');
    return !!d && d.getAttribute("aria-hidden") !== "true";
  });
}

// Bounded wrapper: no harness await may ever stall the sweep.
async function guarded(p, ms, label) {
  let timer;
  try {
    return await Promise.race([p, new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("watchdog:" + label)), ms); })]);
  } finally { clearTimeout(timer); }
}

async function stageDialogs() {
  // Delta sweep: after each button click, every control that NEWLY became visible
  // (modal interiors, dropdown menus, expanded accordions) gets fully exercised:
  // every field typed, every safe button clicked. The page-level sweep closes
  // overlays without testing their contents — this stage covers exactly that gap.
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(12000);
  attachCollectors(page, "dialogs");
  await login(page);

  const key = (c) => `${c.kind}|${(c.text || "").slice(0, 60)}`;
  const dlgSummary = {};

  for (const [panel, label] of LIVE_PANELS) {
    try { await page.goto(BASE + `/dashboard?panel=${panel}`, { waitUntil: "networkidle", timeout: 20000 }); } catch { /* long-pollers */ }
    await page.waitForTimeout(1800);
    await closeOverlays(page).catch(() => {});

    const base = await enumerateControls(page);
    const baseVisible = new Set(base.filter((c) => c.visible).map(key));
    const openers = base.filter((c) => c.kind === "button" && c.visible && !c.disabled && !SKIP_CLICK.test(c.text || ""));

    for (const op of openers) {
      const openerText = (op.text || "(icon-only)").slice(0, 40);
      const before = report.consoleErrors.length + report.pageErrors.length;
      let dialogOpen = false;
      try {
        const loc = page.locator("button").nth(op.idx);
        await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
        if (await loc.isDisabled().catch(() => true)) continue;
        await loc.click({ force: true, timeout: 4000 });
      } catch (e) {
        if (!String(e).includes("watchdog")) report.deadControls.push({ panel: `dlg:${label}`, control: openerText, reason: String(e).slice(0, 120) });
        continue;
      }
      report.interactions++;
      await page.waitForTimeout(450);
      dialogOpen = await guarded(hasOpenDialog(page).catch(() => false), 8000, "hasDialog").catch(() => false);

      const fresh = await enumerateControls(page).catch(() => []);
      let delta = fresh.filter((c) => c.visible && !baseVisible.has(key(c)) && !(c.kind === "button" && (c.text || "") === openerText));
      if (delta.length === 0) {
        // nothing opened — restore state for the next opener
        await closeOverlays(page).catch(() => {});
        const urlOk = new URL(page.url()).pathname === new URL(BASE + `/dashboard?panel=${panel}`).pathname;
        if (!urlOk) { try { await page.goto(BASE + `/dashboard?panel=${panel}`, { waitUntil: "networkidle", timeout: 20000 }); await page.waitForTimeout(1200); } catch {} }
        continue;
      }
      dlgSummary[`${label}/${openerText}`] = { controls: delta.length, dialogOpen };

      // 1) type into every newly-visible field
      for (const f of delta.filter((c) => ["input", "textarea", "select"].includes(c.kind) && !c.disabled)) {
        try {
          const loc = page.locator(f.kind === "input" ? "input" : f.kind).nth(f.idx);
          await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
          if (f.kind === "select") await loc.selectOption({ index: 1 }).then(() => report.typedFields++).catch(() => {});
          else await loc.fill(sampleValue(f), { force: true, timeout: 4000 }).then(() => report.typedFields++).catch(() => {});
        } catch { /* transient */ }
      }

      // 2) click every newly-visible safe button (destructive + money-movers skipped, same as page sweep)
      for (const b of delta.filter((c) => c.kind === "button" && !c.disabled && !DESTRUCTIVE.test(c.text || "") && !SKIP_CLICK.test(c.text || ""))) {
        const inner = (b.text || "(icon-only)").slice(0, 40);
        const beforeInner = report.consoleErrors.length + report.pageErrors.length;
        try {
          const loc = page.locator("button").nth(b.idx);
          await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
          if (await loc.isDisabled().catch(() => true)) continue;
          await loc.click({ force: true, timeout: 4000 });
        } catch (e) {
          if (!String(e).includes("watchdog")) report.deadControls.push({ panel: `dlg:${label} (opened by ${openerText.slice(0, 20)})`, control: inner, reason: String(e).slice(0, 120) });
          continue;
        }
        report.interactions++;
        log(`    dlg [${label}] "${openerText.slice(0, 24)}" -> click: ${inner.slice(0, 40)}`);
        await page.waitForTimeout(350);
        await closeOverlays(page).catch(() => {});
        // overlay gone (e.g. Save submitted + closed, or the button navigated)? stop sweeping this delta
        const stillOpen = await guarded(hasOpenDialog(page).catch(() => false), 8000, "hasDialog2").catch(() => false);
        const urlOk = new URL(page.url()).pathname === new URL(BASE + `/dashboard?panel=${panel}`).pathname;
        const afterInner = report.consoleErrors.length + report.pageErrors.length;
        if (afterInner > beforeInner) {
          report.issues = report.issues || [];
          report.notes.push({ check: "dialogs-issue", value: { panel: label, opener: openerText, control: inner, errors: report.consoleErrors.slice(beforeInner).map((e) => e.text.slice(0, 150)) } });
        }
        if (!stillOpen || !urlOk) {
          try { await page.goto(BASE + `/dashboard?panel=${panel}`, { waitUntil: "networkidle", timeout: 20000 }); await page.waitForTimeout(1200); } catch {}
          break;
        }
      }

      // 3) close whatever remains open
      await closeOverlays(page).catch(() => {});
      const urlOk2 = new URL(page.url()).pathname === new URL(BASE + `/dashboard?panel=${panel}`).pathname;
      if (!urlOk2) { try { await page.goto(BASE + `/dashboard?panel=${panel}`, { waitUntil: "networkidle", timeout: 20000 }); await page.waitForTimeout(1200); } catch {} }
      const after = report.consoleErrors.length + report.pageErrors.length;
      if (after > before) {
        report.notes.push({ check: "dialogs-issue", value: { panel: label, opener: openerText, errors: report.consoleErrors.slice(before).map((e) => e.text.slice(0, 150)) } });
      }
    }
    log(`dlg panel ${label.padEnd(15)} openers:${String(Object.keys(dlgSummary).filter((k) => k.startsWith(label + "/")).length).padStart(3)} totalInteractions:${report.interactions}`);
  }
  report.notes.push({ check: "dialogs-swept", value: Object.keys(dlgSummary).length });
  await browser.close();
}

async function sweepPanel(page, panelUrl, label) {
  const result = { label, url: panelUrl, clicked: 0, typed: 0, issues: [] };
  try { await page.goto(BASE + panelUrl, { waitUntil: "networkidle", timeout: 20000 }); } catch { /* long-pollers */ }
  await page.waitForTimeout(1800); // skeleton → content
  await closeOverlays(page).catch(() => {});

  const controls = await enumerateControls(page);
  const buttons = controls.filter((c) => c.kind === "button" && c.visible && !c.disabled);
  const fields = controls.filter((c) => ["input", "textarea", "select"].includes(c.kind) && c.visible && !c.disabled);

  // 1) Type into every field (do NOT submit generic sweeps)
  for (const f of fields) {
    try {
      const loc = page.locator(f.kind === "input" ? `input` : f.kind).nth(f.idx);
      await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      if (f.kind === "select") {
        await loc.selectOption({ index: 1 }).then(() => { result.typed++; report.typedFields++; }).catch(() => {});
      } else {
        await loc.fill(sampleValue(f), { force: true, timeout: 4000 }).then(() => { result.typed++; report.typedFields++; }).catch(() => {});
      }
    } catch { /* field may be inside a closed accordion */ }
  }

  // 2) Click every non-destructive button
  for (const b of buttons) {
    const text = b.text || "(icon-only)";
    if (SKIP_CLICK.test(text)) continue;
    log(`      hb next: "${(text || "").slice(0, 30)}"`);
    const isDestructive = DESTRUCTIVE.test(text);
    const before = report.consoleErrors.length + report.pageErrors.length;
    try {
      const loc = page.locator("button").nth(b.idx);
      await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      const wasDisabled = await loc.isDisabled().catch(() => true);
      if (wasDisabled) continue;
      await loc.click({ force: true, timeout: 4000 });
    } catch (e) {
      if (String(e).includes("watchdog")) { log(`    WATCHDOG skip [${label}] "${text.slice(0, 30)}"`); continue; }
      report.deadControls.push({ panel: label, control: text, reason: String(e).slice(0, 120) });
      continue;
    }
    report.interactions++;
    result.clicked++;
    log(`    click [${label}] ${result.clicked}/${buttons.length}: ${text.slice(0, 50)}`);
    const hb = (m) => log(`      hb ${result.clicked}: ${m}`);
    hb("wait220");
    await page.waitForTimeout(220);
    hb("hasDialog");
    const dialogWasOpen = await guarded(hasOpenDialog(page).catch(() => false), 8000, "hasDialog").catch(() => false);
    if (isDestructive && !dialogWasOpen) {
      // did it act instantly with no confirm? check for a toast that says it acted
      report.unconfirmedDestructive.push({ panel: label, control: text });
    }
    hb("closeOverlays");
    const closedCount = await guarded(closeOverlays(page), 10000, "closeOverlays").catch(() => 0);
    hb("closedOverlays");
    if (closedCount > 0) { report.dialogsCancelled += closedCount; }
    const after = report.consoleErrors.length + report.pageErrors.length;
    if (after > before) {
      const newOnes = report.consoleErrors.slice(before).concat(report.pageErrors.slice(before));
      result.issues.push({ control: text, errors: newOnes.map((e) => e.text.slice(0, 150)) });
      log(`    ISSUE [${label}] control="${text}" ->`, ...newOnes.map((e) => e.text.slice(0, 120)));
    }
    hb("urlcheck");
    // Did the click navigate away? Go back to the panel. Exact path compare:
    // substring matching made "/" match every URL, so anchor-nav clicks left the
    // sweep clicking stale index-based locators on the wrong page forever.
    const currentPath = new URL(page.url()).pathname;
    const targetPath = new URL(BASE + panelUrl).pathname;
    if (currentPath !== targetPath) {
      try { await page.goto(BASE + panelUrl, { waitUntil: "networkidle", timeout: 20000 }); await page.waitForTimeout(1200); } catch {}
    }
  }
  report.clicked.push({ label, buttons: result.clicked, fields: result.typed });
  return result;
}

async function login(page) {
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 20000 });
  await page.waitForTimeout(2500);
}

async function stageDesktop() {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(12000);
  attachCollectors(page, "desktop");
  await login(page);

  // Navigate via the REAL new sidebar (tests navStructure end to end)
  const navLabels = await page.evaluate(() =>
    [...document.querySelectorAll("nav[aria-label='Dashboard sections'] [role='group']")].map((g) => g.getAttribute("aria-label")));
  report.notes.push({ check: "sidebar-groups", value: navLabels });
  const sidebarButtons = await page.evaluate(() =>
    [...document.querySelectorAll("nav[aria-label='Dashboard sections'] button")].map((b) => b.getAttribute("aria-label")));
  report.notes.push({ check: "sidebar-panels", value: sidebarButtons });

  for (const [panel, label] of LIVE_PANELS) {
    const r = await sweepPanel(page, `/dashboard?panel=${panel}`, `panel:${label}`);
    log(`panel ${label.padEnd(15)} buttons:${String(r.clicked).padStart(3)} fields:${String(r.typed).padStart(3)} issues:${r.issues.length}`);
  }

  // Global search (Cmd+K) + type
  await page.goto(BASE + "/dashboard?panel=overview", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.keyboard.press("Control+k").catch(() => {});
  await page.waitForTimeout(600);
  const searchInput = page.locator("input[placeholder*='earch' i]").first();
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill("Rivera");
    await page.waitForTimeout(1200);
    report.notes.push({ check: "global-search-results", value: await page.evaluate(() => document.body.innerText.match(/.{0,40}Rivera.{0,40}/)?.[0] || "none") });
    await closeOverlays(page);
  }

  // Keyboard shortcuts: n/c/b/o/d/i must switch panels
  const shortcutResults = {};
  for (const [key, expect] of [["n", "billing"], ["c", "clients"], ["b", "scheduling"], ["o", "outreach"], ["d", "deals"], ["i", "insights"]]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(900);
    const active = await page.evaluate(() => document.querySelector("nav [aria-current='page']")?.getAttribute("aria-label") || "");
    shortcutResults[key] = { expect, active };
  }
  report.notes.push({ check: "keyboard-shortcuts", value: shortcutResults });

  await page.screenshot({ path: "qa-artifacts/desktop-final.png", fullPage: false }).catch(() => {});
  await browser.close();
}

async function stagePublic() {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  attachCollectors(page, "public");
  fs_mkdir("qa-artifacts");

  const PUBLIC_PAGES = ["/", "/pricing", "/about", "/contact", "/help", "/privacy", "/terms", "/security", "/status", "/changelog", "/login", "/staff-access", "/admin-login", "/book/rivera-plumbing"];
  for (const url of PUBLIC_PAGES) {
    const r = await sweepPanel(page, url, `public:${url}`);
    log(`public ${url.padEnd(22)} buttons:${String(r.clicked).padStart(3)} fields:${String(r.typed).padStart(3)} issues:${r.issues.length}`);
  }

  // Login error path: wrong password must show an honest error, no crash
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', "wrong-password");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  const errToast = await page.evaluate(() => document.body.innerText.match(/.{0,60}(incorrect|invalid|wrong|failed|error).{0,60}/i)?.[0] || "NO ERROR SHOWN");
  report.notes.push({ check: "login-wrong-password", value: errToast });

  await browser.close();
}

async function stageMobile() {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  attachCollectors(page, "mobile");
  await login(page);

  // bottom nav: 4 primary tabs + More
  const tabs = await page.evaluate(() =>
    [...document.querySelectorAll("nav[aria-label='Mobile navigation'] > div > button")].map((b) => b.getAttribute("aria-label")));
  report.notes.push({ check: "mobile-bottom-tabs", value: tabs });
  for (const t of tabs || []) {
    const btn = page.locator(`nav[aria-label='Mobile navigation'] button[aria-label='${t}']`);
    await btn.click({ force: true });
    await page.waitForTimeout(900);
    report.interactions++;
  }
  // More sheet: groups + every sheet button + quick links
  await page.locator("nav[aria-label='Mobile navigation'] button[aria-label='All features']").click();
  await page.waitForTimeout(600);
  const sheetInfo = await page.evaluate(() => {
    const dialog = document.querySelector("[role='dialog'][aria-label='All features']");
    if (!dialog) return null;
    const groups = [...dialog.querySelectorAll("p")].map((p) => p.innerText.trim()).filter(Boolean);
    const buttons = [...dialog.querySelectorAll("button")].map((b) => b.getAttribute("aria-label") || b.innerText.trim().slice(0, 30));
    return { groups, buttons };
  });
  report.notes.push({ check: "mobile-sheet", value: sheetInfo });
  await page.screenshot({ path: "qa-artifacts/mobile-sheet.png" }).catch(() => {});
  // click every sheet panel button (they navigate + close the sheet)
  for (const label of (sheetInfo?.buttons || [])) {
    if (!label || label === "All Features" || /^(admin|public site)$/i.test(label)) continue;
    await page.locator("nav[aria-label='Mobile navigation'] button[aria-label='All features']").click({ force: true });
    await page.waitForTimeout(400);
    const btn = page.locator(`[role='dialog'][aria-label='All features'] button[aria-label='${label}']`).first();
    if (await btn.isVisible().catch(() => false)) { await btn.click({ force: true }); await page.waitForTimeout(700); report.interactions++; }
  }
  // quick links
  await page.locator("nav[aria-label='Mobile navigation'] button[aria-label='All features']").click({ force: true });
  await page.waitForTimeout(400);
  const publicSite = page.locator("button", { hasText: "Public Site" }).first();
  if (await publicSite.isVisible().catch(() => false)) { await publicSite.click({ force: true }); await page.waitForTimeout(1000); report.notes.push({ check: "mobile-public-site", value: page.url() }); }

  await browser.close();
}

async function stageFlows() {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  attachCollectors(page, "flows");
  await login(page);
  const flows = {};

  // F1: create a client via the real modal
  await page.goto(BASE + "/dashboard?panel=clients", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const addClient = page.locator("button", { hasText: /add (a )?client|new client|\+ *client/i }).first();
  if (await addClient.isVisible().catch(() => false)) {
    await addClient.click();
    await page.waitForTimeout(700);
    const dialogOpen = await hasOpenDialog(page);
    const fields = await enumerateControls(page);
    const dialogFields = fields.filter((c) => c.visible && ["input", "textarea"].includes(c.kind));
    for (const f of dialogFields) {
      const loc = page.locator(f.kind).nth(f.idx);
      await loc.fill(sampleValue(f), { force: true, timeout: 3000 }).catch(() => {});
    }
    await page.screenshot({ path: "qa-artifacts/flow-client-modal.png" }).catch(() => {});
    const save = page.locator('[role="dialog"] button, [role="alertdialog"] button').locator("visible=true").filter({ hasText: /save|create|add/i }).first();
    const saveVisible = await save.isVisible().catch(() => false);
    if (dialogOpen && saveVisible) {
      await save.click();
      await page.waitForTimeout(1500);
      const created = await page.evaluate(() => document.body.innerText.includes("QA Test 42"));
      flows.clientCreate = { modalOpened: dialogOpen, saved: saveVisible, appearsInList: created };
    } else {
      flows.clientCreate = { modalOpened: dialogOpen, saved: false, note: "save button not found by pattern" };
    }
  } else { flows.clientCreate = { skipped: "add-client button not found by pattern" }; }

  // F2: public booking flow end-to-end (typing + submit)
  await page.goto(BASE + "/book/rivera-plumbing", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const bookingFields = await enumerateControls(page);
  const bf = bookingFields.filter((c) => c.visible && ["input", "textarea", "select"].includes(c.kind));
  for (const f of bf) {
    const loc = page.locator(f.kind === "input" ? "input" : f.kind).nth(f.idx);
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    if (f.kind === "select") await loc.selectOption({ index: 1 }).catch(() => {});
    else await loc.fill(sampleValue(f), { force: true, timeout: 3000 }).catch(() => {});
  }
  // F2 (rewritten): drive the real 3-step wizard (details -> datetime -> confirm)
  // the way a customer would; the old single-submit pattern never matched the wizard.
  const stepBtn = (label) => page.locator(`button[aria-label='${label}']`).first();
  flows.booking = { typed: bf.length, steps: [] };
  for (const name of ["Continue to date and time selection", "Continue to confirmation", "Submit booking request"]) {
    const btn = stepBtn(name);
    if (!(await btn.isVisible().catch(() => false))) { flows.booking.steps.push({ name, ok: false, why: "not visible" }); break; }
    if (name === "Continue to confirmation") {
      // unlock Continue by picking the first available date + time slot
      const datePick = page.locator("[aria-label='Available dates'] button:not([disabled])").first();
      if (await datePick.isVisible().catch(() => false)) { await datePick.click({ force: true }); await page.waitForTimeout(400); }
      const timePick = page.locator("[aria-label='Available time slots'] button:not([disabled])").first();
      if (await timePick.isVisible().catch(() => false)) { await timePick.click({ force: true }); await page.waitForTimeout(400); }
    }
    if (await btn.isDisabled().catch(() => false)) { flows.booking.steps.push({ name, ok: false, why: "disabled" }); break; }
    await btn.click({ force: true });
    await page.waitForTimeout(name === "Submit booking request" ? 2500 : 1200);
    flows.booking.steps.push({ name, ok: true });
  }
  flows.booking.result = await page.evaluate(() => document.body.innerText.match(/(thank|confirm|received|booked|success)[^\n]{0,60}/i)?.[0] || "no success text found");
  await page.screenshot({ path: "qa-artifacts/flow-booking-result.png" }).catch(() => {});

  // F3: settings save (typing + save round-trip)
  await page.goto(BASE + "/dashboard?panel=settings", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const setFields = await enumerateControls(page);
  const sf = setFields.filter((c) => c.visible && c.kind === "input" && !c.disabled);
  for (const f of sf.slice(0, 8)) {
    const loc = page.locator("input").nth(f.idx);
    const existing = await loc.inputValue().catch(() => "");
    if (/business ?name/i.test(f.text || "")) { await loc.fill(existing || "Rivera Plumbing & HVAC", { force: true }); flows.settingsBusinessNameTyped = true; }
  }
  const saveSettings = page.locator("button", { hasText: /save/i }).first();
  if (await saveSettings.isVisible().catch(() => false)) {
    await saveSettings.click({ force: true });
    await page.waitForTimeout(1500);
    flows.settingsSave = await page.evaluate(() => document.body.innerText.match(/(saved|updated|success)[^\\n]{0,50}/i)?.[0] || "no confirmation");
  }

  report.notes.push({ check: "flows", value: flows });
  await browser.close();
}

function fs_mkdir(d) { require("fs").mkdirSync(d, { recursive: true }); }

(async () => {
  fs_mkdir("qa-artifacts");
  const stage = process.argv[2] || "all";
  const dump = () => {
    report.finishedAt = new Date().toISOString();
    require("fs").writeFileSync("qa-artifacts/interactive-qa-report.json", JSON.stringify(report, null, 2));
  };
  if (stage === "desktop" || stage === "all") { await stageDesktop(); dump(); }
  if (stage === "dialogs" || stage === "all") { await stageDialogs(); dump(); }
  if (stage === "public" || stage === "all") { await stagePublic(); dump(); }
  if (stage === "mobile" || stage === "all") { await stageMobile(); dump(); }
  if (stage === "flows" || stage === "all") { await stageFlows(); dump(); }
  report.finishedAt = new Date().toISOString();
  log("\n=== QA SUMMARY ===");
  log("interactions:", report.interactions, " typedFields:", report.typedFields,
      " dialogsCancelled:", report.dialogsCancelled);
  log("consoleErrors:", report.consoleErrors.length, " pageErrors:", report.pageErrors.length,
      " failedRequests:", report.failedRequests.length);
  log("deadControls:", report.deadControls.length, " unconfirmedDestructive:", report.unconfirmedDestructive.length);
})().catch((e) => { console.error("HARNESS CRASH", e); process.exit(1); });
