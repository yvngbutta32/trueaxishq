import crypto from "crypto";

export const PUBLIC_UPLOAD_TOKEN_BYTES = 32;
export const PUBLIC_UPLOAD_MAX_FILES = 5;
export const PUBLIC_UPLOAD_TTL_MS = 30 * 60 * 1000;

export function createPublicUploadToken(): string {
  return crypto.randomBytes(PUBLIC_UPLOAD_TOKEN_BYTES).toString("hex");
}

export function hashPublicUploadToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function getPublicUploadKeyPrefix(userId: number, sessionId: number): string {
  return `job-photos/client-uploads/${userId}/${sessionId}/`;
}

export function isPublicUploadKeyForSession(key: string, userId: number, sessionId: number): boolean {
  return key.startsWith(getPublicUploadKeyPrefix(userId, sessionId));
}

export function isOwnerPhotoKeyForType(key: string, userId: number, photoType: "estimate" | "wip" | "finished" | "receipt"): boolean {
  return key.startsWith(`job-photos/${userId}/${photoType}/`);
}
