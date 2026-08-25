import { describe, expect, it } from "vitest";
import { canAcceptUnsignedStripeEvent } from "./stripeWebhook";

describe("Stripe webhook verification policy", () => {
  it("permits unsigned local event inspection only in explicit development mode", () => {
    expect(canAcceptUnsignedStripeEvent("development")).toBe(true);
    expect(canAcceptUnsignedStripeEvent("production")).toBe(false);
    expect(canAcceptUnsignedStripeEvent("test")).toBe(false);
    expect(canAcceptUnsignedStripeEvent("")).toBe(false);
  });
});
