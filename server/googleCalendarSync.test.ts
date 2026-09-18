import { describe, it, expect, vi } from "vitest";
import { googleCalendarTokens, bookings } from "../drizzle/schema";
import {
  bookingToEventResource,
  computeEventChecksum,
  planReconciliation,
  runGoogleCalendarSyncForUser,
  type BookingEventResource,
  type RemoteEvent,
} from "./googleCalendarSync";

// ─── Test fixtures ────────────────────────────────────────────────────────────

const IDENTITY_CODEC = { encrypt: (value: string) => value, decrypt: (value: string) => value };

type UpdateCall = { set: Record<string, unknown> };
type ProviderCall = { url: string; method: string; body?: string };

function makeSyncDb(opts: {
  tokenRow?: Record<string, any> | null;
  bookingRows?: Array<Record<string, any>>;
  updates: UpdateCall[];
}) {
  const db: any = {
    select: (fields?: Record<string, any>) => ({
      from: (table: any) => ({
        where: (_clause: unknown) => {
          if (table === googleCalendarTokens && fields) {
            // Sync-state select: .limit(1)
            return { limit: async () => (opts.tokenRow ? [opts.tokenRow] : []) };
          }
          if (table === bookings) {
            // Bookings select: resolves directly from .where()
            return Promise.resolve(opts.bookingRows ?? []);
          }
          return Promise.resolve([]);
        },
      }),
    }),
    update: (table: any) => ({
      set: (values: Record<string, unknown>) => {
        opts.updates.push({ set: values });
        return { where: async () => [{ affectedRows: 1 }] };
      },
    }),
  };
  return db;
}

function jsonResponse(status: number, data: unknown) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function makeEvent(bookingId: number, resource: BookingEventResource): RemoteEvent {
  return { id: `remote-evt-${bookingId}`, extendedProperties: { private: { ...resource.extendedProperties.private } } };
}

function validTokenRow(overrides: Record<string, any> = {}) {
  return {
    userId: 7,
    accessToken: "valid-access-token",
    refreshToken: "valid-refresh-token",
    expiresAt: new Date(Date.now() + 60 * 60_000),
    calendarId: "primary",
    ...overrides,
  };
}

function sampleBooking(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    userId: 7,
    clientName: "Dana Client",
    service: "Pressure Washing",
    date: "2026-09-20",
    time: "10:00",
    duration: 90,
    status: "confirmed",
    ...overrides,
  };
}

const FIXED_NOW = Date.parse("2026-09-17T12:00:00Z");
const now = () => FIXED_NOW;

// ─── Pure helpers ─────────────────────────────────────────────────────────────

describe("booking event mapping", () => {
  it("maps a booking to a tagged UTC event resource with a stable checksum", () => {
    const resource = bookingToEventResource(sampleBooking());
    expect(resource).not.toBeNull();
    expect(resource!.summary).toBe("Pressure Washing — Dana Client");
    expect(resource!.start.dateTime).toBe("2026-09-20T10:00:00.000Z");
    expect(resource!.end.dateTime).toBe("2026-09-20T11:30:00.000Z");
    expect(resource!.extendedProperties.private.trueaxisTag).toBe("booking");
    expect(resource!.extendedProperties.private.trueaxisId).toBe("1");
    const again = bookingToEventResource(sampleBooking());
    expect(again!.extendedProperties.private.trueaxisChecksum).toBe(resource!.extendedProperties.private.trueaxisChecksum);
    expect(computeEventChecksum(resource!)).toBe(resource!.extendedProperties.private.trueaxisChecksum);
  });

  it("skips bookings with unparseable dates", () => {
    expect(bookingToEventResource(sampleBooking({ date: "not-a-date" }))).toBeNull();
  });
});

// ─── Reconciliation plan ─────────────────────────────────────────────────────

