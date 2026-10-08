import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  SMS_INCLUDED_MONTHLY,
  VOICE_LINE_MINUTES,
  smsIncludedFor,
} from "../shared/plans";
import { decideSmsAllowance, smsUpgradeMessage } from "./_core/smsMeter";

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("bundled SMS fair-use metering", () => {
  it("allowances: free keeps notifications working, caps grow with plan and stay profitable", () => {
    expect(SMS_INCLUDED_MONTHLY.free).toBe(50); // one-way transactional notifications still work on Free
    expect(SMS_INCLUDED_MONTHLY.starter).toBe(500);
    expect(SMS_INCLUDED_MONTHLY.pro).toBe(2000);
    expect(SMS_INCLUDED_MONTHLY.agency).toBe(5000);
    // Monotonic with price
    expect(SMS_INCLUDED_MONTHLY.starter).toBeGreaterThan(SMS_INCLUDED_MONTHLY.free);
    expect(SMS_INCLUDED_MONTHLY.pro).toBeGreaterThan(SMS_INCLUDED_MONTHLY.starter);
    expect(SMS_INCLUDED_MONTHLY.agency).toBeGreaterThan(SMS_INCLUDED_MONTHLY.pro);
    // At ~$0.008 base + ~$0.004 carrier surcharge per segment, a maxed-out allowance
    // must stay well below the plan's monthly price (margin floor)
    expect(SMS_INCLUDED_MONTHLY.starter * 0.012).toBeLessThan(49);
    expect(SMS_INCLUDED_MONTHLY.pro * 0.012).toBeLessThan(129);
    expect(SMS_INCLUDED_MONTHLY.agency * 0.012).toBeLessThan(299);
  });

  it("smsIncludedFor falls back to the Free allowance, never to unlimited", () => {
    expect(smsIncludedFor(null)).toBe(50);
    expect(smsIncludedFor(undefined)).toBe(50);
    expect(smsIncludedFor("nonexistent")).toBe(50);
    expect(smsIncludedFor("PRO")).toBe(2000);
    expect(smsIncludedFor("Agency")).toBe(5000);
  });

  it("allowance decision is a strict `<` boundary", () => {
    expect(decideSmsAllowance(0, 50).allowed).toBe(true);
    expect(decideSmsAllowance(49, 50).allowed).toBe(true);
    expect(decideSmsAllowance(50, 50).allowed).toBe(false); // cap reached = refuse, never over-deliver
    expect(decideSmsAllowance(5000, 2000).allowed).toBe(false);
  });

  it("refusal messages are honest and point at the upgrade path", () => {
    const freeMsg = smsUpgradeMessage(50);
    expect(freeMsg).toContain("50 messages");
    expect(freeMsg).toContain("Settings → Billing");
    const proMsg = smsUpgradeMessage(2000);
    expect(proMsg).toContain("2,000 messages");
    expect(proMsg).toContain("start of next month");
  });

  it("SMS and voice are separate buckets by design (voice minutes cost ~10x one SMS)", () => {
    expect(VOICE_LINE_MINUTES.pro).toBe(1000); // minutes, not messages
    expect(SMS_INCLUDED_MONTHLY.pro).toBe(2000); // messages, not minutes
  });

  it("contract: every platform-cost SMS call site is metered; only the login-code path is exempt", () => {
    const routers = source("./routers.ts");
    const jobs = source("./backgroundJobs.ts");
    // The only raw sendSms in routers is the SMS login code (security, never allowance-gated)
    const rawRouters = routers.match(/await sendSms\(\{/g) ?? [];
    expect(rawRouters.length).toBe(1);
    // The metered wrapper covers booking confirmations, invites, resends, and test sends
    const meteredRouters = routers.match(/sendMeteredSms\(db,/g) ?? [];
    expect(meteredRouters.length).toBe(4);
    // Reminders and check-ins in the background jobs are metered against the booking owner
    const meteredJobs = jobs.match(/sendMeteredSms\(db, booking\.userId,/g) ?? [];
    expect(meteredJobs.length).toBe(2);
    expect(jobs.includes("sendMeteredSms")).toBe(true);
  });

  it("contract: smsSends table stores no message bodies or recipient numbers (privacy)", () => {
    const schema = source("../drizzle/schema.ts");
    const tableMatch = schema.match(/export const smsSends = mysqlTable\("smsSends", \{[^}]*\}/);
    expect(tableMatch).toBeTruthy();
    expect(tableMatch![0]).toContain("kind");
    expect(tableMatch![0]).not.toMatch(/body|recipient|phone|content/i);
  });
});
