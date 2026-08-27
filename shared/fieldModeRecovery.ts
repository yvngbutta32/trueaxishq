export function fieldModeDraftKey(jobId: number): string {
  return `trueaxis-field-session-draft:${jobId}`;
}

export function getFieldModeConnectivityMessage(isOnline: boolean): string | null {
  return isOnline
    ? null
    : "You are offline. Timer, checklist, photo, and client-update changes need a connection. Your update draft is saved for this browser session.";
}

export function isRetryableFieldError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /network|fetch|temporar|timeout|offline|failed to fetch/i.test(message);
}
