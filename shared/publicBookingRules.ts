export const DEFAULT_PUBLIC_BOOKING_SERVICES = [
  "Coaching Session",
  "Strategy Call",
  "Consultation",
] as const;

export type PublicBookingService = {
  name: string;
  durationMinutes: number;
  active: boolean;
  priceGuidance: string | null;
  depositAmountCents: number | null;
};

const DEFAULT_SERVICE_DURATION_MINUTES = 60;

export const PUBLIC_BOOKING_TIME_SLOTS = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM",
  "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM",
] as const;

export type PublicBookingTimeSlot = typeof PUBLIC_BOOKING_TIME_SLOTS[number];

export type PublicBookingSchedule = {
  weekdays: number[];
  timeSlots: PublicBookingTimeSlot[];
  bufferMinutes: number;
};

export const DEFAULT_PUBLIC_BOOKING_SCHEDULE: PublicBookingSchedule = {
  weekdays: [1, 2, 3, 4, 5],
  timeSlots: [...PUBLIC_BOOKING_TIME_SLOTS],
  bufferMinutes: 0,
};

function isSafeService(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 255;
}

/** Returns only active service labels for existing booking page consumers. */
export function getPublishedBookingServices(serialized: string | null | undefined): string[] {
  return getPublishedBookingServiceCatalog(serialized).filter(service => service.active).map(service => service.name);
}

/** Parses legacy string arrays and bounded structured catalog records without failing open. */
export function getPublishedBookingServiceCatalog(serialized: string | null | undefined): PublicBookingService[] {
  const defaults = () => DEFAULT_PUBLIC_BOOKING_SERVICES.map(name => ({ name, durationMinutes: DEFAULT_SERVICE_DURATION_MINUTES, active: true, priceGuidance: null, depositAmountCents: null }));
  if (!serialized) return defaults();
  try {
    const parsed = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return defaults();
    const deduped = new Map<string, PublicBookingService>();
    for (const item of parsed.slice(0, 30)) {
      const legacyName = isSafeService(item) ? item.trim() : null;
      const record = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : null;
      const name = legacyName ?? (isSafeService(record?.name) ? record.name.trim() : null);
      if (!name || deduped.has(name.toLowerCase())) continue;
      const durationMinutes = typeof record?.durationMinutes === "number" && Number.isInteger(record.durationMinutes) && record.durationMinutes >= 15 && record.durationMinutes <= 480 ? record.durationMinutes : DEFAULT_SERVICE_DURATION_MINUTES;
      const active = typeof record?.active === "boolean" ? record.active : true;
      const priceGuidance = typeof record?.priceGuidance === "string" && record.priceGuidance.trim().length > 0 && record.priceGuidance.trim().length <= 120 ? record.priceGuidance.trim() : null;
      const depositAmountCents = typeof record?.depositAmountCents === "number" && Number.isInteger(record.depositAmountCents) && record.depositAmountCents >= 50 && record.depositAmountCents <= 500_000 ? record.depositAmountCents : null;
      deduped.set(name.toLowerCase(), { name, durationMinutes, active, priceGuidance, depositAmountCents });
    }
    const services = Array.from(deduped.values());
    return services.length > 0 ? services : defaults();
  } catch {
    return defaults();
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
    const parsed = JSON.parse(serialized) as { weekdays?: unknown; timeSlots?: unknown; bufferMinutes?: unknown };
    if (!Array.isArray(parsed.weekdays) || !Array.isArray(parsed.timeSlots)) throw new Error("Invalid schedule shape");
    const weekdays = Array.from(new Set(parsed.weekdays.filter(day => Number.isInteger(day) && day >= 0 && day <= 6))).sort((a, b) => a - b);
    const timeSlots = Array.from(new Set(parsed.timeSlots.filter(slot => typeof slot === "string" && PUBLIC_BOOKING_TIME_SLOTS.includes(slot as PublicBookingTimeSlot)) as PublicBookingTimeSlot[]));
    if (weekdays.length === 0 || timeSlots.length === 0) throw new Error("Empty schedule");
    const bufferMinutes = typeof parsed.bufferMinutes === "number" && Number.isInteger(parsed.bufferMinutes) && parsed.bufferMinutes >= 0 && parsed.bufferMinutes <= 120 ? parsed.bufferMinutes : 0;
    return { weekdays, timeSlots, bufferMinutes };
  } catch {
    return { ...DEFAULT_PUBLIC_BOOKING_SCHEDULE, weekdays: [...DEFAULT_PUBLIC_BOOKING_SCHEDULE.weekdays], timeSlots: [...DEFAULT_PUBLIC_BOOKING_SCHEDULE.timeSlots] };
  }
}

/** Validates a date/time against the exact schedule currently published on the booking page. */
export function isPublishedPublicBookingSlot(date: string, time: string, schedule: PublicBookingSchedule = DEFAULT_PUBLIC_BOOKING_SCHEDULE): boolean {
  const weekday = getUtcWeekday(date);
  return weekday !== null && schedule.weekdays.includes(weekday) && schedule.timeSlots.includes(time as PublicBookingTimeSlot);
}

/** Converts a published display time into minutes after midnight for deterministic interval checks. */
export function publicBookingTimeToMinutes(time: string): number | null {
  const match = time.match(/^(1[0-2]|[1-9]):([0-5]\d) (AM|PM)$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minutes = Number(match[2]);
  const suffix = match[3];
  const normalizedHour = suffix === "AM" ? (hour === 12 ? 0 : hour) : (hour === 12 ? 12 : hour + 12);
  return normalizedHour * 60 + minutes;
}

/** True when two same-day appointment intervals overlap; zero-length boundaries do not overlap. */
export function doPublicBookingIntervalsOverlap(startTime: string, durationMinutes: number, otherStartTime: string, otherDurationMinutes: number): boolean {
  const start = publicBookingTimeToMinutes(startTime);
  const otherStart = publicBookingTimeToMinutes(otherStartTime);
  if (start === null || otherStart === null || durationMinutes <= 0 || otherDurationMinutes <= 0) return true;
  return start < otherStart + otherDurationMinutes && otherStart < start + durationMinutes;
}
