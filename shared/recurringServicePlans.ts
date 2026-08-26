export type RecurringServiceFrequency = "weekly" | "monthly";

export type RecurringServicePlanInput = {
  frequency: RecurringServiceFrequency;
  weekday?: number | null;
  dayOfMonth?: number | null;
  startDate: string;
  endDate?: string | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidRecurringServicePlanInput(input: RecurringServicePlanInput): boolean {
  if (!ISO_DATE.test(input.startDate)) return false;
  if (input.endDate && (!ISO_DATE.test(input.endDate) || input.endDate < input.startDate)) return false;
  if (input.frequency === "weekly") return typeof input.weekday === "number" && input.weekday >= 0 && input.weekday <= 6;
  return typeof input.dayOfMonth === "number" && input.dayOfMonth >= 1 && input.dayOfMonth <= 28;
}

export function nextRecurringServiceDate(input: RecurringServicePlanInput, afterDate: string): string | null {
  if (!isValidRecurringServicePlanInput(input)) return null;
  const cursor = new Date(`${afterDate}T00:00:00.000Z`);
  if (Number.isNaN(cursor.getTime())) return null;
  const start = new Date(`${input.startDate}T00:00:00.000Z`);
  if (cursor < start) cursor.setTime(start.getTime());

  if (input.frequency === "weekly") {
    const delta = (input.weekday! - cursor.getUTCDay() + 7) % 7;
    cursor.setUTCDate(cursor.getUTCDate() + delta);
  } else {
    cursor.setUTCDate(1);
    cursor.setUTCDate(input.dayOfMonth!);
    if (cursor < new Date(`${afterDate}T00:00:00.000Z`)) {
      cursor.setUTCMonth(cursor.getUTCMonth() + 1, input.dayOfMonth!);
    }
  }

  const result = cursor.toISOString().slice(0, 10);
  return input.endDate && result > input.endDate ? null : result;
}
