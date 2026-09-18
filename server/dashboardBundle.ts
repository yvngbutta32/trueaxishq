import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

// The dashboard shell plus every extracted panel module, joined so source
// assertions keep working wherever a feature now lives after the monolith split.
export function readDashboardBundle(cwd: string = process.cwd()): string {
  const shell = readFileSync(resolve(cwd, "client/src/pages/Dashboard.tsx"), "utf8");
  const dashboardDir = resolve(cwd, "client/src/pages/dashboard");
  const modules = readdirSync(dashboardDir).filter(f => f.endsWith(".tsx")).sort()
    .map(f => readFileSync(resolve(dashboardDir, f), "utf8"));
  return shell + "\n" + modules.join("\n");
}
