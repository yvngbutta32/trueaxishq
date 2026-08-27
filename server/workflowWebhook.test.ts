import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createWebhookSignature, validateWebhookEndpoint } from "./workflowWebhookDelivery";
import { WORKFLOW_WEBHOOK_EVENTS, parseWebhookEvents } from "../shared/workflowWebhooks";

describe("workflow webhook primitives", () => {
  it("parses only supported unique events and signs the exact timestamp-payload pair", () => {
    expect(parseWebhookEvents(JSON.stringify(["job.status_changed", "job.status_changed", "unknown"]))).toEqual(["job.status_changed"]);
    expect(parseWebhookEvents("not-json")).toEqual([]);
    expect(WORKFLOW_WEBHOOK_EVENTS).toEqual(["job.status_changed", "service_visit.scheduled", "service_visit.status_changed"]);
    expect(createWebhookSignature("secret", "1710000000", '{"id":"event"}')).toBe("625a515f0161afd9dc78d28c426c55566c16b761abf1ea4b557ae152e9eae649");
  });

  it("rejects insecure and local endpoint forms before any delivery attempt", async () => {
    await expect(validateWebhookEndpoint("http://example.com/hook")).rejects.toThrow("HTTPS");
    await expect(validateWebhookEndpoint("https://localhost/hook")).rejects.toThrow("not allowed");
    await expect(validateWebhookEndpoint("https://127.0.0.1/hook")).rejects.toThrow("public network");
  });
});

describe("workflow webhook ownership and delivery contracts", () => {
  it("uses encrypted secrets, owner predicates, limited subscriptions, and isolated event delivery", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const delivery = readFileSync(resolve(process.cwd(), "server/workflowWebhookDelivery.ts"), "utf8");
    const consoleUi = readFileSync(resolve(process.cwd(), "client/src/pages/WorkflowWebhooks.tsx"), "utf8");
    const section = router.slice(router.indexOf("webhooks: router({"), router.indexOf("// ── Unified Job Workspace"));

    expect(section).toContain("encryptWebhookSecret(signingSecret)");
    expect(section).toContain("validateWebhookEndpoint");
    expect(section).toContain("existing.length >= 3");
    expect(section).toContain("eq(workflowWebhooks.userId, ctx.user.id)");
    expect(section).toContain("eq(workflowWebhookDeliveries.userId, ctx.user.id)");
    expect(section).toContain("processDue: protectedProcedure");
    expect(section).not.toContain("payloadCiphertext: workflowWebhookDeliveries.payloadCiphertext");
    expect(section).not.toContain("active: z.boolean().optional(),\n        signingSecret");
    expect(delivery).toContain("Webhook endpoints must use HTTPS.");
    expect(delivery).toContain("isPrivateIpAddress");
    expect(delivery).toContain("Delivery dispatch could not start");
    expect(delivery).toContain("const MAX_DELIVERY_ATTEMPTS = 5");
    expect(delivery).toContain("payloadCiphertext = encryptWebhookSecret(serializeDeliveryPayload(eventId, eventType, data))");
    expect(delivery).toContain("processDueWorkflowWebhookDeliveries");
    expect(delivery).toContain("eq(workflowWebhookDeliveries.userId, userId)");
    expect(delivery).toContain("lt(workflowWebhookDeliveries.processingStartedAt, staleBefore)");
    expect(delivery).toContain('status: delivered ? "delivered" : terminal ? "terminal" : "retryable"');
    expect(delivery).toContain("payloadCiphertext: delivered || terminal ? null : delivery.payloadCiphertext");
    expect(router).toContain('"job.status_changed"');
    expect(router).toContain('"service_visit.scheduled"');
    expect(router).toContain('"service_visit.status_changed"');
    expect(consoleUi).toContain("stored encrypted on the server");
    expect(consoleUi).toContain("not undo the TrueAxis HQ action");
    expect(consoleUi).toContain("Process due deliveries");
    expect(consoleUi).toContain("managed periodic retry scheduling remains a separate validation gate");
  });
});
