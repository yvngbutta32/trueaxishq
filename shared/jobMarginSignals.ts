export const DEFAULT_MARGIN_THRESHOLD_PERCENT = 30;

export type JobMarginSignalInput = {
  revenue: number;
  profit: number;
  marginPercent: number | null;
};

export type JobMarginSignal = {
  kind: "missing_revenue_basis" | "negative_margin" | "below_threshold";
  label: string;
  detail: string;
};

export function normalizeMarginThreshold(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return DEFAULT_MARGIN_THRESHOLD_PERCENT;
  return Math.round(parsed * 10) / 10;
}

/**
 * Produces a local owner-review signal only. It does not create notifications,
 * change a job, or expose any financial data through public client flows.
 */
export function getJobMarginSignal(input: JobMarginSignalInput, threshold: number): JobMarginSignal | null {
  if (input.revenue <= 0 || input.marginPercent === null) {
    return { kind: "missing_revenue_basis", label: "Revenue basis missing", detail: "Add a job budget or link an invoice before evaluating the margin." };
  }
  if (input.profit < 0) {
    return { kind: "negative_margin", label: "Negative projected profit", detail: "Tracked cost currently exceeds the report’s revenue basis." };
  }
  if (input.marginPercent < threshold) {
    return { kind: "below_threshold", label: `Below ${threshold}% threshold`, detail: "Review price, scope, or tracked inputs before treating this as a final result." };
  }
  return null;
}
