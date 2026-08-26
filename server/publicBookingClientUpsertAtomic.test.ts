import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");
const schemaSource = readFileSync(resolve(import.meta.dirname, "../drizzle/schema.ts"), "utf8");

describe("public booking client upsert atomicity", () => {
  it("reserves the booking slot before atomically upserting and linking the owner-scoped client", () => {
    const start = routerSource.indexOf("submit: publicProcedure", routerSource.indexOf("booking: router({"));
    const end = routerSource.indexOf("  }),\n\n  // ─── Client Pulse", start);
    const section = routerSource.slice(start, end);
    expect(section).toContain("await db.transaction(async (tx) =>");
    expect(section.indexOf("tx.insert(bookings).values")).toBeLessThan(section.indexOf("tx.insert(clients).values"));
    expect(section).toContain(".onDuplicateKeyUpdate({");
    expect(section).toContain("sessionsCount: sql`${clients.sessionsCount} + 1`");
    expect(section).toContain("const linkResult = await tx.update(bookings).set({ clientId: client.id })");
    expect(section).toContain("if (!linkResult[0].affectedRows)");
  });

  it("enforces owner-email uniqueness while allowing separate workspaces to use the same client email", () => {
    expect(schemaSource).toContain('uniqueIndex("clients_user_email_unique_idx").on(t.userId, t.email)');
  });
});
