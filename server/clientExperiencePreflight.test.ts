import { describe, expect, it } from "vitest";
import { buildClientExperiencePreflight } from "./clientExperiencePreflight";

describe("client experience preflight", () => {
  it("blocks a client journey when payment or transactional delivery is not ready", () => {
    const result = buildClientExperiencePreflight({
      businessConfigured: true,
      businessName: "TrueAxis Demo",
      bookingConfigured: true,
      bookingUsername: "trueaxis-demo",
      serviceCount: 2,
      portalConfigured: true,
      paymentsConfigured: false,
      emailConfigured: false,
      automationCount: 2,
      activeAutomationCount: 1,
    });

    expect(result.overallState).toBe("blocked");
    expect(result.blocked).toBe(2);
    expect(result.checks.find((check) => check.id === "payments")?.state).toBe("blocked");
    expect(result.checks.find((check) => check.id === "email")?.detail).toContain("not ready");
  });

  it("reports a fully configured journey as ready", () => {
    const result = buildClientExperiencePreflight({
      businessConfigured: true,
      businessName: "TrueAxis Demo",
      bookingConfigured: true,
      bookingUsername: "trueaxis-demo",
      serviceCount: 1,
      portalConfigured: true,
      paymentsConfigured: true,
      emailConfigured: true,
      automationCount: 1,
      activeAutomationCount: 1,
    });

    expect(result.overallState).toBe("ready");
    expect(result.ready).toBe(6);
    expect(result.attention).toBe(0);
    expect(result.blocked).toBe(0);
  });
});
