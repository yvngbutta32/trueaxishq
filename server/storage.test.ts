import { describe, expect, it } from "vitest";
import { getUploadPath, normalizeKey, storageGet } from "./storage";

describe("local upload storage", () => {
  it("rejects traversal and malformed keys", () => {
    expect(() => normalizeKey("../secret.txt")).toThrow("Invalid storage key");
    expect(() => normalizeKey("nested/../../secret.txt")).toThrow("Invalid storage key");
    expect(() => normalizeKey("nested//file.txt")).toThrow("Invalid storage key");
  });

  it("resolves valid keys beneath the configured upload directory", async () => {
    const path = getUploadPath("avatars/user.png");
    expect(path).toContain("uploads");
    expect(path.endsWith("\\avatars\\user.png") || path.endsWith("/avatars/user.png")).toBe(true);
    await expect(storageGet("avatars/user.png")).resolves.toEqual({
      key: "avatars/user.png",
      url: "/uploads/avatars/user.png",
    });
  });
});
