import { describe, expect, it } from "vitest";
import { buildAutomationPreview, parseAutomationPreviewActions } from "./automationPreview";

describe("automation preview", () => {
  it("explains a configured workflow without executing any side effect", () => {
    const preview = buildAutomationPreview({
      name: "Welcome new clients",
      trigger: "client_added",
      triggerDelayHours: 24,
      actions: [{ type: "send_email", config: { subject: "Welcome", message: "Thanks for choosing us." } }],
    });

    expect(preview.triggerLabel).toBe("a new client is added");
    expect(preview.timingLabel).toBe("24 hours after the trigger");
    expect(preview.ready).toBe(true);
    expect(preview.actions[0]).toMatchObject({ label: "Send a client email", state: "ready", detail: "Subject: Welcome" });
  });

  it("flags incomplete and unsupported actions before activation", () => {
    const preview = buildAutomationPreview({
      name: "Invoice follow-up",
      trigger: "invoice_overdue",
      triggerDelayHours: 0,
      actions: [
        { type: "create_followup", config: { subject: "Checking in" } },
        { type: "webhook", config: {} },
      ],
    });

    expect(preview.ready).toBe(false);
    expect(preview.issues).toHaveLength(2);
    expect(preview.actions.map((action) => action.state)).toEqual(["needs_attention", "needs_attention"]);
  });

  it("parses malformed persisted action data safely", () => {
    expect(parseAutomationPreviewActions("not json")).toEqual([]);
    expect(parseAutomationPreviewActions(JSON.stringify([{ type: "notify_owner", config: { title: "Heads up" } }]))).toHaveLength(1);
  });
});
