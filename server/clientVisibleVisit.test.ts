import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("client-visible service visit coordination", () => {
  it("keeps visibility opt-in, owner-scoped, and limited to curated portal fields", () => {
    const schema = source("drizzle/schema.ts");
    const router = source("server/routers.ts");
    const portal = source("client/src/pages/ClientPortal.tsx");
    const dispatch = source("client/src/pages/DispatchBoard.tsx");
    const portalQuery = router.slice(router.indexOf("getJobs: publicProcedure"), router.indexOf("// ── Contracts & Proposals"));

    expect(schema).toContain('clientVisible: boolean("clientVisible").notNull().default(false)');
    expect(schema).toContain('clientUpdate: varchar("clientUpdate", { length: 500 })');
    expect(router).toContain("eq(serviceVisits.userId, ctx.user.id)");
    expect(router).toContain("clientVisible: z.boolean().default(false)");
    expect(router).toContain("clientUpdate: input.clientVisible ? input.clientUpdate ?? null : null");
    expect(router).toContain("const clientUpdate = clientVisible ?");
    expect(portalQuery).toContain("eq(serviceVisits.clientVisible, true)");
    expect(portalQuery).toContain("clientUpdate: serviceVisits.clientUpdate");
    expect(portalQuery).not.toContain("teamMemberId: serviceVisits.teamMemberId");
    expect(portalQuery).not.toContain("dispatchNote: serviceVisits.dispatchNote");
    expect(portal).toContain("It does not show live location, routing, or staff details.");
    expect(dispatch).toContain("Staff assignment and internal dispatch notes stay private.");
  });
});
