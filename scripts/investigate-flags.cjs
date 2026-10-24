#!/usr/bin/env node
// Focused manual investigation of pass-1 flagged controls, using STABLE text
// locators (no index drift). Prints what actually happens at each step.
const { chromium } = require("/root/.npm/_npx/e41f203b7505f1fb/node_modules/playwright");
const BASE = "http://localhost:3998";
const EXE = "/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(10000);
  page.on("console", (m) => { if (m.type() === "error") console.log("  [console.error]", m.text().slice(0, 140)); });
  page.on("response", (r) => { if (r.status() >= 400 && r.url().includes("/api/trpc")) console.log(`  [http ${r.status()}]`, r.url().split("/api/trpc/")[1]?.split("?")[0]); });

  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "demo@trueaxis.hq");
  await page.fill('input[type="password"]', "Demo-Preview-2026!");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**");
  await page.waitForTimeout(2000);

  const snap = () => page.evaluate(() => ({
    dialog: (() => { const d = document.querySelector('[role="dialog"]:not([aria-hidden="true"])'); return d ? d.innerText.split("\n").slice(0, 4).join(" / ") : null; })(),
    toasts: [...document.querySelectorAll('[role="status"],[data-sonner-toast]')].map((t) => t.innerText.trim().slice(0, 80)),
    path: location.pathname + location.search,
  }));

  // ---------- BILLING: Delete invoice ----------
  console.log("\n=== BILLING: Delete invoice (text-located) ===");
  await page.goto(BASE + "/dashboard?panel=billing", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const delBtns = page.locator("button", { hasText: /^Delete invoice$/ });
  const count = await delBtns.count();
  console.log(`'Delete invoice' buttons found: ${count}`);
  if (count > 0) {
    await delBtns.first().scrollIntoViewIfNeeded().catch(() => {});
    await delBtns.first().click({ force: true });
    await page.waitForTimeout(900);
    const s = await snap();
    console.log("after click:", JSON.stringify(s, null, 1).slice(0, 400));
    await page.screenshot({ path: "manual-qa/investigate-delete-invoice.png" }).catch(() => {});
  }

  // ---------- SETTINGS: price guidance number inputs ----------
  console.log("\n=== SETTINGS: price guidance inputs ===");
  await page.goto(BASE + "/dashboard?panel=settings", { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
  const guidance = page.locator("input[placeholder*='price guidance']");
  const gCount = await guidance.count();
  console.log("price guidance inputs:", gCount);
  if (gCount > 0) {
    const t1 = await guidance.first().getAttribute("type");
    console.log("first guidance input type attr:", t1);
    await guidance.first().fill("85.50");
    const got = await guidance.first().inputValue();
    console.log("fill '85.50' ->", got);
  }
  const svcInput = page.locator("input[placeholder*='custom service']");
  if (await svcInput.count()) {
    console.log("custom service input type:", await svcInput.first().getAttribute("type"));
    await svcInput.first().fill("Gutter cleaning");
    console.log("custom service typed ->", await svcInput.first().inputValue());
  }

  // ---------- SETTINGS: Remove <service> buttons ----------
  console.log("\n=== SETTINGS: Remove service buttons ===");
  const removeBtn = page.locator("button", { hasText: /^Remove/ }).first();
  if (await removeBtn.count()) {
    console.log("remove btn text:", await removeBtn.innerText());
    await removeBtn.scrollIntoViewIfNeeded().catch(() => {});
    await removeBtn.click({ force: true });
    await page.waitForTimeout(900);
    const s = await snap();
    console.log("after remove:", JSON.stringify(s).slice(0, 300));
    // was it actually removed, silently?
    const stillThere = await page.locator("button", { hasText: /^Remove/ }).count();
    console.log("remove buttons remaining:", stillThere);
  }

  // ---------- SETTINGS: Browse 50+ preset services ----------
  console.log("\n=== SETTINGS: Browse 50+ preset services ===");
  const browse = page.locator("button", { hasText: /preset services/ });
  if (await browse.count()) {
    await browse.first().scrollIntoViewIfNeeded().catch(() => {});
    await browse.first().click({ force: true });
    await page.waitForTimeout(900);
    const s = await snap();
    console.log("after browse:", JSON.stringify(s).slice(0, 300));
    await page.keyboard.press("Escape").catch(() => {});
  }

  // ---------- SETTINGS: Show passwords / plan toggle / Get Started ----------
  console.log("\n=== SETTINGS: Show passwords + plan buttons ===");
  const showPw = page.locator("button", { hasText: /show passwords/i });
  if (await showPw.count()) {
    await showPw.first().scrollIntoViewIfNeeded().catch(() => {});
    await showPw.first().click({ force: true });
    await page.waitForTimeout(1200);
    const s = await snap();
    console.log("after show-passwords:", JSON.stringify(s).slice(0, 300));
  }
  const monthly = page.locator("button", { hasText: /^Monthly$/ });
  if (await monthly.count()) {
    await monthly.first().scrollIntoViewIfNeeded().catch(() => {});
    await monthly.first().click({ force: true });
    await page.waitForTimeout(1200);
    console.log("after Monthly:", JSON.stringify(await snap()).slice(0, 300));
  }
  const annual = page.locator("button", { hasText: /Annual Save 20%/ });
  if (await annual.count()) {
    await annual.first().scrollIntoViewIfNeeded().catch(() => {});
    await annual.first().click({ force: true });
    await page.waitForTimeout(1200);
    console.log("after Annual:", JSON.stringify(await snap()).slice(0, 300));
  }

  // ---------- SETTINGS: monthly business report email toggle ----------
  console.log("\n=== SETTINGS: monthly report toggle + connection test ===");
  const repToggle = page.locator("button", { hasText: /monthly business report email/i });
  if (await repToggle.count()) {
    await repToggle.first().scrollIntoViewIfNeeded().catch(() => {});
    await repToggle.first().click({ force: true });
    await page.waitForTimeout(1500);
    console.log("after report toggle:", JSON.stringify(await snap()).slice(0, 300));
  }
  const connTest = page.locator("button", { hasText: /Run connection test/i });
  if (await connTest.count()) {
    await connTest.first().scrollIntoViewIfNeeded().catch(() => {});
    await connTest.first().click({ force: true });
    await page.waitForTimeout(1500);
    console.log("after connection test:", JSON.stringify(await snap()).slice(0, 300));
  } else {
    console.log("'Run connection test' NOT FOUND via text locator");
  }

  await browser.close();
})().catch((e) => { console.error("CRASH", e); process.exit(1); });
