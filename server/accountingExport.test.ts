import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Invoice } from "../drizzle/schema";
import {
  buildMonthlySummaryCsv,
  buildPaymentsCsv,
  buildQuickBooksInvoiceCsv,
  summarizeAccounting,
  toCsvDate,
} from "./accountingExport";

const routersSource = readFileSync(resolve(import.meta.dirname, "./routers.ts"), "utf8");
const invoicesPanelSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/dashboard/InvoicesPanel.tsx"), "utf8");

const baseInvoice = {
  id: 1,
  userId: 1,
  clientId: null,
  invoiceNumber: "INV-001",
  clientName: "Test Client",
  clientEmail: "client@example.com",
  service: "Deep cleaning",
  amount: "420.50",
  status: "paid" as const,
  dueDate: "2026-09-01",
  notes: null,
  lineItems: null,
  paidAt: new Date("2026-08-15T12:00:00.000Z"),
  payLinkToken: null,
  stripePaymentLinkUrl: null,
  createdAt: new Date("2026-08-01T09:00:00.000Z"),
  updatedAt: new Date("2026-08-01T09:00:00.000Z"),
} satisfies Invoice;

describe("QuickBooks invoice export", () => {
  it("uses QuickBooks Online's documented invoice import columns", () => {
    const csv = buildQuickBooksInvoiceCsv([baseInvoice]);
    expect(csv.split("\r\n")[0]).toBe('"Invoice No","Customer","Invoice Date","Due Date","Terms","Description","Amount"');
    expect(csv).toContain('"INV-001","Test Client","2026-08-01","2026-09-01",""');
    expect(csv).toContain('"420.50"');
  });

  it("blocks spreadsheet formula injection in every column", () => {
    const malicious: Invoice = {
      ...baseInvoice,
      invoiceNumber: "=HYPERLINK(1+1)",
      clientName: "+SUM(A1:A2)",
      service: "@cmd",
    };
    const csv = buildQuickBooksInvoiceCsv([malicious]);
    expect(csv).not.toContain("\"=HYPERLINK"); // never a raw leading = inside a cell
    expect(csv).not.toContain("\"+SUM");
    expect(csv).toContain("'=HYPERLINK(1+1)"); // apostrophe-guarded
    expect(csv).toContain("'+SUM(A1:A2)");
  });

  it("formats dates as UTC YYYY-MM-DD regardless of server locale", () => {
    const d = new Date("2026-01-02T23:59:59.999Z");
    expect(toCsvDate(d)).toBe("2026-01-02");
    expect(toCsvDate(null)).toBe("");
  });
});

describe("payments ledger", () => {
  it("includes only paid invoices with a payment date, ordered by receipt", () => {
    const unpaid: Invoice = { ...baseInvoice, id: 2, status: "sent", paidAt: null, invoiceNumber: "INV-002" };
    const later: Invoice = { ...baseInvoice, id: 3, paidAt: new Date("2026-09-10T00:00:00.000Z"), invoiceNumber: "INV-003" };
    const csv = buildPaymentsCsv([later, unpaid, baseInvoice]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe('"Date Received","Invoice No","Customer","Amount Received"');
    expect(lines).toHaveLength(3); // header + 2 paid rows
    expect(lines[1]).toContain('"2026-08-15","INV-001"');
    expect(lines[2]).toContain('"2026-09-10","INV-003"');
    expect(csv).not.toContain("INV-002");
  });
});

describe("monthly accrual vs cash summary", () => {
  it("buckets accrual by creation month and cash by payment month (UTC-stable)", () => {
    const csv = buildMonthlySummaryCsv([baseInvoice]);
    expect(csv).toContain('"2026-08","1","420.50","420.50"');
  });

  it("separates an invoice issued in one month from its payment in another", () => {
    const straddler: Invoice = {
      ...baseInvoice,
      createdAt: new Date("2026-07-31T23:30:00.000Z"), // still July 31 in UTC
      paidAt: new Date("2026-08-01T00:15:00.000Z"),   // paid in August
      amount: "100.00",
    };
    const csv = buildMonthlySummaryCsv([straddler]);
    expect(csv).toContain('"2026-07","1","100.00","0.00"');
    expect(csv).toContain('"2026-08","0","0.00","100.00"');
  });
});

describe("accounting summary", () => {
  it("totals invoices, payments, and outstanding amounts", () => {
    const unpaid: Invoice = { ...baseInvoice, id: 2, status: "sent", paidAt: null, amount: "79.50", invoiceNumber: "INV-002" };
    const summary = summarizeAccounting([baseInvoice, unpaid]);
    expect(summary).toEqual({
      invoiceCount: 2,
      paidCount: 1,
      invoicedTotal: 500,
      paidTotal: 420.5,
      outstandingTotal: 79.5,
    });
  });
});

describe("accounting export procedure and UI", () => {
  it("is owner-scoped, date-ranged, and hard-capped", () => {
    expect(routersSource).toContain("accountingExport: protectedProcedure");
    expect(routersSource).toContain("conditions.push(gte(invoices.createdAt, new Date(`${input.from}T00:00:00.000Z`)))");
    expect(routersSource).toContain(".limit(10_000)");
    expect(routersSource).toContain("eq(invoices.userId, ctx.user.id)");
  });

  it("surfaces the export in the invoices toolbar with all three downloads", () => {
    expect(invoicesPanelSource).toContain("Accounting export");
    expect(invoicesPanelSource).toContain("Download invoices (QuickBooks format)");
    expect(invoicesPanelSource).toContain("Payments ledger");
    expect(invoicesPanelSource).toContain("Monthly summary");
    expect(invoicesPanelSource).toContain("quickBooksInvoicesCsv");
  });

  it("downloads are guarded against empty ranges", () => {
    expect(invoicesPanelSource).toContain("No invoices in that date range.");
  });
});
