import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dispatchSource = readFileSync(resolve(process.cwd(), "client/src/pages/DispatchBoard.tsx"), "utf8");
const mapSource = readFileSync(resolve(process.cwd(), "client/src/components/Map.tsx"), "utf8");

describe("Dispatch Board private route preview", () => {
  it("uses resolved active private sites in scheduled order without claiming route optimization", () => {
    expect(dispatchSource).toContain("sort((left, right) => new Date(left.scheduledStart).getTime() - new Date(right.scheduledStart).getTime())");
    expect(dispatchSource).toContain("optimizeWaypoints: false");
    expect(dispatchSource).toContain("it is not optimized routing, live traffic, staff tracking, or a client-facing ETA");
  });

  it("loads the maps routes library and requires two resolved private locations", () => {
    expect(mapSource).toContain("libraries=marker,places,geocoding,geometry,routes");
    expect(dispatchSource).toContain("stops.length < 2");
    expect(dispatchSource).toContain("At least two resolved private site labels are needed");
  });

  it("provides owner-side route recovery without changing client data or work status", () => {
    expect(dispatchSource).toContain("Clear route");
    expect(dispatchSource).toContain("no client data or status was changed");
    expect(dispatchSource).toContain("Locations are never added to the client portal");
  });
});