describe("reconciliation plan and conflict policy", () => {
  const resource = bookingToEventResource(sampleBooking())!;

  it("plans a create for a booking with no matching tagged remote event", () => {
    const plan = planReconciliation([{ bookingId: 1, resource }], []);
    expect(plan.toCreate).toHaveLength(1);
    expect(plan.toDelete).toHaveLength(0);
  });

  it("leaves tagged events with matching checksums untouched for idempotent reruns", () => {
    const plan = planReconciliation([{ bookingId: 1, resource }], [makeEvent(1, resource)]);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toDelete).toHaveLength(0);
    expect(plan.untouched).toBe(1);
  });

  it("updates tagged events whose booking changed, keeping TrueAxis authoritative", () => {
    const staleRemote: RemoteEvent = {
      id: "remote-evt-1",
      extendedProperties: { private: { trueaxisTag: "booking", trueaxisId: "1", trueaxisChecksum: "old" } },
    };
    const plan = planReconciliation([{ bookingId: 1, resource }], [staleRemote]);
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.toUpdate[0].remoteEventId).toBe("remote-evt-1");
  });

  it("deletes tagged events whose booking no longer syncs", () => {
    const plan = planReconciliation([], [makeEvent(1, resource)]);
    expect(plan.toDelete).toEqual(["remote-evt-1"]);
  });

  it("never plans any change to untagged owner events", () => {
    const personal: RemoteEvent = { id: "personal-evt", extendedProperties: undefined };
    const staleRemote: RemoteEvent = {
      id: "remote-evt-1",
      extendedProperties: { private: { trueaxisTag: "booking", trueaxisId: "1", trueaxisChecksum: "old" } },
    };
    const plan = planReconciliation([{ bookingId: 1, resource }], [personal, staleRemote]);
    expect(plan.toDelete).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.untouched).toBe(0);
  });
});

// ─── Orchestration against a mocked provider ─────────────────────────────────

