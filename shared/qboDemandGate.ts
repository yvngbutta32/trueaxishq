// QuickBooks Online native sync is deliberately demand-gated. The Oct 23 2026
// dominance research (docs/working-notes/dominance-roadmap-2026-10-23.md) found
// QBO sync errors are the single most-cited recurring pain across Jobber,
// HousecallPro, FieldPulse, Kickserv, and Service Fusion reviews — and building
// it before launch adds Intuit OAuth complexity nobody has asked for yet.
// The decision: keep the QuickBooks-format CSV export (shipped), count real
// demand in-app, and build native sync only when this many PAYING companies
// have asked. This module is the single source of truth for the gate.
import { PLAN_LIST, type PlanId } from "./plans";

/** Paying-company demand required before native QBO sync is built. */
export const QBO_SYNC_DEMAND_THRESHOLD = 10;

/** Plan IDs that count as paying companies — derived from the sold ladder, so it can never drift. */
export const QBO_PAYING_PLANS: readonly PlanId[] = PLAN_LIST.map(plan => plan.id);
