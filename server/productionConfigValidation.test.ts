import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "_core/env.ts"), "utf8");
const example = readFileSync(resolve(import.meta.dirname, "../.env.example"), "utf8");

describe("production launch configuration", () => {
  it("validates the raw production site origin instead of the localhost development fallback", () => {
    expect(source).toContain('["SITE_ORIGIN", process.env.SITE_ORIGIN ?? ""]');
  });

  it("documents both Docker database credentials", () => {
    expect(example).toContain("MYSQL_PASSWORD=");
    expect(example).toContain("MYSQL_ROOT_PASSWORD=");
  });
});
