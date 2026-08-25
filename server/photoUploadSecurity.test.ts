import { describe, expect, it } from "vitest";
import {
  PUBLIC_UPLOAD_TOKEN_BYTES,
  createPublicUploadToken,
  getPublicUploadKeyPrefix,
  hashPublicUploadToken,
  isOwnerPhotoKeyForType,
  isPublicUploadKeyForSession,
} from "./photoUploadSecurity";

describe("public photo upload security helpers", () => {
  it("creates a cryptographically sized opaque token and deterministic hash", () => {
    const token = createPublicUploadToken();
    expect(token).toMatch(/^[a-f0-9]+$/);
    expect(token).toHaveLength(PUBLIC_UPLOAD_TOKEN_BYTES * 2);
    expect(hashPublicUploadToken(token)).toHaveLength(64);
    expect(hashPublicUploadToken(token)).toBe(hashPublicUploadToken(token));
  });

  it("accepts only a client upload stored beneath its exact owner and session prefix", () => {
    const prefix = getPublicUploadKeyPrefix(42, 7);
    expect(isPublicUploadKeyForSession(`${prefix}abc123.jpg`, 42, 7)).toBe(true);
    expect(isPublicUploadKeyForSession("job-photos/client-uploads/42/8/abc123.jpg", 42, 7)).toBe(false);
    expect(isPublicUploadKeyForSession(`${prefix}abc123.jpg`, 41, 7)).toBe(false);
  });

  it("requires an owner receipt path before receipt AI work can proceed", () => {
    expect(isOwnerPhotoKeyForType("job-photos/42/receipt/receipt.jpg", 42, "receipt")).toBe(true);
    expect(isOwnerPhotoKeyForType("job-photos/42/wip/receipt.jpg", 42, "receipt")).toBe(false);
    expect(isOwnerPhotoKeyForType("job-photos/99/receipt/receipt.jpg", 42, "receipt")).toBe(false);
  });
});
