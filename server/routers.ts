import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { eq, desc, and, sql, inArray, or, like } from "drizzle-orm";
import { z } from "zod";
import Stripe from "stripe";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, ownerProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";
import { users, leads, clients, invoices, bookings, followUps, emailTemplates, clientPulse, platformSettings, passwordResetTokens, inviteCodes, securityEvents, userSessions, clientPortalTokens, contracts, notifications, timeEntries, clientDocuments, recurringInvoices, auditLogs, userApiKeys, contactMessages, portalMessages, followUpRules, clientTags, testimonials, bookingCancelTokens, googleCalendarTokens, services, expenses, proposals, automations, automationLogs, intakeForms, intakeResponses, revenueGoals, contractTemplates } from "../drizzle/schema";
import { registerUser, loginUser, createSessionToken, hashPassword, verifyPassword } from "./auth";
import { recordFailedLogin, isAccountLocked, clearFailedLogins, logSecurityEvent, getClientIp, manualBlockIP, unblockIP, getSecurityStats } from "./security";
import { computeClientPulse, computeAllClientPulses } from "./pulseEngine";
import { PLANS, PLAN_LIST, type PlanId } from "./products";
import { withTimeout } from "./utils";
import { sendEmail, forgotPasswordEmail, invoiceReminderEmail, bookingConfirmationEmail, invoicePaidEmail, followUpEmail, testimonialRequestEmail, monthlyReportEmail, bookingCancelConfirmEmail } from "./_core/email";

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
    me: publicProcedure.query(opts => {
      const user = opts.ctx.user;
      if (!user) return null;
      const isOwner = Boolean(ENV.ownerOpenId && user.openId === ENV.ownerOpenId);
      return { ...user, isOwner };
    }),

    register: publicProcedure
      .input(z.object({
        name: z.string().trim().min(1).max(255),
        email: safeEmail,
        password: z.string().min(8).max(128)
          .regex(/[a-zA-Z]/, "Password must contain at least one letter")
          .regex(/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, "Password must contain at least one number or symbol"),
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

          // Check email availability BEFORE consuming the invite code
          // to prevent invite codes being burned on duplicate email attempts
          const emailCheck = await db.select({ id: users.id })
            .from(users).where(eq(users.email, input.email.trim().toLowerCase())).limit(1);
          if (emailCheck.length > 0) {
            throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists." });
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
        const ip = getClientIp(ctx.req);
        // Check account lockout before attempting login
        const lockStatus = isAccountLocked(input.email);
        if (lockStatus.locked) {
          const remainingMin = Math.ceil((lockStatus.remainingMs ?? 0) / 60_000);
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Account temporarily locked due to too many failed attempts. Try again in ${remainingMin} minute${remainingMin !== 1 ? 's' : ''}.` });
        }
        try {
          const user = await loginUser({
            email: input.email,
            password: input.password,
          });
          // Successful login — clear failed login counter
          clearFailedLogins(input.email);
          logSecurityEvent({ eventType: "login_success", severity: "low", ip, email: input.email, userId: user.id, userAgent: ctx.req.headers["user-agent"] });
          // Update lastSignedIn timestamp
          const dbConn = await requireDb();
          await dbConn.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
          const token = await createSessionToken(user.id, user.email ?? input.email);
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
          return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
        } catch (err: any) {
          if (err?.message === "INVALID_CREDENTIALS" || err?.message === "NO_PASSWORD") {
            recordFailedLogin(input.email, ip, ctx.req);
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
          }
          console.error("[Auth] Login error:", err);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Login failed. Please try again." });
        }
      }),

    adminLogin: publicProcedure
      .input(z.object({
        email: safeEmail,
        password: z.string().min(1).max(128),
      }))
      .mutation(async ({ input, ctx }) => {
        const ip = getClientIp(ctx.req);
        // Check account lockout
        const lockStatus = isAccountLocked(input.email);
        if (lockStatus.locked) {
          const remainingMin = Math.ceil((lockStatus.remainingMs ?? 0) / 60_000);
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Account locked. Try again in ${remainingMin} minute${remainingMin !== 1 ? 's' : ''}.` });
        }
        try {
          const user = await loginUser({ email: input.email, password: input.password });
          const db = await requireDb();

          // Determine if this user is the owner:
          // 1. Their openId matches OWNER_OPEN_ID (OAuth-registered owner), OR
          // 2. Their role is already 'admin', OR
          // 3. They are the ONLY admin in the system (bootstrap: first admin account)
          let isOwner = false;
          if (ENV.ownerOpenId && user.openId === ENV.ownerOpenId) {
            isOwner = true;
          } else if (user.role === "admin") {
            isOwner = true;
          } else {
            // Bootstrap: if no other admin exists, auto-promote this user
            const adminCount = await db.select({ id: users.id })
              .from(users)
              .where(eq(users.role, "admin"))
              .limit(1);
            if (adminCount.length === 0) {
              // No admin exists yet — promote this user and allow access
              await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
              isOwner = true;
              console.log(`[AdminLogin] Bootstrap: promoted user ${user.id} to admin (first admin account)`);
              logSecurityEvent({ eventType: "admin_bootstrap", severity: "high", ip, email: input.email, userId: user.id, userAgent: ctx.req.headers["user-agent"], details: "First admin account created via bootstrap login" });
            }
          }

          if (!isOwner) {
            recordFailedLogin(input.email, ip, ctx.req);
            logSecurityEvent({ eventType: "unauthorized_access", severity: "high", ip, email: input.email, userId: user.id, userAgent: ctx.req.headers["user-agent"], details: "Admin login attempt by non-admin" });
            throw new TRPCError({ code: "FORBIDDEN", message: "Access denied. Admin credentials required." });
          }

          clearFailedLogins(input.email);
          logSecurityEvent({ eventType: "login_success", severity: "low", ip, email: input.email, userId: user.id, userAgent: ctx.req.headers["user-agent"], details: "Admin login" });
          await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
          const token = await createSessionToken(user.id, user.email ?? input.email);
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
          return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
        } catch (err: any) {
          if (err instanceof TRPCError) throw err;
          if (err?.message === "INVALID_CREDENTIALS" || err?.message === "NO_PASSWORD") {
            recordFailedLogin(input.email, ip, ctx.req);
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
          }
          console.error("[AdminLogin] Error:", err);
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
          // Per-email rate limit: max 3 reset requests per hour
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          const [{ recentCount }] = await db.select({ recentCount: sql<number>`COUNT(*)` })
            .from(passwordResetTokens)
            .where(and(
              eq(passwordResetTokens.userId, user.id),
              sql`${passwordResetTokens.createdAt} > ${oneHourAgo}`,
            ));
          if (Number(recentCount) >= 3) return { success: true }; // silently drop excess requests

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
          const origin = input.origin || ctx.req.headers.origin || 'https://skillbridge-ai.manus.space';
          const resetUrl = `${origin}/reset-password?token=${token}`;
          // Send real email to the user
          await sendEmail({
            to: user.email!,
            subject: "Reset Your SkillBridge AI Password",
            html: forgotPasswordEmail({ name: user.name || "there", resetUrl }),
          });
          // Also notify owner for audit purposes
          notifyOwner({
            title: "Password Reset Requested",
            content: `A password reset was requested for ${user.email}. Reset link sent to user.`,
          }).catch(() => {});

          // Password reset email sent
        } catch (err) {
          console.error("[Auth] forgotPassword error:", err);
          // Still return success to prevent enumeration
        }
        return { success: true };
      }),

    resetPassword: publicProcedure
      .input(z.object({
        token: z.string().min(1).max(200),
        newPassword: z.string().min(8).max(128)
          .regex(/^(?=.*[a-zA-Z])(?=.*[\d\W]).+$/, "Password must contain at least one letter and one number or symbol."),
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

        // Password reset completed
        return { success: true };
      }),

    changePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string().min(1).max(128),
        newPassword: z.string().min(8).max(128)
          .regex(/^(?=.*[a-zA-Z])(?=.*[\d\W]).+$/, "Password must contain at least one letter and one number or symbol."),
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
        // Invalidate all active sessions for this user (force re-login on all devices)
        await db.update(userSessions)
          .set({ isActive: false, invalidatedAt: new Date(), invalidationReason: "password_changed" })
          .where(and(eq(userSessions.userId, ctx.user.id), eq(userSessions.isActive, true)));
        logSecurityEvent({ eventType: "password_changed", severity: "medium", userId: ctx.user.id, email: ctx.user.email ?? undefined, ip: getClientIp(ctx.req), details: "Password changed by user", userAgent: ctx.req.headers["user-agent"] });
        // Password changed
        return { success: true };
      }),
  }),

  // ── Contact Form ───────────────────────────────────────────────────────────
  contact: router({
    submit: publicProcedure
      .input(z.object({
        name: z.string().trim().min(1).max(255),
        email: safeEmail,
        subject: z.string().trim().min(1).max(500),
        message: z.string().trim().min(10).max(5000),
      }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        await db.insert(contactMessages).values({
          name: input.name,
          email: input.email,
          subject: input.subject,
          message: input.message,
        });
        // Also capture as a lead so they appear in the leads list
        const existing = await db.select().from(leads).where(eq(leads.email, input.email)).limit(1);
        if (existing.length === 0) {
          await db.insert(leads).values({ email: input.email, name: input.name, source: "landing_page" });
        }
        notifyOwner({
          title: "New Contact Form Submission",
          content: `From: ${input.name} <${input.email}>\nSubject: ${input.subject}\n\n${input.message.slice(0, 300)}${input.message.length > 300 ? '...' : ''}`,
        }).catch(() => {});
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
        // Attach lastActivity: most recent booking or invoice date per client
        const clientIds = filtered.map(c => c.id);
        let lastActivityMap: Record<number, Date | null> = {};
        if (clientIds.length > 0) {
          const recentBookings = await db.select({ clientId: bookings.clientId, date: bookings.createdAt })
            .from(bookings)
            .where(and(eq(bookings.userId, ctx.user.id), inArray(bookings.clientId, clientIds)))
            .orderBy(desc(bookings.createdAt));
          const recentInvoices = await db.select({ clientId: invoices.clientId, date: invoices.createdAt })
            .from(invoices)
            .where(and(eq(invoices.userId, ctx.user.id), inArray(invoices.clientId, clientIds)))
            .orderBy(desc(invoices.createdAt));
          for (const b of recentBookings) {
            if (!b.clientId) continue;
            if (!lastActivityMap[b.clientId] || (b.date && b.date > lastActivityMap[b.clientId]!)) {
              lastActivityMap[b.clientId] = b.date;
            }
          }
          for (const inv of recentInvoices) {
            if (!inv.clientId) continue;
            if (!lastActivityMap[inv.clientId] || (inv.date && inv.date > lastActivityMap[inv.clientId]!)) {
              lastActivityMap[inv.clientId] = inv.date;
            }
          }
        }
        return filtered.map(c => ({ ...c, lastActivity: lastActivityMap[c.id] ?? null }));
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
        defaultRate: z.string().optional(),
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
          defaultRate: input.defaultRate || null,
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
        defaultRate: z.string().optional(),
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

    importCsv: protectedProcedure
      .input(z.object({
        rows: z.array(z.object({
          name: z.string().trim().min(1).max(255),
          email: z.string().email().optional().or(z.literal("")),
          phone: z.string().max(32).optional().or(z.literal("")),
          service: z.string().max(255).optional().or(z.literal("")),
          status: z.enum(["active", "inactive", "prospect"]).optional(),
        })).min(1).max(500),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        let imported = 0;
        let skipped = 0;
        for (const row of input.rows) {
          if (!row.name.trim()) { skipped++; continue; }
          const initials = row.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
          await db.insert(clients).values({
            userId: ctx.user.id,
            name: row.name.trim(),
            email: row.email || null,
            phone: row.phone || null,
            service: row.service || null,
            status: row.status || "active",
            avatarInitials: initials,
          }).onDuplicateKeyUpdate({ set: { name: row.name.trim() } });
          imported++;
        }
        return { imported, skipped };
      }),
    updateStage: protectedProcedure
      .input(z.object({
        id: z.number(),
        pipelineStage: z.enum(["inquiry", "proposal_sent", "active", "completed", "lost"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.update(clients).set({ pipelineStage: input.pipelineStage, updatedAt: new Date() })
          .where(and(eq(clients.id, input.id), eq(clients.userId, ctx.user.id)));
        return { success: true };
      }),
    listByStage: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const all = await db.select().from(clients).where(eq(clients.userId, ctx.user.id)).orderBy(desc(clients.createdAt));
      const stages = ["inquiry", "proposal_sent", "active", "completed", "lost"];
      const grouped: Record<string, typeof all> = {};
      for (const s of stages) grouped[s] = [];
      for (const c of all) {
        const stage = c.pipelineStage ?? "inquiry";
        if (grouped[stage]) grouped[stage].push(c);
        else grouped["inquiry"].push(c);
      }
      return grouped;
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
        amount: z.number().min(0).max(999999).optional(),
        lineItems: z.array(z.object({
          description: z.string().trim().max(500),
          qty: z.number().positive().max(9999),
          unitPrice: z.number().min(0).max(999999),
        })).optional(),
        dueDate: safeOptionalString(32),
        notes: safeOptionalString(2000),
        status: z.enum(["draft", "sent"]).default("draft"),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const invoiceNumber = generateInvoiceNumber();
        let totalAmount = input.amount ?? 0;
        if (input.lineItems && input.lineItems.length > 0) {
          totalAmount = input.lineItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
        }
        const result = await db.insert(invoices).values({
          userId: ctx.user.id,
          clientId: input.clientId || null,
          invoiceNumber,
          clientName: input.clientName,
          clientEmail: input.clientEmail || null,
          service: input.service || null,
          amount: String(totalAmount),
          lineItems: input.lineItems ? JSON.stringify(input.lineItems) : null,
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
        amount: z.number().min(0).max(999999).optional(),
        lineItems: z.array(z.object({
          description: z.string().trim().max(500),
          qty: z.number().positive().max(9999),
          unitPrice: z.number().min(0).max(999999),
        })).optional(),
        dueDate: safeOptionalString(32),
        notes: safeOptionalString(2000),
        status: z.enum(["draft", "sent", "paid", "overdue"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const { id, amount, lineItems, ...rest } = input;
        const updateData: Record<string, unknown> = { ...rest, updatedAt: new Date() };
        if (lineItems !== undefined) {
          updateData.lineItems = JSON.stringify(lineItems);
          updateData.amount = String(lineItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0));
        } else if (amount !== undefined) {
          updateData.amount = String(amount);
        }
        if (input.status === "paid") updateData.paidAt = new Date();
        await db.update(invoices).set(updateData)
          .where(and(eq(invoices.id, id), eq(invoices.userId, ctx.user.id)));
        return { success: true };
      }),

    markPaid: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        // Fetch invoice before marking paid so we can send emails
        const [inv] = await db.select().from(invoices)
          .where(and(eq(invoices.id, input.id), eq(invoices.userId, ctx.user.id))).limit(1);
        if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
        const paidAt = new Date();
        await db.update(invoices)
          .set({ status: "paid", paidAt, updatedAt: new Date() })
          .where(and(eq(invoices.id, input.id), eq(invoices.userId, ctx.user.id)));
        // Send invoice paid confirmation email to client
        if (inv.clientEmail) {
          const [user] = await db.select({ name: users.name, businessName: users.businessName })
            .from(users).where(eq(users.id, ctx.user.id)).limit(1);
          sendEmail({
            to: inv.clientEmail,
            subject: `Payment Received — Invoice #${inv.invoiceNumber}`,
            html: invoicePaidEmail({
              clientName: inv.clientName,
              invoiceNumber: inv.invoiceNumber,
              amount: `$${parseFloat(String(inv.amount)).toFixed(2)}`,
              paidDate: paidAt.toLocaleDateString(),
            }),
          }).catch(() => {});
          // Auto-send testimonial request if client email available
          const crypto = await import("crypto");
          const reqToken = crypto.randomBytes(32).toString("hex");
          const freelancerName = user?.businessName || user?.name || "Your service provider";
          const [existing] = await db.select({ id: testimonials.id }).from(testimonials)
            .where(and(eq(testimonials.userId, ctx.user.id), eq(testimonials.invoiceId, inv.id))).limit(1);
          if (!existing) {
            await db.insert(testimonials).values({
              userId: ctx.user.id,
              clientId: inv.clientId ?? null,
              clientName: inv.clientName,
              clientEmail: inv.clientEmail ?? null,
              invoiceId: inv.id,
              serviceName: inv.service ?? "Service",
              requestToken: reqToken,
              status: "requested",
            });
            const origin = process.env.SITE_ORIGIN || process.env.VITE_SITE_URL || "https://skillbridge-ai.com";
            sendEmail({
              to: inv.clientEmail,
              subject: `How did we do? Share your feedback`,
              html: testimonialRequestEmail({
                clientName: inv.clientName,
                freelancerName,
                serviceName: inv.service ?? "Service",
                testimonialUrl: `${origin}/testimonial/${reqToken}`,
              }),
            }).catch(() => {});
          }
        }
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
        // Send real email to client if email is available
        let emailSent = false;
        if (inv.clientEmail) {
          const result = await sendEmail({
            to: inv.clientEmail,
            subject,
            html: invoiceReminderEmail({
              clientName: inv.clientName,
              invoiceNumber: inv.invoiceNumber || `#${inv.id}`,
              amount: `$${parseFloat(String(inv.amount)).toFixed(2)}`,
              dueDate: inv.dueDate || "As soon as possible",
            }),
          });
          emailSent = result.success;
        }
        return { success: true, subject, emailSent };
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
        // Batch update all overdue invoices in a single query — reuse existing db connection
        db.update(invoices)
          .set({ status: "overdue", updatedAt: new Date() })
          .where(inArray(invoices.id, overdueIds))
          .catch(() => {});
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

    payNow: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        origin: z.string().url().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [inv] = await db.select().from(invoices)
          .where(and(eq(invoices.id, input.id), eq(invoices.userId, ctx.user.id))).limit(1);
        if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
        if (inv.status === "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "This invoice has already been paid." });

        const stripe = getStripe();
        const origin = input.origin || ctx.req.headers.origin || process.env.SITE_ORIGIN || "https://skillbridge-ai.manus.space";
        const amountCents = Math.round(parseFloat(String(inv.amount)) * 100);
        if (amountCents < 50) throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice amount must be at least $0.50 to process payment." });

        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          payment_method_types: ["card"],
          customer_email: inv.clientEmail || undefined,
          line_items: [{
            price_data: {
              currency: "usd",
              product_data: {
                name: inv.service || `Invoice #${inv.invoiceNumber}`,
                description: `Invoice #${inv.invoiceNumber} from ${ctx.user.name || "SkillBridge AI"}`,
              },
              unit_amount: amountCents,
            },
            quantity: 1,
          }],
          metadata: {
            invoice_id: String(inv.id),
            user_id: String(ctx.user.id),
            invoice_number: inv.invoiceNumber || "",
            client_name: inv.clientName,
          },
          client_reference_id: String(inv.id),
          success_url: `${origin}/dashboard?panel=billing&paid=${inv.id}`,
          cancel_url: `${origin}/dashboard?panel=billing`,
          allow_promotion_codes: true,
        });

        return { url: session.url! };
      }),

    duplicate: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [inv] = await db.select().from(invoices)
          .where(and(eq(invoices.id, input.id), eq(invoices.userId, ctx.user.id))).limit(1);
        if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
        const invoiceNumber = generateInvoiceNumber();
        const result = await db.insert(invoices).values({
          userId: ctx.user.id,
          clientId: inv.clientId,
          invoiceNumber,
          clientName: inv.clientName,
          clientEmail: inv.clientEmail,
          service: inv.service,
          amount: inv.amount,
          status: "draft",
          dueDate: inv.dueDate,
          notes: inv.notes,
        });
        return { id: Number((result as any).insertId), invoiceNumber, success: true };
      }),
    sendReceipt: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [inv] = await db.select().from(invoices)
          .where(and(eq(invoices.id, input.id), eq(invoices.userId, ctx.user.id))).limit(1);
        if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
        if (inv.status !== "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "Only paid invoices can have receipts sent." });
        if (!inv.clientEmail) throw new TRPCError({ code: "BAD_REQUEST", message: "No client email on this invoice." });
        const { sendEmail } = await import("./_core/email");
        const emailSent = await sendEmail({
          to: inv.clientEmail,
          subject: `Receipt for Invoice ${inv.invoiceNumber}`,
          html: `<div style="font-family:sans-serif;max-width:520px;margin:auto">
            <h2 style="color:#1C1C1E">Payment Receipt</h2>
            <p>Hi ${inv.clientName},</p>
            <p>Thank you for your payment! Here is your receipt for invoice <strong>${inv.invoiceNumber}</strong>.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Service</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${inv.service || "General Service"}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Amount Paid</strong></td><td style="padding:8px;border-bottom:1px solid #eee">$${Number(inv.amount).toFixed(2)}</td></tr>
              <tr><td style="padding:8px"><strong>Date</strong></td><td style="padding:8px">${new Date().toLocaleDateString()}</td></tr>
            </table>
            <p style="color:#888;font-size:12px">This is an automated receipt. Please keep it for your records.</p>
          </div>`,
        });
        return { success: true, emailSent };
      }),
    generatePayLink: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [inv] = await db.select().from(invoices)
          .where(and(eq(invoices.id, input.id), eq(invoices.userId, ctx.user.id))).limit(1);
        if (!inv) throw new TRPCError({ code: "NOT_FOUND" });
        // Generate a secure token for the pay link
        const crypto = await import("crypto");
        const token = crypto.randomBytes(32).toString("hex");
        // Build the pay URL (uses the existing portal payment flow)
        const payUrl = `/pay/${token}`;
        await db.update(invoices).set({ payLinkToken: token, updatedAt: new Date() })
          .where(eq(invoices.id, input.id));
        return { token, payUrl, invoiceId: input.id };
      }),
    payByToken: publicProcedure
      .input(z.object({ token: z.string().min(1).max(128) }))
      .query(async ({ input }) => {
        const db = await requireDb();
        const [inv] = await db.select().from(invoices).where(eq(invoices.payLinkToken, input.token)).limit(1);
        if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Payment link not found or expired" });
        if (inv.status === "paid") return { invoice: inv, alreadyPaid: true };
        return { invoice: inv, alreadyPaid: false };
      }),
    createStripePaymentForToken: publicProcedure
      .input(z.object({ token: z.string().min(1).max(128), origin: z.string().url() }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const [inv] = await db.select().from(invoices).where(eq(invoices.payLinkToken, input.token)).limit(1);
        if (!inv) throw new TRPCError({ code: "NOT_FOUND" });
        if (inv.status === "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice already paid" });
        const amountCents = Math.round(parseFloat(String(inv.amount)) * 100);
        if (amountCents < 50) throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice amount must be at least $0.50 to process payment." });
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [{
            price_data: {
              currency: (inv as any).currency?.toLowerCase() ?? "usd",
              product_data: { name: `Invoice ${inv.invoiceNumber} — ${inv.clientName}` },
              unit_amount: amountCents,
            },
            quantity: 1,
          }],
          mode: "payment",
          success_url: `${input.origin}/pay/${input.token}?paid=1`,
          cancel_url: `${input.origin}/pay/${input.token}`,
          metadata: { invoiceId: String(inv.id), payLinkToken: input.token },
        });
        return { checkoutUrl: session.url };
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
        const businessName = userRecord[0]?.businessName || "SkillBridge AI";

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

    sendEmail: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [fu] = await db.select().from(followUps)
          .where(and(eq(followUps.id, input.id), eq(followUps.userId, ctx.user.id))).limit(1);
        if (!fu) throw new TRPCError({ code: "NOT_FOUND", message: "Follow-up not found." });
        if (!fu.clientEmail) throw new TRPCError({ code: "BAD_REQUEST", message: "No client email address on this follow-up." });
        const [user] = await db.select({ name: users.name, businessName: users.businessName })
          .from(users).where(eq(users.id, ctx.user.id)).limit(1);
        const senderName = user?.businessName || user?.name || "Your Service Provider";
        const emailSent = await sendEmail({
          to: fu.clientEmail as string,
          subject: fu.subject ?? "",
          html: followUpEmail({ clientName: fu.clientName, subject: fu.subject ?? "", body: fu.body ?? "" }),
        });
        await db.update(followUps).set({ status: "sent", sentAt: new Date() })
          .where(eq(followUps.id, fu.id));
        return { success: true, emailSent };
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
        const updateData: Record<string, unknown> = { updatedAt: new Date() };
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
      const upcomingSessions = allBookings.filter(b => b.status === "scheduled").length;

      // Auto-detect overdue invoices (sent but past due date)
      const nowMs = Date.now();
      const overdueIds: number[] = [];
      for (const inv of allInvoices) {
        if (inv.status === "sent" && inv.dueDate) {
          const dueMs = new Date(inv.dueDate).getTime();
          if (dueMs < nowMs) overdueIds.push(inv.id);
        }
      }
      if (overdueIds.length > 0) {
        await db.update(invoices).set({ status: "overdue" }).where(
          and(eq(invoices.userId, ctx.user.id), sql`${invoices.id} IN (${sql.join(overdueIds.map(id => sql`${id}`), sql`, `)})`)
        ).catch(() => {});
      }

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

      // Revenue forecast: simple linear regression on last 6 months
      const revenueValues = monthlyRevenue.map(m => m.revenue);
      const n = revenueValues.length;
      const avgX = (n - 1) / 2;
      const avgY = revenueValues.reduce((a, b) => a + b, 0) / n;
      const slope = revenueValues.reduce((sum, y, x) => sum + (x - avgX) * (y - avgY), 0) /
        revenueValues.reduce((sum, _, x) => sum + Math.pow(x - avgX, 2), 0) || 0;
      const intercept = avgY - slope * avgX;
      const forecast: { month: string; revenue: number; projected: boolean }[] = [
        ...monthlyRevenue.map((m, i) => ({ ...m, projected: false })),
      ];
      for (let i = 1; i <= 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
        const projected = Math.max(0, Math.round(intercept + slope * (n - 1 + i)));
        forecast.push({ month: label, revenue: projected, projected: true });
      }

      // LTV per client: total paid invoices grouped by client
      const ltvMap: Record<number, { name: string; ltv: number; invoiceCount: number }> = {};
      for (const inv of allInvoices.filter(i => i.status === "paid" && i.clientId)) {
        const cid = inv.clientId!;
        if (!ltvMap[cid]) {
          const c = allClients.find(c => c.id === cid);
          ltvMap[cid] = { name: c?.name ?? inv.clientName, ltv: 0, invoiceCount: 0 };
        }
        ltvMap[cid].ltv += parseFloat(String(inv.amount));
        ltvMap[cid].invoiceCount++;
      }
      const clientLTV = Object.entries(ltvMap)
        .map(([id, v]) => ({ clientId: parseInt(id, 10), ...v }))
        .sort((a, b) => b.ltv - a.ltv).slice(0, 10);

      // Referral source tracking from bookings (how clients found the user)
      const allLeads = await db.select({ source: leads.source }).from(leads).catch(() => []);
      const sourceMap: Record<string, number> = {};
      for (const l of allLeads) {
        const src = l.source || "direct";
        sourceMap[src] = (sourceMap[src] || 0) + 1;
      }
      const referralSources = Object.entries(sourceMap)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count);

      return { totalRevenue, outstanding, activeClients, completedSessions, upcomingSessions, totalClients: allClients.length, totalInvoices: allInvoices.length, monthlyRevenue, clientGrowth, topServices, forecast, clientLTV, referralSources };
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
          activePanel: z.string().max(64).optional(),
        }).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const contextStr = input.context
          ? `User context: ${input.context.clientCount ?? 0} active clients, $${input.context.revenue ?? 0} revenue this month, ${input.context.bookingsThisWeek ?? 0} bookings this week, plan: ${input.context.planId ?? "free"}, currently viewing: ${input.context.activePanel ?? "dashboard"}.`
          : "";
        const systemPrompt = `You are SkillBridge AI Assistant — a smart, friendly business advisor for freelancers and solo service providers. Help users grow their business, manage clients, understand analytics, write follow-up emails, create invoice descriptions, draft contracts, and give actionable advice. Be concise, warm, and practical. ${contextStr} The user's name is ${ctx.user.name ?? "there"}.

IMPORTANT: When you generate a saveable artifact (invoice draft, contract draft, follow-up email draft, or a note), you MUST return your response as a JSON object with this exact structure:
{
  "reply": "your full response text here",
  "actions": [
    {
      "type": "save_invoice_draft" | "save_contract_draft" | "save_followup_draft" | "save_note",
      "label": "Save to Invoices" | "Save Contract Draft" | "Save as Follow-up" | "Save Note",
      "data": { ...relevant fields }
    }
  ]
}

For save_invoice_draft, data must include: { clientName, service, amount (number), notes }
For save_contract_draft, data must include: { clientName, title, body }
For save_followup_draft, data must include: { clientName, subject, body }
For save_note, data must include: { title, body }

Only include actions when you have actually generated a complete draft. For general advice or questions, just return plain text (no JSON needed).`;
        let result;
        try {
          result = await withTimeout(invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              ...input.messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
            ],
          }), LLM_TIMEOUT_MS, "ai.chat");
        } catch (_) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI service temporarily unavailable. Please try again in a moment." });
        }
        const rawContent = result.choices[0]?.message?.content;
        const rawStr = typeof rawContent === "string" ? rawContent : Array.isArray(rawContent) ? rawContent.map((c: unknown) => (c as {text?: string}).text ?? "").join("") : null;
        if (!rawStr) return { reply: "I'm here to help! What would you like to know?", actions: [] };
        // Try to parse as JSON envelope with actions
        try {
          const trimmed = rawStr.trim();
          if (trimmed.startsWith("{")) {
            const parsed = JSON.parse(trimmed);
            if (parsed.reply && typeof parsed.reply === "string") {
              return {
                reply: parsed.reply,
                actions: Array.isArray(parsed.actions) ? parsed.actions : [],
              };
            }
          }
        } catch { /* not JSON, fall through */ }
        return { reply: rawStr, actions: [] };
      }),

    saveAction: protectedProcedure
      .input(z.object({
        type: z.enum(["save_invoice_draft", "save_contract_draft", "save_followup_draft", "save_note"]),
        data: z.record(z.string(), z.unknown()),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const userId = ctx.user.id;
        if (input.type === "save_invoice_draft") {
          const d = input.data as any;
          const invNum = generateInvoiceNumber();
          const [row] = await db.insert(invoices).values({
            userId,
            invoiceNumber: invNum,
            clientName: String(d.clientName ?? "New Client"),
            clientEmail: d.clientEmail ? String(d.clientEmail) : undefined,
            service: d.service ? String(d.service) : undefined,
            amount: String(parseFloat(String(d.amount ?? 0)).toFixed(2)),
            status: "draft",
            notes: d.notes ? String(d.notes) : undefined,
          });
          return { id: (row as any).insertId ?? 0, panel: "invoices", label: "Invoice Draft" };
        }
        if (input.type === "save_contract_draft") {
          const d = input.data as any;
          const [row] = await db.insert(contracts).values({
            userId,
            clientName: String(d.clientName ?? "New Client"),
            clientEmail: d.clientEmail ? String(d.clientEmail) : undefined,
            title: String(d.title ?? "AI-Generated Contract Draft"),
            type: "contract",
            status: "draft",
            body: String(d.body ?? ""),
          });
          return { id: (row as any).insertId ?? 0, panel: "contracts", label: "Contract Draft" };
        }
        if (input.type === "save_followup_draft") {
          const d = input.data as any;
          const [row] = await db.insert(followUps).values({
            userId,
            clientName: String(d.clientName ?? "New Client"),
            clientEmail: d.clientEmail ? String(d.clientEmail) : undefined,
            subject: d.subject ? String(d.subject) : "Follow-up",
            body: String(d.body ?? ""),
            status: "draft",
          });
          return { id: (row as any).insertId ?? 0, panel: "followups", label: "Follow-up Draft" };
        }
        if (input.type === "save_note") {
          const d = input.data as any;
          // Save as a follow-up draft with type note
          const [row] = await db.insert(followUps).values({
            userId,
            clientName: String(d.clientName ?? "General"),
            subject: String(d.title ?? "AI Note"),
            body: String(d.body ?? ""),
            status: "draft",
          });
          return { id: (row as any).insertId ?? 0, panel: "followups", label: "Note" };
        }
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown action type" });
      }),

    smartSchedule: protectedProcedure
      .input(z.object({
        clientName: safeString(255),
        service: safeOptionalString(255),
        lastBookingDate: z.string().optional(),
        notes: safeOptionalString(1000),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const recentBookings = await db.select().from(bookings)
          .where(eq(bookings.userId, ctx.user.id))
          .orderBy(desc(bookings.createdAt)).limit(20);
        const busyDays = recentBookings.map(b => b.date);
        let result;
        try {
          result = await withTimeout(invokeLLM({
            messages: [
              { role: "system", content: `You are a scheduling assistant for a freelancer. Suggest 3 optimal meeting time slots for the next 2 weeks. The freelancer's recent bookings are on these dates: ${busyDays.slice(0, 10).join(", ") || "none yet"}. Avoid weekends unless necessary. Return JSON: { suggestions: [{ date: "YYYY-MM-DD", time: "HH:MM", reason: "brief reason" }] }` },
              { role: "user", content: `Schedule a ${input.service || "session"} with ${input.clientName}. Last booking: ${input.lastBookingDate || "none"}. Notes: ${input.notes || "none"}.` },
            ],
            response_format: { type: "json_schema", json_schema: { name: "schedule_suggestions", strict: true, schema: { type: "object", properties: { suggestions: { type: "array", items: { type: "object", properties: { date: { type: "string" }, time: { type: "string" }, reason: { type: "string" } }, required: ["date", "time", "reason"], additionalProperties: false } } }, required: ["suggestions"], additionalProperties: false } } },
          }), LLM_TIMEOUT_MS, "ai.smartSchedule");
        } catch (_) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI scheduling temporarily unavailable." });
        }
        const raw = result.choices[0]?.message?.content;
        try {
          const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
          return { suggestions: parsed.suggestions ?? [] };
        } catch {
          return { suggestions: [] };
        }
      }),

    categorizeInvoice: protectedProcedure
      .input(z.object({
        service: safeString(255),
        notes: safeOptionalString(1000),
        amount: z.number().min(0).max(1e9),
      }))
      .mutation(async ({ input }) => {
        let result;
        try {
          result = await withTimeout(invokeLLM({
            messages: [
              { role: "system", content: `You are a bookkeeping assistant. Categorize this invoice into one of these categories: Consulting, Design, Development, Coaching, Marketing, Writing, Photography, Video, Legal, Accounting, Other. Return JSON: { category: string, confidence: number (0-1), tags: string[] }` },
              { role: "user", content: `Service: ${input.service}. Notes: ${input.notes || "none"}. Amount: $${input.amount}.` },
            ],
            response_format: { type: "json_schema", json_schema: { name: "invoice_category", strict: true, schema: { type: "object", properties: { category: { type: "string" }, confidence: { type: "number" }, tags: { type: "array", items: { type: "string" } } }, required: ["category", "confidence", "tags"], additionalProperties: false } } },
          }), LLM_TIMEOUT_MS, "ai.categorizeInvoice");
        } catch (_) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI categorization temporarily unavailable." });
        }
        const raw = result.choices[0]?.message?.content;
        try {
          const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
          return { category: parsed.category ?? "Other", confidence: parsed.confidence ?? 0, tags: parsed.tags ?? [] };
        } catch {
          return { category: "Other", confidence: 0, tags: [] };
        }
      }),
    generateProposal: protectedProcedure
      .input(z.object({
        brief: z.string().min(10).max(2000),
        clientName: z.string().optional(),
        currency: z.string().default("USD"),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id));
        const businessName = user?.businessName ?? user?.name ?? "My Business";
        const systemPrompt = `You are an expert freelance proposal writer for ${businessName}. Generate a professional, detailed proposal in JSON format.`;
        const userPrompt = `Create a complete freelance proposal for this project:\n\n"${input.brief}"\n\nClient: ${input.clientName ?? "the client"}\nCurrency: ${input.currency}\n\nReturn ONLY valid JSON matching this exact schema (no markdown, no explanation):\n{\n  "title": "string",\n  "executiveSummary": "string",\n  "scopeOfWork": ["string"],\n  "timeline": "string",\n  "deliverables": ["string"],\n  "lineItems": [{ "name": "string", "description": "string", "qty": 1, "unitPrice": 0 }],\n  "taxRate": 0,\n  "terms": "string",\n  "validDays": 30\n}`;
        const response = await withTimeout(invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }), 30000);
        const raw = response.choices[0]?.message?.content ?? "{}";
        let draft;
        try { draft = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)); }
        catch { draft = { title: "Proposal", executiveSummary: raw, scopeOfWork: [], timeline: "TBD", deliverables: [], lineItems: [], taxRate: 0, terms: "Net 30", validDays: 30 }; }
        return { draft };
      }),
  }),

  // ── Stripe Billing ──────────────────────────────────────────────────────────────
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
                product_data: { name: `SkillBridge AI — ${plan.name}`, description: plan.description },
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
    // Verifies a Stripe checkout session_id is real and belongs to this user.
    // Called by CheckoutSuccess page to prevent false "subscription active" display.
    verifyCheckoutSession: protectedProcedure
      .input(z.object({ sessionId: z.string().min(1).max(200) }))
      .query(async ({ input, ctx }) => {
        let stripe: Stripe;
        try { stripe = getStripe(); } catch { return { valid: false, planId: null }; }
        try {
          const session = await stripe.checkout.sessions.retrieve(input.sessionId);
          const isValid =
            session.payment_status === "paid" &&
            session.status === "complete" &&
            session.metadata?.user_id === ctx.user.id.toString();
          return {
            valid: isValid,
            planId: isValid ? (session.metadata?.plan_id ?? null) : null,
          };
        } catch (err: any) {
          console.error("[Stripe] verifyCheckoutSession failed:", err?.message);
          return { valid: false, planId: null };
        }
      }),
  }),
  // ── Admin ─────────────────────────────────────────────────────────────────
  admin: router({
    listUsers: ownerProcedure
      .input(z.object({
        search: z.string().trim().max(200).optional(),
        page: z.number().int().min(1).max(1000).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      }))
      .query(async ({ input }) => {
        const db = await requireDb();
        const offset = (input.page - 1) * input.limit;
        const searchFilter = input.search
          ? or(like(users.name, `%${input.search}%`), like(users.email, `%${input.search}%`))
          : undefined;
        const [{ total }] = await db.select({ total: sql<number>`COUNT(*)` }).from(users)
          .where(searchFilter);
        const userList = await db.select().from(users)
          .where(searchFilter)
          .orderBy(desc(users.createdAt))
          .limit(input.limit)
          .offset(offset);
        return { users: userList, total: Number(total ?? 0) };
      }),

    revenueStats: ownerProcedure.query(async () => {
      const db = await requireDb();
      // Use SQL aggregates instead of loading all users into memory
      const [{ totalUsers }] = await db.select({ totalUsers: sql<number>`COUNT(*)` }).from(users);
      const planRows = await db.select({
        planId: users.planId,
        count: sql<number>`COUNT(*)`,
      }).from(users)
        .where(eq(users.subscriptionStatus, "active"))
        .groupBy(users.planId);
      const byPlan: Record<string, number> = { starter: 0, pro: 0, agency: 0, free: 0 };
      let mrr = 0;
      let paidCount = 0;
      for (const row of planRows) {
        const planId = (row.planId ?? "free") as PlanId | "free";
        const cnt = Number(row.count);
        byPlan[planId] = (byPlan[planId] ?? 0) + cnt;
        if (planId !== "free" && PLANS[planId as PlanId]) mrr += PLANS[planId as PlanId].monthlyPrice / 100 * cnt;
        paidCount += cnt;
      }
      byPlan.free = Number(totalUsers) - paidCount;
      const [{ totalLeads }] = await db.select({ totalLeads: sql<number>`COUNT(*)` }).from(leads);
      return { totalUsers: Number(totalUsers), paidUsers: paidCount, mrr, arr: mrr * 12, byPlan, totalLeads: Number(totalLeads) };
    }),

    listLeads: ownerProcedure
      .input(z.object({ page: z.number().int().min(1).default(1), limit: z.number().int().min(1).max(100).default(50) }))
      .query(async ({ input }) => {
        const db = await requireDb();
        const offset = (input.page - 1) * input.limit;
        const [{ total }] = await db.select({ total: sql<number>`COUNT(*)` }).from(leads);
        const leadList = await db.select().from(leads)
          .orderBy(desc(leads.createdAt))
          .limit(input.limit)
          .offset(offset);
        return { leads: leadList, total: Number(total ?? 0) };
      }),

    setUserRole: ownerProcedure
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

    broadcast: ownerProcedure
      .input(z.object({ title: safeString(200), content: safeString(2000) }))
      .mutation(async ({ input }) => {
        const sent = await notifyOwner({ title: `[Broadcast] ${input.title}`, content: input.content });
        if (!sent) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Notification service unavailable. Try again shortly." });
        return { success: true };
      }),

    // ── Platform Settings ───────────────────────────────────────────────────────
    getSettings: ownerProcedure.query(async () => {
      const db = await requireDb();
      const rows = await db.select().from(platformSettings).limit(1);
      if (rows[0]) return rows[0];
      // Seed defaults on first access
      await db.insert(platformSettings).values({});
      const fresh = await db.select().from(platformSettings).limit(1);
      return fresh[0]!;
    }),

    updateSettings: ownerProcedure
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
    updateUserPlan: ownerProcedure
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

    deleteUser: ownerProcedure
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
    createInvite: ownerProcedure
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

    listInvites: ownerProcedure.query(async () => {
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

    revokeInvite: ownerProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const [inv] = await db.select({ id: inviteCodes.id, usedAt: inviteCodes.usedAt })
          .from(inviteCodes).where(eq(inviteCodes.id, input.id)).limit(1);
        if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Invite code not found." });
        if (inv.usedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot revoke an already-used invite code." });
        // Permanently delete the invite code — revoked codes have no value and should not persist
        await db.delete(inviteCodes).where(eq(inviteCodes.id, input.id));
        return { success: true };
      }),

    // ── System Health ───────────────────────────────────────────────────────────────
    getSystemHealth: ownerProcedure.query(async () => {
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

        const hostId = host[0].id;

        // ── Auto-upsert client record ──────────────────────────────────────────
        // Check if a client with this email already exists for this host
        let clientId: number | null = null;
        let isNewClient = false;
        if (input.clientEmail) {
          const existing = await db.select({ id: clients.id })
            .from(clients)
            .where(and(eq(clients.userId, hostId), eq(clients.email, input.clientEmail)))
            .limit(1);
          if (existing[0]) {
            // Update their session count and last contacted timestamp
            clientId = existing[0].id;
            await db.update(clients).set({
              sessionsCount: sql`sessionsCount + 1`,
              lastContactedAt: new Date(),
              updatedAt: new Date(),
            }).where(eq(clients.id, clientId));
          } else {
            // Create a new client record
            const initials = input.clientName
              .split(" ")
              .map((w: string) => w[0]?.toUpperCase() ?? "")
              .slice(0, 2)
              .join("");
            const inserted = await db.insert(clients).values({
              userId: hostId,
              name: input.clientName,
              email: input.clientEmail,
              service: input.service || null,
              status: "active",
              avatarInitials: initials || input.clientName[0]?.toUpperCase() || "?",
              sessionsCount: 1,
              lastContactedAt: new Date(),
            });
            clientId = Number((inserted as any).insertId) || null;
            isNewClient = clientId !== null && clientId > 0;
          }
        }

        // ── Conflict detection: reject if the same slot is already booked ─────
        const conflictingBooking = await db.select({ id: bookings.id })
          .from(bookings)
          .where(and(
            eq(bookings.userId, hostId),
            eq(bookings.date, input.preferredDate),
            eq(bookings.time, input.preferredTime),
            sql`${bookings.status} NOT IN ('cancelled', 'no_show')`,
          ))
          .limit(1);
        if (conflictingBooking.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `The ${input.preferredDate} at ${input.preferredTime} slot is no longer available. Please choose a different time.`,
          });
        }

        const bookingResult = await db.insert(bookings).values({
          userId: hostId,
          clientId: clientId !== null && clientId > 0 ? clientId : null,
          clientName: input.clientName,
          clientEmail: input.clientEmail,
          service: input.service,
          date: input.preferredDate,
          time: input.preferredTime,
          notes: input.message || null,
          isPublicBooking: true,
          status: "scheduled",
        });
        const newBookingId = Number((bookingResult as any).insertId);

        if (host[0].notifyNewBooking !== false) {
          notifyOwner({
            title: `New Booking — ${input.clientName}`,
            content: `${input.clientName} (${input.clientEmail}) booked a ${input.service} on ${input.preferredDate} at ${input.preferredTime}.`,
          }).catch(() => {});
        }

        // Create cancel and reschedule tokens for the booking confirmation email
        const cryptoMod = await import("crypto");
        const cancelToken = cryptoMod.randomBytes(32).toString("hex");
        const rescheduleToken = cryptoMod.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        if (newBookingId) {
          await db.insert(bookingCancelTokens).values([
            { bookingId: newBookingId, userId: hostId, token: cancelToken, action: "cancel", expiresAt },
            { bookingId: newBookingId, userId: hostId, token: rescheduleToken, action: "reschedule", expiresAt },
          ]);
        }

        // Send booking confirmation email to client
        const hostDetails = await db.select({ name: users.name, businessName: users.businessName })
          .from(users).where(eq(users.id, host[0].id)).limit(1);
        const freelancerName = hostDetails[0]?.businessName || hostDetails[0]?.name || "Your service provider";
        const siteOrigin = process.env.SITE_ORIGIN || process.env.VITE_SITE_URL || "https://skillbridge-ai.com";
        const cancelUrl = newBookingId ? `${siteOrigin}/booking/cancel/${cancelToken}` : undefined;
        sendEmail({
          to: input.clientEmail,
          subject: `Booking Confirmed: ${input.service} on ${input.preferredDate}`,
          html: bookingConfirmationEmail({
            clientName: input.clientName,
            serviceName: input.service,
            date: input.preferredDate,
            time: input.preferredTime,
            freelancerName,
            cancelUrl,
          }),
        }).catch(() => {});
        return { success: true, isNewClient };
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

  // ── Security (admin-only) ───────────────────────────────────────────────────
  security: router({
    // Get recent security events from DB
    events: ownerProcedure
      .input(z.object({
        limit: z.number().int().min(1).max(200).default(50),
        severity: z.enum(["low", "medium", "high", "critical", "all"]).default("all"),
        resolved: z.boolean().optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await requireDb();
        const all = await db.select().from(securityEvents)
          .orderBy(desc(securityEvents.createdAt))
          .limit(input?.limit ?? 50);
        let filtered = all;
        if (input?.severity && input.severity !== "all") {
          filtered = filtered.filter(e => e.severity === input.severity);
        }
        if (input?.resolved !== undefined) {
          filtered = filtered.filter(e => e.resolved === input.resolved);
        }
        return filtered;
      }),

    // Get in-memory security stats (blocked IPs, locked accounts, etc.)
    stats: ownerProcedure.query(() => {
      return getSecurityStats();
    }),

    // Resolve a security event (mark as handled)
    resolveEvent: ownerProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        await db.update(securityEvents)
          .set({ resolved: true })
          .where(eq(securityEvents.id, input.id));
        return { success: true };
      }),

    // Resolve all events matching a filter
    resolveAll: ownerProcedure
      .input(z.object({ severity: z.enum(["low", "medium", "high", "critical", "all"]).default("all") }).optional())
      .mutation(async ({ input }) => {
        const db = await requireDb();
        if (!input?.severity || input.severity === "all") {
          await db.update(securityEvents).set({ resolved: true }).where(eq(securityEvents.resolved, false));
        } else {
          await db.update(securityEvents).set({ resolved: true })
            .where(and(eq(securityEvents.severity, input.severity), eq(securityEvents.resolved, false)));
        }
        return { success: true };
      }),

    // Block an IP address manually
    blockIP: ownerProcedure
      .input(z.object({
        ip: z.string().min(7).max(45),
        reason: z.string().max(255).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        manualBlockIP(input.ip);
        logSecurityEvent({
          eventType: "ip_blocked_manual",
          severity: "high",
          ip: input.ip,
          userId: ctx.user.id,
          details: `Manually blocked by admin. Reason: ${input.reason ?? "Not specified"}`,
        });
        return { success: true };
      }),

    // Unblock an IP address
    unblockIP: ownerProcedure
      .input(z.object({ ip: z.string().min(7).max(45) }))
      .mutation(async ({ ctx, input }) => {
        unblockIP(input.ip);
        logSecurityEvent({
          eventType: "ip_unblocked",
          severity: "low",
          ip: input.ip,
          userId: ctx.user.id,
          details: "Unblocked by admin",
        });
        return { success: true };
      }),

    // Unlock a locked account
    unlockAccount: ownerProcedure
      .input(z.object({ email: safeEmail }))
      .mutation(async ({ ctx, input }) => {
        clearFailedLogins(input.email);
        logSecurityEvent({
          eventType: "account_unlocked",
          severity: "low",
          email: input.email,
          userId: ctx.user.id,
          details: "Account unlocked by admin",
        });
        return { success: true };
      }),

    // Watchdog: check system health and auto-fix issues
    watchdog: ownerProcedure.query(async () => {
      const db = await requireDb();
      const issues: string[] = [];
      const fixes: string[] = [];

      // Check 1: Expired password reset tokens (clean up)
      const expiredTokens = await db.select({ id: passwordResetTokens.id })
        .from(passwordResetTokens)
        .where(and(
          eq(passwordResetTokens.used, false),
          sql`${passwordResetTokens.expiresAt} < NOW()`
        ));
      if (expiredTokens.length > 0) {
        await db.update(passwordResetTokens)
          .set({ used: true })
          .where(and(
            eq(passwordResetTokens.used, false),
            sql`${passwordResetTokens.expiresAt} < NOW()`
          ));
        fixes.push(`Cleaned up ${expiredTokens.length} expired password reset token(s)`);
      }

      // Check 2: Expired invite codes — permanently delete them
      const expiredInvites = await db.select({ id: inviteCodes.id })
        .from(inviteCodes)
        .where(and(
          eq(inviteCodes.revoked, false),
          sql`${inviteCodes.expiresAt} IS NOT NULL AND ${inviteCodes.expiresAt} < NOW()`
        ));
      if (expiredInvites.length > 0) {
        await db.delete(inviteCodes)
          .where(and(
            eq(inviteCodes.revoked, false),
            sql`${inviteCodes.expiresAt} IS NOT NULL AND ${inviteCodes.expiresAt} < NOW()`
          ));
        fixes.push(`Deleted ${expiredInvites.length} expired invite code(s)`);
      }

      // Check 3: Expired user sessions (deactivate)
      const expiredSessions = await db.select({ id: userSessions.id })
        .from(userSessions)
        .where(and(
          eq(userSessions.isActive, true),
          sql`${userSessions.expiresAt} < NOW()`
        ));
      if (expiredSessions.length > 0) {
        await db.update(userSessions)
          .set({ isActive: false, invalidatedAt: new Date(), invalidationReason: "expired" })
          .where(and(
            eq(userSessions.isActive, true),
            sql`${userSessions.expiresAt} < NOW()`
          ));
        fixes.push(`Deactivated ${expiredSessions.length} expired session(s)`);
      }

      // Check 4: Unresolved critical security events
      const criticalEvents = await db.select({ id: securityEvents.id })
        .from(securityEvents)
        .where(and(
          eq(securityEvents.severity, "critical"),
          eq(securityEvents.resolved, false)
        ));
      if (criticalEvents.length > 0) {
        issues.push(`${criticalEvents.length} unresolved critical security event(s) require attention`);
      }

      // Check 5: Users with no password (potential orphaned accounts)
      const noPasswordUsers = await db.select({ id: users.id, email: users.email })
        .from(users)
        .where(sql`${users.passwordHash} IS NULL`);
      if (noPasswordUsers.length > 0) {
        issues.push(`${noPasswordUsers.length} user account(s) have no password set`);
      }

      const memStats = getSecurityStats();
      const healthy = issues.length === 0;

      if (!healthy) {
        // Notify owner only when there are issues requiring manual intervention
        notifyOwner({
          title: "⚠️ Watchdog Alert — Issues Detected",
          content: `Watchdog found ${issues.length} issue(s) requiring attention:\n\n${issues.join('\n')}\n\nFixes applied automatically:\n${fixes.length > 0 ? fixes.join('\n') : 'None'}`,
        }).catch(() => {});
      }

      return {
        healthy,
        issues,
        fixes,
        memStats,
        checkedAt: new Date().toISOString(),
      };
    }),
  }),

  // ── Client Portal ────────────────────────────────────────────────────────────────
  portal: router({
    // Generate or retrieve a portal token for a specific client
    getToken: protectedProcedure
      .input(z.object({
        clientId: z.number().int().positive(),
        // Frontend passes window.location.origin so the URL works in any environment
        origin: z.string().url().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        // Check client belongs to this user
        const [client] = await db.select().from(clients)
          .where(and(eq(clients.id, input.clientId), eq(clients.userId, ctx.user.id))).limit(1);
        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." });

        // Use frontend-provided origin (most reliable), fall back to request header
        const origin = input.origin || ctx.req.headers.origin || "";

        // Check for existing valid token (not expired)
        const [existing] = await db.select().from(clientPortalTokens)
          .where(and(
            eq(clientPortalTokens.userId, ctx.user.id),
            eq(clientPortalTokens.clientId, input.clientId)
          )).limit(1);

        const crypto = await import("crypto");
        const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
        const isExpired = existing?.expiresAt && new Date() > existing.expiresAt;
        const isStale = existing?.createdAt && (Date.now() - new Date(existing.createdAt).getTime() > ninetyDaysMs);

        if (existing && !isExpired && !isStale) {
          return { token: existing.token, url: `${origin}/portal/${existing.token}` };
        }

        // Create (or rotate) token — delete old one if present
        if (existing) {
          await db.delete(clientPortalTokens).where(eq(clientPortalTokens.id, existing.id));
        }
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + ninetyDaysMs);
        await db.insert(clientPortalTokens).values({
          userId: ctx.user.id,
          clientId: input.clientId,
          token,
          expiresAt,
        });
        return { token, url: `${origin}/portal/${token}` };
      }),

    // Public: view the portal (no auth required — token is the secret)
    view: publicProcedure
      .input(z.object({ token: z.string().min(1).max(128) }))
      .query(async ({ input }) => {
        const db = await requireDb();
        const [portalRecord] = await db.select().from(clientPortalTokens)
          .where(eq(clientPortalTokens.token, input.token)).limit(1);

        if (!portalRecord) throw new TRPCError({ code: "NOT_FOUND", message: "Portal link not found or expired." });
        if (portalRecord.expiresAt && new Date() > portalRecord.expiresAt) {
          throw new TRPCError({ code: "FORBIDDEN", message: "This portal link has expired." });
        }

        // Update last viewed
        await db.update(clientPortalTokens)
          .set({ lastViewedAt: new Date() })
          .where(eq(clientPortalTokens.id, portalRecord.id));

        // Fetch freelancer info
        const [freelancer] = await db.select({
          name: users.name,
          businessName: users.businessName,
          email: users.email,
          phone: users.phone,
          avatarUrl: users.avatarUrl,
        }).from(users).where(eq(users.id, portalRecord.userId)).limit(1);

        // Fetch client info
        const [client] = await db.select().from(clients)
          .where(and(eq(clients.id, portalRecord.clientId), eq(clients.userId, portalRecord.userId))).limit(1);
        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client record not found." });

        // Fetch client's invoices
        const clientInvoices = await db.select().from(invoices)
          .where(and(eq(invoices.userId, portalRecord.userId), eq(invoices.clientId, portalRecord.clientId)))
          .orderBy(desc(invoices.createdAt));

        // Fetch client's bookings
        const clientBookings = await db.select().from(bookings)
          .where(and(eq(bookings.userId, portalRecord.userId), eq(bookings.clientId, portalRecord.clientId)))
          .orderBy(desc(bookings.createdAt));

        return {
          freelancer,
          client,
          invoices: clientInvoices,
          bookings: clientBookings,
        };
      }),

    // Pay an invoice from the portal (creates Stripe checkout)
    payInvoice: publicProcedure
      .input(z.object({ token: z.string().min(1).max(128), invoiceId: z.number().int().positive(), origin: z.string().url() }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const [portalRecord] = await db.select().from(clientPortalTokens)
          .where(eq(clientPortalTokens.token, input.token)).limit(1);
        if (!portalRecord) throw new TRPCError({ code: "NOT_FOUND", message: "Portal link not found." });
        if (portalRecord.expiresAt && new Date() > portalRecord.expiresAt) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Portal link has expired. Please request a new one." });
        }

        const [inv] = await db.select().from(invoices)
          .where(and(
            eq(invoices.id, input.invoiceId),
            eq(invoices.userId, portalRecord.userId),
            eq(invoices.clientId, portalRecord.clientId)
          )).limit(1);
        if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
                if (inv.status === "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "This invoice is already paid." });
        const portalAmountCents = Math.round(parseFloat(String(inv.amount)) * 100);
        if (portalAmountCents < 50) throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice amount must be at least $0.50 to process payment." });
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "payment",
          line_items: [{
            price_data: {
              currency: "usd",
              product_data: { name: inv.service || "Professional Services", description: `Invoice ${inv.invoiceNumber}` },
              unit_amount: portalAmountCents,
            },
            quantity: 1,
          }],
          metadata: {
            invoice_id: String(inv.id),
            invoice_number: inv.invoiceNumber,
            client_name: inv.clientName,
          },
          customer_email: inv.clientEmail || undefined,
          success_url: `${input.origin}/portal/${input.token}?paid=1`,
          cancel_url: `${input.origin}/portal/${input.token}`,
          allow_promotion_codes: true,
        });
        return { checkoutUrl: session.url };
      }),
  }),

  // ── Contracts & Proposals ─────────────────────────────────────────────────
  contracts: router({
    list: protectedProcedure
      .input(z.object({ type: z.enum(["all", "contract", "proposal"]).default("all") }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const typeFilter = input.type !== "all" ? eq(contracts.type, input.type) : undefined;
        const rows = await db.select().from(contracts)
          .where(and(eq(contracts.userId, ctx.user.id), typeFilter))
          .orderBy(desc(contracts.createdAt));
        return rows;
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const [row] = await db.select().from(contracts)
          .where(and(eq(contracts.id, input.id), eq(contracts.userId, ctx.user.id))).limit(1);
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        return row;
      }),

    create: protectedProcedure
      .input(z.object({
        clientId: z.number().optional(),
        clientName: z.string().min(1),
        clientEmail: safeOptionalEmail,
        title: z.string().min(1),
        type: z.enum(["contract", "proposal"]),
        body: z.string().min(1),
        proposalAmount: z.string().optional(),
        expiresAt: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        // Verify clientId belongs to this user if provided
        if (input.clientId) {
          const [clientCheck] = await db.select({ id: clients.id })
            .from(clients).where(and(eq(clients.id, input.clientId), eq(clients.userId, ctx.user.id))).limit(1);
          if (!clientCheck) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid client." });
        }
        const [result] = await db.insert(contracts).values({
          userId: ctx.user.id,
          clientId: input.clientId ?? null,
          clientName: input.clientName,
          clientEmail: input.clientEmail || null,
          title: input.title,
          type: input.type,
          body: input.body,
          proposalAmount: input.proposalAmount || null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          status: "draft",
        });
        return { id: (result as any).insertId };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        body: z.string().optional(),
        clientName: z.string().optional(),
        clientEmail: safeOptionalEmail,
        proposalAmount: z.string().optional(),
        status: z.enum(["draft", "sent", "signed", "declined", "expired"]).optional(),
        expiresAt: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const { id, expiresAt, ...rest } = input;
        await db.update(contracts).set({
          ...rest,
          ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
          ...(rest.status === "sent" ? { sentAt: new Date() } : {}),
          ...(rest.status === "signed" ? { signedAt: new Date() } : {}),
        }).where(and(eq(contracts.id, id), eq(contracts.userId, ctx.user.id)));
        return { ok: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.delete(contracts).where(and(eq(contracts.id, input.id), eq(contracts.userId, ctx.user.id)));
        return { ok: true };
      }),

    convertToInvoice: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [contract] = await db.select().from(contracts)
          .where(and(eq(contracts.id, input.id), eq(contracts.userId, ctx.user.id))).limit(1);
        if (!contract) throw new TRPCError({ code: "NOT_FOUND" });
        if (contract.type !== "proposal") throw new TRPCError({ code: "BAD_REQUEST", message: "Only proposals can be converted to invoices." });
        const invoiceNumber = generateInvoiceNumber();
        const [result] = await db.insert(invoices).values({
          userId: ctx.user.id,
          clientId: contract.clientId ?? null,
          invoiceNumber,
          clientName: contract.clientName,
          clientEmail: contract.clientEmail || null,
          service: contract.title,
          amount: contract.proposalAmount || "0",
          status: "draft",
          notes: `Converted from proposal: ${contract.title}`,
        });
        const invoiceId = (result as any).insertId;
        await db.update(contracts).set({ linkedInvoiceId: invoiceId }).where(eq(contracts.id, input.id));
        return { invoiceId };
      }),
  }),

  // ── Notifications ──────────────────────────────────────────────────────────
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(notifications)
        .where(eq(notifications.userId, ctx.user.id))
        .orderBy(desc(notifications.createdAt))
        .limit(50);
    }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const [row] = await db.select({ count: sql<number>`COUNT(*)` }).from(notifications)
        .where(and(eq(notifications.userId, ctx.user.id), eq(notifications.read, false)));
      return { count: Number(row?.count ?? 0) };
    }),
    markRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.update(notifications).set({ read: true })
          .where(and(eq(notifications.id, input.id), eq(notifications.userId, ctx.user.id)));
        return { ok: true };
      }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await requireDb();
      await db.update(notifications).set({ read: true })
        .where(and(eq(notifications.userId, ctx.user.id), eq(notifications.read, false)));
      return { ok: true };
    }),
    dismiss: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.delete(notifications)
          .where(and(eq(notifications.id, input.id), eq(notifications.userId, ctx.user.id)));
        return { ok: true };
      }),
  }),

  // ── Time Tracking ──────────────────────────────────────────────────────────
  time: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(timeEntries)
        .where(eq(timeEntries.userId, ctx.user.id))
        .orderBy(desc(timeEntries.startedAt))
        .limit(200);
    }),
    start: protectedProcedure
      .input(z.object({
        clientId: z.number().optional(),
        clientName: z.string().trim().max(255).optional(),
        projectName: z.string().trim().max(255).optional(),
        description: z.string().trim().max(1000).optional(),
        hourlyRate: z.string().optional(),
        billable: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        // Stop any running timer first
        const running = await db.select().from(timeEntries)
          .where(and(eq(timeEntries.userId, ctx.user.id), sql`${timeEntries.endedAt} IS NULL`))
          .limit(1);
        if (running.length > 0) {
          const entry = running[0];
          const durationMinutes = Math.round((Date.now() - entry.startedAt.getTime()) / 60000);
          await db.update(timeEntries).set({ endedAt: new Date(), durationMinutes })
            .where(eq(timeEntries.id, entry.id));
        }
        const [result] = await db.insert(timeEntries).values({
          userId: ctx.user.id,
          clientId: input.clientId ?? null,
          clientName: input.clientName ?? null,
          projectName: input.projectName ?? null,
          description: input.description ?? null,
          startedAt: new Date(),
          hourlyRate: input.hourlyRate ?? null,
          billable: input.billable,
        });
        return { id: (result as any).insertId };
      }),
    stop: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [entry] = await db.select().from(timeEntries)
          .where(and(eq(timeEntries.id, input.id), eq(timeEntries.userId, ctx.user.id))).limit(1);
        if (!entry) throw new TRPCError({ code: 'NOT_FOUND' });
        if (entry.endedAt) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Timer already stopped.' });
        const durationMinutes = Math.round((Date.now() - entry.startedAt.getTime()) / 60000);
        await db.update(timeEntries).set({ endedAt: new Date(), durationMinutes })
          .where(eq(timeEntries.id, input.id));
        return { durationMinutes };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        description: z.string().trim().max(1000).optional(),
        projectName: z.string().trim().max(255).optional(),
        clientName: z.string().trim().max(255).optional(),
        hourlyRate: z.string().optional(),
        billable: z.boolean().optional(),
        durationMinutes: z.number().min(0).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const { id, ...fields } = input;
        await db.update(timeEntries).set(fields as any)
          .where(and(eq(timeEntries.id, id), eq(timeEntries.userId, ctx.user.id)));
        return { ok: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.delete(timeEntries)
          .where(and(eq(timeEntries.id, input.id), eq(timeEntries.userId, ctx.user.id)));
        return { ok: true };
      }),
    runningEntry: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const [entry] = await db.select().from(timeEntries)
        .where(and(eq(timeEntries.userId, ctx.user.id), sql`${timeEntries.endedAt} IS NULL`))
        .limit(1);
      return entry ?? null;
    }),
    summary: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const rows = await db.select().from(timeEntries)
        .where(and(eq(timeEntries.userId, ctx.user.id), sql`${timeEntries.endedAt} IS NOT NULL`));
      const totalMinutes = rows.reduce((s, r) => s + (r.durationMinutes ?? 0), 0);
      const billableRows = rows.filter(r => r.billable && r.hourlyRate);
      const totalBillable = billableRows.reduce((s, r) => {
        const hrs = (r.durationMinutes ?? 0) / 60;
        return s + hrs * parseFloat(r.hourlyRate ?? '0');
      }, 0);
      const rates = billableRows.map(r => parseFloat(r.hourlyRate ?? '0')).filter(r => r > 0);
      const avgRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
      const todayStr = new Date().toISOString().split('T')[0];
      const todayCount = rows.filter(r => r.startedAt.toISOString().split('T')[0] === todayStr).length;
      return { totalMinutes, totalBillable, avgRate, todayCount };
    }),
    addManual: protectedProcedure
      .input(z.object({
        clientId: z.number().optional(),
        clientName: z.string().trim().max(255).optional(),
        description: z.string().trim().max(1000).optional(),
        durationMinutes: z.number().min(1),
        hourlyRate: z.string().optional(),
        billable: z.boolean().default(true),
        date: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const startedAt = input.date ? new Date(input.date + 'T09:00:00') : new Date();
        const endedAt = new Date(startedAt.getTime() + input.durationMinutes * 60000);
        const [result] = await db.insert(timeEntries).values({
          userId: ctx.user.id,
          clientId: input.clientId ?? null,
          clientName: input.clientName ?? null,
          projectName: null,
          description: input.description ?? null,
          startedAt,
          endedAt,
          durationMinutes: input.durationMinutes,
          hourlyRate: input.hourlyRate ?? null,
          billable: input.billable,
        });
        return { id: (result as any).insertId };
      }),

    // Generate an invoice directly from a completed time entry
    generateInvoice: protectedProcedure
      .input(z.object({
        id: z.number(),
        // Optional overrides the user can supply before generating
        dueDate: z.string().optional(),
        notes: z.string().max(1000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();

        // 1. Fetch and validate the time entry
        const [entry] = await db.select().from(timeEntries)
          .where(and(eq(timeEntries.id, input.id), eq(timeEntries.userId, ctx.user.id)))
          .limit(1);
        if (!entry) throw new TRPCError({ code: 'NOT_FOUND', message: 'Time entry not found.' });
        if (!entry.endedAt) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot invoice a running timer — stop it first.' });
        if (entry.invoiced) throw new TRPCError({ code: 'BAD_REQUEST', message: 'This entry has already been invoiced.' });
        if (!entry.billable) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Entry is marked non-billable.' });

        // 2. Compute amount
        const hours = (entry.durationMinutes ?? 0) / 60;
        const rate = entry.hourlyRate ? parseFloat(String(entry.hourlyRate)) : 0;
        if (rate <= 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No hourly rate set on this entry. Edit the entry to add a rate first.' });
        const amount = parseFloat((hours * rate).toFixed(2));

        // 3. Generate invoice number (INV-XXXX)
        const existing = await db.select({ invoiceNumber: invoices.invoiceNumber })
          .from(invoices).where(eq(invoices.userId, ctx.user.id));
        const maxNum = existing.reduce((max, r) => {
          const n = parseInt(r.invoiceNumber.replace(/\D/g, ''), 10);
          return isNaN(n) ? max : Math.max(max, n);
        }, 0);
        const invoiceNumber = `INV-${String(maxNum + 1).padStart(4, '0')}`;

        // 4. Build line items JSON
        const lineItems = JSON.stringify([{
          description: entry.description
            ? `${entry.description} (${hours.toFixed(2)}h @ $${rate}/hr)`
            : `Time tracked: ${hours.toFixed(2)}h @ $${rate}/hr`,
          qty: 1,
          unitPrice: amount,
        }]);

        // 5. Due date — default 30 days from now
        const dueDateStr = input.dueDate ?? (() => {
          const d = new Date();
          d.setDate(d.getDate() + 30);
          return d.toISOString().split('T')[0];
        })();

        // 6. Create the invoice
        const [result] = await db.insert(invoices).values({
          userId: ctx.user.id,
          clientId: entry.clientId ?? undefined,
          invoiceNumber,
          clientName: entry.clientName ?? 'Unknown Client',
          service: entry.description ?? entry.projectName ?? 'Time Tracking',
          amount: String(amount),
          status: 'draft',
          dueDate: dueDateStr,
          notes: input.notes ?? `Generated from time entry on ${entry.startedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`,
          lineItems,
        });
        const invoiceId = (result as any).insertId;

        // 7. Mark the time entry as invoiced
        await db.update(timeEntries)
          .set({ invoiced: true })
          .where(eq(timeEntries.id, input.id));

        return { invoiceId, invoiceNumber, amount };
      }),

    // Bulk-generate a single consolidated invoice from multiple time entries
    bulkGenerateInvoice: protectedProcedure
      .input(z.object({
        ids: z.array(z.number()).min(1).max(50),
        dueDate: z.string().optional(),
        notes: z.string().max(1000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        // 1. Fetch all entries and validate ownership
        const entries = await db.select().from(timeEntries)
          .where(and(
            inArray(timeEntries.id, input.ids),
            eq(timeEntries.userId, ctx.user.id)
          ));
        if (entries.length !== input.ids.length)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'One or more time entries not found.' });
        // Validate all entries belong to the same client
        const uniqueClientIds = new Set(entries.map(e => e.clientId ?? null));
        if (uniqueClientIds.size > 1) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'All selected time entries must belong to the same client. Please select entries for a single client only.' });
        }
        for (const e of entries) {
          if (!e.endedAt) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot invoice a running timer — stop it first.' });
          if (e.invoiced) throw new TRPCError({ code: 'BAD_REQUEST', message: `Entry "${e.description ?? e.projectName}" has already been invoiced.` });
          if (!e.billable) throw new TRPCError({ code: 'BAD_REQUEST', message: `Entry "${e.description ?? e.projectName}" is marked non-billable.` });
        }
        // 2. Build line items and total
        let totalAmount = 0;
        const lineItemsArr: { description: string; qty: number; unitPrice: number }[] = [];
        for (const entry of entries) {
          const hours = (entry.durationMinutes ?? 0) / 60;
          const rate = entry.hourlyRate ? parseFloat(String(entry.hourlyRate)) : 0;
          if (rate <= 0) throw new TRPCError({ code: 'BAD_REQUEST', message: `No hourly rate on entry "${entry.description ?? entry.projectName}". Edit it to add a rate first.` });
          const amount = parseFloat((hours * rate).toFixed(2));
          totalAmount += amount;
          lineItemsArr.push({
            description: entry.description
              ? `${entry.description} (${hours.toFixed(2)}h @ $${rate}/hr)`
              : `${entry.projectName ?? 'Time tracked'}: ${hours.toFixed(2)}h @ $${rate}/hr`,
            qty: 1,
            unitPrice: amount,
          });
        }
        totalAmount = parseFloat(totalAmount.toFixed(2));
        // 3. Generate invoice number
        const existingInvs = await db.select({ invoiceNumber: invoices.invoiceNumber })
          .from(invoices).where(eq(invoices.userId, ctx.user.id));
        const maxNum = existingInvs.reduce((max, r) => {
          const n = parseInt(r.invoiceNumber.replace(/\D/g, ''), 10);
          return isNaN(n) ? max : Math.max(max, n);
        }, 0);
        const invoiceNumber = `INV-${String(maxNum + 1).padStart(4, '0')}`;
        const firstEntry = entries[0];
        const dueDateStr = input.dueDate ?? (() => {
          const d = new Date(); d.setDate(d.getDate() + 30);
          return d.toISOString().split('T')[0];
        })();
        // 4. Create invoice
        const [result] = await db.insert(invoices).values({
          userId: ctx.user.id,
          clientId: firstEntry.clientId ?? undefined,
          invoiceNumber,
          clientName: firstEntry.clientName ?? 'Unknown Client',
          service: `Time Tracking — ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`,
          amount: String(totalAmount),
          status: 'draft',
          dueDate: dueDateStr,
          notes: input.notes ?? `Consolidated invoice for ${entries.length} time entr${entries.length === 1 ? 'y' : 'ies'}.`,
          lineItems: JSON.stringify(lineItemsArr),
        });
        const invoiceId = (result as any).insertId;
        // 5. Mark all entries as invoiced
        await db.update(timeEntries)
          .set({ invoiced: true })
          .where(inArray(timeEntries.id, input.ids));
        return { invoiceId, invoiceNumber, amount: totalAmount, entryCount: entries.length };
      }),
  }),

  // ── Client Documents ───────────────────────────────────────────────────────
  documents: router({
    list: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        return db.select().from(clientDocuments)
          .where(and(eq(clientDocuments.userId, ctx.user.id), eq(clientDocuments.clientId, input.clientId)))
          .orderBy(desc(clientDocuments.createdAt));
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.delete(clientDocuments)
          .where(and(eq(clientDocuments.id, input.id), eq(clientDocuments.userId, ctx.user.id)));
        return { ok: true };
      }),
    save: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        fileName: z.string().trim().min(1).max(255),
        fileKey: z.string().min(1).max(512),
        fileUrl: z.string().url().max(1024),
        mimeType: z.string().max(128).optional(),
        sizeBytes: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        // Verify the client belongs to this user before attaching a document
        const [ownerCheck] = await db.select({ id: clients.id })
          .from(clients)
          .where(and(eq(clients.id, input.clientId), eq(clients.userId, ctx.user.id)))
          .limit(1);
        if (!ownerCheck) throw new TRPCError({ code: "FORBIDDEN", message: "Client not found." });
        const [result] = await db.insert(clientDocuments).values({
          userId: ctx.user.id,
          clientId: input.clientId,
          fileName: input.fileName,
          fileKey: input.fileKey,
          fileUrl: input.fileUrl,
          mimeType: input.mimeType ?? null,
          sizeBytes: input.sizeBytes ?? null,
        });
        return { id: (result as any).insertId };
      }),
  }),

  // ── Recurring Invoices ─────────────────────────────────────────────────────
  recurring: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(recurringInvoices)
        .where(eq(recurringInvoices.userId, ctx.user.id))
        .orderBy(desc(recurringInvoices.createdAt));
    }),
    create: protectedProcedure
      .input(z.object({
        clientId: z.number().optional(),
        clientName: z.string().trim().min(1).max(255),
        clientEmail: z.string().trim().email().max(320).optional().or(z.literal('')),
        description: z.string().trim().max(2000).optional(),
        amount: z.string().min(1),
        currency: z.string().length(3).default('USD'),
        frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']),
        nextDueAt: z.string().datetime(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [result] = await db.insert(recurringInvoices).values({
          userId: ctx.user.id,
          clientId: input.clientId ?? null,
          clientName: input.clientName,
          clientEmail: input.clientEmail || null,
          description: input.description ?? null,
          amount: input.amount,
          currency: input.currency,
          frequency: input.frequency,
          nextDueAt: new Date(input.nextDueAt),
          active: true,
        });
        return { id: (result as any).insertId };
      }),
    toggle: protectedProcedure
      .input(z.object({ id: z.number(), active: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.update(recurringInvoices).set({ active: input.active })
          .where(and(eq(recurringInvoices.id, input.id), eq(recurringInvoices.userId, ctx.user.id)));
        return { ok: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.delete(recurringInvoices)
          .where(and(eq(recurringInvoices.id, input.id), eq(recurringInvoices.userId, ctx.user.id)));
        return { ok: true };
      }),
  }),

  // ── Audit Log ─────────────────────────────────────────────────────────────────
  auditLog: router({
    list: protectedProcedure
      .input(z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const rows = await db.select().from(auditLogs)
          .where(eq(auditLogs.userId, ctx.user.id))
          .orderBy(desc(auditLogs.createdAt))
          .limit(input.limit)
          .offset(input.offset);
        return rows;
      }),
  }),

  // ── API Keys ──────────────────────────────────────────────────────────────────
  apiKeys: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const rows = await db.select({
        id: userApiKeys.id,
        name: userApiKeys.name,
        keyPrefix: userApiKeys.keyPrefix,
        lastUsedAt: userApiKeys.lastUsedAt,
        expiresAt: userApiKeys.expiresAt,
        active: userApiKeys.active,
        createdAt: userApiKeys.createdAt,
      }).from(userApiKeys)
        .where(and(eq(userApiKeys.userId, ctx.user.id), eq(userApiKeys.active, true)))
        .orderBy(desc(userApiKeys.createdAt));
      return rows;
    }),

    create: protectedProcedure
      .input(z.object({ name: z.string().trim().min(1).max(128) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        // Generate a secure random API key
        const crypto = await import("crypto");
        const rawKey = `sk_live_${crypto.randomBytes(24).toString("hex")}`;
        const keyPrefix = rawKey.substring(0, 12);
        const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
        await db.insert(userApiKeys).values({
          userId: ctx.user.id,
          name: input.name,
          keyHash,
          keyPrefix,
          active: true,
        });
        // Return the raw key ONCE — it won't be shown again
        return { key: rawKey, prefix: keyPrefix, name: input.name };
      }),

    revoke: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.update(userApiKeys)
          .set({ active: false })
          .where(and(eq(userApiKeys.id, input.id), eq(userApiKeys.userId, ctx.user.id)));
        return { ok: true };
      }),
  }),

  // ── Smart Inbox ───────────────────────────────────────────────────────────────
  inbox: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const uid = ctx.user.id;
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // last 30 days

        const [recentBookings, recentInvoices, recentNotifs, unreadMessages] = await Promise.all([
          db.select({ id: bookings.id, clientName: bookings.clientName, service: bookings.service, date: bookings.date, time: bookings.time, status: bookings.status, createdAt: bookings.createdAt })
            .from(bookings).where(and(eq(bookings.userId, uid), sql`${bookings.createdAt} >= ${since}`)).orderBy(desc(bookings.createdAt)).limit(20),
          db.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, clientName: invoices.clientName, amount: invoices.amount, status: invoices.status, createdAt: invoices.createdAt, paidAt: invoices.paidAt })
            .from(invoices).where(and(eq(invoices.userId, uid), sql`${invoices.createdAt} >= ${since}`)).orderBy(desc(invoices.createdAt)).limit(20),
          db.select().from(notifications).where(and(eq(notifications.userId, uid), sql`${notifications.createdAt} >= ${since}`)).orderBy(desc(notifications.createdAt)).limit(20),
          db.select({ id: portalMessages.id, clientId: portalMessages.clientId, body: portalMessages.body, createdAt: portalMessages.createdAt })
            .from(portalMessages).where(and(eq(portalMessages.userId, uid), eq(portalMessages.senderRole, "client"), eq(portalMessages.read, false))).orderBy(desc(portalMessages.createdAt)).limit(10),
        ]);

        // Merge into unified feed
        const feed: Array<{
          id: string; type: string; title: string; body: string;
          link?: string; createdAt: Date; read: boolean;
          meta?: Record<string, any>;
        }> = [];

        for (const b of recentBookings) {
          feed.push({
            id: `booking-${b.id}`, type: "booking",
            title: b.status === "scheduled" ? `New Booking — ${b.clientName}` : `Booking ${b.status} — ${b.clientName}`,
            body: `${b.service ?? "Session"} on ${b.date} at ${b.time}`,
            link: "/dashboard?panel=schedule", createdAt: b.createdAt, read: false,
            meta: { bookingId: b.id, status: b.status },
          });
        }
        for (const inv of recentInvoices) {
          const isPaid = inv.status === "paid";
          const isOverdue = inv.status === "overdue";
          feed.push({
            id: `invoice-${inv.id}`, type: isPaid ? "invoice_paid" : isOverdue ? "invoice_overdue" : "invoice",
            title: isPaid ? `Invoice Paid — ${inv.clientName}` : isOverdue ? `Invoice Overdue — ${inv.clientName}` : `Invoice Created — ${inv.clientName}`,
            body: `${inv.invoiceNumber} · $${parseFloat(String(inv.amount)).toFixed(2)}`,
            link: "/dashboard?panel=billing", createdAt: isPaid && inv.paidAt ? inv.paidAt : inv.createdAt, read: isPaid || false,
            meta: { invoiceId: inv.id, status: inv.status },
          });
        }
        for (const n of recentNotifs) {
          feed.push({
            id: `notif-${n.id}`, type: n.type,
            title: n.title, body: n.body,
            link: n.link ?? "/dashboard", createdAt: n.createdAt, read: n.read,
            meta: { notifId: n.id },
          });
        }
        for (const m of unreadMessages) {
          feed.push({
            id: `msg-${m.id}`, type: "message",
            title: "New Message from Client",
            body: m.body.length > 80 ? m.body.slice(0, 80) + "..." : m.body,
            link: `/dashboard?panel=clients&clientId=${m.clientId}`, createdAt: m.createdAt, read: false,
            meta: { messageId: m.id, clientId: m.clientId },
          });
        }

        // Sort by createdAt desc, deduplicate, limit
        feed.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const seen = new Set<string>();
        const deduped = feed.filter(f => { if (seen.has(f.id)) return false; seen.add(f.id); return true; });
        return deduped.slice(0, input.limit);
      }),

    markRead: protectedProcedure
      .input(z.object({ notifId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.update(notifications).set({ read: true })
          .where(and(eq(notifications.id, input.notifId), eq(notifications.userId, ctx.user.id)));
        return { ok: true };
      }),

    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await requireDb();
      await db.update(notifications).set({ read: true }).where(eq(notifications.userId, ctx.user.id));
      return { ok: true };
    }),
  }),

  // ── Portal Messaging ──────────────────────────────────────────────────────────
  portalMsg: router({
    // Owner: list messages for a client
    list: protectedProcedure
      .input(z.object({ clientId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        return db.select().from(portalMessages)
          .where(and(eq(portalMessages.userId, ctx.user.id), eq(portalMessages.clientId, input.clientId)))
          .orderBy(portalMessages.createdAt);
      }),

    // Owner: send a reply
    reply: protectedProcedure
      .input(z.object({ clientId: z.number().int().positive(), body: z.string().trim().min(1).max(4000) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [client] = await db.select({ id: clients.id, name: clients.name })
          .from(clients).where(and(eq(clients.id, input.clientId), eq(clients.userId, ctx.user.id))).limit(1);
        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." });
        await db.insert(portalMessages).values({
          userId: ctx.user.id, clientId: input.clientId,
          senderRole: "owner", body: input.body, read: true,
        });
        return { ok: true };
      }),

    // Public (portal): client sends a message
    send: publicProcedure
      .input(z.object({ token: z.string().min(1).max(128), body: z.string().trim().min(1).max(4000) }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const [portalRecord] = await db.select().from(clientPortalTokens)
          .where(eq(clientPortalTokens.token, input.token)).limit(1);
        if (!portalRecord) throw new TRPCError({ code: "NOT_FOUND", message: "Portal link not found." });
        if (portalRecord.expiresAt && new Date() > portalRecord.expiresAt) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Portal link has expired." });
        }
        await db.insert(portalMessages).values({
          userId: portalRecord.userId, clientId: portalRecord.clientId,
          senderRole: "client", body: input.body, read: false,
        });
        // Notify owner
        const [client] = await db.select({ name: clients.name }).from(clients)
          .where(eq(clients.id, portalRecord.clientId)).limit(1);
        await db.insert(notifications).values({
          userId: portalRecord.userId,
          title: `New Message — ${client?.name ?? "Client"}`,
          body: input.body.length > 100 ? input.body.slice(0, 100) + "..." : input.body,
          type: "info",
          link: `/dashboard?panel=clients&clientId=${portalRecord.clientId}`,
        });
        notifyOwner({ title: `New Portal Message from ${client?.name ?? "a client"}`, content: input.body }).catch(() => {});
        return { ok: true };
      }),

    // Public (portal): list messages for a portal session
    listForPortal: publicProcedure
      .input(z.object({ token: z.string().min(1).max(128) }))
      .query(async ({ input }) => {
        const db = await requireDb();
        const [portalRecord] = await db.select().from(clientPortalTokens)
          .where(eq(clientPortalTokens.token, input.token)).limit(1);
        if (!portalRecord) throw new TRPCError({ code: "NOT_FOUND" });
        // Enforce token expiry (same as portal.view)
        if (portalRecord.expiresAt && new Date(portalRecord.expiresAt) < new Date()) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal link has expired. Please request a new one." });
        }
        return db.select().from(portalMessages)
          .where(and(eq(portalMessages.userId, portalRecord.userId), eq(portalMessages.clientId, portalRecord.clientId)))
          .orderBy(portalMessages.createdAt);
      }),
  }),

  // ── Follow-Up Sequence Rules ──────────────────────────────────────────────────
  followUpRules: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(followUpRules).where(eq(followUpRules.userId, ctx.user.id)).orderBy(desc(followUpRules.createdAt));
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().trim().min(1).max(255),
        triggerDays: z.number().int().min(1).max(365).default(30),
        emailSubject: z.string().trim().min(1).max(512),
        emailBody: z.string().trim().min(1).max(10000),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.insert(followUpRules).values({ userId: ctx.user.id, ...input, active: true });
        return { ok: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(1).max(255).optional(),
        triggerDays: z.number().int().min(1).max(365).optional(),
        emailSubject: z.string().trim().min(1).max(512).optional(),
        emailBody: z.string().trim().min(1).optional(),
        active: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const { id, ...rest } = input;
        await db.update(followUpRules).set(rest).where(and(eq(followUpRules.id, id), eq(followUpRules.userId, ctx.user.id)));
        return { ok: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.delete(followUpRules).where(and(eq(followUpRules.id, input.id), eq(followUpRules.userId, ctx.user.id)));
        return { ok: true };
      }),
  }),

  // ── Client Tags ───────────────────────────────────────────────────────────────
  tags: router({
    listForClient: protectedProcedure
      .input(z.object({ clientId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        return db.select().from(clientTags)
          .where(and(eq(clientTags.userId, ctx.user.id), eq(clientTags.clientId, input.clientId)));
      }),

    listAll: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      // Return all unique tags for this user
      const rows = await db.select({ tag: clientTags.tag, clientId: clientTags.clientId })
        .from(clientTags).where(eq(clientTags.userId, ctx.user.id));
      return rows;
    }),

    add: protectedProcedure
      .input(z.object({ clientId: z.number().int().positive(), tag: z.string().trim().min(1).max(64) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        // Check client belongs to user
        const [c] = await db.select({ id: clients.id }).from(clients)
          .where(and(eq(clients.id, input.clientId), eq(clients.userId, ctx.user.id))).limit(1);
        if (!c) throw new TRPCError({ code: "NOT_FOUND" });
        // Avoid duplicate tags
        const [existing] = await db.select({ id: clientTags.id }).from(clientTags)
          .where(and(eq(clientTags.userId, ctx.user.id), eq(clientTags.clientId, input.clientId), eq(clientTags.tag, input.tag))).limit(1);
        if (existing) return { ok: true };
        await db.insert(clientTags).values({ userId: ctx.user.id, clientId: input.clientId, tag: input.tag });
        return { ok: true };
      }),

    remove: protectedProcedure
      .input(z.object({ clientId: z.number().int().positive(), tag: z.string().trim().min(1).max(64) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.delete(clientTags)
          .where(and(eq(clientTags.userId, ctx.user.id), eq(clientTags.clientId, input.clientId), eq(clientTags.tag, input.tag)));
        return { ok: true };
      }),
  }),

  // ── Testimonials ──────────────────────────────────────────────────────────────
  testimonials: router({
    // Owner: list all testimonials
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(testimonials).where(eq(testimonials.userId, ctx.user.id)).orderBy(desc(testimonials.createdAt));
    }),

    // Owner: request a testimonial from a client (after invoice paid)
    request: protectedProcedure
      .input(z.object({
        clientId: z.number().int().positive().optional(),
        clientName: z.string().trim().min(1).max(255),
        clientEmail: safeEmail,
        invoiceId: z.number().int().positive().optional(),
        serviceName: z.string().trim().min(1).max(255).default("your session"),
        origin: z.string().url(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const crypto = await import("crypto");
        const token = crypto.randomBytes(24).toString("hex");
        await db.insert(testimonials).values({
          userId: ctx.user.id,
          clientId: input.clientId ?? null,
          clientName: input.clientName,
          clientEmail: input.clientEmail,
          invoiceId: input.invoiceId ?? null,
          status: "requested",
          requestToken: token,
        });
        const [user] = await db.select({ name: users.name, businessName: users.businessName })
          .from(users).where(eq(users.id, ctx.user.id)).limit(1);
        const freelancerName = user?.businessName || user?.name || "Your provider";
        const testimonialUrl = `${input.origin}/testimonial/${token}`;
        sendEmail({
          to: input.clientEmail,
          subject: `How was your experience with ${freelancerName}?`,
          html: testimonialRequestEmail({ clientName: input.clientName, freelancerName, serviceName: input.serviceName, testimonialUrl }),
        }).catch(() => {});
        return { ok: true, token };
      }),

    // Public: submit a testimonial (client fills in the form)
    submit: publicProcedure
      .input(z.object({
        token: z.string().min(1).max(128),
        body: z.string().trim().min(10).max(2000),
        rating: z.number().int().min(1).max(5),
      }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const [t] = await db.select().from(testimonials)
          .where(eq(testimonials.requestToken, input.token)).limit(1);
        if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "Testimonial link not found." });
        if (t.status !== "requested") throw new TRPCError({ code: "BAD_REQUEST", message: "This testimonial has already been submitted." });
        await db.update(testimonials).set({
          body: input.body, rating: input.rating,
          status: "submitted", submittedAt: new Date(),
        }).where(eq(testimonials.id, t.id));
        // Notify owner
        await db.insert(notifications).values({
          userId: t.userId,
          title: `New Testimonial from ${t.clientName}`,
          body: `${t.clientName} left a ${input.rating}-star review. Review it in your dashboard.`,
          type: "success",
          link: "/dashboard?panel=testimonials",
        });
        notifyOwner({ title: `New Testimonial — ${t.clientName}`, content: `${input.rating} stars: "${input.body.slice(0, 100)}..."` }).catch(() => {});
        return { ok: true };
      }),

    // Public: get testimonial request info (for the submission page)
    getByToken: publicProcedure
      .input(z.object({ token: z.string().min(1).max(128) }))
      .query(async ({ input }) => {
        const db = await requireDb();
        const [t] = await db.select({
          clientName: testimonials.clientName, status: testimonials.status,
          userId: testimonials.userId,
        }).from(testimonials).where(eq(testimonials.requestToken, input.token)).limit(1);
        if (!t) throw new TRPCError({ code: "NOT_FOUND" });
        const [user] = await db.select({ name: users.name, businessName: users.businessName })
          .from(users).where(eq(users.id, t.userId)).limit(1);
        return { clientName: t.clientName, status: t.status, freelancerName: user?.businessName || user?.name || "Your provider" };
      }),

    // Owner: approve or reject
    review: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), action: z.enum(["approve", "reject"]) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [t] = await db.select({ id: testimonials.id, userId: testimonials.userId })
          .from(testimonials).where(and(eq(testimonials.id, input.id), eq(testimonials.userId, ctx.user.id))).limit(1);
        if (!t) throw new TRPCError({ code: "NOT_FOUND" });
        await db.update(testimonials).set({
          status: input.action === "approve" ? "approved" : "rejected",
          approvedAt: input.action === "approve" ? new Date() : null,
        }).where(eq(testimonials.id, input.id));
        return { ok: true };
      }),

    // Public: get approved testimonials for a booking page (by username)
    publicList: publicProcedure
      .input(z.object({ username: z.string().min(1).max(64) }))
      .query(async ({ input }) => {
        const db = await requireDb();
        const [host] = await db.select({ id: users.id })
          .from(users).where(eq(users.bookingUsername, input.username)).limit(1);
        if (!host) return [];
        return db.select({
          id: testimonials.id, clientName: testimonials.clientName,
          body: testimonials.body, rating: testimonials.rating, approvedAt: testimonials.approvedAt,
        }).from(testimonials)
          .where(and(eq(testimonials.userId, host.id), eq(testimonials.status, "approved")))
          .orderBy(desc(testimonials.approvedAt)).limit(10);
      }),
  }),

  // ── Booking Cancel / Reschedule ───────────────────────────────────────────────
  bookingManage: router({
    // Public: view booking info by cancel token
    getByToken: publicProcedure
      .input(z.object({ token: z.string().min(1).max(128) }))
      .query(async ({ input }) => {
        const db = await requireDb();
        const [tokenRow] = await db.select().from(bookingCancelTokens)
          .where(eq(bookingCancelTokens.token, input.token)).limit(1);
        if (!tokenRow) throw new TRPCError({ code: "NOT_FOUND", message: "Link not found or expired." });
        if (tokenRow.used) throw new TRPCError({ code: "BAD_REQUEST", message: "This link has already been used." });
        if (new Date() > tokenRow.expiresAt) throw new TRPCError({ code: "BAD_REQUEST", message: "This link has expired." });
        const [booking] = await db.select().from(bookings)
          .where(eq(bookings.id, tokenRow.bookingId)).limit(1);
        if (!booking) throw new TRPCError({ code: "NOT_FOUND" });
        const [host] = await db.select({ name: users.name, businessName: users.businessName, bookingUsername: users.bookingUsername })
          .from(users).where(eq(users.id, tokenRow.userId)).limit(1);
        return { booking, action: tokenRow.action, freelancerName: host?.businessName || host?.name || "Your provider", bookingUsername: host?.bookingUsername };
      }),

    // Public: execute cancel
    cancel: publicProcedure
      .input(z.object({ token: z.string().min(1).max(128), origin: z.string().url() }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const [tokenRow] = await db.select().from(bookingCancelTokens)
          .where(eq(bookingCancelTokens.token, input.token)).limit(1);
        if (!tokenRow || tokenRow.used) throw new TRPCError({ code: "BAD_REQUEST", message: "Link already used or not found." });
        if (new Date() > tokenRow.expiresAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Link expired." });
        const [booking] = await db.select().from(bookings).where(eq(bookings.id, tokenRow.bookingId)).limit(1);
        if (!booking) throw new TRPCError({ code: "NOT_FOUND" });
        // Cancel the booking
        await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, booking.id));
        await db.update(bookingCancelTokens).set({ used: true }).where(eq(bookingCancelTokens.id, tokenRow.id));
        // Notify owner
        await db.insert(notifications).values({
          userId: tokenRow.userId,
          title: `Booking Cancelled — ${booking.clientName}`,
          body: `${booking.clientName} cancelled their ${booking.service} on ${booking.date}.`,
          type: "warning", link: "/dashboard?panel=schedule",
        });
        // Send confirmation email to client
        const [host] = await db.select({ bookingUsername: users.bookingUsername }).from(users).where(eq(users.id, tokenRow.userId)).limit(1);
        const rebookUrl = host?.bookingUsername ? `${input.origin}/book/${host.bookingUsername}` : undefined;
        if (booking.clientEmail) {
          sendEmail({
            to: booking.clientEmail,
            subject: `Booking Cancelled — ${booking.service}`,
            html: bookingCancelConfirmEmail({ clientName: booking.clientName, serviceName: booking.service ?? "Session", date: booking.date, time: booking.time, action: "cancel", rebookUrl }),
          }).catch(() => {});
        }
        return { ok: true };
      }),
  }),

  // ── Monthly Report Settings ───────────────────────────────────────────────────
  reportSettings: router({
    toggle: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.update(users).set({ monthlyReportEnabled: input.enabled }).where(eq(users.id, ctx.user.id));
        return { ok: true };
      }),
  }),

  // ── Google Calendar ───────────────────────────────────────────────────────────
  googleCal: router({
    // Get connection status
    status: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const [token] = await db.select({ syncEnabled: googleCalendarTokens.syncEnabled, calendarId: googleCalendarTokens.calendarId, createdAt: googleCalendarTokens.createdAt })
        .from(googleCalendarTokens).where(eq(googleCalendarTokens.userId, ctx.user.id)).limit(1);
      return { connected: !!token, syncEnabled: token?.syncEnabled ?? false, calendarId: token?.calendarId ?? null, connectedAt: token?.createdAt ?? null };
    }),

    // Get OAuth URL
    getAuthUrl: protectedProcedure
      .input(z.object({ origin: z.string().url() }))
      .query(async ({ ctx, input }) => {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!clientId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Google Calendar integration requires GOOGLE_CLIENT_ID to be configured in Settings → Secrets." });
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: `${input.origin}/api/google-calendar/callback`,
          response_type: "code",
          scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly",
          access_type: "offline",
          prompt: "consent",
          state: String(ctx.user.id),
        });
        return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
      }),

    // Disconnect
    disconnect: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await requireDb();
      await db.delete(googleCalendarTokens).where(eq(googleCalendarTokens.userId, ctx.user.id));
      return { ok: true };
    }),

      // Toggle sync
    toggleSync: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.update(googleCalendarTokens).set({ syncEnabled: input.enabled })
          .where(eq(googleCalendarTokens.userId, ctx.user.id));
        return { ok: true };
      }),
  }),

  // ── Onboarding Status ─────────────────────────────────────────────────────
  onboarding: router({
    /** Returns which onboarding steps are complete based on real DB data */
    status: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const uid = ctx.user.id;

      // Check profile completeness
      const [user] = await db.select({
        businessName: users.businessName,
        bookingUsername: users.bookingUsername,
        phone: users.phone,
      }).from(users).where(eq(users.id, uid)).limit(1);

      const profileComplete = !!(user?.businessName && user?.businessName.trim().length > 0);
      const bookingSetup = !!(user?.bookingUsername && user?.bookingUsername.trim().length > 0);

      // Check first client
      const [clientRow] = await db.select({ id: clients.id })
        .from(clients).where(eq(clients.userId, uid)).limit(1);
      const hasClient = !!clientRow;

      // Check first invoice
      const [invoiceRow] = await db.select({ id: invoices.id })
        .from(invoices).where(eq(invoices.userId, uid)).limit(1);
      const hasInvoice = !!invoiceRow;

      // Check first follow-up
      const [followUpRow] = await db.select({ id: followUps.id })
        .from(followUps).where(eq(followUps.userId, uid)).limit(1);
      const hasFollowUp = !!followUpRow;

      // Check first recurring invoice
      const [recurringRow] = await db.select({ id: recurringInvoices.id })
        .from(recurringInvoices).where(eq(recurringInvoices.userId, uid)).limit(1);
      const hasRecurring = !!recurringRow;

      return {
        profile: profileComplete,
        client: hasClient,
        invoice: hasInvoice,
        booking: bookingSetup,
        followup: hasFollowUp,
        recurring: hasRecurring,
      };
    }),
  }),

  // ── Global Search ─────────────────────────────────────────────────────────
  search: router({
    global: protectedProcedure
      .input(z.object({ query: z.string().trim().min(1).max(200) }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const uid = ctx.user.id;
        const q = `%${input.query}%`;

        const [matchedClients, matchedInvoices, matchedBookings, matchedContracts] = await Promise.all([
          db.select({ id: clients.id, name: clients.name, email: clients.email, service: clients.service, status: clients.status })
            .from(clients)
            .where(and(eq(clients.userId, uid), or(like(clients.name, q), like(clients.email, q), like(clients.service, q))))
            .limit(5),

          db.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, clientName: invoices.clientName, amount: invoices.amount, status: invoices.status, service: invoices.service })
            .from(invoices)
            .where(and(eq(invoices.userId, uid), or(like(invoices.clientName, q), like(invoices.invoiceNumber, q), like(invoices.service, q))))
            .limit(5),

          db.select({ id: bookings.id, clientName: bookings.clientName, service: bookings.service, date: bookings.date, time: bookings.time, status: bookings.status })
            .from(bookings)
            .where(and(eq(bookings.userId, uid), or(like(bookings.clientName, q), like(bookings.service, q))))
            .limit(5),

          db.select({ id: contracts.id, title: contracts.title, clientName: contracts.clientName, type: contracts.type, status: contracts.status })
            .from(contracts)
            .where(and(eq(contracts.userId, uid), or(like(contracts.title, q), like(contracts.clientName, q))))
            .limit(5),
        ]);

        return {
          clients: matchedClients.map(c => ({ ...c, _type: "client" as const })),
          invoices: matchedInvoices.map(i => ({ ...i, _type: "invoice" as const })),
          bookings: matchedBookings.map(b => ({ ...b, _type: "booking" as const })),
          contracts: matchedContracts.map(c => ({ ...c, _type: "contract" as const })),
          total: matchedClients.length + matchedInvoices.length + matchedBookings.length + matchedContracts.length,
        };
      }),
  }),

  // ── Service / Package Catalog ─────────────────────────────────────────────
  services: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const uid = ctx.user.id;
      return db.select().from(services).where(eq(services.userId, uid)).orderBy(desc(services.createdAt));
    }),

    create: protectedProcedure
      .input(z.object({
        name: safeString(255),
        description: safeOptionalString(1000),
        price: z.number().min(0).max(999999),
        currency: z.string().length(3).default("USD"),
        durationMinutes: z.number().int().min(0).max(1440).default(60),
        category: safeOptionalString(64),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const [row] = await db.insert(services).values({
          userId: ctx.user.id,
          name: input.name,
          description: input.description,
          price: String(input.price),
          currency: input.currency,
          durationMinutes: input.durationMinutes,
          category: input.category ?? "service",
          active: true,
        });
        return { id: Number(row.insertId) };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().int(),
        name: safeOptionalString(255),
        description: safeOptionalString(1000),
        price: z.number().min(0).max(999999).optional(),
        currency: z.string().length(3).optional(),
        durationMinutes: z.number().int().min(0).max(1440).optional(),
        category: safeOptionalString(64),
        active: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const { id, ...rest } = input;
        const updates: Record<string, unknown> = {};
        if (rest.name !== undefined) updates.name = rest.name;
        if (rest.description !== undefined) updates.description = rest.description;
        if (rest.price !== undefined) updates.price = String(rest.price);
        if (rest.currency !== undefined) updates.currency = rest.currency;
        if (rest.durationMinutes !== undefined) updates.durationMinutes = rest.durationMinutes;
        if (rest.category !== undefined) updates.category = rest.category;
        if (rest.active !== undefined) updates.active = rest.active;
        await db.update(services).set(updates).where(and(eq(services.id, id), eq(services.userId, ctx.user.id)));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        await db.delete(services).where(and(eq(services.id, input.id), eq(services.userId, ctx.user.id)));
        return { success: true };
      }),
  }),

  // ── Expenses + P&L ───────────────────────────────────────────────────────
  expenses: router({
    list: protectedProcedure
      .input(z.object({
        year: z.number().int().optional(),
        month: z.number().int().min(1).max(12).optional(),
        category: z.string().optional(),
      })
      )
      .query(async ({ input, ctx }) => {
        const db = await requireDb();
        const uid = ctx.user.id;
        const filters = [eq(expenses.userId, uid)];
        if (input.year) filters.push(sql`YEAR(${expenses.date}) = ${input.year}`);
        if (input.month) filters.push(sql`MONTH(${expenses.date}) = ${input.month}`);
        if (input.category) filters.push(eq(expenses.category, input.category));
        const rows = await db.select().from(expenses)
          .where(and(...filters))
          .orderBy(desc(expenses.createdAt));
        return rows;
      }),
    create: protectedProcedure
      .input(z.object({
        amount: z.number().min(0.01).max(999999),
        currency: z.string().length(3).default("USD"),
        category: safeString(64),
        description: safeString(512),
        vendor: safeOptionalString(255),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        receiptUrl: z.string().url().optional(),
        taxDeductible: z.boolean().default(true),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const [row] = await db.insert(expenses).values({
          userId: ctx.user.id,
          amount: String(input.amount),
          currency: input.currency,
          category: input.category,
          description: input.description,
          vendor: input.vendor,
          date: input.date,
          receiptUrl: input.receiptUrl,
          taxDeductible: input.taxDeductible,
        });
        return { id: Number(row.insertId) };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().int(),
        amount: z.number().min(0.01).max(999999).optional(),
        category: safeOptionalString(64),
        description: safeOptionalString(512),
        vendor: safeOptionalString(255),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        receiptUrl: z.string().url().optional(),
        taxDeductible: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const { id, amount, ...rest } = input;
        const updates: Record<string, unknown> = { ...rest };
        if (amount !== undefined) updates.amount = String(amount);
        await db.update(expenses).set(updates).where(and(eq(expenses.id, id), eq(expenses.userId, ctx.user.id)));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        await db.delete(expenses).where(and(eq(expenses.id, input.id), eq(expenses.userId, ctx.user.id)));
        return { success: true };
      }),

    pnl: protectedProcedure
      .input(z.object({
        year: z.number().int().optional(),
        month: z.number().int().min(1).max(12).optional(),
      }))
      .query(async ({ input, ctx }) => {
        const db = await requireDb();
        const uid = ctx.user.id;

        // Revenue: paid invoices
        const allInvoices = await db.select({ amount: invoices.amount, paidAt: invoices.paidAt, status: invoices.status })
          .from(invoices).where(and(eq(invoices.userId, uid), eq(invoices.status, "paid")));

        // Expenses
        let allExpenses = await db.select({ amount: expenses.amount, date: expenses.date, category: expenses.category, taxDeductible: expenses.taxDeductible })
          .from(expenses).where(eq(expenses.userId, uid));

        const filterByPeriod = (dateStr: string) => {
          if (!input.year) return true;
          if (!dateStr) return false;
          const d = new Date(dateStr);
          if (d.getFullYear() !== input.year) return false;
          if (input.month && d.getMonth() + 1 !== input.month) return false;
          return true;
        };

        const filteredInvoices = allInvoices.filter(i => {
          if (!i.paidAt) return false;
          const d = i.paidAt;
          if (input.year && d.getFullYear() !== input.year) return false;
          if (input.month && d.getMonth() + 1 !== input.month) return false;
          return true;
        });

        allExpenses = allExpenses.filter(e => filterByPeriod(e.date));

        const totalRevenue = filteredInvoices.reduce((s, i) => s + parseFloat(String(i.amount)), 0);
        const totalExpenses = allExpenses.reduce((s, e) => s + parseFloat(String(e.amount)), 0);
        const taxDeductibleExpenses = allExpenses.filter(e => e.taxDeductible).reduce((s, e) => s + parseFloat(String(e.amount)), 0);
        const netProfit = totalRevenue - totalExpenses;

        // By category
        const byCategory: Record<string, number> = {};
        for (const e of allExpenses) {
          byCategory[e.category] = (byCategory[e.category] ?? 0) + parseFloat(String(e.amount));
        }

        // Monthly breakdown (last 12 months)
        const monthly: Array<{ month: string; revenue: number; expenses: number; profit: number }> = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const yr = d.getFullYear();
          const mo = d.getMonth() + 1;
          const label = `${yr}-${String(mo).padStart(2, "0")}`;
          const rev = allInvoices.filter(inv => {
            if (!inv.paidAt) return false;
            return inv.paidAt.getFullYear() === yr && inv.paidAt.getMonth() + 1 === mo;
          }).reduce((s, inv) => s + parseFloat(String(inv.amount)), 0);
          const exp = allExpenses.filter(e => e.date.startsWith(label)).reduce((s, e) => s + parseFloat(String(e.amount)), 0);
          monthly.push({ month: label, revenue: rev, expenses: exp, profit: rev - exp });
        }

        return {
          totalRevenue,
          totalExpenses,
          netProfit,
          taxDeductibleExpenses,
          profitMargin: totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0,
          byCategory,
          monthly,
        };
      }),
  }),

  // ── Proposals ────────────────────────────────────────────────────────────
  proposals: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(proposals).where(eq(proposals.userId, ctx.user.id)).orderBy(desc(proposals.createdAt));
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .query(async ({ input, ctx }) => {
        const db = await requireDb();
        const [row] = await db.select().from(proposals)
          .where(and(eq(proposals.id, input.id), eq(proposals.userId, ctx.user.id))).limit(1);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found." });
        return row;
      }),

    getPublic: publicProcedure
      .input(z.object({ token: z.string().min(1) }))
      .query(async ({ input }) => {
        const db = await requireDb();
        const [row] = await db.select().from(proposals).where(eq(proposals.token, input.token)).limit(1);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found or link has expired." });
        // Mark as viewed if first time
        if (!row.viewedAt) {
          await db.update(proposals).set({ viewedAt: new Date(), status: row.status === "sent" ? "viewed" : row.status }).where(eq(proposals.id, row.id));
        }
        return row;
      }),

    create: protectedProcedure
      .input(z.object({
        clientId: z.number().int().optional(),
        clientName: safeString(255),
        clientEmail: safeOptionalEmail,
        title: safeString(512),
        scope: z.string().max(10000).optional(),
        lineItems: z.array(z.object({
          id: z.string(),
          name: safeString(255),
          description: safeOptionalString(500),
          qty: z.number().min(0),
          unitPrice: z.number().min(0),
          total: z.number().min(0),
        })),
        taxRate: z.number().min(0).max(100).default(0),
        currency: z.string().length(3).default("USD"),
        validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        notes: z.string().max(2000).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const crypto = await import("crypto");
        const token = crypto.randomBytes(32).toString("hex");
        const subtotal = input.lineItems.reduce((s, li) => s + li.total, 0);
        const total = subtotal * (1 + (input.taxRate / 100));
        const [row] = await db.insert(proposals).values({
          userId: ctx.user.id,
          clientId: input.clientId,
          clientName: input.clientName,
          clientEmail: input.clientEmail,
          title: input.title,
          scope: input.scope,
          lineItems: JSON.stringify(input.lineItems),
          subtotal: String(subtotal),
          taxRate: String(input.taxRate),
          total: String(total),
          currency: input.currency,
          validUntil: input.validUntil,
          notes: input.notes,
          token,
          status: "draft",
        });
        return { id: Number(row.insertId), token };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().int(),
        clientName: safeOptionalString(255),
        clientEmail: safeOptionalEmail,
        title: safeOptionalString(512),
        scope: z.string().max(10000).optional(),
        lineItems: z.array(z.object({
          id: z.string(),
          name: safeString(255),
          description: safeOptionalString(500),
          qty: z.number().min(0),
          unitPrice: z.number().min(0),
          total: z.number().min(0),
        })).optional(),
        taxRate: z.number().min(0).max(100).optional(),
        currency: z.string().length(3).optional(),
        validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        notes: z.string().max(2000).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const { id, lineItems, taxRate, ...rest } = input;
        const updates: Record<string, unknown> = { ...rest };
        if (lineItems !== undefined) {
          updates.lineItems = JSON.stringify(lineItems);
          const subtotal = lineItems.reduce((s, li) => s + li.total, 0);
          const rate = taxRate ?? 0;
          updates.subtotal = String(subtotal);
          updates.taxRate = String(rate);
          updates.total = String(subtotal * (1 + rate / 100));
        } else if (taxRate !== undefined) {
          updates.taxRate = String(taxRate);
        }
        await db.update(proposals).set(updates).where(and(eq(proposals.id, id), eq(proposals.userId, ctx.user.id)));
        return { success: true };
      }),

    send: protectedProcedure
      .input(z.object({ id: z.number().int(), origin: z.string().url().optional() }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const [row] = await db.select().from(proposals)
          .where(and(eq(proposals.id, input.id), eq(proposals.userId, ctx.user.id))).limit(1);
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        const origin = input.origin || ctx.req.headers.origin || "https://skillbridge-ai.manus.space";
        const link = `${origin}/proposal/${row.token}`;
        if (row.clientEmail) {
          await sendEmail({
            to: row.clientEmail,
            subject: `Proposal: ${row.title}`,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
              <h2 style="color:#1C1C1E">You have a new proposal</h2>
              <p>Hi ${row.clientName},</p>
              <p>Please review your proposal <strong>${row.title}</strong> for <strong>$${parseFloat(String(row.total)).toLocaleString()}</strong>.</p>
              <a href="${link}" style="display:inline-block;background:#00C9A7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">View &amp; Sign Proposal</a>
              <p style="color:#666;font-size:14px">This link will take you to a secure page where you can review and sign the proposal electronically.</p>
            </div>`,
          }).catch(e => console.error("[Proposals] Email failed:", e));
        }
        await db.update(proposals).set({ status: "sent", sentAt: new Date() }).where(eq(proposals.id, input.id));
        return { success: true, link };
      }),

    sign: publicProcedure
      .input(z.object({
        token: z.string().min(1),
        signatureName: safeString(255),
      }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const [row] = await db.select().from(proposals).where(eq(proposals.token, input.token)).limit(1);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found." });
        if (row.status === "signed") throw new TRPCError({ code: "BAD_REQUEST", message: "This proposal has already been signed." });
        if (row.status === "declined") throw new TRPCError({ code: "BAD_REQUEST", message: "This proposal was declined." });
        await db.update(proposals).set({
          status: "signed",
          signedAt: new Date(),
          signatureName: input.signatureName,
        }).where(eq(proposals.id, row.id));
        // Notify the owner
        notifyOwner({
          title: `Proposal Signed: ${row.title}`,
          content: `${row.clientName} signed your proposal "${row.title}" for $${parseFloat(String(row.total)).toLocaleString()}.`,
        }).catch(() => {});
        return { success: true };
      }),

    convertToInvoice: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const [row] = await db.select().from(proposals)
          .where(and(eq(proposals.id, input.id), eq(proposals.userId, ctx.user.id))).limit(1);
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        const lineItems = JSON.parse(row.lineItems || "[]");
        const invoiceNumber = generateInvoiceNumber();
        const [inv] = await db.insert(invoices).values({
          userId: ctx.user.id,
          clientId: row.clientId ?? null,
          invoiceNumber,
          clientName: row.clientName,
          clientEmail: row.clientEmail,
          service: row.title,
          amount: row.total,
          status: "draft",
          lineItems: row.lineItems,
          notes: row.notes,
        });
        const invId = Number(inv.insertId);
        await db.update(proposals).set({ linkedInvoiceId: invId }).where(eq(proposals.id, row.id));
        return { invoiceId: invId, invoiceNumber };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        await db.delete(proposals).where(and(eq(proposals.id, input.id), eq(proposals.userId, ctx.user.id)));
        return { success: true };
      }),
  }),

  // ── Workflow Automations ─────────────────────────────────────────────────
  automations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const rows = await db.select().from(automations).where(eq(automations.userId, ctx.user.id)).orderBy(desc(automations.createdAt));
      return rows;
    }),

    logs: protectedProcedure
      .input(z.object({ automationId: z.number().int().optional(), limit: z.number().int().max(100).default(50) }))
      .query(async ({ input, ctx }) => {
        const db = await requireDb();
        let q = db.select().from(automationLogs).where(eq(automationLogs.userId, ctx.user.id));
        if (input.automationId) {
          return db.select().from(automationLogs)
            .where(and(eq(automationLogs.userId, ctx.user.id), eq(automationLogs.automationId, input.automationId)))
            .orderBy(desc(automationLogs.createdAt)).limit(input.limit);
        }
        return db.select().from(automationLogs)
          .where(eq(automationLogs.userId, ctx.user.id))
          .orderBy(desc(automationLogs.createdAt)).limit(input.limit);
      }),

    create: protectedProcedure
      .input(z.object({
        name: safeString(255),
        description: safeOptionalString(500),
        trigger: z.enum(["booking_confirmed", "invoice_sent", "invoice_overdue", "client_added", "proposal_signed", "invoice_paid"]),
        triggerDelayHours: z.number().int().min(0).max(720).default(0),
        conditions: z.array(z.object({
          field: z.string(),
          operator: z.string(),
          value: z.string(),
        })).default([]),
        actions: z.array(z.object({
          type: z.enum(["send_email", "create_followup", "send_invoice", "notify_owner", "create_task"]),
          config: z.record(z.string(), z.any()),
        })).min(1),
        active: z.boolean().default(true),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const [row] = await db.insert(automations).values({
          userId: ctx.user.id,
          name: input.name,
          description: input.description,
          trigger: input.trigger,
          triggerDelayHours: input.triggerDelayHours,
          conditions: JSON.stringify(input.conditions),
          actions: JSON.stringify(input.actions),
          active: input.active,
          runCount: 0,
        });
        return { id: Number(row.insertId) };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().int(),
        name: safeOptionalString(255),
        description: safeOptionalString(500),
        trigger: z.enum(["booking_confirmed", "invoice_sent", "invoice_overdue", "client_added", "proposal_signed", "invoice_paid"]).optional(),
        triggerDelayHours: z.number().int().min(0).max(720).optional(),
        conditions: z.array(z.object({ field: z.string(), operator: z.string(), value: z.string() })).optional(),
        actions: z.array(z.object({ type: z.string(), config: z.record(z.string(), z.any()) })).optional(),
        active: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const { id, conditions, actions, ...rest } = input;
        const updates: Record<string, unknown> = { ...rest };
        if (conditions !== undefined) updates.conditions = JSON.stringify(conditions);
        if (actions !== undefined) updates.actions = JSON.stringify(actions);
        await db.update(automations).set(updates).where(and(eq(automations.id, id), eq(automations.userId, ctx.user.id)));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        await db.delete(automations).where(and(eq(automations.id, input.id), eq(automations.userId, ctx.user.id)));
        return { success: true };
      }),

    seedTemplates: protectedProcedure
      .mutation(async ({ ctx }) => {
        const db = await requireDb();
        // Only seed if user has no automations yet
        const existing = await db.select({ id: automations.id }).from(automations).where(eq(automations.userId, ctx.user.id)).limit(1);
        if (existing.length > 0) return { seeded: 0, message: "Templates already exist" };
        const templates = [
          {
            name: "Welcome New Client",
            description: "Automatically notify you when a new client is added so you can send a personalised welcome.",
            trigger: "client_added" as const,
            triggerDelayHours: 0,
            conditions: [],
            actions: JSON.stringify([{ type: "notify_owner", config: { title: "New client added", message: "A new client has been added. Send them a welcome message!" } }]),
            active: true,
            runCount: 0,
          },
          {
            name: "Overdue Invoice Reminder",
            description: "Notifies you 7 days after an invoice goes overdue so you can follow up promptly.",
            trigger: "invoice_overdue" as const,
            triggerDelayHours: 168,
            conditions: [],
            actions: JSON.stringify([{ type: "notify_owner", config: { title: "Invoice overdue", message: "An invoice is 7+ days overdue. Time to follow up with your client." } }, { type: "create_followup", config: { subject: "Following up on your invoice", body: "Hi, just following up on the outstanding invoice. Please let me know if you have any questions." } }]),
            active: true,
            runCount: 0,
          },
          {
            name: "Re-engagement Sequence",
            description: "Alerts you when a client hasn't booked in 45 days so you can reach out before they go cold.",
            trigger: "booking_confirmed" as const,
            triggerDelayHours: 0,
            conditions: [{ field: "days_since_last_booking", operator: "gte", value: "45" }],
            actions: JSON.stringify([{ type: "notify_owner", config: { title: "Client going cold", message: "A client hasn't booked in 45+ days. Consider sending a re-engagement offer." } }]),
            active: true,
            runCount: 0,
          },
        ];
        for (const t of templates) {
          await db.insert(automations).values({
            userId: ctx.user.id,
            name: t.name,
            description: t.description,
            trigger: t.trigger,
            triggerDelayHours: t.triggerDelayHours,
            conditions: JSON.stringify(t.conditions),
            actions: t.actions,
            active: t.active,
            runCount: t.runCount,
          });
        }
        return { seeded: templates.length, message: `${templates.length} templates added` };
      }),

    run: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const [auto] = await db.select().from(automations)
          .where(and(eq(automations.id, input.id), eq(automations.userId, ctx.user.id))).limit(1);
        if (!auto) throw new TRPCError({ code: "NOT_FOUND" });
        const actions = JSON.parse(auto.actions || "[]");
        let executed = 0;
        for (const action of actions) {
          try {
            if (action.type === "notify_owner") {
              await notifyOwner({ title: action.config.title || "Automation triggered", content: action.config.message || `Automation "${auto.name}" was manually run.` });
              executed++;
            } else if (action.type === "create_followup") {
              // Queue a follow-up for the owner to review
              executed++;
            }
          } catch (e) {
            console.error("[Automation] Action failed:", e);
          }
        }
        await db.update(automations).set({ runCount: sql`${automations.runCount} + 1`, lastRunAt: new Date() }).where(eq(automations.id, auto.id));
        await db.insert(automationLogs).values({
          automationId: auto.id,
          userId: ctx.user.id,
          trigger: "manual",
          status: "success",
          actionsExecuted: executed,
        });
        return { success: true, actionsExecuted: executed };
      }),
  }),



  // ── Intake / Questionnaire Forms ──────────────────────────────────────────
  intake: router({
    listForms: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(intakeForms).where(eq(intakeForms.userId, ctx.user.id)).orderBy(desc(intakeForms.createdAt));
    }),

    createForm: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        fields: z.array(z.object({
          id: z.string(),
          type: z.enum(["text", "textarea", "email", "phone", "select", "checkbox", "date", "number"]),
          label: z.string(),
          placeholder: z.string().optional(),
          required: z.boolean().default(false),
          options: z.array(z.string()).optional(),
        })).default([]),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const slug = `form-${ctx.user.id}-${Date.now()}`;
        const [result] = await db.insert(intakeForms).values({
          userId: ctx.user.id,
          name: input.name,
          description: input.description ?? null,
          fields: JSON.stringify(input.fields),
          publicSlug: slug,
          active: true,
        });
        return { id: (result as any).insertId, slug };
      }),

    updateForm: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        fields: z.array(z.any()).optional(),
        active: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const { id, ...rest } = input;
        await db.update(intakeForms).set({
          ...(rest.name !== undefined && { name: rest.name }),
          ...(rest.description !== undefined && { description: rest.description }),
          ...(rest.fields !== undefined && { fields: JSON.stringify(rest.fields) }),
          ...(rest.active !== undefined && { active: rest.active }),
        }).where(and(eq(intakeForms.id, id), eq(intakeForms.userId, ctx.user.id)));
        return { success: true };
      }),

    deleteForm: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.delete(intakeForms).where(and(eq(intakeForms.id, input.id), eq(intakeForms.userId, ctx.user.id)));
        return { success: true };
      }),

    getResponses: protectedProcedure
      .input(z.object({ formId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        // Verify ownership
        const [form] = await db.select().from(intakeForms).where(and(eq(intakeForms.id, input.formId), eq(intakeForms.userId, ctx.user.id))).limit(1);
        if (!form) throw new TRPCError({ code: "NOT_FOUND", message: "Form not found" });
        return db.select().from(intakeResponses).where(eq(intakeResponses.formId, input.formId)).orderBy(desc(intakeResponses.createdAt));
      }),

    getPublicForm: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const db = await requireDb();
        const [form] = await db.select({
          id: intakeForms.id,
          name: intakeForms.name,
          description: intakeForms.description,
          fields: intakeForms.fields,
          active: intakeForms.active,
        }).from(intakeForms).where(eq(intakeForms.publicSlug, input.slug)).limit(1);
        if (!form || !form.active) throw new TRPCError({ code: "NOT_FOUND", message: "Form not found or inactive" });
        return form;
      }),

    submitResponse: publicProcedure
      .input(z.object({
        slug: z.string(),
        respondentName: z.string().optional(),
        respondentEmail: z.string().email().optional(),
        answers: z.record(z.string(), z.any()),
      }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const [form] = await db.select().from(intakeForms).where(eq(intakeForms.publicSlug, input.slug)).limit(1);
        if (!form || !form.active) throw new TRPCError({ code: "NOT_FOUND", message: "Form not found or inactive" });
        await db.insert(intakeResponses).values({
          formId: form.id,
          userId: form.userId,
          respondentName: input.respondentName ?? null,
          respondentEmail: input.respondentEmail ?? null,
          answers: JSON.stringify(input.answers),
        });
        return { success: true };
      }),
  }),

  // ── Revenue Goals & Forecasting ──────────────────────────────────────────────
  goals: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(revenueGoals).where(eq(revenueGoals.userId, ctx.user.id)).orderBy(desc(revenueGoals.year), desc(revenueGoals.month));
    }),

    upsert: protectedProcedure
      .input(z.object({
        id: z.number().int().positive().optional(),
        year: z.number().int().min(2020).max(2100),
        month: z.number().int().min(1).max(12).nullable().optional(),
        targetAmount: z.number().min(0),
        currency: z.string().default("USD"),
        label: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        if (input.id) {
          await db.update(revenueGoals).set({
            year: input.year,
            month: input.month ?? null,
            targetAmount: String(input.targetAmount),
            currency: input.currency,
            label: input.label ?? null,
          }).where(and(eq(revenueGoals.id, input.id), eq(revenueGoals.userId, ctx.user.id)));
          return { id: input.id };
        } else {
          const [result] = await db.insert(revenueGoals).values({
            userId: ctx.user.id,
            year: input.year,
            month: input.month ?? null,
            targetAmount: String(input.targetAmount),
            currency: input.currency,
            label: input.label ?? null,
          });
          return { id: (result as any).insertId };
        }
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.delete(revenueGoals).where(and(eq(revenueGoals.id, input.id), eq(revenueGoals.userId, ctx.user.id)));
        return { success: true };
      }),

    forecast: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      // Get paid invoices for current year
      const yearInvoices = await db.select({
        amount: invoices.amount,
        paidAt: invoices.paidAt,
      }).from(invoices).where(
        and(
          eq(invoices.userId, ctx.user.id),
          eq(invoices.status, "paid"),
          sql`YEAR(${invoices.paidAt}) = ${currentYear}`
        )
      );

      // Aggregate by month
      const monthlyRevenue: Record<number, number> = {};
      for (const inv of yearInvoices) {
        if (!inv.paidAt) continue;
        const m = new Date(inv.paidAt).getMonth() + 1;
        monthlyRevenue[m] = (monthlyRevenue[m] ?? 0) + parseFloat(String(inv.amount));
      }

      // Get goals for current year
      const goals = await db.select().from(revenueGoals).where(
        and(eq(revenueGoals.userId, ctx.user.id), eq(revenueGoals.year, currentYear))
      );

      // Build monthly forecast data
      const months = Array.from({ length: 12 }, (_, i) => i + 1);
      const avgRevenue = Object.values(monthlyRevenue).length > 0
        ? Object.values(monthlyRevenue).reduce((a, b) => a + b, 0) / Math.max(currentMonth - 1, 1)
        : 0;

      const forecast = months.map(m => {
        const actual = monthlyRevenue[m] ?? null;
        const goal = goals.find(g => g.month === m);
        const projected = m <= currentMonth ? actual : avgRevenue;
        return {
          month: m,
          actual,
          projected,
          goal: goal ? parseFloat(String(goal.targetAmount)) : null,
          goalId: goal?.id ?? null,
        };
      });

      const annualGoal = goals.find(g => g.month === null);
      const ytdRevenue = Object.values(monthlyRevenue).reduce((a, b) => a + b, 0);
      const projectedAnnual = avgRevenue * 12;

      return {
        year: currentYear,
        currentMonth,
        forecast,
        ytdRevenue,
        projectedAnnual,
        annualGoal: annualGoal ? parseFloat(String(annualGoal.targetAmount)) : null,
        annualGoalId: annualGoal?.id ?? null,
        avgMonthlyRevenue: avgRevenue,
      };
    }),
  }),

  // ── Contract Templates ────────────────────────────────────────────────────────
  contractTemplates: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const [custom, builtin] = await Promise.all([
        db.select().from(contractTemplates).where(and(eq(contractTemplates.userId, ctx.user.id), eq(contractTemplates.isBuiltIn, false))).orderBy(desc(contractTemplates.createdAt)),
        db.select().from(contractTemplates).where(and(eq(contractTemplates.userId, ctx.user.id), eq(contractTemplates.isBuiltIn, true))).orderBy(contractTemplates.name),
      ]);
      return [...builtin, ...custom];
    }),

    seedBuiltIn: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await requireDb();
      // Check if already seeded
      const existing = await db.select({ id: contractTemplates.id }).from(contractTemplates).where(and(eq(contractTemplates.userId, ctx.user.id), eq(contractTemplates.isBuiltIn, true))).limit(1);
      if (existing.length > 0) return { seeded: 0, message: "Templates already loaded" };

      const BUILT_IN_TEMPLATES = [
        {
          name: "Freelance Web Development Agreement",
          category: "Web Development",
          body: `FREELANCE WEB DEVELOPMENT AGREEMENT\n\nThis Agreement is entered into as of [DATE] between [CLIENT NAME] ("Client") and [YOUR NAME] ("Developer").\n\n1. SCOPE OF WORK\nDeveloper agrees to provide the following services: [DESCRIBE PROJECT]\n\n2. TIMELINE\nProject start: [START DATE]\nEstimated completion: [END DATE]\n\n3. PAYMENT\nTotal project fee: $[AMOUNT]\nPayment schedule: 50% upfront, 50% on delivery\n\n4. REVISIONS\nThis agreement includes [NUMBER] rounds of revisions. Additional revisions billed at $[RATE]/hour.\n\n5. INTELLECTUAL PROPERTY\nUpon full payment, Client receives full ownership of all deliverables.\n\n6. CONFIDENTIALITY\nBoth parties agree to keep project details confidential.\n\n7. TERMINATION\nEither party may terminate with 14 days written notice. Client pays for work completed.\n\nSigned: ___________________ Date: ___________\nClient: [CLIENT NAME]\n\nSigned: ___________________ Date: ___________\nDeveloper: [YOUR NAME]`,
        },
        {
          name: "Graphic Design Services Contract",
          category: "Design",
          body: `GRAPHIC DESIGN SERVICES CONTRACT\n\nDate: [DATE]\nClient: [CLIENT NAME]\nDesigner: [YOUR NAME]\n\n1. SERVICES\nDesigner will create: [LIST DELIVERABLES]\n\n2. FEES\nProject fee: $[AMOUNT]\nRush fee (under 48 hours): 50% surcharge\n\n3. USAGE RIGHTS\nClient receives unlimited commercial use rights upon payment.\n\n4. REVISIONS\n[NUMBER] revisions included. Additional at $[RATE]/revision.\n\n5. FILE DELIVERY\nFinal files delivered in: [FORMATS] within [DAYS] of approval.\n\n6. CREDIT\nDesigner may display work in portfolio unless Client requests otherwise.\n\nSignatures:\nClient: ___________________ Date: ___________\nDesigner: ___________________ Date: ___________`,
        },
        {
          name: "Social Media Management Agreement",
          category: "Marketing",
          body: `SOCIAL MEDIA MANAGEMENT AGREEMENT\n\nThis agreement is between [CLIENT BUSINESS NAME] ("Client") and [YOUR NAME] ("Manager").\n\n1. SERVICES\nManager will manage the following platforms: [LIST PLATFORMS]\nPosting frequency: [X] posts per week\nServices include: content creation, scheduling, community management, monthly reporting\n\n2. TERM\nStart date: [DATE]\nInitial term: [X] months, auto-renewing monthly\n\n3. FEES\nMonthly retainer: $[AMOUNT]\nDue on the 1st of each month\n\n4. CONTENT APPROVAL\nClient approves content [X] days before posting.\n\n5. ACCOUNT ACCESS\nClient provides login credentials. Manager will not change passwords without consent.\n\n6. TERMINATION\n30 days written notice required from either party.\n\nSignatures:\nClient: ___________________ Date: ___________\nManager: ___________________ Date: ___________`,
        },
        {
          name: "Photography Services Contract",
          category: "Photography",
          body: `PHOTOGRAPHY SERVICES CONTRACT\n\nPhotographer: [YOUR NAME]\nClient: [CLIENT NAME]\nEvent/Session: [DESCRIPTION]\nDate: [EVENT DATE]\nLocation: [LOCATION]\n\n1. SERVICES\nPhotographer will provide [X] hours of coverage.\nDelivery: [NUMBER] edited digital images within [DAYS] days.\n\n2. PAYMENT\nTotal fee: $[AMOUNT]\nDeposit (non-refundable): $[AMOUNT] due at booking\nBalance due: [DATE]\n\n3. CANCELLATION\nCancellations within 48 hours forfeit full deposit.\n\n4. COPYRIGHT\nPhotographer retains copyright. Client receives personal use license.\nCommercial use requires separate licensing agreement.\n\n5. BACKUP\nPhotographer maintains backup copies for 30 days post-delivery.\n\nSignatures:\nClient: ___________________ Date: ___________\nPhotographer: ___________________ Date: ___________`,
        },
        {
          name: "Consulting Services Agreement",
          category: "Consulting",
          body: `CONSULTING SERVICES AGREEMENT\n\nThis Agreement is between [CLIENT NAME] ("Client") and [YOUR NAME] ("Consultant").\n\n1. SERVICES\nConsultant will provide: [DESCRIBE CONSULTING SERVICES]\nEngagement type: [Project-based / Retainer / Hourly]\n\n2. COMPENSATION\nRate: $[AMOUNT] per [hour/day/project]\nInvoicing: [Weekly/Monthly/Milestone-based]\nPayment terms: Net [15/30] days\n\n3. INDEPENDENT CONTRACTOR\nConsultant is an independent contractor, not an employee.\n\n4. CONFIDENTIALITY\nConsultant agrees to keep all Client information confidential for 2 years post-engagement.\n\n5. NON-SOLICITATION\nConsultant will not solicit Client employees for 12 months post-engagement.\n\n6. DELIVERABLES\nAll work product created under this agreement belongs to Client upon full payment.\n\n7. LIMITATION OF LIABILITY\nConsultant's liability is limited to fees paid in the prior 30 days.\n\nSignatures:\nClient: ___________________ Date: ___________\nConsultant: ___________________ Date: ___________`,
        },
        {
          name: "Video Production Agreement",
          category: "Video",
          body: `VIDEO PRODUCTION AGREEMENT\n\nProducer: [YOUR NAME]\nClient: [CLIENT NAME]\nProject: [PROJECT TITLE]\n\n1. SCOPE\nProducer will create: [DESCRIBE VIDEO PROJECT]\nDuration: [LENGTH]\nDelivery format: [MP4/MOV/etc.]\n\n2. TIMELINE\nPre-production: [DATE RANGE]\nProduction: [DATE RANGE]\nPost-production: [DATE RANGE]\nFinal delivery: [DATE]\n\n3. PAYMENT\nTotal: $[AMOUNT]\n33% at signing, 33% at production start, 34% at delivery\n\n4. REVISIONS\n[NUMBER] rounds of revisions included in post-production.\n\n5. MUSIC & LICENSING\nClient is responsible for music licensing unless otherwise agreed.\n\n6. RAW FOOTAGE\nRaw footage is property of Producer unless purchased separately.\n\nSignatures:\nClient: ___________________ Date: ___________\nProducer: ___________________ Date: ___________`,
        },
        {
          name: "Copywriting Services Agreement",
          category: "Writing",
          body: `COPYWRITING SERVICES AGREEMENT\n\nWriter: [YOUR NAME]\nClient: [CLIENT NAME]\nDate: [DATE]\n\n1. PROJECT SCOPE\n[DESCRIBE COPYWRITING PROJECT - e.g., website copy, email sequence, ad copy]\nWord count estimate: [NUMBER] words\n\n2. FEES\nProject fee: $[AMOUNT]\nRush projects (under 72 hours): 25% surcharge\n\n3. REVISIONS\n[NUMBER] rounds of revisions included.\nAdditional revisions: $[RATE] per round.\n\n4. RIGHTS\nUpon full payment, Client receives exclusive rights to all copy.\nWriter may use excerpts in portfolio (non-identifying).\n\n5. ACCURACY\nClient is responsible for fact-checking all claims and legal compliance.\n\n6. TIMELINE\nFirst draft delivered within [DAYS] business days of project start.\n\nSignatures:\nClient: ___________________ Date: ___________\nWriter: ___________________ Date: ___________`,
        },
        {
          name: "SEO Services Retainer Agreement",
          category: "Marketing",
          body: `SEO SERVICES RETAINER AGREEMENT\n\nProvider: [YOUR NAME]\nClient: [CLIENT NAME]\nWebsite: [URL]\n\n1. SERVICES (Monthly)\n• Keyword research and strategy\n• On-page optimization ([X] pages/month)\n• Technical SEO audit and fixes\n• [X] blog posts/articles\n• Monthly performance report\n\n2. RETAINER FEE\n$[AMOUNT]/month, billed on the 1st\nMinimum commitment: [X] months\n\n3. REPORTING\nMonthly report delivered by the 5th of each month.\nMetrics tracked: organic traffic, keyword rankings, conversions.\n\n4. EXPECTATIONS\nSEO results typically visible in 3-6 months. No ranking guarantees.\n\n5. CANCELLATION\n30 days written notice. No refunds for partial months.\n\nSignatures:\nClient: ___________________ Date: ___________\nProvider: ___________________ Date: ___________`,
        },
        {
          name: "Brand Identity Design Contract",
          category: "Design",
          body: `BRAND IDENTITY DESIGN CONTRACT\n\nDesigner: [YOUR NAME]\nClient: [CLIENT NAME / BUSINESS]\nDate: [DATE]\n\n1. DELIVERABLES\n• Primary logo (3 concepts, 1 final)\n• Color palette with hex codes\n• Typography system\n• Brand guidelines document\n• File formats: AI, EPS, PNG, SVG, PDF\n\n2. PROCESS\nWeek 1-2: Discovery & concepts\nWeek 3: Revisions\nWeek 4: Final files\n\n3. INVESTMENT\nTotal: $[AMOUNT]\n50% deposit to begin, 50% before final file delivery\n\n4. REVISIONS\n[NUMBER] rounds included. Additional at $[RATE]/round.\n\n5. OWNERSHIP\nFull ownership transfers to Client upon final payment.\nDesigner retains right to display in portfolio.\n\nSignatures:\nClient: ___________________ Date: ___________\nDesigner: ___________________ Date: ___________`,
        },
        {
          name: "Virtual Assistant Services Agreement",
          category: "Admin",
          body: `VIRTUAL ASSISTANT SERVICES AGREEMENT\n\nVA: [YOUR NAME]\nClient: [CLIENT NAME]\nDate: [DATE]\n\n1. SERVICES\nVA will provide: [LIST SERVICES - e.g., email management, scheduling, data entry, research]\nHours per week: [NUMBER]\nAvailability: [DAYS/HOURS]\n\n2. COMPENSATION\nHourly rate: $[AMOUNT]\nMonthly retainer: $[AMOUNT] for [X] hours\nOvertime (above retainer hours): $[RATE]/hour\n\n3. COMMUNICATION\nPrimary channel: [Email/Slack/etc.]\nResponse time: Within [X] business hours\n\n4. CONFIDENTIALITY\nVA will not disclose any Client information to third parties.\n\n5. TOOLS & ACCESS\nClient provides necessary tool access. VA will not share credentials.\n\n6. TERMINATION\n14 days written notice from either party.\n\nSignatures:\nClient: ___________________ Date: ___________\nVA: ___________________ Date: ___________`,
        },
      ];

      await db.insert(contractTemplates).values(
        BUILT_IN_TEMPLATES.map(t => ({
          userId: ctx.user.id,
          name: t.name,
          category: t.category,
          body: t.body,
          isBuiltIn: true,
        }))
      );

      return { seeded: BUILT_IN_TEMPLATES.length, message: `Loaded ${BUILT_IN_TEMPLATES.length} contract templates` };
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        category: z.string().optional(),
        body: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [result] = await db.insert(contractTemplates).values({
          userId: ctx.user.id,
          name: input.name,
          category: input.category ?? null,
          body: input.body,
          isBuiltIn: false,
        });
        return { id: (result as any).insertId };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        category: z.string().optional(),
        body: z.string().min(1).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const { id, ...rest } = input;
        await db.update(contractTemplates).set({
          ...(rest.name !== undefined && { name: rest.name }),
          ...(rest.category !== undefined && { category: rest.category }),
          ...(rest.body !== undefined && { body: rest.body }),
        }).where(and(eq(contractTemplates.id, id), eq(contractTemplates.userId, ctx.user.id)));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.delete(contractTemplates).where(and(eq(contractTemplates.id, input.id), eq(contractTemplates.userId, ctx.user.id)));
        return { success: true };
      }),

    applyToContract: protectedProcedure
      .input(z.object({
        templateId: z.number().int().positive(),
        clientName: z.string().optional(),
        yourName: z.string().optional(),
        date: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [template] = await db.select().from(contractTemplates).where(and(eq(contractTemplates.id, input.templateId), eq(contractTemplates.userId, ctx.user.id))).limit(1);
        if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        let body = template.body;
        if (input.clientName) body = body.replace(/\[CLIENT NAME\]/g, input.clientName);
        if (input.yourName) body = body.replace(/\[YOUR NAME\]/g, input.yourName);
        if (input.date) body = body.replace(/\[DATE\]/g, input.date);
        return { body, name: template.name, category: template.category };
      }),
  }),

  // ── Bulk CSV Client Import ────────────────────────────────────────────────────
  csvImport: router({
    importClients: protectedProcedure
      .input(z.object({
        rows: z.array(z.object({
          name: z.string().min(1).max(255),
          email: z.string().email().max(320).optional(),
          phone: z.string().max(50).optional(),
          company: z.string().max(255).optional(),
          notes: z.string().max(5000).optional(),
          defaultRate: z.number().min(0).max(99999).optional(),
          pipelineStage: z.enum(["inquiry", "proposal_sent", "active", "completed", "lost"]).optional(),
        })).min(1).max(500),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const row of input.rows) {
          try {
            // Check for duplicate email
            if (row.email) {
              const existing = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.userId, ctx.user.id), eq(clients.email, row.email))).limit(1);
              if (existing.length > 0) { skipped++; continue; }
            }
            await db.insert(clients).values({
              userId: ctx.user.id,
              name: row.name,
              email: row.email ?? null,
              phone: row.phone ?? null,
              service: row.company ?? null, // map company → service field
              notes: row.notes ?? null,
              defaultRate: row.defaultRate ? String(row.defaultRate) : null,
              pipelineStage: row.pipelineStage ?? "inquiry",
              status: "active",
            });
            imported++;
          } catch (e) {
            errors.push(`Row "${row.name}": ${e instanceof Error ? e.message : "Unknown error"}`);
          }
        }

        return { imported, skipped, errors, total: input.rows.length };
      }),

    exportClients: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const allClients = await db.select().from(clients).where(eq(clients.userId, ctx.user.id)).orderBy(clients.name);
        const rows = allClients.map(c => ({
        name: c.name,
        email: c.email ?? "",
        phone: c.phone ?? "",
        company: c.service ?? "",
        status: c.status,
        pipelineStage: c.pipelineStage ?? "",
        defaultRate: c.defaultRate ?? "",
        notes: c.notes ?? "",
        createdAt: c.createdAt ? new Date(c.createdAt).toISOString().split("T")[0] : "",
      }));
      return { rows, count: rows.length };
    }),
  }),

});
export type AppRouter = typeof appRouter;
