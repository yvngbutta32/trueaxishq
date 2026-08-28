# Public Route Audit Findings

**Date:** 2026-08-28  
**Method:** Unauthenticated desktop visual captures of `/`, `/pricing`, `/about`, `/help`, `/contact`, `/privacy`, `/terms`, and `/login`; follow-up 375px captures of `/login`, `/pricing`, `/privacy`, and `/terms`.

## Observed findings

The captured public screens loaded at desktop width without a visible layout failure. The audit did not use an authenticated session and did not submit any form.

Three user-facing statements require correction before further public-route validation. The login screen describes the business as “running itself” and labels analytics as “Live,” even though autonomous operation and real-time analytics are not established by this audit. It also labels invoicing as automated, despite the known managed-scheduling gate. The Privacy and Terms screens contain broad security, backup, delivery, billing, deletion, trial, refund, and legal-policy statements that require legal, provider, and operational evidence beyond this source review.

At 375px, the corrected login, pricing, Privacy, and Terms pages rendered without visible horizontal overflow. The temporary install prompt appeared over the readable content area on pricing, Privacy, and Terms captures. Its close and install controls were visible, but it reduced uninterrupted access to the content and requires a bounded mobile presentation correction.

## Deliberate non-findings

The visual reviewer suggested a global color-system replacement. That advice was not accepted as an observed defect because this audit had no approved visual reference or evidence that the current TrueAxis HQ identity should be replaced. No redesign work is in scope.

## Validation limit

This document is an initial visual finding record, not evidence of provider delivery, account behavior, legal compliance, security certification, billing terms, data retention, or browser interaction outcomes.

## Follow-up observation

After the corrections, 375px captures of pricing, Privacy, and Terms showed readable content without the temporary install prompt covering it. Final 375px Privacy and Terms captures also displayed the explicit draft-review status and legal/privacy-review boundary. The captures do not verify form submission, billing, installation, cookie behavior, user accounts, or legal validity.

Follow-up desktop captures of login, pricing, Privacy, and Terms showed the revised factual login and pricing wording and the explicit policy-draft status without a visible layout failure. These visual checks do not establish the accuracy, completeness, enforceability, or provider-backed operation of any policy or commercial term.
