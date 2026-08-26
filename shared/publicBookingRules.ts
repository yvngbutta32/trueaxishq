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

export type PublicBookingTimeSlot = typeof PUBLIC_BOOKING_TIME_SLOTS[number];

export type PublicBookingSchedule = {
  weekdays: number[];
  timeSlots: PublicBookingTimeSlot[];
};

export const DEFAULT_PUBLIC_BOOKING_SCHEDULE: PublicBookingSchedule = {
  weekdays: [1, 2, 3, 4, 5],
  timeSlots: [...PUBLIC_BOOKING_TIME_SLOTS],
};

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

function getUtcWeekday(date: string): number | null {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return parsed.getUTCDay();
}

/** Returns a conservative default whenever the stored schedule is malformed or empty. */
export function getPublishedBookingSchedule(serialized: string | null | undefined): PublicBookingSchedule {
  if (!serialized) return { ...DEFAULT_PUBLIC_BOOKING_SCHEDULE, weekdays: [...DEFAULT_PUBLIC_BOOKING_SCHEDULE.weekdays], timeSlots: [...DEFAULT_PUBLIC_BOOKING_SCHEDULE.timeSlots] };
  try {
    const parsed = JSON.parse(serialized) as { weekdays?: unknown; timeSlots?: unknown };
    if (!Array.isArray(parsed.weekdays) || !Array.isArray(parsed.timeSlots)) throw new Error("Invalid schedule shape");
    const weekdays = Array.from(new Set(parsed.weekdays.filter(day => Number.isInteger(day) && day >= 0 && day <= 6))).sort((a, b) => a - b);
    const timeSlots = Array.from(new Set(parsed.timeSlots.filter(slot => typeof slot === "string" && PUBLIC_BOOKING_TIME_SLOTS.includes(slot as PublicBookingTimeSlot)) as PublicBookingTimeSlot[]));
    if (weekdays.length === 0 || timeSlots.length === 0) throw new Error("Empty schedule");
    return { weekdays, timeSlots };
  } catch {
    return { ...DEFAULT_PUBLIC_BOOKING_SCHEDULE, weekdays: [...DEFAULT_PUBLIC_BOOKING_SCHEDULE.weekdays], timeSlots: [...DEFAULT_PUBLIC_BOOKING_SCHEDULE.timeSlots] };
  }
}

/** Validates a date/time against the exact schedule currently published on the booking page. */
export function isPublishedPublicBookingSlot(date: string, time: string, schedule: PublicBookingSchedule = DEFAULT_PUBLIC_BOOKING_SCHEDULE): boolean {
  const weekday = getUtcWeekday(date);
  return weekday !== null && schedule.weekdays.includes(weekday) && schedule.timeSlots.includes(time as PublicBookingTimeSlot);
}
