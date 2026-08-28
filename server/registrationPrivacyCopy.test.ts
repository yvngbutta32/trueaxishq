import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const registerSource = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/Register.tsx"), "utf8");

describe("registration privacy copy", () => {
  it("directs prospective users to privacy information without an unsupported absolute data-practice claim", () => {
    expect(registerSource).toContain("Review how TrueAxis HQ handles account data in the Privacy Notice");
    expect(registerSource).not.toContain("We never sell it.");
  });
});
