// Live preview tour: screenshot every public page + all 35 dashboard panels.
// Run: node scripts/preview-tour.cjs <base-url> <out-dir>
const path = require("path");
const fs = require("fs");

const BASE = process.argv[2] || "http://localhost:3998";
const OUT = process.argv[3] || "/tmp/previews";
const { chromium } = require("/root/.npm/_npx/e41f203b7505f1fb/node_modules/playwright");

const PUBLIC_PAGES = [
  ["/", "home"],
  ["/pricing", "pricing"],
  ["/about", "about"],
  ["/contact", "contact"],
  ["/help", "help"],
  ["/privacy", "privacy"],
  ["/terms", "terms"],
  ["/security", "security"],
  ["/status", "status"],
  ["/changelog", "changelog"],
  ["/login", "login"],
  ["/staff-access", "staff-access"],
  ["/admin-login", "admin-login"],
  ["/book/rivera-plumbing", "booking-page"],
  ["/track/preview-expired-token", "track-expired"],
  ["/asset/preview-expired-token", "asset-expired"],
  ["/proposal/preview-expired-token", "proposal-expired"],
  ["/sub/preview-expired-token", "sub-expired"],
];

const PANELS = ["overview","clients","scheduling","jobs","invoices","proposals","dispatch","field","time","analytics","reports","insights","executive","pulse","deals","outreach","followups","inbox","ai","expenses","inventory","services","contracts","team","subs","testimonials","automations","webhooks","integrations","import","photos","billing","agency","launch","settings"];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: "/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];

  async function shot(url, name, { wait = 1200 } = {}) {
    try {
      await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 20000 });
    } catch { /* networkidle can race long-pollers */ }
    await page.waitForTimeout(wait);
    await page.screenshot({ path: path.join(OUT, name + ".png") });
    results.push([url, name]);
    console.log("shot", name);
  }

  // Public pages
  for (const [url, name] of PUBLIC_PAGES) await shot(url, name);

  // Log in through the real UI
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "demo@trueaxis.hq");
  await page.fill('input[type="password"]', "Demo-Preview-2026!");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 20000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, "dashboard-overview.png") });
  results.push(["/dashboard", "dashboard-overview"]);
  console.log("shot", "dashboard-overview (after login)");

  // Every panel via its route
  for (const p of PANELS) {
    if (p === "overview") continue;
    await shot("/dashboard/" + p, "dashboard-" + p, { wait: 1500 });
  }

  await browser.close();
  const manifest = results.map(([url, name]) => `${name}.png ${url}`).join("\n");
  fs.writeFileSync(path.join(OUT, "manifest.txt"), manifest);
  console.log("DONE", results.length, "screenshots");
}
main().catch(e => { console.error("FATAL", e); process.exit(1); });
