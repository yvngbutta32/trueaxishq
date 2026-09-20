import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Route planning & capacity forecast — contract tests.
 *
 * Pins the honesty and privacy boundary of the new dispatch planning tools:
 * - Geocoding is owner-triggered only, cache-first, throttled to Nominatim's
 *   usage policy, and degrades honestly when the free service is unavailable.
 * - Saved stop order is private planning data: owner-scoped, audit-logged,
 *   never dispatches/notifies or touches client-facing fields.
 * - Capacity forecast is an explicit planning aid with honest baseline math
 *   (weekly capacity / 5 workdays), never attendance or payroll claims.
 * - The UI labels straight-line optimization as an estimate, never
 *   driving-distance or traffic-aware routing.
 */

const routers = readFileSync("server/routers.ts", "utf8");
const geocode = readFileSync("server/_core/geocode.ts", "utf8");
const schema = readFileSync("drizzle/schema.ts", "utf8");
const migration = readFileSync("drizzle/0075_brave_psylocke.sql", "utf8");
const board = readFileSync("client/src/pages/DispatchBoard.tsx", "utf8");
const scheduling = readFileSync("client/src/pages/dashboard/SchedulingPanel.tsx", "utf8");
const optimizer = readFileSync("shared/routeOptimizer.ts", "utf8");

const dispatchSlice = routers.slice(routers.indexOf("geocodeSites: protectedProcedure"), routers.indexOf("listAvailabilityBlocks: protectedProcedure"));

describe("schema & migration (0075)", () => {
  it("adds a nullable persisted route order and an owner-scoped geocode cache", () => {
    expect(migration).toContain("ADD COLUMN `routeOrder` int");
    expect(migration).toContain("CREATE TABLE `geocodeCache`");
    expect(migration).toContain("CONSTRAINT `geocodeCache_id` PRIMARY KEY(`id`)");
    expect(migration).toContain("CREATE INDEX `geocodeCache_owner_label_idx`");
    expect(schema).toContain('routeOrder: int("routeOrder")');
    expect(schema).toContain('labelKey: varchar("labelKey", { length: 512 }).notNull()');
  });

  it("never removes or repurposes existing dispatch columns", () => {
    expect(migration).not.toMatch(/DROP\s+(COLUMN|TABLE)/i);
    expect(migration).not.toMatch(/ALTER\s+TABLE\s+`(?:jobs|clients|teamMembers)`/i);
  });
});

describe("keyless geocoding core", () => {
  it("honors Nominatim usage policy: descriptive User-Agent, throttle, hard caps", () => {
    expect(geocode).toContain('NOMINATIM_MIN_INTERVAL_MS = 1100');
    expect(geocode).toContain("TrueAxisHQ-dispatch-route-planning/1.0");
    expect(geocode).toContain("GEOCODE_BATCH_LIMIT = 12");
    expect(geocode).toContain("GEOCODE_LABEL_MAX_LENGTH = 255");
  });

  it("degrades honestly: rate limits and network failures map to unavailable, not fake coordinates", () => {
    expect(geocode).toContain('response.status === 403 || response.status === 429');
    expect(geocode).toContain('{ status: "unavailable" }');
    expect(geocode).toMatch(/Math\.abs\(lat\) > 90 \|\| Math\.abs\(lng\) > 180/);
  });
});

describe("dispatch.geocodeSites procedure", () => {
  it("is owner-triggered, cache-first, and caps the batch", () => {
    expect(dispatchSlice).toContain("z.array(z.string()).min(1).max(GEOCODE_BATCH_LIMIT)");
    expect(dispatchSlice).toContain("eq(geocodeCache.userId, ctx.user.id)");
    expect(dispatchSlice.indexOf("const cached")).toBeLessThan(dispatchSlice.indexOf("geocodeLabelWithNominatim(original)"));
  });

  it("reports degraded service honestly and audit-logs the resolution", () => {
    expect(dispatchSlice).toContain("serviceDegraded = true");
    expect(dispatchSlice).toContain('action: "dispatch.geocode_sites"');
    expect(dispatchSlice).toContain("degraded: serviceDegraded");
  });
});

