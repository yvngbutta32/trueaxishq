import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  createSessionToken: vi.fn(async () => "local-session-token"),
  recordSession: vi.fn(async () => undefined),
  hashPassword: vi.fn(async () => "local-password-hash"),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./auth", () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  createSessionToken: mocks.createSessionToken,
  recordSession: mocks.recordSession,
  revokeSession: vi.fn(),
  hashPassword: mocks.hashPassword,
  verifyPassword: vi.fn(),
}));

import { protectedProcedure, router } from "./_core/trpc";
import { appRouter, normalizeStaffInviteEmail } from "./routers";

const INVITE_TOKEN = "a".repeat(64);
const INVITED_EMAIL = "staff.identity@example.test";

type InviteFixture = {
  id: number;
  ownerUserId: number;
  teamMemberId: number;
  email: string;
  role: "field_member";
  expiresAt: Date;
  acceptedAt: Date | null;
  revoked: boolean;
  teamMemberActive: boolean;
};

function makeInvite(overrides: Partial<InviteFixture> = {}): InviteFixture {
  return {
    id: 701,
    ownerUserId: 101,
    teamMemberId: 301,
    email: INVITED_EMAIL,
    role: "field_member",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    acceptedAt: null,
    revoked: false,
    teamMemberActive: true,
    ...overrides,
  };
}

function queryChain(rows: unknown[]) {
  const limited = {
    limit: vi.fn(async () => rows),
    then: <TResult1 = unknown[], TResult2 = never>(
      onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(rows).then(onfulfilled, onrejected),
  };
  const builder: {
    from: ReturnType<typeof vi.fn>;
    innerJoin: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
  } = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
  };
  builder.from.mockReturnValue(builder);
  builder.innerJoin.mockReturnValue(builder);
  builder.where.mockReturnValue(limited);
  builder.orderBy.mockReturnValue(limited);
  return builder;
}

function installDb(selectRows: unknown[][]) {
  const inserted: unknown[] = [];
  const inviteUpdates: unknown[] = [];
  const tx = {
    update: vi.fn(() => ({
      set: vi.fn((values: unknown) => {
        inviteUpdates.push(values);
        return { where: vi.fn(async () => [{ affectedRows: 1 }]) };
      }),
    })),
    select: vi.fn(() => queryChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(async (values: unknown) => {
        inserted.push(values);
        return [{ insertId: 501 }];
      }),
    })),
  };
  const db = {
    select: vi.fn(() => queryChain(selectRows.shift() ?? [])),
    transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  mocks.getDb.mockResolvedValue(db);
  return { db, tx, inserted, inviteUpdates };
}

