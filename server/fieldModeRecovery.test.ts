import { describe, expect, it } from "vitest";
import { fieldModeDraftKey, getFieldModeConnectivityMessage, isRetryableFieldError } from "../shared/fieldModeRecovery";

describe("Field Mode recovery policy", () => {
  it("uses a user-device-safe draft key per job", () => {
    expect(fieldModeDraftKey(42)).toBe("trueaxis-field-session-draft:42");
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
