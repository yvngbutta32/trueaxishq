import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildJobCostCsv } from "./jobCostCsvExport";

const root = resolve(import.meta.dirname, "..");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const workspaceSource = readFileSync(resolve(root, "client/src/pages/JobWorkspace.tsx"), "utf8");

describe("owner-only job-cost portfolio report", () => {
  it("exports conservative report columns with formula-neutralized cells", () => {
    const csv = buildJobCostCsv([{ jobNumber: "JOB-1", title: "=Formula", clientName: "Client", status: "in_progress", targetDate: null, revenueSource: "Job budget", revenue: 100, receiptCost: 5, laborCost: 10, expenseCost: 15, totalCost: 30, profit: 70, marginPercent: 70, updatedAt: new Date("2026-08-26T00:00:00.000Z") }]);
    expect(csv.split("\r\n")[0]).toBe('"Job number","Job","Client","Status","Target date","Revenue basis","Revenue","Receipt-marked proof","Logged time","Tracked expenses","Total tracked cost","Projected profit","Margin percent","Updated at"');
    expect(csv).toContain("'=Formula");
    expect(csv).not.toContain("email");
    expect(csv).not.toContain("receiptUrl");
  });

  it("provides protected owner-scoped report and export procedures with bounded result size", () => {
    const jobRouter = routerSource.slice(routerSource.indexOf("jobs: router({"));
    expect(jobRouter).toContain("costReport: protectedProcedure");
    expect(jobRouter).toContain("exportCostReport: protectedProcedure");
    expect(jobRouter).toContain("getOwnerJobCostReport(await requireDb(), ctx.user.id");
    expect(routerSource).toContain("eq(jobs.userId, userId)");
    expect(routerSource).toContain("eq(expenses.userId, userId)");
    expect(routerSource).toContain("limit(10_000)");
  });

  it("keeps the report in the owner Job Workspace and does not add a public route", () => {
    expect(workspaceSource).toContain("trpc.jobs.costReport.useQuery");
    expect(workspaceSource).toContain("trpc.jobs.exportCostReport.useQuery");
    expect(workspaceSource).toContain("Private job-cost report");
    const portalStart = routerSource.indexOf("getJobs: publicProcedure");
    const portalEnd = routerSource.indexOf("// ── Contracts & Proposals", portalStart);
    expect(routerSource.slice(portalStart, portalEnd)).not.toContain("costReport");
  });
});
