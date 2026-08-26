# TrueAxis HQ Evidence Ledger Standard

**Effective:** August 26, 2026  
**Purpose:** This standard governs all continued product, design, marketing, research, competitor, and launch-readiness decisions for TrueAxis HQ.

## Required Evidence Labels

| Label | Permitted evidence | Permitted claim | Prohibited claim |
|---|---|---|---|
| **Implemented and validated** | Reviewed source, applied schema, deterministic tests, type check, production build, runtime logs, or visual evidence. | “Implemented,” “tested,” “build passed,” or the narrow behavior demonstrated by the evidence. | Real-world delivery, adoption, or outcome claims not tested in a live environment. |
| **Research-supported** | Current official provider documentation and independently moderated review evidence, cited to the source. | Narrow market observation, competitor capability, or recurring reported friction. | Universal market ranking, guaranteed performance, or an unverified competitor deficiency. |
| **Design hypothesis** | Explicit internal assumption or design rationale, with no external or runtime proof yet. | “Designed to,” “intended to,” or “proposed.” | “Improves,” “solves,” “best,” or “superior” without validation. |
| **External validation gate** | Requires provider access, a verified sender, an authenticated user session, controlled payment, a live receiver, real customer research, or independent review. | “Pending validation,” with the exact unverified condition stated. | “Ready,” “working end-to-end,” “securely delivered,” or “certified.” |

## Decision Rules

Every new feature begins with a named operational problem and a bounded acceptance criterion. Each release record must identify the code paths, tests, build result, and any route or visual evidence that support its implementation claim. If a claim depends on an external provider, a real customer, or a staff account, the release must say so plainly rather than infer completion from source code.

Competitor comparisons must rely on current official capability documentation for feature coverage and independently moderated sources for reported customer friction. Comparisons should assess workflows, not use unqualified “best,” “crush,” or market-capture language. Where TrueAxis HQ has no live workflow evidence, the statement must be framed as a product direction or an unvalidated implementation boundary.

Public product copy must describe available workflows and avoid assertions about response time, email delivery, payment finality, data retention, compliance, uptime, customer counts, reviews, or financial outcomes unless the claim has current independently verifiable evidence.

## Current Boundary

The current release record supports narrow implementation claims for owner-safe operations, client-safe portal coordination, signed webhook setup, token-scoped recovery, and application-level payment-return integrity. It does not yet support claims that email, Stripe, external webhook receivers, calendar/accounting/communication providers, staff accounts, or authenticated owner/client journeys have been verified in real use.

> **Rule of interpretation:** If the evidence label is unclear, treat the statement as a design hypothesis or an external validation gate—not as a completed product claim.
