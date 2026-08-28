import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "server/backgroundJobs.ts"), "utf8");

describe("recurring invoice delivery-state integration", () => {
  it("creates a draft first and promotes it only for configured SMTP acceptance", () => {
    const recurringInvoiceSection = source.slice(source.indexOf("async function runRecurringInvoices"), source.indexOf("// ─── Job: Auto-detect overdue invoices"));

    expect(recurringInvoiceSection).toContain('status: "draft"');
    expect(recurringInvoiceSection).toContain("getRecurringInvoiceDeliveryOutcome");
    expect(recurringInvoiceSection).toContain('if (deliveryOutcome.invoiceStatus === "sent")');
    expect(recurringInvoiceSection).toContain('.set({ status: "sent" })');
    expect(recurringInvoiceSection).toContain("deliveryOutcome.ownerNotice");
    expect(recurringInvoiceSection).not.toContain("automatically created and sent");
  });
});
