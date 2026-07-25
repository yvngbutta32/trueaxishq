/**
 * SkillBridge AI — Stripe Product & Price Definitions
 *
 * These are created dynamically via the Stripe API on first checkout.
 * Price IDs are stored in environment variables after creation.
 * For simplicity in this integration we use inline price data so no
 * pre-created products are required in the Stripe dashboard.
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
    description: "Perfect for freelancers just getting started.",
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
      "Email support",
    ],
    highlighted: false,
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "For growing service businesses ready to scale.",
    monthlyPrice: 9900,   // $99/mo
    annualPrice: 7920,    // $79.20/mo billed annually ($950.40/yr)
    features: [
      "Unlimited active clients",
      "AI client intake + lead scoring",
      "Smart scheduling (advanced)",
      "Automated invoicing + reminders",
      "Unlimited AI follow-ups",
      "Full analytics + insights",
      "Custom booking page + branding",
      "SMS notifications",
      "Priority support",
      "API access",
    ],
    highlighted: true,
  },
  agency: {
    id: "agency",
    name: "Agency",
    description: "For coaches and consultants managing a team.",
    monthlyPrice: 19900,  // $199/mo
    annualPrice: 15920,   // $159.20/mo billed annually ($1910.40/yr)
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
