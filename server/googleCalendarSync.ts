/**
 * Native Google Calendar Sync — pushes TrueAxis HQ bookings to the owner's
 * connected Google Calendar with idempotent updates, a strict conflict policy,
 * and self-healing disconnect recovery.
 *
 * Sync policy:
 * - TrueAxis HQ only touches events it created (tagged via extendedProperties).
 *   Untagged events on the owner's calendar are never read into a plan or modified.
 * - Tagged events are authoritative from TrueAxis HQ: when a booking changes,
 *   the matching event is updated; when a booking is cancelled or removed, the
 *   matching event is deleted.
 * - Updates are idempotent: a checksum is stored on each event, so unchanged
 *   bookings produce no writes on repeated runs.
 * - When Google authorization expires (refresh failure), sync disables itself,
 *   records the error for the owner, and never throws — the hourly job and
 *   other users keep running.
 * - Transient provider/network failures are recorded but leave sync enabled so
 *   the next hourly pass retries automatically.
 */
import { and, eq, ne } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { bookings, googleCalendarTokens } from "../drizzle/schema";
import { decryptWebhookSecret, encryptWebhookSecret } from "./workflowWebhookDelivery";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SyncErrorKind = "auth" | "configuration" | "transient";

export type SyncOutcome =
  | { status: "not_connected" }
  | { status: "auth_failed"; message: string }
  | { status: "transient_error"; message: string }
  | { status: "configuration_error"; message: string }
  | { status: "synced"; created: number; updated: number; deleted: number };

export type SyncRunSummary = {
  usersAttempted: number;
  usersSynced: number;
  usersFailed: number;
  eventsCreated: number;
  eventsUpdated: number;
  eventsDeleted: number;
};

export type BookingEventResource = {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: "UTC" };
  end: { dateTime: string; timeZone: "UTC" };
  extendedProperties: { private: { trueaxisTag: "booking"; trueaxisId: string; trueaxisChecksum: string } };
};

export type RemoteEvent = {
  id: string;
  extendedProperties?: { private?: Record<string, string> } | null;
};

export type SyncPlan = {
  toCreate: Array<{ bookingId: number; resource: BookingEventResource }>;
  toUpdate: Array<{ remoteEventId: string; resource: BookingEventResource }>;
  toDelete: string[];
  untouched: number;
};

export type TokenRow = {
  userId: number;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  calendarId: string;
};

export type TokenCodec = { encrypt: (value: string) => string; decrypt: (value: string) => string };

export type SyncDeps = {
  db: MySql2Database<any>;
  fetchImpl?: typeof fetch;
  now?: () => number;
  tokenCodec?: TokenCodec;
};

const DEFAULT_CODE: TokenCodec = { encrypt: encryptWebhookSecret, decrypt: decryptWebhookSecret };
const TRUEAXIS_TAG = "booking";
const TOKEN_REFRESH_MARGIN_MS = 30_000;

// ─── Pure helpers (unit-tested in isolation) ────────────────────────────────

/** Same privacy posture as the owner iCal feed: no client contact details or notes. */
export function bookingToEventResource(
  booking: Pick<typeof bookings.$inferSelect, "id" | "clientName" | "service" | "date" | "time" | "duration">
): BookingEventResource | null {
  const startDate = new Date(`${booking.date}T${booking.time || "09:00"}:00Z`);
  if (Number.isNaN(startDate.getTime())) return null;
  const durationMinutes = booking.duration || 60;
  const endDate = new Date(startDate.getTime() + durationMinutes * 60_000);
  const summary = `${booking.service || "Session"} — ${booking.clientName}`.trim();
  const base = {
    summary,
    start: { dateTime: startDate.toISOString(), timeZone: "UTC" as const },
    end: { dateTime: endDate.toISOString(), timeZone: "UTC" as const },
  };
  return {
    ...base,
    description: "Scheduled and confirmed in TrueAxis HQ.",
    extendedProperties: {
      private: {
        trueaxisTag: TRUEAXIS_TAG,
        trueaxisId: String(booking.id),
        trueaxisChecksum: computeEventChecksum(base),
      },
    },
  };
}

