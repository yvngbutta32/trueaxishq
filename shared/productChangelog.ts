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
