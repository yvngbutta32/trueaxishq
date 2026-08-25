import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getLoginUrl } from "../client/src/const";

describe("self-contained authentication contract", () => {
  it("uses the local login route for all unauthenticated redirects", () => {
    expect(getLoginUrl()).toBe("/login");
    expect(getLoginUrl("/dashboard?panel=clients")).toBe("/login?return=%2Fdashboard%3Fpanel%3Dclients");
  });

  it("does not retain legacy OAuth callback or SDK modules", () => {
    expect(existsSync("server/_core/oauth.ts")).toBe(false);
    expect(existsSync("server/_core/sdk.ts")).toBe(false);
  });
});
