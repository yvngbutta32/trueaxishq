import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dispatchSource = readFileSync(resolve(process.cwd(), "client/src/pages/DispatchBoard.tsx"), "utf8");
const mapSource = readFileSync(resolve(process.cwd(), "client/src/components/Map.tsx"), "utf8");

describe("Dispatch Board private route preview", () => {
  it("uses active private sites in a bounded owner-controlled stop order without claiming route optimization", () => {
    expect(dispatchSource).toContain("sort((left, right) => new Date(left.scheduledStart).getTime() - new Date(right.scheduledStart).getTime())");
    expect(dispatchSource).toContain("const [routeOrder, setRouteOrder] = useState<number[]>([]);");
    expect(dispatchSource).toContain("const [routePlanningDay, setRoutePlanningDay] = useState(\"\");");
    expect(dispatchSource).toContain("const routePlanningDays = useMemo(() => Array.from(new Set(mappableVisitsByDay.map(visit => localDateKey(visit.scheduledStart))))");
    expect(dispatchSource).toContain("localDateKey(visit.scheduledStart) === routePlanningDay");
    expect(dispatchSource).toContain("Select private route planning day");
    expect(dispatchSource).toContain("const moveRouteStop = (id: number, direction: -1 | 1)");
    expect(dispatchSource).toContain("Use the arrow controls to arrange this browser-only sequence.");
    expect(dispatchSource).toContain("Session only");
    expect(dispatchSource).toContain("optimizeWaypoints: false");
    expect(dispatchSource).toContain("This is not optimized routing, live traffic, staff tracking, or a client-facing ETA.");
  });

  it("loads the maps routes library and requires two resolved private locations", () => {
    expect(mapSource).toContain("libraries=marker,places,geocoding,geometry,routes");
    expect(dispatchSource).toContain("stops.length < 2");
    expect(dispatchSource).toContain("At least two resolved private site labels are needed");
  });

  it("keeps a provider order suggestion private, explicitly requested, and manually reviewable", () => {
    expect(dispatchSource).toContain('const [routeSuggestionState, setRouteSuggestionState] = useState<"idle" | "loading" | "suggested" | "unavailable" | "error">("idle");');
    expect(dispatchSource).toContain("const suggestRouteOrder = () =>");
    expect(dispatchSource).toContain("optimizeWaypoints: true");
    expect(dispatchSource).toContain("result?.routes[0]?.waypoint_order");
    expect(dispatchSource).toContain("const validOrder = waypointOrder.length === intermediateVisits.length");
    expect(dispatchSource).toContain("Suggest private order");
    expect(dispatchSource).toContain("Review or adjust the arrows before using it");
    expect(dispatchSource).toContain("Your current manual order is unchanged");
  });

  it("provides owner-side route recovery without changing client data or work status", () => {
    expect(dispatchSource).toContain("Clear route");
    expect(dispatchSource).toContain("no client data or status was changed");
    expect(dispatchSource).toContain("Locations are never added to the client portal");
    expect(dispatchSource).toContain("The selected day, stop order, and site labels stay in this browser session.");
    expect(dispatchSource).toContain("resolvedStopsRef.current = new Map()");
    expect(dispatchSource).toContain("resolvedStopsRef.current.set(visit.id, position)");
    expect(dispatchSource).toContain("orderedMappableVisits.map(visit => resolvedStopsRef.current.get(visit.id))");
  });
});
