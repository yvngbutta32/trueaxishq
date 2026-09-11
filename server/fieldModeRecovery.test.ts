import { describe, expect, it } from "vitest";
import { fieldModeDraftKey, getFieldModeConnectivityMessage, isRetryableFieldError, readFieldModeStatusQueue, writeFieldModeStatusQueue } from "../shared/fieldModeRecovery";

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

  it("persists only bounded, valid offline status changes", () => {
    let value: string | null = JSON.stringify([
      { jobId: 42, status: "in_progress", expectedStatus: "scheduled", queuedAt: "2026-09-11T16:00:00.000Z" },
      { jobId: "bad", status: "completed", queuedAt: "invalid" },
    ]);
    const storage = {
      getItem: () => value,
      setItem: (_key: string, next: string) => { value = next; },
    };
    expect(readFieldModeStatusQueue(storage)).toHaveLength(1);
    writeFieldModeStatusQueue(storage, Array.from({ length: 25 }, (_, index) => ({ jobId: index + 1, status: "completed" as const, expectedStatus: "in_progress" as const, queuedAt: "2026-09-11T16:00:00.000Z" })));
    expect(readFieldModeStatusQueue(storage)).toHaveLength(20);
    expect(readFieldModeStatusQueue(storage)[0]?.jobId).toBe(6);
  });

  it("migrates older queued statuses to safe expected stages instead of dropping them", () => {
    const storage = { getItem: () => JSON.stringify([
      { jobId: 7, status: "in_progress", queuedAt: "2026-09-11T16:00:00.000Z" },
      { jobId: 8, status: "completed", queuedAt: "2026-09-11T16:01:00.000Z" },
    ]) };
    expect(readFieldModeStatusQueue(storage)).toMatchObject([
      { jobId: 7, expectedStatus: "scheduled" },
      { jobId: 8, expectedStatus: "in_progress" },
    ]);
  });
});
