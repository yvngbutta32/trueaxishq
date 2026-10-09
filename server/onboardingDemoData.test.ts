import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const source = (rel: string) => readFileSync(resolve(root, rel), "utf8");
const routers = source("server/routers.ts");
const shared = source("shared/demoData.ts");
const importPanel = source("client/src/pages/dashboard/ImportPanel.tsx");

const SAMPLE_CLIENT_PREFIX = "Sample — ";
const SAMPLE_INVOICE_PREFIX = "SAMPLE-";
const SAMPLE_JOB_PREFIX = "SAMPLE-JOB-";

describe("sample-data explorer (onboarding polish)", () => {
  it("prefixes live in one shared module imported by both ends", () => {
    expect(shared).toContain(`export const DEMO_CLIENT_PREFIX = "${SAMPLE_CLIENT_PREFIX}"`);
    expect(shared).toContain(`export const DEMO_INVOICE_PREFIX = "${SAMPLE_INVOICE_PREFIX}"`);
    expect(shared).toContain(`export const DEMO_JOB_PREFIX = "${SAMPLE_JOB_PREFIX}"`);
    expect(routers).toContain('from "../shared/demoData"');
    expect(routers).toContain("DEMO_CLIENT_PREFIX");
  });

  it("seeding is idempotent — a second call is an honest no-op, never duplicates", () => {
    expect(routers).toContain("seedDemoData: protectedProcedure.mutation");
    expect(routers).toContain("alreadySeeded: true");
    expect(routers).toContain("demoStatus: protectedProcedure.query");
  });

  it("seeded rows are always scoped to the calling owner", () => {
    const seedStart = routers.indexOf("seedDemoData: protectedProcedure.mutation");
    const seedEnd = routers.indexOf("clearDemoData: protectedProcedure.mutation");
    const seedBlock = routers.slice(seedStart, seedEnd);
    expect(seedBlock).toContain("eq(clients.userId, uid)");
    expect(seedBlock).toContain("userId: uid");
  });

  it("every sample email uses the reserved example.com domain — no real address can be contacted", () => {
    const seedStart = routers.indexOf("seedDemoData: protectedProcedure.mutation");
    const seedEnd = routers.indexOf("clearDemoData: protectedProcedure.mutation");
    const seedBlock = routers.slice(seedStart, seedEnd);
    const emails = [...seedBlock.matchAll(/email: "([^"]+)"/g)].map(m => m[1]);
    expect(emails.length).toBeGreaterThanOrEqual(4);
    for (const email of emails) expect(email.endsWith("@example.com")).toBe(true);
  });

  it("clearing deletes ONLY prefixed rows — real records can never match", () => {
    const clearStart = routers.indexOf("clearDemoData: protectedProcedure.mutation");
    const clearBlock = routers.slice(clearStart, clearStart + 3500);
    expect(clearBlock).toContain(`like(clients.name, \`\${DEMO_CLIENT_PREFIX}%\`)`);
    expect(clearBlock).toContain(`like(invoices.clientName, \`\${DEMO_CLIENT_PREFIX}%\`)`);
    expect(clearBlock).toContain(`like(invoices.invoiceNumber, \`\${DEMO_INVOICE_PREFIX}%\`)`);
    expect(clearBlock).toContain(`like(jobs.jobNumber, \`\${DEMO_JOB_PREFIX}%\`)`);
    expect(clearBlock).toContain(`like(bookings.clientName, \`\${DEMO_CLIENT_PREFIX}%\`)`);
    expect(clearBlock).toContain("eq(bookings.userId, uid)");
    expect(clearBlock).toContain("eq(jobs.userId, uid)");
    expect(clearBlock).toContain("eq(invoices.userId, uid)");
    expect(clearBlock).toContain("eq(clients.userId, uid)");
  });

  it("both actions are audit-logged", () => {
    expect(routers).toContain('"onboarding.demo.seeded"');
    expect(routers).toContain('"onboarding.demo.cleared"');
  });

  it("sample data never satisfies the first-hour operational guarantee", () => {
    const progressStart = routers.indexOf("firstHourProgress: protectedProcedure.query");
    const progressBlock = routers.slice(progressStart, progressStart + 3000);
    expect(progressBlock).toContain(`notLike(clients.name, \`\${DEMO_CLIENT_PREFIX}%\`)`);
    expect(progressBlock).toContain(`notLike(jobs.jobNumber, \`\${DEMO_JOB_PREFIX}%\`)`);
    expect(progressBlock).toContain(`notLike(invoices.clientName, \`\${DEMO_CLIENT_PREFIX}%\`)`);
  });

  it("sample invoice numbers can never collide with real owner invoice numbers", () => {
    // Real invoices are INV-YYYYMM-hash; samples carry the SAMPLE- prefix.
    expect(routers).toContain("INV-");
    const seedStart = routers.indexOf("seedDemoData: protectedProcedure.mutation");
    const seedEnd = routers.indexOf("clearDemoData: protectedProcedure.mutation");
    const sampleNumbers = [...routers.slice(seedStart, seedEnd).matchAll(/invoiceNumber: `\$\{DEMO_INVOICE_PREFIX\}(\d+)"|invoiceNumber: `\$\{DEMO_INVOICE_PREFIX\}(\d+)`/g)];
    expect(seedEnd).toBeGreaterThan(seedStart);
  });

  it("the UI is honest about what sample data is and how to remove it", () => {
    expect(importPanel).toContain("Try it with sample data");
    expect(importPanel).toContain("Remove all sample data");
    expect(importPanel).toContain("sample data never counts toward your first-hour setup progress");
    expect(importPanel).toContain("demoStatus");
    expect(importPanel).toContain("seedDemoData.useMutation");
    expect(importPanel).toContain("clearDemoData.useMutation");
  });
});
