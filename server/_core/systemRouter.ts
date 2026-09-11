import { z } from "zod";
import { notifyOwner } from "./notification";
import { getDb } from "../db";
import { adminProcedure, protectedProcedure, router } from "./trpc";
import { getBackgroundJobStatus, getDurableBackgroundJobStatus } from "../backgroundJobs";

export function configurationStatus(configured: boolean): "configured" | "not_configured" {
  return configured ? "configured" : "not_configured";
}

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
      checks.llm = { status: process.env.OPENAI_API_KEY ? "configured" : "not_configured" };
      checks.smtp = {
        status: configurationStatus(Boolean(
          process.env.SMTP_HOST &&
          process.env.SMTP_USER &&
          process.env.SMTP_PASS &&
          process.env.SMTP_FROM,
        )),
      };
      checks.maps = { status: configurationStatus(Boolean(process.env.GOOGLE_MAPS_API_KEY)) };
      checks.googleCalendar = {
        status: configurationStatus(Boolean(
          process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
        )),
      };
      checks.dailyDigest = {
        status: configurationStatus(Boolean(process.env.DIGEST_CRON_SECRET)),
      };
      const backgroundJobs = getBackgroundJobStatus();
      const durableBackgroundJobs = await getDurableBackgroundJobStatus();
      const status = checks.database.status === "ok" ? "healthy" : "degraded";
      return {
        status,
        uptime: Math.floor(process.uptime()),
        totalLatencyMs: Date.now() - start,
        checks,
        backgroundJobs: { ...backgroundJobs, ...durableBackgroundJobs },
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
});
