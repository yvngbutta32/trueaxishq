import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dist = join(process.cwd(), "dist", "public");
const assets = join(dist, "assets");
if (!existsSync(dist) || !existsSync(assets)) {
  throw new Error("Production assets are missing. Run `pnpm run build` before checking the bundle budget.");
}

const files = readdirSync(assets);
const html = readFileSync(join(dist, "index.html"), "utf8");
const entryMatch = html.match(/<script[^>]+src="\/assets\/([^"]+)"/);
const cssMatch = html.match(/<link[^>]+href="\/assets\/([^"]+\.css)"/);
if (!entryMatch) throw new Error("Unable to identify the production entry asset.");
if (!cssMatch) throw new Error("Unable to identify the production CSS asset.");

const findAsset = prefix => {
  const file = files.find(candidate => candidate.startsWith(prefix));
  if (!file) throw new Error(`Expected bundle asset '${prefix}*' was not produced.`);
  return file;
};

const budgets = [
  { label: "application entry", file: entryMatch[1], maxBytes: 560 * 1024 },
  { label: "dashboard route", file: findAsset("Dashboard-"), maxBytes: 650 * 1024 },
  { label: "home route", file: findAsset("Home-"), maxBytes: 140 * 1024 },
  { label: "charts vendor", file: findAsset("charts-"), maxBytes: 500 * 1024 },
  { label: "application CSS", file: cssMatch[1], maxBytes: 240 * 1024 },
];

const failures = [];
for (const budget of budgets) {
  const path = join(assets, budget.file);
  if (!existsSync(path)) {
    failures.push(`${budget.label}: expected ${budget.file}`);
    continue;
  }
  const bytes = statSync(path).size;
  const size = `${(bytes / 1024).toFixed(1)} KiB`;
  const max = `${(budget.maxBytes / 1024).toFixed(0)} KiB`;
  console.log(`${budget.label}: ${size} / ${max}`);
  if (bytes > budget.maxBytes) failures.push(`${budget.label} exceeds ${max} (${size})`);
}

if (failures.length) throw new Error(`Bundle budget failed:\n- ${failures.join("\n- ")}`);
console.log("Bundle budget passed.");
