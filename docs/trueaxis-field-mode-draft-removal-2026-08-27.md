# Field Mode Draft Removal — 2026-08-27

Field Mode now provides an explicit “Clear draft” control that removes the current session-only client-update draft without sending or posting any client communication. The interface confirms this boundary and retains the separate, deliberate posting action.

Focused regression coverage passed alongside strict TypeScript, 82 Vitest files / 225 tests, a production build, and bundle budgets.
