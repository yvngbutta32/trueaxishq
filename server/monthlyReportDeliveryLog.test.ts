import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { wasAcceptedByConfiguredSmtp } from "./_core/email";

const source = readFileSync(resolve(process.cwd(), "server/backgroundJobs.ts"), "utf8");

describe("monthly report delivery log", () => {
  it("describes external sending only after configured SMTP acceptance", () => {
    expect(wasAcceptedByConfiguredSmtp({ success: true, mode: "smtp" })).toBe(true);
    expect(wasAcceptedByConfiguredSmtp({ success: true, mode: "console" })).toBe(false);
    expect(wasAcceptedByConfiguredSmtp({ success: false, mode: "smtp" })).toBe(false);
  });

  it("does not retain the unconditional monthly-report sent log", () => {
    const section = source.slice(source.indexOf("async function runMonthlyReport"), source.indexOf("// ─── Main scheduler"));

    expect(section).toContain("const emailResult = await sendEmail");
    expect(section).toContain("wasAcceptedByConfiguredSmtp(emailResult)");
    expect(section).toContain("not marked sent without SMTP acceptance");
    expect(section).not.toContain("Monthly report sent for");
  });

  it("keeps owner Settings delivery guidance conditional on configured SMTP acceptance", () => {
    const dashboard = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

    expect(dashboard).toContain("When enabled, this prepares a report on the 1st.");
    expect(dashboard).toContain("marked sent only after configured SMTP acceptance.");
    expect(dashboard).not.toContain("Auto-sent on the 1st");
  });

  it("loads the monthly-report toggle from the protected owner preference and synchronizes successful saves", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const dashboard = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");
    const reportSettings = router.slice(router.indexOf("reportSettings: router({"), router.indexOf("// ── Google Calendar"));

    expect(reportSettings).toContain("status: protectedProcedure");
    expect(reportSettings).toContain("eq(users.id, ctx.user.id)");
    expect(reportSettings).toContain("enabled: preference?.enabled ?? false");
    expect(reportSettings).toContain("return { ok: true, enabled: input.enabled }");
    expect(dashboard).toContain("trpc.reportSettings.status.useQuery()");
    expect(dashboard).toContain("const monthlyEnabled = monthlyStatus?.enabled ?? false");
    expect(dashboard).toContain("utils.reportSettings.status.setData(undefined, { enabled: result.enabled })");
    expect(dashboard).toContain("disabled={monthlyStatusLoading || toggleMonthly.isPending}");
  });
});
