import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");

describe("proposal delivery origin policy", () => {
  it("requires a trusted app origin before emailing a credential-bearing proposal link", () => {
    const start = routerSource.indexOf("send: protectedProcedure", routerSource.indexOf("proposals: router({"));
    const end = routerSource.indexOf("sign: publicProcedure", start);
    const section = routerSource.slice(start, end);
    expect(section).toContain("const requestedOrigin = input.origin || ctx.req.headers.origin || process.env.SITE_ORIGIN || \"https://trueaxishq.com\"");
    expect(section).toContain("const origin = getTrustedPaymentReturnOrigin(requestedOrigin)");
    expect(section).toContain("Use an official TrueAxis HQ origin to send a proposal.");
    expect(section).toContain("const link = `${origin}/proposal/${row.token}`");
    expect(section).not.toContain('const origin = input.origin || ctx.req.headers.origin || "https://trueaxis-hq.manus.space"');
  });
});
