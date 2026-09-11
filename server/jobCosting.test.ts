import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { calculateJobCosting } from "../shared/jobCosting";

const root = resolve(import.meta.dirname, "..");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const schemaSource = readFileSync(resolve(root, "drizzle/schema.ts"), "utf8");

describe("private job costing", () => {
  it("calculates a rounded owner-facing total, profit, and margin from separate cost sources", () => {
    expect(calculateJobCosting({ revenue: 1000, receiptCost: 123.456, laborCost: 200, expenseCost: 76.545 })).toEqual({
      revenue: 1000,
      receiptCost: 123.46,
      laborCost: 200,
      expenseCost: 76.55,
      totalCost: 400.01,
      profit: 599.99,
      marginPercent: 60,
    });
    expect(calculateJobCosting({ revenue: 0, receiptCost: 4, laborCost: 0, expenseCost: 0 }).marginPercent).toBeNull();
  });

  it("adds an optional job reference with an efficient owner-job lookup index", () => {
    const expenseSchema = schemaSource.slice(schemaSource.indexOf('export const expenses = mysqlTable("expenses"'), schemaSource.indexOf("export type Expense"));
    expect(expenseSchema).toContain('jobId: int("jobId")');
    expect(expenseSchema).toContain('index("expenses_owner_job_idx").on(t.userId, t.jobId)');
  });

  it("verifies a referenced job belongs to the owner on expense writes and scopes job-cost reads", () => {
    const expenseRouter = routerSource.slice(routerSource.indexOf("expenses: router({"), routerSource.indexOf("  // ── Proposals", routerSource.indexOf("expenses: router({")));
    expect(expenseRouter).toContain("jobId: z.number().int().positive().optional()");
    expect(expenseRouter).toContain("jobId: z.number().int().positive().nullable().optional()");
    expect(expenseRouter).toContain("eq(jobs.id, input.jobId), eq(jobs.userId, ctx.user.id)");
    expect(expenseRouter).toContain("eq(jobs.id, jobId), eq(jobs.userId, ctx.user.id)");
    const jobGet = routerSource.slice(routerSource.indexOf("    get: protectedProcedure", routerSource.indexOf("jobs: router({")), routerSource.indexOf("    listChecklistTemplates", routerSource.indexOf("jobs: router({")));
    expect(jobGet).toContain("eq(expenses.jobId, job.id), eq(expenses.userId, ctx.user.id)");
    expect(jobGet).toContain("calculateJobCosting({ revenue, receiptCost, laborCost, expenseCost })");
  });

  it("keeps expense and margin records outside the token-scoped client job surface", () => {
    const portalStart = routerSource.indexOf("getJobs: publicProcedure");
    const portalEnd = routerSource.indexOf("// ── Contracts & Proposals", portalStart);
    const portalJobs = routerSource.slice(portalStart, portalEnd);
    expect(portalJobs).not.toContain("expenses");
    expect(portalJobs).not.toContain("marginPercent");
    expect(portalJobs).not.toContain("totalCost");
  });
});
