# Public Entry-Context Install-Prompt Refinement

**Date:** 2026-08-27  
**Scope:** Public TrueAxis HQ conversion surfaces

## Verified correction

A desktop and 375px review of the home, pricing, about, contact, help, and unavailable-booking surfaces identified that the optional install prompt could occupy visual space over public entry controls before a visitor focused one. The prompt now checks for form, input, textarea, select, or editable controls when its delayed display is due. It does not appear in those entry contexts, and it still dismisses if a visitor later focuses a supported control.

A follow-up 375px rendering review confirmed that the contact form, Help Center search, and pricing selector remain unobstructed.

## Boundaries

| Area | Current behavior | Explicit non-claim |
|---|---|---|
| Install prompt | Remains optional and is suppressed in pages with entry controls | It does not claim broad offline use, background operation, or a successful app installation. |
| Public conversion | Form and search entry remains visually unobstructed at 375px | This visual review does not validate submission, SMTP delivery, or authenticated user flows. |
| Scope | No public data, trust guarantee, or pricing behavior changed | It is not an accessibility certification or a substitute for device and assistive-technology testing. |

## Validation record

Strict TypeScript checking passed. Focused install-prompt coverage passed: **1 file / 1 test**. The full Vitest suite passed: **95 files / 254 tests**. The production build and configured bundle budgets also passed.
