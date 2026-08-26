import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");

describe("testimonial request origin policy", () => {
  it("uses the trusted origin policy before placing a testimonial token in an email link", () => {
    const start = routerSource.indexOf("request: protectedProcedure", routerSource.indexOf("testimonials: router({"));
    const end = routerSource.indexOf("submit: publicProcedure", start);
    const section = routerSource.slice(start, end);
    expect(section).toContain("const trustedOrigin = getTrustedPaymentReturnOrigin(input.origin)");
    expect(section).toContain("Use an official TrueAxis HQ origin");
    expect(section).toContain("`${trustedOrigin}/testimonial/${token}`");
    expect(section).not.toContain("`${input.origin}/testimonial/${token}`");
  });
});
