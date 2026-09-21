import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHmac } from "node:crypto";
import { WORKFLOW_WEBHOOK_EVENTS, parseWebhookEvents, isWorkflowWebhookEvent } from "../shared/workflowWebhooks";
import { createWebhookSignature } from "./workflowWebhookDelivery";

const source = (rel: string) => readFileSync(resolve(import.meta.dirname, rel), "utf8");

describe("app events on the signed webhook pipeline (external integrations without a marketplace)", () => {
  it("the allowlist exposes business moments for external receivers alongside workflow events", () => {
    expect(WORKFLOW_WEBHOOK_EVENTS).toContain("app.booking.created");
    expect(WORKFLOW_WEBHOOK_EVENTS).toContain("app.client.created");
    expect(WORKFLOW_WEBHOOK_EVENTS).toContain("app.invoice.paid");
    expect(WORKFLOW_WEBHOOK_EVENTS).toContain("app.proposal.signed");
    // every stored subscription round-trips through the same parser
    const round = parseWebhookEvents(JSON.stringify(["app.invoice.paid", "bogus.event"]));
    expect(round).toEqual(["app.invoice.paid"]);
    expect(isWorkflowWebhookEvent("app.booking.created")).toBe(true);
  });

  it("dispatches app.booking.created on BOTH booking paths — owner-created and public website booking (owner = hostId)", () => {
    const routers = source("./routers.ts");
    expect(routers.split('"app.booking.created"').length - 1).toBe(2);
    expect(routers).toContain('deliverWorkflowWebhookEvent(db, ctx.user.id, "app.booking.created"');
    expect(routers).toContain('deliverWorkflowWebhookEvent(db, hostId, "app.booking.created"');
  });

  it("dispatches the cash-flow and relationship events at their real business moments", () => {
    const routers = source("./routers.ts");
    expect(routers).toContain('deliverWorkflowWebhookEvent(db, ctx.user.id, "app.client.created"');
    expect(routers).toContain('"app.invoice.paid"');
    expect(routers).toContain('deliverWorkflowWebhookEvent(db, row.userId, "app.proposal.signed"');
    // invoice.paid fires in the manual markPaid flow, after the payment is persisted
    const mi = routers.indexOf("markPaid: protectedProcedure");
    expect(routers.indexOf('"app.invoice.paid"', mi)).toBeGreaterThan(mi);
  });

  it("signs app events with the exact documented HMAC contract receivers verify", () => {
    const secret = "tahq_whsec_test_secret";
    const timestamp = "1758500000";
    const body = JSON.stringify({ id: "evt_1", type: "app.invoice.paid", data: { invoiceId: 1 } });
    const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    expect(createWebhookSignature(secret, timestamp, body)).toBe(expected);
  });

  it("migration 0078 widens the delivery enum so every allowlisted event is storable", () => {
    const sql = source("../drizzle/0078_webhook_app_events.sql");
    for (const event of WORKFLOW_WEBHOOK_EVENTS) {
      expect(sql).toContain(`'${event}'`);
    }
  });

  it("the endpoint UI derives its event choices from the shared allowlist — new events appear without UI edits", () => {
    const ui = source("../client/src/pages/WorkflowWebhooks.tsx");
    expect(ui).toContain("WORKFLOW_WEBHOOK_EVENTS.map");
    expect(ui).toContain('"app.invoice.paid": "Invoice paid"');
    expect(ui).toContain('"app.booking.created": "New booking created"');
  });
});
