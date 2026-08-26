import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");

describe("booking upload session atomic consumption", () => {
  it("consumes a valid unconsumed booking session before client and booking side effects", () => {
    const start = routerSource.indexOf("submit: publicProcedure", routerSource.indexOf("booking: router({"));
    const end = routerSource.indexOf("  }),\n\n  // ── Client Portal", start);
    const section = routerSource.slice(start, end);
    expect(section).toContain("const consumeResult = await db.update(publicPhotoUploadSessions)");
    expect(section).toContain('eq(publicPhotoUploadSessions.purpose, "booking")');
    expect(section).toContain("isNull(publicPhotoUploadSessions.consumedAt)");
    expect(section).toContain("if (!consumeResult[0].affectedRows)");
    expect(section.indexOf("const consumeResult")).toBeLessThan(section.indexOf("// ── Conflict detection"));
    expect(section.indexOf("const consumeResult")).toBeLessThan(section.indexOf("tx.insert(bookings).values"));
  });
});
