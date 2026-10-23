import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression: the login page went into an infinite reload loop (Oct 23 audit).
 * Root cause was two interacting defects:
 *   1. Login.tsx queried sms.status, which the SMS fair-use metering work had
 *      made a protectedProcedure — an anonymous visitor got 401 "Please login".
 *   2. main.tsx's global 401 handler redirected to /login with no guard, so a
 *      401 ON the login page reloaded it, which re-issued the query, forever.
 * These tests pin the fix so neither half can silently regress.
 */
describe("login page auth-loop regression (public endpoints + redirect guard)", () => {
  const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

  it("Login.tsx only queries anonymous-safe endpoints", () => {
    const login = read("client/src/pages/Login.tsx");
    expect(login).toContain("trpc.sms.publicStatus.useQuery()");
    expect(login).not.toContain("trpc.sms.status.useQuery()");
  });

  it("the global 401 redirect never fires when already on the login page", () => {
    const main = read("client/src/main.tsx");
    const handler = main.slice(
      main.indexOf("const redirectToLoginIfUnauthorized"),
      main.indexOf("const isExpectedPublicRecoveryError"),
    );
    expect(handler).toContain("getLoginUrl()");
    // The guard: compare current pathname against the login URL BEFORE assigning.
    const guardIdx = handler.indexOf('window.location.pathname === getLoginUrl()');
    const redirectIdx = handler.indexOf("window.location.href = getLoginUrl()");
    expect(guardIdx).toBeGreaterThan(-1);
    expect(redirectIdx).toBeGreaterThan(guardIdx);
    expect(handler).toContain("return;");
  });
});