describe("runGoogleCalendarSyncForUser", () => {
  it("reports not connected when no token row exists", async () => {
    const updates: UpdateCall[] = [];
    const db = makeSyncDb({ tokenRow: null, updates });
    const outcome = await runGoogleCalendarSyncForUser({
      userId: 7, db, now, tokenCodec: IDENTITY_CODEC, fetchImpl: vi.fn(),
    });
    expect(outcome).toEqual({ status: "not_connected" });
    expect(updates).toHaveLength(0);
  });

  it("creates, updates, and records a clean success without touching untagged events", async () => {
    const updates: UpdateCall[] = [];
    const first = bookingToEventResource(sampleBooking())!;
    const second = bookingToEventResource(sampleBooking({ id: 2, clientName: "Rios Client", service: "Window Cleaning", time: "14:00" }))!;
    const staleRemote: RemoteEvent = {
      id: "remote-evt-1",
      extendedProperties: { private: { trueaxisTag: "booking", trueaxisId: "1", trueaxisChecksum: "old" } },
    };
    const calls: ProviderCall[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method ?? "GET", body: init?.body ? String(init.body) : undefined });
      if (String(url).includes("/events?")) {
        return jsonResponse(200, { items: [staleRemote, { id: "personal-evt" }] });
      }
      if (String(url).endsWith("/events") && init?.method === "POST") return jsonResponse(200, { id: "new-remote-evt" });
      if (init?.method === "PATCH") return jsonResponse(200, { id: "remote-evt-1" });
      throw new Error(`Unexpected provider call: ${init?.method} ${String(url)}`);
    });
    const db = makeSyncDb({
      tokenRow: validTokenRow(),
      bookingRows: [sampleBooking(), sampleBooking({ id: 2, clientName: "Rios Client", service: "Window Cleaning", time: "14:00" })],
      updates,
    });

    const outcome = await runGoogleCalendarSyncForUser({ userId: 7, db, fetchImpl, now, tokenCodec: IDENTITY_CODEC });

    expect(outcome).toEqual({ status: "synced", created: 1, updated: 1, deleted: 0 });
    // 1 list + 1 create + 1 update — the untagged personal event was never written.
    expect(calls).toHaveLength(3);
    expect(calls.filter(call => call.method === "DELETE")).toHaveLength(0);
    const success = updates.find(call => call.set.lastSyncedAt !== undefined);
    expect(success?.set.lastError).toBeNull();
    expect(success?.set.lastSyncedAt).toEqual(new Date(FIXED_NOW));
  });

  it("is idempotent: a rerun with matching remote checksums performs zero writes", async () => {
    const updates: UpdateCall[] = [];
    const resource = bookingToEventResource(sampleBooking())!;
    const tagged = makeEvent(1, resource);
    const calls: ProviderCall[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method ?? "GET" });
      return jsonResponse(200, { items: [tagged] });
    });
    const db = makeSyncDb({ tokenRow: validTokenRow(), bookingRows: [sampleBooking()], updates });

    const outcome = await runGoogleCalendarSyncForUser({ userId: 7, db, fetchImpl, now, tokenCodec: IDENTITY_CODEC });

    expect(outcome).toEqual({ status: "synced", created: 0, updated: 0, deleted: 0 });
    expect(calls).toHaveLength(1); // list only
  });

  it("refreshes an expired token before syncing and persists the new grant", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    const updates: UpdateCall[] = [];
    const calls: ProviderCall[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method ?? "GET" });
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return jsonResponse(200, { access_token: "refreshed-token", expires_in: 3600 });
      }
      if (String(url).includes("/events?")) return jsonResponse(200, { items: [] });
      throw new Error(`Unexpected provider call: ${init?.method} ${String(url)}`);
    });
    const db = makeSyncDb({
      tokenRow: validTokenRow({ accessToken: "expired-token", expiresAt: new Date(FIXED_NOW - 1000) }),
      bookingRows: [],
      updates,
    });

    const outcome = await runGoogleCalendarSyncForUser({ userId: 7, db, fetchImpl, now, tokenCodec: IDENTITY_CODEC });

    expect(outcome).toEqual({ status: "synced", created: 0, updated: 0, deleted: 0 });
    const persist = updates.find(call => call.set.accessToken === "refreshed-token");
    expect(persist?.set.expiresAt).toEqual(new Date(FIXED_NOW + 3600_000));
  });

  it("disables sync and records the error when the refresh grant is rejected", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    const updates: UpdateCall[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("oauth2.googleapis.com/token")) return jsonResponse(400, { error: "invalid_grant" });
      throw new Error("Provider must not be called beyond the refresh attempt");
    });
    const db = makeSyncDb({
      tokenRow: validTokenRow({ expiresAt: new Date(FIXED_NOW - 1000) }),
      bookingRows: [],
      updates,
    });

    const outcome = await runGoogleCalendarSyncForUser({ userId: 7, db, fetchImpl, now, tokenCodec: IDENTITY_CODEC });

    expect(outcome.status).toBe("auth_failed");
    const failure = updates.find(call => call.set.syncEnabled === false);
    expect(failure?.set.lastErrorKind).toBe("auth");
    expect(String(failure?.set.lastError)).toContain("Reconnect Google Calendar");
  });

  it("keeps sync enabled after a transient provider failure so the next pass retries", async () => {
    const updates: UpdateCall[] = [];
    const fetchImpl = vi.fn(async () => { throw new Error("network down"); });
    const db = makeSyncDb({ tokenRow: validTokenRow(), bookingRows: [], updates });

    const outcome = await runGoogleCalendarSyncForUser({ userId: 7, db, fetchImpl, now, tokenCodec: IDENTITY_CODEC });

    expect(outcome.status).toBe("transient_error");
    const failure = updates[0];
    expect(failure?.set.lastErrorKind).toBe("transient");
    expect(failure?.set.syncEnabled).toBeUndefined();
  });

  it("skips bookings outside the sync window and still succeeds", async () => {
    const updates: UpdateCall[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => jsonResponse(200, { items: [] }));
    const db = makeSyncDb({
      tokenRow: validTokenRow(),
      bookingRows: [sampleBooking({ date: "2026-05-01" })],
      updates,
    });

    const outcome = await runGoogleCalendarSyncForUser({ userId: 7, db, fetchImpl, now, tokenCodec: IDENTITY_CODEC });

    expect(outcome).toEqual({ status: "synced", created: 0, updated: 0, deleted: 0 });
  });
});
