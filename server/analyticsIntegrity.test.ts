import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("analytics integrity", () => {
  it("uses the owner-scoped payment ledger for revenue and receivables", () => {
    const router = source("server/routers.ts");
    const start = router.indexOf("analytics: router({");
    const end = router.indexOf("// ── AI Assistant", start);
    const analytics = router.slice(start, end);
    expect(analytics).toContain("eq(invoicePayments.userId, ctx.user.id)");
    expect(analytics).toContain("const totalRevenue = paymentRows.reduce");
    expect(analytics).toContain("Math.max(0, Number(invoice.amount) - (paidByInvoice.get(invoice.id) ?? 0))");
    expect(analytics).toContain("payment.paidAt.toISOString()");
  });

  it("does not expose unscoped lead data as workspace referral analytics", () => {
    const router = source("server/routers.ts");
    const start = router.indexOf("analytics: router({");
    const end = router.indexOf("// ── AI Assistant", start);
    const analytics = router.slice(start, end);
    expect(analytics).not.toContain("db.select({ source: leads.source })");
    expect(analytics).toContain("const referralSources: { source: string; count: number }[] = []");
  });
});
