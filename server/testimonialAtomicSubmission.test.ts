import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");

describe("testimonial token submission", () => {
  it("uses a final requested-status predicate before sending owner-facing side effects", () => {
    const submitStart = routerSource.indexOf("submit: publicProcedure", routerSource.indexOf("testimonials: router({"));
    const getStart = routerSource.indexOf("getByToken: publicProcedure", submitStart);
    const section = routerSource.slice(submitStart, getStart);
    expect(section).toContain("const submissionResult = await db.update(testimonials)");
    expect(section).toContain('eq(testimonials.status, "requested")');
    expect(section).toContain("if (!submissionResult[0].affectedRows)");
    expect(section.indexOf("const submissionResult")).toBeLessThan(section.indexOf("New Testimonial from"));
  });
});
