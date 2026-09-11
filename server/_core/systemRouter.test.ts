import { describe, expect, it } from "vitest";
import { configurationStatus } from "./systemRouter";

describe("system configuration status", () => {
  it("reports configured providers without claiming runtime availability", () => {
    expect(configurationStatus(true)).toBe("configured");
    expect(configurationStatus(false)).toBe("not_configured");
  });
});
