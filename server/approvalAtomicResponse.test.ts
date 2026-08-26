import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");

describe("client approval atomic response", () => {
  it("requires the pending-state transition to succeed before writing client-response activity", () => {
    const start = routerSource.indexOf("respondToApproval: publicProcedure");
    const end = routerSource.indexOf("  }),\n  // ── Contracts", start);
    const section = routerSource.slice(start, end);
    expect(section).toContain("const approvalUpdate = await db.update(clientApprovalRequests)");
    expect(section).toContain('eq(clientApprovalRequests.status, "pending")');
    expect(section).toContain("if (!approvalUpdate[0].affectedRows)");
    expect(section.indexOf("if (!approvalUpdate[0].affectedRows)")).toBeLessThan(section.indexOf("await db.insert(jobActivities).values"));
  });
});
