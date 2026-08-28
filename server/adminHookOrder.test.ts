import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Admin.tsx"), "utf8");

describe("Admin hook order", () => {
  it("runs access-control navigation setup before the loading return", () => {
    const accessEffect = source.indexOf("// Redirect to admin login if not authenticated or not owner");
    const loadingReturn = source.indexOf("if (loading) {");

    expect(accessEffect).toBeGreaterThanOrEqual(0);
    expect(loadingReturn).toBeGreaterThanOrEqual(0);
    expect(accessEffect).toBeLessThan(loadingReturn);
  });
});
