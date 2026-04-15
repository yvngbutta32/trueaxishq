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
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

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

  // ── iCal Calendar Export ──────────────────────────────────────────────────
  app.use("/api", icalRouter);

  // ── Invoice PDF Download ─────────────────────────────────────────────────
  app.use(invoicePdfRouter);

  // ── tRPC API────────────────────────────────────────────────────────────
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // ── Static / Vite ─────────────────────────────────────────────────────────
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ── Cache-Control for API responses (no caching) ─────────────────────────
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    next();
  });

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    startBackgroundJobs();
  });
}

startServer().catch(console.error);
