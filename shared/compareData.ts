// Public comparison data — single source of truth for the /compare page.
//
// Honesty rules enforced by server/comparePageContract.test.ts:
//   - every competitor claim carries a `quote` that appears VERBATIM in the
//     in-repo research file it cites (research dated Oct 2026, with sources)
//   - every competitor claim links a public source URL
//   - every TrueAxis claim lists in-repo evidence paths (tests that pin it)
//   - no superlatives in our own copy — comparisons, not marketing
//   - the "behind" section is mandatory: we publish what competitors do better

export const COMPARE_AS_OF = "2026-10-23";

export type CompetitorKey = "jobber" | "housecallPro" | "serviceTitan";

export interface CompetitorClaim {
  /** Shown on the page. */
  summary: string;
  /** Verbatim phrase from the research file — the test proves this exists. */
  quote: string;
  /** Public source URL for the claim. */
  sourceUrl: string;
  /** Short human label for the source link. */
  sourceLabel: string;
  /** Research file inside docs/working-notes/research/comp-2026-10/ containing the quote. */
  researchFile: string;
}

export interface CompareRow {
  feature: string;
  us: string;
  /** Repo paths (tests/features) that prove our side of the row. */
  usEvidence: string[];
  competitors: Partial<Record<CompetitorKey, CompetitorClaim>>;
}

