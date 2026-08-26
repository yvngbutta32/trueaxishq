import { describe, expect, it } from "vitest";
import { isClientSafeJobActivityEvent } from "../shared/clientSafeJobActivity";
import { buildClientProofTimeline } from "../shared/clientProofTimeline";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");

describe("client-safe job activity timeline", () => {
  it("allows only explicit client update, status, and approval activity types", () => {
    expect(isClientSafeJobActivityEvent("client_update")).toBe(true);
    expect(isClientSafeJobActivityEvent("status_changed")).toBe(true);
    expect(isClientSafeJobActivityEvent("approval_requested")).toBe(true);
    expect(isClientSafeJobActivityEvent("approval_responded")).toBe(true);
    expect(isClientSafeJobActivityEvent("team_member_unassigned")).toBe(false);
    expect(isClientSafeJobActivityEvent("checklist_template_created")).toBe(false);
    expect(isClientSafeJobActivityEvent("service_visit_cancelled")).toBe(false);
    expect(isClientSafeJobActivityEvent("task_added")).toBe(false);
  });

  it("excludes operational activity from both the server payload and rendered proof timeline", () => {
    const portalStart = routerSource.indexOf("getJobs: publicProcedure");
    const responseEnd = routerSource.indexOf("respondToApproval: publicProcedure", portalStart);
    const portalSection = routerSource.slice(portalStart, responseEnd);
    expect(portalSection).toContain("isClientSafeJobActivityEvent(activity.eventType)");
    expect(portalSection).not.toContain('activity.eventType !== "internal_note"');

    const timeline = buildClientProofTimeline({
      status: "in_progress",
      activities: [
        { id: 1, eventType: "client_update", message: "Work has started.", createdAt: new Date("2026-08-01T10:00:00Z") },
        { id: 2, eventType: "team_member_unassigned", message: "Removed a team assignment from this job.", createdAt: new Date("2026-08-01T11:00:00Z") },
      ],
      tasks: [],
      photos: [],
    });
    expect(timeline.some(item => item.detail.includes("Work has started"))).toBe(true);
    expect(timeline.some(item => item.detail.includes("team assignment"))).toBe(false);
  });
});
