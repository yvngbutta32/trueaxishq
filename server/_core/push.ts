/**
 * TrueAxis HQ — Web Push (PWA push notifications, zero vendors)
 *
 * Web Push is an open protocol: no app store, no push service company, no
 * per-message fee. VAPID keys are self-generated (never leave the server) and
 * stored in the DB — the browser's built-in push service (Chrome/Firefox/Safari
 * etc.) delivers them for free. Honest degradation: if no VAPID keys can be
 * generated, or no subscriptions exist, push simply doesn't fire and callers
 * get a truthful { sent, skippedBecause } result.
 */
import { sql } from "drizzle-orm";
import { getDb } from "../db";

let vapidCache: { publicKey: string; privateKey: string } | null | undefined;

/** Loads or generates the VAPID keypair (id=1 singleton row). */
export async function getVapidKeys(): Promise<{ publicKey: string; privateKey: string } | null> {
  if (vapidCache !== undefined) return vapidCache;
  try {
    const db = await getDb();
    if (!db) { vapidCache = null; return null; }
    const raw = await db.execute(sql`SELECT publicKey, privateKey FROM pushVapidKeys WHERE id = 1`);
    const rows = (Array.isArray(raw) ? raw : ((raw as { rows?: unknown[] }).rows ?? [])) as Record<string, unknown>[];
    const row = rows[0];
    if (row?.publicKey && row?.privateKey) {
      vapidCache = { publicKey: String(row.publicKey), privateKey: String(row.privateKey) };
      return vapidCache;
    }
    // Generate once, store, reuse.
    const webpush = (await import("web-push")).default;
    const keys = webpush.generateVAPIDKeys();
    await db.execute(sql`INSERT INTO pushVapidKeys (id, publicKey, privateKey) VALUES (1, ${keys.publicKey}, ${keys.privateKey})
      ON DUPLICATE KEY UPDATE publicKey = VALUES(publicKey), privateKey = VALUES(privateKey)`);
    vapidCache = { publicKey: keys.publicKey, privateKey: keys.privateKey };
    return vapidCache;
  } catch {
    vapidCache = null;
    return null;
  }
}

export interface PushResult { sent: number; skippedBecause: string | null }

/**
 * Send a push notification to every subscribed device of a user.
 * Never throws — push is best-effort; dead endpoints are pruned.
 */
export async function sendPushToUser(userId: number, title: string, body: string, url = "/"): Promise<PushResult> {
  try {
    const db = await getDb();
    if (!db) return { sent: 0, skippedBecause: "database unavailable" };
    const rawSubs = await db.execute(sql`SELECT id, endpoint, p256dh, auth FROM pushSubscriptions WHERE userId = ${userId}`);
    const rows = (Array.isArray(rawSubs) ? rawSubs : ((rawSubs as { rows?: unknown[] }).rows ?? [])) as Record<string, unknown>[];
    if (!rows.length) return { sent: 0, skippedBecause: "no subscribed devices" };
    const keys = await getVapidKeys();
    if (!keys) return { sent: 0, skippedBecause: "vapid keys unavailable" };
    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails("mailto:notifications@trueaxishq.local", keys.publicKey, keys.privateKey);
    let sent = 0;
    for (const sub of rows) {
      try {
        await webpush.sendNotification(
          { endpoint: String(sub.endpoint), keys: { p256dh: String(sub.p256dh), auth: String(sub.auth) } },
          JSON.stringify({ title, body, url }),
          { TTL: 86400 }
        );
        sent += 1;
      } catch (err: unknown) {
        // 404/410 = dead endpoint; prune silently. Others: leave for retry.
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await db.execute(sql`DELETE FROM pushSubscriptions WHERE id = ${sub.id}`).catch(() => {});
        }
      }
    }
    return { sent, skippedBecause: sent ? null : "all endpoints failed" };
  } catch {
    return { sent: 0, skippedBecause: "push pipeline error (non-fatal)" };
  }
}
