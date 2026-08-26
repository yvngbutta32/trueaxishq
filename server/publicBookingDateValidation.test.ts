import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");

describe("public booking date validation", () => {
  it("requires an ISO calendar date and rejects dates before the server-side current UTC date", () => {
    const start = routerSource.indexOf("submit: publicProcedure", routerSource.indexOf("booking: router({"));
    const end = routerSource.indexOf("  }),\n\n  // ─── Client Pulse", start);
    const section = routerSource.slice(start, end);
    expect(section).toContain("preferredDate: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/)");
    expect(section).toContain("if (input.preferredDate < new Date().toISOString().slice(0, 10))");
    expect(section).toContain("Choose a future appointment date.");
  });
});
