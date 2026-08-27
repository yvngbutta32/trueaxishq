# Mobile Account-Recovery Accessibility — 2026-08-27

## Finding and correction

A 375px visual review found the password-recovery page’s “Back to homepage” control used insufficiently visible text. The control now has stronger text contrast, a minimum 44px touch height, a focused keyboard-visible ring, padded target area, and an unobtrusive hover treatment.

## Evidence

The correction was visually verified at 375px. Automated validation passed with strict TypeScript, 77 Vitest files / 213 tests, a production build, and the configured bundle-budget gate.

## Boundary

This correction improves recovery navigation accessibility; it does not validate email delivery or an end-to-end password-reset message flow, which remains contingent on controlled SMTP provider validation.
