import { COOKIE_NAME } from "@shared/const";
import { eq, desc, count, sql } from "drizzle-orm";
import { z } from "zod";
import Stripe from "stripe";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { PLANS, PLAN_LIST, type PlanId } from "./products";

// ─── Stripe client ────────────────────────────────────────────────────────────
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2026-02-25.clover" });
}

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,

  // ── Auth ──────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ── Admin ─────────────────────────────────────────────────────────────────
  admin: router({
    // Get all users with stats
    listUsers: adminProcedure
      .input(z.object({
        search: z.string().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { users: [], total: 0 };
        const offset = (input.page - 1) * input.limit;
        let query = db.select().from(users).orderBy(desc(users.createdAt));
        const allUsers = await query;
        const filtered = input.search
          ? allUsers.filter(u =>
              u.name?.toLowerCase().includes(input.search!.toLowerCase()) ||
              u.email?.toLowerCase().includes(input.search!.toLowerCase())
            )
          : allUsers;
        return {
          users: filtered.slice(offset, offset + input.limit),
          total: filtered.length,
        };
      }),

    // Revenue stats
    revenueStats: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { total: 0, mrr: 0, arr: 0, byPlan: {}, totalUsers: 0, paidUsers: 0 };
      const allUsers = await db.select().from(users);
      const paidUsers = allUsers.filter(u => u.subscriptionStatus === "active");
      const byPlan: Record<string, number> = { starter: 0, pro: 0, agency: 0, free: 0 };
      let mrr = 0;
      for (const u of paidUsers) {
        const planId = (u.planId ?? "free") as PlanId | "free";
        byPlan[planId] = (byPlan[planId] ?? 0) + 1;
        if (planId !== "free" && PLANS[planId]) {
          mrr += PLANS[planId].monthlyPrice / 100;
        }
      }
      byPlan.free = allUsers.length - paidUsers.length;
      return {
        totalUsers: allUsers.length,
        paidUsers: paidUsers.length,
        mrr,
        arr: mrr * 12,
        byPlan,
      };
    }),

    // Promote user to admin
    setUserRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "admin"]) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
        return { success: true };
      }),

    // Broadcast notification to owner (placeholder for multi-user notifications)
    broadcast: adminProcedure
      .input(z.object({ title: z.string().min(1), content: z.string().min(1) }))
      .mutation(async ({ input }) => {
        await notifyOwner({ title: `[Broadcast] ${input.title}`, content: input.content });
        return { success: true };
      }),
  }),

  // ── AI Assistant ──────────────────────────────────────────────────────────
  ai: router({
    chat: protectedProcedure
      .input(z.object({
        messages: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        })),
        context: z.object({
          clientCount: z.number().optional(),
          revenue: z.number().optional(),
          bookingsThisWeek: z.number().optional(),
          planId: z.string().optional(),
        }).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const contextStr = input.context
          ? `User context: ${input.context.clientCount ?? 0} active clients, $${input.context.revenue ?? 0} revenue this month, ${input.context.bookingsThisWeek ?? 0} bookings this week, plan: ${input.context.planId ?? "free"}.`
          : "";

        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are SkillBridge AI Assistant — a smart, friendly business advisor for freelancers and solo service providers. You help users grow their business, manage clients, understand their analytics, write follow-up emails, create invoice descriptions, and give actionable advice. Be concise, warm, and practical. ${contextStr} The user's name is ${ctx.user.name ?? "there"}.`,
            },
            ...input.messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
          ],
        });
        const content = result.choices[0]?.message?.content;
        return { reply: typeof content === "string" ? content : "I'm here to help! What would you like to know?" };
      }),
  }),

  // ── Stripe Billing ────────────────────────────────────────────────────────
  billing: router({
    // Get current user's subscription info
    getSubscription: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { planId: "free", status: "free", stripeCustomerId: null, stripeSubscriptionId: null };
      const result = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      const user = result[0];
      return {
        planId: user?.planId ?? "free",
        status: user?.subscriptionStatus ?? "free",
        stripeCustomerId: user?.stripeCustomerId ?? null,
        stripeSubscriptionId: user?.stripeSubscriptionId ?? null,
      };
    }),

    // Create Stripe Checkout session
    createCheckout: protectedProcedure
      .input(z.object({
        planId: z.enum(["starter", "pro", "agency"]),
        interval: z.enum(["monthly", "annual"]).default("monthly"),
        origin: z.string().url(),
      }))
      .mutation(async ({ input, ctx }) => {
        const stripe = getStripe();
        const plan = PLANS[input.planId];
        const unitAmount = input.interval === "annual" ? plan.annualPrice * 12 : plan.monthlyPrice;
        const intervalConfig = input.interval === "annual"
          ? { interval: "year" as const, interval_count: 1 }
          : { interval: "month" as const, interval_count: 1 };

        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer_email: ctx.user.email ?? undefined,
          allow_promotion_codes: true,
          client_reference_id: ctx.user.id.toString(),
          metadata: {
            user_id: ctx.user.id.toString(),
            customer_email: ctx.user.email ?? "",
            customer_name: ctx.user.name ?? "",
            plan_id: input.planId,
            interval: input.interval,
          },
          line_items: [{
            price_data: {
              currency: "usd",
              product_data: {
                name: `SkillBridge AI — ${plan.name}`,
                description: plan.description,
              },
              unit_amount: unitAmount,
              recurring: intervalConfig,
            },
            quantity: 1,
          }],
          success_url: `${input.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${input.origin}/pricing?cancelled=true`,
        });

        return { url: session.url };
      }),

    // Create Stripe Billing Portal session
    createPortal: protectedProcedure
      .input(z.object({ origin: z.string().url() }))
      .mutation(async ({ input, ctx }) => {
        const stripe = getStripe();
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        const result = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
        const customerId = result[0]?.stripeCustomerId;
        if (!customerId) throw new Error("No Stripe customer found. Please subscribe first.");
        const session = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: `${input.origin}/dashboard`,
        });
        return { url: session.url };
      }),

    // Get available plans
    getPlans: publicProcedure.query(() => PLAN_LIST),
  }),

  // ── Public Booking ────────────────────────────────────────────────────────
  booking: router({
    // Get booking page info by username (public)
    getPage: publicProcedure
      .input(z.object({ username: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const result = await db.select().from(users)
          .where(sql`LOWER(${users.name}) = LOWER(${input.username})`)
          .limit(1);
        const user = result[0];
        if (!user) return null;
        return {
          name: user.name,
          email: user.email,
          planId: user.planId ?? "free",
        };
      }),

    // Submit a booking request (public)
    submit: publicProcedure
      .input(z.object({
        hostUsername: z.string(),
        clientName: z.string().min(1),
        clientEmail: z.string().email(),
        service: z.string().min(1),
        message: z.string().optional(),
        preferredDate: z.string(),
        preferredTime: z.string(),
      }))
      .mutation(async ({ input }) => {
        // Notify the owner/host
        await notifyOwner({
          title: `📅 New Booking Request — ${input.clientName}`,
          content: `**Client:** ${input.clientName} (${input.clientEmail})\n**Service:** ${input.service}\n**Preferred:** ${input.preferredDate} at ${input.preferredTime}\n**Message:** ${input.message ?? "None"}`,
        }).catch(() => {});
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
