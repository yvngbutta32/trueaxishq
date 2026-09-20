import { describe, it, expect } from "vitest";
import { haversineKm, optimizeStopOrder, totalRouteKm, type RouteStop } from "@shared/routeOptimizer";

// Synthetic geography (roughly around Austin, TX) with known optimal answers.

const stop = (id: number, lat: number, lng: number): RouteStop => ({ id, lat, lng });

describe("haversineKm", () => {
  it("returns zero for identical points and a sane short distance", () => {
    const a = stop(1, 30.2672, -97.7431);
    expect(haversineKm(a, a)).toBe(0);
    // ~1 degree of latitude is ~111 km.
    expect(haversineKm(stop(1, 30, -97), stop(2, 31, -97))).toBeGreaterThan(100);
    expect(haversineKm(stop(1, 30, -97), stop(2, 31, -97))).toBeLessThan(112);
  });

  it("is symmetric", () => {
    const a = stop(1, 30.2672, -97.7431);
    const b = stop(2, 30.5, -97.2);
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 9);
  });
});

describe("totalRouteKm", () => {
  it("sums all legs", () => {
    const route = [stop(1, 30, -97), stop(2, 30, -96), stop(3, 30, -95)];
    expect(totalRouteKm(route)).toBeGreaterThan(totalRouteKm(route.slice(0, 2)));
  });

  it("is zero or one leg for trivial routes", () => {
    expect(totalRouteKm([])).toBe(0);
    expect(totalRouteKm([stop(1, 30, -97)])).toBe(0);
  });
});

describe("optimizeStopOrder", () => {
  it("reverses a backtracking zigzag into an out-and-back order", () => {
    // Stops laid out west -> east; visiting them east-first is strictly worse.
    const ordered = [stop(1, 30.0, -97.30), stop(2, 30.0, -97.20), stop(3, 30.0, -97.10), stop(4, 30.0, -97.00)];
    const shuffled = [ordered[0], ordered[3], ordered[2], ordered[1]];
    const result = optimizeStopOrder(shuffled);
    expect(result).not.toBeNull();
    const byId = new Map(ordered.map(s => [s.id, s]));
    const optimizedStops = result!.map(id => byId.get(id)!);
    expect(totalRouteKm(optimizedStops)).toBeLessThanOrEqual(totalRouteKm(shuffled));
    // The optimal west-to-east sweep is within 5% of our result (2-opt may
    // match it exactly; the first stop is fixed by design).
    expect(totalRouteKm(optimizedStops)).toBeLessThanOrEqual(totalRouteKm(ordered) * 1.05);
  });

  it("keeps the first stop in place", () => {
    const stops = [stop(9, 30.0, -97.30), stop(2, 30.1, -97.0), stop(3, 30.2, -97.1), stop(4, 30.3, -97.2)];
    const result = optimizeStopOrder(stops);
    expect(result).not.toBeNull();
    expect(result![0]).toBe(9);
  });

  it("returns null for fewer than three stops", () => {
    expect(optimizeStopOrder([stop(1, 30, -97)])).toBeNull();
    expect(optimizeStopOrder([stop(1, 30, -97), stop(2, 30.1, -97)])).toBeNull();
    expect(optimizeStopOrder([])).toBeNull();
  });

  it("returns null for invalid coordinates or duplicate ids (fail closed)", () => {
    expect(optimizeStopOrder([stop(1, 91, -97), stop(2, 30, -97), stop(3, 30.1, -97)])).toBeNull();
    expect(optimizeStopOrder([stop(1, 30, 181), stop(2, 30, -97), stop(3, 30.1, -97)])).toBeNull();
    expect(optimizeStopOrder([stop(1, 30, -97), stop(1, 30.1, -97), stop(3, 30.2, -97)])).toBeNull();
    expect(optimizeStopOrder([stop(1, NaN, -97), stop(2, 30, -97), stop(3, 30.1, -97)])).toBeNull();
  });

  it("includes every stop exactly once", () => {
    const stops = [stop(1, 30.00, -97.30), stop(2, 30.05, -97.25), stop(3, 30.10, -97.20), stop(4, 30.15, -97.15), stop(5, 30.20, -97.10)];
    const result = optimizeStopOrder(stops);
    expect(result).not.toBeNull();
    expect(new Set(result)).toEqual(new Set([1, 2, 3, 4, 5]));
    expect(result!.length).toBe(5);
  });

  it("never returns a worse route than the input", () => {
    const input = [stop(1, 30.0, -97.0), stop(2, 30.5, -97.5), stop(3, 30.1, -97.1), stop(4, 30.4, -97.4), stop(5, 30.2, -97.2), stop(6, 30.3, -97.3)];
    const result = optimizeStopOrder(input)!;
    const byId = new Map(input.map(s => [s.id, s]));
    const optimized = result.map(id => byId.get(id)!);
    expect(totalRouteKm(optimized)).toBeLessThanOrEqual(totalRouteKm(input) + 1e-9);
  });
});
