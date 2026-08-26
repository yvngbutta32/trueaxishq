/**
 * Client timeline activity must be opt-in. Operational actions such as staffing,
 * dispatch, templates, checklist edits, and owner planning remain private even
 * when they share the same job-activity table.
 */
export const CLIENT_SAFE_JOB_ACTIVITY_EVENT_TYPES = new Set([
  "client_update",
  "status_changed",
  "approval_requested",
  "approval_responded",
] as const);

export function isClientSafeJobActivityEvent(eventType: string): boolean {
  return CLIENT_SAFE_JOB_ACTIVITY_EVENT_TYPES.has(eventType as never);
}
