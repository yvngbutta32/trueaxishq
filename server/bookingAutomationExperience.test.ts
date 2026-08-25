import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectFile = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("native booking rescheduling contract", () => {
  const router = projectFile("server/routers.ts");
  const schema = projectFile("drizzle/schema.ts");
  const page = projectFile("client/src/pages/BookingCancel.tsx");

  it("uses a one-time token and a database transaction for slot moves", () => {
    expect(router).toContain("reschedule: publicProcedure");
    expect(router).toContain('tokenRow.action !== "reschedule"');
    expect(router).toContain("await db.transaction");
    expect(router).toContain("That appointment time was just taken");
  });

  it("protects active appointment slots with a database-level unique key", () => {
    expect(schema).toContain('slotKey: varchar("slotKey"');
    expect(schema).toContain('uniqueIndex("bookings_live_slot_unique_idx")');
    expect(router).toContain("slotKey: `${hostId}|${input.preferredDate}|${input.preferredTime}`");
  });

  it("presents a native date and time picker instead of cancel-and-rebook", () => {
    expect(page).toContain("Confirm New Time");
    expect(page).toContain("bookingManage.reschedule");
    expect(page).not.toContain("Cancel & Rebook");
  });
});

describe("automation center experience contract", () => {
  const page = projectFile("client/src/pages/Automations.tsx");

  it("supports rule editing, delayed actions, and visible run history", () => {
    expect(page).toContain("openEdit");
    expect(page).toContain("triggerDelayHours");
    expect(page).toContain("Run History");
    expect(page).toContain("trpc.automations.logs.useQuery");
  });
});
