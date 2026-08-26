import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "photoUpload.ts"), "utf8");

describe("public upload session quota reservation", () => {
  it("atomically reserves an available upload slot before storing public-session media", () => {
    const reserveStart = source.indexOf("const reservation = await db.update(publicPhotoUploadSessions)");
    const storageStart = source.indexOf("const { url } = await storagePut");
    expect(reserveStart).toBeGreaterThan(-1);
    expect(reserveStart).toBeLessThan(storageStart);
    expect(source).toContain("sql`${publicPhotoUploadSessions.uploadCount} < ${publicPhotoUploadSessions.maxUploads}`");
    expect(source).toContain("if (!reservation[0].affectedRows)");
    expect(source.slice(storageStart)).not.toContain("set({ uploadCount: sql`${publicPhotoUploadSessions.uploadCount} + 1` })");
  });
});
