/**
 * Pure, dependency-free route optimizer for private dispatch stop planning.
 *
 * Honest scope: this minimizes straight-line (haversine) travel distance
 * between stops. It is a planning suggestion for the owner to review, not a
 * driving-distance or traffic-aware product. Distances shown alongside an
 * optimization are labeled as straight-line estimates.
 *
 * Algorithm: nearest-neighbor construction from the first stop, then 2-opt
 * improvement until no improving swap remains (guaranteed to terminate:
 * every accepted swap strictly reduces total distance).
 */

export type RouteStop = { id: number; lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export const haversineKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
};

export const totalRouteKm = (stops: RouteStop[]): number => {
  let total = 0;
  for (let index = 1; index < stops.length; index += 1) total += haversineKm(stops[index - 1], stops[index]);
  return total;
};

const isValidStop = (stop: RouteStop): boolean =>
  Number.isFinite(stop.lat) && Number.isFinite(stop.lng) && Number.isFinite(stop.id) &&
  Math.abs(stop.lat) <= 90 && Math.abs(stop.lng) <= 180;

/**
 * Returns the optimized visit-id order. The first stop is always kept in
 * place (crews start where the day starts); everything else is re-ordered.
 * Invalid or duplicate inputs return null — callers degrade honestly
 * instead of silently skipping stops.
 */
export const optimizeStopOrder = (stops: RouteStop[]): number[] | null => {
  if (stops.length < 3) return null;
  if (!stops.every(isValidStop)) return null;
  if (new Set(stops.map(stop => stop.id)).size !== stops.length) return null;

  const order: RouteStop[] = [stops[0]];
  const remaining = stops.slice(1);
  // Nearest-neighbor construction.
  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let index = 0; index < remaining.length; index += 1) {
      const distance = haversineKm(order[order.length - 1], remaining[index]);
      if (distance < bestDistance) { bestDistance = distance; bestIndex = index; }
    }
    order.push(remaining.splice(bestIndex, 1)[0]);
  }

  // 2-opt improvement over the tail (first stop stays fixed as the start).
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < order.length - 1; i += 1) {
      for (let j = i + 1; j < order.length; j += 1) {
        const before: RouteStop[] = [i > 1 ? order[i - 1] : order[0]];
        const segment = order.slice(i, j + 1);
        const reversedSegment = [...segment].reverse();
        const after = j + 1 < order.length ? [order[j + 1]] : [];
        const currentDistance =
          haversineKm(order[i - 1], order[i]) +
          (j + 1 < order.length ? haversineKm(order[j], order[j + 1]) : 0);
        const candidateDistance =
          haversineKm(before[0], reversedSegment[0]) +
          (after.length > 0 ? haversineKm(reversedSegment[reversedSegment.length - 1], after[0]) : 0);
        if (candidateDistance + 1e-9 < currentDistance) {
          order.splice(i, segment.length, ...reversedSegment);
          improved = true;
        }
      }
    }
  }

  return order.map(stop => stop.id);
};
