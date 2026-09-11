import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");

describe("public intake form projection", () => {
  it("keeps the owner identifier server-side while returning only client-safe form fields", () => {
    const start = routerSource.indexOf("getPublicForm: publicProcedure");
    const end = routerSource.indexOf("submitResponse: publicProcedure", start);
    const section = routerSource.slice(start, end);
    expect(section).toContain("userId: intakeForms.userId");
    expect(section).toContain("from(users).where(eq(users.id, form.userId))");
    expect(section).toContain("id: form.id,");
    expect(section).not.toContain("return { ...form");
    expect(section).not.toContain("userId: form.userId,");
    expect(section).not.toContain("active: form.active,");
  });
});
