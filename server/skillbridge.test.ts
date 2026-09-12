import { describe, it, expect, vi, beforeEach } from "vitest";
const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, getDb: getDbMock };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Shared mock context helpers ─────────────────────────────────────────────

function makeEmptyDb() {
  const limit = vi.fn().mockResolvedValue([]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { select: vi.fn(() => ({ from })) };
}

getDbMock.mockResolvedValue(makeEmptyDb());

function makeCtx(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
    ...overrides,
  };
}

function makeAuthCtx(role: "user" | "admin" = "user"): TrpcContext {
  return makeCtx({
    user: {
      id: 1,
      openId: "test-open-id",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  });
}

// ─── Auth tests ───────────────────────────────────────────────────────────────

describe("auth", () => {
  it("auth.me returns null for unauthenticated user", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("auth.me returns user for authenticated user", async () => {
    const caller = appRouter.createCaller(makeAuthCtx());
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.email).toBe("test@example.com");
    expect(result?.name).toBe("Test User");
  });

  it("auth.logout clears session cookie and returns success", async () => {
    const ctx = makeAuthCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(ctx.res.clearCookie).toHaveBeenCalledTimes(1);
  });
});

// ─── Billing tests ────────────────────────────────────────────────────────────

describe("billing", () => {
  it("billing.getPlans returns a list of plans", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const plans = await caller.billing.getPlans();
    expect(Array.isArray(plans)).toBe(true);
    expect(plans.length).toBeGreaterThan(0);
    // Each plan should have required fields
    for (const plan of plans) {
      expect(plan).toHaveProperty("id");
      expect(plan).toHaveProperty("name");
      expect(plan).toHaveProperty("monthlyPrice");
    }
  });

  it("billing.getPlans includes starter, pro, and agency plans", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const plans = await caller.billing.getPlans();
    const ids = plans.map((p) => p.id);
    expect(ids).toContain("starter");
    expect(ids).toContain("pro");
    expect(ids).toContain("agency");
  });

  it("billing.createCheckout throws for unauthenticated user", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.billing.createCheckout({
        planId: "starter",
        interval: "monthly",
        origin: "https://example.com",
      })
    ).rejects.toThrow();
  });

  it("billing.createPortal throws for unauthenticated user", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.billing.createPortal({ origin: "https://example.com" })
    ).rejects.toThrow();
  });
});

// ─── Admin tests ──────────────────────────────────────────────────────────────

describe("admin", () => {
  it("admin.listUsers throws FORBIDDEN for non-admin user", async () => {
    const caller = appRouter.createCaller(makeAuthCtx("user"));
    await expect(
      caller.admin.listUsers({ page: 1, limit: 10 })
    ).rejects.toThrow();
  });

  it("admin.revenueStats throws FORBIDDEN for non-admin user", async () => {
    const caller = appRouter.createCaller(makeAuthCtx("user"));
    await expect(caller.admin.revenueStats()).rejects.toThrow();
  });

  it("admin.broadcast throws FORBIDDEN for non-admin user", async () => {
    const caller = appRouter.createCaller(makeAuthCtx("user"));
    await expect(
      caller.admin.broadcast({ title: "Test", content: "Hello" })
    ).rejects.toThrow();
  });
});

// ─── AI Assistant tests ───────────────────────────────────────────────────────

describe("ai", () => {
  it("ai.chat throws for unauthenticated user", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.ai.chat({
        messages: [{ role: "user", content: "Hello" }],
      })
    ).rejects.toThrow();
  });
});

// ─── Booking tests ────────────────────────────────────────────────────────────

describe("booking", () => {
  it("booking.getPage returns null for unknown username", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.booking.getPage({ username: "nonexistent-user-xyz-12345" });
    expect(result).toBeNull();
  });

  it("booking.submit throws NOT_FOUND for unknown host", async () => {
    // The mocked DB returns empty array, so host lookup will fail — this is correct behavior
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.booking.submit({
        hostUsername: "nonexistent-host",
        clientName: "Jane Doe",
        clientEmail: "jane@example.com",
        service: "Life Coaching",
        preferredDate: "2026-04-01",
        preferredTime: "10:00 AM",
        message: "Looking forward to our session!",
      })
    ).rejects.toThrow("Booking page not found.");
  });

  it("booking.submit rejects invalid email", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.booking.submit({
        hostUsername: "testhost",
        clientName: "Jane Doe",
        clientEmail: "not-an-email",
        service: "Life Coaching",
        preferredDate: "2026-04-01",
        preferredTime: "10:00 AM",
      })
    ).rejects.toThrow();
  });

  it("booking.submit rejects empty client name", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.booking.submit({
        hostUsername: "testhost",
        clientName: "",
        clientEmail: "jane@example.com",
        service: "Life Coaching",
        preferredDate: "2026-04-01",
        preferredTime: "10:00 AM",
      })
    ).rejects.toThrow();
  });
});
