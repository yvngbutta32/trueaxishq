# Cancelled-Visit Availability-State Correction

**Date:** 2026-08-27  
**Scope:** TrueAxis HQ private owner dispatch planning

## Correction

The owner-only dispatch visit projection now sets an availability-overlap signal only for **non-cancelled** service visits. A cancelled visit remains in private operational history, but it no longer appears as an active availability planning exception merely because its former time window overlaps a private block.

## Preserved boundaries

| Area | Behavior |
|---|---|
| Visit history | Cancelled service visits remain retained in the private owner worklist. |
| Availability signal | Only current non-cancelled visits can display a private availability overlap. |
| Privacy | The response remains owner-scoped and does not return block reasons through client or public projections. |
| Operations | This is a display-state correction only; it does not reschedule work, auto-assign staff, notify clients, or establish attendance, GPS, payroll, routing, calendar-sync, or offline capabilities. |

## Validation record

Strict TypeScript checking passed. Focused availability and Team Operations coverage passed: **2 files / 10 tests**. The full Vitest suite passed: **95 files / 254 tests**. The production build and configured bundle budgets also passed.
