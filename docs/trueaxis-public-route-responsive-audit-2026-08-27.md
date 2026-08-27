# TrueAxis HQ public-route responsive audit — 2026-08-27

## Scope and method

The unauthenticated public routes `/`, `/pricing`, `/about`, `/help`, `/contact`, `/login`, `/register`, and `/forgot-password` were rendered at desktop width (1280px) and at a 375px mobile viewport. This checks visual layout and visible recovery controls only. It does not validate authenticated owner, staff, or client operations; real keyboard traversal; assistive technology; provider delivery; or physical-device behavior.

## Findings

| Route group | Desktop result | 375px result | Disposition |
| --- | --- | --- | --- |
| Marketing, pricing, and About | No visible horizontal clipping or collapsed primary controls | Content stacks within the viewport and primary actions remain visible | No confirmed layout repair from static rendering |
| Help | Search, topic controls, disclosure rows, and recovery actions visibly fit | Topic controls wrap and disclosure rows remain legible | No confirmed layout repair from static rendering |
| Login, registration, and reset | Forms, labels, recovery links, and primary actions are visible | Form controls remain legible and horizontally contained | No confirmed layout repair from static rendering |
| Contact | Contact details and form render cleanly | The install prompt can overlap form labels and entry controls during the first mobile view | Confirmed remediation candidate |

The install prompt also appears over content on mobile registration, Help, and About captures. A blocking or in-flow prompt must not obscure required form labels or primary actions. The next step is to inspect its positioning, modal semantics, dismissal behavior, and reduced-motion or small-viewport treatment; the correction must preserve the install affordance without asserting broad offline capability.

## Correction and validation

The public install prompt now closes as soon as an input, textarea, or select receives focus. It remains dismissible, uses non-modal region semantics, and no longer advertises generic offline use. This preserves a nonessential install affordance without competing with form completion. Source-contract coverage verifies the form-focus behavior, accessible dismissal label, and revised copy. Strict TypeScript, the 91-file / 242-test deterministic suite, production build, and configured bundle budgets passed.

Authenticated owner, staff, and client routes have not been exercised in this unauthenticated public-route audit. Their responsive, keyboard, assistive-technology, and data-isolation end-to-end validation remains a separate gate.
