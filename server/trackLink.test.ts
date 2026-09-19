import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Live "on my way" tracking — consent-first contract.
 *
 * Product stance: passive privacy is absolute. The dispatch board and client
 * portal never expose live location, routing, or staffing. Tracking exists ONLY
 * as an owner-initiated, per-visit, auto-expiring link, and the public endpoint
 * serves position plus visit context — never client, technician, address,
 * phone, or routing data. These tests pin that boundary against the shipped
 * source so the marketing privacy promise can never silently drift.
 */

const routers = readFileSync("server/routers.ts", "utf8");
const publicApi = readFileSync("server/publicApi.ts", "utf8");
const schema = readFileSync("drizzle/schema.ts", "utf8");

const trackingRouter = routers.slice(routers.indexOf("tracking: router({"), routers.indexOf("apiKeys: router({"));

describe("tracking link lifecycle (owner-initiated only)", () => {
  it("mints tokens with 32 bytes of entropy (64 hex chars) and a 12-hour TTL", () => {
    expect(trackingRouter).toContain("randomBytes(32).toString(\"hex\")");
    expect(trackingRouter).toContain("Date.now() + 12 * 60 * 60 * 1000");
    expect(publicApi).toContain("/^[0-9a-f]{64}$/");
  });

  it("can only start while a visit is scheduled or en route, and starting flips scheduled to en_route", () => {
    expect(trackingRouter).toContain("visit.status !== \"scheduled\" && visit.status !== \"en_route\"");
    expect(trackingRouter).toContain("status: \"en_route\"");
    expect(trackingRouter).toContain("trackingShared: true");
  });

  it("rotates any previous link before minting a new one (single active link per visit)", () => {
    expect(trackingRouter).toContain("set({ active: false, revokedAt: new Date() })");
  });

  it("audits link creation and stop", () => {
    expect(trackingRouter).toContain("tracking.link_created");
    expect(trackingRouter).toContain("tracking.link_stopped");
  });

  it("revokes links the moment a visit leaves en_route (status-change hook)", () => {
    const hook = "if (input.status !== \"en_route\") {";
    expect(routers).toContain(hook);
    const after = routers.slice(routers.indexOf(hook), routers.indexOf(hook) + 400);
    expect(after).toContain("serviceVisitTrackLinks");
  });

  it("ping validates coordinate ranges and only reports while en route on an active link", () => {
    expect(trackingRouter).toContain("lat: z.number().min(-90).max(90)");
    expect(trackingRouter).toContain("lng: z.number().min(-180).max(180)");
    expect(trackingRouter).toContain("No active tracking link for this visit.");
    expect(trackingRouter).toContain("Position reporting is only allowed while the visit is en route.");
  });
});

describe("public track endpoint privacy boundary", () => {
  it("serves position and visit context only — no client, technician, address, or routing data", () => {
    const trackSection = publicApi.slice(publicApi.indexOf("trackApiRouter"));
    expect(trackSection).toContain("position");
    expect(trackSection).toContain("businessName");
    // Inspect only the JSON payloads the endpoint can ever emit.
    const payloads = trackSection.slice(trackSection.indexOf("res.json({"), trackSection.lastIndexOf("}));"));
    for (const forbidden of ["clientName", "teamMemberName", "phone", "email", "address", "firstName", "lastName", "siteLabel", "dispatchNote"]) {
      expect(payloads).not.toContain(forbidden);
    }
  });

  it("404s for malformed, unknown, inactive, or expired links and self-revokes on arrival", () => {
    expect(publicApi).toContain("This tracking link is not valid.");
    expect(publicApi).toContain("This tracking link is no longer active.");
    expect(publicApi).toContain('visit.status !== "en_route"');
  });
});

describe("schema hardening", () => {
  it("tokens are unique and expiry is mandatory", () => {
    const section = schema.slice(schema.indexOf("serviceVisitTrackLinks"));
    expect(section).toContain("token: varchar(\"token\", { length: 96 }).notNull().unique()");
    expect(section).toContain("expiresAt: timestamp(\"expiresAt\").notNull()");
    expect(section).toContain("techConsented");
  });
});
