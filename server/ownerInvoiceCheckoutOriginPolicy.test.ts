import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");

describe("owner invoice Checkout return origin policy", () => {
  it("uses a trusted return origin before passing owner invoice URLs to Stripe", () => {
    const start = routerSource.indexOf("payNow: protectedProcedure");
    const end = routerSource.indexOf("duplicate: protectedProcedure", start);
    const section = routerSource.slice(start, end);
    expect(section).toContain("const requestedOrigin = input.origin || ctx.req.headers.origin || process.env.SITE_ORIGIN || \"https://trueaxishq.com\"");
    expect(section).toContain("const origin = getTrustedPaymentReturnOrigin(requestedOrigin)");
    expect(section).toContain("Use an official TrueAxis HQ origin to continue to Checkout.");
    expect(section).not.toContain("const origin = input.origin ||");
  });
});
