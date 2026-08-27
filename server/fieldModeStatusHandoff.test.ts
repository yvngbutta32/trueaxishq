import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/FieldMode.tsx"), "utf8");

describe("Field Mode status handoff", () => {
  it("uses the existing protected owner-scoped job update mutation for stage changes", () => {
    expect(source).toContain("trpc.jobs.update.useMutation");
    expect(source).toContain('status: "in_progress"');
    expect(source).toContain('status: "completed"');
  });

  it("keeps client communication a separate deliberate action", () => {
    expect(source).toContain("This does not send a client notification.");
    expect(source).toContain("Client communication remains under your control.");
    expect(source).toContain("Post update");
  });

  it("prevents offline changes and exposes loading state", () => {
    expect(source).toContain("!isOnline || updateJobStatus.isPending");
    expect(source).toContain("Start on-site work");
    expect(source).toContain("Mark complete");
  });
});
