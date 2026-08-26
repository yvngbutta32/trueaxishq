import { csvCell } from "./clientCsvExport";

export type ExportableJobCostRow = {
  jobNumber: string;
  title: string;
  clientName: string;
  status: string;
  targetDate: string | null;
  revenueSource: string;
  revenue: number;
  receiptCost: number;
  laborCost: number;
  expenseCost: number;
  totalCost: number;
  profit: number;
  marginPercent: number | null;
  updatedAt: Date;
};

const money = (value: number) => value.toFixed(2);

export function buildJobCostCsv(rows: ExportableJobCostRow[]): string {
  const headers = ["Job number", "Job", "Client", "Status", "Target date", "Revenue basis", "Revenue", "Receipt-marked proof", "Logged time", "Tracked expenses", "Total tracked cost", "Projected profit", "Margin percent", "Updated at"];
  const records = rows.map(row => [
    row.jobNumber,
    row.title,
    row.clientName,
    row.status,
    row.targetDate,
    row.revenueSource,
    money(row.revenue),
    money(row.receiptCost),
    money(row.laborCost),
    money(row.expenseCost),
    money(row.totalCost),
    money(row.profit),
    row.marginPercent === null ? "" : `${row.marginPercent.toFixed(1)}%`,
    row.updatedAt.toISOString(),
  ].map(csvCell).join(","));
  return [headers.map(csvCell).join(","), ...records].join("\r\n");
}
