# Password-Reset Active-Session Invalidation

**Date:** 2026-08-28  
**Scope:** Password-reset security procedure

## Observed correction

After the password-reset token’s final unused-and-unexpired predicate succeeds and the password hash is updated, the reset procedure now invalidates active sessions whose `userId` equals the reset token’s user. The invalidation uses `password_reset` as its reason and creates a private security event for that user.

The existing token lookup, expiry check, single-use atomic consume predicate, password change, and response shape remain unchanged. The procedure does not return session metadata or alter any other user’s sessions.

## Observed validation

| Validation | Observed result |
|---|---|
| TypeScript | `pnpm check` completed successfully. |
| Focused coverage | Password reset, origin policy, and session-revocation contracts: **3 files / 7 tests passed**. |
| Full regression suite | `pnpm test -- --reporter=dot`: **112 files / 306 tests passed**. |
| Production build | `pnpm run build` completed successfully. |
| Bundle budget | `pnpm run check:bundle` passed: entry **517.0/560 KiB**, dashboard **584.1/650 KiB**, home **112.6/140 KiB**, charts **424.7/500 KiB**, CSS **232.6/240 KiB**. |

## Explicit limits

No reset link, account, active session, browser, device, mailbox, provider, or production environment was used. This does not establish multi-device sign-out, compromised-account prevention, account recovery, notification delivery, provider-authentication behavior, or production operation.
