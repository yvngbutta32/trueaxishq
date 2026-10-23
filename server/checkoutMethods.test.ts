import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkoutPaymentMethodTypes, createSessionWithMethodFallback } from "./_core/checkoutMethods";

const routers = readFileSync(join(__dirname, "routers.ts"), "utf8");

function stripeStub(
  behavior: (params: any) => { ok?: boolean; error?: { type: string; message: string }; session?: object },
) {
  const calls: { params: any; opts?: any }[] = [];
  const create = vi.fn(async (params: any, opts?: any) => {
    calls.push({ params, opts });
    const result = behavior(params);
    if (result.error) { const e: any = new Error(result.error.message); e.type = result.error.type; throw e; }
    return result.session ?? { id: "cs_test_123", url: "https://checkout.stripe.com/test" };
  });
  return { stripe: { checkout: { sessions: { create } } }, calls };
}

describe("checkoutPaymentMethodTypes (fact-checked vs Stripe docs, Oct 23 2026)", () => {
  it("USD one-time payments get card + ACH + Klarna + Afterpay", () => {
    expect(checkoutPaymentMethodTypes("payment", "usd")).toEqual(["card", "us_bank_account", "klarna", "afterpay_clearpay"]);
  });

  it("USD subscriptions get card + ACH only — BNPL never supports subscription mode (pinned Stripe fact)", () => {
    const types = checkoutPaymentMethodTypes("subscription", "usd");
    expect(types).toContain("us_bank_account");
    expect(types).not.toContain("klarna");
    expect(types).not.toContain("afterpay_clearpay");
  });

  it("non-USD currencies stay card-only (ACH/BNPL eligibility is USD-scoped)", () => {
    expect(checkoutPaymentMethodTypes("payment", "EUR")).toEqual(["card"]);
    expect(checkoutPaymentMethodTypes("payment", "cad")).toEqual(["card"]);
  });
});

describe("createSessionWithMethodFallback (no dead ends)", () => {
  it("retries card-only when the connected account rejects the extended method list, preserving the stripeAccount header", async () => {
    let first = true;
    const { stripe, calls } = stripeStub(() => {
      if (first) { first = false; return { error: { type: "StripeInvalidRequestError", message: "Invalid payment_method_types: your account cannot use us_bank_account" } }; }
      return { session: { id: "cs_after_fallback" } };
    });
    const opts = { stripeAccount: "acct_freelancer123" };
    const session: any = await createSessionWithMethodFallback(stripe as any, {
      mode: "payment", payment_method_types: checkoutPaymentMethodTypes("payment", "usd"), line_items: [],
    } as any, opts);
    expect(session.id).toBe("cs_after_fallback");
    expect(calls).toHaveLength(2);
    expect(calls[0].opts).toEqual(opts);
    expect(calls[1].opts).toEqual(opts);
    expect(calls[1].params.payment_method_types).toEqual(["card"]);
    expect(calls[1].params.mode).toBe("payment");
  });

  it("rethrows non-method errors (network/param bugs must not be masked)", async () => {
    const { stripe } = stripeStub(() => ({ error: { type: "StripeInvalidRequestError", message: "Invalid line_items format" } }));
    await expect(createSessionWithMethodFallback(stripe as any, {
      payment_method_types: checkoutPaymentMethodTypes("payment", "usd"),
    } as any)).rejects.toThrow(/line_items/);
  });

  it("never double-retries a card-only request", async () => {
    const { stripe, calls } = stripeStub(() => ({ error: { type: "StripeInvalidRequestError", message: "payment_method_types unsupported" } }));
    await expect(createSessionWithMethodFallback(stripe as any, { payment_method_types: ["card"] } as any)).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });
});

describe("checkout sites wired through the breadth helper (source contract)", () => {
  it("all five checkout-session creations route through createSessionWithMethodFallback", () => {
    expect(routers.split("createSessionWithMethodFallback(stripe, {").length - 1).toBe(5);
    expect(routers.split("await stripe.checkout.sessions.create({").length - 1).toBe(0);
  });

  it("four client-money sites (paylink, public pay, deposit, portal) use payment-mode methods; the SaaS subscription site uses subscription-mode methods", () => {
    expect(routers.split('checkoutPaymentMethodTypes("payment",').length - 1).toBeGreaterThanOrEqual(4);
    expect(routers.split('checkoutPaymentMethodTypes("subscription", "usd")').length - 1).toBe(1);
  });
});
