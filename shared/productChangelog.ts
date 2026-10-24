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
    date: "2026-10-24",
    title: "Review links get the right mobile keyboard",
    tag: "Clients",
    commit: "45eaeb4",
    description: "The public-review link field in Settings now opens the proper URL keyboard on phones (type=url with inputMode, autocapitalize and autocorrect off), so pasting your Google review link on a phone stops mangling it. Found during a full click-everything pass of every dashboard panel on a 390px phone viewport; verified live on the production build.",
  },
  {
    date: "2026-10-24",
    title: "Public comparison page — every claim cited, including where we're behind",
    tag: "Platform",
    commit: "9a3e17d",
    description: "A new /compare page puts TrueAxis HQ next to Jobber, Housecall Pro, and ServiceTitan with none of the usual marketing gloss. Every competitor statement on the page is quoted from our published Oct 2026 research and links to its public source; every TrueAxis statement lists the test file that proves it; and an automated contract test re-verifies all of it on every run, so a stale or unverifiable claim fails the build instead of shipping. The page also carries a mandatory 'where they're ahead of us' section — native QuickBooks sync, app-store presence, and track record are stated plainly, because a one-sided comparison is just an ad.",
  },
  {
    date: "2026-10-24",
    title: "Public booking honesty — the slots you see are exactly the slots we accept",
    tag: "Clients",
    commit: "65c3401",
    description: "A live click-everything pass that drove the real customer booking wizard end to end caught a defect that only shows up with real bookings: the public booking page greyed out only the exact times already taken, while the booking engine refuses anything that overlaps an existing job (length and travel buffer included). A customer could pick 10:30 AM, fill the whole form, and only then hit 'slot unavailable'. Worse, bookings created from the dashboard stored their times in a different format than public ones, which could make a busy day read as fully booked when it wasn't. The page now applies the identical availability rule the server enforces — dashboard-created and public bookings count the same way — so a bookable slot on screen always goes through, and a greyed slot tells you why. The AI scheduling assistant also got a guardrail: if it ever returns malformed suggestions, they're dropped with a clear message instead of breaking the New Booking dialog.",
  },
  {
    date: "2026-10-24",
    title: "Live QA sweep hardening — honest money validation, clickable mobile nav, clean error messages",
    tag: "Platform",
    description: "A click-everything interactive QA pass (all dashboard panels, public pages, mobile, and real end-to-end flows) caught three real defects that only show up with real usage. (1) A rate field with stray letters used to crash the server into a raw database error; money fields now validate with a plain-English message ('Enter a valid rate like 85 or 85.50'), and the client record is never half-saved. (2) On phones, while the All-features sheet was open, its dimmed backdrop swallowed every bottom-nav button — including the toggle that closes it; the nav now stays live above the sheet, matching how every major app's mobile drawer behaves. (3) Validation and server errors now surface as one readable sentence in the toast instead of a raw JSON blob, and unexpected server faults are masked behind the scenes in production. The interactive QA harness itself now drives the full 3-step customer booking wizard to completion (Booked!) and is wired into the release checklist.",
  },
  {
    date: "2026-10-24",
    title: "Design deep-pass — real Inter everywhere, seamless panel navigation",
    tag: "Platform",
    description: "A design audit found the self-hosted Inter font files only covered Vietnamese and Latin-extended character ranges — basic A-Z text matched no font file at all, so the entire app had silently been rendering a system fallback instead of Inter. Shipped the correct Latin subsets (the typeface you were supposed to see all along), preloaded the primary font file so headlines never swap after first paint, and cached font files for a year so repeat visits download zero font bytes. Dashboard navigation now prefetches each section's code the moment you hover it (and warms the busiest sections during idle time), so panel switches feel instant; the loading state is a content-shaped skeleton instead of a spinner. Tables and dashboards now use tabular numerals, so money and quantities line up cleanly, and headings wrap with balanced line breaks.",
  },
  {
    date: "2026-10-24",
    title: "Deep security audit — async crash guard, complete data export, nightly backups",
    tag: "Security",
    commit: "ded6fcf",
    description: "A full adversarial audit of the platform (server, data layer, frontend, deployment) verified every defense end to end with 88 live attack checks — cross-tenant access, token tampering, SQL injection, stored XSS, CSRF, brute force — and fixed the four real weaknesses it found. (1) About twenty public API routes could hang forever if the database hiccuped mid-request; every one now fails safely and answers honestly. (2) The one-click business export was missing twelve newer data types (voice calls, review requests, client portal messages, approval requests, and more) — your complete business now really is complete, and a new guard keeps future tables from silently falling out. (3) Server installs now schedule automatic nightly database backups with 14-day and monthly retention. (4) Restarts drain in-flight database work cleanly before exiting.",
  },
  {
    date: "2026-10-23",
    title: "Public review engine — turn finished jobs into Google reviews",
    tag: "Clients",
    description: "Happy clients are the only marketing that compounds, so completed jobs can now ask for a public review on the spot: paste your Google review link once (Settings → Public Reviews), and a one-tap “Ask for a review” button appears on every completed job — or let the app ask automatically 24 hours after a job completes. Anti-spam rules are strict and honest: never more than one ask per job, never more than one per client per 90 days, SMS only to clients who explicitly opted in (with STOP instructions), and every send, failure, and skip is logged in plain sight — the ask log shows the truth, not a marketing claim. Review asking is included on every plan; competitors gate it behind their top tiers.",
  },
  {
    date: "2026-10-23",
    title: "Dependency security sweep + verified fresh installs",
    tag: "Platform",
    description: "A full production audit patched every known vulnerability in the app's shipping dependencies (prod audit now reports zero), and — the bigger catch — revealed that a fresh database install had been silently broken by recent migrations: they applied on existing databases but aborted on a brand-new one. The migration chain is repaired, and two new guards now prove it: an automated test that holds every migration ledger entry to account, and a one-command fresh-install proof that builds the app, applies all migrations to an empty database, boots it, and runs the full smoke suite. Also cleaned up: a leftover native browser confirm dialog replaced with the in-app version, and a dead ADMIN_EMAILS config entry removed from the setup template.",
  },
  {
    date: "2026-10-23",
    title: "QR asset labels — equipment that sells its own service",
    tag: "Field Ops",
    description: "Every customer asset can now wear a QR label (Job Workspace → Customer assets → QR label). Print it, stick it on the unit, and any customer with a phone camera lands on a private page showing that equipment's service history — plus a one-tap form to request service. The request lands in your queue with the asset already identified: no “which unit is this?” phone tag. Labels are honest about privacy: the public page never shows your private notes or the client's contact details, unknown or deactivated labels are plain 404s, and deactivating an asset kills its label instantly. Label printing is unlimited on every plan; only labeled assets are ever public.",
  },
  {
    date: "2026-10-23",
    title: "Voice receptionist: grounded, honest, and fluent in ten languages",
    tag: "Integrations",
    description: "Your AI receptionist got the three things research shows customers actually judge it on. It is grounded: it never invents prices, availability, or appointment slots, and quietly captures interest as a lead instead of guessing. It is honest: every default greeting introduces itself as an AI assistant, and pressing zero always reaches a person when you set a transfer number — or a straight voicemail, never a dead line, when you haven't. And it is fluent: answer in English, Spanish, French, Mandarin, Cantonese, Tagalog, Vietnamese, Arabic, Korean, or Punjabi, and callers can press 9 mid-call to hear the language menu and switch on the spot — every option announced in its own language, with matching speech recognition and native voices for the whole call after that.",
  },
  {
    date: "2026-10-16",
    title: "Paper Medium theme + optional dark mode — comfortable in any light",
    tag: "Platform",
    description: "We rebuilt the entire color system so no surface in the product is pure white. The new default, Paper Medium, sits in a restful warm ivory band — bright enough for sunny job sites, soft enough for a 10-hour day — with deepened borders so cards and forms stay crisp, and text contrast that actually improves as backgrounds soften (all text passes WCAG AA, most well beyond). Every one of the 2,700+ hard-coded colors across the app now flows through one design-token system. And if you prefer working at night: a one-tap dark mode (warm charcoal, never black) is available from any page, remembers your choice, and never flashes the wrong theme on load.",
  },


  {
    date: "2026-10-09",
    title: "Agency owners can run managed client workspaces (sub-accounts)",
    tag: "Platform",
    description: "The Agency plan's flagship capability is here: operators can create up to ten separate, fully-isolated workspaces — one per crew, location, or managed client business. Each workspace signs in with its own email, sees only its own clients, jobs, and invoices (isolation is enforced server-side on every query), and carries the complete Pro feature set under the Agency subscription. Owners can suspend or reactivate a workspace at any time — suspended workspaces keep every byte of data but cannot sign in — and reset passwords when a client loses one. Every action is audit-logged.",
  },

  {
    date: "2026-10-08",
    title: "Explore with sample data — one click in, one click out",
    tag: "Platform",
    description: "New owners no longer face empty dashboards. The Import panel can seed four clearly-marked sample clients with jobs, bookings, and invoices to explore every screen with realistic data, then remove all of it with a single click. Sample records carry a “Sample — ” prefix and reserved contact details so they can never be mistaken for real work, the removal matches only prefixed rows so real records are untouchable, and sample data is excluded from first-hour setup progress — exploring never fakes “operational.”",
  },
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
