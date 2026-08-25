import { describe, expect, it } from "vitest";
import { getClientNextStep } from "./ClientPortal";

describe("client portal next-step clarity", () => {
  it("prioritizes overdue payment recovery over other states", () => {
    const result = getClientNextStep({
      unpaidInvoices: [{ status: "overdue" }],
      bookings: [{ status: "scheduled" }],
      jobs: [{ status: "in_progress" }],
    });
    expect(result.tone).toBe("urgent");
    expect(result.title).toBe("Payment needs your attention");
  });

  it("surfaces client input when a job is waiting for the client", () => {
    const result = getClientNextStep({
      unpaidInvoices: [],
      bookings: [],
      jobs: [{ status: "awaiting_client" }],
    });
    expect(result.tone).toBe("attention");
    expect(result.action).toBe("Review work progress");
  });

  it("provides a calm current-state message when no action is pending", () => {
    const result = getClientNextStep({ unpaidInvoices: [], bookings: [], jobs: [] });
    expect(result.tone).toBe("ready");
    expect(result.title).toBe("Your workspace is up to date");
  });
});
