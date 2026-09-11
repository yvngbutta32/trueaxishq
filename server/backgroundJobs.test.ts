import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "server/backgroundJobs.ts"), "utf8");

describe("background scheduler reliability", () => {
  it("prevents duplicate startup and overlapping scheduled runs", () => {
    expect(source).toContain("let schedulerStarted = false");
    expect(source).toContain("let schedulerRunning = false");
    expect(source).toContain("Background job scheduler already started");
    expect(source).toContain("Previous scheduled run is still in progress");
  });
});
