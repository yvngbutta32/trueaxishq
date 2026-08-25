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

export type OperationsException = {
  key: string;
  kind: "over_capacity" | "unassigned_job" | "dispatch_overlap";
  severity: "warning" | "critical";
  title: string;
  detail: string;
};

type CapacitySignal = { id: number; name: string; active: boolean; weeklyCapacityMinutes: number; plannedMinutes: number };
type JobSignal = { id: number; jobNumber: string; title: string; status: string };
type AssignmentSignal = { jobId: number; status: string };
type DispatchSignal = { id: number; teamMemberId: number | null; teamMemberName: string | null; title: string; scheduledStart: Date; scheduledEnd: Date; status: string };

export function buildOperationsExceptions(input: { capacity: CapacitySignal[]; jobs: JobSignal[]; assignments: AssignmentSignal[]; visits: DispatchSignal[] }): OperationsException[] {
  const exceptions: OperationsException[] = [];
  for (const member of input.capacity) {
    if (!member.active) continue;
    const summary = getCapacitySummary(member.weeklyCapacityMinutes, member.plannedMinutes);
    if (summary.isOverCapacity) {
      const excess = Math.ceil((member.plannedMinutes - member.weeklyCapacityMinutes) / 60 * 10) / 10;
      exceptions.push({ key: `capacity-${member.id}`, kind: "over_capacity", severity: "critical", title: `${member.name} is over planned capacity`, detail: `${excess}h exceeds the owner-defined weekly plan.` });
    }
  }
  const activeAssignments = new Set(input.assignments.filter(assignment => isCapacityBearingAssignment(assignment.status)).map(assignment => assignment.jobId));
  for (const job of input.jobs) {
    if (!["completed", "cancelled"].includes(job.status) && !activeAssignments.has(job.id)) {
      exceptions.push({ key: `job-${job.id}`, kind: "unassigned_job", severity: "warning", title: `${job.jobNumber} has no active job owner`, detail: job.title });
    }
  }
  const byMember = new Map<number, DispatchSignal[]>();
  for (const visit of input.visits) {
    if (!visit.teamMemberId || visit.status === "cancelled") continue;
    const memberVisits = byMember.get(visit.teamMemberId) ?? [];
    memberVisits.push(visit);
    byMember.set(visit.teamMemberId, memberVisits);
  }
  for (const [memberId, visits] of Array.from(byMember.entries())) {
    for (let index = 0; index < visits.length; index += 1) {
      for (let compareIndex = index + 1; compareIndex < visits.length; compareIndex += 1) {
        if (visitWindowsOverlap({ start: visits[index].scheduledStart, end: visits[index].scheduledEnd }, { start: visits[compareIndex].scheduledStart, end: visits[compareIndex].scheduledEnd })) {
          const name = visits[index].teamMemberName ?? `Team member ${memberId}`;
          exceptions.push({ key: `overlap-${memberId}-${Math.min(visits[index].id, visits[compareIndex].id)}-${Math.max(visits[index].id, visits[compareIndex].id)}`, kind: "dispatch_overlap", severity: "critical", title: `${name} has overlapping service visits`, detail: `${visits[index].title} overlaps ${visits[compareIndex].title}.` });
        }
      }
    }
  }
  return exceptions;
}
