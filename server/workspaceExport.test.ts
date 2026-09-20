/* Workspace export — the honest exit path. These tests pin the security and
 * honesty boundaries of migration.exportAll: owner scoping, credential
 * redaction, honest truncation, and the exclusion of operational/credential
 * tables from the export registry. */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EXPORT_ROW_CAP, EXPORT_TABLES, REDACTED, redactSensitive } from "./_core/workspaceExport";

const routersSource = readFileSync(join(__dirname, "routers.ts"), "utf8");
const exportSource = readFileSync(join(__dirname, "_core", "workspaceExport.ts"), "utf8");

describe("workspace export registry", () => {
  it("exports the core business tables owners would need to leave with", () => {
    const keys = new Set(EXPORT_TABLES.map(([key]) => key));
    for (const expected of [
      "clients", "jobs", "invoices", "proposals", "contracts", "bookings",
      "serviceVisits", "teamMembers", "expenses", "timeEntries",
      "inventoryItems", "purchaseOrders", "priceBookItems", "recurringServicePlans",
      "intakeForms", "customReports", "subcontractors", "jobPhotos",
    ]) {
      expect(keys.has(expected as never), `registry must include ${expected}`).toBe(true);
    }
  });

  it("never registers credential, session, token, or operational-log tables", () => {
    const keys = new Set(EXPORT_TABLES.map(([key]) => key));
    for (const forbidden of [
      "leads", "contactMessages",
      "userSessions", "passwordResetTokens", "twoFactorBackupCodes", "userApiKeys",
      "smsLoginCodes", "workspaceStaffInvites", "inviteCodes", "securityEvents",
      "auditLogs", "stripeWebhookEvents", "workflowWebhookDeliveries",
      "geocodeCache", "serviceVisitTrackLinks", "clientPortalTokens",
      "calendarFeedTokens", "googleCalendarTokens",
    ]) {
      expect(keys.has(forbidden as never), `registry must NOT include ${forbidden}`).toBe(false);
    }
    expect(exportSource).toContain("Deliberately EXCLUDED");
  });

  it("only registers workspace-scoped tables (every exported table has a userId column)", () => {
    const schemaSource = readFileSync(join(__dirname, "..", "drizzle", "schema.ts"), "utf8");
    for (const [key] of EXPORT_TABLES) {
      const start = schemaSource.indexOf(`export const ${key} = `);
      expect(start, `${key} must exist in drizzle schema`).toBeGreaterThan(-1);
      const end = schemaSource.indexOf("\nexport const ", start + 10);
      const body = schemaSource.slice(start, end > 0 ? end : undefined);
      expect(body.includes("userId"), `${key} must be workspace-scoped (userId column) for export`).toBe(true);
    }
  });

  it("caps rows per table and flags truncation honestly", () => {
    expect(EXPORT_ROW_CAP).toBe(5_000);
    expect(routersSource).toContain("EXPORT_ROW_CAP + 1");
    expect(routersSource).toContain("rows.slice(0, EXPORT_ROW_CAP)");
  });
});

describe("workspace export redaction", () => {
  it("redacts credential material on sensitive keys, deeply", () => {
    const row = {
      id: 7, name: "Jane", email: "j@example.com",
      passwordHash: "$2b$10$abc", twoFactorSecret: "KRSXG5A", apiKeyHash: "deadbeef",
      webhookSecret: "whsec_1", sessionToken: "tok", codeHash: "hmac",
      nested: [{ apiKey: "sk_123", note: "ok" }, { passwordResetToken: "r" }],
      tokens: ["keep-me-array"],
    } as unknown as Record<string, unknown>;
    const out = redactSensitive(row) as Record<string, unknown>;
    expect(out.id).toBe(7);
    expect(out.email).toBe("j@example.com");
    expect(out.passwordHash).toBe(REDACTED);
    expect(out.twoFactorSecret).toBe(REDACTED);
    expect(out.apiKeyHash).toBe(REDACTED);
    expect(out.webhookSecret).toBe(REDACTED);
    expect(out.sessionToken).toBe(REDACTED);
    expect(out.codeHash).toBe(REDACTED);
    const nested = out.nested as Array<Record<string, unknown>>;
    expect(nested[0].apiKey).toBe(REDACTED);
    expect(nested[0].note).toBe("ok");
    expect(nested[1].passwordResetToken).toBe(REDACTED);
    expect(JSON.stringify(out)).not.toContain("sk_123");
    expect(JSON.stringify(out)).not.toContain("$2b$10$abc");
    expect(JSON.stringify(out)).not.toContain("KRSXG5A");
  });

  it("leaves ordinary business data untouched", () => {
    const row = { id: 1, total: 199.5, note: "token of appreciation", status: "paid" };
    const out = redactSensitive(row);
    expect(out).toEqual(row);
  });
});

describe("workspace export procedure wiring", () => {
  it("is owner-scoped, audit-logged, and not client-writable", () => {
    expect(routersSource).toContain("exportAll: protectedProcedure");
    // owner scoping on every exported table
    expect(routersSource).toMatch(/exportAll[\s\S]{0,600}?eq\(\(table as unknown as \{ userId: never \}\)\.userId, ctx\.user\.id\)/);
    // audit trail
    expect(routersSource).toContain('"workspace.exported"');
    // query (read-only), never a mutation
    expect(routersSource).not.toMatch(/exportAll: protectedProcedure[\s\S]{0,600}?\.mutation/);
  });

  it("redacts rows server-side before they leave", () => {
    expect(routersSource).toMatch(/rows\.slice\(0, EXPORT_ROW_CAP\)\.map\(.*redactSensitive/);
    expect(routersSource).toMatch(/owner: owner \? redactSensitive\(owner/);
  });
});
