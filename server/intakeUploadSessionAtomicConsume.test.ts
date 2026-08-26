import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");

describe("intake upload session atomic consumption", () => {
  it("consumes a valid unconsumed intake session before creating the response and photo side effects", () => {
    const start = routerSource.indexOf("submitResponse: publicProcedure");
    const end = routerSource.indexOf("  }),\n\n  // ── Revenue Goals", start);
    const section = routerSource.slice(start, end);
    expect(section).toContain("const consumeResult = await db.update(publicPhotoUploadSessions)");
    expect(section).toContain("isNull(publicPhotoUploadSessions.consumedAt)");
    expect(section).toContain("gt(publicPhotoUploadSessions.expiresAt, new Date())");
    expect(section).toContain("if (!consumeResult[0].affectedRows)");
    expect(section.indexOf("const consumeResult")).toBeLessThan(section.indexOf("await db.insert(intakeResponses).values"));
    expect(section.indexOf("const consumeResult")).toBeLessThan(section.indexOf("await db.insert(jobPhotos).values"));
  });
});
