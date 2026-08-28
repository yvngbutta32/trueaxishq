import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { wasAcceptedByConfiguredSmtp } from "./_core/email";

const source = readFileSync(resolve(process.cwd(), "server/automationEngine.ts"), "utf8");

describe("automation email outcome", () => {
  it("counts an externally completed email action only when configured SMTP accepts it", () => {
    expect(wasAcceptedByConfiguredSmtp({ success: true, mode: "smtp" })).toBe(true);
    expect(wasAcceptedByConfiguredSmtp({ success: true, mode: "console" })).toBe(false);
    expect(wasAcceptedByConfiguredSmtp({ success: false, mode: "smtp" })).toBe(false);
  });

  it("records explicit issues instead of increasing completed email actions for non-SMTP outcomes", () => {
    const emailAction = source.slice(source.indexOf('if (action.type === "send_email")'), source.indexOf('if (action.type === "create_followup")'));

    expect(emailAction).toContain("wasAcceptedByConfiguredSmtp(result)");
    expect(emailAction).toContain("Email not sent: no configured SMTP delivery was attempted.");
    expect(emailAction).toContain("continue;");
    expect(emailAction).toContain("actionsExecuted++");
  });
});
