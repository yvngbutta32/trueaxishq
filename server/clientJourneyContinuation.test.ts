import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { invoices, users, proposals } from "../drizzle/schema";

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, getDb: getDbMock };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const proposalSignSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/ProposalSign.tsx"), "utf8");
const paymentSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/PublicInvoicePayment.tsx"), "utf8");
const cancelSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/BookingCancel.tsx"), "utf8");

// ─── Mock database ────────────────────────────────────────────────────────────

type Row = Record<string, any>;
type Tables = { invoices: Row[]; users: Row[]; proposals: Row[] };

/** Mocks the where/limit drizzle chains. `rowsFor` picks rows per table. */
function makeDb(rows: Tables) {
  const rowsFor = (table: any): Row[] =>
    table === invoices ? rows.invoices : table === users ? rows.users : table === proposals ? rows.proposals : [];
  const wrap = (result: Row[]) => {
    const chain = {
      where: () => wrap(result),
      limit: async () => result,
      then: (resolve: (v: Row[]) => void) => Promise.resolve(result).then(resolve),
    };
    return chain;
  };
  return {
    select: () => ({
      from: (table: any) => {
        const result = rowsFor(table);
        return {
          // payByToken joins invoices with users; merge the booking username into each invoice row.
          leftJoin: () => ({ where: () => wrap(result.map(r => ({ ...r, bookingUsername: rows.users[0]?.bookingUsername ?? null }))) }),
          where: () => wrap(result),
        };
      },
    }),
    update: () => ({
      set: (values: Row) => ({
        where: async () => {
          // getPublic marks first view; treat every proposal update as applied.
          Object.assign(rows.proposals[0] ?? {}, values);
          return [{ affectedRows: 1 }];
        },
      }),
    }),
  };
}

function makeCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

const PAID_INVOICE = { id: 42, userId: 3, invoiceNumber: "INV-2026-09-AAAAA", payLinkToken: "pay-token-1", status: "paid" };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("client journey continuation across public pages", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  it("payByToken returns the owner's self-booking link after payment", async () => {
    getDbMock.mockResolvedValue(makeDb({
      invoices: [{ ...PAID_INVOICE, status: "overdue", clientName: "Dana", amount: "400", dueDate: "2026-09-01" }],
      users: [{ bookingUsername: "aaronwash" }],
      proposals: [],
    }));
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.invoices.payByToken({ token: "pay-token-1" });
    expect(result.alreadyPaid).toBe(false);
    expect(result.bookingUrl).toBe("/book/aaronwash");
  });

  it("payByToken returns a null booking link when the owner has no booking page", async () => {
    getDbMock.mockResolvedValue(makeDb({
      invoices: [{ ...PAID_INVOICE, status: "paid", clientName: "Dana", amount: "400" }],
      users: [{ bookingUsername: null }],
      proposals: [],
    }));
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.invoices.payByToken({ token: "pay-token-1" });
    expect(result.alreadyPaid).toBe(true);
    expect(result.bookingUrl).toBeNull();
  });

  it("getPublic rebuilds the pay/booking continuation on a signed-proposal revisit", async () => {
    getDbMock.mockResolvedValue(makeDb({
      invoices: [{ ...PAID_INVOICE, status: "sent" }],
      users: [{ bookingUsername: "aaronwash" }],
      proposals: [{
        id: 11, userId: 3, clientName: "Dana", clientEmail: "dana@example.com", title: "Driveway Restoration",
        status: "signed", token: "tok", signatureName: "Dana", signedAt: new Date(), validUntil: null,
        viewedAt: new Date(), linkedInvoiceId: 42, lineItems: "[]", subtotal: "0", taxRate: "0", total: "400",
        currency: "USD", packageOptions: null, selectedPackageId: null, notes: null, sentAt: new Date(), declinedAt: null,
      }],
    }));
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.proposals.getPublic({ token: "tok" });

    expect(result.status).toBe("signed");
    expect(result.continuation).toEqual({
      payUrl: "/pay/pay-token-1",
      paid: false,
      invoiceNumber: "INV-2026-09-AAAAA",
      bookingUrl: "/book/aaronwash",
    });
    // The private decline reason never reaches the public payload.
    expect(result).not.toHaveProperty("declineReason");
  });

  it("returns no continuation for an unsigned proposal", async () => {
    getDbMock.mockResolvedValue(makeDb({
      invoices: [],
      users: [{ bookingUsername: "aaronwash" }],
      proposals: [{
        id: 12, userId: 3, clientName: "Dana", title: "Deck Revival", status: "viewed", token: "tok2",
        validUntil: null, viewedAt: new Date(), linkedInvoiceId: null, lineItems: "[]", subtotal: "0",
        taxRate: "0", total: "500", currency: "USD", signatureName: null, signedAt: null, sentAt: new Date(),
      }],
    }));
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.proposals.getPublic({ token: "tok2" });
    expect(result.continuation).toBeNull();
  });

  it("shares one shell and one next-steps component across the public journey", () => {
    // Proposal sign screen: shell + shared continuation for first sign and revisits.
    expect(proposalSignSource).toContain("PublicShell");
    expect(proposalSignSource).toContain("PublicNextSteps");
    // Booking cancel and invoice payment adopt the same continuation surfaces.
    expect(cancelSource).toContain("PublicShell");
    expect(paymentSource).toContain("PublicNextSteps");
    expect(paymentSource).toContain("bookingUrl");
  });
});
