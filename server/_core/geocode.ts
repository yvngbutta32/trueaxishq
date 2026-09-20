/**
 * Keyless site-label geocoding for dispatch route planning.
 *
 * Design constraints (honest, privacy-first):
 * - The owner explicitly triggers resolution from the dispatch board; no
 *   background geocoding of client data ever runs.
 * - Uses the free OpenStreetMap Nominatim service (no API key) and honors
 *   its usage policy: descriptive User-Agent, minimum 1.1s between requests,
 *   and hard caps on batch size.
 * - Failures are honest: an unavailable or rate-limited service returns
 *   "unavailable" and the board keeps working without coordinates.
 * - Labels are resolved once and cached in the geocodeCache table; the cache
 *   is keyed to the owner, never shared across tenants.
 */

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

export const GEOCODE_BATCH_LIMIT = 12;
export const GEOCODE_LABEL_MAX_LENGTH = 255;
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_MIN_INTERVAL_MS = 1100;

let lastNominatimCallAt = 0;

export type GeocodeOutcome =
  | { status: "resolved"; lat: number; lng: number }
  | { status: "not_found" }
  | { status: "unavailable" };

const normalizeGeocodeLabel = (rawLabel: string): string | null => {
  const trimmed = rawLabel.trim();
  if (!trimmed || trimmed.length > GEOCODE_LABEL_MAX_LENGTH) return null;
  return trimmed.toLowerCase().replace(/\s+/g, " ");
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Resolves one address label against Nominatim. Returns a non-throwing
 * outcome: network failures, rate limits, and malformed responses all map
 * to "unavailable" so callers can degrade honestly.
 */
export const geocodeLabelWithNominatim = async (rawLabel: string): Promise<GeocodeOutcome> => {
  const label = normalizeGeocodeLabel(rawLabel);
  if (!label) return { status: "not_found" };
  const wait = NOMINATIM_MIN_INTERVAL_MS - (Date.now() - lastNominatimCallAt);
  if (wait > 0) await sleep(wait);
  lastNominatimCallAt = Date.now();
  try {
    const url = `${NOMINATIM_ENDPOINT}?q=${encodeURIComponent(label)}&format=json&limit=1&addressdetails=0`;
    const response = await fetch(url, {
      headers: { "User-Agent": "TrueAxisHQ-dispatch-route-planning/1.0 (self-hosted field service software)" },
      signal: AbortSignal.timeout(6000),
    });
    if (response.status === 403 || response.status === 429) return { status: "unavailable" };
    if (!response.ok) return { status: "unavailable" };
    const results = await response.json() as Array<{ lat?: unknown; lon?: unknown }>;
    const first = Array.isArray(results) ? results[0] : undefined;
    const lat = toFiniteNumber(first?.lat);
    const lng = toFiniteNumber(first?.lon);
    if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return first ? { status: "not_found" } : { status: "not_found" };
    }
    return { status: "resolved", lat, lng };
  } catch {
    return { status: "unavailable" };
  }
};

export { normalizeGeocodeLabel };
