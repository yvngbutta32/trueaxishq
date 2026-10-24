import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * settings.get fires on EVERY dashboard load. A bare JSON.parse on a stored
 * column (bookingServices) turned malformed or legacy text data into a 500
 * that crashed the entire dashboard — found by live interactive QA Oct 24
 * 2026 with seeded legacy-text data ("Water heater install, drain cleaning...").
 *
 * This contract pins the fix class: every read of stored bookingServices must
 * go through the safe shared parser, never a bare JSON.parse.
 */

const routers = readFileSync("server/routers.ts", "utf8");
const rules = readFileSync("shared/publicBookingRules.ts", "utf8");

describe("bookingServices never crashes the dashboard", () => {
  it("exposes a safe parser that never throws and never invents services on bad data", () => {
    expect(rules).toContain("export function parseStoredBookingServices");
    expect(rules).toContain("if (!serialized) return [];");
    expect(rules).toContain("catch { return []; }");
    expect(rules).toContain("if (!Array.isArray(parsed) || parsed.length === 0) return [];");
  });

  it("no bare JSON.parse on the bookingServices column remains in the server", () => {
    expect(routers).not.toMatch(/JSON\.parse\((u|user|host)\.?\.bookingServices\)/);
  });

  it("settings.get and the status preflights read through the safe parser", () => {
    expect(routers).toContain("bookingServices: parseStoredBookingServices(u.bookingServices)");
    const uses = routers.match(/parseStoredBookingServices\(/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(3); // settings.get + 2 status preflights
  });
});
