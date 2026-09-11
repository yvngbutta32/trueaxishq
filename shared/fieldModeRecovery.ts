export function fieldModeDraftKey(jobId: number): string {
  return `trueaxis-field-session-draft:${jobId}`;
}

export const fieldModeQueueKey = "trueaxis-field-pending-status:v1";
// Drafts and queued statuses are saved for this browser session/device only;
// they are not a server-side offline replica.
export type FieldModeQueuedStatus = {
  jobId: number;
  status: "in_progress" | "completed";
  expectedStatus: "lead" | "quoted" | "approved" | "scheduled" | "in_progress";
  queuedAt: string;
};

export function readFieldModeStatusQueue(storage: Pick<Storage, "getItem">): FieldModeQueuedStatus[] {
  try {
    const value = storage.getItem(fieldModeQueueKey);
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): FieldModeQueuedStatus[] => {
      if (typeof item !== "object" || item === null) return [];
      const candidate = item as Partial<FieldModeQueuedStatus>;
      if (typeof candidate.jobId !== "number" || !Number.isInteger(candidate.jobId) ||
        (candidate.status !== "in_progress" && candidate.status !== "completed") ||
        typeof candidate.queuedAt !== "string") return [];
      const expectedStatus = candidate.expectedStatus ?? (candidate.status === "completed" ? "in_progress" : "scheduled");
      if (!["lead", "quoted", "approved", "scheduled", "in_progress"].includes(expectedStatus)) return [];
      return [{ jobId: candidate.jobId, status: candidate.status, expectedStatus: expectedStatus as FieldModeQueuedStatus["expectedStatus"], queuedAt: candidate.queuedAt }];
    });
  } catch {
    return [];
  }
}

export function writeFieldModeStatusQueue(storage: Pick<Storage, "setItem">, queue: FieldModeQueuedStatus[]): void {
  storage.setItem(fieldModeQueueKey, JSON.stringify(queue.slice(-20)));
}

export function getFieldModeConnectivityMessage(isOnline: boolean): string | null {
  return isOnline
    ? null
    : "You are offline. Status changes are queued on this device; timer, checklist, photo, and client-update changes still need a connection.";
}

export function isRetryableFieldError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /network|fetch|temporar|timeout|offline|failed to fetch/i.test(message);
}
