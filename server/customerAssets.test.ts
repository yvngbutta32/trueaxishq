import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("customer asset foundation", () => {
  it("persists an owner-scoped client asset model with bounded private fields", () => {
    const schema = source("drizzle/schema.ts");
    expect(schema).toContain('customerAssets = mysqlTable("customerAssets"');
    expect(schema).toContain('index("customerAssets_owner_client_idx").on(t.userId, t.clientId)');
    expect(schema).toContain('functionalLocation: varchar("functionalLocation", { length: 255 })');
  });

  it("requires final owner client scope for list and creation and keeps assets out of portal routes", () => {
    const router = source("server/routers.ts");
    const workspace = source("client/src/pages/JobWorkspace.tsx");
    const assetRouter = router.slice(router.indexOf("customerAssets: router({"), router.indexOf("// ── Invoices"));
    const portalStart = router.indexOf("portal: router({");
    const portalRouter = router.slice(portalStart);
    expect(assetRouter).toContain("eq(clients.id, input.clientId), eq(clients.userId, ctx.user.id)");
    expect(assetRouter).toContain("eq(customerAssets.userId, ctx.user.id)");
    expect(assetRouter).toContain("db.insert(customerAssets).values({ userId: ctx.user.id");
    expect(portalRouter).not.toContain("customerAssets");
    expect(workspace).toContain("trpc.customerAssets.list.useQuery");
    expect(workspace).toContain("trpc.customerAssets.create.useMutation");
    expect(workspace).toContain("Private customer asset added");
    expect(workspace).toContain("Asset details and locations do not appear in the client portal.");
  });
});
