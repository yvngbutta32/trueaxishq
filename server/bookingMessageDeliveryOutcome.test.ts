import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { wasAcceptedByConfiguredSmtp } from "./_core/email";

const source = readFileSync(resolve(process.cwd(), "server/backgroundJobs.ts"), "utf8");

describe("booking message delivery markers", () => {
  it("uses configured SMTP acceptance rather than a console fallback or SMTP failure", () => {
    expect(wasAcceptedByConfiguredSmtp({ success: true, mode: "smtp" })).toBe(true);
    expect(wasAcceptedByConfiguredSmtp({ success: true, mode: "console" })).toBe(false);
    expect(wasAcceptedByConfiguredSmtp({ success: false, mode: "smtp" })).toBe(false);
  });

  it("sets reminder and check-in markers only after configured SMTP acceptance", () => {
    const reminders = source.slice(source.indexOf("async function runBookingReminders"), source.indexOf("// ─── Job: 48-hour post-session check-in"));
    const checkIns = source.slice(source.indexOf("async function runPostSessionCheckIns"), source.indexOf("export function startBackgroundJobs"));

    expect(reminders).toContain("const emailResult = await sendEmail");
    expect(reminders).toContain("if (wasAcceptedByConfiguredSmtp(emailResult))");
    expect(reminders).toContain("reminderSentAt: new Date()");
    expect(reminders).toContain("not marked sent without SMTP acceptance");
    expect(checkIns).toContain("const emailResult = await sendEmail");
    expect(checkIns).toContain("if (wasAcceptedByConfiguredSmtp(emailResult))");
    expect(checkIns).toContain("checkInSentAt: new Date()");
    expect(checkIns).toContain("not marked sent without SMTP acceptance");
  });
});