export function computeEventChecksum(
  base: Pick<BookingEventResource, "summary" | "start" | "end">
): string {
  return createHash("sha256")
    .update(JSON.stringify({ summary: base.summary, start: base.start.dateTime, end: base.end.dateTime }))
    .digest("hex");
}

export function isTrueAxisEvent(event: RemoteEvent): boolean {
  return event.extendedProperties?.private?.trueaxisTag === TRUEAXIS_TAG;
}

/**
 * Conflict policy: untagged owner events are never planned. Tagged events with a
 * matching checksum stay untouched (idempotent runs), diverging tagged events are
 * updated (TrueAxis HQ is authoritative for events it created), and tagged
 * events whose booking no longer syncs are deleted.
 */
export function planReconciliation(
  local: Array<{ bookingId: number; resource: BookingEventResource }>,
  remote: RemoteEvent[]
): SyncPlan {
  const remoteTagged = remote.filter(isTrueAxisEvent);
  const localById = new Map(local.map(entry => [String(entry.bookingId), entry.resource]));
  const plan: SyncPlan = { toCreate: [], toUpdate: [], toDelete: [], untouched: 0 };
  const matchedIds = new Set<number>();

  for (const event of remoteTagged) {
    const bookingId = event.extendedProperties?.private?.trueaxisId;
    const resource = bookingId ? localById.get(bookingId) : undefined;
    if (!resource) { plan.toDelete.push(event.id); continue; }
    const remoteChecksum = event.extendedProperties?.private?.trueaxisChecksum;
    if (remoteChecksum === resource.extendedProperties.private.trueaxisChecksum) {
      plan.untouched++;
    } else {
      plan.toUpdate.push({ remoteEventId: event.id, resource });
    }
    const numericId = Number(bookingId);
    if (Number.isInteger(numericId)) matchedIds.add(numericId);
  }

  for (const entry of local) {
    if (!matchedIds.has(entry.bookingId)) plan.toCreate.push(entry);
  }
  return plan;
}

// ─── Provider calls ──────────────────────────────────────────────────────────

type ProviderFailure = { kind: "auth" | "transient" | "configuration"; message: string };

async function providerRequest(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit
): Promise<{ ok: true; data: any } | { ok: false; failure: ProviderFailure }> {
  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch {
    return { ok: false, failure: { kind: "transient", message: "Google Calendar is temporarily unreachable. Sync will retry automatically." } };
  }
  let data: any = null;
  try { data = await response.json(); } catch { /* empty body */ }
  if (response.ok) return { ok: true, data };
  if (response.status === 401 || response.status === 403) {
    return { ok: false, failure: { kind: "auth", message: "Google Calendar rejected the saved authorization. Reconnect Google Calendar to resume sync." } };
  }
  return { ok: false, failure: { kind: "transient", message: `Google Calendar sync failed (${response.status}). Sync will retry automatically.` } };
}

async function listTrueAxisEvents(
  fetchImpl: typeof fetch,
  accessToken: string,
  calendarId: string
): Promise<{ ok: true; events: RemoteEvent[] } | { ok: false; failure: ProviderFailure }> {
  const events: RemoteEvent[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({
      singleEvents: "true",
      maxResults: "2500",
      privateExtendedProperty: `trueaxisTag=${TRUEAXIS_TAG}`,
    });
    if (pageToken) params.set("pageToken", pageToken);
    const result = await providerRequest(fetchImpl, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!result.ok) return result;
    for (const event of result.data?.items ?? []) events.push({ id: event.id, extendedProperties: event.extendedProperties });
    pageToken = result.data?.nextPageToken;
    if (!pageToken) return { ok: true, events };
  }
  return { ok: true, events };
}

async function refreshAccessToken(
  fetchImpl: typeof fetch,
  refreshToken: string
): Promise<{ ok: true; accessToken: string; expiresIn: number } | { ok: false; failure: ProviderFailure }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { ok: false, failure: { kind: "configuration", message: "Google Calendar client credentials are not configured on this server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." } };
  }
  let response: Response;
  try {
    response = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    });
  } catch {
    return { ok: false, failure: { kind: "transient", message: "Google authorization is temporarily unreachable. Sync will retry automatically." } };
  }
  // A rejected grant (invalid_grant and friends) is permanent until the owner reconnects.
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    return { ok: false, failure: { kind: "auth", message: "Google Calendar authorization expired. Reconnect Google Calendar to resume sync." } };
  }
  if (!response.ok) {
    return { ok: false, failure: { kind: "transient", message: "Google authorization is temporarily unavailable. Sync will retry automatically." } };
  }
  let data: any = null;
  try { data = await response.json(); } catch { /* empty body */ }
  if (!data?.access_token) {
    return { ok: false, failure: { kind: "auth", message: "Google Calendar authorization expired. Reconnect Google Calendar to resume sync." } };
  }
  return { ok: true, accessToken: data.access_token, expiresIn: Number(data.expires_in) || 3600 };
}

