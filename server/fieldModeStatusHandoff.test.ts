import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/FieldMode.tsx"), "utf8");
const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");

describe("Field Mode status handoff", () => {
  it("uses the existing protected owner-scoped job update mutation for stage changes", () => {
    expect(source).toContain("trpc.jobs.update.useMutation");
    expect(source).toContain('requestStatusChange("in_progress")');
    expect(source).toContain('requestStatusChange("completed")');
  });

  it("keeps client communication a separate deliberate action", () => {
    expect(source).toContain("This does not send a client notification.");
    expect(source).toContain("Client communication remains under your control.");
    expect(source).toContain("Post update");
  });

  it("prevents offline changes and exposes loading state", () => {
    expect(source).toContain("requestStatusChange");
    expect(source).toContain("Status saved on this device and will sync when you reconnect.");
    expect(source).toContain("Start on-site work");
    expect(source).toContain("Mark complete");
  });

  it("carries the observed status and rejects stale offline replays", () => {
    const updateStart = router.indexOf("update: protectedProcedure", router.indexOf("jobs: router({"));
    const update = router.slice(updateStart, router.indexOf("addTask: protectedProcedure", updateStart));
    expect(source).toContain("expectedStatus: next.expectedStatus");
    expect(source).toContain("expectedStatus: activeJob.status");
    expect(update).toContain("expectedStatus:");
    expect(update).toContain("current.status !== input.expectedStatus");
    expect(update).toContain('code: "CONFLICT"');
  });
});
