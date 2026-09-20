# TrueAxis HQ

The all-in-one operations platform for independent home-service businesses —
booking, scheduling, dispatch, quoting, invoicing, client portal, proposals,
intake forms, automations, and reporting in a single deployable app.

## Running at $0 (no external companies required)

TrueAxis HQ is fully usable with **zero paid services**. A contract test
(`server/zeroCostLaunch.test.ts`) pins this so it cannot regress:

| Capability | Free path (no provider) |
|---|---|
| Payments | Mark invoices paid manually (cash/check/transfer); Stripe online checkout is optional |
| Accounting export | QuickBooks-format CSV built in — no Intuit subscription |
| Email | Console/in-app notification fallback; any SMTP relay works (self-hosted Postfix is free) |
| SMS | Copy-link flows work with zero credentials; Twilio is optional |
| AI features | Honest "not configured" state; any OpenAI-compatible endpoint works, incl. self-hosted Ollama (free) |
| Geocoding / maps | Keyless OpenStreetMap + Nominatim (free, no account); self-hostable |
| Calendar sync | ICS feed built in — no Google account needed |
| Fonts / CDN | Self-hosted; zero third-party requests on page load |
| Hosting | Any Linux host or the included Dockerfile; no platform lock-in |
| Mobile | PWA install (no app store fees) |

Nothing in that table requires an account, key, or subscription. Optional
providers only ever *add* capability (live email/SMS/cards); they are never
required for the app to function, and every one degrades honestly when unset.

### Selling also costs $0 fixed (revenue economics)

You can charge customers from day one with **zero fixed operating cost**:

- **Stripe standard account**: no setup fee, no monthly fee, no minimums. Fees are
  purely usage-based — ~2.9% + 30¢ per transaction, charged only when money comes in.
  No sale, no fee. Plans use inline `price_data`, so there's not even a Stripe
  dashboard configuration step.
- **Hosting**: any Linux box — including free-tier cloud (e.g. Oracle Cloud Always
  Free), a home server, or a cheap VPS. The app is a single Node process + MySQL.
- **Everything else**: already $0 per the table above.

Break-even math on the Starter plan ($49/mo): Stripe takes ~$1.72 per charge, you
net ~$47.28. Fixed cost is $0, so the business is profitable from the first sale.
The only cost that can ever exist is a percentage of revenue you chose to collect.

## Stack

| Layer     | Technology |
|-----------|------------|
| Frontend  | React 18 + TypeScript, Vite, TailwindCSS, wouter, TanStack Query, tRPC client |
| Backend   | Express + tRPC, Drizzle ORM, Zod validation, nodemailer (SMTP) |
| Database  | MySQL (mysql2 pool) |
| Payments  | Stripe (checkout + webhook-driven status) |
| Calendar  | Google Calendar API (OAuth), iCal feed export |
| Tests     | Vitest (462 tests), CI-gated typecheck + build + bundle budget |

## Quick start

```bash
pnpm install
pnpm db:push        # create/apply schema (requires DATABASE_URL)
pnpm dev            # dev server with HMR on :3000
```

Production:

```bash
pnpm build         # Vite client build + esbuild server bundle
pnpm start         # NODE_ENV=production node dist/index.js
```

## Environment variables

Copy `.env.example` to `.env` and fill in real values. Only `DATABASE_URL` and
`JWT_SECRET` are strictly required to boot; everything else degrades gracefully
(see notes in `.env.example`).

## Scripts

| Script             | Purpose |
|--------------------|---------|
| `pnpm dev`         | Development server with watch/reload |
| `pnpm build`       | Client + server production build |
| `pnpm start`       | Run the production bundle |
| `pnpm check`       | TypeScript typecheck (CI gate) |
| `pnpm test`        | Vitest suite (CI gate) |
| `pnpm check:bundle`| Client bundle size budget (CI gate) |
| `pnpm db:push`     | Generate + apply Drizzle migrations |
| `pnpm format`      | Prettier |

## Production operations

- **Graceful shutdown**: SIGTERM/SIGINT stop the job scheduler and drain
  in-flight requests (10s hard cap). Deploy platforms can restart safely.
- **Port binding**: in production the server binds exactly `PORT` and fails
  fast if taken (port-scanning is dev-only).
- **Health check**: `GET /api/health` returns DB connectivity status.
- **Background jobs**: 9 scheduled jobs (reminders, recurring invoices,
  follow-ups, calendar sync, automations) run every hour in-process.
  An authenticated cron hook is also available at
  `POST /api/scheduled/dailyDigest` (requires `DIGEST_CRON_SECRET`).
- **Security**: per-IP rate limiting, account lockout, suspicious payload
  detection, full security headers (CSP/HSTS), DB-audited security events —
  see `server/security.ts`.
- **2FA**: TOTP-based two-factor auth for owner accounts; active sessions are
  manageable from Settings.

## Deployment

Any Node 20+ platform works (Railway, Render, Fly, a Docker host):

1. Provision a MySQL database and set `DATABASE_URL`.
2. Set all env vars from `.env.example`.
3. Run `pnpm install && pnpm build`, then `pnpm db:push` once.
4. Start with `pnpm start`; point the platform health check at `/api/health`.

A multi-stage `Dockerfile` is included for container-based deploys:

```bash
docker build -t trueaxis-hq .
docker run -p 3000:3000 --env-file .env trueaxis-hq
```

## Repository layout

```
client/   React app (public pages, dashboard panels, client portal)
server/   Express + tRPC routers, background jobs, security, PDF/iCal
shared/   Types shared between client and server
drizzle/  Schema + 70 migrations
docs/     Audit history, research, launch checklists
scripts/  Admin bootstrap + CI bundle-budget check
```

## Launch day checklist

1. **Deploy**: any Linux host — `docker compose up` or Node 20+ with `NODE_ENV=production`, MySQL, and `JWT_SECRET` set.
2. **First account**: set `BOOTSTRAP_INVITE_CODE` (single-use) and create the first owner account, then unset it.
3. **Smoke test the deployment**: `BASE_URL=https://your-domain.com ./scripts/smoke.sh` — ten checks: health, app shell, self-hosted fonts, pricing/status/security pages, API auth gates (public REST + tRPC metrics must 401 anonymous), and token pages 404 honestly.
4. **Optional providers** (none required): SMTP for live email, Stripe live keys for online payments, Twilio for SMS. Each degrades honestly when unset.
5. **Sell**: plans and the pricing page share one source of truth (`shared/plans.ts`), so what the page says is what Stripe charges.

## First-run setup (creating the first account)

Registration is invite-only: existing owners mint invite codes from Settings.
That leaves a chicken-and-egg problem on a brand-new install — there is no
owner yet to mint the first code. Solve it with the bootstrap code:

1. Set `BOOTSTRAP_INVITE_CODE=<your-code>` in the server environment (see `.env.example`).
2. Open `/login` and register using that code. The first account is created
   as the owner (admin) and the bootstrap code stops working as soon as the
   account exists — all later signups use normal invite codes.
3. Remove `BOOTSTRAP_INVITE_CODE` from the environment when done (optional but recommended).

If you try to register on an empty install without `BOOTSTRAP_INVITE_CODE`
set, the app tells you exactly that instead of failing silently.
