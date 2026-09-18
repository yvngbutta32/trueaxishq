import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { invoices, proposals, jobs, clientApprovalRequests, bookings, clients } from "../drizzle/schema";
import { daysUntilProposalExpiry } from "../shared/proposalValidity";

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, getDb: getDbMock };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const dashboardSource = readFileSync(resolve(import.meta.dirname, "routers.ts"), "utf8");
const panelSource = readFileSync(resolve(import.meta.dirname, "../client/src/components/ActionCards.tsx"), "utf8");
const dashboardPageSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/Dashboard.tsx"), "utf8");

// ─── Mock database ────────────────────────────────────────────────────────────

type Row = Record<string, any>;
type Results = { invoices: Row[]; proposals: Row[]; jobs: Row[]; clientApprovalRequests: Row[]; bookings: Row[] };

// Drizzle query chains are long — the helper mirrors the where/orderBy/limit shape.
function makeChainDb(rows: Partial<Results>) {
  const wrap = (result: Row[]) => {
    const chain = {
      orderBy: () => chain,
      limit: async () => result,
      then: (resolve: (v: Row[]) => void) => Promise.resolve(result).then(resolve),
    };
    return chain;
  };
  return {
    select: () => ({
      from: (table: any) => {
        const key = table === invoices ? "invoices" : table === proposals ? "proposals" : table === jobs ? "jobs" : table === clientApprovalRequests ? "clientApprovalRequests" : table === bookings ? "bookings" : "clients";
        const result = (rows as any)[key] ?? [];
        return {
          leftJoin: () => ({ where: () => wrap(result) }),
          where: () => wrap(result),
        };
      },
    }),
  };
}

function makeCtx(): TrpcContext {
  return {
    user: { id: 1 } as TrpcContext["user"],
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

async function fetchCards(rows: Partial<Results>) {
  getDbMock.mockResolvedValue(makeChainDb(rows));
  const caller = appRouter.createCaller(makeCtx());
  const result = await caller.dashboard.actionCards();
  return result.cards as Array<{ id: string; title: string; detail: string; count: number; target: string }>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("dashboard action cards (owner next-best-actions)", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  it("computes days until proposal expiry", () => {
    const now = new Date("2026-09-17T12:00:00Z");
    expect(daysUntilProposalExpiry("2026-09-17", now)).toBe(0);
    expect(daysUntilProposalExpiry("2026-09-20", now)).toBe(3);
    expect(daysUntilProposalExpiry(null, now)).toBeNull();
    expect(daysUntilProposalExpiry("Sep 20, 2026", now)).toBeNull();
  });

  it("builds prioritized cards from live business data", async () => {
    const cards = await fetchCards({
      invoices: [
        { id: 1, clientName: "Late Co", amount: "300.00", status: "overdue" },
        { id: 2, clientName: "Later Co", amount: "120.50", status: "overdue" },
        { id: 3, clientName: "Quiet Co", amount: "80.00", status: "draft" },
      ],
      proposals: [
        { id: 5, title: "Patio Revival", clientName: "Dana", validUntil: "2026-09-18", total: "900", sentAt: new Date() },
      ],
      jobs: [{ id: 7, title: "Deck restoration", client: "Villa Owners" }],
      clientApprovalRequests: [{ id: 9, title: "Approve plan change" }],
      bookings: [{ id: 11, clientName: "Morgan", service: "Wash", time: "09:00" }],
    });

    // Seven sources exist; the cap keeps the six highest-priority cards and
    // drops today's schedule (lowest urgency).
    expect(cards.map(c => c.id)).toEqual([
      "quotes_expiring",
      "overdue_invoices",
      "awaiting_signature",
      "jobs_awaiting_client",
      "pending_approvals",
      "draft_invoices",
    ]);
    expect(cards).toHaveLength(6);

    const overdue = cards.find(c => c.id === "overdue_invoices")!;
    expect(overdue.count).toBe(2);
    expect(overdue.detail).toContain("$420.50");
    expect(overdue.detail).toContain("Late Co");
    expect(overdue.target).toBe("billing");
  });

  it("surfaces today's schedule when no higher-urgency card crowds it out", async () => {
    const cards = await fetchCards({
      bookings: [
        { id: 11, clientName: "Morgan", service: "Wash", time: "09:00" },
        { id: 12, clientName: "Kai", service: "Detail", time: "13:30" },
      ],
    });
    const schedule = cards.find(c => c.id === "todays_bookings")!;
    expect(schedule.count).toBe(2);
    expect(schedule.detail).toContain("09:00");
    expect(schedule.detail).toContain("Morgan");
    expect(schedule.target).toBe("scheduling");
  });

  it("omits a quotes-expiring card when nothing expires within three days", async () => {
    const cards = await fetchCards({
      proposals: [
        { id: 5, title: "Leisurely quote", clientName: "Dana", validUntil: "2026-10-01", total: "900", sentAt: new Date() },
      ],
    });
    expect(cards.map(c => c.id)).not.toContain("quotes_expiring");
    expect(cards.map(c => c.id)).toContain("awaiting_signature");
  });

  it("returns no cards when there is nothing actionable", async () => {
    const cards = await fetchCards({});
    expect(cards).toHaveLength(0);
  });

  it("keeps every card owner-scoped in the router source", () => {
    const section = dashboardSource.slice(dashboardSource.indexOf("dashboard: router({"), dashboardSource.indexOf("export type AppRouter"));
    expect(section).toContain("eq(invoices.userId, ctx.user.id)");
    expect(section).toContain("eq(proposals.userId, ctx.user.id)");
    expect(section).toContain("eq(jobs.userId, ctx.user.id)");
    expect(section).toContain("eq(clientApprovalRequests.userId, ctx.user.id)");
    expect(section).toContain("eq(bookings.userId, ctx.user.id)");
    expect(section).toContain("cards.slice(0, 6)");
  });

  it("renders the priorities strip on the dashboard with panel deep-links", () => {
    expect(panelSource).toContain("Today's priorities");
    expect(panelSource).toContain("onNavigate(card.target)");
    expect(panelSource).toContain("dashboard.actionCards");
    expect(dashboardPageSource).toContain('<ActionCards onNavigate={(panel) => setActivePanel(panel as ActivePanel)} />');
  });
});
