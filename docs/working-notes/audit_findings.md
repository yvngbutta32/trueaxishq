# TrueAxis HQ — Full Visual & Functional Audit Findings

## DASHBOARD — Desktop

### Layout Issues
1. **Onboarding checklist card** — takes up too much vertical space above the stat cards; the checklist items are tightly packed with minimal padding between them
2. **Stat cards row** — 4 cards in a row look fine on desktop but on mobile they stack awkwardly; the "1 upcoming" and "Awaiting payment" sub-labels use different colors (green vs red) inconsistently
3. **Quick action buttons** (Add Client, New Booking, New Invoice, AI Follow-Up) — the bottom row has a yellow dashed border in the screenshot indicating a layout container issue; buttons need consistent sizing and spacing
4. **Header search bar** — "Search clients... (Enter)" placeholder is truncated on desktop; the header area feels crowded with search + status + notifications + avatar all on one line
5. **Sidebar** — "Pro Plan / Active subscription" badge at bottom is styled differently from the rest of the sidebar; "Dark Mode", "Billing", "Admin Panel", "Home" items below the divider feel visually disconnected
6. **Revenue chart** — chart labels ($0k) are redundant when all values are zero; chart takes up a lot of space for empty state
7. **Client Growth panel** — empty state message "Add your first client to see growth trends" is fine but the panel height is inconsistent with the Revenue chart panel

### Mobile Issues
8. **Bottom nav bar** — 5 tabs (Dashboard, Clients, Schedule, Invoices, Follow-Ups) need safe-area-inset padding for iPhone notch/home indicator
9. **Mobile header** — search bar in header on mobile is too wide and pushes other elements
10. **Onboarding checklist** — on mobile, the checklist items overflow horizontally

## CLIENTS PANEL
11. **Empty state** — "No clients found" is well-centered; the table headers (CLIENT, SERVICE, STATUS) show even when empty — should hide or show a cleaner empty state
12. **Search + filter row** — search input and dropdown are on the same line but the search has no border/background differentiation from the filter dropdown

## SCHEDULING PANEL  
13. **Table layout** — CLIENT/SERVICE, DATE & TIME, DURATION, STATUS columns look clean; the status dropdown (Scheduled) is slightly cramped next to the delete button
14. **"New Booking" button** — positioned top-right, correct; but on mobile it may overflow

## INVOICES PANEL
15. **Summary cards** (Total Paid, Outstanding, Overdue, Total Invoices) — 4 cards in a row; on mobile these will be too small
16. **Filter tabs** (All, Unpaid, Paid, Overdue) — tab styling is inconsistent with the rest of the UI; they use a pill style that doesn't match the overall design language
17. **Table** — shows even when empty; should show empty state instead

## SETTINGS PANEL
18. **Profile section** — "Upload photo" button overlaps the avatar circle; the avatar has a yellow "+" icon that overlaps the upload button text
19. **Bio textarea** — has a dashed blue border (active focus state) that is very prominent and looks like an error state
20. **Form sections** — Profile, Business Info, Booking Page, Notifications, Security, API Keys are all stacked vertically with good spacing; section cards have consistent padding
21. **"Save Profile" button** — amber/gold color is correct; but it's positioned immediately below the bio textarea with no breathing room

## LOGIN PAGE
22. **Two-column layout** — left panel (marketing copy) and right panel (form) are well-balanced on desktop
23. **"Back to homepage" button** — positioned at the bottom-left of the right panel; it's isolated and easy to miss
24. **Form inputs** — proper spacing, labels above inputs; looks clean

## LANDING PAGE (/ route)
25. **Route issue** — `/home` returns 404; the landing page is at `/` but redirects to `/dashboard` when logged in; need to verify the landing page is accessible to logged-out users
26. **Nav mobile menu** — hamburger menu needs to be tested

## GLOBAL ISSUES
27. **Page title** — browser tab shows "TrueaxisHQ" (no space, wrong capitalization); should be "TrueAxis HQ"
28. **Font consistency** — some panels use different font weights inconsistently
29. **Mobile bottom nav padding** — needs `padding-bottom: env(safe-area-inset-bottom)` for iPhone home indicator
30. **Overflow-x on mobile** — some tables (Scheduling, Invoices) may cause horizontal scroll on narrow screens
31. **Focus states** — some buttons lack visible focus rings for keyboard navigation
32. **Color contrast** — some gray text on white backgrounds may not meet WCAG AA contrast requirements
33. **Input border on focus** — the blue dashed border on textarea focus is jarring; should use the amber/gold brand color
