import { describe, expect, it } from "vitest";
import { buildClientProofTimeline } from "../shared/clientProofTimeline";

describe("client proof-of-work timeline", () => {
  it("combines visible updates, milestones, and non-receipt photos newest first", () => {
    const timeline = buildClientProofTimeline({
      status: "in_progress",
      updatedAt: "2026-08-25T12:00:00.000Z",
      activities: [
        { id: 1, eventType: "internal_note", message: "Private margin note", createdAt: "2026-08-25T12:04:00.000Z" },
        { id: 2, eventType: "status_update", message: "Prep is complete", createdAt: "2026-08-25T12:03:00.000Z" },
      ],
      tasks: [{ id: 3, title: "Prepare materials", status: "done", completedAt: "2026-08-25T12:02:00.000Z" }],
      photos: [{ id: 4, photoType: "wip", photoUrl: "https://cdn.example.test/wip.jpg", caption: "On site", createdAt: "2026-08-25T12:05:00.000Z" }],
    });

    expect(timeline.map(item => item.id)).toEqual(["photo-4", "activity-2", "task-3", "status-in_progress"]);
    expect(timeline.some(item => item.detail.includes("Private margin note"))).toBe(false);
  });

  it("keeps the builder contract limited to client-safe photo types", () => {
    const timeline = buildClientProofTimeline({
      status: "completed",
      updatedAt: "2026-08-25T12:00:00.000Z",
      activities: [],
      tasks: [],
      photos: [{ id: 8, photoType: "finished", photoUrl: "https://cdn.example.test/final.jpg", caption: null, createdAt: "2026-08-25T12:01:00.000Z" }],
    });
    expect(timeline[0]).toMatchObject({ kind: "photo", photoType: "finished" });
  });
});
