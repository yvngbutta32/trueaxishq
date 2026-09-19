import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const source = (rel: string) => readFileSync(resolve(root, rel), "utf8");
const routers = source("server/routers.ts");
const csvImport = source("server/csvImport.ts");
const importPanel = source("client/src/pages/dashboard/ImportPanel.tsx");
const home = source("client/src/pages/Home.tsx");
const sidebar = source("client/src/pages/dashboard/Sidebar.tsx");
const dashboard = source("client/src/pages/Dashboard.tsx");

describe("data import wizard — the switching moat", () => {
  it("is reachable in the product shell", () => {
    expect(sidebar).toContain('label: "Import Data"');
    expect(sidebar).toContain('panel: "import"');
    expect(dashboard).toContain('<ImportPanel />');
    expect(dashboard).toContain('import: "Import Data"');
  });

  it("exposes a dry-run preview and a commit that re-validates server-side", () => {
    expect(routers).toContain("migration: router({");
    expect(routers).toContain("preview: protectedProcedure");
    expect(routers).toContain("commit: protectedProcedure");
    // Commit must never trust the client's preview: it re-parses and re-analyzes.
    const commit = routers.slice(routers.indexOf("commit: protectedProcedure"));
    expect(commit.indexOf("parseImportFile(input.csv)")).toBeGreaterThan(-1);
    expect(commit.indexOf("analyzeRows")).toBeGreaterThan(-1);
  });

  it("scopes every query and write to the owner's account and audits the result", () => {
    expect(routers).toContain("from(clients).where(eq(clients.userId, ctx.user.id))");
    expect(routers).toContain("from(priceBookItems).where(eq(priceBookItems.userId, ctx.user.id))");
    const commit = routers.slice(routers.indexOf("commit: protectedProcedure"));
    expect(commit).toContain("db.insert(auditLogs).values({");
    expect(commit).toContain("import.clients");
    expect(commit).toContain("import.priceBook");
  });

  it("enforces hard limits and never asks for the old system's password", () => {
    expect(routers).toContain("IMPORT_MAX_ROWS = 10_000");
    expect(routers).toContain("2 MB import limit");
    // The wizard only ever accepts CSV text — no credentials for competitors' systems.
    expect(importPanel).toContain("We never ask for your old system's password");
    // No credential inputs anywhere in the wizard — CSV text is the only thing it accepts.
    expect(importPanel).not.toContain('type="password"');
    expect(importPanel).not.toMatch(/placeholder="[^"]*(api|secret|token|credential)/i);
    expect(importPanel).toContain("Nothing is written until you approve the preview");
  });

  it("recognizes the five benchmark competitors' export headers", () => {
    for (const system of ["jobber", "housecall-pro", "servicetitan", "servicem8", "buildertrend"]) {
      expect(csvImport.toLowerCase()).toContain(system);
    }
    expect(importPanel).toContain("Jobber, Housecall Pro, ServiceTitan, ServiceM8, and Buildertrend");
  });

  it("backs the homepage switching claim with the shipped wizard", () => {
    expect(home).toContain("Switching from Jobber, Housecall Pro, or ServiceTitan?");
    expect(home).toContain("guided import wizard");
    expect(home).toContain("you approve the preview before anything is saved");
    // The claim must not promise what the wizard doesn't do.
    expect(home).not.toMatch(/import (your )?(invoices|jobs|history|time entries)/i);
  });
});