// ─── Sync state persistence ──────────────────────────────────────────────────

async function recordSyncError(db: MySql2Database<any>, userId: number, kind: SyncErrorKind, message: string, nowMs: number, disableSync: boolean) {
  await db.update(googleCalendarTokens).set({
    lastError: message.slice(0, 512),
    lastErrorKind: kind,
    lastErrorAt: new Date(nowMs),
    ...(disableSync ? { syncEnabled: false } : {}),
  }).where(eq(googleCalendarTokens.userId, userId));
}

async function recordSyncSuccess(db: MySql2Database<any>, userId: number, nowMs: number) {
  await db.update(googleCalendarTokens).set({
    lastSyncedAt: new Date(nowMs),
    lastError: null,
    lastErrorKind: null,
    lastErrorAt: null,
  }).where(eq(googleCalendarTokens.userId, userId));
}

// ─── Orchestration ───────────────────────────────────────────────────────────

/** Window: bookings from 7 days in the past forward, mirroring an actionable schedule. */
const SYNC_LOOKBACK_DAYS = 7;

function syncWindowStart(nowMs: number): string {
  return new Date(nowMs - SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function runGoogleCalendarSyncForUser(input: { userId: number } & SyncDeps): Promise<SyncOutcome> {
  const { userId, db } = input;
  const fetchImpl = input.fetchImpl ?? fetch;
  const now = input.now ?? Date.now;
  const codec = input.tokenCodec ?? DEFAULT_CODE;

  const [row] = await db.select({
    userId: googleCalendarTokens.userId,
    accessToken: googleCalendarTokens.accessToken,
    refreshToken: googleCalendarTokens.refreshToken,
    expiresAt: googleCalendarTokens.expiresAt,
    calendarId: googleCalendarTokens.calendarId,
  }).from(googleCalendarTokens).where(eq(googleCalendarTokens.userId, userId)).limit(1);
  if (!row) return { status: "not_connected" };

  const tokenRow: TokenRow = {
    userId: row.userId,
    accessToken: codec.decrypt(row.accessToken),
    refreshToken: row.refreshToken ? codec.decrypt(row.refreshToken) : null,
    expiresAt: row.expiresAt,
    calendarId: row.calendarId || "primary",
  };

  let accessToken = tokenRow.accessToken;
  const needsRefresh = !tokenRow.expiresAt || tokenRow.expiresAt.getTime() <= now() + TOKEN_REFRESH_MARGIN_MS;
  if (needsRefresh) {
    if (!tokenRow.refreshToken) {
      await recordSyncError(db, userId, "auth", "Google Calendar authorization expired. Reconnect Google Calendar to resume sync.", now(), true);
      return { status: "auth_failed", message: "Google Calendar authorization expired. Reconnect Google Calendar to resume sync." };
    }
    const refreshed = await refreshAccessToken(fetchImpl, tokenRow.refreshToken as string);
    if (!refreshed.ok) {
      const disable = refreshed.failure.kind !== "transient" && refreshed.failure.kind !== "configuration";
      await recordSyncError(db, userId, refreshed.failure.kind, refreshed.failure.message, now(), disable);
      if (refreshed.failure.kind === "transient") return { status: "transient_error", message: refreshed.failure.message };
      if (refreshed.failure.kind === "configuration") return { status: "configuration_error", message: refreshed.failure.message };
      return { status: "auth_failed", message: refreshed.failure.message };
    }
    accessToken = refreshed.accessToken;
    await db.update(googleCalendarTokens).set({
      accessToken: codec.encrypt(accessToken),
      expiresAt: new Date(now() + refreshed.expiresIn * 1000),
    }).where(eq(googleCalendarTokens.userId, userId));
  }

  const listed = await listTrueAxisEvents(fetchImpl, accessToken, tokenRow.calendarId);
  if (!listed.ok) {
    await recordSyncError(db, userId, listed.failure.kind, listed.failure.message, now(), listed.failure.kind === "auth");
    if (listed.failure.kind === "transient") return { status: "transient_error", message: listed.failure.message };
    if (listed.failure.kind === "configuration") return { status: "configuration_error", message: listed.failure.message };
    return { status: "auth_failed", message: listed.failure.message };
  }

  const userBookings = await db.select().from(bookings).where(and(eq(bookings.userId, userId), ne(bookings.status, "cancelled"), ne(bookings.status, "no_show")));
  const windowStart = syncWindowStart(now());
  const local: Array<{ bookingId: number; resource: BookingEventResource }> = [];
  for (const booking of userBookings) {
    if (booking.date < windowStart) continue;
    const resource = bookingToEventResource(booking);
    if (resource) local.push({ bookingId: booking.id, resource });
  }

  const plan = planReconciliation(local, listed.events);
  let created = 0, updated = 0, deleted = 0;

  for (const entry of plan.toCreate) {
    const result = await providerRequest(fetchImpl, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(tokenRow.calendarId)}/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(entry.resource),
    });
    if (!result.ok) {
      await recordSyncError(db, userId, result.failure.kind, result.failure.message, now(), false);
      return { status: result.failure.kind === "auth" ? "auth_failed" : "transient_error", message: result.failure.message };
    }
    created++;
  }

  for (const entry of plan.toUpdate) {
    const result = await providerRequest(fetchImpl, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(tokenRow.calendarId)}/events/${encodeURIComponent(entry.remoteEventId)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(entry.resource),
    });
    if (!result.ok) {
      await recordSyncError(db, userId, result.failure.kind, result.failure.message, now(), false);
      return { status: result.failure.kind === "auth" ? "auth_failed" : "transient_error", message: result.failure.message };
    }
    updated++;
  }

  for (const eventId of plan.toDelete) {
    const response = await fetchImpl(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(tokenRow.calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.status !== 204 && !response.ok) {
      await recordSyncError(db, userId, "transient", "Google Calendar sync failed while deleting a removed booking. Sync will retry automatically.", now(), false);
      return { status: "transient_error", message: "Google Calendar sync failed while deleting a removed booking. Sync will retry automatically." };
    }
    deleted++;
  }

  await recordSyncSuccess(db, userId, now());
  return { status: "synced", created, updated, deleted };
}

