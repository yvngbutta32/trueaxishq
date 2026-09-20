/**
 * TrueAxis HQ — Stripe Product & Price Definitions.
 *
 * Plans/prices live in shared/plans.ts (single source of truth, used by both
 * billing and the public pricing page so they can never drift). Prices use
 * Stripe inline price_data — no pre-created Stripe products are required.
 */
export type { PlanId, Plan } from "../shared/plans";
export { PLANS, PLAN_LIST } from "../shared/plans";
