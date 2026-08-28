import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/AdminLogin.tsx"), "utf8");

describe("Admin sign-in password visibility accessibility", () => {
  it("keeps the password visibility button in normal keyboard order with a clear label", () => {
    const passwordSection = source.slice(source.indexOf('type={showPassword ? "text" : "password"}'), source.indexOf('type="submit"'));

    expect(passwordSection).toContain('type="button"');
    expect(passwordSection).toContain('aria-label={showPassword ? "Hide password" : "Show password"}');
    expect(passwordSection).not.toContain("tabIndex={-1}");
  });
});
