import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { escapeIcalText } from "./icalExport";

const source = readFileSync(resolve(process.cwd(), "server/icalExport.ts"), "utf8");

describe("portal calendar export privacy", () => {
  it("normalizes CRLF and lone CR controls before escaping calendar text", () => {
    const escaped = escapeIcalText("Service\r\nX-ATTENDEE;A,B\\C\rEnd\nLast");

    expect(escaped).toBe("Service\\nX-ATTENDEE\\;A\\,B\\\\C\\nEnd\\nLast");
    expect(escaped).not.toMatch(/[\r\n]/);
  });

  it("requires a non-revoked portal token and scopes portal rows to its client", () => {
    expect(source).toContain("eq(clientPortalTokens.revoked, false)");
    expect(source).toContain("portalClientId = portalRecord.clientId");
    expect(source).toContain("eq(bookings.clientId, portalClientId)");
  });

  it("removes client contact data and private notes from portal-token calendar entries", () => {
    expect(source).toContain("portalClientId === null");
    expect(source).toContain(': b.service || "Appointment"');
    expect(source).toContain(': "";');
  });
});

describe("private owner calendar-feed credential", () => {
  it("uses a distinct opaque route and never treats the credential as a portal token or user ID", () => {
    expect(source).toContain('icalRouter.get("/calendar/feed/:credentialIcs"');
    expect(source).toContain("/^[A-Za-z0-9_-]{32,128}$/");
    expect(source).toContain("hashCalendarFeedCredential(credential)");
    expect(source).toContain("eq(calendarFeedTokens.tokenHash, credentialHash)");
    expect(source).not.toContain('"/calendar/feed/:userId');
  });

  it("rejects revoked owner credentials and produces a service-only schedule", () => {
    expect(source).toContain("eq(calendarFeedTokens.revoked, false)");
    expect(source).toContain('SUMMARY:${escapeIcalText(booking.service || "Appointment")}');
    expect(source).not.toContain("Client: ${escapeIcalText(booking.clientName)}");
    expect(source).not.toContain("Notes: ${escapeIcalText(booking.notes)}");
  });

  it("updates owner-feed access telemetry without making delivery depend on it", () => {
    expect(source).toContain("lastAccessedAt: new Date()");
    expect(source).toContain("Unable to record owner feed access");
  });
});
