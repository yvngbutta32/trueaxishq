/**
 * TrueAxis HQ — Plan & Price Definitions (SINGLE SOURCE OF TRUTH)
 *
 * Shared by the billing server (Stripe inline price_data) and the public
 * pricing page, so marketing can never drift from what we charge.
 *
 * Pricing strategy (owner-set, Oct 2026): maximize revenue while staying fair.
 * - Starter $49/mo: priced at the Jobber/HousecallPro entry band, but includes
 *   flagship features they gate higher (live tracking, client portal, CSV export,
 *   bundled SMS + voice minutes).
 * - Pro $129/mo: HCP Essentials' price point with their MAX-tier feature set —
 *   2-way texting and AI voice cost $249-348+ elsewhere; we bundle both.
 * - Agency $299/mo: matches HCP MAX with white-label + sub-accounts on top;
 *   Buildertrend charges $399+ for less.
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
      "500 bundled SMS/month",
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
    monthlyPrice: 12900,  // $129/mo — HCP Essentials price point with their MAX-tier feature set
    annualPrice: 10320,   // $103.20/mo billed annually ($1,238.40/yr)
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
      "2,000 bundled SMS/month",
      "Priority support",
      "Public REST API access",
    ],
    highlighted: true,
  },
  agency: {
    id: "agency",
    name: "Agency",
    description: "Multi-crew and multi-location operators who need their own brand on everything.",
    monthlyPrice: 29900,  // $299/mo — matches HCP MAX with white-label + sub-accounts on top
    annualPrice: 23920,   // $239.20/mo billed annually ($2,870.40/yr)
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
      "5,000 bundled SMS/month",
    ],
    highlighted: false,
  },
};

export const PLAN_LIST = Object.values(PLANS);

// ── Included business lines (managed voice) ─────────────────────────────
// Minutes on a platform-purchased line are paid by the operator, bundled into
// the subscription price — clients never open a Twilio account. Fair-use
// caps keep a single account from costing more than its plan is worth.
// Free plan: no managed line (bring-your-own-number webhook path still works).
export const VOICE_LINE_MINUTES: Record<string, number> = {
  free: 0,
  starter: 300,
  pro: 1000,
  agency: 2500,
};

export function voiceLineMinutesFor(planId: string | null | undefined): number {
  const key = (planId ?? "free").trim().toLowerCase();
  return VOICE_LINE_MINUTES[key] ?? 0;
}

// ── Bundled SMS (platform-sent client notifications) ────────────────────
// Every SMS the platform delivers on the operator's Twilio account costs
// real money (~$0.008 base + ~$0.004 carrier surcharge per segment in the
// US). Like voice minutes, SMS is bundled into the plan under a fair-use
// cap. SMS and voice are SEPARATE buckets by design — a voice minute costs
// ~10x one SMS segment, so pooling them invites margin collapse.
// Free plan: a small transactional allowance (one-way notifications stay
// working; volume texting is a paid feature).
export const SMS_INCLUDED_MONTHLY: Record<string, number> = {
  free: 50,
  starter: 500,
  pro: 2000,
  agency: 5000,
};

export function smsIncludedFor(planId: string | null | undefined): number {
  const key = (planId ?? "free").trim().toLowerCase();
  return SMS_INCLUDED_MONTHLY[key] ?? SMS_INCLUDED_MONTHLY.free;
}

// ── Plan-gated features (server-enforced, client-reflected) ────────────
// The Pro and Agency plans unlock the advanced operating layer. Free and
// Starter are honest, complete tools for their tier — never crippled traps.
export const PRO_FEATURES = [
  "liveTracking", "routeOptimizer", "capacityForecast", "priceBook",
  "customReports", "subcontractors", "restApi", "webhooks", "voiceAgent",
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
  voiceAgent: "AI voice receptionist",
};

export function planUnlocksProFeature(planId: string | null | undefined, feature: ProFeature): boolean {
  const plan = (planId ?? "free").trim().toLowerCase();
  return (plan === "pro" || plan === "agency") && (PRO_FEATURES as readonly string[]).includes(feature);
}

export function featureEntitlements(planId: string | null | undefined): Record<ProFeature, boolean> {
  const entries = PRO_FEATURES.map(feature => [feature, planUnlocksProFeature(planId, feature)] as const);
  return Object.fromEntries(entries) as Record<ProFeature, boolean>;
}
