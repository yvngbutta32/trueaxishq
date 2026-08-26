import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");

describe("client portal token URL origin policy", () => {
  it("requires a trusted application origin before returning a credential-bearing portal URL", () => {
    const start = routerSource.indexOf("getToken: protectedProcedure", routerSource.indexOf("portal: router({"));
    const end = routerSource.indexOf("view: publicProcedure", start);
    const section = routerSource.slice(start, end);
    expect(section).toContain("const requestedOrigin = input.origin || ctx.req.headers.origin || process.env.SITE_ORIGIN || \"https://trueaxishq.com\"");
    expect(section).toContain("const origin = getTrustedPaymentReturnOrigin(requestedOrigin)");
    expect(section).toContain("Use an official TrueAxis HQ origin to generate a client portal link.");
    expect(section).toContain("url: `${origin}/portal/${existing.token}`");
    expect(section).not.toContain('const origin = input.origin || ctx.req.headers.origin || ""');
  });
});
