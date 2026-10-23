import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const schemaSource = readFileSync(resolve(root, "drizzle/schema.ts"), "utf8");
const migrationSource = readFileSync(resolve(root, "drizzle/0087_po_job_link.sql"), "utf8");

const inventoryRouter = routerSource.slice(routerSource.indexOf("inventory: router({"));

describe("PO job costing roll-up (Jobber's #1 unfulfilled request)", () => {
  it("lets purchase orders carry an optional job link with an efficient owner-job index", () => {
    expect(schemaSource).toContain('jobId: int("jobId")');
    expect(schemaSource).toContain('index("purchaseOrders_owner_job_idx").on(t.userId, t.jobId)');
    expect(migrationSource).toContain("ADD COLUMN `jobId`");
    expect(migrationSource).toContain("ADD INDEX `purchaseOrders_owner_job_idx`");
  });

  it("verifies the linked job belongs to the owner before any PO write touches it", () => {
    const create = inventoryRouter.slice(inventoryRouter.indexOf("createPurchaseOrder: protectedProcedure"), inventoryRouter.indexOf("updatePurchaseOrder: protectedProcedure"));
    expect(create).toContain("jobId: z.number().int().positive().optional()");
    expect(create).toContain("eq(jobs.id, input.jobId), eq(jobs.userId, ctx.user.id)");
    const update = inventoryRouter.slice(inventoryRouter.indexOf("updatePurchaseOrder: protectedProcedure"), inventoryRouter.indexOf("submitPurchaseOrder: protectedProcedure"));
    expect(update).toContain("jobId: z.number().int().positive().nullable().optional()");
    expect(update).toContain("if (input.jobId !== undefined) updates.jobId = input.jobId");
  });

  it("records a job activity when a job-linked purchase order is received", () => {
    const receive = inventoryRouter.slice(inventoryRouter.indexOf("receivePurchaseOrder: protectedProcedure"), inventoryRouter.indexOf("cancelPurchaseOrder: protectedProcedure"));
    expect(receive).toContain("if (order.jobId)");
    expect(receive).toContain('eventType: "material_received"');
  });

  it("values consumed stock at the unit cost captured when it was used, not today's cost", () => {
    // A later PO receipt rewrites the item's unit cost; without a snapshot the
    // job's older consumptions silently inflate (caught by the live e2e).
    expect(schemaSource).toContain('unitCostAt: decimal("unitCostAt", { precision: 12, scale: 2 })');
    const consume = inventoryRouter.slice(inventoryRouter.indexOf("consumeForJob: protectedProcedure"), inventoryRouter.indexOf("listPurchaseOrders: protectedProcedure"));
    expect(consume).toContain("unitCostAt: item.unitCost");
  });

  it("counts only received job-linked POs, and stock consumed without a PO, once each", () => {
    const report = routerSource.slice(routerSource.indexOf("getOwnerJobCostReport"), routerSource.indexOf("// ─── Invoice number generator"));
    // Received job-linked POs contribute their stored total once…
    expect(report).toContain('eq(purchaseOrders.status, "received")');
    expect(report).toContain("poCosts.get(job.id) ?? 0");
    // …stock consumed onto a job is valued at the item's unit cost…
    expect(report).toContain('eq(inventoryMovements.type, "consume")');
    expect(report).toContain("Math.abs(Number(movement.quantity ?? 0)) * Number(movement.unitCost ?? 0)");
    expect(report).toContain(`COALESCE(${'${inventoryMovements.unitCostAt}'}, ${'${inventoryItems.unitCost}'}, 0)`);;
    expect(report).toContain("stockCosts.get(job.id) ?? 0");
    // …and movements that arrived via a purchase order are excluded so a
    // job-linked PO total is never counted twice.
    expect(report).toContain("isNull(inventoryMovements.purchaseOrderId)");
  });

  it("keeps materials, margins, and purchase orders out of the client-facing job portal", () => {
    const portalStart = routerSource.indexOf("getJobs: publicProcedure");
    const portalEnd = routerSource.indexOf("  }),\n  // ── Contracts", portalStart);
    const portalJobs = routerSource.slice(portalStart, portalEnd);
    expect(portalJobs).not.toContain("materialCost");
    expect(portalJobs).not.toContain("purchaseOrders");
    expect(portalJobs).not.toContain("marginPercent");
  });

  it("surfaces the job link and materials on the owner surfaces", () => {
    const listOrders = inventoryRouter.slice(inventoryRouter.indexOf("listPurchaseOrders: protectedProcedure"), inventoryRouter.indexOf("createPurchaseOrder: protectedProcedure"));
    expect(listOrders).toContain("jobMap.get(order.jobId) ?? null");
    const panel = readFileSync(resolve(root, "client/src/pages/dashboard/InventoryPanel.tsx"), "utf8");
    expect(panel).toContain("Charge to job (optional)");
    const workspace = readFileSync(resolve(root, "client/src/pages/JobWorkspace.tsx"), "utf8");
    expect(workspace).toContain("Materials (POs + stock)");
    expect(workspace).toContain("money(detail.financials.materialCost ?? 0)");
  });
});
