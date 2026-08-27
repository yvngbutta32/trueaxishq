import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import https from "node:https";
import net from "node:net";
import { and, eq, inArray, lt, lte, or } from "drizzle-orm";
import { getDb } from "./db";
import { workflowWebhookDeliveries, workflowWebhooks } from "../drizzle/schema";
import { type WorkflowWebhookEvent } from "../shared/workflowWebhooks";

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const DELIVERY_TIMEOUT_MS = 8_000;
const MAX_SUMMARY_LENGTH = 1_000;
const MAX_EVENT_BYTES = 120_000;
const MAX_DELIVERY_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000, 7_200_000];
const PROCESSING_LEASE_MS = 10 * 60_000;

function getEncryptionKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Webhook encryption is unavailable because the server secret is missing.");
  return createHash("sha256").update(secret).digest();
}

function isPrivateIpAddress(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) {
    const [first, second] = address.split(".").map(Number);
    return first === 0 || first === 10 || first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 198 && (second === 18 || second === 19));
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith("::ffff:")) return isPrivateIpAddress(normalized.slice(7));
    return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
  }
  return true;
}

function isReservedHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return normalized === "localhost" || normalized.endsWith(".localhost") || normalized.endsWith(".local") || normalized.endsWith(".internal") || normalized.endsWith(".test");
}

export async function validateWebhookEndpoint(value: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid HTTPS endpoint URL.");
  }
  if (url.protocol !== "https:") throw new Error("Webhook endpoints must use HTTPS.");
  if (url.username || url.password) throw new Error("Webhook endpoint URLs cannot contain credentials.");
  if (isReservedHost(url.hostname)) throw new Error("Webhook endpoint host is not allowed.");
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(address => isPrivateIpAddress(address.address))) {
    throw new Error("Webhook endpoint must resolve to a public network address.");
  }
  return url.toString();
}

export function createWebhookSigningSecret(): string {
  return `tahq_whsec_${randomBytes(24).toString("base64url")}`;
}

export function encryptWebhookSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map(value => value.toString("base64url")).join(".");
}

export function decryptWebhookSecret(encrypted: string): string {
  const [ivValue, tagValue, ciphertextValue] = encrypted.split(".");
  if (!ivValue || !tagValue || !ciphertextValue) throw new Error("Webhook secret is unreadable.");
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]).toString("utf8");
}

export function createWebhookSignature(secret: string, timestamp: string, payload: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
}

function truncate(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/[\r\n]+/g, " ").slice(0, MAX_SUMMARY_LENGTH);
}

function nextRetryAt(attemptCount: number): Date | null {
  const delay = RETRY_DELAYS_MS[Math.max(0, attemptCount - 1)];
  return delay === undefined ? null : new Date(Date.now() + delay);
}

function serializeDeliveryPayload(eventId: string, eventType: WorkflowWebhookEvent, data: Record<string, unknown>): string {
  const payload = JSON.stringify({ id: eventId, type: eventType, occurredAt: new Date().toISOString(), data });
  if (Buffer.byteLength(payload, "utf8") > MAX_EVENT_BYTES) throw new Error("Workflow webhook event exceeds the bounded recovery envelope limit.");
  return payload;
}

async function postSignedWebhook(endpoint: string, headers: Record<string, string>, payload: string): Promise<{ status: number; summary: string | null }> {
  const url = new URL(endpoint);
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(address => isPrivateIpAddress(address.address))) throw new Error("Endpoint no longer resolves to a public network address.");
  const target = addresses[0];
  return new Promise((resolve, reject) => {
    const request = https.request({
      protocol: "https:",
      hostname: target.address,
      port: url.port ? Number(url.port) : 443,
      path: `${url.pathname}${url.search}`,
      method: "POST",
      servername: url.hostname,
      rejectUnauthorized: true,
      timeout: DELIVERY_TIMEOUT_MS,
      headers: { Host: url.host, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload).toString(), ...headers },
    }, response => {
      const chunks: Buffer[] = [];
      let capturedLength = 0;
      response.on("data", (chunk: Buffer) => {
        if (capturedLength >= MAX_SUMMARY_LENGTH) return;
        const value = Buffer.from(chunk);
        const captured = value.subarray(0, MAX_SUMMARY_LENGTH - capturedLength);
        chunks.push(captured);
        capturedLength += captured.length;
      });
      response.on("end", () => resolve({ status: response.statusCode ?? 0, summary: truncate(Buffer.concat(chunks).toString("utf8")) }));
    });
    request.on("timeout", () => request.destroy(new Error("Webhook delivery timed out.")));
    request.on("error", reject);
    request.end(payload);
  });
}

