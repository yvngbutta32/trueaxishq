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
