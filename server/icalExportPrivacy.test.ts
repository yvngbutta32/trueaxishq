import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "server/icalExport.ts"), "utf8");

describe("portal calendar export privacy", () => {
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
