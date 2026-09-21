import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type StripeAccount from "../drizzle/schema";

const source = (rel: string) => readFileSync(resolve(import.meta.dirname, rel), "utf8");

// ── Behavior: the hard routing boundary ──────────────────────────────────────
const fakeRow = (over: Partial<StripeAccount> = {}): StripeAccount => ({
  id: 1, userId: 42, stripeAccountId: "acct_test_owner", chargesEnabled: true,
  payoutsEnabled: false, detailsSubmitted: true,
  createdAt: new Date(), updatedAt: new Date(), ...over,
} as StripeAccount);

function withDb(rows: StripeAccount[]) {
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => rows }) }) }),
  };
  vi.doMock("./db", () => ({ getDb: async () => db }));
}

beforeEach(() => {
  vi.resetModules();
  vi.unmock("./db");
});

describe("requireClientPaymentsAccount (client-money routing boundary)", () => {
  it("fails honestly when the freelancer has no connected Stripe account — and never falls back to the platform account", async () => {
    withDb([]);
    const { requireClientPaymentsAccount } = await import("./_core/stripeConnect");
    await expect(requireClientPaymentsAccount(42)).rejects.toThrow(/connect your own Stripe account/i);
  });

  it("fails honestly while the connected account is still onboarding", async () => {
    withDb([fakeRow({ chargesEnabled: false })]);
    const { requireClientPaymentsAccount } = await import("./_core/stripeConnect");
    await expect(requireClientPaymentsAccount(42)).rejects.toThrow(/finishing onboarding/);
  });

  it("returns the connected account id once charges are enabled", async () => {
    withDb([fakeRow()]);
    const { requireClientPaymentsAccount } = await import("./_core/stripeConnect");
    await expect(requireClientPaymentsAccount(42)).resolves.toBe("acct_test_owner");
  });

  it("never touches the platform STRIPE_SECRET_KEY — the boundary module has no platform fallback path", () => {
    expect(source("./_core/stripeConnect.ts")).not.toContain("process.env.STRIPE_SECRET_KEY");
  });
});

// ── Source contract: every client-money checkout goes through the connected account ──
describe("Stripe Connect architecture contract", () => {
  const routers = source("./routers.ts");

  it("routes ALL four client-money checkout sites (invoice paylink, public pay-by-link, booking deposit, portal pay) through the owner's connected Stripe account", () => {
    const options = routers.split("{ stripeAccount: stripeAccountId }").length - 1;
    expect(options).toBe(4);
  });

  it("each client-money site resolves the owner's connected account first (marker comments present at all four)", () => {
    expect(routers.split("client money -> freelancer's own connected Stripe account").length - 1).toBe(4);
  });

  it("SaaS subscription billing (the platform's own revenue) does NOT use a connected account", () => {
    const sub = routers.indexOf('mode: "subscription"');
    expect(sub).toBeGreaterThan(0);
    const createStart = routers.lastIndexOf("stripe.checkout.sessions.create(", sub);
    const block = routers.slice(createStart, createStart + 1500);
    expect(block).not.toContain("stripeAccount");
  });

  it("the webhook keeps connected-account state current (account.updated handler)", () => {
    const webhook = source("./stripeWebhook.ts");
    expect(webhook).toContain('case "account.updated"');
    expect(webhook).toContain("chargesEnabled: Boolean(account.charges_enabled)");
  });

  it("migration 0077 creates the connected-accounts table with unique owner and account ids", () => {
    const sql = source("../drizzle/0077_stripe_connect.sql");
    expect(sql).toContain("CREATE TABLE `stripeAccounts`");
    expect(sql).toContain("UNIQUE KEY `stripeAccounts_userId_unique`");
    expect(sql).toContain("UNIQUE KEY `stripeAccounts_stripeAccountId_unique`");
  });

  it("connect onboarding is Express (works with just the platform secret key — no separate OAuth app the developer must create)", () => {
    expect(routers).toContain('type: "express"');
    expect(routers).toContain('type: "account_onboarding"');
  });
});

// ── Developer vs. end-user scoping ────────────────────────────────────────────
describe("developer/owner scoping (support email yes, phone never required)", () => {
  const routers = source("./routers.ts");

  it("account registration never asks for a phone number", () => {
    const reg = routers.indexOf("register: publicProcedure");
    expect(reg).toBeGreaterThan(0);
    expect(routers.slice(reg, reg + 900)).not.toContain("phone");
  });

  it("profile phone is strictly optional — the owner never has to provide one to use the app", () => {
    const upd = routers.indexOf("updateProfile");
    expect(upd).toBeGreaterThan(0);
    const block = routers.slice(upd, upd + 1200);
    const phoneIdx = block.indexOf("phone:");
    if (phoneIdx !== -1) {
      const decl = block.slice(phoneIdx, phoneIdx + 120);
      expect(decl.includes("optional") || decl.includes("safeOptionalString")).toBe(true);
    }
  });

  it("SUPPORT_EMAIL is the developer's public contact and is exposed by the health endpoint", () => {
    expect(source("./_core/index.ts")).toContain("supportEmail: process.env.SUPPORT_EMAIL || null");
    expect(source("../.env.example")).toContain("SUPPORT_EMAIL");
    expect(source("./routers.ts")).toContain("supportEmail: process.env.SUPPORT_EMAIL || null");
  });

  it("the Integration Hub surfaces client-payments Connect as the freelancer's own account", () => {
    const hub = source("../client/src/pages/IntegrationHub.tsx");
    expect(hub).toContain("StripeConnectCard");
    expect(hub).toContain("your own Stripe account");
  });
});
