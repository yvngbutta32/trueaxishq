# SkillBridge AI — Todo & Feature Tracker

## Core App Features
- [x] Landing page with hero, features, testimonials, how-it-works, CTA, footer
- [x] Email capture form with toast feedback
- [x] Multi-step onboarding modal (3 steps → dashboard)
- [x] Smooth scroll navigation with mobile hamburger menu
- [x] Animated stat counters (IntersectionObserver)
- [x] Dashboard with 7 fully interactive panels
- [x] Clients panel — add, view, edit, delete clients with modal profiles
- [x] Scheduling panel — create/remove bookings with calendar view
- [x] Invoices panel — create, mark paid, delete invoices with running totals
- [x] Follow-Ups panel — AI-generated follow-up emails, send individually or all
- [x] Analytics panel — live charts from real client/invoice data
- [x] Settings panel — saves name, email, business name to localStorage
- [x] Notifications panel — real-time in-app notifications with unread badge
- [x] Quick Add Client modal from header
- [x] Global search bar filtering clients
- [x] Pricing page with monthly/annual toggle, FAQ accordion, plan selection
- [x] All data persisted in localStorage (no reset on refresh)

## Accessibility & UX
- [x] WCAG AA color contrast on all text
- [x] Visible focus rings on all interactive elements
- [x] prefers-reduced-motion support
- [x] Minimum 44px touch targets
- [x] Semantic HTML landmarks (header, nav, main, section, footer)
- [x] ARIA labels on all interactive elements
- [x] Skip-to-main-content link
- [x] Focus trap in modals
- [x] aria-live regions for dynamic content
- [x] All form inputs labelled and validated accessibly
- [x] Keyboard navigation throughout
- [x] Mobile-responsive design

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
- [x] Dark mode / Light mode toggle in sidebar

## Stripe Integration
- [x] Stripe checkout session creation (tRPC billing.createCheckout)
- [x] Stripe webhook handler at /api/stripe/webhook
- [x] Billing portal session endpoint (tRPC billing.createPortal)
- [x] Sync subscription status to DB on webhook events
- [x] Checkout success page at /success
- [x] Plan gating with upgrade prompts

## Routing & Infrastructure
- [x] All routes wired in App.tsx (/, /pricing, /dashboard, /admin, /billing, /book/:username, /success)
- [x] Lazy-loaded pages for performance
- [x] Full-stack upgrade (tRPC + DB + Auth)
- [x] Database schema with Stripe fields (stripeCustomerId, subscriptionStatus, planId)
- [x] DB schema pushed to production

## Tests
- [x] auth.logout test (original)
- [x] 15 new vitest tests covering auth, billing, admin, AI, and booking procedures
- [x] All 16 tests passing

## Hardening & Mobile Pass (Round 3)

### Global Infrastructure
- [x] Global error boundary with friendly fallback UI and retry button
- [x] Offline detection banner — notify user when connection is lost
- [x] API retry logic on transient failures (tRPC + React Query retry config)
- [x] Consistent toast system — success/error/info with icons and auto-dismiss
- [ ] Rate limiting on sensitive server endpoints (AI chat, booking submit)
- [x] Input sanitization on all server-side zod schemas
- [ ] Watchdog: server health check endpoint + auto-restart on crash

### Mobile Navigation
- [x] Hamburger menu fully functional on mobile (landing page)
- [x] Dashboard sidebar collapses to bottom tab bar on mobile
- [x] All touch targets minimum 48px
- [ ] No horizontal scroll on any page at 375px viewport
- [ ] Swipe gestures for dashboard panels on mobile

### Landing Page
- [x] Hero section readable on 375px (no text overflow)
- [x] Feature cards stack vertically on mobile
- [ ] Stats section wraps properly on mobile
- [ ] Testimonials carousel works on touch
- [ ] Footer links grid collapses on mobile
- [ ] Nav menu closes on link click (mobile)

### Dashboard
- [ ] Loading skeleton screens for all panels
- [ ] Empty states with helpful CTAs for all panels
- [ ] Form validation with inline error messages
- [ ] Confirm dialog before destructive actions (delete client, delete invoice)
- [ ] Mobile-optimized table views (card layout on small screens)
- [ ] AI Assistant panel scrolls correctly on mobile

### Pricing / Billing / Admin / Booking
- [x] Pricing cards stack on mobile
- [ ] Billing page works on mobile
- [x] Admin table horizontally scrollable on mobile
- [ ] Booking form fully usable on mobile keyboard
- [ ] Success page centered and readable on all sizes

### Server Hardening
- [x] Zod validation on all tRPC inputs
- [x] TRPC error codes (NOT_FOUND, BAD_REQUEST, FORBIDDEN) used consistently
- [ ] Stripe webhook signature verification
- [x] Admin procedures protected with role check
