# Dashboard Layout Audit Notes

## Current State

### NavItems (sidebar, 9 items)
1. Dashboard (overview)
2. Clients (clients)
3. Scheduling (scheduling)
4. Billing (billing) — consolidated: Invoices, Time Tracking, Recurring, Services
5. Outreach (outreach) — consolidated: Follow-Ups, Smart Inbox, Automations, Intake Forms
6. Deals (deals) — consolidated: Contracts, Proposals, Templates
7. Insights (insights) — consolidated: Analytics, Client Pulse, Expenses, Forecast
8. Settings (settings)
9. AI Assistant (ai)

### Orphaned Panel Cases (still render standalone instead of redirecting)
- invoices → should redirect to billing
- followups → should redirect to outreach
- analytics → should redirect to insights
- pulse → should redirect to insights
- contracts → should redirect to deals
- time → should redirect to billing
- inbox → should redirect to outreach
- services → should redirect to billing
- expenses → should redirect to insights
- proposals → should redirect to deals
- automations → should redirect to outreach
- testimonials → should redirect to clients (and be a tab inside ClientsPanel)

### AI Panel Case (line 4999)
Currently shows a placeholder message pointing to the floating bubble.
Should show the AIAssistant component in embedded/panel mode.
AIAssistant has: mobile full-screen sheet, desktop floating panel.
Need to add a `panelMode` prop to AIAssistant to render it embedded in the panel area.

### ClientsPanel (line 750)
Currently has: List/Pipeline toggle + CSV import/export buttons
Need to add: Testimonials tab (wrapping the existing TestimonialsPanel function)
The ClientsPanel is a standalone div, not using PanelTabs.
Best approach: wrap ClientsPanel content in PanelTabs with tabs:
- "Clients" tab (existing list/pipeline content)
- "Testimonials" tab (TestimonialsPanel)

### Quick Actions (line 558-580)
Currently 4: Add Client, New Booking, New Invoice, Outreach
Need to expand to 8: Add Client, New Booking, New Invoice, Outreach, New Proposal, New Contract, Log Expense, Start Timer

### Mobile Bottom Nav Sheet (line 4630-4648)
Work group currently has: Outreach, Deals, Insights, AI Assistant, Testimonials
Need to remove Testimonials (it's now inside Clients panel)

### Valid Panel List (line 4818)
Currently: ["overview","clients","scheduling","invoices","followups","analytics","settings","ai","pulse","contracts","time","inbox","testimonials"]
Should add all panels: billing, outreach, deals, insights, services, expenses, proposals, automations

### Cross-Panel Navigation Issues
1. GlobalSearch (client/src/components/GlobalSearch.tsx line 26-27):
   - invoice → panel: "invoices" → should be "billing"
   - contract → panel: "contracts" → should be "deals"
2. OnboardingChecklist (client/src/components/OnboardingChecklist.tsx line 28-30):
   - invoice → panel: "invoices" → should be "billing"
   - followup → panel: "followups" → should be "outreach"
3. AIAssistant (client/src/components/AIAssistant.tsx line 253-255):
   - utils.invoices.list.invalidate() — OK (still valid)
   - utils.contracts?.list?.invalidate?.() — OK
   - panel: "invoices" → should be "billing" in toast action
   - panel: "contracts" → should be "deals" in toast action
4. Stripe success URL (server/routers.ts line 836-837):
   - success_url: panel=invoices → should be panel=billing
   - cancel_url: panel=invoices → should be panel=billing
5. Notification link (server/routers.ts line 3075):
   - link: "/dashboard?panel=invoices" → should be "/dashboard?panel=billing"
6. Overview panel (Dashboard.tsx line 474):
   - setActivePanel("invoices") → should be setActivePanel("billing")
7. Overview panel (Dashboard.tsx line 650, 676):
   - setActivePanel("pulse") → should be setActivePanel("insights")
8. TimeTrackingPanel onInvoiceGenerated (Dashboard.tsx line 5025):
   - setActiveWithScroll("invoices") → should be setActiveWithScroll("billing")

## Readability Issues

### Dashboard.tsx text opacity values:
- 192 uses of rgba(245,239,227,0.55) — secondary text (OK, ~4.5:1 contrast on dark bg)
- 45 uses of rgba(245,239,227,0.45) — borderline (needs to be at least 0.55 for body text)
- 43 uses of rgba(245,239,227,0.40) — too low for body text (only OK for decorative/labels)
- 16 uses of rgba(245,239,227,0.75) — good
- 8 uses of rgba(245,239,227,0.35) — too low
- 6 uses of rgba(245,239,227,0.30) — too low (only OK for placeholders/dividers)
- 6 uses of rgba(245,239,227,0.25) — too low

### Text sizes:
- 232 uses of text-xs (12px) — acceptable for labels/metadata
- 133 uses of text-sm (14px) — good for body
- 39 uses of text-[10px] — very small, only OK for badges/kbd
- 16 uses of text-[11px] — borderline small
- 9 uses of text-[9px] — too small (only OK for keyboard shortcut hints)
- 2 uses of text-[8px] — too small

### Key readability fixes needed:
1. Upgrade all body text from 0.40/0.45 opacity to at least 0.60
2. Upgrade all labels from text-xs to text-sm where they're primary content
3. Upgrade text-[10px] to text-xs where they're readable labels (not badges)
4. PanelTabs inactive tab color: rgba(245,239,227,0.45) → rgba(245,239,227,0.65)
5. Sidebar shortcut hints: text-[9px] → text-[10px], opacity 0.40 → 0.55
6. MobileQuickStats labels: text-[9px] → text-[10px], opacity 0.40 → 0.55

## AIAssistant panelMode approach
Add `panelMode?: boolean` prop to AIAssistant.
When panelMode=true: render embedded (no fixed positioning, no drag, fills container).
The existing sub-components (MessageList, InputBar, SuggestedPrompts, Header) already work.
Just need a new render path that uses relative positioning and fills the panel area.

## Implementation Plan
1. Add `panelMode` prop to AIAssistant — render embedded panel when true
2. Replace AI panel case in Dashboard.tsx with embedded AIAssistant
3. Wrap ClientsPanel in PanelTabs with Clients + Testimonials tabs
4. Redirect all orphaned panel cases to their parent panels
5. Expand Quick Actions from 4 to 8
6. Update mobile bottom nav sheet (remove Testimonials from Work group)
7. Update valid panel list for URL persistence
8. Fix all cross-panel navigation references
9. Readability pass: upgrade text opacity and sizes
