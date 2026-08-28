import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("database-backed local sessions", () => {
  const auth = read("server/auth.ts");
  const router = read("server/routers.ts");
  const admin = read("client/src/pages/Admin.tsx");

  it("stores only a hash and rejects revoked or missing session records", () => {
    expect(auth).toContain('createHash("sha256").update(token).digest("hex")');
    expect(auth).toContain("await db.insert(userSessions).values");
    expect(auth).toContain("eq(userSessions.isActive, true)");
    expect(auth).toContain("gt(userSessions.expiresAt, new Date())");
    expect(auth).toContain("Session has expired or been revoked");
  });

  it("records every issued local token and revokes the active token on logout", () => {
    expect((router.match(/await recordSession\(user\.id, token, ctx\.req\)/g) ?? []).length).toBe(3);
    expect(router).toContain('await revokeSession(token, "logout")');
  });

  it("provides a deliberate protected self-only all-device revocation action", () => {
    const authSection = router.slice(router.indexOf("auth: router({"), router.indexOf("// ── Contact Form"));

    expect(authSection).toContain("revokeAllSessions: protectedProcedure");
    expect(authSection).toContain("eq(userSessions.userId, ctx.user.id)");
    expect(authSection).toContain('invalidationReason: "owner_requested"');
    expect(authSection).toContain("ctx.res.clearCookie(COOKIE_NAME");
    expect(admin).toContain("trpc.auth.revokeAllSessions.useMutation");
    expect(admin).toContain("Sign out of all devices");
    expect(admin).toContain("This signs out every active session for this account");
  });
});
