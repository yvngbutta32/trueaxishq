import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "server/backgroundJobs.ts"), "utf8");

describe("background scheduler status", () => {
  it("exposes completion and failure state for operational monitoring", () => {
    expect(source).toContain("schedulerLastRunAt");
    expect(source).toContain("schedulerLastError");
    expect(source).toContain("getBackgroundJobStatus");
  });
});
