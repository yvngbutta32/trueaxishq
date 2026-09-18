import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { proposals, invoices, users } from "../drizzle/schema";

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, getDb: getDbMock };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const publicSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/ProposalSign.tsx"), "utf8");

// ─── Mock database dispatcher ─────────────────────────────────────────────────

type ProposalRow = Record<string, any>;

function makeDb(opts: {
  proposal: ProposalRow;
  signatureAffectedRows?: number;
  ownerBookingUsername?: string | null;
  inserts: Array<Record<string, any>>;
  proposalUpdates: Array<Record<string, any>>;
}) {
  const db: any = {
    select: (fields?: Record<string, any>) => ({
      from: (table: any) => ({
        where: (_clause: unknown) => ({
          limit: async () => {
            if (table === proposals) return [opts.proposal];
            if (table === users) return opts.ownerBookingUsername === undefined ? [] : [{ bookingUsername: opts.ownerBookingUsername }];
            return [];
          },
        }),
      }),
    }),
    insert: (table: any) => ({
      values: async (values: Record<string, any>) => {
        opts.inserts.push({ table, values });
        return [{ insertId: 42 }];
      },
    }),
    update: (table: any) => ({
      set: (values: Record<string, any>) => ({
        where: async () => {
          if (table === proposals) {
            if (values.status === "signed") return [{ affectedRows: opts.signatureAffectedRows ?? 1 }];
            opts.proposalUpdates.push(values);
            return [{ affectedRows: 1 }];
          }
          return [{ affectedRows: 1 }];
        },
      }),
    }),
  };
  return db;
}

function makeProposal(overrides: Record<string, any> = {}): ProposalRow {
  return {
    id: 11,
    userId: 3,
    clientId: null,
    clientName: "Dana Client",
    clientEmail: "dana@example.com",
    title: "Driveway Restoration",
    lineItems: JSON.stringify([{ id: "l1", name: "Wash", qty: 1, unitPrice: 400, total: 400 }]),
    subtotal: "400",
    taxRate: "0",
    total: "400",
    currency: "USD",
    validUntil: null,
    status: "sent",
    token: "sign-token-abc",
    packageOptions: null,
    selectedPackageId: null,
    linkedInvoiceId: null,
    notes: null,
    ...overrides,
  };
}

function makeCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

async function callSign(db: any, token = "sign-token-abc") {
  const caller = appRouter.createCaller(makeCtx());
  // requireDb() resolves getDb() — the dispatcher mock stands in for the database.
  getDbMock.mockResolvedValue(db);
  return caller.proposals.sign({ token, signatureName: "Dana Client" });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("proposal sign quote-to-cash continuation", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  it("creates the linked invoice with a payment token once and returns the client's next steps", async () => {
    const inserts: Array<Record<string, any>> = [];
    const proposalUpdates: Array<Record<string, any>> = [];
    const db = makeDb({
      proposal: makeProposal(),
      ownerBookingUsername: "aaronwash",
      inserts,
      proposalUpdates,
    });

    const result = await callSign(db);

    expect(result.success).toBe(true);
    expect(result.invoiceNumber).toMatch(/^INV-/);
    expect(result.payUrl).toMatch(/^\/pay\/[0-9a-f]{64}$/);
    expect(result.bookingUrl).toBe("/book/aaronwash");

    expect(inserts).toHaveLength(1);
    expect(inserts[0].table).toBe(invoices);
    expect(inserts[0].values.userId).toBe(3);
    expect(inserts[0].values.status).toBe("draft");
    expect(inserts[0].values.payLinkToken).toHaveLength(64);
    expect(inserts[0].values.amount).toBe("400");

    expect(proposalUpdates).toHaveLength(1);
    expect(proposalUpdates[0].linkedInvoiceId).toBe(42);
  });

  it("refuses a concurrent or replayed signature before any invoice is created", async () => {
    const inserts: Array<Record<string, any>> = [];
    const db = makeDb({
      proposal: makeProposal({ status: "signed" }),
      signatureAffectedRows: 0,
      ownerBookingUsername: null,
      inserts,
      proposalUpdates: [],
    });

    await expect(callSign(db)).rejects.toThrow(/already been signed/);
    expect(inserts).toHaveLength(0);
  });

  it("does not create a second invoice when the owner already converted the proposal", async () => {
    const inserts: Array<Record<string, any>> = [];
    const db = makeDb({
      proposal: makeProposal({ linkedInvoiceId: 99 }),
      ownerBookingUsername: null,
      inserts,
      proposalUpdates: [],
    });

    const result = await callSign(db);

    expect(result.success).toBe(true);
    expect(result.payUrl).toBeNull();
    expect(result.invoiceNumber).toBeNull();
    expect(inserts).toHaveLength(0);
  });

  it("omits the booking continuation when the owner has no booking username", async () => {
    const db = makeDb({
      proposal: makeProposal(),
      ownerBookingUsername: null,
      inserts: [],
      proposalUpdates: [],
    });

    const result = await callSign(db);

    expect(result.bookingUrl).toBeNull();
    expect(result.payUrl).toMatch(/^\/pay\//);
  });

  it("surfaces the payment and booking continuations on the signed screen", () => {
    expect(publicSource).toContain("data?.payUrl");
    expect(publicSource).toContain("data?.bookingUrl");
    expect(publicSource).toContain("Pay your invoice");
    expect(publicSource).toContain("Schedule your service");
    expect(publicSource).toContain("nextSteps.payUrl");
    expect(publicSource).toContain("nextSteps.bookingUrl");
  });
});
