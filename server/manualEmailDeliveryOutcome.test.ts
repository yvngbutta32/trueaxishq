import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { wasAcceptedByConfiguredSmtp } from "./_core/email";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");
const dashboardSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/Dashboard.tsx"), "utf8");
const proposalsSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/Proposals.tsx"), "utf8");

function section(startMarker: string, endMarker: string) {
  const start = routerSource.indexOf(startMarker);
  const end = routerSource.indexOf(endMarker, start);
  return routerSource.slice(start, end);
}

describe("manual client email delivery outcomes", () => {
  it("treats only configured SMTP acceptance as an external email outcome", () => {
    expect(wasAcceptedByConfiguredSmtp({ success: true, mode: "smtp" })).toBe(true);
    expect(wasAcceptedByConfiguredSmtp({ success: true, mode: "console" })).toBe(false);
    expect(wasAcceptedByConfiguredSmtp({ success: false, mode: "smtp" })).toBe(false);
  });

  it("keeps invoice reminder and receipt feedback tied to configured SMTP acceptance", () => {
    const reminder = section("sendReminder: protectedProcedure", "stats: protectedProcedure");
    const receipt = section("sendReceipt: protectedProcedure", "generatePayLink: protectedProcedure");

    expect(reminder).toContain("emailSent = wasAcceptedByConfiguredSmtp(result)");
    expect(reminder).toContain("return { success: true, subject, emailSent };");
    expect(receipt).toContain("emailSent: wasAcceptedByConfiguredSmtp(emailResult)");
    expect(dashboardSource).toContain("configured SMTP acceptance");
  });

  it("keeps a manual follow-up draft unless configured SMTP accepts the email and retains final owner scope", () => {
    const followUp = section("sendEmail: protectedProcedure", "}),\n  }),\n\n  // ── Email Templates");

    expect(followUp).toContain("const emailAccepted = wasAcceptedByConfiguredSmtp(emailResult)");
    expect(followUp).toContain("if (emailAccepted) {");
    expect(followUp).toContain("eq(followUps.userId, ctx.user.id)");
    expect(followUp).toContain("return { success: true, emailSent: emailAccepted };");
    expect(dashboardSource).toContain("Follow-up retained as a draft");
  });

  it("keeps a proposal draft without configured SMTP acceptance while retaining the owner-scoped review link", () => {
    const proposal = section("send: protectedProcedure\n      .input(z.object({ id: z.number().int(), origin:", "sign: publicProcedure");

    expect(proposal).toContain("let emailAccepted = false;");
    expect(proposal).toContain("emailAccepted = wasAcceptedByConfiguredSmtp(emailResult)");
    expect(proposal).toContain("if (emailAccepted) {");
    expect(proposal).toContain("eq(proposals.userId, ctx.user.id)");
    expect(proposal).toContain("return { success: true, link, emailAccepted };");
    expect(proposalsSource).toContain("Proposal remains draft");
  });
});
