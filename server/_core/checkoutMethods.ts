import type Stripe from "stripe";
// ── Checkout payment-method breadth (ACH + BNPL) ─────────────────────────────
// Fact-checked against Stripe docs (Oct 23 2026):
// - ACH Direct Debit (us_bank_account): USD, US. Supported in Checkout payment
//   AND subscription modes (Stripe payment-method support matrix,
//   docs.stripe.com/payments/payment-methods/payment-method-support).
// - Klarna + Afterpay (afterpay_clearpay): BNPL methods support Checkout
//   PAYMENT mode only — never subscription or setup. USD among supported
//   currencies.
// - Instant payouts (1% fee, docs.stripe.com/connect/instant-payouts) are
//   connected-account dashboard configuration, not API/code work.
// Eligibility is per-account: a connected (freelancer) account that has not
//   enabled ACH/BNPL in its Stripe dashboard rejects session creation with
//   those types, so createSessionWithMethodFallback retries card-only — the
//   checkout always works, and extra methods light up the moment the account
//   enables them (free dashboard config, no code change).

export type CheckoutMode = "payment" | "subscription";

/** USD one-time payments: card + ACH + Klarna + Afterpay (BNPL is payment-mode only). */
export function checkoutPaymentMethodTypes(mode: CheckoutMode, currency: string): Stripe.Checkout.SessionCreateParams.PaymentMethodType[] {
  const cur = currency.toLowerCase();
  if (cur !== "usd") return ["card"]; // ACH/BNPL eligibility above is USD-only
  if (mode === "subscription") return ["card", "us_bank_account"]; // no BNPL in subscription mode
  return ["card", "us_bank_account", "klarna", "afterpay_clearpay"];
}

function isPaymentMethodRejection(err: unknown): boolean {
  const e = err as { type?: string; message?: string };
  return e?.type === "StripeInvalidRequestError" &&
    !!e.message && /payment[_ ]method/i.test(e.message);
}

/**
 * Creates a Checkout Session, retrying card-only if the (connected) account
 * rejects the extended method list. Never breaks a checkout: an account that
 * has not enabled ACH/BNPL simply gets card-only until it flips the free
 * dashboard switch — no code change needed.
 */
export async function createSessionWithMethodFallback(
  stripe: Pick<Stripe, "checkout">,
  params: Stripe.Checkout.SessionCreateParams,
  opts?: Stripe.RequestOptions,
): Promise<Stripe.Checkout.Session> {
  try {
    return await stripe.checkout.sessions.create(params, opts);
  } catch (err) {
    const requested = params.payment_method_types ?? [];
    if (requested.length <= 1 || !isPaymentMethodRejection(err)) throw err;
    return await stripe.checkout.sessions.create({ ...params, payment_method_types: ["card"] }, opts);
  }
}
