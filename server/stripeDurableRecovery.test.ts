import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const source = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

describe("durable Stripe event recovery", () => {
  it("extends the existing idempotency ledger with encrypted payload, bounded state, attempt evidence, and due-work indexing", () => {
    const schema = source("drizzle/schema.ts");
    expect(schema).toContain('status: mysqlEnum("status", ["received", "processing", "processed", "retryable", "terminal"])');
    expect(schema).toContain('payloadCiphertext: text("payloadCiphertext")');
    expect(schema).toContain('attemptCount: int("attemptCount").default(0).notNull()');
    expect(schema).toContain('nextAttemptAt: timestamp("nextAttemptAt")');
    expect(schema).toContain('index("stripeWebhookEvents_retry_due_idx").on(t.status, t.nextAttemptAt)');
    expect(schema).toContain('uniqueIndex("stripeWebhookEvents_eventId_idx").on(t.eventId)');
  });

  it("persists an encrypted bounded event envelope before acknowledgment and leaves no accepted event in process-local memory", () => {
    const stripe = source("server/stripeWebhook.ts");
    expect(stripe).toContain("const MAX_EVENT_BYTES = 120_000");
    expect(stripe).toContain("payloadCiphertext: encryptWebhookSecret(serializeRecoveryEnvelope(event))");
    expect(stripe).toContain("return res.status(503).json({ error: \"Payment event storage is temporarily unavailable\" })");
    expect(stripe.indexOf("await db.insert(stripeWebhookEvents).values")).toBeLessThan(stripe.indexOf("res.json({ received: true })"));
    expect(stripe).not.toContain("const retryQueue");
    expect(stripe).not.toContain("setInterval(flushRetryQueue");
  });

  it("uses atomic status claiming, bounded retry scheduling, terminal visibility, and no receiver-completion assertion", () => {
    const stripe = source("server/stripeWebhook.ts");
    expect(stripe).toContain("inArray(stripeWebhookEvents.status, [\"received\", \"retryable\"])");
    expect(stripe).toContain("const PROCESSING_LEASE_MS = 10 * 60_000");
    expect(stripe).toContain("canReclaimProcessingLease");
    expect(stripe).toContain("lt(stripeWebhookEvents.processingStartedAt, staleBefore)");
    expect(stripe).toContain('status: terminal ? "terminal" : "retryable"');
    expect(stripe).toContain("const MAX_PROCESSING_ATTEMPTS = 5");
    expect(stripe).toContain("nextAttemptAt: terminal ? null : nextRetryTime(attemptCount)");
    expect(stripe).toContain("export async function processDueStripeEvents");
    expect(stripe).toContain("Stripe event needs review");
    expect(stripe).toContain("it does not prove");
  });

  it("keeps recovery evidence owner-only and excludes encrypted payloads from the admin console", () => {
    const router = source("server/routers.ts");
    const admin = source("client/src/pages/Admin.tsx");
    const recoveryRouter = router.slice(router.indexOf("stripeRecovery: router({"), router.indexOf("// ── Admin"));
    expect(recoveryRouter).toContain("list: ownerProcedure");
    expect(recoveryRouter).toContain("processDue: ownerProcedure");
    expect(recoveryRouter).not.toContain("payloadCiphertext:");
    expect(admin).toContain('activeTab === "stripe_recovery"');
    expect(admin).toContain("Owner-only processing evidence");
    expect(admin).not.toContain("event.payloadCiphertext");
  });
});
