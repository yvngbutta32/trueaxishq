import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { wasAcceptedByConfiguredSmtp } from "./_core/email";

const source = readFileSync(resolve(process.cwd(), "server/backgroundJobs.ts"), "utf8");

describe("follow-up rule delivery outcome", () => {
  it("recognizes only configured SMTP acceptance as an external send outcome", () => {
    expect(wasAcceptedByConfiguredSmtp({ success: true, mode: "smtp", id: "message-id" })).toBe(true);
    expect(wasAcceptedByConfiguredSmtp({ success: true, mode: "console", id: "console" })).toBe(false);
    expect(wasAcceptedByConfiguredSmtp({ success: false, mode: "smtp" })).toBe(false);
  });

  it("keeps follow-up drafts unsent until configured SMTP acceptance", () => {
    const section = source.slice(source.indexOf("async function runFollowUpRules"), source.indexOf("// ─── Job: Generate monthly reports"));

    expect(section).toContain('status: "draft"');
    expect(section).toContain("wasAcceptedByConfiguredSmtp(emailResult)");
    expect(section).toContain('status: "sent", sentAt: new Date()');
    expect(section).toContain("retained as draft without SMTP acceptance");
  });
});