function makeContext(email: string | null, id = 401): TrpcContext {
  return {
    user: email === null ? null : {
      id,
      openId: `email:${email}`,
      name: "Disposable Staff",
      email,
      loginMethod: "password",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("staff invite identity binding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses only case and outer-whitespace normalization for staff invite email comparison", () => {
    expect(normalizeStaffInviteEmail("  Staff.Identity+tag@Example.TEST ")).toBe("staff.identity+tag@example.test");
    expect(normalizeStaffInviteEmail(" ")).toBeNull();
  });

  it("rejects an authenticated mismatched account before any invite claim or membership insert", async () => {
    const state = installDb([[makeInvite()]]);
    const caller = appRouter.createCaller(makeContext("owner.identity@example.test", 1));

    await expect(caller.staffAccess.accept({ token: INVITE_TOKEN })).rejects.toThrow("does not match your signed-in email");

    expect(state.db.transaction).not.toHaveBeenCalled();
    expect(state.inviteUpdates).toEqual([]);
    expect(state.inserted).toEqual([]);
  });

  it("exposes only a signed-in account eligibility boolean to the private-link interface", async () => {
    const state = installDb([[
      {
        ...makeInvite(),
        teamMemberName: "Disposable Staff",
      },
    ]]);
    const caller = appRouter.createCaller(makeContext("owner.identity@example.test", 1));

    await expect(caller.staffAccess.getInvite({ token: INVITE_TOKEN })).resolves.toMatchObject({
      teamMemberName: "Disposable Staff",
      canAcceptWithSignedInEmail: false,
    });
    expect(state.db.select).toHaveBeenCalledTimes(1);
  });

  it("accepts the invited account after safe normalization and binds membership to that account only", async () => {
    const state = installDb([[makeInvite({ email: " Staff.Identity@Example.TEST " })]]);
    const caller = appRouter.createCaller(makeContext("staff.identity@example.test", 451));

    await expect(caller.staffAccess.accept({ token: INVITE_TOKEN })).resolves.toEqual({ success: true });

    expect(state.db.transaction).toHaveBeenCalledTimes(1);
    expect(state.inserted).toContainEqual(expect.objectContaining({
      ownerUserId: 101,
      memberUserId: 451,
      teamMemberId: 301,
      active: true,
    }));
    expect(state.inviteUpdates).toContainEqual(expect.objectContaining({ acceptedUserId: 451 }));
  });

  it.each([
    ["revoked", { revoked: true }],
    ["already accepted", { acceptedAt: new Date() }],
    ["expired", { expiresAt: new Date(Date.now() - 60 * 1000) }],
    ["inactive roster member", { teamMemberActive: false }],
  ])("rejects a %s invite without consuming it", async (_label, overrides) => {
    const state = installDb([[makeInvite(overrides)]]);
    const caller = appRouter.createCaller(makeContext(INVITED_EMAIL, 451));

    await expect(caller.staffAccess.accept({ token: INVITE_TOKEN })).rejects.toThrow("unavailable");

    expect(state.db.transaction).not.toHaveBeenCalled();
    expect(state.inserted).toEqual([]);
  });

  it("applies the same normalized binding before a new staff account is created and accepted", async () => {
    const state = installDb([[makeInvite()], []]);
    const caller = appRouter.createCaller(makeContext(null));

    await expect(caller.staffAccess.register({
      token: INVITE_TOKEN,
      name: "Disposable Staff",
      email: "  STAFF.IDENTITY@example.test ",
      password: "long-enough-local-password",
    })).resolves.toMatchObject({
      success: true,
      user: { id: 501, email: INVITED_EMAIL, role: "staff" },
    });

    expect(state.inserted).toContainEqual(expect.objectContaining({
      ownerUserId: 101,
      memberUserId: 501,
      teamMemberId: 301,
      active: true,
    }));
  });

  it("keeps an active staff member on the dedicated staff procedure while denying general owner procedures", async () => {
    const staffWorkspace = {
      ownerUserId: 101,
      teamMemberId: 301,
      role: "field_member",
      teamMemberName: "Disposable Staff",
      ownerName: "Disposable Owner",
    };
    const db = {
      select: vi.fn()
        .mockReturnValueOnce(queryChain([staffWorkspace]))
        .mockReturnValueOnce(queryChain([{ id: 999 }])),
    };
    mocks.getDb.mockResolvedValue(db);
    const caller = appRouter.createCaller(makeContext(INVITED_EMAIL, 451));

    await expect(caller.staffAccess.workspaces()).resolves.toEqual([staffWorkspace]);
    await expect(caller.settings.get()).rejects.toThrow("This account has staff access. Use the staff workspace.");
  });

  it("allows a non-staff authenticated account through the general protected procedure guard", async () => {
    const ownerOnlyProbe = router({
      ownerProbe: protectedProcedure.query(() => "allowed"),
    });
    const db = { select: vi.fn(() => queryChain([])) };
    mocks.getDb.mockResolvedValue(db);
    const caller = ownerOnlyProbe.createCaller(makeContext("ordinary.owner@example.test", 901));

    await expect(caller.ownerProbe()).resolves.toBe("allowed");
  });
});
