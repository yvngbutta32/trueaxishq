import { readFileSync } from "node:fs";
import { readDashboardBundle } from "./dashboardBundle";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("authenticated dashboard evidence-boundary copy", () => {
  it("does not describe notifications, recurring invoices, calendar feeds, payments, or background work as verified live or automatic outcomes", () => {
    const dashboard = readDashboardBundle();

    expect(dashboard).not.toContain("Real-time bell with unread badge — never miss an important event.");
    expect(dashboard).not.toContain("invoices generate automatically.");
    expect(dashboard).not.toContain("live iCal feed");
    expect(dashboard).not.toContain("Clients can pay invoices instantly — webhooks auto-mark them paid.");
    expect(dashboard).not.toContain("run every 5 minutes, hands-free.");
    expect(dashboard).toContain("Provider checkout and signed webhook handling require separate validation.");
    expect(dashboard).toContain("delivery and managed scheduling require separate validation.");
  });

  it("labels health information as the latest configured checks rather than universal operational status", () => {
    const healthMonitor = source("client/src/components/HealthMonitor.tsx");

    expect(healthMonitor).not.toContain("All systems operational");
    expect(healthMonitor).not.toContain("All Systems Go");
    expect(healthMonitor).toContain("Latest configured checks passed");
    expect(healthMonitor).toContain("Checks passed");
  });
});
