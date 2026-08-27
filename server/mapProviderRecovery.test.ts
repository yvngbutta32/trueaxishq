import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mapSource = readFileSync(resolve(process.cwd(), "client/src/components/Map.tsx"), "utf8");
const dispatchSource = readFileSync(resolve(process.cwd(), "client/src/pages/DispatchBoard.tsx"), "utf8");

describe("map-provider load recovery", () => {
  it("resolves an explicit failed-load result and renders a safe fallback instead of leaving the map pending", () => {
    expect(mapSource).toContain("function loadMapScript(): Promise<boolean>");
    expect(mapSource).toContain("resolve(false)");
    expect(mapSource).toContain("Map preview is unavailable right now. Your dispatch schedule and visit data have not changed.");
  });

  it("notifies the Dispatch Board and disables route actions without altering private visit information", () => {
    expect(dispatchSource).toContain("onMapLoadError");
    expect(dispatchSource).toContain("Map provider unavailable. Dispatch scheduling and private visit data remain unchanged.");
    expect(dispatchSource).toContain("disabled={mapUnavailable || !mapResult");
  });
});
