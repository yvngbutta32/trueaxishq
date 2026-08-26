import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildClientCsv, csvCell } from "./clientCsvExport";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("client CSV export", () => {
  it("quotes fields and neutralizes spreadsheet formula prefixes", () => {
    expect(csvCell('A, "quoted" value')).toBe('"A, ""quoted"" value"');
    expect(csvCell("=SUM(A1:A2)")).toBe('"\'=SUM(A1:A2)"');
    expect(csvCell("-danger")).toBe('"\'-danger"');
  });

  it("exports only the documented conservative CRM headers", () => {
    const csv = buildClientCsv([{ name: "Example Client", email: "client@example.test", phone: null, service: "Consulting", status: "active", notes: "Review, then approve", createdAt: new Date("2026-08-26T00:00:00.000Z") }]);
    expect(csv.split("\r\n")[0]).toBe('"Name","Email","Phone","Service","Status","Notes","Created at"');
    expect(csv).toContain('"Review, then approve"');
    expect(csv).not.toContain("fileKey");
  });

  it("uses an authenticated owner filter in the export procedure and a server-backed dashboard download", () => {
    const router = source("server/routers.ts");
    const dashboard = source("client/src/pages/Dashboard.tsx");
    const clientRouter = router.slice(router.indexOf("clients: router({"), router.indexOf("// ── Invoices"));

    expect(clientRouter).toContain("exportCsv: protectedProcedure");
    expect(clientRouter).toContain("eq(clients.userId, ctx.user.id)");
    expect(clientRouter).toContain("limit(10_000)");
    expect(clientRouter).toContain("buildClientCsv(rows)");
    expect(dashboard).toContain("trpc.clients.exportCsv.useQuery");
    expect(dashboard).toContain("result.data.fileName");
    expect(dashboard).not.toContain('const headers = ["Name", "Email", "Phone", "Service", "Status", "Pulse Score", "Last Activity"]');
  });
});
