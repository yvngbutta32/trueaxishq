import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Live interactive QA (Oct 24 2026) exposed a real defect chain: seeded jobs
 * referenced clientIds owned by other users or by nobody. jobs.list joined
 * clients by id ONLY — a corrupt or imported row could surface another
 * tenant's client name, and Job Photos 404'd on customerAssets.list. Also,
 * clients.delete removed a client while its jobs remained, creating exactly
 * those dangling rows.
 *
 * These contracts pin the fixes: tenant-safe joins, a delete guard when jobs
 * exist, and cleanup of dependent rows when deletion is allowed.
 */

const routers = readFileSync("server/routers.ts", "utf8");

describe("client references stay tenant-safe and never dangle", () => {
  it("jobs.list joins clients with an owner match, not id alone", () => {
    expect(routers).toContain(
      '.from(jobs).innerJoin(clients, and(eq(jobs.clientId, clients.id), eq(clients.userId, ctx.user.id)))',
    );
    expect(routers).not.toContain(".from(jobs).innerJoin(clients, eq(jobs.clientId, clients.id))");
  });

  it("actionCards joins are tenant-safe too", () => {
    expect(routers).toContain(".leftJoin(clients, and(eq(jobs.clientId, clients.id), eq(clients.userId, ctx.user.id)))");
    expect(routers).not.toContain(".leftJoin(clients, eq(jobs.clientId, clients.id))");
  });

  it("clients.delete blocks when the client still has jobs", () => {
    const deleteRouter = routers.slice(
      routers.indexOf("    delete: protectedProcedure", routers.indexOf("clients: router({")),
      routers.indexOf("importCsv: protectedProcedure", routers.indexOf("clients: router({")),
    );
    expect(deleteRouter).toContain("COUNT(*)");
    expect(deleteRouter).toContain("jobs.clientId, input.id");
    expect(deleteRouter).toMatch(/job\$\{jobCount\.count === 1 \? "" : "s"\}/);
    expect(deleteRouter).toContain("BAD_REQUEST");
  });

  it("clients.delete cleans up dependent rows (assets, documents, custom fields, portal tokens)", () => {
    const deleteRouter = routers.slice(
      routers.indexOf("    delete: protectedProcedure", routers.indexOf("clients: router({")),
      routers.indexOf("importCsv: protectedProcedure", routers.indexOf("clients: router({")),
    );
    for (const table of ["customerAssets", "clientDocuments", "clientCustomFieldValues", "clientPortalTokens"]) {
      expect(deleteRouter).toContain(`db.delete(${table})`);
    }
    // every dependent-row delete stays scoped to the owner
    expect(deleteRouter.match(/eq\((customerAssets|clientDocuments|clientCustomFieldValues|clientPortalTokens)\.userId, ctx\.user\.id\)/g)?.length ?? 0).toBe(4);
  });
});
