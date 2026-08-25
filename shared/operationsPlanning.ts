export const TEAM_MEMBER_ROLES = ["coordinator", "manager", "specialist", "technician", "contractor"] as const;
export const ASSIGNMENT_ROLES = ["lead", "support", "reviewer", "coordinator"] as const;
export const ASSIGNMENT_STATUSES = ["assigned", "acknowledged", "declined", "completed"] as const;
export const ACTIVE_ASSIGNMENT_STATUSES = ["assigned", "acknowledged"] as const;
export const SERVICE_VISIT_STATUSES = ["scheduled", "en_route", "in_progress", "completed", "cancelled"] as const;

export type ActiveAssignmentStatus = typeof ACTIVE_ASSIGNMENT_STATUSES[number];

export function isCapacityBearingAssignment(status: string): status is ActiveAssignmentStatus {
  return (ACTIVE_ASSIGNMENT_STATUSES as readonly string[]).includes(status);
}

export function getCapacitySummary(weeklyCapacityMinutes: number, plannedMinutes: number) {
  const capacity = Math.max(1, weeklyCapacityMinutes);
  const planned = Math.max(0, plannedMinutes);
  const ratio = planned / capacity;
  return {
    capacity,
    planned,
    ratio,
    remainingMinutes: Math.max(0, capacity - planned),
    isOverCapacity: ratio > 1,
  };
}

export type VisitWindow = { start: Date; end: Date; status: string; id?: number };

export function visitWindowsOverlap(left: Pick<VisitWindow, "start" | "end">, right: Pick<VisitWindow, "start" | "end">): boolean {
  return left.start < right.end && right.start < left.end;
}

export function hasDispatchConflict(existingVisits: VisitWindow[], candidate: VisitWindow): boolean {
  return existingVisits.some(visit =>
    visit.id !== candidate.id &&
    visit.status !== "cancelled" &&
    candidate.status !== "cancelled" &&
    visitWindowsOverlap(visit, candidate),
  );
}
