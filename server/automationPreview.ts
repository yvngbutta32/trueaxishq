export type AutomationPreviewAction = {
  type: string;
  config?: Record<string, unknown>;
};

type PreviewAction = {
  label: string;
  destination: string;
  detail: string;
  state: "ready" | "needs_attention";
  reason?: string;
};

const TRIGGER_LABELS: Record<string, string> = {
  booking_confirmed: "a booking is confirmed",
  invoice_sent: "an invoice is sent",
  invoice_paid: "an invoice is paid",
  invoice_overdue: "an invoice becomes overdue",
  client_added: "a new client is added",
  proposal_signed: "a proposal is signed",
};

function text(config: Record<string, unknown> | undefined, key: string): string {
  const value = config?.[key];
  return typeof value === "string" ? value.trim() : "";
}

export function parseAutomationPreviewActions(raw: string | null | undefined): AutomationPreviewAction[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((action): action is AutomationPreviewAction => (
      Boolean(action) && typeof action === "object" && "type" in action && typeof (action as { type?: unknown }).type === "string"
    ));
  } catch {
    return [];
  }
}

export function buildAutomationPreview(input: {
  name: string;
  trigger: string;
  triggerDelayHours: number | null | undefined;
  actions: AutomationPreviewAction[];
}) {
  const actionPreviews: PreviewAction[] = input.actions.map((action) => {
    const config = action.config;
    const subject = text(config, "subject");
    const message = text(config, "message");
    const title = text(config, "title");

    if (action.type === "send_email") {
      return {
        label: "Send a client email",
        destination: "The matching client’s saved email address",
        detail: subject ? `Subject: ${subject}` : `Subject: ${input.name}`,
        state: message ? "ready" : "needs_attention",
        ...(message ? {} : { reason: "Add an email message before activating this rule." }),
      };
    }

    if (action.type === "create_followup") {
      return {
        label: "Create a follow-up draft",
        destination: "Your follow-up queue",
        detail: subject ? `Draft subject: ${subject}` : `Draft subject: ${input.name}`,
        state: message ? "ready" : "needs_attention",
        ...(message ? {} : { reason: "Add follow-up content before activating this rule." }),
      };
    }

    if (action.type === "notify_owner") {
      return {
        label: "Notify you",
        destination: "Owner notification channel",
        detail: title ? `Notification title: ${title}` : `Notification title: ${input.name}`,
        state: "ready",
      };
    }

    return {
      label: `Unsupported action: ${action.type}`,
      destination: "No destination",
      detail: "This action will not run until it is replaced with a supported action.",
      state: "needs_attention",
      reason: "Select a supported action before activating this rule.",
    };
  });

  const delayHours = Math.max(0, input.triggerDelayHours ?? 0);
  return {
    name: input.name,
    triggerLabel: TRIGGER_LABELS[input.trigger] ?? input.trigger.replace(/_/g, " "),
    delayHours,
    timingLabel: delayHours === 0 ? "Immediately after the trigger" : `${delayHours} hour${delayHours === 1 ? "" : "s"} after the trigger`,
    actions: actionPreviews,
    ready: actionPreviews.length > 0 && actionPreviews.every((action) => action.state === "ready"),
    issues: [
      ...(actionPreviews.length === 0 ? ["Add at least one supported action before activating this rule."] : []),
      ...actionPreviews.flatMap((action) => action.reason ? [action.reason] : []),
    ],
  };
}
