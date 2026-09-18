/**
 * TrueAxis HQ — Accountant-ready financial export.
 *
 * Builds CSVs in the formats bookkeepers actually use:
 *  - QuickBooks Online's documented invoice import columns,
 *  - a payments-received ledger,
 *  - a monthly accrual vs. cash summary for tax prep.
 *
 * All cell output goes through the shared CSV cell escaper, which blocks
 * spreadsheet formula injection (=, +, -, @, tab/CR/LF prefixes).
 */
import { csvCell } from "./clientCsvExport";
import type { Invoice } from "../drizzle/schema";

/** UTC YYYY-MM-DD; empty string when unset. Keeps exports timezone-stable regardless of server locale. */
export function toCsvDate(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

/**
 * QuickBooks Online invoice import CSV (documented columns):
 * Invoice No, Customer, Invoice Date, Due Date, Terms, Description, Amount.
 */
export function buildQuickBooksInvoiceCsv(rows: Invoice[]): string {
  const headers = csvRow(["Invoice No", "Customer", "Invoice Date", "Due Date", "Terms", "Description", "Amount"]);
  const body = rows.map(inv => csvRow([
    inv.invoiceNumber,
    inv.clientName,
    toCsvDate(inv.createdAt),
    inv.dueDate || "",
    "",
    inv.service || "",
    parseFloat(String(inv.amount)).toFixed(2),
  ]));
  return [headers, ...body].join("\r\n");
}

/** Payments-received ledger: one row per paid invoice, ordered by payment date. */
export function buildPaymentsCsv(rows: Invoice[]): string {
  const headers = csvRow(["Date Received", "Invoice No", "Customer", "Amount Received"]);
  const paid = rows
    .filter(inv => inv.status === "paid" && inv.paidAt)
    .sort((a, b) => (a.paidAt!.getTime() || 0) - (b.paidAt!.getTime() || 0))
    .map(inv => csvRow([
      toCsvDate(inv.paidAt),
      inv.invoiceNumber,
      inv.clientName,
      parseFloat(String(inv.amount)).toFixed(2),
    ]));
  return [headers, ...paid].join("\r\n");
}

/**
 * Monthly summary: accrual (invoices issued by creation month) vs. cash
 * (payments received by paidAt month). Buckets are UTC so exports are
 * reproducible regardless of server timezone.
 */
export function buildMonthlySummaryCsv(rows: Invoice[]): string {
  const headers = csvRow(["Month", "Invoices issued", "Invoiced (accrual)", "Payments received (cash)"]);
  const months = new Map<string, { issuedCount: number; accrual: number; cash: number }>();

  const keyOf = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  for (const inv of rows) {
    const key = keyOf(inv.createdAt);
    const bucket = months.get(key) ?? { issuedCount: 0, accrual: 0, cash: 0 };
    bucket.issuedCount += 1;
    bucket.accrual += parseFloat(String(inv.amount));
    months.set(key, bucket);
    if (inv.status === "paid" && inv.paidAt) {
      const cashKey = keyOf(inv.paidAt);
      const cashBucket = months.get(cashKey) ?? { issuedCount: 0, accrual: 0, cash: 0 };
      cashBucket.cash += parseFloat(String(inv.amount));
      months.set(cashKey, cashBucket);
    }
  }

  const body = Array.from(months.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => csvRow([
      month,
      data.issuedCount,
      data.accrual.toFixed(2),
      data.cash.toFixed(2),
    ]));
  return [headers, ...body].join("\r\n");
}

/** Summary figures for the export dialog preview. */
export function summarizeAccounting(rows: Invoice[]): { invoiceCount: number; paidCount: number; invoicedTotal: number; paidTotal: number; outstandingTotal: number } {
  const invoicedTotal = rows.reduce((sum, inv) => sum + parseFloat(String(inv.amount)), 0);
  const paidRows = rows.filter(inv => inv.status === "paid");
  const paidTotal = paidRows.reduce((sum, inv) => sum + parseFloat(String(inv.amount)), 0);
  return {
    invoiceCount: rows.length,
    paidCount: paidRows.length,
    invoicedTotal,
    paidTotal,
    outstandingTotal: invoicedTotal - paidTotal,
  };
}
