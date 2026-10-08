/* TrueAxis HQ — Published product changelog (single source of truth).
 * Rendered by /changelog and the Home footer modal. Entries are real shipped
 * changes tied to commits in the main branch; newest first. When you ship
 * something, add an entry here the same day — the public changelog is a
 * trust feature, so it must never drift from the code.
 */
export interface ChangelogEntry {
  /** Ship date, ISO 8601 — the day it reached main. */
  date: string;
  title: string;
  description: string;
  /** Feature area tag shown as a small badge. */
  tag: "Platform" | "Field Ops" | "Money" | "Clients" | "Integrations" | "Security" | "Reporting";
  /** Short commit ref on main, for traceability. */
  commit?: string;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-10-08",
    title: "The landing page now moves as you scroll",
    tag: "Platform",
    description: "Design pass, part two: the public site earned the same motion language the dashboard got. Sections now rise into place the first time they enter your view instead of sitting flat — the stats strip and feature cards cascade one after another, the product demo and AI showcase arrive as composed blocks, and the booking page and client portal greet you with the same soft entrance. Each section reveals exactly once and never replays, and customers with reduced-motion enabled in their OS see everything instantly, completely still.",
  },
  {
    date: "2026-10-08",
    title: "A motion system for the whole app",
    tag: "Platform",
    description: "Design pass: one easing family and three durations now govern every animation. Dashboard panels enter with the same 320ms rise every time instead of snapping in, the overview's stat cards cascade in sequence, every button that didn't already have its own motion gets consistent 120ms tactile press feedback, headings balance their line breaks, tables render tabular numerals so money columns stop jittering, and the scrollbar and text selection now carry the brand's warm neutrals and amber. All of it respects prefers-reduced-motion: customers who turn animations off in their OS get a completely still interface.",
  },
  {
    date: "2026-10-08",
    title: "What the price card says is what you get",
    tag: "Platform",
    description: "We audited every line of every plan against the running product and fixed the drift in both directions. Starter now truly includes live 'on my way' tracking at $49 — competitors hold that until their $149+ tiers — and the card lists the 300 bundled voice minutes and 500 SMS it ships with. The Pro card now names everything $129 actually unlocks, including the price book, custom reports, outbound webhooks, and the AI voice receptionist with 1,000 bundled minutes. Agency's white-label booking pages are real: your public booking page drops our branding and carries yours. And the claims we couldn't stand behind — sub-accounts, SLA support, dedicated account managers, invented client caps — are off the cards until the day they ship.",
  },
  {
    date: "2026-10-08",
    title: "Bundled SMS with a fair-use meter — no surprise bills",
    tag: "Money",
    description: "Every plan now bundles monthly client texting into the subscription: 50 SMS/mo on Free, 500 on Starter, 2,000 on Pro, 5,000 on Agency — covering booking confirmations, reminders, check-ins, and subcontractor invites. The Integration Hub SMS card shows a live usage meter, and once the allowance is used up we stop sending with an honest upgrade message instead of billing anyone extra. Unlike Jobber and Housecall Pro, which hold two-way texting behind their $249–$329 tiers, texting is included from the first paid plan.",
  },

  {
    date: "2026-10-08",
    title: "Included business lines — one click, no Twilio account",
    tag: "Money",
    description: "Paid plans can now add a managed business line from Integration Hub with one click: we provision a local number on the operator's Twilio account and wire it to your voice settings automatically. You never open a Twilio account, never enter credentials, and never pay another website — minutes are bundled into your plan under a fair-use cap (300/mo Starter, 1,000/mo Pro, 2,500/mo Agency), with a live usage meter on the card. Pointing your existing Twilio number at us (bring-your-own) still works and is never capped, since those minutes bill to your own account.",
  },
  {
    date: "2026-10-08",
    title: "AI Voice Receptionist — your business line, answered",
    tag: "Platform",
    description: "Every market leader shipped an AI phone agent; we matched it at $0 fixed cost. A Twilio number pointed at /api/voice/answer?u=<your id> now greets callers, answers business questions, and captures voice leads straight into your pipeline — with a full voicemail fallback on every plan, and AI conversation mode on Pro. Calls are signature-verified and fail closed; transcripts and outcomes live under Integration Hub → Voice Receptionist, with a dry-run TwiML preview so you can hear exactly what callers hear before a phone ever rings.",
  },
  {
    date: "2026-09-19",
    title: "SMS code sign-in (magic links without the link)",
    description:
      "Sign in with a one-time 6-digit texted code instead of a password — offered only once your Twilio account is connected. Codes are hashed at rest, expire in 10 minutes, allow at most 5 wrong attempts, and never bypass two-factor authentication. Asking for a code on an unknown number returns the same response as a real one, so nobody can probe which phones belong to accounts.",
    tag: "Security",
    commit: "ffb58e5",
  },

  {
    date: "2026-09-19",
    title: "SMS booking confirmations, reminders, and check-ins (Twilio)",
    description:
      "Clients who opt in on your booking page now get a text when the appointment is confirmed, a reminder the day before, and a follow-up after the session — sent through Twilio, with every message gated on an explicit opt-in recorded on the client record. Until you add Twilio credentials, messages log to the server console so nothing silently fails. Test your setup from Integration Hub with one tap.",
    tag: "Integrations",
    commit: "5c62b1e",
  },

  {
    date: "2026-09-19",
    title: "Guided data import — switch from any competitor in an afternoon",
    description:
      "Export your client list or price book from Jobber, Housecall Pro, ServiceTitan, ServiceM8, or Buildertrend as CSV, and the import wizard detects the source, maps the columns, and shows you a full preview — including duplicates against your existing records — before a single row is written. No migration fees, no sales calls, no password for your old system.",
    tag: "Clients",
    commit: "1196df9",
  },

  {
    date: "2026-09-19",
    title: "Public REST API v1 + Zapier/Make guide",
    description:
      "Connect TrueAxis HQ to Zapier, Make, or your own tools with owner-issued API keys. Nine endpoints cover clients, jobs, invoices, and proposals — every request scoped to your account, rate-limited at 600/min with clear error codes.",
    tag: "Integrations",
    commit: "dfc44f3",
  },
  {
    date: "2026-09-19",
    title: "Custom report builder — included in every plan",
    description:
      "Build your own reports from five datasets (jobs, invoices, time entries, expenses, proposals) with count/value/hours measures, status/client/month/category groupings, live previews, and CSV export. Competitors gate reporting behind higher tiers; here it ships free.",
    tag: "Reporting",
    commit: "8bcddd1",
  },
  {
    date: "2026-09-18",
    title: "Inventory + purchase orders with truck-level tracking",
    description:
      "Track stock at the warehouse and on every truck, receive against purchase orders, and auto-deduct materials from job-phase budgets. No more 'who has the last box of fittings' phone calls.",
    tag: "Field Ops",
    commit: "766fd83",
  },
  {
    date: "2026-09-18",
    title: "Hybrid workflows — day-tickets and multi-phase jobs in one record",
    description:
      "Use a job as a quick same-day ticket, or split it into phases with budgets, dependencies, and phase-level completion — no more choosing between small-job and project tooling.",
    tag: "Field Ops",
    commit: "00b8c21",
  },
  {
    date: "2026-09-18",
    title: "Fully offline Field Mode",
    description:
      "Crews keep working through dead zones: job data, forms, and photos queue on-device and sync automatically on reconnect, with a visible sync state and conflict-safe merges.",
    tag: "Field Ops",
  },
  {
    date: "2026-09-18",
    title: "Deposit collection at booking",
    description:
      "Secure the date before it's held: clients pay a deposit as part of the booking flow, with automated follow-up for unpaid deposits.",
    tag: "Money",
  },
  {
    date: "2026-09-18",
    title: "Deployment hardening pass",
    description:
      "Graceful server shutdown, multi-stage non-root Docker with healthcheck, strict production port binding, and a dependency audit that patched all 12 known CVEs.",
    tag: "Platform",
    commit: "3d9b0b1",
  },
  {
    date: "2026-09-18",
    title: "TOTP two-factor authentication + active session management",
    description:
      "Add an authenticator app to your login, see every active session, and revoke any of them instantly. Full audit logging of security events included.",
    tag: "Security",
  },
  {
    date: "2026-09-17",
    title: "Unified Client Hub journey",
    description:
      "One timeline per client: bookings, invoices, proposals, messages, and job history in a single scroll, with client-pulse scoring surfaced where you act.",
    tag: "Clients",
  },
  {
    date: "2026-09-17",
    title: "Quote-to-cash on proposal signature",
    description:
      "When a client signs a proposal, the job, invoice, and calendar entries are created automatically — signed paperwork turns into scheduled, billable work with zero double entry.",
    tag: "Money",
    commit: "547575c",
  },
  {
    date: "2026-09-17",
    title: "Google Calendar two-way sync",
    description:
      "Jobs and bookings sync to your Google Calendar, and events created there flow back in — authorized per owner, with connection-state integrity (no fake 'connected' states).",
    tag: "Integrations",
    commit: "08ba874",
  },
  {
    date: "2026-09-17",
    title: "Good/Better/Best proposals + price book",
    description:
      "Package your services into Good/Better/Best options with a Recommended badge, backed by a reusable price book for one-tap line items in the proposal builder.",
    tag: "Money",
  },
];

/** Formats an ISO date for public display, e.g. 'September 19, 2026'. */
export const formatChangelogDate = (iso: string): string =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