type WorkflowDeliveryOutcome = "delivered" | "skipped" | "retryable" | "terminal";

async function attemptWorkflowWebhookDelivery(db: Database, userId: number, deliveryId: number): Promise<WorkflowDeliveryOutcome> {
  const [delivery] = await db.select().from(workflowWebhookDeliveries).where(and(
    eq(workflowWebhookDeliveries.id, deliveryId),
    eq(workflowWebhookDeliveries.userId, userId),
  )).limit(1);
  if (!delivery || delivery.status === "delivered" || delivery.status === "failed" || delivery.status === "terminal" || !delivery.payloadCiphertext || !delivery.endpointUrl) return "skipped";
  const staleBefore = new Date(Date.now() - PROCESSING_LEASE_MS);
  const staleLease = delivery.status === "processing" && Boolean(delivery.processingStartedAt && delivery.processingStartedAt < staleBefore);
  if (delivery.status === "processing" && !staleLease) return "skipped";

  const [subscription] = await db.select().from(workflowWebhooks).where(and(
    eq(workflowWebhooks.id, delivery.webhookId),
    eq(workflowWebhooks.userId, userId),
  )).limit(1);
  if (!subscription) {
    await db.update(workflowWebhookDeliveries).set({
      status: "terminal", terminalAt: new Date(), payloadCiphertext: null, processingStartedAt: null,
      errorMessage: "Endpoint was removed before this delivery could be retried.",
    }).where(and(eq(workflowWebhookDeliveries.id, deliveryId), eq(workflowWebhookDeliveries.userId, userId)));
    return "terminal";
  }
  if (!subscription.active) return "skipped";

  const claim = await db.update(workflowWebhookDeliveries).set({ status: "processing", processingStartedAt: new Date(), lastAttemptAt: new Date() })
    .where(and(
      eq(workflowWebhookDeliveries.id, deliveryId),
      eq(workflowWebhookDeliveries.userId, userId),
      or(
        inArray(workflowWebhookDeliveries.status, ["pending", "retryable"]),
        and(eq(workflowWebhookDeliveries.status, "processing"), lt(workflowWebhookDeliveries.processingStartedAt, staleBefore)),
      ),
    ));
  if (!claim[0].affectedRows) return "skipped";

  try {
    const payload = decryptWebhookSecret(delivery.payloadCiphertext);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const secret = decryptWebhookSecret(subscription.encryptedSecret);
    const response = await postSignedWebhook(delivery.endpointUrl, {
      "X-TrueAxis-Event": delivery.eventType,
      "X-TrueAxis-Event-Id": delivery.eventId,
      "X-TrueAxis-Timestamp": timestamp,
      "X-TrueAxis-Signature": createWebhookSignature(secret, timestamp, payload),
    }, payload);
    const delivered = response.status >= 200 && response.status < 300;
    const attemptCount = delivery.attemptCount + 1;
    const terminal = !delivered && attemptCount >= MAX_DELIVERY_ATTEMPTS;
    const errorMessage = delivered ? null : `Endpoint returned HTTP ${response.status}.`;
    await db.update(workflowWebhookDeliveries).set({
      status: delivered ? "delivered" : terminal ? "terminal" : "retryable",
      attemptCount,
      responseStatus: response.status || null,
      responseSummary: response.summary,
      errorMessage,
      deliveredAt: delivered ? new Date() : null,
      terminalAt: terminal ? new Date() : null,
      nextAttemptAt: delivered || terminal ? null : nextRetryAt(attemptCount),
      processingStartedAt: null,
      payloadCiphertext: delivered || terminal ? null : delivery.payloadCiphertext,
    }).where(and(eq(workflowWebhookDeliveries.id, deliveryId), eq(workflowWebhookDeliveries.userId, userId), eq(workflowWebhookDeliveries.status, "processing")));
    await db.update(workflowWebhooks).set({
      failureCount: delivered ? 0 : subscription.failureCount + 1,
      lastDeliveredAt: delivered ? new Date() : subscription.lastDeliveredAt,
      lastError: delivered ? null : errorMessage,
      updatedAt: new Date(),
    }).where(and(eq(workflowWebhooks.id, subscription.id), eq(workflowWebhooks.userId, userId)));
    return delivered ? "delivered" : terminal ? "terminal" : "retryable";
  } catch (error) {
    const attemptCount = delivery.attemptCount + 1;
    const terminal = attemptCount >= MAX_DELIVERY_ATTEMPTS;
    const message = truncate(error instanceof Error ? error.message : "Webhook delivery failed.");
    await db.update(workflowWebhookDeliveries).set({
      status: terminal ? "terminal" : "retryable", attemptCount, errorMessage: message,
      terminalAt: terminal ? new Date() : null, nextAttemptAt: terminal ? null : nextRetryAt(attemptCount),
      processingStartedAt: null, payloadCiphertext: terminal ? null : delivery.payloadCiphertext,
    }).where(and(eq(workflowWebhookDeliveries.id, deliveryId), eq(workflowWebhookDeliveries.userId, userId), eq(workflowWebhookDeliveries.status, "processing")));
    await db.update(workflowWebhooks).set({ failureCount: subscription.failureCount + 1, lastError: message, updatedAt: new Date() })
      .where(and(eq(workflowWebhooks.id, subscription.id), eq(workflowWebhooks.userId, userId)));
    return terminal ? "terminal" : "retryable";
  }
}