export const COMPARE_ROWS: CompareRow[] = [
  {
    feature: "Pricing model",
    us: "One flat monthly price per workspace — $49 Starter, $129 Pro, $299 Agency. No per-user fees, no setup fees, cancel anytime.",
    usEvidence: ["shared/plans.ts", "server/pricingStrategy.test.ts"],
    competitors: {
      jobber: {
        summary: "Tiered plans; 2-way texting starts at the Connect tier ($139+/mo) and the Open API is reserved for Plus ($499/mo).",
        quote: "2-way SMS (Connect $139+/mo) and Open API (Plus $499/mo) are paywalled to higher tiers",
        sourceUrl: "https://www.getjobber.com/pricing/",
        sourceLabel: "Jobber pricing",
        researchFile: "jobber-deep.md",
      },
      housecallPro: {
        summary: "Per-user pricing; two-way QuickBooks sync starts at the Essentials tier ($149+/mo), Open API only on MAX ($299+/mo).",
        quote: "Two-way QuickBooks sync is paywalled to Essentials ($149+/mo) and MAX ($299+/mo) plans",
        sourceUrl: "https://www.housecallpro.com/pricing/",
        sourceLabel: "Housecall Pro pricing",
        researchFile: "housecallpro-deep.md",
      },
      serviceTitan: {
        summary: "No public pricing; documented renewal jumps (users report ~$3,000/mo growing to ~$10,000/mo), setup fees from $2,000 to $20,000+, and mandatory multi-year contracts.",
        quote: "mandatory 1–3 year contracts",
        sourceUrl: "https://ustechautomations.com/resources/blog/servicetitan-alternative-home-service-companies-2026",
        sourceLabel: "ServiceTitan cost analysis",
        researchFile: "servicetitan-deep.md",
      },
    },
  },
  {
    feature: "AI voice receptionist",
    us: "Included from the Starter plan: 24/7 inbound receptionist in 10 languages, grounded against your real services and availability (it never invents prices or slots), announces it's an AI, and transfers to a human at any time.",
    usEvidence: ["server/voiceLanguages.test.ts", "test/e2e-voice-hardening.mjs"],
    competitors: {
      jobber: {
        summary: "Receptionist AI is a paid add-on: $29/mo for 30 conversations (plus $0.79 each) or included in the $499/mo Plus plan.",
        quote: "$29/mo add-on for 30 conversations (+$0.79/conversation overage)",
        sourceUrl: "https://help.getjobber.com/en/articles/receptionistpowered-by-jobber-ai/",
        sourceLabel: "Jobber Receptionist AI",
        researchFile: "jobber-deep.md",
      },
      housecallPro: {
        summary: "CSR AI answers calls and web chats 24/7 and books into the calendar.",
        quote: "Customer Service Rep AI (CSR AI) answers incoming calls and web chats 24/7",
        sourceUrl: "https://www.housecallpro.com/resources/news-press/release-notes/fall-is-just-around-the-corner-keep-the-momentum-going-with-our-new-features/",
        sourceLabel: "Housecall Pro release notes",
        researchFile: "housecallpro-deep.md",
      },
      serviceTitan: {
        summary: "Titan Intelligence / Atlas AI suite spans dispatch, pricing, and a conversational copilot — part of an enterprise platform with enterprise pricing.",
        quote: "Titan Intelligence is ServiceTitan's underlying AI suite",
        sourceUrl: "https://www.servicetitan.com/press/servicetitan-introducing-the-next-evolution-of-ai-at-pantheon-2025-keynote",
        sourceLabel: "ServiceTitan press",
        researchFile: "servicetitan-deep.md",
      },
    },
  },
  {
    feature: "Client portal",
    us: "Every client gets a no-login portal link: proof-of-work timeline with job photos and notes, proposal review with package choice, e-signature, invoices, and online booking — no account to create, nothing to forget.",
    usEvidence: ["server/portalClientProfileProjection.test.ts", "server/clientPortalTokenOriginPolicy.test.ts"],
    competitors: {
      jobber: {
        summary: "Client Hub is a mature self-service portal: appointment requests, online quote approval with add-ons and signatures, live tech tracking, and online payments.",
        quote: "Client Hub is a 24/7 self-service customer portal",
        sourceUrl: "https://www.getjobber.com/features/client-hub/",
        sourceLabel: "Jobber Client Hub",
        researchFile: "jobber-deep.md",
      },
    },
  },
  {
    feature: "Inventory, purchase orders & job costing",
    us: "Native from day one: parts inventory with stock levels, purchase orders that receive into stock, and job-cost roll-ups that value consumed stock at what you actually paid when you received it — including job-linked PO totals.",
    usEvidence: ["test/e2e-po-job-costing.mjs"],
    competitors: {
      jobber: {
        summary: "No native parts inventory or deep job costing (vendor receipts, purchase orders) — users lean on third-party tools.",
        quote: "Jobber lacks native parts inventory management and deep job costing (vendor receipts, purchase orders)",
        sourceUrl: "https://contractortoolstack.com/software/jobber/",
        sourceLabel: "Jobber capability review",
        researchFile: "jobber-deep.md",
      },
      housecallPro: {
        summary: "Native inventory tracking with purchase orders is one of Housecall Pro's most-requested missing features.",
        quote: "Advanced native inventory tracking with purchase orders",
        sourceUrl: "https://help.housecallpro.com/en/articles/10828735-hcp-pro-vote-faqs",
        sourceLabel: "Housecall Pro feature votes",
        researchFile: "housecallpro-deep.md",
      },
    },
  },
  {
    feature: "Working offline on the job site",
    us: "Field Mode keeps working with no signal — drafts, photos, and job updates queue locally and sync when connection returns.",
    usEvidence: ["server/fieldModeOfflineQueue.test.ts", "server/fieldModeRecovery.test.ts"],
    competitors: {
      jobber: {
        summary: "The mobile app lacks complete offline access for low-connectivity job sites.",
        quote: "Mobile app lacks complete offline access for low-connectivity job sites",
        sourceUrl: "https://checkthat.ai/brands/jobber/reviews",
        sourceLabel: "Jobber field reviews",
        researchFile: "jobber-deep.md",
      },
      serviceTitan: {
        summary: "Field technicians report the newer mobile app is bloated and slower to navigate on the job.",
        quote: "technicians report that the updated mobile app UI is bloated",
        sourceUrl: "https://www.reddit.com/r/HVAC/comments/1nyv5j1/new_servicetitan_app_is_a_downgrade/",
        sourceLabel: "Technician reports",
        researchFile: "servicetitan-deep.md",
      },
    },
  },
  {
    feature: "Public API & your data",
    us: "A public REST API (v1) is included on every plan — generate API keys in-app, no enterprise gate. One-click full business export, no lock-in, cancel anytime and take everything with you.",
    usEvidence: ["server/publicApiContract.test.ts"],
    competitors: {
      jobber: {
        summary: "Open API access is reserved for the Plus plan ($499/mo).",
        quote: "Open API (Plus $499/mo) are paywalled",
        sourceUrl: "https://www.getjobber.com/pricing/",
        sourceLabel: "Jobber pricing",
        researchFile: "jobber-deep.md",
      },
      housecallPro: {
        summary: "Open API access is gated strictly to the MAX plan ($299+/mo).",
        quote: "Open API access is gated strictly to MAX ($299+/mo)",
        sourceUrl: "https://www.housecallpro.com/pricing/",
        sourceLabel: "Housecall Pro pricing",
        researchFile: "housecallpro-deep.md",
      },
    },
  },
];

export interface BehindEntry {
  area: string;
  honest: string;
  /** Repo path or research doc backing the statement. */
  evidence: string;
}

/** Published, mandatory: what the competitors above do better today. */
export const COMPARE_BEHIND: BehindEntry[] = [
  {
    area: "Native QuickBooks Online sync",
    honest: "Not built yet — we ship honest CSV export today, and we've committed to building native two-way sync when 10 paying companies ask for it (a public counter tracks this in the app). Their sync exists today, though users report duplicate transactions and sync disconnects on both platforms.",
    evidence: "test/e2e-qbo-demand.mjs",
  },
  {
    area: "Native mobile apps",
    honest: "TrueAxis HQ is a responsive web app that works on any phone. Native iOS/Android apps are not shipped yet; Housecall Pro and Jobber both have mature app-store presence.",
    evidence: "docs/working-notes/research/comp-2026-10/housecallpro-deep.md",
  },
  {
    area: "Track record & community",
    honest: "They have years in market, thousands of public reviews, and big user communities. We're new — verify us on a trial, not on our word.",
    evidence: "docs/working-notes/research/comp-2026-10/servicetitan-deep.md",
  },
];
