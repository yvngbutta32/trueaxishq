export function fieldModeDraftKey(jobId: number): string {
  return `trueaxis-field-draft:${jobId}`;
}

/** Client-generated replay id for offline-sync idempotency (addUpdate,
 * queued photos). Falls back to timestamp+random when crypto.randomUUID is
 * unavailable (older browsers, non-secure contexts). */
export function randomRequestId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Durable (localStorage) draft recovery: drafts survive refreshes, dead
 * zones, and browser restarts — not just the session. Best effort, never
 * throws (private mode, quota). */
export function loadFieldModeDraft(jobId: number): string {
  try {
    if (typeof window === "undefined" || !window.localStorage) return "";
    return window.localStorage.getItem(fieldModeDraftKey(jobId)) ?? "";
  } catch {
    return "";
  }
}

export function saveFieldModeDraft(jobId: number, value: string): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    if (value.trim()) window.localStorage.setItem(fieldModeDraftKey(jobId), value);
    else window.localStorage.removeItem(fieldModeDraftKey(jobId));
  } catch {
    /* draft persistence is best effort */
  }
}

export function getFieldModeConnectivityMessage(isOnline: boolean): string | null {
  return isOnline
    ? null
    : "You are offline. Checklist toggles, client updates, and photos are saved on this device and sync automatically when your connection returns. Timer and status changes stay online-only to keep billing timestamps accurate.";
}

export function isRetryableFieldError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /network|fetch|temporar|timeout|offline|failed to fetch/i.test(message);
}
