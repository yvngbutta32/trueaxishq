import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_MARGIN_THRESHOLD_PERCENT, getJobMarginSignal, normalizeMarginThreshold } from "../shared/jobMarginSignals";

const root = resolve(import.meta.dirname, "..");
const workspaceSource = readFileSync(resolve(root, "client/src/pages/JobWorkspace.tsx"), "utf8");

describe("owner-only job margin signals", () => {
  it("normalizes a bounded local threshold without persisting or sending it", () => {
    expect(normalizeMarginThreshold("42.25")).toBe(42.3);
    expect(normalizeMarginThreshold(-1)).toBe(DEFAULT_MARGIN_THRESHOLD_PERCENT);
    expect(normalizeMarginThreshold(101)).toBe(DEFAULT_MARGIN_THRESHOLD_PERCENT);
  });

  it("prioritizes missing revenue, negative profit, and below-threshold signals correctly", () => {
    expect(getJobMarginSignal({ revenue: 0, profit: -25, marginPercent: null }, 30)?.kind).toBe("missing_revenue_basis");
    expect(getJobMarginSignal({ revenue: 100, profit: -1, marginPercent: -1 }, 30)?.kind).toBe("negative_margin");
    expect(getJobMarginSignal({ revenue: 100, profit: 20, marginPercent: 20 }, 30)?.kind).toBe("below_threshold");
    expect(getJobMarginSignal({ revenue: 100, profit: 45, marginPercent: 45 }, 30)).toBeNull();
  });

  it("renders signals only in the private report and describes the no-notification boundary", () => {
    expect(workspaceSource).toContain("Local margin review signals");
    expect(workspaceSource).toContain("They do not send notifications or client updates.");
    expect(workspaceSource).toContain("getJobMarginSignal");
    expect(workspaceSource).not.toContain("trpc.notifications.create");
  });
});
