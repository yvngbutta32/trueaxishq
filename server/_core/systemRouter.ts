import { z } from "zod";
import nodemailer from "nodemailer";
import Stripe from "stripe";
import { notifyOwner } from "./notification";
import { getDb } from "../db";
import { adminProcedure, protectedProcedure, router } from "./trpc";
import { getEmailDeliveryStatus } from "./email";
import { classifySmtpError, classifyStripeError, withTimeout, type ConnectionErrorKind } from "./connectionCheck";

export const systemRouter = router({
  health: protectedProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(async () => {
      const start = Date.now();
      const checks: Record<string, { status: string; latencyMs?: number }> = {};
      try {
        const db = await getDb();
        if (!db) {
          checks.database = { status: "unavailable" };
        } else {
          const dbStart = Date.now();
          await db.execute("SELECT 1");
          checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
        }
      } catch {
        checks.database = { status: "error" };
      }
      checks.stripe = { status: process.env.STRIPE_SECRET_KEY ? "configured" : "not_configured" };
      checks.llm = { status: process.env.BUILT_IN_FORGE_API_KEY ? "configured" : "not_configured" };
      const status = checks.database.status === "ok" ? "healthy" : "degraded";
      return {
        status,
        uptime: Math.floor(process.uptime()),
        totalLatencyMs: Date.now() - start,
        checks,
        timestamp: new Date().toISOString(),
      };
    }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  /**
   * Live connection self-test for owner-credentialed providers (SMTP, Stripe).
   * Runs a real handshake + auth against SMTP and an authenticated balance
   * ping against Stripe, both under hard timeouts. Optionally sends a test
   * email to the requesting admin's own address only.
   */
  testConnections: adminProcedure
    .input(z.object({ sendTestEmail: z.boolean().default(false) }))
    .mutation(async ({ input, ctx }) => {
      const CONNECTION_TIMEOUT_MS = 10_000;

      // ── SMTP ──────────────────────────────────────────────────────────────
      const emailStatus = getEmailDeliveryStatus();
      let smtp: {
        configured: boolean;
        verified: boolean;
        latencyMs: number | null;
        errorKind: ConnectionErrorKind | null;
        errorDetail: string | null;
        issues: string[];
        testEmailSent: boolean;
      } = {
        configured: emailStatus.configured,
        verified: false,
        latencyMs: null,
        errorKind: null,
        errorDetail: null,
        issues: emailStatus.issues,
        testEmailSent: false,
      };

      if (emailStatus.configured && emailStatus.host && emailStatus.port) {
        // Fresh transporter: SMTP credentials may have changed since boot, and
        // the cached one could predate them.
        const transporter = nodemailer.createTransport({
          host: emailStatus.host,
          port: emailStatus.port,
          secure: emailStatus.secure,
          auth: { user: process.env.SMTP_USER!.trim(), pass: process.env.SMTP_PASS! },
          tls: { rejectUnauthorized: process.env.NODE_ENV === "production" },
          connectionTimeout: CONNECTION_TIMEOUT_MS,
          greetingTimeout: CONNECTION_TIMEOUT_MS,
          socketTimeout: CONNECTION_TIMEOUT_MS,
        });

        const start = Date.now();
        const verified = await withTimeout(transporter.verify(), CONNECTION_TIMEOUT_MS, "SMTP verification");
        smtp.latencyMs = Date.now() - start;

        if (verified.ok) {
          smtp.verified = true;
          if (input.sendTestEmail && ctx.user.email) {
            try {
              await transporter.sendMail({
                from: emailStatus.sender ?? process.env.SMTP_USER!.trim(),
                to: ctx.user.email, // test email goes only to the requesting admin
                subject: "TrueAxis HQ — SMTP connection test",
                text: "This confirms your SMTP configuration is delivering mail. If you received this, email is live.",
                html: "<div style=\"font-family:sans-serif;padding:24px\"><h2>SMTP connection test</h2><p>This confirms your SMTP configuration is delivering mail. If you received this, email is live.</p><p style=\"color:#666;font-size:13px\">Sent from TrueAxis HQ connection diagnostics.</p></div>",
              });
              smtp.testEmailSent = true;
            } catch (error) {
              const err = error as NodeJS.ErrnoException & { code?: string };
              smtp.errorKind = classifySmtpError(err.code, err.message);
              smtp.errorDetail = "Verification passed, but the test send failed.";
            }
          }
        } else {
          const err = verified.error as NodeJS.ErrnoException & { code?: string };
          smtp.errorKind = verified.errorKind === "timeout" ? "timeout" : classifySmtpError(err.code, err.message);
          smtp.errorDetail = err.message ?? null;
        }
        transporter.close();
      }

      // ── Stripe ────────────────────────────────────────────────────────────
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      let stripe: {
        configured: boolean;
        verified: boolean;
        latencyMs: number | null;
        errorKind: ConnectionErrorKind | null;
        errorDetail: string | null;
        accountEmail: string | null;
      } = { configured: Boolean(stripeKey), verified: false, latencyMs: null, errorKind: null, errorDetail: null, accountEmail: null };

      if (stripeKey) {
        // Fresh client: the cached instance may predate a key rotation.
        const client = new Stripe(stripeKey, { apiVersion: "2026-02-25.clover", maxNetworkRetries: 0, timeout: CONNECTION_TIMEOUT_MS });
        const start = Date.now();
        const balance = await withTimeout(client.balance.retrieve(), CONNECTION_TIMEOUT_MS, "Stripe balance check");
        stripe.latencyMs = Date.now() - start;
        if (balance.ok) {
          stripe.verified = true;
        } else {
          const err = balance.error as { type?: string; statusCode?: number; message?: string };
          stripe.errorKind = balance.errorKind === "timeout" ? "timeout" : classifyStripeError(err);
          stripe.errorDetail = err.message ?? "Stripe rejected the request.";
        }
      }

      return { smtp, stripe } as const;
    }),
});
