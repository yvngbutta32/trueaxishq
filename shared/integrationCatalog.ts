export const INTEGRATION_PROVIDERS = [
  "google_calendar",
  "outlook_calendar",
  "quickbooks",
  "gmail",
  "outlook",
  "slack",
  "twilio",
  "zapier",
  "stripe",
] as const;

export type IntegrationProvider = typeof INTEGRATION_PROVIDERS[number];
export type IntegrationCategory = "calendar" | "accounting" | "communications" | "automation" | "payments";

export const integrationCatalog: Record<IntegrationProvider, { name: string; category: IntegrationCategory; description: string; availability: "available_now" | "provider_setup_required" | "planned" }> = {
  google_calendar: { name: "Google Calendar", category: "calendar", description: "Bring confirmed appointments into the calendar workflow after owner authorization.", availability: "available_now" },
  outlook_calendar: { name: "Outlook Calendar", category: "calendar", description: "A planned calendar connection for teams that schedule through Microsoft 365.", availability: "planned" },
  quickbooks: { name: "QuickBooks", category: "accounting", description: "A planned accounting connection for reconciliation and finance workflows.", availability: "planned" },
  gmail: { name: "Gmail", category: "communications", description: "A provider-authorized mail connection for account-specific delivery workflows.", availability: "provider_setup_required" },
  outlook: { name: "Outlook Mail", category: "communications", description: "A provider-authorized Microsoft mail connection for delivery workflows.", availability: "planned" },
  slack: { name: "Slack", category: "communications", description: "A planned internal-alert connection for operational handoffs and exceptions.", availability: "planned" },
  twilio: { name: "Twilio", category: "communications", description: "A planned SMS connection for opt-in client messaging and field coordination.", availability: "planned" },
  zapier: { name: "No-code automation", category: "automation", description: "A planned webhook and no-code workflow bridge for an owner-authorized ecosystem.", availability: "planned" },
  stripe: { name: "Stripe", category: "payments", description: "Payment checkout and verified webhooks require a claimed provider environment and signed webhook validation.", availability: "provider_setup_required" },
};

export const INTEGRATION_READINESS_STATUSES = ["not_connected", "needs_configuration", "connected", "error"] as const;
