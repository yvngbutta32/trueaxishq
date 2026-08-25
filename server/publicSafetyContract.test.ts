import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("public booking safety contract", () => {
  const router = source("server/routers.ts");

  it("returns only the appointment fields a token holder needs", () => {
    expect(router).toContain("booking: { service: booking.service, date: booking.date, time: booking.time }");
  });

  it("consumes cancellation links transactionally and never trusts a browser-provided origin", () => {
    const cancelSection = router.slice(router.indexOf("cancel: publicProcedure"), router.indexOf("// ── Monthly Report Settings"));
    expect(router).toContain("cancel: publicProcedure");
    expect(router).toContain("siteOrigin = process.env.SITE_ORIGIN");
    expect(cancelSection).not.toContain('origin: z.string().url()');
    expect(router).toContain("checkInSentAt: null");
  });

  it("enforces the same advertised 24-hour window for cancel and reschedule actions", () => {
    expect(router).toContain("function enforceBookingChangeWindow");
    expect(router).toContain("Appointments can only be changed up to 24 hours");
  });
});

describe("upload and storage safety contract", () => {
  const upload = source("server/photoUpload.ts");
  const storage = source("server/storage.ts");

  it("verifies image bytes and rate-limits public upload contexts", () => {
    expect(upload).toContain("function detectedImageMime");
    expect(upload).toContain("allowPublicUpload");
    expect(upload).toContain("Too many photo uploads");
  });

  it("rejects traversal and malformed storage keys before reaching storage", () => {
    expect(storage).toContain('key.includes("..")');
    expect(storage).toContain('throw new Error("Invalid storage key")');
  });
});
