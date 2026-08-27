import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/ForgotPassword.tsx"), "utf8");

describe("mobile account recovery accessibility", () => {
  it("keeps the homepage escape action visibly contrasted and keyboard focusable", () => {
    expect(source).toContain('color: "rgba(26,26,26,0.72)"');
    expect(source).toContain("focus-visible:ring-2 focus-visible:ring-[#D4922A]");
  });

  it("provides a touch-friendly recovery escape action", () => {
    expect(source).toContain("min-h-11");
    expect(source).toContain("Back to homepage");
  });
});
