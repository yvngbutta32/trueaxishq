import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("invoice payment ledger contract", () => {
  it("defines an append-only owner-scoped payment ledger and migration", () => {
    const schema = source("drizzle/schema.ts");
    const migration = source("drizzle/0065_invoice_payments.sql");
    expect(schema).toContain('mysqlTable("invoicePayments"');
    expect(schema).toContain('index("invoicePayments_owner_invoice_idx")');
    expect(migration).toContain("CREATE TABLE `invoicePayments`");
    expect(migration).toContain("enum('cash','check','bank_transfer','card','other')");
  });

  it("prevents overpayments and only closes an invoice at the remaining balance", () => {
    const router = source("server/routers.ts");
    const start = router.indexOf("recordPayment: protectedProcedure");
    const recordPayment = router.slice(start, start + 5000);
    expect(recordPayment).toContain("Payment cannot exceed the remaining balance");
    expect(recordPayment).toContain("newRemaining <= 0.005");
    expect(recordPayment).toContain("invoicePayments");
    expect(recordPayment).toContain("eq(invoicePayments.userId, ctx.user.id)");
  });

  it("exposes paid and remaining balances to the invoice workspace", () => {
    const router = source("server/routers.ts");
    expect(router).toContain("paidAmount: paidAmount.toFixed(2)");
    expect(router).toContain("remainingAmount: Math.max(0, total - paidAmount).toFixed(2)");
  });

  it("charges only the remaining balance through every Stripe invoice entry point", () => {
    const router = source("server/routers.ts");
    expect(router).toContain("const remainingAmount = Math.max(0, Number(inv.amount) - Number(paymentTotal?.total ?? 0));");
    expect(router).toContain("const amountCents = Math.round(remainingAmount * 100);");
    expect(router).toContain("const portalAmountCents = Math.round(remainingAmount * 100);");
  });
});
