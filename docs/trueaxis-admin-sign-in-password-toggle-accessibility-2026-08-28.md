# Admin Sign-In Password Toggle Accessibility

**Date:** 2026-08-28  
**Scope:** Public Admin sign-in interface only

## Observed correction

The Admin sign-in password-visibility button no longer removes itself from normal keyboard tab order. It keeps explicit `type="button"` semantics and its dynamic **Show password** or **Hide password** accessible label. A visible focus indicator was added for keyboard navigation.

No authentication request, password validation, account policy, session, provider, or credential-handling behavior changed.

## Observed validation

| Validation | Observed result |
|---|---|
| TypeScript | `pnpm check` completed successfully. |
| Focused coverage | `adminLoginAccessibility`: **1 file / 1 test passed**. |
| Full regression suite | `pnpm test -- --reporter=dot`: **106 files / 294 tests passed**. |
| Production build | `pnpm run build` completed successfully. |
| Bundle budget | `pnpm run check:bundle` passed: entry **517.0/560 KiB**, dashboard **584.1/650 KiB**, home **112.6/140 KiB**, charts **424.7/500 KiB**, CSS **232.6/240 KiB**. |
| Rendered artifact | The public `/admin-login` screen rendered at 375px without a visible layout error. |

## Explicit limits

The automated test checks source-level keyboard reachability and labeling. No physical keyboard browser interaction, screen-reader evaluation, form submission, credential validation, authentication outcome, or production behavior was tested.