describe("dispatch.setRouteOrder procedure", () => {
  it("validates ownership of every visit and rejects duplicates", () => {
    expect(dispatchSlice).toContain("Each visit may appear only once in the stop order.");
    expect(dispatchSlice).toContain("One or more visits do not belong to this workspace.");
    expect(dispatchSlice).toContain("eq(serviceVisits.userId, ctx.user.id), inArray(serviceVisits.id, input.visitIds)");
  });

  it("persists a private planning order and audit-logs it — no dispatch, notify, or client-facing writes", () => {
    const procedure = dispatchSlice.slice(dispatchSlice.indexOf("setRouteOrder: protectedProcedure"), dispatchSlice.indexOf("capacityForecast: protectedProcedure"));
    expect(procedure).toContain("routeOrder: index + 1");
    expect(procedure).toContain('action: "dispatch.route_order_saved"');
    for (const banned of ["dispatchNote", "clientVisible", "clientUpdate", "status", "scheduledStart"]) {
      expect(procedure).not.toContain(banned);
    }
  });
});

describe("dispatch.capacityForecast procedure", () => {
  it("uses an honest five-workday baseline and private availability blocks only", () => {
    const procedure = dispatchSlice.slice(dispatchSlice.indexOf("capacityForecast: protectedProcedure"));
    expect(procedure).toContain("Math.round(member.weeklyCapacityMinutes / 5)");
    expect(procedure).toContain("Math.max(60");
    expect(procedure).toContain("staffAvailabilityBlocks");
    expect(procedure).not.toContain("payroll");
  });

  it("is read-only planning (query, not mutation)", () => {
    expect(dispatchSlice).toContain("capacityForecast: protectedProcedure\n      .input(z.object({ days: z.union([z.literal(7), z.literal(14)]).default(14) }).optional())\n      .query(");
  });
});

describe("optimizer honesty", () => {
  it("documents straight-line scope and fails closed on invalid input", () => {
    expect(optimizer).toContain("straight-line (haversine)");
    expect(optimizer).toContain("not a\n * driving-distance or traffic-aware product");
    expect(optimizer).toContain("callers degrade honestly");
    expect(optimizer).toContain("if (!stops.every(isValidStop)) return null;");
  });
});

describe("DispatchBoard wiring", () => {
  it("seeds the session from the saved order and lets the owner persist the reviewed order", () => {
    expect(board).toContain("byId.get(left)?.routeOrder ?? 999");
    expect(board).toContain("saveRouteOrder.mutate({ visitIds: orderedMappableVisits.map(visit => visit.id) })");
  });

  it("labels optimization as a straight-line planning suggestion, not driving directions", () => {
    expect(board).toContain("not a driving-distance or traffic-aware result");
    expect(board).toContain("planning suggestion to review");
  });

  it("discloses the keyless geocoder and keeps saving private", () => {
    expect(board).toContain("free OpenStreetMap Nominatim service");
    expect(board).toContain("never dispatches, notifies, or changes client-facing data");
  });

  it("uses the shared, unit-tested optimizer rather than a local reimplementation", () => {
    expect(board).toContain('from "@shared/routeOptimizer"');
    expect(board).not.toMatch(/function\s+optimizeStopOrder/);
  });
});

describe("SchedulingPanel capacity forecast", () => {
  it("renders the forecast with the honest planning-aid disclosure", () => {
    expect(scheduling).toContain("14-day capacity forecast");
    expect(scheduling).toContain("weekly capacity averaged over five workdays");
    expect(scheduling).toContain("No attendance, payroll, GPS, or client-facing claims.");
  });

  it("surfaces over-capacity days and unassigned visits instead of hiding them", () => {
    expect(scheduling).toContain("Unassigned visits");
    expect(scheduling).toMatch(/scheduled beyond the daily baseline/);
  });
});
