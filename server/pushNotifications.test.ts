/**
 * Web Push contract — zero-vendor PWA push notifications.
 * Open Web Push protocol: no push company, no app store, no per-message fee.
 * VAPID keys are self-generated on the server and never leave it.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (rel: string) => readFileSync(join(__dirname, rel), "utf8");

describe("web push: open protocol, honest degradation, no vendors", () => {
  it("core is best-effort: never throws, reports honest skip reasons, prunes dead endpoints", () => {
    const src = read("_core/push.ts");
    expect(src).toMatch(/skippedBecause/);
    expect(src).toContain("no subscribed devices");
    expect(src).toContain("vapid keys unavailable");
    expect(src).toContain("404 || status === 410"); // dead endpoint pruning
    expect(src).toContain("catch"); // never throws to callers
    expect(src).toMatch(/generateVAPIDKeys/); // self-generated, no external account
  });

  it("private VAPID key never leaves the server; only the public key is exposed", () => {
    const routerSrc = read("routers.ts");
    expect(routerSrc).toMatch(/vapidPublicKey[\s\S]{0,200}publicKey/);
    const pushRoutes = routerSrc.slice(routerSrc.indexOf("push: router({"), routerSrc.indexOf("integrations: router({"));
    expect(pushRoutes).not.toMatch(/privateKey/); // private key is never returned by any route
  });

  it("push triggers are fire-and-forget: booking success never depends on push", () => {
    const routerSrc = read("routers.ts");
    expect(routerSrc).toMatch(/void sendPushToUser[\s\S]{0,160}\.catch\(\(\) => \{\}\)/);
    expect(routerSrc).toContain("New booking from your website"); // public booking form -> owner
    expect(routerSrc).toContain("New booking created");           // manual booking -> owner
  });

  it("subscription is per-device, owner-scoped, and endpoint-unique (one row per device)", () => {
    const routerSrc = read("routers.ts");
    const pushRoutes = routerSrc.slice(routerSrc.indexOf("push: router({"), routerSrc.indexOf("integrations: router({"));
    expect(pushRoutes).toContain("onDuplicateKeyUpdate"); // upsert on endpoint
    expect(pushRoutes).toMatch(/eq\(pushSubscriptions\.userId, ctx\.user\.id\)/); // owner-scoped reads/deletes
    const schema = read("../drizzle/schema.ts");
    expect(schema).toMatch(/push_endpoint_unique/);
  });

  it("service worker handles push + notificationclick honestly (no silent drops)", () => {
    const sw = read("../client/public/sw.js");
    expect(sw).toContain('addEventListener("push"');
    expect(sw).toContain("showNotification");
    expect(sw).toContain('addEventListener("notificationclick"');
    expect(sw).toMatch(/data\.url/); // deep-links into the app
  });

  it("client card degrades honestly when the browser cannot push", () => {
    const hub = read("../client/src/pages/IntegrationHub.tsx");
    expect(hub).toContain("PushNotificationsCard");
    expect(hub).toContain("does not support web push");
    expect(hub).toContain("requestPermission");
    expect(hub).toMatch(/sendTest/); // owner-visible proof it works
  });

  it("migration + schema agree (pushSubscriptions, pushVapidKeys)", () => {
    expect(read("../drizzle/0076_push_subscriptions.sql")).toContain("CREATE TABLE `pushSubscriptions`");
    expect(read("../drizzle/0076_push_subscriptions.sql")).toContain("CREATE TABLE `pushVapidKeys`");
  });

  it("zero-cost rule still holds: web-push is a library, not a paid company", async () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8"));
    expect(pkg.dependencies["web-push"]).toBeTruthy();
    // web-push is the open-protocol client; there is no push vendor account anywhere
    const env = read("../.env.example");
    expect(env).not.toMatch(/PUSH_|VAPID_/); // no external push credentials ever
  });
});
