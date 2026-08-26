import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("client document portal sharing", () => {
  it("defaults documents to private and requires an owner-scoped explicit visibility change", () => {
    const schema = source("drizzle/schema.ts");
    const router = source("server/routers.ts");
    const documentRouter = router.slice(router.indexOf("documents: router({"), router.indexOf("// ── Recurring Invoices"));

    expect(schema).toContain('clientVisible: boolean("clientVisible").default(false).notNull()');
    expect(schema).toContain('index("clientDocuments_owner_visible_idx").on(t.userId, t.clientVisible)');
    expect(documentRouter).toContain("setClientVisibility: protectedProcedure");
    expect(documentRouter).toContain("eq(clientDocuments.userId, ctx.user.id)");
    expect(documentRouter).toContain("eq(clientDocuments.clientId, document.clientId)");
  });

  it("returns only explicitly shared client-safe document metadata through the active portal token", () => {
    const router = source("server/routers.ts");
    const portalDocuments = router.slice(router.indexOf("getDocuments: publicProcedure"), router.indexOf("getJobs: publicProcedure"));

    expect(portalDocuments).toContain("eq(clientDocuments.userId, portalRecord.userId)");
    expect(portalDocuments).toContain("eq(clientDocuments.clientId, portalRecord.clientId)");
    expect(portalDocuments).toContain("eq(clientDocuments.clientVisible, true)");
    expect(portalDocuments).toContain("fileName: clientDocuments.fileName");
    expect(portalDocuments).not.toContain("fileKey: clientDocuments.fileKey");
  });

  it("keeps visibility in owner control and explains the private-by-default portal boundary", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");
    const portal = source("client/src/pages/ClientPortal.tsx");

    expect(dashboard).toContain("setDocumentVisibility");
    expect(dashboard).toContain('doc.clientVisible ? "Shared" : "Private"');
    expect(portal).toContain("Shared documents");
    expect(portal).toContain("Only documents your provider explicitly shares appear here.");
    expect(portal).toContain("Internal documents and operational notes remain private.");
  });
});
