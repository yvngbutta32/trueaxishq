export type JobCostingInput = {
  revenue: number;
  receiptCost: number;
  laborCost: number;
  expenseCost: number;
};

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Calculates the private, owner-facing job-cost summary. Inputs are already
 * owner-scoped by the caller; this helper deliberately contains no client or
 * public-flow behavior.
 */
export function calculateJobCosting(input: JobCostingInput) {
  const revenue = money(input.revenue);
  const receiptCost = money(input.receiptCost);
  const laborCost = money(input.laborCost);
  const expenseCost = money(input.expenseCost);
  const totalCost = money(receiptCost + laborCost + expenseCost);
  const profit = money(revenue - totalCost);
  const marginPercent = revenue > 0 ? Math.round(((profit / revenue) * 100) * 10) / 10 : null;

  return { revenue, receiptCost, laborCost, expenseCost, totalCost, profit, marginPercent };
}
