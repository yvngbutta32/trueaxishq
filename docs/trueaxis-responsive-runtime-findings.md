# Responsive and Runtime Findings

The 375px smoke checks covered the public booking-not-found route, pricing, and invalid client-portal recovery. The booking recovery state remained readable and centered; pricing retained usable navigation and plan content, although the install prompt overlays the lower viewport as expected for a PWA prompt; and invalid portal recovery presented clear TrueAxis HQ branding, an explanation, and a return action.

The runtime logs showed expected `NOT_FOUND` responses for the intentionally invalid portal token and unknown booking username. No TypeScript, Vite, or browser-console failure was observed during the checks. Authenticated dashboard journeys still require a real owner session for a complete manual pass and remain part of the launch gate.
