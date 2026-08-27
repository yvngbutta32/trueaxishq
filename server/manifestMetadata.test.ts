import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("installable app manifest", () => {
  it("describes the verified service-business workflow without unsupported scope claims", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../client/public/manifest.json", import.meta.url), "utf8"),
    ) as { name: string; description: string; shortcuts: Array<{ url: string }> };

    expect(manifest.name).toBe("TrueAxis HQ");
    expect(manifest.description).toContain("service businesses");
    expect(manifest.description).toContain("scheduling");
    expect(manifest.description).not.toContain("offline");
    expect(manifest.shortcuts.map((shortcut) => shortcut.url)).toContain("/dashboard");
  });
});
