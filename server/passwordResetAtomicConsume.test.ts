import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");

describe("password reset token consumption", () => {
  it("claims a still-valid unused token atomically before changing the account password", () => {
    const resetStart = routerSource.indexOf("resetPassword: publicProcedure");
    const changeStart = routerSource.indexOf("changePassword: protectedProcedure", resetStart);
    const resetSection = routerSource.slice(resetStart, changeStart);
    expect(resetSection).toContain("const consumeResult = await db.update(passwordResetTokens)");
    expect(resetSection).toContain("eq(passwordResetTokens.used, false)");
    expect(resetSection).toContain("gt(passwordResetTokens.expiresAt, new Date())");
    expect(resetSection).toContain("if (!consumeResult[0].affectedRows)");
    expect(resetSection.indexOf("const consumeResult")).toBeLessThan(resetSection.indexOf("const newHash = await hashPassword"));
  });
});
