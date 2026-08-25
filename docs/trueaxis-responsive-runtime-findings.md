# Responsive and Runtime Findings

The 375px smoke checks covered the public booking-not-found route, pricing, and invalid client-portal recovery. The booking recovery state remained readable and centered; pricing retained usable navigation and plan content, although the install prompt overlays the lower viewport as expected for a PWA prompt; and invalid portal recovery presented clear TrueAxis HQ branding, an explanation, and a return action.

The runtime logs showed expected `NOT_FOUND` responses for the intentionally invalid portal token and unknown booking username. No TypeScript, Vite, or browser-console failure was observed during the checks. Authenticated dashboard journeys still require a real owner session for a complete manual pass and remain part of the launch gate.


The expanded 375px smoke checks covered `/login`, `/register`, `/pricing`, and `/portal/invalid-token`. Login and registration fields, password visibility controls, primary actions, and recovery links remained visible and reachable without horizontal overflow. Pricing remained readable with the persistent install prompt overlay; the prompt is expected PWA chrome and should be included in a final product decision. The invalid portal state remained clear and actionable. Authenticated dashboard and field-mode screens still require a real owner session for sign-off.

After the trust-surface remediation, `/login` was rechecked at 375px. The sign-in form remained readable and operable; no unsupported adoption, revenue, or testimonial-style content appears on the mobile entry surface. Field Mode itself remains correctly protected behind owner authentication and therefore needs an authenticated test session for visual sign-off.

The post-release log review showed only expected `NOT_FOUND` responses caused by intentionally invalid portal-token smoke checks. No new runtime, browser-console, or deployment build failure was observed in the reviewed log window.

The consolidated public mobile audit and follow-up log review again showed successful unauthenticated session checks and only the deliberately invalid portal-token `NOT_FOUND` responses. No additional actionable browser-console, network, or runtime failure appeared in the reviewed window.
