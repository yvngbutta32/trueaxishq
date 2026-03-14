import { COOKIE_NAME } from "@shared/const";
import { eq, desc, sql } from "drizzle-orm";
import { z } from "zod";
import Stripe from "stripe";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { PLANS, PLAN_LIST, type PlanId } from "./products";

// ─── Stripe client (lazy, cached) ─────────────────────────────────────────────
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Payment system not configured. Please contact support." });
  _stripe = new Stripe(key, { apiVersion: "2026-02-25.clover" });
  return _stripe;
}

// ─── Safe DB helper ───────────────────────────────────────────────────────────
async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database temporarily unavailable. Please try again." });
  return db;
}

// ─── Input sanitization helpers ───────────────────────────────────────────────
const safeString = (max = 255) => z.string().trim().min(1).max(max);
const safeEmail = z.string().trim().email("Invalid email address").max(320);
const safeUrl = z.string().url("Invalid URL").max(2048);

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
    listUsers: adminProcedure
      .input(z.object({
        search: z.string().trim().max(200).optional(),
        page: z.number().int().min(1).max(1000).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      }))
      .query(async ({ input }) => {
        const db = await requireDb();
        const offset = (input.page - 1) * input.limit;
        const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
        const filtered = input.search
          ? allUsers.filter(u => {
              const q = input.search!.toLowerCase();
              return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
            })
          : allUsers;
        return {
          users: filtered.slice(offset, offset + input.limit),
          total: filtered.length,
        };
      }),

    revenueStats: adminProcedure.query(async () => {
      const db = await requireDb();
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

    setUserRole: adminProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        role: z.enum(["user", "admin"]),
      }))
      .mutation(async ({ input, ctx }) => {
        // Prevent self-demotion
        if (input.userId === ctx.user.id && input.role === "user") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot remove your own admin role." });
        }
        const db = await requireDb();
        const target = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
        if (!target[0]) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
        await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
        return { success: true };
      }),

    broadcast: adminProcedure
      .input(z.object({
        title: safeString(200),
        content: safeString(2000),
      }))
      .mutation(async ({ input }) => {
        const sent = await notifyOwner({
          title: `[Broadcast] ${input.title}`,
          content: input.content,
        });
        if (!sent) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Notification service unavailable. Try again shortly." });
        return { success: true };
      }),
  }),

  // ── AI Assistant ──────────────────────────────────────────────────────────
  ai: router({
    chat: protectedProcedure
      .input(z.object({
        messages: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().trim().max(4000),
        })).min(1).max(50),
        context: z.object({
          clientCount: z.number().min(0).max(100000).optional(),
          revenue: z.number().min(0).max(1e9).optional(),
          bookingsThisWeek: z.number().min(0).max(10000).optional(),
          planId: z.string().max(50).optional(),
        }).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const contextStr = input.context
          ? `User context: ${input.context.clientCount ?? 0} active clients, $${input.context.revenue ?? 0} revenue this month, ${input.context.bookingsThisWeek ?? 0} bookings this week, plan: ${input.context.planId ?? "free"}.`
          : "";

        let result;
        try {
          result = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are SkillBridge AI Assistant — a smart, friendly business advisor for freelancers and solo service providers. Help users grow their business, manage clients, understand analytics, write follow-up emails, create invoice descriptions, and give actionable advice. Be concise, warm, and practical. ${contextStr} The user's name is ${ctx.user.name ?? "there"}.`,
              },
              ...input.messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
            ],
          });
        } catch (err) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI service temporarily unavailable. Please try again in a moment." });
        }

        const content = result.choices[0]?.message?.content;
        return { reply: typeof content === "string" ? content : "I'm here to help! What would you like to know?" };
      }),
  }),

  // ── Stripe Billing ────────────────────────────────────────────────────────
  billing: router({
    getSubscription: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const result = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      const user = result[0];
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User account not found." });
      return {
        planId: user.planId ?? "free",
        status: user.subscriptionStatus ?? "free",
        stripeCustomerId: user.stripeCustomerId ?? null,
        stripeSubscriptionId: user.stripeSubscriptionId ?? null,
      };
    }),

    createCheckout: protectedProcedure
      .input(z.object({
        planId: z.enum(["starter", "pro", "agency"]),
        interval: z.enum(["monthly", "annual"]).default("monthly"),
        origin: safeUrl,
      }))
      .mutation(async ({ input, ctx }) => {
        const stripe = getStripe();
        const plan = PLANS[input.planId];
        if (!plan) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid plan selected." });

        // Check if user already has an active subscription
        const db = await requireDb();
        const existing = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
        if (existing[0]?.subscriptionStatus === "active" && existing[0]?.planId === input.planId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You are already subscribed to this plan. Visit the billing portal to make changes." });
        }

        const unitAmount = input.interval === "annual" ? plan.annualPrice * 12 : plan.monthlyPrice;
        const intervalConfig = input.interval === "annual"
          ? { interval: "year" as const, interval_count: 1 }
          : { interval: "month" as const, interval_count: 1 };

        let session;
        try {
          session = await stripe.checkout.sessions.create({
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
        } catch (err: any) {
          console.error("[Stripe] Checkout creation failed:", err?.message);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to create checkout session. Please try again." });
        }

        if (!session.url) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Checkout session created but no URL returned." });
        return { url: session.url };
      }),

    createPortal: protectedProcedure
      .input(z.object({ origin: safeUrl }))
      .mutation(async ({ input, ctx }) => {
        const stripe = getStripe();
        const db = await requireDb();
        const result = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
        const customerId = result[0]?.stripeCustomerId;
        if (!customerId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No billing account found. Please subscribe to a plan first." });
        }
        let portalSession;
        try {
          portalSession = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${input.origin}/dashboard`,
          });
        } catch (err: any) {
          console.error("[Stripe] Portal creation failed:", err?.message);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to open billing portal. Please try again." });
        }
        return { url: portalSession.url };
      }),

    getPlans: publicProcedure.query(() => PLAN_LIST),
  }),

  // ── Public Booking ────────────────────────────────────────────────────────
  booking: router({
    getPage: publicProcedure
      .input(z.object({
        username: z.string().trim().min(1).max(100),
      }))
      .query(async ({ input }) => {
        const db = await requireDb();
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

    submit: publicProcedure
      .input(z.object({
        hostUsername: z.string().trim().min(1).max(100),
        clientName: safeString(100),
        clientEmail: safeEmail,
        service: safeString(200),
        message: z.string().trim().max(1000).optional(),
        preferredDate: z.string().trim().min(1).max(50),
        preferredTime: z.string().trim().min(1).max(50),
      }))
      .mutation(async ({ input }) => {
        // Verify host exists
        const db = await requireDb();
        const host = await db.select().from(users)
          .where(sql`LOWER(${users.name}) = LOWER(${input.hostUsername})`)
          .limit(1);
        if (!host[0]) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Booking page not found." });
        }

        // Fire-and-forget notification (don't block response on notification failure)
        notifyOwner({
          title: `📅 New Booking — ${input.clientName}`,
          content: `**Client:** ${input.clientName} (${input.clientEmail})\n**Service:** ${input.service}\n**Preferred:** ${input.preferredDate} at ${input.preferredTime}\n**Message:** ${input.message ?? "None"}`,
        }).catch(err => console.error("[Notification] Booking notify failed:", err));

        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
