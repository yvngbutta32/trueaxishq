# Self-Service Sign-Out of All Devices

**Date:** 2026-08-28  
**Scope:** Protected self-service account-session control

## Observed implementation

The protected `auth.revokeAllSessions` mutation now updates only active session records whose `userId` matches the authenticated caller. It records the invalidation reason as `owner_requested`, clears the current caller’s session cookie using the existing cookie policy, and logs a private account-security event. The response returns only a success flag and count; it does not expose session identifiers, IP addresses, user-agent strings, or information about any other account.

The owner Admin account area now presents a deliberate **Sign out of all devices** control. It requires a confirmation step, states that it includes the current device, and redirects to Admin sign-in after the mutation succeeds. The control states that it does not change the password or notify anyone.

## Observed validation

| Validation | Observed result |
|---|---|
| TypeScript | `pnpm check` completed successfully. |
| Focused coverage | `sessionRevocationContract` and `auth.logout`: **2 files / 4 tests passed**. |
| Full regression suite | `pnpm test -- --reporter=dot`: **105 files / 293 tests passed**. |
| Production build | `pnpm run build` completed successfully. |
| Bundle budget | `pnpm run check:bundle` passed: entry **517.0/560 KiB**, dashboard **584.1/650 KiB**, home **112.6/140 KiB**, charts **424.7/500 KiB**, CSS **232.5/240 KiB**. |
| Rendered route boundary | An unauthenticated 375px capture of `/admin` rendered the Admin Access screen without a visible error. |

## Explicit limits

No authenticated owner session was available to invoke the control in a browser or to inspect database state afterward. The implementation does not establish compromised-account prevention, device identification, notification delivery, provider authentication, multi-device sign-out outcome, security certification, or production behavior.
