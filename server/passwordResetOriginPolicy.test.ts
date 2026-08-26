import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getTrustedPaymentReturnOrigin } from "./paymentReturnOrigin";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");

describe("password reset origin policy", () => {
  it("accepts only the existing trusted application-origin policy", () => {
    expect(getTrustedPaymentReturnOrigin("https://trueaxishq.com")).toBe("https://trueaxishq.com");
    expect(getTrustedPaymentReturnOrigin("https://www.trueaxishq.com")).toBe("https://www.trueaxishq.com");
    expect(getTrustedPaymentReturnOrigin("https://attacker.example")).toBeNull();
    expect(getTrustedPaymentReturnOrigin("https://trueaxishq.com/reset-password")).toBeNull();
  });

  it("does not reflect a caller-controlled reset-link origin into email", () => {
    const resetStart = routerSource.indexOf("forgotPassword: publicProcedure");
    const resetEnd = routerSource.indexOf("resetPassword: publicProcedure", resetStart);
    const resetSection = routerSource.slice(resetStart, resetEnd);
    expect(resetSection).toContain("getTrustedPaymentReturnOrigin(requestedOrigin)");
    expect(resetSection).toContain('?? "https://trueaxishq.com"');
    expect(resetSection).not.toContain("const origin = input.origin ||");
  });
});
