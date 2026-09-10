import { z } from "zod";
import { notifyOwner } from "./notification";
import { getDb } from "../db";
import { adminProcedure, protectedProcedure, router } from "./trpc";

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
});
