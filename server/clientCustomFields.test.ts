import { readFileSync } from "node:fs";
import { readDashboardBundle } from "./dashboardBundle";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("private client custom fields", () => {
  it("keeps definition and values owner-scoped and validates select values", () => {
    const router = source("server/routers.ts");
    const portal = source("client/src/pages/ClientPortal.tsx");
    expect(router).toContain("createCustomField: protectedProcedure");
    expect(router).toContain("getCustomFieldValues: protectedProcedure");
    expect(router).toContain("setCustomFieldValue: protectedProcedure");
    expect(router).toContain("eq(clientCustomFields.userId, ctx.user.id)");
    expect(router).toContain("Choose one of the configured options.");
    expect(portal).not.toContain("getCustomFieldValues");
  });

  it("keeps the owner UI explicit about private-only profile fields", () => {
    const dashboard = readDashboardBundle();
    expect(dashboard).toContain("Private client fields");
    expect(dashboard).toContain("These fields are never shown in the client portal.");
    expect(dashboard).toContain("Add private field");
  });
});
