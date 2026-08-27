# Weekly Scheduled-Capacity Boundary Correction

**Date:** 2026-08-27  
**Scope:** TrueAxis HQ private owner capacity planning

## Correction

The Team & Capacity calculation now includes an active service visit whenever its interval overlaps the current UTC week, rather than only when its start timestamp occurs inside that week. Each visit’s contribution is clipped to the current UTC week before its duration is summed. This prevents an overnight visit from being omitted at the beginning of a week or overcounted when it ends after the week boundary.

## Boundaries

| Area | Current behavior | Explicit non-claim |
|---|---|---|
| Scheduled capacity | Aggregates only the overlapping portion of active service visits in the current UTC week | It does not alter assignment capacity or contractually available hours. |
| Privacy | Calculation is scoped to the authenticated owner’s service visits | It does not expose visit, availability, or team data to client portal or public routes. |
| Operations | Improves the accuracy of owner planning context | It is not attendance, payroll, GPS, routing, calendar synchronization, automatic dispatching, or offline functionality. |

## Validation record

Strict TypeScript checking passed. Focused scheduled-capacity and availability coverage passed: **2 files / 6 tests**. The full Vitest suite passed: **95 files / 254 tests**. The production build and configured bundle budgets also passed.
