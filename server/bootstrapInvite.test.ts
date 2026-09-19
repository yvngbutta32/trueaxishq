import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");
const authSource = readFileSync(resolve(import.meta.dirname, "auth.ts"), "utf8");

const registerSection = () => {
  const start = routerSource.indexOf("register: publicProcedure");
  const end = routerSource.indexOf("login: publicProcedure", start);
  return routerSource.slice(start, end);
};

describe("first-run bootstrap registration", () => {
  it("creates the first owner account via BOOTSTRAP_INVITE_CODE when zero users exist", () => {
    const section = registerSection();
    expect(section).toContain("Number(userCount?.count ?? 0) === 0");
    expect(section).toContain('process.env.BOOTSTRAP_INVITE_CODE ?? ""');
    expect(section).toContain('role: "admin"');
    // The bootstrap branch must run before the invite-code machinery.
    expect(section.indexOf("First-run bootstrap")).toBeLessThan(section.indexOf("Validate invite code first"));
  });

  it("fails honestly when no bootstrap code is configured on an empty install", () => {
    const section = registerSection();
    expect(section).toContain("if (!bootstrapCode)");
    expect(section).toMatch(/No accounts exist yet\./);
    expect(section).toMatch(/must set BOOTSTRAP_INVITE_CODE in the server environment/);
  });

  it("does not consume an invite-code row and is single-use by construction", () => {
    const section = registerSection();
    // The bootstrap branch returns before the inviteCodes lookup/update.
    const bootstrapReturn = section.indexOf("return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } }");
    const inviteLookup = section.indexOf("db.select().from(inviteCodes)");
    expect(bootstrapReturn).toBeGreaterThan(-1);
    expect(bootstrapReturn).toBeLessThan(inviteLookup);
    // It only runs while the users table is empty.
    expect(section).toContain("}).from(users);");
  });

  it("registerUser accepts an optional owner role used only by the bootstrap", () => {
    expect(authSource).toContain('role?: "admin"');
    expect(authSource).toContain('role: data.role ?? "user"');
  });

  it("documents the bootstrap in .env.example and README", () => {
    const env = readFileSync(resolve(import.meta.dirname, "../.env.example"), "utf8");
    const readme = readFileSync(resolve(import.meta.dirname, "../README.md"), "utf8");
    expect(env).toContain("BOOTSTRAP_INVITE_CODE=");
    expect(readme).toContain("BOOTSTRAP_INVITE_CODE");
  });
});
