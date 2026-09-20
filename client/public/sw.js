/**
 * TrueAxis HQ — Service Worker
 * Strategy: Cache-first for static assets, network-first for API calls
 * Enables: Offline support, faster loads, PWA installability
 */

const CACHE_NAME = "trueaxis-hq-v2";
const STATIC_CACHE = "trueaxis-static-v2";
const API_CACHE = "trueaxis-api-v2";

// Assets to pre-cache on install (app shell)
const APP_SHELL = [
  "/",
  "/manifest.json",
];

// ─── Install: Pre-cache app shell ────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(APP_SHELL);
    }).then(() => self.skipWaiting())
  );
});

// ─── Activate: Clean up old caches ───────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ─── Fetch: Routing strategy ──────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip cross-origin requests (CDN, OAuth, etc.)
  if (url.origin !== self.location.origin) return;

  // API routes: Network-first, no caching
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: "You are offline. Please check your connection." }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      })
    );
    return;
  }

  // JS/CSS bundles: Network-first (prevents stale bundles after deploys/restarts).
  // Fonts/images/icons: Cache-first (safe — they are content-addressed by hash).
  if (url.pathname.match(/\.(js|css)$/)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached ?? Response.error()))
    );
    return;
  }

  // Static assets (fonts, images, icons): Cache-first
  if (url.pathname.match(/\.(woff2?|ttf|eot|svg|png|jpg|jpeg|webp|ico)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML navigation: Network-first, fallback to cached index
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match("/").then((cached) => {
          if (cached) return cached;
          return new Response(
            "<html><body><h1>TrueAxis HQ</h1><p>You are offline. Please reconnect to continue.</p></body></html>",
            { headers: { "Content-Type": "text/html" } }
          );
        });
      })
  );
});

// ─── Background sync placeholder ─────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ─── Web Push (open protocol, zero vendors) ─────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = data.title || "TrueAxis HQ";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/" },
    tag: "trueaxis-" + Date.now(),
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) { client.focus(); if (client.url) client.navigate(url); return; }
      }
      return self.clients.openWindow(url);
    })
  );
});
