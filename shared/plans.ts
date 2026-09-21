/**
 * TrueAxis HQ — Plan & Price Definitions (SINGLE SOURCE OF TRUTH)
 *
 * Shared by the billing server (Stripe inline price_data) and the public
 * pricing page, so marketing can never drift from what we charge.
 *
 * Pricing strategy (owner-set, Sept 2026): affordable entry, but never undersold.
 * - Starter $49/mo: priced at the Jobber/HousecallPro entry band, but includes
 *   flagship features they gate higher (live tracking, client portal, CSV export).
 * - Pro $99/mo: the sweet spot — at HCP's mid tier with our full feature set.
 * - Agency $299/mo: white-label + sub-accounts is enterprise-grade value;
 *   Buildertrend charges $399+ for less. We don't compete on being the cheapest.
 * - Annual = 20% discount, applied consistently across all plans.
 * Prices are in cents. Stripe uses inline price_data (no dashboard setup).
 */

export type PlanId = "starter" | "pro" | "agency";

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  monthlyPrice: number; // in cents
  annualPrice: number;  // in cents (per month, billed annually)
  features: string[];
  highlighted: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: "Starter",
    description: "Everything a solo operator needs to run like a full crew.",
    monthlyPrice: 4900,   // $49/mo
    annualPrice: 3920,    // $39.20/mo billed annually ($470.40/yr)
    features: [
      "Up to 20 active clients",
      "AI client intake forms",
      "Smart scheduling (basic)",
      "Automated invoicing",
      "Email follow-ups (5/month)",
      "Analytics dashboard",
      "1 booking page",
      "Live 'on my way' client tracking",
      "Client portal",
      "QuickBooks-format CSV export",
      "Email support",
    ],
    highlighted: false,
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "The full operation: dispatch, routing, subs, and Pulse AI.",
    monthlyPrice: 9900,   // $99/mo
    annualPrice: 7920,    // $79.20/mo billed annually ($950.40/yr)
    features: [
      "Unlimited active clients",
      "AI client intake + lead scoring",
      "Smart scheduling (advanced)",
      "Automated invoicing + reminders",
      "Unlimited AI follow-ups",
      "Route planning + capacity forecast",
      "Zero-install subcontractor jobs",
      "Client Pulse AI™",
      "Full analytics + insights",
      "Custom booking page + branding",
      "SMS notifications",
      "Priority support",
      "Public REST API access",
    ],
    highlighted: true,
  },
  agency: {
    id: "agency",
    name: "Agency",
    description: "Multi-crew and multi-location operators who need their own brand on everything.",
    monthlyPrice: 29900,  // $299/mo
    annualPrice: 23920,  // $239.20/mo billed annually ($2,870.40/yr)
    features: [
      "Everything in Pro",
      "Up to 10 sub-accounts",
      "White-label booking pages",
      "Team management dashboard",
      "Shared client database",
      "Custom AI training",
      "Dedicated account manager",
      "SLA support",
      "Custom integrations",
      "Revenue sharing tools",
    ],
    highlighted: false,
  },
};

export const PLAN_LIST = Object.values(PLANS);

// ── Plan-gated features (server-enforced, client-reflected) ────────────
// The Pro and Agency plans unlock the advanced operating layer. Free and
// Starter are honest, complete tools for their tier — never crippled traps.
export const PRO_FEATURES = [
  "liveTracking", "routeOptimizer", "capacityForecast", "priceBook",
  "customReports", "subcontractors", "restApi", "webhooks",
] as const;
export type ProFeature = typeof PRO_FEATURES[number];

export const PRO_FEATURE_LABELS: Record<ProFeature, string> = {
  liveTracking: "Live customer tracking links",
  routeOptimizer: "Route optimization & geocoding",
  capacityForecast: "Capacity forecasting",
  priceBook: "Price book",
  customReports: "Custom report builder",
  subcontractors: "Subcontractor workflow",
  restApi: "Public REST API keys",
  webhooks: "Outbound webhooks",
};

export function planUnlocksProFeature(planId: string | null | undefined, feature: ProFeature): boolean {
  const plan = (planId ?? "free").trim().toLowerCase();
  return (plan === "pro" || plan === "agency") && (PRO_FEATURES as readonly string[]).includes(feature);
}

export function featureEntitlements(planId: string | null | undefined): Record<ProFeature, boolean> {
  const entries = PRO_FEATURES.map(feature => [feature, planUnlocksProFeature(planId, feature)] as const);
  return Object.fromEntries(entries) as Record<ProFeature, boolean>;
}
