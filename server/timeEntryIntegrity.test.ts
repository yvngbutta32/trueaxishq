import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const start = source.indexOf("time: router({");
const end = source.indexOf("// ── Contracts", start);
const timeSource = source.slice(start, end);

describe("time-entry integrity contract", () => {
  it("inherits the job client for both live and manual time when a job is selected", () => {
    expect(timeSource).toContain("let resolvedClientId = input.clientId ?? null;");
    expect(timeSource).toContain("resolvedClientId = job.clientId;");
    expect(timeSource).toContain("clientId: resolvedClientId");
  });

  it("enforces owner predicates on every time-entry write and prevents silent missing-record mutations", () => {
    expect(timeSource).toContain("where(and(eq(timeEntries.id, entry.id), eq(timeEntries.userId, ctx.user.id)))");
    expect(timeSource).toContain("where(and(eq(timeEntries.id, id), eq(timeEntries.userId, ctx.user.id)))");
    expect(timeSource).toContain("Time entry not found.");
  });

  it("protects billing integrity by rejecting duration edits on running timers and invoice-backed deletions", () => {
    expect(timeSource).toContain("Stop a running timer before editing its duration.");
    expect(timeSource).toContain("Invoiced time entries cannot be deleted.");
  });
});

describe("contract conversion integrity contract", () => {
  it("keeps proposal-to-invoice linkage within the authenticated owner scope", () => {
    const conversionStart = source.indexOf("convertToInvoice: protectedProcedure");
    const conversionEnd = source.indexOf("// ── Notifications", conversionStart);
    const conversion = source.slice(conversionStart, conversionEnd);
    expect(conversion).toContain("eq(contracts.userId, ctx.user.id)");
    expect(conversion).toContain("linkedInvoiceId: invoiceId");
  });
});

describe("proposal conversion integrity contract", () => {
  it("keeps proposal-to-invoice linkage within the authenticated owner scope", () => {
    const conversionStart = source.indexOf("proposals: router({");
    const conversionEnd = source.indexOf("delete: protectedProcedure", conversionStart);
    const conversion = source.slice(conversionStart, conversionEnd);
    expect(conversion).toContain("eq(proposals.userId, ctx.user.id)");
    expect(conversion).toContain("linkedInvoiceId: invId");
  });
});
