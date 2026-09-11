import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "backgroundJobs.ts"), "utf8");

describe("monthly report payment integrity", () => {
  it("reports collected payment-ledger amounts instead of invoice face value", () => {
    const section = source.slice(
      source.indexOf("async function runMonthlyReport"),
      source.indexOf("// ─── Main scheduler"),
    );

    expect(section).toContain("FROM invoicePayments p");
    expect(section).toContain("INNER JOIN invoices i ON i.id = p.invoiceId AND i.userId = p.userId");
    expect(section).toContain("SUM(CAST(p.amount AS DECIMAL(10,2)))");
    expect(section).toContain("p.paidAt BETWEEN");
    expect(section).not.toContain("SUM(CAST(amount AS DECIMAL(10,2)))");
  });
});
