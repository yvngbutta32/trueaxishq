// App events (app.*) are business moments any external system can subscribe to —
// this is how users wire Zapier/Make/Make-style receivers with a plain HTTPS
// endpoint, no marketplace listing required. Workflow events (the rest) are
// the same signed pipeline used by internal job automations.
export const WORKFLOW_WEBHOOK_EVENTS = [
  "app.booking.created",
  "app.client.created",
  "app.invoice.paid",
  "app.proposal.signed",
  "job.status_changed",
  "service_visit.scheduled",
  "service_visit.status_changed",
] as const;

export type WorkflowWebhookEvent = typeof WORKFLOW_WEBHOOK_EVENTS[number];

export function isWorkflowWebhookEvent(value: string): value is WorkflowWebhookEvent {
  return (WORKFLOW_WEBHOOK_EVENTS as readonly string[]).includes(value);
}

export function parseWebhookEvents(value: string): WorkflowWebhookEvent[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.filter((event): event is WorkflowWebhookEvent => typeof event === "string" && isWorkflowWebhookEvent(event))));
  } catch {
    return [];
  }
}
