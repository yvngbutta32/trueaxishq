export const DEFAULT_PUBLIC_BOOKING_SERVICES = [
  "Coaching Session",
  "Strategy Call",
  "Consultation",
] as const;

export const PUBLIC_BOOKING_TIME_SLOTS = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM",
  "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM",
] as const;

function isSafeService(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 255;
}

/** Returns only safe, configured service labels and falls back to the public defaults. */
export function getPublishedBookingServices(serialized: string | null | undefined): string[] {
  if (!serialized) return [...DEFAULT_PUBLIC_BOOKING_SERVICES];
  try {
    const parsed = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return [...DEFAULT_PUBLIC_BOOKING_SERVICES];
    const services = Array.from(new Set(parsed.filter(isSafeService).map(service => service.trim()))).slice(0, 30);
    return services.length > 0 ? services : [...DEFAULT_PUBLIC_BOOKING_SERVICES];
  } catch {
    return [...DEFAULT_PUBLIC_BOOKING_SERVICES];
  }
}

/** The current public booking page deliberately publishes weekday half-hour slots from 9 AM through 5 PM. */
export function isPublishedPublicBookingSlot(date: string, time: string): boolean {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match || !PUBLIC_BOOKING_TIME_SLOTS.includes(time as typeof PUBLIC_BOOKING_TIME_SLOTS[number])) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return false;
  const weekday = parsed.getUTCDay();
  return weekday >= 1 && weekday <= 5;
}
