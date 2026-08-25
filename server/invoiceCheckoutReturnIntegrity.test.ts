import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("invoice checkout return integrity", () => {
  it("uses a non-authoritative refresh marker and never lets a return URL mark an invoice paid", () => {
    const router = source("server/routers.ts");
    const dashboard = source("client/src/pages/Dashboard.tsx");

    expect(router).toContain("?panel=invoices&payment_returned=1");
    expect(router).not.toContain("?panel=billing&paid=${inv.id}");
    expect(dashboard).toContain('params.get("payment_returned") === "1"');
    expect(dashboard).toContain("webhook-confirmed invoice status");
    expect(dashboard).not.toContain("markPaidFromUrl.mutate");
  });
});
