export type PreflightState = "ready" | "attention" | "blocked";

export type ClientExperienceCheck = {
  id: "identity" | "booking" | "portal" | "payments" | "email" | "automation";
  label: string;
  state: PreflightState;
  detail: string;
  nextAction: string;
};

export function buildClientExperiencePreflight(input: {
  businessConfigured: boolean;
  businessName: string | null | undefined;
  bookingConfigured: boolean;
  bookingUsername: string | null | undefined;
  serviceCount: number;
  portalConfigured: boolean;
  paymentsConfigured: boolean;
  emailConfigured: boolean;
  automationCount: number;
  activeAutomationCount: number;
}) {
  const checks: ClientExperienceCheck[] = [
    {
      id: "identity",
      label: "Client knows who they are working with",
      state: input.businessConfigured ? "ready" : "attention",
      detail: input.businessConfigured ? `${input.businessName ?? "Your business"} identity is present on client-facing surfaces.` : "Add a business name and website before sharing client links.",
      nextAction: input.businessConfigured ? "No action needed" : "Complete Business Profile",
    },
    {
      id: "booking",
      label: "Client can request a valid appointment",
      state: input.bookingConfigured ? "ready" : "blocked",
      detail: input.bookingConfigured ? `Booking page is configured with ${input.serviceCount} service${input.serviceCount === 1 ? "" : "s"}.` : "A public booking handle and at least one service are required.",
      nextAction: input.bookingConfigured ? `Review /book/${input.bookingUsername}` : "Configure Booking Page",
    },
    {
      id: "portal",
      label: "Client has a secure self-service workspace",
      state: input.portalConfigured ? "ready" : "attention",
      detail: input.portalConfigured ? "An active, token-scoped portal link is available." : "Create a portal link when the client needs billing, photos, messages, or milestones.",
      nextAction: input.portalConfigured ? "Review portal permissions" : "Create a Client Portal link",
    },
    {
      id: "payments",
      label: "Client has a clear payment path",
      state: input.paymentsConfigured ? "ready" : "blocked",
      detail: input.paymentsConfigured ? "Payment configuration is present; complete a controlled test checkout before charging customers." : "Payment configuration is missing, so clients cannot complete a reliable payment handoff.",
      nextAction: input.paymentsConfigured ? "Run a test checkout" : "Open Billing",
    },
    {
      id: "email",
      label: "Client receives important updates",
      state: input.emailConfigured ? "ready" : "blocked",
      detail: input.emailConfigured ? "Transactional email configuration is present." : "Booking confirmations, password resets, invoices, and reminders are not ready for external delivery.",
      nextAction: input.emailConfigured ? "Send a controlled delivery test" : "Configure transactional email",
    },
    {
      id: "automation",
      label: "Automations are understandable before activation",
      state: input.automationCount === 0 ? "attention" : input.activeAutomationCount > 0 ? "ready" : "attention",
      detail: input.automationCount === 0 ? "No workflow rules exist yet; clients will not receive automated follow-up." : `${input.activeAutomationCount} of ${input.automationCount} workflow rule${input.automationCount === 1 ? " is" : "s are"} active and reviewable with Automation Preview.`,
      nextAction: input.automationCount === 0 ? "Open Automations" : "Preview active rules",
    },
  ];

  const blocked = checks.filter((check) => check.state === "blocked").length;
  const attention = checks.filter((check) => check.state === "attention").length;
  return {
    checks,
    blocked,
    attention,
    ready: checks.length - blocked - attention,
    overallState: blocked > 0 ? "blocked" as const : attention > 0 ? "attention" as const : "ready" as const,
  };
}
