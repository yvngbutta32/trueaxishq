import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("public completion copy trust boundary", () => {
  it("does not promise externally unverified response, receipt, or delivery outcomes", () => {
    const contact = source("client/src/pages/Contact.tsx");
    const bookingManage = source("client/src/pages/BookingCancel.tsx");
    const checkout = source("client/src/pages/CheckoutSuccess.tsx");
    const about = source("client/src/pages/About.tsx");
    const pricing = source("client/src/pages/Pricing.tsx");
    const register = source("client/src/pages/Register.tsx");
    const booking = source("client/src/pages/BookingPage.tsx");
    const home = source("client/src/pages/Home.tsx");
    const intake = source("client/src/pages/IntakeFormPage.tsx");

    expect(contact).not.toContain("within 4 business hours");
    expect(bookingManage).not.toContain("confirmation email shortly");
    expect(checkout).not.toContain("A receipt has been sent to your email");
    expect(checkout).not.toContain("about to run on autopilot");
    expect(checkout).toContain("your workspace is ready.");
    expect(about).not.toContain("4,200+");
    expect(about).not.toContain("34%");
    expect(pricing).not.toContain("Money-Back Guarantee");
    expect(pricing).not.toContain("SOC 2 Type II Certified");
    expect(pricing).not.toContain("4.9/5 on G2");
    expect(pricing).not.toContain("14-day free trial");
    expect(register).not.toContain("4,200+ freelancers");
    expect(register).not.toContain("12 hrs");
    expect(booking).not.toContain("confirmation has been sent");
    expect(booking).not.toContain("confirm your appointment shortly");
    expect(home).not.toContain("Check your inbox");
    expect(home).not.toContain("Auto-confirmation emails sent");
    expect(home).not.toContain("Invoices write themselves.");
    expect(home).not.toContain("retain your data for 30 days");
    expect(intake).not.toContain("We've sent a confirmation to your email.");
    expect(intake).not.toContain("We'll be in touch soon.");
  });
});
