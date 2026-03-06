# SkillBridge AI — Full Functionality Audit & Todo

## Issues Found

### Landing Page
- [x] Counter animations start at 0 (IntersectionObserver not triggering in preview) — fix timing
- [ ] No email capture / waitlist form — add working email capture with local state + success message
- [ ] "Features", "Testimonials" nav scroll doesn't work smoothly — fix section IDs
- [ ] Footer links (Blog, Careers, About, etc.) go nowhere — add proper toast or stub pages
- [ ] No onboarding flow — add a multi-step signup modal triggered by CTA buttons
- [ ] Hero section too dark on mobile — check contrast

### Dashboard
- [ ] All sidebar nav items (Clients, Scheduling, Invoices, Follow-Ups, Analytics, Settings) show "coming soon" toast — build real sub-pages/panels
- [ ] "New Client" button shows no modal — build a working Add Client modal
- [ ] "View all" clients link does nothing — build a Clients panel/page
- [ ] "View calendar" does nothing — build a Scheduling panel
- [ ] Client rows are clickable but show "coming soon" — build a Client Detail modal
- [ ] Search bar does nothing — wire up live search filtering
- [ ] Notifications bell does nothing — build a notifications panel
- [ ] User avatar does nothing — build a profile/settings dropdown
- [ ] "Send Now" AI insight button just shows toast — make it show a real follow-up preview modal
- [ ] Dashboard greeting "Good morning" is hardcoded — make it time-aware
- [ ] No Invoices page — build it
- [ ] No Follow-Ups page — build it
- [ ] No Analytics page — build it
- [ ] No Settings page — build it

### Pricing Page
- [ ] Annual/monthly toggle works but no visual feedback on savings calculation
- [ ] FAQ accordion works but could be smoother
- [ ] "Contact Sales" for Agency should open a contact modal

### General
- [ ] No loading states / skeleton screens
- [ ] No 404 page styling
- [ ] Mobile nav needs testing
