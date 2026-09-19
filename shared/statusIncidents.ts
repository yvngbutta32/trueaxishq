/* TrueAxis HQ — Public incident history.
 * Rendered by /status. INCIDENTS MUST BE REAL: an entry is added the moment an
 * incident is confirmed resolved, exactly as it happened — no cosmetic or
 * aspirational entries. An empty log means no incidents have occurred since
 * tracking began (September 18, 2026); that is the honest state today and it
 * is what the status page must say.
 */
export interface StatusIncident {
  /** ISO 8601 date the incident began (UTC).
   * @pattern ^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$ */
  began: string;
  /** ISO 8601 date the incident was resolved (UTC). */
  resolved: string;
  title: string;
  /** What happened, in plain language — no spin. */
  summary: string;
  /** Root cause and the fix that shipped. */
  resolution: string;
  /** Components affected. */
  components: string[];
}

export const INCIDENT_TRACKING_BEGAN = "2026-09-18";

export const STATUS_INCIDENTS: StatusIncident[] = [];
