import "dotenv/config";
import compression from "compression";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleStripeWebhook } from "../stripeWebhook";
import { securityMiddleware } from "../security";
import { avatarUploadRouter } from "../avatarUpload";
import { documentUploadRouter } from "../documentUpload";
import { photoUploadRouter } from "../photoUpload";
import { icalRouter } from "../icalExport";
import { startBackgroundJobs } from "../backgroundJobs";
import { invoicePdfRouter } from "../invoicePdf";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ── Trust proxy: required for correct req.secure and req.protocol behind
  //    reverse proxies (Nginx, Cloudflare, Manus hosting layer, etc.) ───────
  app.set("trust proxy", 1);

  // ── Gzip/Brotli compression for all responses ────────────────────────────
  app.use(compression({ level: 6, threshold: 1024 }));

  // ── Stripe webhook MUST use raw body — register BEFORE express.json() ──────
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    handleStripeWebhook
  );

  // ── Standard body parsers ─────────────────────────────────────────────────
  // 2 MB is sufficient for JSON API calls; file uploads use multipart (avatarUploadRouter/documentUploadRouter)
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ limit: "2mb", extended: true }));

  // ── Security middleware (rate limiting, blocklist, header hardening) ──────
  // Apply full security (rate limiting + headers) to all routes
  // but only count rate limits for /api/ paths to prevent static assets
  // from consuming the per-IP quota and causing 429 on page load
  app.use(securityMiddleware);

  // ── Health Check ─────────────────────────────────────────────────────────
  app.get("/api/health", async (_req, res) => {
    const start = Date.now();
    const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

    // DB check
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (db) {
        const dbStart = Date.now();
        await db.execute("SELECT 1");
        checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
      } else {
        checks.database = { status: "unavailable" };
      }
    } catch (e: unknown) {
      checks.database = { status: "error", error: e instanceof Error ? e.message : String(e) };
    }

    // Stripe check
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    checks.stripe = stripeKey ? { status: "configured" } : { status: "not_configured" };

    // LLM check
    const llmKey = process.env.BUILT_IN_FORGE_API_KEY;
    checks.llm = llmKey ? { status: "configured" } : { status: "not_configured" };

    const allOk = checks.database?.status === "ok";
    const totalMs = Date.now() - start;

    res.status(allOk ? 200 : 503).json({
      status: allOk ? "healthy" : "degraded",
      version: process.env.npm_package_version || "1.0.0",
      uptime: Math.floor(process.uptime()),
      totalLatencyMs: totalMs,
      checks,
      timestamp: new Date().toISOString(),
    });
  });

  // ── Avatar Upload ─────────────────────────────────────────────────────────
  app.use(avatarUploadRouter);

  // ── Document Upload ───────────────────────────────────────────────────────────────────────────────────────
  app.use(documentUploadRouter);

  // ── Photo Upload (job photos: estimate / wip / finished / receipt) ────────
  app.use(photoUploadRouter);

  // ── iCal Calendar Export ──────────────────────────────────────────────────
  app.use("/api", icalRouter);

  // ── Invoice PDF Download ─────────────────────────────────────────────────
  app.use(invoicePdfRouter);

  // ── Google Calendar OAuth Callback ───────────────────────────────────────
  app.get("/api/google-calendar/callback", async (req, res) => {
    const { code, state, error } = req.query as Record<string, string>;
    const origin = `${req.protocol}://${req.get("host")}`;

    if (error || !code) {
      return res.redirect(`${origin}/dashboard?gcal_error=${encodeURIComponent(error || "no_code")}`);
    }

    const userId = parseInt(state || "0", 10);
    if (!userId) {
      return res.redirect(`${origin}/dashboard?gcal_error=invalid_state`);
    }

    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return res.redirect(`${origin}/dashboard?gcal_error=not_configured`);
      }

      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: `${origin}/api/google-calendar/callback`,
          grant_type: "authorization_code",
        }),
      });
      const tokenData = await tokenRes.json() as any;

      if (!tokenData.access_token) {
        console.error("[Google Calendar] Token exchange failed:", tokenData);
        return res.redirect(`${origin}/dashboard?gcal_error=token_exchange_failed`);
      }

      // Get primary calendar ID
      let calendarId = "primary";
      try {
        const calRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList/primary", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const calData = await calRes.json() as any;
        calendarId = calData.id || "primary";
      } catch { /* use 'primary' as fallback */ }

      // Save tokens to DB
      const { getDb } = await import("../db");
      const { googleCalendarTokens } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (db) {
        const existing = await db.select({ id: googleCalendarTokens.id })
          .from(googleCalendarTokens).where(eq(googleCalendarTokens.userId, userId)).limit(1);
        if (existing.length > 0) {
          await db.update(googleCalendarTokens).set({
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token || null,
            expiresAt: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000),
            calendarId,
            syncEnabled: true,
          }).where(eq(googleCalendarTokens.userId, userId));
        } else {
          await db.insert(googleCalendarTokens).values({
            userId,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token || null,
            expiresAt: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000),
            calendarId,
            syncEnabled: true,
          });
        }
      }

      return res.redirect(`${origin}/dashboard?gcal_connected=1`);
    } catch (err) {
      console.error("[Google Calendar] OAuth callback error:", err);
      return res.redirect(`${origin}/dashboard?gcal_error=server_error`);
    }
  });

  // ── tRPC API────────────────────────────────────────────────────────────
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // ── Scheduled / Heartbeat handlers ─────────────────────────────────────────
  const { dailyDigestHandler } = await import("../digestHandler");
  app.post("/api/scheduled/dailyDigest", dailyDigestHandler);

  // ── Cache-Control for API responses (no caching) ─────────────────────────
  // Registered BEFORE static/Vite so it applies to all /api/* responses
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    next();
  });

  // ── Static / Vite ─────────────────────────────────────────────────────────
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ── Global Express error handler ─────────────────────────────────────────
  // 4-argument signature is required by Express to recognise this as an error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[Server] Unhandled Express error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const preferredPort = parseInt(process.env.PORT || "3000", 10);
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    startBackgroundJobs();
  });
}

// ── Process-level error guards ───────────────────────────────────────────────
process.on("unhandledRejection", (reason) => {
  // Log but do NOT crash — a single transient DB error should not take down all users
  console.error("[Server] Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (err: any) => {
  // Transient network/DB errors should never crash the server
  const isTransient = err?.code === "ECONNRESET" || err?.code === "ETIMEDOUT" ||
    err?.code === "ECONNREFUSED" || err?.code === "EPIPE" || err?.code === "ENOTFOUND";
  if (isTransient) {
    console.warn("[Server] Transient uncaught exception (ignored):", err?.code, err?.message);
    return;
  }
  console.error("[Server] Uncaught Exception — exiting for clean restart:", err);
  process.exit(1);
});

startServer().catch(console.error);
