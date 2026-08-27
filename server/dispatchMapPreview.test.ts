import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/DispatchBoard.tsx"), "utf8");

describe("Dispatch Board private site preview", () => {
  it("derives map inputs only from active visits with a site label and keeps the preview bounded", () => {
    expect(source).toContain('activeVisits.filter(visit => Boolean(visit.siteLabel?.trim())).sort(');
    expect(source).toContain(").slice(0, 12)");
    expect(source).toContain("Preview up to 12 active visit site labels for owner planning");
  });

  it("uses the provided map component and reports resolved and unresolved labels", () => {
    expect(source).toContain("<MapView");
    expect(source).toContain("new window.google.maps.Geocoder()");
    expect(source).toContain("setMapResult({ resolved, unresolved })");
    expect(source).toContain("mapResult.unresolved");
  });

  it("makes the privacy and operational non-claims explicit", () => {
    expect(source).toContain("Locations are never added to the client portal");
    expect(source).toContain("it is not optimized routing, live traffic, staff tracking, or a client-facing ETA");
  });
});
