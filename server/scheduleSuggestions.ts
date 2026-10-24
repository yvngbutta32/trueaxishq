// Normalizes LLM smartSchedule output before it reaches the client.
// Malformed suggestions (missing/invalid date or time) would otherwise be
// written straight into the New Booking form state, flipping controlled
// inputs to uncontrolled and breaking the dialog. Found by the live QA sweep
// (React "controlled input to uncontrolled" warning in the Scheduling panel).

export interface ScheduleSuggestion {
  date: string;
  time: string;
  reason: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isRealDate(date: string): boolean {
  // YYYY-MM-DD that is also a valid calendar date (rejects 2026-13-45).
  return !Number.isNaN(Date.parse(`${date}T00:00:00Z`));
}

export function normalizeScheduleSuggestions(parsed: unknown): ScheduleSuggestion[] {
  if (!parsed || typeof parsed !== "object") return [];
  const suggestions = (parsed as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(suggestions)) return [];
  const out: ScheduleSuggestion[] = [];
  for (const s of suggestions) {
    if (!s || typeof s !== "object") continue;
    const { date, time, reason } = s as Record<string, unknown>;
    if (typeof date !== "string" || !DATE_RE.test(date) || !isRealDate(date)) continue;
    if (typeof time !== "string" || !TIME_RE.test(time)) continue;
    out.push({ date, time, reason: typeof reason === "string" ? reason.slice(0, 120) : "" });
    if (out.length >= 5) break;
  }
  return out;
}
