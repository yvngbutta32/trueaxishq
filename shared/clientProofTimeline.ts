export type ClientProofTimelineItem = {
  id: string;
  kind: "status" | "milestone" | "photo";
  title: string;
  detail: string;
  occurredAt: Date | string | null;
  photoUrl?: string;
  photoType?: "estimate" | "wip" | "finished";
};

type TimelineInput = {
  status: string;
  updatedAt?: Date | string | null;
  activities: Array<{ id: number; eventType: string; message: string; createdAt: Date | string | null }>;
  tasks: Array<{ id: number; title: string; status: string; completedAt?: Date | string | null; createdAt?: Date | string | null }>;
  photos: Array<{ id: number; photoType: "estimate" | "wip" | "finished"; photoUrl: string; caption?: string | null; createdAt: Date | string | null }>;
};

function timestamp(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusLabel(status: string): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, character => character.toUpperCase());
}

export function buildClientProofTimeline(input: TimelineInput): ClientProofTimelineItem[] {
  const items: ClientProofTimelineItem[] = [
    {
      id: `status-${input.status}`,
      kind: "status",
      title: `Job status: ${statusLabel(input.status)}`,
      detail: "Your provider updated the overall job status.",
      occurredAt: input.updatedAt ?? null,
    },
    ...input.activities
      .filter(activity => activity.eventType !== "internal_note" && activity.message.trim())
      .map(activity => ({
        id: `activity-${activity.id}`,
        kind: "status" as const,
        title: "Provider update",
        detail: activity.message,
        occurredAt: activity.createdAt,
      })),
    ...input.tasks.map(task => ({
      id: `task-${task.id}`,
      kind: "milestone" as const,
      title: task.status === "done" ? `Milestone completed: ${task.title}` : `Milestone: ${task.title}`,
      detail: task.status === "done" ? "This milestone is complete." : `Current state: ${statusLabel(task.status)}.`,
      occurredAt: task.completedAt ?? task.createdAt ?? null,
    })),
    ...input.photos.map(photo => ({
      id: `photo-${photo.id}`,
      kind: "photo" as const,
      title: `${statusLabel(photo.photoType)} proof photo`,
      detail: photo.caption?.trim() || "Visual progress shared by your provider.",
      occurredAt: photo.createdAt,
      photoUrl: photo.photoUrl,
      photoType: photo.photoType,
    })),
  ];

  return items
    .filter(item => timestamp(item.occurredAt) > 0)
    .sort((left, right) => timestamp(right.occurredAt) - timestamp(left.occurredAt) || left.id.localeCompare(right.id));
}
