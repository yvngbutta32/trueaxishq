# TrueAxis HQ

The all-in-one operations platform for independent home-service businesses —
booking, scheduling, dispatch, quoting, invoicing, client portal, proposals,
intake forms, automations, and reporting in a single deployable app.

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
