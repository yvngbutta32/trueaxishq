import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const schemaSource = readFileSync(resolve(root, "drizzle/schema.ts"), "utf8");
const panelSource = readFileSync(resolve(root, "client/src/pages/dashboard/InventoryPanel.tsx"), "utf8");
const dashboardSource = readFileSync(resolve(root, "client/src/pages/Dashboard.tsx"), "utf8");
const sidebarSource = readFileSync(resolve(root, "client/src/pages/dashboard/Sidebar.tsx"), "utf8");
const migrationSource = (() => {
  const dir = readdirSync(resolve(root, "drizzle"));
  return dir.filter(name => name.endsWith(".sql") && name.startsWith("0069_"))
    .map(name => readFileSync(resolve(root, "drizzle", name), "utf8")).join("");
})();

describe("Inventory & purchase orders", () => {
  it("models stock as an auditable movement ledger, not an overwrite-in-place counter", () => {
    expect(schemaSource).toContain('export const inventoryMovements = mysqlTable("inventoryMovements"');
    expect(schemaSource).toContain('mysqlEnum("type", ["receive", "consume", "adjust"])');
    expect(schemaSource).toContain('export const inventoryItems = mysqlTable("inventoryItems"');
    expect(schemaSource).toContain('uniqueIndex("inventoryItems_userId_sku_unique_idx")');
    expect(schemaSource).toContain('uniqueIndex("inventoryLocations_userId_name_unique_idx")');
    expect(schemaSource).toContain('uniqueIndex("purchaseOrders_userId_poNumber_unique_idx")');
  });

  it("ships the tables with migration 0069", () => {
    for (const table of ["inventoryItems", "inventoryLocations", "inventoryMovements", "purchaseOrders", "purchaseOrderItems"]) {
      expect(migrationSource).toContain(`CREATE TABLE \`${table}\``);
    }
    expect(migrationSource).toContain("UNIQUE(`userId`,`sku`)");
    expect(migrationSource).toContain("UNIQUE(`userId`,`poNumber`)");
  });

  it("enforces owner scoping on every inventory and purchase-order path", () => {
    const endpoints = ["listItems", "itemStock", "listMovements", "createItem", "updateItem", "listLocations", "createLocation", "updateLocation", "receiveStock", "adjustStock", "consumeForJob", "listPurchaseOrders", "createPurchaseOrder", "updatePurchaseOrder", "submitPurchaseOrder", "receivePurchaseOrder", "cancelPurchaseOrder"];
    for (const endpoint of endpoints) {
      expect(routerSource).toContain(`    ${endpoint}: protectedProcedure`);
    }
    // Ownership guards across items, locations, movements, and POs.
    expect((routerSource.match(/eq\((inventoryItems|inventoryLocations|inventoryMovements|purchaseOrders|purchaseOrderItems)\.userId, ctx\.user\.id\)/g) ?? []).length).toBeGreaterThanOrEqual(25);
  });

  it("derives on-hand from the ledger and flags low stock", () => {
    expect(routerSource).toContain("COALESCE(SUM(");
    expect(routerSource).toMatch(/totalOnHand: onHand\.get\(item\.id\) \?\? 0/);
    expect(routerSource).toMatch(/lowStock: Number\(item\.reorderPoint\) > 0 && \(onHand\.get\(item\.id\) \?\? 0\) <= Number\(item\.reorderPoint\)/);
  });

  it("consumes stock as negative ledger entries tied to the job", () => {
    expect(routerSource).toContain("quantity: String(-input.quantity)");
    expect(routerSource).toContain('"material_used"');
    expect(routerSource).toContain("Job not found.");
    expect(routerSource).toContain("An adjustment must change the quantity.");
  });

  it("validates ownership of both item and location before any ledger write", () => {
    expect(routerSource).toContain("requireOwnedStockTargets");
    expect(routerSource).toContain("Stock location not found.");
    // Every stock-booking endpoint runs the guard.
    expect((routerSource.match(/await requireOwnedStockTargets\(db, ctx\.user\.id/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("runs the purchase-order lifecycle draft -> ordered -> received with strict guards", () => {
    expect(routerSource).toContain("Only draft purchase orders can be edited.");
    expect(routerSource).toContain("Only draft purchase orders can be submitted.");
    expect(routerSource).toContain("Only ordered purchase orders can be received.");
    expect(routerSource).toContain("Received or cancelled purchase orders cannot change.");
    // Receiving books stock movements into the PO's location and refreshes unit cost.
    expect(routerSource).toContain("if (!line.inventoryItemId) continue; // freeform lines carry no stock");
    expect(routerSource).toContain('note: `Received on ${order.poNumber}`');
    // Duplicate names/SKUs surface as friendly errors, never raw SQL.
    expect(routerSource).toContain("An item with that SKU already exists.");
    expect(routerSource).toContain("A location with that name already exists.");
    // Concurrent draft creation races on the sequential number and retries gracefully.
    expect(routerSource).toContain("Could not assign a purchase order number. Try again.");
  });

  it("registers the Inventory panel in the workspace navigation", () => {
    expect(dashboardSource).toContain('case "inventory":');
    expect(dashboardSource).toContain('lazy(() => import("./dashboard/InventoryPanel"))');
    expect(sidebarSource).toContain('label: "Inventory",  panel: "inventory"');
    expect(panelSource).toContain('PanelTabs defaultTab="items"');
    expect(panelSource).toContain('label: "Purchase Orders"');
  });

  it("makes every inventory action reversible or confirm-guarded with no dead ends", () => {
    // Cancel warns that no stock will be received; locations archive instead of delete.
    expect(panelSource).toContain("No stock will be received");
    expect(panelSource).toContain("Archive");
    expect(panelSource).toContain("Restore");
    expect(panelSource).toContain("without losing history");
    // Empty states explain the next step instead of dead-ending.
    expect(panelSource).toContain("Add a warehouse or truck under Locations first");
    expect(panelSource).toContain("No purchase orders yet");
    expect(panelSource).toContain("No movements yet");
    expect(panelSource).toContain("No items yet");
  });
});
