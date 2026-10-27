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

  it("the latest enum migration can store every allowlisted event (0078 + 0091 together)", () => {
    const sql = source("../drizzle/0078_webhook_app_events.sql") + source("../drizzle/0091_webhook_more_app_events.sql");
    for (const event of WORKFLOW_WEBHOOK_EVENTS) {
      expect(sql).toContain(`'${event}'`);
    }
    // 0091 is a superset: the enum is fully restated, never appended
    const latest = source("../drizzle/0091_webhook_more_app_events.sql");
    for (const event of WORKFLOW_WEBHOOK_EVENTS) {
      expect(latest).toContain(`'${event}'`);
    }
  });

  it("dispatches the lifecycle events at their real business moments", () => {
    const routers = source("./routers.ts");
    // invoice.created fires right after the insert in invoices.create
    const ci = routers.indexOf("invoiceNumber,");
    expect(routers).toContain('deliverWorkflowWebhookEvent(db, ctx.user.id, "app.invoice.created"');
    // job.completed fires only on a real transition into completed
    const ji = routers.indexOf('"app.job.completed"');
    expect(ji).toBeGreaterThan(routers.indexOf('"job.status_changed"'));
    expect(routers.slice(ji - 140, ji + 60)).toContain('input.status === "completed"');
  });

  it("fires the ops events from the background paths that detect them", () => {
    const jobs = source("./backgroundJobs.ts");
    // overdue webhook fires once per invoice, after selecting exactly the rows that flip
    expect(jobs).toContain('"app.invoice.overdue"');
    expect(jobs.indexOf("SELECT id, userId, invoiceNumber")).toBeGreaterThan(-1);
    expect(jobs.indexOf("app.invoice.overdue")).toBeGreaterThan(jobs.indexOf("UPDATE invoices SET status = 'overdue'") - 1);
    const engine = source("./automationEngine.ts");
    expect(engine).toContain('"app.automation.failed"');
    expect(engine).toContain('status === "failed"');
  });

  it("the endpoint UI derives its event choices from the shared allowlist — new events appear without UI edits", () => {
    const ui = source("../client/src/pages/WorkflowWebhooks.tsx");
    expect(ui).toContain("WORKFLOW_WEBHOOK_EVENTS.map");
    expect(ui).toContain('"app.invoice.paid": "Invoice paid"');
    expect(ui).toContain('"app.booking.created": "New booking created"');
  });
});
