# TrueAxis HQ — Todo & Feature Tracker

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

## Completion Pass — Production Polish (Round 6)

### Dashboard UX Improvements
- [ ] Pulse score mini-badge on each client card in Clients panel (colored dot + score)
- [ ] Client Pulse summary widget on Overview panel (churn risk count, avg health score)
- [ ] Mobile bottom nav: replace AI tab with Pulse tab for better discoverability
- [ ] Overview panel: fix "Sessions Completed" stat to show upcoming count correctly
- [ ] Invoice overdue auto-detection: mark invoices as overdue if past due date
- [ ] Follow-Ups panel: add "Copy to Clipboard" button for email body

### Admin Panel Improvements
- [ ] Leads tab in Admin panel with table of all captured emails + CSV export
- [ ] System health watchdog section in Admin overview
- [ ] Admin overview: show total leads count alongside user count

### Landing Page Conversion Optimization
- [ ] Add "money-back guarantee" badge to hero and pricing sections
- [ ] Add feature comparison table to Pricing page (Starter vs Pro vs Agency)
- [ ] Add "Trusted by X freelancers" social proof counter to hero
- [ ] Add FAQ section to landing page (not just pricing page)
- [ ] Add urgency/scarcity element (e.g., "Limited early-bird pricing")

### Operational Completeness
- [ ] Invoice: add "Send Reminder" button for overdue invoices (marks status + generates follow-up draft)
- [ ] Booking confirmation: send owner notification with client details on every public booking
- [ ] Settings: add "Copy booking link" button with one-click clipboard copy
- [ ] Dashboard header: show current plan badge next to user avatar
- [ ] 404 page: add navigation links back to home and dashboard

## Admin Dashboard Expansion (Round 7)

- [x] platformSettings DB table — store site name, support email, phone, social links, announcement banner
- [x] admin.getSettings / admin.updateSettings tRPC procedures
- [x] admin.updateUserPlan mutation — manually override a user's plan
- [x] admin.deleteUser mutation — permanently delete user and all their data
- [x] admin.getSystemHealth procedure — DB stats, user counts, recent activity
- [x] Admin Settings tab — edit site name, support email, phone, social links, announcement banner
- [x] Admin Feature Flags tab — enable/disable 6 platform features globally
- [x] Admin Maintenance Mode — toggle with custom message
- [x] Admin User Actions — override plan, promote/demote admin, delete user inline
- [x] Admin System Health tab — DB status, server uptime, platform data counts, quick actions

## Rebrand: SkillBridge AI → TrueAxis HQ (Round 8)
- [x] Update index.html title and meta tags
- [x] Update all branding constants across shared files (mass find-and-replace)
- [x] Update Home.tsx — all SkillBridge references → TrueAxis HQ
- [x] Update Pricing.tsx — all SkillBridge references
- [x] Update About.tsx — company name and story
- [x] Update Contact.tsx — company name references
- [x] Update Help.tsx — company name references
- [x] Update Terms.tsx — company name references
- [x] Update Privacy.tsx — company name references
- [x] Update Dashboard.tsx — all SkillBridge references + logo text
- [x] Update Admin.tsx — all SkillBridge references
- [x] Update BookingPage.tsx — all SkillBridge references
- [x] Update Billing.tsx — all SkillBridge references
- [x] Update CheckoutSuccess.tsx — all SkillBridge references
- [x] Update server routers, products, db, security, utils
- [x] Update drizzle/schema.ts default values
- [x] Update todo.md header
- [x] 0 TypeScript errors, 29/29 tests passing after rebrand

