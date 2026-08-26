import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");

describe("public portal message projection", () => {
  it("returns only message fields rendered by the token-scoped portal", () => {
    const start = routerSource.indexOf("listForPortal: publicProcedure");
    const end = routerSource.indexOf("  // ── Follow-Up Sequence Rules", start);
    const section = routerSource.slice(start, end);
    expect(section).toContain("return db.select({");
    expect(section).toContain("senderRole: portalMessages.senderRole");
    expect(section).toContain("createdAt: portalMessages.createdAt");
    expect(section).not.toContain("return db.select().from(portalMessages)");
    expect(section).not.toContain("userId: portalMessages.userId");
    expect(section).not.toContain("clientId: portalMessages.clientId");
    expect(section).not.toContain("read: portalMessages.read");
  });
});
