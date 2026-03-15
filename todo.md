# SkillBridge AI — Todo & Feature Tracker

## Core App Features
- [x] Landing page with hero, features, testimonials, how-it-works, CTA, footer
- [x] Email capture form wired to real DB (leads table)
- [x] Multi-step onboarding modal (3 steps → dashboard)
- [x] Smooth scroll navigation with mobile hamburger menu
- [x] Animated stat counters (IntersectionObserver)
- [x] Dashboard with 7 fully interactive panels connected to real DB via tRPC
- [x] Clients panel — add, view, edit, delete clients with modal profiles
- [x] Scheduling panel — create/remove bookings with calendar view
- [x] Invoices panel — create, mark paid, delete invoices with running totals
- [x] Follow-Ups panel — AI-generated follow-up emails via LLM, send individually or all
- [x] Analytics panel — live charts from real DB data
- [x] Settings panel — saves profile, business info, booking config to DB
- [x] Notifications panel — real-time in-app notifications with unread badge
- [x] Quick Add Client modal from header
- [x] Global search bar filtering clients
- [x] Pricing page with monthly/annual toggle, FAQ accordion, plan selection

## Accessibility & UX
- [x] WCAG AA color contrast on all text
- [x] Visible focus rings on all interactive elements
- [x] prefers-reduced-motion support
- [x] Minimum 48px touch targets
- [x] Semantic HTML landmarks (header, nav, main, section, footer)
- [x] ARIA labels on all interactive elements
- [x] Skip-to-main-content link
- [x] Focus trap in modals
- [x] aria-live regions for dynamic content
- [x] All form inputs labelled and validated accessibly
- [x] Keyboard navigation throughout
- [x] Mobile-responsive design with bottom nav bar on mobile dashboard

## Owner Features (Admin)
- [x] Admin panel at /admin — subscriber list, revenue stats, user management
- [x] Revenue dashboard — MRR, ARR, total subscribers, plan distribution
- [x] User management table — view, search, promote to admin, view plan
- [x] Broadcast message tool — send announcement to all users
- [x] Owner alert on new subscription (Stripe webhook → notifyOwner)
- [x] Owner alert on subscription cancellation

## User Features (Dashboard Enhancements)
- [x] AI Business Assistant chat panel (LLM-powered, context-aware)
- [x] Dark mode toggle + system preference detection + localStorage persistence
- [x] Invoice PDF export (print-friendly view)
- [x] Public booking page at /book/[username] — shareable client self-booking
- [x] Billing portal page — view plan, upgrade/downgrade, cancel subscription

## Stripe Integration
- [x] Stripe checkout session creation (tRPC billing.createCheckout)
- [x] Stripe webhook handler at /api/stripe/webhook
- [x] Billing portal session endpoint (tRPC billing.createPortal)
- [x] Sync subscription status to DB on webhook events
- [x] Checkout success page at /success
- [x] Plan gating with upgrade prompts

## Routing & Infrastructure
- [x] All routes wired in App.tsx (/, /pricing, /dashboard, /admin, /billing, /book/:username, /success, /about, /privacy, /terms, /help, /contact)
- [x] Lazy-loaded pages for performance
- [x] Full-stack upgrade (tRPC + DB + Auth)
- [x] Database schema with all tables (users, clients, invoices, bookings, followUps, settings, leads)
- [x] DB schema pushed to production

## Security
- [x] IP-based rate limiting (sliding window, 120 req/min general, 10 req/min auth)
- [x] Auto-blocklist after 5 violations (15-minute block)
- [x] Suspicious pattern detection (SQL injection, XSS, path traversal)
- [x] Owner notification on attack detection
- [x] Security headers on all responses (X-Frame-Options, X-Content-Type-Options, etc.)
- [x] Zod validation on all tRPC inputs
- [x] TRPC error codes (NOT_FOUND, BAD_REQUEST, FORBIDDEN) used consistently
- [x] Admin procedures protected with role check

## Content Pages
- [x] About page at /about — mission, story, values, team
- [x] Privacy Policy at /privacy — full GDPR/CCPA-compliant policy
- [x] Terms of Service at /terms — full legal terms
- [x] Help Center at /help — searchable FAQ with 5 categories, 17 articles
- [x] Contact page at /contact — working contact form wired to leads DB
- [x] All footer links point to real pages (no more "coming soon" toasts)

## Tests
- [x] auth.logout test (original)
- [x] 15 new vitest tests covering auth, billing, admin, AI, and booking procedures
- [x] All 16 tests passing
- [x] 13 new Client Pulse engine tests (scoring, risk classification, action type)
- [x] All 29 tests passing

## Bulletproofing Pass (Round 5)

### Database Layer
- [x] DB connection retry with exponential backoff (3 attempts before failing)
- [x] All DB helpers wrapped in try/catch with structured error logging
- [x] Graceful fallback when DB is unavailable (return empty arrays, not crashes)
- [x] Input length limits enforced at DB layer (prevent oversized inserts)

### tRPC Router Hardening
- [x] Every procedure wrapped in try/catch — no unhandled promise rejections
- [x] Structured server-side error logging (timestamp, procedure, user ID, error)
- [x] Internal error details never leaked to client (always TRPCError with safe message)
- [x] All mutations validate ownership (user can only modify their own data)

### Stripe System
- [x] Webhook idempotency — skip already-processed events (track event IDs)
- [x] Fallback plan detection if Stripe API is down (read from DB cache)
- [x] Checkout session creation timeout guard (10s max)
- [x] Billing portal creation timeout guard

### AI Systems
- [x] LLM call timeout guard (30s max — never hang forever)
- [x] Fallback response when LLM is unavailable ("AI temporarily unavailable, try again")
- [x] AI Assistant error boundary — chat errors don't crash the dashboard
- [x] Follow-up generation failure shows user-friendly retry button

### Frontend Resilience
- [x] Skeleton loaders on every dashboard panel (Clients, Invoices, Bookings, Analytics)
- [x] Empty states with helpful CTAs on every panel
- [x] Optimistic UI on all mutations (instant feedback, rollback on error)
- [x] Confirm dialog before all destructive actions (delete client, delete invoice, delete booking)
- [x] All forms show inline validation errors (not just toast)
- [x] Network error toast with retry button on all failed mutations
- [x] Booking page: graceful 404 if username not found

### Health & Monitoring
- [x] Server health check endpoint at /api/health (DB ping, uptime, version)
- [x] Client-side health monitor (polls /api/health every 60s, shows degraded banner)
- [x] Watchdog in Admin panel showing system status (DB, Stripe, AI, Security)
- [x] Owner notification when health check fails

## Client Pulse — AI Relationship Intelligence Engine (NEW)
- [x] clientPulse DB table — stores computed health scores, risk flags, last computed timestamp
- [x] computeClientPulse() server function — scores each client 0-100 from activity signals
- [x] pulse.getAll tRPC procedure — returns all clients with pulse scores
- [x] pulse.recompute tRPC mutation — manually trigger recompute for a client (computeOne + computeAll)
- [x] pulse.getInsights tRPC procedure — AI-generated action recommendations (built into computeClientPulse)
- [x] Client Pulse dashboard panel — heat map of all clients by health score
- [x] Risk cards — Churn Risk, Upsell Ready, Going Silent with one-click actions
- [ ] Pulse score badge on each client card in the Clients panel (future enhancement)
- [x] Auto-draft re-engagement email from Pulse panel (useAction mutation saves to Follow-Ups)
- [ ] Pulse history chart — track relationship health over time per client (future enhancement)
- [ ] Background recompute on every invoice/booking/followup mutation (future enhancement)