export async function processDueWorkflowWebhookDeliveries(db: Database, userId: number, limit = 10): Promise<Record<WorkflowDeliveryOutcome, number>> {
  const staleBefore = new Date(Date.now() - PROCESSING_LEASE_MS);
  const deliveries = await db.select({ id: workflowWebhookDeliveries.id }).from(workflowWebhookDeliveries).where(and(
    eq(workflowWebhookDeliveries.userId, userId),
    or(
      eq(workflowWebhookDeliveries.status, "pending"),
      and(eq(workflowWebhookDeliveries.status, "retryable"), lte(workflowWebhookDeliveries.nextAttemptAt, new Date())),
      and(eq(workflowWebhookDeliveries.status, "processing"), lt(workflowWebhookDeliveries.processingStartedAt, staleBefore)),
    ),
  )).limit(Math.min(Math.max(limit, 1), 25));
  const summary: Record<WorkflowDeliveryOutcome, number> = { delivered: 0, skipped: 0, retryable: 0, terminal: 0 };
  for (const delivery of deliveries) summary[await attemptWorkflowWebhookDelivery(db, userId, delivery.id)]++;
  return summary;
}

export async function deliverWorkflowWebhookEvent(db: Database, userId: number, eventType: WorkflowWebhookEvent, data: Record<string, unknown>): Promise<void> {
  try {
    const subscriptions = await db.select().from(workflowWebhooks).where(and(
      eq(workflowWebhooks.userId, userId),
      eq(workflowWebhooks.active, true),
    ));
    const eventId = randomBytes(16).toString("hex");
    const payloadCiphertext = encryptWebhookSecret(serializeDeliveryPayload(eventId, eventType, data));
    for (const subscription of subscriptions) {
      try {
        if (!JSON.parse(subscription.events).includes(eventType)) continue;
      } catch {
        continue;
      }
      const [insert] = await db.insert(workflowWebhookDeliveries).values({
        userId, webhookId: subscription.id, eventId, eventType, status: "pending",
        endpointUrl: subscription.endpointUrl, payloadCiphertext, attemptCount: 0,
      });
      await attemptWorkflowWebhookDelivery(db, userId, Number(insert.insertId));
    }
  } catch (error) {
    console.error("[Workflow Webhook] Delivery dispatch could not start", error instanceof Error ? error.message : error);
  }
}
