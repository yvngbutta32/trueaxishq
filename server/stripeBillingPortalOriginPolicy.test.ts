import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");

describe("Stripe billing portal return origin policy", () => {
  it("rejects untrusted return origins before opening a customer billing portal", () => {
    const start = routerSource.indexOf("createPortal: protectedProcedure");
    const end = routerSource.indexOf("verifyCheckoutSession: protectedProcedure", start);
    const section = routerSource.slice(start, end);
    expect(section).toContain("const returnOrigin = getTrustedPaymentReturnOrigin(input.origin)");
    expect(section).toContain("Use the official TrueAxis HQ billing portal to continue.");
    expect(section).toContain("return_url: `${returnOrigin}/dashboard`");
    expect(section).not.toContain("return_url: `${input.origin}/dashboard`");
  });
});