/** Hourly background entry point: sync every connected user, isolating failures. */
export async function runAllGoogleCalendarSyncs(input: SyncDeps): Promise<SyncRunSummary> {
  const { db } = input;
  const rows = await db.select({ userId: googleCalendarTokens.userId })
    .from(googleCalendarTokens).where(eq(googleCalendarTokens.syncEnabled, true));
  const summary: SyncRunSummary = {
    usersAttempted: rows.length, usersSynced: 0, usersFailed: 0,
    eventsCreated: 0, eventsUpdated: 0, eventsDeleted: 0,
  };
  for (const row of rows) {
    try {
      const outcome = await runGoogleCalendarSyncForUser({ ...input, userId: row.userId });
      if (outcome.status === "synced") {
        summary.usersSynced++;
        summary.eventsCreated += outcome.created;
        summary.eventsUpdated += outcome.updated;
        summary.eventsDeleted += outcome.deleted;
      } else if (outcome.status !== "not_connected") {
        summary.usersFailed++;
        console.warn(`[Google Calendar Sync] User ${row.userId} sync ended with ${outcome.status}: ${"message" in outcome ? outcome.message : ""}`);
      }
    } catch (err) {
      summary.usersFailed++;
      console.error(`[Google Calendar Sync] User ${row.userId} sync crashed without stopping the remaining schedule:`, err);
    }
  }
  if (summary.eventsCreated + summary.eventsUpdated + summary.eventsDeleted > 0) {
    console.log(`[Google Calendar Sync] Synced ${summary.usersSynced} connection(s): ${summary.eventsCreated} created, ${summary.eventsUpdated} updated, ${summary.eventsDeleted} deleted.`);
  }
  return summary;
}
