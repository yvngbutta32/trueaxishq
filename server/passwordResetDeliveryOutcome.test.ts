import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { wasAcceptedByConfiguredSmtp } from "./_core/email";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");

describe("password reset delivery outcome", () => {
  it("recognizes only configured SMTP acceptance as an externally accepted reset-email outcome", () => {
    expect(wasAcceptedByConfiguredSmtp({ success: true, mode: "smtp" })).toBe(true);
    expect(wasAcceptedByConfiguredSmtp({ success: true, mode: "console" })).toBe(false);
    expect(wasAcceptedByConfiguredSmtp({ success: false, mode: "smtp" })).toBe(false);
  });

  it("keeps the public response generic while the private owner notice states the provider-acceptance boundary", () => {
    const start = routerSource.indexOf("forgotPassword: publicProcedure");
    const end = routerSource.indexOf("resetPassword: publicProcedure", start);
    const section = routerSource.slice(start, end);

    expect(section).toContain("const resetEmailResult = await sendEmail");
    expect(section).toContain("wasAcceptedByConfiguredSmtp(resetEmailResult)");
    expect(section).toContain("No configured SMTP acceptance was recorded for the reset email.");
    expect(section).not.toContain("Reset link sent to user.");
    expect(section).toContain("return { success: true };");
  });
});