## Visual Redesign: Dark Amber Retro-Modern Theme (Round 9)
- [x] Define design system — Dark Amber palette (#141414 base, #E8A020 amber, #F5F0E8 cream)
- [x] Rewrite index.css with new CSS variables, Space Grotesk + DM Sans fonts, retro-grid, btn-amber, pill-retro, retro-card, section-label, stat-number
- [x] Update Google Fonts in index.html (Space Grotesk + DM Sans)
- [x] Redesign Home.tsx with dark amber retro-modern layout
- [x] Rewrite Pricing.tsx with dark amber theme + feature comparison table
- [x] Update About.tsx with dark amber theme (full rewrite)
- [x] Update Contact, Help, Terms, Privacy, Billing, CheckoutSuccess, BookingPage, NotFound with amber theme
- [x] Update Dashboard.tsx with amber accent colors
- [x] Update Admin.tsx with amber accent colors
- [x] Update AIAssistant, ErrorBoundary, InvoicePrint, HealthMonitor, ClientPulse with amber theme
- [x] 0 teal color references remaining across entire codebase
- [x] 0 TypeScript errors, 29/29 tests passing after full redesign

## Visual Redesign: Polaroid Retro-Modern Theme (Round 10)
- [ ] Define Polaroid design system — white base, rainbow stripe, bold primaries, Syne + Inter fonts
- [ ] Rewrite index.css with new CSS variables, utility classes, rainbow stripe component
- [ ] Update index.html with new Google Fonts (Syne + Inter)
- [ ] Redesign Home.tsx with Polaroid retro-modern layout
- [ ] Redesign Pricing.tsx with Polaroid theme
- [ ] Update About.tsx with Polaroid theme
- [ ] Update Dashboard.tsx with Polaroid accent colors
- [ ] Update Admin.tsx with Polaroid accent colors
- [ ] Update all remaining pages (Contact, Help, Terms, Privacy, Billing, BookingPage, CheckoutSuccess, NotFound)
- [ ] Update all components (AIAssistant, ClientPulse, ErrorBoundary, InvoicePrint, HealthMonitor)
- [ ] 0 TypeScript errors, 29/29 tests passing after redesign

## Logo Integration & CSS Build Fix (Round 11)
- [x] Fix build failure — replace all `@apply btn-yellow`, `@apply glow-yellow`, `@apply pill-yellow`, `@apply pill-green`, `@apply tag-yellow`, `@apply tag-green`, `@apply tag-red`, `@apply shimmer-text` with inline CSS
- [x] Replace old `trueaxis-official-logo` CDN URL with new `logo-r1` CDN URL across all pages
- [x] Add official logo to Privacy.tsx nav
- [x] Add official logo to Terms.tsx nav
- [x] Add official logo to Help.tsx nav
- [x] Add official logo to Contact.tsx nav
- [x] Add official logo to Billing.tsx nav (also added proper nav bar)
- [x] Add official logo to CheckoutSuccess.tsx card header
- [x] 0 TypeScript errors, 29/29 tests passing, build succeeds

## Self-Contained Email/Password Auth (Round 12)
- [x] Replace Manus OAuth with bcrypt email/password authentication
- [x] Add passwordHash column to users table (schema + migration)
- [x] Create server/auth.ts — registerUser, loginUser, createSessionToken helpers
- [x] Add auth.register and auth.login tRPC procedures to routers.ts
- [x] Update context.ts to use local JWT session verification (no Manus SDK)
- [x] Create Login page at /login with email/password form
- [x] Create Register page at /register with name/email/password/confirm form
- [x] Add /login and /register routes to App.tsx
- [x] Update useAuth hook to redirect to /login (not Manus OAuth URL)
- [x] Update const.ts getLoginUrl() to return /login
- [x] Remove Manus OAuth route registration from server index.ts
- [x] Remove all getLoginUrl() calls from Admin.tsx, Billing.tsx, DashboardLayout.tsx
- [x] Update Home.tsx Sign In buttons to navigate to /login
- [x] Set bcrypt password hash for owner account (aaron.anderson62901@gmail.com)
- [x] 0 TypeScript errors, 29/29 tests passing, build succeeds

## Auth Enhancements (Round 13)

### Forgot Password Flow
- [ ] Add passwordResetTokens DB table (token, userId, expiresAt, used)
- [ ] Add auth.forgotPassword tRPC procedure — generate token, send email via notifyOwner/email
- [ ] Add auth.resetPassword tRPC procedure — validate token, update passwordHash, mark used
- [ ] Create ForgotPassword page at /forgot-password
- [ ] Create ResetPassword page at /reset-password?token=...
- [ ] Add "Forgot password?" link on Login page

### Change Password in Dashboard Settings
- [ ] Add auth.changePassword tRPC procedure (verify old password, set new)
- [ ] Add Change Password section to Dashboard Settings panel

### Invitation-Only Registration Gate
- [ ] Add inviteCodes DB table (code, createdBy, usedBy, usedAt, expiresAt)
- [ ] Add admin.createInvite tRPC procedure — generate invite code
- [ ] Add admin.listInvites tRPC procedure — list all codes with status
- [ ] Add admin.revokeInvite tRPC mutation — delete/expire a code
- [ ] Update auth.register to require a valid invite code
- [ ] Update Register page to include invite code field
- [ ] Add Invite Codes tab to Admin panel — generate, list, revoke codes

## Comprehensive Platform Hardening (Round 13 — Full Pass)

### Migration & DB
- [ ] Fix duplicate passwordHash migration conflict (mark 0006 as applied, push new tables only)
- [ ] Verify passwordResetTokens and inviteCodes tables created in DB

### Forgot Password Flow
- [ ] auth.forgotPassword tRPC procedure — generate secure token, store in DB, send email via notifyOwner
- [ ] auth.resetPassword tRPC procedure — validate token expiry/used, update passwordHash, mark token used
- [ ] ForgotPassword page at /forgot-password
- [ ] ResetPassword page at /reset-password?token=...
- [ ] "Forgot password?" link on Login page

### Change Password
- [ ] auth.changePassword tRPC procedure — verify current password, hash and save new one
- [ ] Change Password section in Dashboard Settings panel

### Invitation-Only Registration
- [ ] admin.createInvite tRPC procedure — generate unique code, store with note/expiry
- [ ] admin.listInvites tRPC procedure — list all codes with status (used/active/revoked/expired)
- [ ] admin.revokeInvite tRPC mutation — mark code as revoked
- [ ] Update auth.register to require valid invite code (check not used/revoked/expired)
- [ ] Update Register page with invite code field
- [ ] Invite Codes tab in Admin panel — generate, list, copy, revoke

### Data Integrity Audit
- [ ] Verify all tRPC mutations return correct data shapes (no undefined fields)
- [ ] Verify all analytics calculations use correct UTC timestamps
- [ ] Verify invoice totals aggregate correctly (paid vs unpaid)
- [ ] Verify client pulse scores recompute on relevant mutations
- [ ] Verify admin user management shows accurate plan/role/subscription data
- [ ] Verify Stripe webhook correctly updates subscriptionStatus and planId in DB
- [ ] Verify lastSignedIn updates on every login
- [ ] Verify all error paths return typed TRPCError (no raw throws)
- [ ] Verify all admin procedures check role === 'admin' before executing

## Auth Enhancements — Completed (Round 14)
- [x] passwordResetTokens and inviteCodes DB tables created
- [x] auth.forgotPassword tRPC procedure — generates token, sends owner notification
- [x] auth.resetPassword tRPC procedure — validates token, updates password, marks used
- [x] auth.changePassword tRPC procedure — verifies current password, saves new hash
- [x] auth.register updated to require valid invite code
- [x] ForgotPassword page at /forgot-password
- [x] ResetPassword page at /reset-password?token=...
- [x] "Forgot password?" link on Login page
- [x] Change Password section in Dashboard → Settings
- [x] Register page updated with invite code field (prominent, monospace, uppercase)
- [x] /forgot-password and /reset-password routes registered in App.tsx
- [x] Admin invite management panel — skipped per user request
- [x] 29/29 tests passing, build succeeds
