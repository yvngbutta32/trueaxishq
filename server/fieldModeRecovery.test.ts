import { describe, expect, it } from "vitest";
import { fieldModeDraftKey, getFieldModeConnectivityMessage, isRetryableFieldError, loadFieldModeDraft, randomRequestId, saveFieldModeDraft } from "../shared/fieldModeRecovery";

describe("Field Mode recovery policy", () => {
  it("generates collision-safe client request ids for offline replay idempotency", () => {
    const first = randomRequestId("update");
    const second = randomRequestId("update");
    expect(first).not.toBe(second);
    expect(first.startsWith("update-")).toBe(true);
    expect(first.length).toBeLessThanOrEqual(64);
  });

  it("persists drafts through storage failures without throwing", () => {
    expect(loadFieldModeDraft(42)).toBe("");
    expect(() => saveFieldModeDraft(42, "")).not.toThrow();
    expect(() => saveFieldModeDraft(42, "Half-done note")).not.toThrow();
  });

  it("uses a user-device-safe draft key per job", () => {
    expect(fieldModeDraftKey(42)).toBe("trueaxis-field-draft:42");
    expect(fieldModeDraftKey(43)).not.toBe(fieldModeDraftKey(42));
  });

  it("makes offline limits explicit without pretending changes were sent", () => {
    expect(getFieldModeConnectivityMessage(false)).toContain("offline");
    expect(getFieldModeConnectivityMessage(true)).toBeNull();
  });

  it("offers retry only for plausibly transient transport failures", () => {
    expect(isRetryableFieldError(new Error("Failed to fetch"))).toBe(true);
    expect(isRetryableFieldError(new Error("Temporary network timeout"))).toBe(true);
    expect(isRetryableFieldError(new Error("Photo must be 16 MB or smaller."))).toBe(false);
  });
});
