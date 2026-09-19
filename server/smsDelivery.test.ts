import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizePhoneToE164, getSmsDeliveryStatus, wasSmsAcceptedByConfiguredTwilio } from "./_core/sms";

describe("SMS phone normalization (E.164)", () => {
  it("normalizes US formatting to +1 E.164", () => {
    expect(normalizePhoneToE164("(512) 555-0100")).toBe("+15125550100");
    expect(normalizePhoneToE164("512-555-0100")).toBe("+15125550100");
    expect(normalizePhoneToE164("512.555.0100")).toBe("+15125550100");
    expect(normalizePhoneToE164("5125550100")).toBe("+15125550100");
    expect(normalizePhoneToE164("15125550100")).toBe("+15125550100");
    expect(normalizePhoneToE164("+15125550100")).toBe("+15125550100");
  });

  it("keeps explicit international numbers with a + prefix", () => {
    expect(normalizePhoneToE164("+4420794600958")).toBe("+4420794600958");
    expect(normalizePhoneToE164("+33612345678")).toBe("+33612345678");
  });

  it("rejects non-dialable junk instead of guessing", () => {
    expect(normalizePhoneToE164("555-0100")).toBeNull();
    expect(normalizePhoneToE164("hello")).toBeNull();
    expect(normalizePhoneToE164("")).toBeNull();
    expect(normalizePhoneToE164(null)).toBeNull();
    expect(normalizePhoneToE164(undefined)).toBeNull();
    // A bare international number without + would be misdialed as US — refuse it
    expect(normalizePhoneToE164("4420794600958")).toBeNull();
  });
});

describe("SMS delivery status (env-gated, like email)", () => {
  it("reports a status without throwing in this environment", () => {
    const status = getSmsDeliveryStatus();
    expect(status).toHaveProperty("configured");
    expect(status).toHaveProperty("from");
    expect(typeof status.configured).toBe("boolean");
  });

  it("mirrors the email acceptance contract for Twilio-mode results", () => {
    expect(wasSmsAcceptedByConfiguredTwilio({ success: true, id: "SM123", mode: "twilio" })).toBe(true);
    expect(wasSmsAcceptedByConfiguredTwilio({ success: true, id: "console", mode: "console" })).toBe(false);
    expect(wasSmsAcceptedByConfiguredTwilio({ success: false, id: "", mode: "twilio", error: "boom" })).toBe(false);
  });
});

describe("SMS booking confirmation consent boundary", () => {
  const source = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
  const bookingSubmit = source.slice(
    source.indexOf("submit: publicProcedure"),
    source.indexOf("// ── Job Workspace")
  );

  it("sends the confirmation SMS only after an explicit booking-form opt-in", () => {
    expect(bookingSubmit).toContain("if (smsTo && input.smsOptIn === true)");
    expect(bookingSubmit).toContain("sendSms({");
  });

  it("persists the opt-in on the client record and never silently revokes it", () => {
    expect(bookingSubmit).toContain("smsOptIn: input.smsOptIn === true");
    expect(bookingSubmit).toContain("input.smsOptIn === true ? { smsOptIn: true }");
  });

  it("stores the phone in E.164, not raw form input", () => {
    expect(bookingSubmit).toContain("normalizePhoneToE164(input.clientPhone) || null");
  });

  it("collects the opt-in on the public booking form, with rates/STOP disclosure", () => {
    const bookingPage = readFileSync(resolve(process.cwd(), "client/src/pages/BookingPage.tsx"), "utf8");
    expect(bookingPage).toContain('id="sms-opt-in"');
    expect(bookingPage).toContain("Message rates may apply");
    expect(bookingPage).toContain("reply STOP to opt out");
  });
});

describe("Twilio integration catalog truth", () => {
  it("advertises Twilio as provider-setup-required, not planned, now that SMS is built", () => {
    const catalog = readFileSync(resolve(process.cwd(), "shared/integrationCatalog.ts"), "utf8");
    expect(catalog).toContain("twilio:");
    expect(catalog).toContain('availability: "provider_setup_required"');
    // The description must gate the "live" claim on env vars being set
    expect(catalog).toContain("TWILIO_ACCOUNT_SID");
  });

  it("exposes an owner test-send endpoint, audit-logged, plus a delivery-status endpoint", () => {
    const source = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    expect(source).toContain("sms: router({");
    const smsRouter = source.slice(source.indexOf("sms: router({"), source.indexOf("integrations: router({"));
    expect(smsRouter).toContain("status: protectedProcedure.query");
    expect(smsRouter).toContain("sendTest: protectedProcedure");
    expect(smsRouter).toContain('action: "sms.test"');
  });

  it("gates every background-job SMS on the recorded opt-in, with STOP disclosure", () => {
    const jobs = readFileSync(resolve(process.cwd(), "server/backgroundJobs.ts"), "utf8");
    expect(jobs).toContain("booking.smsOptIn === 1 && smsTarget");
    expect(jobs).toContain("normalizePhoneToE164(booking.clientRecordPhone || booking.clientPhone)");
    expect(jobs).toContain("Reply STOP to opt out");
    // Send-marker integrity is untouched: email acceptance still gates reminderSentAt/checkInSentAt
    expect(jobs).toContain("if (wasAcceptedByConfiguredSmtp(emailResult))");
  });

  it("documents the Twilio env vars in .env.example", () => {
    const envExample = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
    expect(envExample).toContain("TWILIO_ACCOUNT_SID=");
    expect(envExample).toContain("TWILIO_AUTH_TOKEN=");
    expect(envExample).toContain("TWILIO_FROM_NUMBER=");
  });
});
