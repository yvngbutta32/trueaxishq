import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");

describe("invite-code registration claim", () => {
  it("uses a final atomic predicate before creating an account", () => {
    const registerStart = routerSource.indexOf("register: publicProcedure");
    const loginStart = routerSource.indexOf("login: publicProcedure", registerStart);
    const registerSection = routerSource.slice(registerStart, loginStart);
    expect(registerSection).toContain("const claimResult = await db.update(inviteCodes)");
    expect(registerSection).toContain("isNull(inviteCodes.usedAt)");
    expect(registerSection).toContain("eq(inviteCodes.revoked, false)");
    expect(registerSection).toContain("gt(inviteCodes.expiresAt, claimTime)");
    expect(registerSection).toContain("if (!claimResult[0].affectedRows)");
    expect(registerSection.indexOf("const claimResult")).toBeLessThan(registerSection.indexOf("await registerUser"));
  });

  it("releases only a tentative unassigned claim when account creation fails", () => {
    const registerStart = routerSource.indexOf("register: publicProcedure");
    const loginStart = routerSource.indexOf("login: publicProcedure", registerStart);
    const registerSection = routerSource.slice(registerStart, loginStart);
    expect(registerSection).toContain("set({ usedAt: null })");
    expect(registerSection).toContain("isNull(inviteCodes.usedBy)");
    expect(registerSection).toContain("set({ usedBy: user.id })");
  });
});
