import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const schemaSource = readFileSync(resolve(root, "drizzle/schema.ts"), "utf8");

describe("Job Workspace contract", () => {
  it("persists a lifecycle record with checklist and activity isolation indexes", () => {
    expect(schemaSource).toContain('export const jobs = mysqlTable("jobs"');
    expect(schemaSource).toContain('export const jobTasks = mysqlTable("jobTasks"');
    expect(schemaSource).toContain('export const jobActivities = mysqlTable("jobActivities"');
    expect(schemaSource).toContain('uniqueIndex("jobs_userId_jobNumber_unique_idx")');
    expect(schemaSource).toContain('jobId: int("jobId")');
  });

  it("scopes all owner Job Workspace queries and mutations to the authenticated user", () => {
    const jobRouter = routerSource.slice(routerSource.indexOf("jobs: router({"));
    expect(jobRouter).toContain("eq(jobs.userId, ctx.user.id)");
    expect(jobRouter).toContain("eq(jobTasks.userId, ctx.user.id)");
    expect(jobRouter).toContain("eq(jobActivities.userId, ctx.user.id)");
    expect(jobRouter).toContain("eq(jobPhotos.userId, ctx.user.id)");
  });

  it("limits Client Portal job progress to the token client and excludes internal notes and receipt costs", () => {
    const portalStart = routerSource.indexOf("getJobs: publicProcedure");
    const portalEnd = routerSource.indexOf("  }),\n  // ── Contracts", portalStart);
    const portalJobs = routerSource.slice(portalStart, portalEnd);
    expect(portalJobs).toContain("eq(jobs.clientId, portalRecord.clientId)");
    expect(portalJobs).toContain('activity.eventType !== "internal_note"');
    expect(portalJobs).toContain('inArray(jobPhotos.photoType, ["estimate", "wip", "finished"])');
    expect(portalJobs).not.toContain('photoType: "receipt"');
    expect(portalJobs).toContain("eq(proposals.clientId, portalRecord.clientId)");
    expect(portalJobs).toContain("proposal: jobProposals.find");
  });

  it("keeps Client Portal appointment actions token-scoped and collision-safe", () => {
    const portalStart = routerSource.indexOf("portal: router({");
    const portalEnd = routerSource.indexOf("  // ── Portal Messages", portalStart);
    const portalSource = routerSource.slice(portalStart, portalEnd);
    expect(portalSource).toContain("getBookingAvailability: publicProcedure");
    expect(portalSource).toContain("rescheduleBooking: publicProcedure");
    expect(portalSource).toContain("cancelBooking: publicProcedure");
    expect(portalSource).toContain("eq(bookings.clientId, portalRecord.clientId)");
    expect(portalSource).toContain("slotKey: nextSlotKey");
    expect(portalSource).toContain('code: "CONFLICT"');
  });

  it("links field time capture to an owned Job Workspace before storing it", () => {
    const timeStart = routerSource.indexOf("    start: protectedProcedure", routerSource.indexOf("  time: router({"));
    const timeEnd = routerSource.indexOf("    stop: protectedProcedure", timeStart);
    const startSource = routerSource.slice(timeStart, timeEnd);
    expect(startSource).toContain("jobId: z.number().int().positive().optional()");
    expect(startSource).toContain("eq(jobs.userId, ctx.user.id)");
    expect(startSource).toContain("jobId: input.jobId ?? null");
  });
});
