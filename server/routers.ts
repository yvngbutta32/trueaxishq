import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { eq, desc, and, sql } from "drizzle-orm";
import { z } from "zod";
import Stripe from "stripe";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";
import { users, leads, clients, invoices, bookings, followUps, emailTemplates, clientPulse, platformSettings, passwordResetTokens, inviteCodes } from "../drizzle/schema";
import { registerUser, loginUser, createSessionToken, hashPassword, verifyPassword } from "./auth";
import { computeClientPulse, computeAllClientPulses } from "./pulseEngine";
import { PLANS, PLAN_LIST, type PlanId } from "./products";
import { withTimeout } from "./utils";

// LLM timeout: 25 seconds
const LLM_TIMEOUT_MS = 25_000;

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
const safeOptionalString = (max = 255) => z.string().trim().max(max).optional();
const safeEmail = z.string().trim().email("Invalid email address").max(320);
const safeOptionalEmail = z.string().trim().email("Invalid email address").max(320).optional().or(z.literal(""));
const safeUrl = z.string().url("Invalid URL").max(2048);

// ─── Invoice number generator ─────────────────────────────────────────────────
function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `INV-${year}${month}-${rand}`;
}

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,

  // ── Auth ──────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),

    register: publicProcedure
      .input(z.object({
        name: z.string().trim().min(1).max(255),
        email: safeEmail,
        password: z.string().min(8).max(128),
        inviteCode: z.string().trim().min(1).max(32),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          // Validate invite code first
          const db = await requireDb();
          const [invite] = await db.select().from(inviteCodes)
            .where(eq(inviteCodes.code, input.inviteCode.toUpperCase())).limit(1);

          if (!invite) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid invite code. Please check and try again." });
          }
          if (invite.revoked) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "This invite code has been revoked." });
          }
          if (invite.usedAt) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "This invite code has already been used." });
          }
          if (invite.expiresAt && new Date() > invite.expiresAt) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "This invite code has expired." });
          }

          const user = await registerUser({
            name: input.name,
            email: input.email,
            password: input.password,
          });

          // Mark invite as used
          await db.update(inviteCodes).set({
            usedBy: user.id,
            usedAt: new Date(),
          }).where(eq(inviteCodes.id, invite.id));

          const token = await createSessionToken(user.id, user.email ?? input.email);
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
          return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
        } catch (err: any) {
          if (err instanceof TRPCError) throw err;
          if (err?.message === "EMAIL_TAKEN") {
            throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists." });
          }
          console.error("[Auth] Register error:", err);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Registration failed. Please try again." });
        }
      }),

    login: publicProcedure
      .input(z.object({
        email: safeEmail,
        password: z.string().min(1).max(128),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const user = await loginUser({
            email: input.email,
            password: input.password,
          });
          const token = await createSessionToken(user.id, user.email ?? input.email);
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
          return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
        } catch (err: any) {
          if (err?.message === "INVALID_CREDENTIALS" || err?.message === "NO_PASSWORD") {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
          }
          console.error("[Auth] Login error:", err);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Login failed. Please try again." });
        }
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    forgotPassword: publicProcedure
      .input(z.object({ email: safeEmail, origin: z.string().url().optional() }))
      .mutation(async ({ input, ctx }) => {
        // Always return success to prevent email enumeration
        try {
          const db = await requireDb();
          const [user] = await db.select({ id: users.id, name: users.name, email: users.email })
            .from(users).where(eq(users.email, input.email.trim().toLowerCase())).limit(1);
          if (!user) return { success: true }; // silent — don't reveal if email exists

          // Generate a secure random token
          const crypto = await import("crypto");
          const token = crypto.randomBytes(48).toString("hex");
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

          // Invalidate any existing unused tokens for this user
          await db.update(passwordResetTokens)
            .set({ used: true })
            .where(and(eq(passwordResetTokens.userId, user.id), eq(passwordResetTokens.used, false)));

          // Store new token
          await db.insert(passwordResetTokens).values({
            userId: user.id,
            token,
            expiresAt,
            used: false,
          });

          // Build reset URL from the request origin (works in any environment)
          const origin = input.origin || ctx.req.headers.origin || ctx.req.headers.referer?.replace(/\/[^/]*$/, '') || 'https://skillbridge-gipzwtye.manus.space';
          const resetUrl = `${origin}/reset-password?token=${token}`;
          await notifyOwner({
            title: "Password Reset Requested",
            content: `A password reset was requested for ${user.email}.\n\nReset link (expires in 1 hour):\n${resetUrl}\n\nIf you did not request this, you can ignore this message.`,
          });

          console.log(`[Auth] Password reset token generated for user ${user.id}`);
        } catch (err) {
          console.error("[Auth] forgotPassword error:", err);
          // Still return success to prevent enumeration
        }
        return { success: true };
      }),

    resetPassword: publicProcedure
      .input(z.object({
        token: z.string().min(1).max(200),
        newPassword: z.string().min(8).max(128),
      }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const [resetRecord] = await db.select()
          .from(passwordResetTokens)
          .where(eq(passwordResetTokens.token, input.token))
          .limit(1);

        if (!resetRecord) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired reset link. Please request a new one." });
        }
        if (resetRecord.used) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This reset link has already been used. Please request a new one." });
        }
        if (new Date() > resetRecord.expiresAt) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This reset link has expired. Please request a new one." });
        }

        const newHash = await hashPassword(input.newPassword);
        await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, resetRecord.userId));
        await db.update(passwordResetTokens).set({ used: true }).where(eq(passwordResetTokens.id, resetRecord.id));

        console.log(`[Auth] Password reset completed for user ${resetRecord.userId}`);
        return { success: true };
      }),

    changePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string().min(1).max(128),
        newPassword: z.string().min(8).max(128),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [user] = await db.select({ id: users.id, passwordHash: users.passwordHash })
          .from(users).where(eq(users.id, ctx.user.id)).limit(1);

        if (!user?.passwordHash) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No password is set on this account." });
        }

        const valid = await verifyPassword(input.currentPassword, user.passwordHash);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect." });
        }

        const newHash = await hashPassword(input.newPassword);
        await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, ctx.user.id));
        console.log(`[Auth] Password changed for user ${ctx.user.id}`);
        return { success: true };
      }),
  }),

  // ── Leads ─────────────────────────────────────────────────────────────────
  leads: router({
    capture: publicProcedure
      .input(z.object({
        email: safeEmail,
        name: z.string().trim().max(255).optional(),
        source: z.enum(["landing_page", "footer", "pricing", "onboarding-modal", "homepage-cta"]).optional().default("landing_page"),
      }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const existing = await db.select().from(leads).where(eq(leads.email, input.email)).limit(1);
        if (existing.length === 0) {
          await db.insert(leads).values({ email: input.email, name: input.name, source: input.source });
          notifyOwner({
            title: "New Lead Captured",
            content: `${input.name ? `${input.name} (${input.email})` : input.email} joined the waitlist from ${input.source}.`,
          }).catch(() => {});
        }
        return { success: true };
      }),
  }),

  // ── Clients ───────────────────────────────────────────────────────────────
  clients: router({
    list: protectedProcedure
      .input(z.object({
        search: z.string().trim().max(200).optional(),
        status: z.enum(["active", "inactive", "prospect", "all"]).default("all"),
      }).optional())
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const all = await db.select().from(clients)
          .where(eq(clients.userId, ctx.user.id))
          .orderBy(desc(clients.createdAt));
        let filtered = all;
        if (input?.search) {
          const q = input.search.toLowerCase();
          filtered = filtered.filter(c =>
            c.name.toLowerCase().includes(q) ||
            c.email?.toLowerCase().includes(q) ||
            c.service?.toLowerCase().includes(q)
          );
        }
        if (input?.status && input.status !== "all") {
          filtered = filtered.filter(c => c.status === input.status);
        }
        return filtered;
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const result = await db.select().from(clients)
          .where(and(eq(clients.id, input.id), eq(clients.userId, ctx.user.id)))
          .limit(1);
        if (!result[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." });
        return result[0];
      }),

    create: protectedProcedure
      .input(z.object({
        name: safeString(255),
        email: safeOptionalEmail,
        phone: safeOptionalString(32),
        service: safeOptionalString(255),
        status: z.enum(["active", "inactive", "prospect"]).default("active"),
        notes: safeOptionalString(2000),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const initials = input.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
        const result = await db.insert(clients).values({
          userId: ctx.user.id,
          name: input.name,
          email: input.email || null,
          phone: input.phone || null,
          service: input.service || null,
          status: input.status,
          notes: input.notes || null,
          avatarInitials: initials,
        });
        return { id: Number((result as any).insertId), success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        name: safeString(255).optional(),
        email: safeOptionalEmail,
        phone: safeOptionalString(32),
        service: safeOptionalString(255),
        status: z.enum(["active", "inactive", "prospect"]).optional(),
        notes: safeOptionalString(2000),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const { id, ...data } = input;
        await db.update(clients).set({ ...data, updatedAt: new Date() })
          .where(and(eq(clients.id, id), eq(clients.userId, ctx.user.id)));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.delete(clients).where(and(eq(clients.id, input.id), eq(clients.userId, ctx.user.id)));
        return { success: true };
      }),
  }),

  // ── Invoices ──────────────────────────────────────────────────────────────
  invoices: router({
    list: protectedProcedure
      .input(z.object({
        status: z.enum(["draft", "sent", "paid", "overdue", "all"]).default("all"),
      }).optional())
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const all = await db.select().from(invoices)
          .where(eq(invoices.userId, ctx.user.id))
          .orderBy(desc(invoices.createdAt));
        if (input?.status && input.status !== "all") return all.filter(i => i.status === input.status);
        return all;
      }),

    create: protectedProcedure
      .input(z.object({
        clientName: safeString(255),
        clientEmail: safeOptionalEmail,
        clientId: z.number().int().positive().optional(),
        service: safeOptionalString(1000),
        amount: z.number().positive().max(999999),
        dueDate: safeOptionalString(32),
        notes: safeOptionalString(2000),
        status: z.enum(["draft", "sent"]).default("draft"),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const invoiceNumber = generateInvoiceNumber();
        const result = await db.insert(invoices).values({
          userId: ctx.user.id,
          clientId: input.clientId || null,
          invoiceNumber,
          clientName: input.clientName,
          clientEmail: input.clientEmail || null,
          service: input.service || null,
          amount: String(input.amount),
          status: input.status,
          dueDate: input.dueDate || null,
          notes: input.notes || null,
        });
        return { id: Number((result as any).insertId), invoiceNumber, success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        clientName: safeString(255).optional(),
        clientEmail: safeOptionalEmail,
        service: safeOptionalString(1000),
        amount: z.number().positive().max(999999).optional(),
        dueDate: safeOptionalString(32),
        notes: safeOptionalString(2000),
        status: z.enum(["draft", "sent", "paid", "overdue"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const { id, amount, ...rest } = input;
        const updateData: any = { ...rest, updatedAt: new Date() };
        if (amount !== undefined) updateData.amount = String(amount);
        if (input.status === "paid") updateData.paidAt = new Date();
        await db.update(invoices).set(updateData)
          .where(and(eq(invoices.id, id), eq(invoices.userId, ctx.user.id)));
        return { success: true };
      }),

    markPaid: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.update(invoices)
          .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
          .where(and(eq(invoices.id, input.id), eq(invoices.userId, ctx.user.id)));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.delete(invoices).where(and(eq(invoices.id, input.id), eq(invoices.userId, ctx.user.id)));
        return { success: true };
      }),

    markOverdue: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.update(invoices)
          .set({ status: "overdue", updatedAt: new Date() })
          .where(and(eq(invoices.id, input.id), eq(invoices.userId, ctx.user.id)));
        return { success: true };
      }),

    sendReminder: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [inv] = await db.select().from(invoices)
          .where(and(eq(invoices.id, input.id), eq(invoices.userId, ctx.user.id))).limit(1);
        if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
        const [user] = await db.select({ name: users.name, businessName: users.businessName })
          .from(users).where(eq(users.id, ctx.user.id)).limit(1);
        const senderName = user?.businessName || user?.name || "Your service provider";
        const subject = `Friendly Reminder: Invoice #${inv.invoiceNumber} is due`;
        const body = `Hi ${inv.clientName},\n\nI wanted to send a friendly reminder that invoice #${inv.invoiceNumber} for ${inv.service || "services rendered"} in the amount of $${parseFloat(String(inv.amount)).toFixed(2)} is currently outstanding.\n\nIf you have any questions or need to discuss payment arrangements, please don't hesitate to reach out.\n\nThank you for your continued support!\n\nBest regards,\n${senderName}`;
        await db.insert(followUps).values({
          userId: ctx.user.id,
          clientId: inv.clientId || null,
          clientName: inv.clientName,
          clientEmail: inv.clientEmail || null,
          subject,
          body,
          status: "draft",
        });
        return { success: true, subject };
      }),

    stats: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const all = await db.select().from(invoices).where(eq(invoices.userId, ctx.user.id));
      // Auto-detect overdue: mark sent invoices past their due date
      const today = new Date().toISOString().split("T")[0];
      const overdueIds = all
        .filter(i => i.status === "sent" && i.dueDate && i.dueDate < today)
        .map(i => i.id);
      if (overdueIds.length > 0) {
        requireDb().then(db => {
          overdueIds.forEach(id => {
            db.update(invoices).set({ status: "overdue", updatedAt: new Date() })
              .where(eq(invoices.id, id)).catch(() => {});
          });
        }).catch(() => {});
      }
      const totalRevenue = all.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(String(i.amount)), 0);
      const outstanding = all.filter(i => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + parseFloat(String(i.amount)), 0);
      return {
        totalRevenue,
        outstanding,
        overdue: all.filter(i => i.status === "overdue" || (i.status === "sent" && i.dueDate && i.dueDate < today)).length,
        paid: all.filter(i => i.status === "paid").length,
        total: all.length,
      };
    }),
  }),

  // ── Bookings ──────────────────────────────────────────────────────────────
  bookings: router({
    list: protectedProcedure
      .input(z.object({
        status: z.enum(["scheduled", "completed", "cancelled", "no_show", "all"]).default("all"),
        month: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const all = await db.select().from(bookings)
          .where(eq(bookings.userId, ctx.user.id))
          .orderBy(desc(bookings.createdAt));
        let filtered = all;
        if (input?.status && input.status !== "all") filtered = filtered.filter(b => b.status === input.status);
        if (input?.month) filtered = filtered.filter(b => b.date.startsWith(input.month!));
        return filtered;
      }),

    create: protectedProcedure
      .input(z.object({
        clientName: safeString(255),
        clientEmail: safeOptionalEmail,
        clientId: z.number().int().positive().optional(),
        service: safeOptionalString(255),
        date: safeString(32),
        time: safeString(32),
        duration: z.number().int().min(15).max(480).default(60),
        notes: safeOptionalString(2000),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        // Conflict detection
        const conflict = await db.select().from(bookings)
          .where(and(
            eq(bookings.userId, ctx.user.id),
            eq(bookings.date, input.date),
            eq(bookings.time, input.time),
            eq(bookings.status, "scheduled")
          )).limit(1);
        if (conflict.length > 0) {
          throw new TRPCError({ code: "CONFLICT", message: `You already have a booking on ${input.date} at ${input.time}. Please choose a different time slot.` });
        }
        const result = await db.insert(bookings).values({
          userId: ctx.user.id,
          clientId: input.clientId || null,
          clientName: input.clientName,
          clientEmail: input.clientEmail || null,
          service: input.service || null,
          date: input.date,
          time: input.time,
          duration: input.duration,
          notes: input.notes || null,
          isPublicBooking: false,
        });
        return { id: Number((result as any).insertId), success: true };
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        status: z.enum(["scheduled", "completed", "cancelled", "no_show"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.update(bookings).set({ status: input.status, updatedAt: new Date() })
          .where(and(eq(bookings.id, input.id), eq(bookings.userId, ctx.user.id)));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.delete(bookings).where(and(eq(bookings.id, input.id), eq(bookings.userId, ctx.user.id)));
        return { success: true };
      }),

    stats: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const all = await db.select().from(bookings).where(eq(bookings.userId, ctx.user.id));
      return {
        total: all.length,
        scheduled: all.filter(b => b.status === "scheduled").length,
        completed: all.filter(b => b.status === "completed").length,
        cancelled: all.filter(b => b.status === "cancelled").length,
      };
    }),
  }),

  // ── Follow-Ups ────────────────────────────────────────────────────────────
  followUps: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(followUps).where(eq(followUps.userId, ctx.user.id)).orderBy(desc(followUps.createdAt));
    }),

    generate: protectedProcedure
      .input(z.object({
        clientName: safeString(255),
        clientEmail: safeOptionalEmail,
        clientId: z.number().int().positive().optional(),
        service: safeOptionalString(255),
        context: safeOptionalString(1000),
        tone: z.enum(["professional", "friendly", "motivational"]).default("professional"),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const userRecord = await db.select({ name: users.name, businessName: users.businessName })
          .from(users).where(eq(users.id, ctx.user.id)).limit(1);
        const userName = userRecord[0]?.name || ctx.user.name || "Your Coach";
        const businessName = userRecord[0]?.businessName || "TrueAxis HQ";

        let subject = `Checking in — ${input.clientName}`;
        let body = `Hi ${input.clientName},\n\nI wanted to reach out and see how you've been doing since our last session together. I hope you've been making great progress on your goals!\n\nI'd love to hear how things are going and discuss what we can work on next. Feel free to reply to this email or book your next session whenever you're ready.\n\nLooking forward to connecting soon!\n\nWarm regards,\n${userName}\n${businessName}`;

        try {
          const response = await withTimeout(invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are writing a follow-up email on behalf of ${userName} from ${businessName}. Tone: ${input.tone}. Return JSON with "subject" and "body" fields only.`,
              },
              {
                role: "user",
                content: `Write a follow-up email to ${input.clientName}${input.service ? `, a ${input.service} client` : ""}${input.context ? `. Context: ${input.context}` : ""}. Check in on their progress and encourage booking their next session.`,
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "follow_up_email",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    subject: { type: "string" },
                    body: { type: "string" },
                  },
                  required: ["subject", "body"],
                  additionalProperties: false,
                },
              },
            },
          }), LLM_TIMEOUT_MS, "followUps.generate");
          const rawResp = response.choices?.[0]?.message?.content;
          const contentStr = typeof rawResp === "string" ? rawResp : null;
          if (contentStr) {
            const parsed = JSON.parse(contentStr);
            subject = parsed.subject || subject;
            body = parsed.body || body;
          }
        } catch (_) { /* fallback to default template */ }

        const result = await db.insert(followUps).values({
          userId: ctx.user.id,
          clientId: input.clientId || null,
          clientName: input.clientName,
          clientEmail: input.clientEmail || null,
          subject,
          body,
          status: "draft",
        });
        return { id: Number((result as any).insertId), subject, body, success: true };
      }),

    markSent: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.update(followUps).set({ status: "sent", sentAt: new Date() })
          .where(and(eq(followUps.id, input.id), eq(followUps.userId, ctx.user.id)));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.delete(followUps).where(and(eq(followUps.id, input.id), eq(followUps.userId, ctx.user.id)));
        return { success: true };
      }),
  }),

  // ── Email Templates ───────────────────────────────────────────────────────
  emailTemplates: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(emailTemplates).where(eq(emailTemplates.userId, ctx.user.id)).orderBy(desc(emailTemplates.createdAt));
    }),

    save: protectedProcedure
      .input(z.object({
        name: safeString(255),
        subject: safeString(512),
        body: safeString(10000),
        category: z.enum(["follow_up", "invoice", "reminder", "welcome"]).default("follow_up"),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const result = await db.insert(emailTemplates).values({ userId: ctx.user.id, ...input });
        return { id: Number((result as any).insertId), success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.delete(emailTemplates).where(and(eq(emailTemplates.id, input.id), eq(emailTemplates.userId, ctx.user.id)));
        return { success: true };
      }),
  }),

  // ── Settings ──────────────────────────────────────────────────────────────
  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const result = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!result[0]) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      const u = result[0];
      return {
        ...u,
        bookingServices: u.bookingServices ? JSON.parse(u.bookingServices) : ["Coaching Session", "Strategy Call", "Consultation"],
        bookingAvailability: u.bookingAvailability ? JSON.parse(u.bookingAvailability) : {},
      };
    }),

    updateProfile: protectedProcedure
      .input(z.object({
        name: safeOptionalString(255),
        bio: safeOptionalString(1000),
        phone: safeOptionalString(32),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.update(users).set({ ...input, updatedAt: new Date() }).where(eq(users.id, ctx.user.id));
        return { success: true };
      }),

    updateBusiness: protectedProcedure
      .input(z.object({
        businessName: safeOptionalString(255),
        businessPhone: safeOptionalString(32),
        businessAddress: safeOptionalString(500),
        businessWebsite: z.string().trim().max(512).optional().or(z.literal("")),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.update(users).set({ ...input, updatedAt: new Date() }).where(eq(users.id, ctx.user.id));
        return { success: true };
      }),

    updateBookingPage: protectedProcedure
      .input(z.object({
        bookingUsername: z.string().trim().min(3).max(64).regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens allowed").optional(),
        bookingBio: safeOptionalString(500),
        bookingServices: z.array(z.string().trim().max(100)).max(20).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        if (input.bookingUsername) {
          const existing = await db.select({ id: users.id }).from(users)
            .where(eq(users.bookingUsername, input.bookingUsername)).limit(1);
          if (existing.length > 0 && existing[0].id !== ctx.user.id) {
            throw new TRPCError({ code: "CONFLICT", message: "That username is already taken. Please choose another." });
          }
        }
        const updateData: any = { updatedAt: new Date() };
        if (input.bookingUsername !== undefined) updateData.bookingUsername = input.bookingUsername;
        if (input.bookingBio !== undefined) updateData.bookingBio = input.bookingBio;
        if (input.bookingServices !== undefined) updateData.bookingServices = JSON.stringify(input.bookingServices);
        await db.update(users).set(updateData).where(eq(users.id, ctx.user.id));
        return { success: true };
      }),

    updateNotifications: protectedProcedure
      .input(z.object({
        notifyNewBooking: z.boolean().optional(),
        notifyInvoicePaid: z.boolean().optional(),
        notifyNewLead: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.update(users).set({ ...input, updatedAt: new Date() }).where(eq(users.id, ctx.user.id));
        return { success: true };
      }),
  }),

  // ── Analytics ─────────────────────────────────────────────────────────────
  analytics: router({
    overview: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const [allClients, allInvoices, allBookings] = await Promise.all([
        db.select().from(clients).where(eq(clients.userId, ctx.user.id)),
        db.select().from(invoices).where(eq(invoices.userId, ctx.user.id)),
        db.select().from(bookings).where(eq(bookings.userId, ctx.user.id)),
      ]);

      const totalRevenue = allInvoices.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(String(i.amount)), 0);
      const outstanding = allInvoices.filter(i => i.status === "sent").reduce((s, i) => s + parseFloat(String(i.amount)), 0);
      const activeClients = allClients.filter(c => c.status === "active").length;
      const completedSessions = allBookings.filter(b => b.status === "completed").length;

      // Monthly revenue for last 6 months
      const now = new Date();
      const monthlyRevenue: { month: string; revenue: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
        const revenue = allInvoices
          .filter(inv => inv.status === "paid" && inv.paidAt && inv.paidAt.toISOString().startsWith(key))
          .reduce((s, inv) => s + parseFloat(String(inv.amount)), 0);
        monthlyRevenue.push({ month: label, revenue });
      }

      // Client growth last 6 months
      const clientGrowth: { month: string; count: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
        const count = allClients.filter(c => c.createdAt.toISOString().startsWith(key)).length;
        clientGrowth.push({ month: label, count });
      }

      // Top services by revenue
      const serviceMap: Record<string, number> = {};
      allInvoices.filter(i => i.status === "paid" && i.service).forEach(i => {
        const svc = i.service!.split("—")[0].trim().slice(0, 30);
        serviceMap[svc] = (serviceMap[svc] || 0) + parseFloat(String(i.amount));
      });
      const topServices = Object.entries(serviceMap)
        .sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([name, revenue]) => ({ name, revenue }));

      return { totalRevenue, outstanding, activeClients, completedSessions, totalClients: allClients.length, totalInvoices: allInvoices.length, monthlyRevenue, clientGrowth, topServices };
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
          result = await withTimeout(invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are TrueAxis HQ Assistant — a smart, friendly business advisor for freelancers and solo service providers. Help users grow their business, manage clients, understand analytics, write follow-up emails, create invoice descriptions, and give actionable advice. Be concise, warm, and practical. ${contextStr} The user's name is ${ctx.user.name ?? "there"}.`,
              },
              ...input.messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
            ],
          }), LLM_TIMEOUT_MS, "ai.chat");
        } catch (_) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI service temporarily unavailable. Please try again in a moment." });
        }
        const rawContent = result.choices[0]?.message?.content;
        const content = typeof rawContent === "string" ? rawContent : Array.isArray(rawContent) ? rawContent.map((c: any) => c.text ?? "").join("") : null;
        return { reply: content ?? "I'm here to help! What would you like to know?" };
      }),
  }),

  // ── Stripe Billing ────────────────────────────────────────────────────────
  billing: router({
    getPlans: publicProcedure.query(() => PLAN_LIST),

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
                product_data: { name: `TrueAxis HQ — ${plan.name}`, description: plan.description },
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
        if (!customerId) throw new TRPCError({ code: "BAD_REQUEST", message: "No billing account found. Please subscribe to a plan first." });
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
        return { users: filtered.slice(offset, offset + input.limit), total: filtered.length };
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
        if (planId !== "free" && PLANS[planId as PlanId]) mrr += PLANS[planId as PlanId].monthlyPrice / 100;
      }
      byPlan.free = allUsers.length - paidUsers.length;
      return { totalUsers: allUsers.length, paidUsers: paidUsers.length, mrr, arr: mrr * 12, byPlan };
    }),

    listLeads: adminProcedure
      .input(z.object({ page: z.number().int().min(1).default(1), limit: z.number().int().min(1).max(100).default(50) }))
      .query(async ({ input }) => {
        const db = await requireDb();
        const all = await db.select().from(leads).orderBy(desc(leads.createdAt));
        const offset = (input.page - 1) * input.limit;
        return { leads: all.slice(offset, offset + input.limit), total: all.length };
      }),

    setUserRole: adminProcedure
      .input(z.object({ userId: z.number().int().positive(), role: z.enum(["user", "admin"]) }))
      .mutation(async ({ input, ctx }) => {
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
      .input(z.object({ title: safeString(200), content: safeString(2000) }))
      .mutation(async ({ input }) => {
        const sent = await notifyOwner({ title: `[Broadcast] ${input.title}`, content: input.content });
        if (!sent) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Notification service unavailable. Try again shortly." });
        return { success: true };
      }),

    // ── Platform Settings ───────────────────────────────────────────────────────
    getSettings: adminProcedure.query(async () => {
      const db = await requireDb();
      const rows = await db.select().from(platformSettings).limit(1);
      if (rows[0]) return rows[0];
      // Seed defaults on first access
      await db.insert(platformSettings).values({});
      const fresh = await db.select().from(platformSettings).limit(1);
      return fresh[0]!;
    }),

    updateSettings: adminProcedure
      .input(z.object({
        siteName: z.string().trim().min(1).max(255).optional(),
        siteTagline: z.string().trim().max(512).optional(),
        supportEmail: z.string().trim().email().max(320).optional(),
        supportPhone: z.string().trim().max(32).optional(),
        announcementEnabled: z.boolean().optional(),
        announcementText: z.string().trim().max(512).optional(),
        announcementColor: z.enum(["teal", "coral", "purple", "yellow", "blue"]).optional(),
        socialTwitter: z.string().trim().max(255).optional(),
        socialLinkedin: z.string().trim().max(255).optional(),
        socialInstagram: z.string().trim().max(255).optional(),
        socialYoutube: z.string().trim().max(255).optional(),
        featureClientPulse: z.boolean().optional(),
        featureBookingPage: z.boolean().optional(),
        featureInvoicing: z.boolean().optional(),
        featureFollowUps: z.boolean().optional(),
        featureAnalytics: z.boolean().optional(),
        featureAIAssistant: z.boolean().optional(),
        maintenanceMode: z.boolean().optional(),
        maintenanceMessage: z.string().trim().max(512).optional(),
        freeTrialDays: z.number().int().min(0).max(365).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const existing = await db.select({ id: platformSettings.id }).from(platformSettings).limit(1);
        if (!existing[0]) {
          await db.insert(platformSettings).values(input as any);
        } else {
          await db.update(platformSettings).set(input as any).where(eq(platformSettings.id, existing[0].id));
        }
        return { success: true };
      }),

    // ── User Management (extended) ────────────────────────────────────────────
    updateUserPlan: adminProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        planId: z.enum(["free", "starter", "pro", "agency"]),
        subscriptionStatus: z.enum(["free", "active", "cancelled", "past_due"]),
      }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const target = await db.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1);
        if (!target[0]) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
        await db.update(users).set({
          planId: input.planId,
          subscriptionStatus: input.subscriptionStatus,
        }).where(eq(users.id, input.userId));
        return { success: true };
      }),

    deleteUser: adminProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        if (input.userId === ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot delete your own account from the admin panel." });
        }
        const db = await requireDb();
        const target = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, input.userId)).limit(1);
        if (!target[0]) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
        // Delete all user data in order
        await db.delete(clientPulse).where(eq(clientPulse.userId, input.userId));
        await db.delete(followUps).where(eq(followUps.userId, input.userId));
        await db.delete(bookings).where(eq(bookings.userId, input.userId));
        await db.delete(invoices).where(eq(invoices.userId, input.userId));
        await db.delete(clients).where(eq(clients.userId, input.userId));
        await db.delete(emailTemplates).where(eq(emailTemplates.userId, input.userId));
        await db.delete(users).where(eq(users.id, input.userId));
        return { success: true, deletedName: target[0].name };
      }),

    // ── Invite Codes ────────────────────────────────────────────────────────────
    createInvite: adminProcedure
      .input(z.object({
        note: z.string().trim().max(255).optional(),
        expiresInDays: z.number().int().min(1).max(365).optional(), // undefined = never expires
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const crypto = await import("crypto");
        // Generate a human-readable 12-char code: XXXX-XXXX-XXXX
        const raw = crypto.randomBytes(9).toString("hex").toUpperCase();
        const code = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
        const expiresAt = input.expiresInDays
          ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
          : null;
        await db.insert(inviteCodes).values({
          code,
          createdBy: ctx.user.id,
          note: input.note ?? null,
          expiresAt: expiresAt ?? undefined,
          revoked: false,
        });
        return { success: true, code };
      }),

    listInvites: adminProcedure.query(async () => {
      const db = await requireDb();
      const all = await db.select().from(inviteCodes).orderBy(desc(inviteCodes.createdAt));
      const now = new Date();
      return all.map(inv => ({
        ...inv,
        status: inv.revoked ? "revoked"
          : inv.usedAt ? "used"
          : inv.expiresAt && inv.expiresAt < now ? "expired"
          : "active",
      }));
    }),

    revokeInvite: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const [inv] = await db.select({ id: inviteCodes.id, usedAt: inviteCodes.usedAt })
          .from(inviteCodes).where(eq(inviteCodes.id, input.id)).limit(1);
        if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Invite code not found." });
        if (inv.usedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot revoke an already-used invite code." });
        await db.update(inviteCodes).set({ revoked: true }).where(eq(inviteCodes.id, input.id));
        return { success: true };
      }),

    // ── System Health ───────────────────────────────────────────────────────────────
    getSystemHealth: adminProcedure.query(async () => {
      const db = await requireDb();
      const now = Date.now();
      const uptimeSeconds = process.uptime();
      // DB ping
      let dbOk = false;
      try {
        await db.select({ id: users.id }).from(users).limit(1);
        dbOk = true;
      } catch { dbOk = false; }
      // Counts
      const allUsers = await db.select({ id: users.id, createdAt: users.createdAt, planId: users.planId }).from(users);
      const allClients = await db.select({ id: clients.id }).from(clients);
      const allInvoices = await db.select({ id: invoices.id, status: invoices.status }).from(invoices);
      const allBookings = await db.select({ id: bookings.id, status: bookings.status }).from(bookings);
      const allLeads = await db.select({ id: leads.id }).from(leads);
      // Recent signups (last 7 days)
      const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const recentSignups = allUsers.filter(u => new Date(u.createdAt) > sevenDaysAgo).length;
      // Paid users
      const paidUsers = allUsers.filter(u => u.planId && u.planId !== "free").length;
      return {
        dbStatus: dbOk ? "healthy" : "error",
        uptimeSeconds: Math.round(uptimeSeconds),
        totalUsers: allUsers.length,
        paidUsers,
        recentSignups,
        totalClients: allClients.length,
        totalInvoices: allInvoices.length,
        paidInvoices: allInvoices.filter(i => i.status === "paid").length,
        totalBookings: allBookings.length,
        completedBookings: allBookings.filter(b => b.status === "completed").length,
        totalLeads: allLeads.length,
        checkedAt: now,
      };
    }),
  }),

  // ── Public Booking Page ───────────────────────────────────────────────────
  booking: router({
    getPage: publicProcedure
      .input(z.object({ username: z.string().trim().min(1).max(100) }))
      .query(async ({ input }) => {
        const db = await requireDb();
        const result = await db.select({
          id: users.id,
          name: users.name,
          businessName: users.businessName,
          bookingBio: users.bookingBio,
          bookingServices: users.bookingServices,
          avatarUrl: users.avatarUrl,
        }).from(users).where(eq(users.bookingUsername, input.username)).limit(1);
        if (!result[0]) return null;
        const host = result[0];
        return {
          ...host,
          bookingServices: host.bookingServices ? JSON.parse(host.bookingServices) : ["Coaching Session", "Strategy Call", "Consultation"],
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
        const db = await requireDb();
        const host = await db.select({ id: users.id, notifyNewBooking: users.notifyNewBooking })
          .from(users).where(eq(users.bookingUsername, input.hostUsername)).limit(1);
        if (!host[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Booking page not found." });

        await db.insert(bookings).values({
          userId: host[0].id,
          clientName: input.clientName,
          clientEmail: input.clientEmail,
          service: input.service,
          date: input.preferredDate,
          time: input.preferredTime,
          notes: input.message || null,
          isPublicBooking: true,
          status: "scheduled",
        });

        if (host[0].notifyNewBooking !== false) {
          notifyOwner({
            title: `New Booking — ${input.clientName}`,
            content: `${input.clientName} (${input.clientEmail}) booked a ${input.service} on ${input.preferredDate} at ${input.preferredTime}.`,
          }).catch(() => {});
        }
        return { success: true };
      }),
  }),

  // ─── Client Pulse ─────────────────────────────────────────────────────────
  pulse: router({
    getAll: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const userClients = await db.select().from(clients).where(eq(clients.userId, ctx.user.id)).orderBy(desc(clients.createdAt));
      const pulseRecords = await db.select().from(clientPulse).where(eq(clientPulse.userId, ctx.user.id));
      return userClients.map((client) => ({
        client,
        pulse: pulseRecords.find((p) => p.clientId === client.id) ?? null,
      }));
    }),

    computeAll: protectedProcedure.mutation(async ({ ctx }) => {
      computeAllClientPulses(ctx.user.id).catch((err) => console.error("[Pulse] computeAll error:", err));
      return { started: true };
    }),

    computeOne: protectedProcedure
      .input(z.object({ clientId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [client] = await db.select().from(clients)
          .where(and(eq(clients.id, input.clientId), eq(clients.userId, ctx.user.id))).limit(1);
        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." });
        const result = await computeClientPulse(ctx.user.id, client.id, client.name ?? "Client");
        return result;
      }),

    getOne: protectedProcedure
      .input(z.object({ clientId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const [pulse] = await db.select().from(clientPulse)
          .where(and(eq(clientPulse.clientId, input.clientId), eq(clientPulse.userId, ctx.user.id))).limit(1);
        return pulse ?? null;
      }),

    useAction: protectedProcedure
      .input(z.object({
        clientId: z.number().int().positive(),
        subject: safeString(512),
        body: z.string().trim().min(1).max(5000),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [client] = await db.select().from(clients)
          .where(and(eq(clients.id, input.clientId), eq(clients.userId, ctx.user.id))).limit(1);
        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." });
        const [fu] = await db.insert(followUps).values({
          userId: ctx.user.id,
          clientId: input.clientId,
          clientName: client.name ?? "",
          clientEmail: client.email ?? "",
          subject: input.subject,
          body: input.body,
          status: "draft",
        }).$returningId();
        return { id: fu.id, success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
