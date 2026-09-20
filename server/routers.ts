import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { eq, desc, and, sql, inArray, or, like, isNull, isNotNull, gt, gte, lt, lte, ne, type SQL, type Column, type SQLWrapper } from "drizzle-orm";
import { z } from "zod";
import Stripe from "stripe";
import { createHash, randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import bcrypt from "bcryptjs";
import { generateTotpSecret, verifyTotp, buildOtpAuthUrl, generateBackupCodes, hashBackupCode } from "./totp";
import { parseUserAgent } from "./deviceInfo";
import { hashSessionToken } from "./auth";
import QRCode from "qrcode";
import { publicProcedure, protectedProcedure, staffProcedure, adminProcedure, ownerProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";
import { SUPPORTED_AUTOMATION_ACTIONS } from "./automationEngine";
import { buildAutomationPreview, parseAutomationPreviewActions } from "./automationPreview";
import { buildClientExperiencePreflight } from "./clientExperiencePreflight";
import { strongPasswordSchema } from "./passwordPolicy";
import { calculateJobCosting } from "../shared/jobCosting";
import { users, leads, clients, customerAssets, assetInspectionTemplates, assetInspectionResponses, invoices, bookings, followUps, emailTemplates, clientPulse, platformSettings, passwordResetTokens, inviteCodes, securityEvents, userSessions, clientPortalTokens, calendarFeedTokens, contracts, notifications, timeEntries, clientDocuments, clientCustomFields, clientCustomFieldValues, jobChecklistTemplates, jobChecklistTemplateItems, recurringInvoices, auditLogs, userApiKeys, contactMessages, portalMessages, followUpRules, clientTags, testimonials, bookingCancelTokens, googleCalendarTokens, services, expenses, proposals, automations, automationLogs, intakeForms, intakeResponses, revenueGoals, contractTemplates, jobPhotos, jobs, jobTasks, jobActivities, clientApprovalRequests, teamMembers, staffAvailabilityBlocks, jobAssignments, serviceVisits, recurringServicePlans, integrationConnections, workflowWebhooks, workflowWebhookDeliveries, stripeWebhookEvents, publicPhotoUploadSessions, publicPhotoUploads, workspaceStaffInvites, workspaceStaffMemberships, twoFactorBackupCodes, priceBookItems, jobPhases, smsLoginCodes, inventoryItems, inventoryLocations, inventoryMovements, purchaseOrders, purchaseOrderItems, customReports, serviceVisitTrackLinks } from "../drizzle/schema";
import { registerUser, loginUser, createSessionToken, recordSession, revokeSession, hashPassword, verifyPassword } from "./auth";
import { runGoogleCalendarSyncForUser } from "./googleCalendarSync";
import { recordFailedLogin, isAccountLocked, clearFailedLogins, logSecurityEvent, getClientIp, manualBlockIP, unblockIP, getSecurityStats, allowPasswordResetRequest } from "./security";
import { computeClientPulse, computeAllClientPulses } from "./pulseEngine";
import { PLANS, PLAN_LIST, type PlanId } from "./products";
import { withTimeout } from "./utils";
import { sendSms, normalizePhoneToE164, getSmsDeliveryStatus, wasSmsAcceptedByConfiguredTwilio } from "./_core/sms";
import { allowSmsLoginRequest, generateSmsLoginCode, hashSmsLoginCode, verifySmsLoginCodeHash, SMS_LOGIN_CODE_TTL_MS, SMS_LOGIN_MAX_ATTEMPTS } from "./_core/smsLogin";
import { sendEmail, forgotPasswordEmail, invoiceReminderEmail, bookingConfirmationEmail, invoicePaidEmail, followUpEmail, testimonialRequestEmail, monthlyReportEmail, bookingCancelConfirmEmail, newClientWelcomeEmail, intakeAutoReplyEmail, getEmailDeliveryStatus, wasAcceptedByConfiguredSmtp } from "./_core/email";
import { createPublicUploadToken, hashPublicUploadToken, isOwnerPhotoKeyForType, PUBLIC_UPLOAD_MAX_FILES, PUBLIC_UPLOAD_TTL_MS } from "./photoUploadSecurity";
import { createGoogleOAuthState } from "./googleOAuthState";
import { processDueStripeEvents } from "./stripeWebhook";
import { hasDispatchConflict } from "../shared/operationsPlanning";
import { INTEGRATION_PROVIDERS, integrationCatalog, type IntegrationProvider } from "../shared/integrationCatalog";
import { WORKFLOW_WEBHOOK_EVENTS, parseWebhookEvents } from "../shared/workflowWebhooks";
import { createWebhookSigningSecret, deliverWorkflowWebhookEvent, encryptWebhookSecret, processDueWorkflowWebhookDeliveries, validateWebhookEndpoint } from "./workflowWebhookDelivery";
import { getTrustedPaymentReturnOrigin } from "./paymentReturnOrigin";
import { buildClientCsv } from "./clientCsvExport";
import { buildQuickBooksInvoiceCsv, buildPaymentsCsv, buildMonthlySummaryCsv, summarizeAccounting } from "./accountingExport";
import { buildJobCostCsv, type ExportableJobCostRow } from "./jobCostCsvExport";
import { getProposalPackageSubtotal, normalizeProposalLineItems, parseProposalPackages, type ProposalPackage } from "../shared/proposalPackages";
import { daysUntilProposalExpiry, isProposalExpired } from "../shared/proposalValidity";
import { isClientSafeJobActivityEvent } from "../shared/clientSafeJobActivity";
import { doPublicBookingIntervalsOverlap, getPublishedBookingSchedule, getPublishedBookingServiceCatalog, getPublishedBookingServices, isPublishedPublicBookingSlot, PUBLIC_BOOKING_TIME_SLOTS } from "../shared/publicBookingRules";
import { isValidRecurringServicePlanInput, nextRecurringServiceDate } from "../shared/recurringServicePlans";

// LLM timeout: 25 seconds
const LLM_TIMEOUT_MS = 25_000;

function hoursUntilBooking(date: string, time: string): number | null {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  let normalizedTime = time.trim();
  if (match) {
    let hour = Number(match[1]);
    const minute = match[2];
    if (match[3].toUpperCase() === "PM" && hour !== 12) hour += 12;
    if (match[3].toUpperCase() === "AM" && hour === 12) hour = 0;
    normalizedTime = `${String(hour).padStart(2, "0")}:${minute}`;
  }
  const start = new Date(`${date}T${normalizedTime}:00`);
  return Number.isNaN(start.getTime()) ? null : (start.getTime() - Date.now()) / 3_600_000;
}

function enforceBookingChangeWindow(date: string, time: string) {
  const hours = hoursUntilBooking(date, time);
  if (hours !== null && hours < 24) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Appointments can only be changed up to 24 hours before the scheduled start time." });
  }
}

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

function hashCalendarFeedCredential(credential: string): string {
  return createHash("sha256").update(credential).digest("hex");
}

// ─── Input sanitization helpers ───────────────────────────────────────────────
const safeString = (max = 255) => z.string().trim().min(1).max(max);
const safeOptionalString = (max = 255) => z.string().trim().max(max).optional();
const safeEmail = z.string().trim().email("Invalid email address").max(320);
const safeOptionalEmail = z.string().trim().email("Invalid email address").max(320).optional().or(z.literal(""));
const safeUrl = z.string().url("Invalid URL").max(2048);
export function normalizeStaffInviteEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase() ?? "";
  return normalized || null;
}
function isStaffInviteEmailMatch(invitedEmail: string | null | undefined, candidateEmail: string | null | undefined) {
  const normalizedInviteEmail = normalizeStaffInviteEmail(invitedEmail);
  const normalizedCandidateEmail = normalizeStaffInviteEmail(candidateEmail);
  return Boolean(normalizedInviteEmail && normalizedCandidateEmail && normalizedInviteEmail === normalizedCandidateEmail);
}
function normalizedStaffInviteEmailPredicate(email: string) {
  return sql`lower(trim(${workspaceStaffInvites.email})) = ${email}`;
}
function activeStaffInviteRosterPredicate(invite: Pick<typeof workspaceStaffInvites.$inferSelect, "ownerUserId" | "teamMemberId">) {
  return sql`exists (
    select 1 from ${teamMembers}
    where ${teamMembers.id} = ${invite.teamMemberId}
      and ${teamMembers.userId} = ${invite.ownerUserId}
      and ${teamMembers.active} = ${true}
  )`;
}
const jobWorkspaceStatusSchema = z.enum(["lead", "quoted", "approved", "scheduled", "in_progress", "awaiting_client", "completed", "cancelled"]);
type JobWorkspaceStatus = z.infer<typeof jobWorkspaceStatusSchema>;
const staffWorkspaceRoleSchema = z.enum(["field_member", "operations_manager"]);
type StaffWorkspaceRole = z.infer<typeof staffWorkspaceRoleSchema>;
const proposalLineItemSchema = z.object({
  id: z.string().min(1).max(64),
  name: safeString(255),
  description: safeOptionalString(500),
  qty: z.number().min(0),
  unitPrice: z.number().min(0),
  total: z.number().min(0),
});
const proposalPackageSchema = z.object({
  id: z.string().min(1).max(64),
  name: safeString(255),
  description: safeOptionalString(1000),
  recommended: z.boolean().optional(),
  lineItems: z.array(proposalLineItemSchema).min(1).max(25),
});

async function requireActiveStaffMembership(
  db: Awaited<ReturnType<typeof requireDb>>,
  memberUserId: number,
  ownerUserId: number,
) {
  const [membership] = await db.select({
    id: workspaceStaffMemberships.id,
    ownerUserId: workspaceStaffMemberships.ownerUserId,
    memberUserId: workspaceStaffMemberships.memberUserId,
    teamMemberId: workspaceStaffMemberships.teamMemberId,
    role: workspaceStaffMemberships.role,
    teamMemberName: teamMembers.name,
    rosterRole: teamMembers.role,
    active: teamMembers.active,
  }).from(workspaceStaffMemberships)
    .innerJoin(teamMembers, and(
      eq(workspaceStaffMemberships.teamMemberId, teamMembers.id),
      eq(workspaceStaffMemberships.ownerUserId, teamMembers.userId),
    ))
    .where(and(
      eq(workspaceStaffMemberships.memberUserId, memberUserId),
      eq(workspaceStaffMemberships.ownerUserId, ownerUserId),
      eq(workspaceStaffMemberships.active, true),
      eq(teamMembers.active, true),
    ))
    .limit(1);
  if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "You do not have active staff access to this workspace." });
  return membership;
}

async function getOwnerJobCostReport(
  db: Awaited<ReturnType<typeof requireDb>>,
  userId: number,
  status?: JobWorkspaceStatus,
): Promise<ExportableJobCostRow[]> {
  const filters = [eq(jobs.userId, userId)];
  if (status) filters.push(eq(jobs.status, status));
  const jobRows = await db.select({
    id: jobs.id,
    jobNumber: jobs.jobNumber,
    title: jobs.title,
    status: jobs.status,
    targetDate: jobs.targetDate,
    budgetAmount: jobs.budgetAmount,
    invoiceId: jobs.invoiceId,
    clientName: clients.name,
    updatedAt: jobs.updatedAt,
  }).from(jobs)
    .innerJoin(clients, and(eq(jobs.clientId, clients.id), eq(clients.userId, userId)))
    .where(and(...filters))
    .orderBy(desc(jobs.updatedAt))
    .limit(10_000);
  if (!jobRows.length) return [];

  const jobIds = jobRows.map(row => row.id);
  const invoiceIds = jobRows.flatMap(row => row.invoiceId ? [row.invoiceId] : []);
  const [linkedInvoices, photos, entries, linkedExpenses] = await Promise.all([
    invoiceIds.length ? db.select({ id: invoices.id, amount: invoices.amount }).from(invoices)
      .where(and(eq(invoices.userId, userId), inArray(invoices.id, invoiceIds))) : [],
    db.select({ jobId: jobPhotos.jobId, photoType: jobPhotos.photoType, lineItemAmount: jobPhotos.lineItemAmount }).from(jobPhotos)
      .where(and(eq(jobPhotos.userId, userId), inArray(jobPhotos.jobId, jobIds))),
    db.select({ jobId: timeEntries.jobId, durationMinutes: timeEntries.durationMinutes, hourlyRate: timeEntries.hourlyRate }).from(timeEntries)
      .where(and(eq(timeEntries.userId, userId), inArray(timeEntries.jobId, jobIds))),
    db.select({ jobId: expenses.jobId, amount: expenses.amount }).from(expenses)
      .where(and(eq(expenses.userId, userId), inArray(expenses.jobId, jobIds))),
  ]);
  const invoiceAmounts = new Map(linkedInvoices.map(invoice => [invoice.id, Number(invoice.amount ?? 0)]));
  const receiptCosts = new Map<number, number>();
  for (const photo of photos) if (photo.jobId && photo.photoType === "receipt") receiptCosts.set(photo.jobId, (receiptCosts.get(photo.jobId) ?? 0) + Number(photo.lineItemAmount ?? 0));
  const laborCosts = new Map<number, number>();
  for (const entry of entries) if (entry.jobId) laborCosts.set(entry.jobId, (laborCosts.get(entry.jobId) ?? 0) + ((entry.durationMinutes ?? 0) / 60) * Number(entry.hourlyRate ?? 0));
  const expenseCosts = new Map<number, number>();
  for (const expense of linkedExpenses) if (expense.jobId) expenseCosts.set(expense.jobId, (expenseCosts.get(expense.jobId) ?? 0) + Number(expense.amount ?? 0));

  return jobRows.map(job => {
    const invoiceId = job.invoiceId;
    const hasInvoiceRevenue = invoiceId !== null && invoiceAmounts.has(invoiceId);
    const financials = calculateJobCosting({
      revenue: hasInvoiceRevenue && invoiceId !== null ? invoiceAmounts.get(invoiceId) ?? 0 : Number(job.budgetAmount ?? 0),
      receiptCost: receiptCosts.get(job.id) ?? 0,
      laborCost: laborCosts.get(job.id) ?? 0,
      expenseCost: expenseCosts.get(job.id) ?? 0,
    });
    return {
      jobNumber: job.jobNumber,
      title: job.title,
      clientName: job.clientName,
      status: job.status,
      targetDate: job.targetDate,
      revenueSource: hasInvoiceRevenue ? "Linked invoice" : job.budgetAmount !== null ? "Job budget" : "No revenue basis",
      ...financials,
      updatedAt: job.updatedAt,
    };
  });
}

// ─── Invoice number generator ─────────────────────────────────────────────────
function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `INV-${year}${month}-${randomBytes(5).toString("hex").toUpperCase()}`;
}

function isInvoiceNumberConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("invoices_owner_number_unique_idx") ||
    (message.includes("Duplicate") && message.includes("invoice"));
}

async function withInvoiceNumberRetry<T>(operation: (invoiceNumber: string) => Promise<T>): Promise<{ invoiceNumber: string; result: T }> {
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const invoiceNumber = generateInvoiceNumber();
    try {
      return { invoiceNumber, result: await operation(invoiceNumber) };
    } catch (error) {
      if (!isInvoiceNumberConflict(error) || attempt === maxAttempts - 1) {
        if (isInvoiceNumberConflict(error)) {
          throw new TRPCError({ code: "CONFLICT", message: "Unable to reserve an invoice number. Please retry." });
        }
        throw error;
      }
    }
  }
  throw new TRPCError({ code: "CONFLICT", message: "Unable to reserve an invoice number. Please retry." });
}

// ─── App Router ───────────────────────────────────────────────────────────────
/** Panels an action card can deep-link the owner into (mirrors the client's ActivePanel values). */
type ActivePanelTarget = "billing" | "proposals" | "jobs" | "scheduling";

/**
 * Verify a login two-factor code: TOTP first, then unused backup codes.
 * A matched backup code is consumed (single use). Returns false on any mismatch.
 */
async function verifyTwoFactor(db: Awaited<ReturnType<typeof requireDb>>, userId: number, secret: string | null, code: string): Promise<boolean> {
  const normalized = code.trim();
  if (secret && verifyTotp(secret, normalized)) return true;

  // Backup code path: hash is dash-insensitive so "AB12-CD34" == "ab12cd34".
  const codeHash = hashBackupCode(normalized);
  const candidates = await db.select().from(twoFactorBackupCodes)
    .where(and(eq(twoFactorBackupCodes.userId, userId), isNull(twoFactorBackupCodes.usedAt)));
  const match = candidates.find(c => c.codeHash === codeHash);
  if (!match) return false;
  await db.update(twoFactorBackupCodes).set({ usedAt: new Date() }).where(eq(twoFactorBackupCodes.id, match.id));
  return true;
}

// Validates that a stock movement's item and location both belong to the
// caller before any ledger entry is written.
const requireOwnedStockTargets = async (db: Awaited<ReturnType<typeof requireDb>>, userId: number, itemId: number, locationId: number) => {
  const [[item], [location]] = await Promise.all([
    db.select({ id: inventoryItems.id }).from(inventoryItems).where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.userId, userId))).limit(1),
    db.select({ id: inventoryLocations.id }).from(inventoryLocations).where(and(eq(inventoryLocations.id, locationId), eq(inventoryLocations.userId, userId))).limit(1),
  ]);
  if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Inventory item not found." });
  if (!location) throw new TRPCError({ code: "NOT_FOUND", message: "Stock location not found." });
};

// ─── Custom report builder ──────────────────────────────────────────────────────
// One shared shape for every dataset so the UI can render any report without
// knowing the underlying tables.
export type ReportConfig = {
  dataset: "jobs" | "invoices" | "time_entries" | "expenses" | "proposals";
  metric: string;      // count | value | hours
  groupBy: string;     // none | status | client | month | category
  filters: { status?: string; clientId?: number; category?: string; billable?: boolean; dateFrom?: string; dateTo?: string };
};
export type ReportResult = { keyLabel: string; metricLabel: string; rows: { key: string; value: number }[]; total: number };

const REPORT_METRIC_LABELS: Record<string, string> = { count: "Count", value: "Total value", hours: "Hours" };

type AnyColumn = Column | SQLWrapper;
const sqlMonth = (column: AnyColumn) => sql<string>`DATE_FORMAT(${column}, '%Y-%m')`;

function applyDateRange(filters: ReportConfig["filters"], column: AnyColumn) {
  const conditions = [];
  if (filters.dateFrom) conditions.push(gte(column, filters.dateFrom));
  if (filters.dateTo) conditions.push(lte(column, `${filters.dateTo} 23:59:59`));
  return conditions;
}

const runReportConfig = async (db: Awaited<ReturnType<typeof requireDb>>, userId: number, config: ReportConfig): Promise<ReportResult> => {
  const { dataset, metric, groupBy, filters } = config;
  if (metric !== "count" && metric !== "value" && metric !== "hours") throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown metric." });
  const sumExpr = (column: AnyColumn) => sql<string>`COALESCE(SUM(${column}), 0)`;
  const conditions: SQL[] = [];

  if (dataset === "jobs") {
    const groupColumn = groupBy === "status" ? jobs.status : groupBy === "client" ? clients.name : groupBy === "month" ? sqlMonth(jobs.createdAt) : sql`'All jobs'`;
    const valueExpr = metric === "count" ? sql<string>`COUNT(*)` : sumExpr(jobs.budgetAmount);
    conditions.push(eq(jobs.userId, userId));
    if (filters.status && ["lead", "quoted", "approved", "scheduled", "in_progress", "awaiting_client", "completed", "cancelled"].includes(filters.status)) conditions.push(eq(jobs.status, filters.status as never));
    if (filters.clientId) conditions.push(eq(jobs.clientId, filters.clientId));
    conditions.push(...applyDateRange(filters, jobs.createdAt));
    const rows = await db.select({ key: sql<string>`${groupColumn}`, value: valueExpr })
      .from(jobs).leftJoin(clients, and(eq(jobs.clientId, clients.id), eq(clients.userId, userId)))
      .where(and(...conditions)).groupBy(groupColumn).orderBy(groupColumn);
    const parsed = rows.map(row => ({ key: String(row.key ?? "Unassigned"), value: Number(row.value) }));
    return { keyLabel: groupBy === "client" ? "Client" : groupBy === "status" ? "Status" : groupBy === "month" ? "Month" : "All jobs", metricLabel: metric === "count" ? "Jobs" : "Budgeted value", rows: parsed, total: parsed.reduce((sum, row) => sum + row.value, 0) };
  }

  if (dataset === "invoices") {
    const groupColumn = groupBy === "status" ? invoices.status : groupBy === "client" ? invoices.clientName : groupBy === "month" ? sqlMonth(invoices.createdAt) : sql`'All invoices'`;
    const valueExpr = metric === "count" ? sql<string>`COUNT(*)` : sumExpr(invoices.amount);
    conditions.push(eq(invoices.userId, userId));
    if (filters.status && ["draft", "sent", "paid", "overdue"].includes(filters.status)) conditions.push(eq(invoices.status, filters.status as never));
    if (filters.clientId) conditions.push(eq(invoices.clientId, filters.clientId));
    conditions.push(...applyDateRange(filters, invoices.createdAt));
    const rows = await db.select({ key: sql<string>`${groupColumn}`, value: valueExpr })
      .from(invoices).where(and(...conditions)).groupBy(groupColumn).orderBy(groupColumn);
    const parsed = rows.map(row => ({ key: String(row.key ?? "Unknown"), value: Number(row.value) }));
    return { keyLabel: groupBy === "client" ? "Client" : groupBy === "status" ? "Status" : groupBy === "month" ? "Month" : "All invoices", metricLabel: metric === "count" ? "Invoices" : "Invoiced amount", rows: parsed, total: parsed.reduce((sum, row) => sum + row.value, 0) };
  }

  if (dataset === "time_entries") {
    if (metric !== "count" && metric !== "hours") throw new TRPCError({ code: "BAD_REQUEST", message: "Time reports use the count or hours metric." });
    const groupColumn = groupBy === "client" ? timeEntries.clientName : groupBy === "month" ? sqlMonth(timeEntries.startedAt) : groupBy === "status" ? sql`IFNULL(${timeEntries.projectName}, 'Unassigned')` : sql`'All time'`;
    const valueExpr = metric === "count" ? sql<string>`COUNT(*)` : sql<string>`COALESCE(SUM(${timeEntries.durationMinutes}), 0) / 60`;
    conditions.push(eq(timeEntries.userId, userId));
    // Only finished entries carry a duration; running timers are excluded from aggregates.
    conditions.push(isNotNull(timeEntries.durationMinutes));
    if (filters.clientId) conditions.push(eq(timeEntries.clientId, filters.clientId));
    if (filters.billable !== undefined) conditions.push(eq(timeEntries.billable, filters.billable));
    conditions.push(...applyDateRange(filters, timeEntries.startedAt));
    const rows = await db.select({ key: sql<string>`${groupColumn}`, value: valueExpr })
      .from(timeEntries).where(and(...conditions)).groupBy(groupColumn).orderBy(groupColumn);
    const parsed = rows.map(row => ({ key: String(row.key ?? "Unknown"), value: Number(row.value) }));
    return { keyLabel: groupBy === "client" ? "Client" : groupBy === "month" ? "Month" : groupBy === "status" ? "Project" : "All time", metricLabel: metric === "count" ? "Entries" : "Hours", rows: parsed, total: parsed.reduce((sum, row) => sum + row.value, 0) };
  }

  if (dataset === "expenses") {
    const groupColumn = groupBy === "category" ? expenses.category : groupBy === "month" ? sql`DATE_FORMAT(${expenses.date}, '%Y-%m')` : sql`'All expenses'`;
    const valueExpr = metric === "count" ? sql<string>`COUNT(*)` : sumExpr(expenses.amount);
    conditions.push(eq(expenses.userId, userId));
    if (filters.category) conditions.push(eq(expenses.category, filters.category));
    if (filters.dateFrom) conditions.push(gte(expenses.date, filters.dateFrom));
    if (filters.dateTo) conditions.push(lte(expenses.date, filters.dateTo));
    const rows = await db.select({ key: sql<string>`${groupColumn}`, value: valueExpr })
      .from(expenses).where(and(...conditions)).groupBy(groupColumn).orderBy(groupColumn);
    const parsed = rows.map(row => ({ key: String(row.key ?? "Unknown"), value: Number(row.value) }));
    return { keyLabel: groupBy === "category" ? "Category" : groupBy === "month" ? "Month" : "All expenses", metricLabel: metric === "count" ? "Expenses" : "Spent", rows: parsed, total: parsed.reduce((sum, row) => sum + row.value, 0) };
  }

  // proposals
  const groupColumn = groupBy === "status" ? proposals.status : groupBy === "client" ? proposals.clientName : groupBy === "month" ? sqlMonth(proposals.createdAt) : sql`'All proposals'`;
  const valueExpr = metric === "count" ? sql<string>`COUNT(*)` : sumExpr(proposals.total);
  conditions.push(eq(proposals.userId, userId));
  if (filters.status && ["draft", "sent", "viewed", "signed", "declined"].includes(filters.status)) conditions.push(eq(proposals.status, filters.status as never));
  if (filters.clientId) conditions.push(eq(proposals.clientId, filters.clientId));
  conditions.push(...applyDateRange(filters, proposals.createdAt));
  const rows = await db.select({ key: sql<string>`${groupColumn}`, value: valueExpr })
    .from(proposals).where(and(...conditions)).groupBy(groupColumn).orderBy(groupColumn);
  const parsed = rows.map(row => ({ key: String(row.key ?? "Unknown"), value: Number(row.value) }));
  return { keyLabel: groupBy === "client" ? "Client" : groupBy === "status" ? "Status" : groupBy === "month" ? "Month" : "All proposals", metricLabel: metric === "count" ? "Proposals" : "Proposed value", rows: parsed, total: parsed.reduce((sum, row) => sum + row.value, 0) };
};

const reportConfigSchema = z.object({
  dataset: z.enum(["jobs", "invoices", "time_entries", "expenses", "proposals"]),
  metric: z.enum(["count", "value", "hours"]),
  groupBy: z.enum(["none", "status", "client", "month", "category"]).default("none"),
  filters: z.object({
    status: safeOptionalString(32),
    clientId: z.number().int().positive().optional(),
    category: safeOptionalString(64),
    billable: z.boolean().optional(),
    dateFrom: safeOptionalString(32),
    dateTo: safeOptionalString(32),
  }).default({}),
});

import {
  parseCsv, detectSource, buildAutoMapping,
  extractClientRow, extractServiceRow, analyzeRows,
  normalizeEmail, normalizePhoneDigits,
  type FieldMapping, type ImportTarget, type ExtractedClientRow, type ExtractedServiceRow,
} from "./csvImport";

// ── Migration / data import helpers ─────────────────────────────────────────
const IMPORT_MAX_ROWS = 10_000;
const IMPORT_MAX_CSV_BYTES = 2_000_000;
const CLIENT_IMPORT_FIELDS = ["firstName", "lastName", "company", "name", "email", "phone", "phoneAlt", "service", "notes"] as const;
const SERVICE_IMPORT_FIELDS = ["name", "description", "price", "unit", "category"] as const;

function parseImportFile(csv: string) {
  if (Buffer.byteLength(csv, "utf8") > IMPORT_MAX_CSV_BYTES) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "The file exceeds the 2 MB import limit. Split it and import in parts." });
  }
  const rows = parseCsv(csv);
  if (rows.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "The file needs a header row and at least one data row." });
  const headers = rows[0].map(h => h.trim());
  const dataRows = rows.slice(1);
  if (dataRows.length > IMPORT_MAX_ROWS) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Imports are capped at ${IMPORT_MAX_ROWS.toLocaleString()} rows per run. Split larger files and run the import again.` });
  }
  return { headers, dataRows, detection: detectSource(headers) };
}

/** Accepts the wizard's user mapping (canonical field -> header index) or falls back to auto-mapping. */
function coerceMapping(headers: string[], target: ImportTarget, userMapping?: Record<string, number>): FieldMapping {
  if (!userMapping) return buildAutoMapping(headers, target);
  const allowed = target === "clients" ? CLIENT_IMPORT_FIELDS : SERVICE_IMPORT_FIELDS;
  const mapping: FieldMapping = {};
  for (const field of allowed) {
    const idx = userMapping[field];
    if (typeof idx === "number" && Number.isInteger(idx) && idx >= 0 && idx < headers.length) mapping[field] = idx;
  }
  return mapping;
}

function clientInsertValues(userId: number, record: ExtractedClientRow): typeof clients.$inferInsert {
  const initials = record.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  return {
    userId,
    name: record.name,
    email: record.email || null,
    phone: record.phone || null,
    service: record.service ?? null,
    notes: record.notes ?? null,
    status: "active",
    pipelineStage: "inquiry",
    avatarInitials: initials || record.name.slice(0, 2).toUpperCase(),
  };
}

export const appRouter = router({
  system: systemRouter,

  // ── Two-factor authentication (TOTP) ────────────────────────────────────────
  twoFactor: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      return { enabled: ctx.user.twoFactorEnabled === true } as const;
    }),

    /** Begin setup: generates a new secret (inactive until confirmed) and returns the provisioning URI + QR. */
    setupStart: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await requireDb();
      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
      if (user.twoFactorEnabled) throw new TRPCError({ code: "BAD_REQUEST", message: "Two-factor authentication is already enabled." });

      const secret = generateTotpSecret();
      await db.update(users).set({ twoFactorSecret: secret, twoFactorEnabled: false, updatedAt: new Date() })
        .where(eq(users.id, user.id));
      logSecurityEvent({ eventType: "two_factor_setup_started", severity: "medium", userId: user.id, ip: getClientIp(ctx.req), email: user.email ?? undefined, userAgent: ctx.req.headers["user-agent"] });

      const accountLabel = user.email ?? `user-${user.id}`;
      const otpauthUrl = buildOtpAuthUrl({ secret, accountLabel });
      const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { width: 240, margin: 1 });
      return { secret, otpauthUrl, qrDataUrl } as const;
    }),

    /** Confirm setup with a valid code: enables 2FA and returns single-use backup codes (shown once). */
    setupConfirm: protectedProcedure
      .input(z.object({ code: z.string().regex(/^\d{6}$/) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
        if (!user?.twoFactorSecret) throw new TRPCError({ code: "BAD_REQUEST", message: "Start two-factor setup first." });
        if (user.twoFactorEnabled) throw new TRPCError({ code: "BAD_REQUEST", message: "Two-factor authentication is already enabled." });
        if (!verifyTotp(user.twoFactorSecret, input.code)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "That code didn't match. Check your authenticator app and try again." });
        }

        await db.update(users).set({ twoFactorEnabled: true, updatedAt: new Date() }).where(eq(users.id, user.id));
        // Fresh backup codes on every (re)enable; single-use hashes only, never the codes.
        await db.delete(twoFactorBackupCodes).where(eq(twoFactorBackupCodes.userId, user.id));
        const backupCodes = generateBackupCodes(8);
        await db.insert(twoFactorBackupCodes).values(backupCodes.map(code => ({ userId: user.id, codeHash: hashBackupCode(code) })));
        logSecurityEvent({ eventType: "two_factor_enabled", severity: "high", userId: user.id, ip: getClientIp(ctx.req), email: user.email ?? undefined, userAgent: ctx.req.headers["user-agent"] });
        return { enabled: true, backupCodes } as const;
      }),

    /** Disable 2FA — requires the account password as re-authentication. */
    disable: protectedProcedure
      .input(z.object({ password: z.string().min(1).max(128) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
        if (!user.twoFactorEnabled) throw new TRPCError({ code: "BAD_REQUEST", message: "Two-factor authentication is not enabled." });

        // Re-authenticate with the password before turning off a security factor.
        const passwordOk = user.passwordHash ? await bcrypt.compare(input.password, user.passwordHash) : false;
        if (!passwordOk) throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect password." });

        await db.update(users).set({ twoFactorSecret: null, twoFactorEnabled: false, updatedAt: new Date() }).where(eq(users.id, user.id));
        await db.delete(twoFactorBackupCodes).where(eq(twoFactorBackupCodes.userId, user.id));
        logSecurityEvent({ eventType: "two_factor_disabled", severity: "high", userId: user.id, ip: getClientIp(ctx.req), email: user.email ?? undefined, userAgent: ctx.req.headers["user-agent"] });
        return { enabled: false } as const;
      }),
  }),

  // ── Active sessions (device management) ─────────────────────────────────────
  sessions: router({
    /** All active, unexpired sessions for the account; the current one is flagged. */
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const rows = await db.select().from(userSessions)
        .where(and(
          eq(userSessions.userId, ctx.user.id),
          eq(userSessions.isActive, true),
          gt(userSessions.expiresAt, new Date()),
        ))
        .orderBy(desc(userSessions.createdAt))
        .limit(50);

      const cookieHeader = (ctx.req as any).headers?.["cookie"] ?? "";
      const cookieMatch = String(cookieHeader).match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
      const currentHash = cookieMatch ? hashSessionToken(decodeURIComponent(cookieMatch[1])) : null;

      return rows.map(row => {
        const info = parseUserAgent(row.userAgent);
        return {
          id: row.id,
          ip: row.ip,
          browser: info.browser,
          os: info.os,
          deviceType: info.deviceType,
          isApp: info.isApp,
          createdAt: row.createdAt,
          expiresAt: row.expiresAt,
          isCurrent: currentHash !== null && row.tokenHash === currentHash,
        };
      });
    }),

    /** Revoke every OTHER active session (keeps this device signed in). */
    revokeOthers: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await requireDb();
      const cookieHeader = (ctx.req as any).headers?.["cookie"] ?? "";
      const cookieMatch = String(cookieHeader).match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
      const currentHash = cookieMatch ? hashSessionToken(decodeURIComponent(cookieMatch[1])) : null;

      const result = await db.update(userSessions)
        .set({ isActive: false, invalidatedAt: new Date(), invalidationReason: "owner_revoke" })
        .where(and(
          eq(userSessions.userId, ctx.user.id),
          eq(userSessions.isActive, true),
          currentHash ? ne(userSessions.tokenHash, currentHash) : sql`1 = 1`,
        ));

      const count = result[0]?.affectedRows ?? 0;
      logSecurityEvent({ eventType: "sessions_revoked", severity: "high", userId: ctx.user.id, ip: getClientIp(ctx.req), email: ctx.user.email ?? undefined, details: `Revoked ${count} other session(s)` });
      return { revoked: count } as const;
    }),
  }),

  // ── Auth ──────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query(opts => {
      const user = opts.ctx.user;
      if (!user) return null;
      const isOwner = user.role === "admin";
      // Never expose secret material to the client, even hashed.
      const { passwordHash, twoFactorSecret, ...safeUser } = user;
      return { ...safeUser, isOwner };
    }),

    register: publicProcedure
      .input(z.object({
        name: z.string().trim().min(1).max(255),
        email: safeEmail,
        password: strongPasswordSchema,
        inviteCode: z.string().trim().min(1).max(32),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const db = await requireDb();

          // ── First-run bootstrap ──────────────────────────────────────────
          // A fresh install has no accounts and therefore no admin to mint
          // invite codes, so the deployer-provided BOOTSTRAP_INVITE_CODE
          // creates the first owner account instead. Single-use by
          // construction: it only works while the users table is empty.
          const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
          if (Number(userCount?.count ?? 0) === 0) {
            const bootstrapCode = (process.env.BOOTSTRAP_INVITE_CODE ?? "").trim().toUpperCase();
            if (!bootstrapCode) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "No accounts exist yet. The person deploying TrueAxis HQ must set BOOTSTRAP_INVITE_CODE in the server environment, then register with that code to create the first owner account.",
              });
            }
            if (input.inviteCode.trim().toUpperCase() !== bootstrapCode) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid invite code. Please check and try again." });
            }
            const user = await registerUser({
              name: input.name,
              email: input.email,
              password: input.password,
              role: "admin",
            });
            const token = await createSessionToken(user.id, user.email ?? input.email);
            await recordSession(user.id, token, ctx.req);
            const cookieOptions = getSessionCookieOptions(ctx.req);
            ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
            return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
          }

          // Validate invite code first
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

          // Atomically claim the invite before account creation. The earlier read makes
          // messages helpful, but this write is the final single-use predicate.
          const claimTime = new Date();
          const claimResult = await db.update(inviteCodes).set({ usedAt: claimTime }).where(and(
            eq(inviteCodes.id, invite.id),
            eq(inviteCodes.revoked, false),
            isNull(inviteCodes.usedAt),
            or(isNull(inviteCodes.expiresAt), gt(inviteCodes.expiresAt, claimTime)),
          ));
          if (!claimResult[0].affectedRows) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "This invite code is no longer available." });
          }

          let user;
          try {
            user = await registerUser({
              name: input.name,
              email: input.email,
              password: input.password,
            });
          } catch (error) {
            // No account was created, so restore the tentative claim. A concurrent
            // request cannot have claimed this invite because usedAt is already set.
            await db.update(inviteCodes).set({ usedAt: null }).where(and(
              eq(inviteCodes.id, invite.id),
              isNull(inviteCodes.usedBy),
            ));
            throw error;
          }

          await db.update(inviteCodes).set({ usedBy: user.id }).where(and(
            eq(inviteCodes.id, invite.id),
            isNull(inviteCodes.usedBy),
          ));

          const token = await createSessionToken(user.id, user.email ?? input.email);
          await recordSession(user.id, token, ctx.req);
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
        twoFactorCode: z.string().regex(/^[A-Za-z0-9-]{6,14}$/).optional(),
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
          const db = await requireDb();
          // Two-factor gate — enforced after the password so we never reveal
          // whether an account has 2FA before credentials are proven.
          if (user.twoFactorEnabled) {
            if (!input.twoFactorCode) throw new TRPCError({ code: "UNAUTHORIZED", message: "TWO_FACTOR_CODE_REQUIRED" });
            const ok = await verifyTwoFactor(db, user.id, user.twoFactorSecret ?? null, input.twoFactorCode);
            if (!ok) {
              recordFailedLogin(input.email, ip, ctx.req);
              logSecurityEvent({ eventType: "two_factor_failed", severity: "high", ip, email: input.email, userId: user.id, userAgent: ctx.req.headers["user-agent"] });
              throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid two-factor code." });
            }
          }
          // Successful login — clear failed login counter
          clearFailedLogins(input.email);
          logSecurityEvent({ eventType: "login_success", severity: "low", ip, email: input.email, userId: user.id, userAgent: ctx.req.headers["user-agent"], details: user.twoFactorEnabled ? "Login with 2FA" : undefined });
          // Update lastSignedIn timestamp
          await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
          const token = await createSessionToken(user.id, user.email ?? input.email);
          await recordSession(user.id, token, ctx.req);
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
        twoFactorCode: z.string().regex(/^[A-Za-z0-9-]{6,14}$/).optional(),
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

          // Two-factor gate — same enforcement as the standard login path.
          if (user.twoFactorEnabled) {
            if (!input.twoFactorCode) throw new TRPCError({ code: "UNAUTHORIZED", message: "TWO_FACTOR_CODE_REQUIRED" });
            const ok = await verifyTwoFactor(db, user.id, user.twoFactorSecret ?? null, input.twoFactorCode);
            if (!ok) {
              recordFailedLogin(input.email, ip, ctx.req);
              logSecurityEvent({ eventType: "two_factor_failed", severity: "high", ip, email: input.email, userId: user.id, userAgent: ctx.req.headers["user-agent"], details: "Admin login 2FA failure" });
              throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid two-factor code." });
            }
          }

          // Administrators are managed entirely through the local database role.
          // On an empty installation, the first successful admin login bootstraps the role.
          let isOwner = false;
          if (user.role === "admin") {
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
          await recordSession(user.id, token, ctx.req);
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

    logout: publicProcedure.mutation(async ({ ctx }) => {
      const token = ctx.req.headers.cookie?.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`))?.[1];
      await revokeSession(token, "logout");
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
      return { success: true } as const;
    }),

    revokeAllSessions: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await requireDb();
      const [result] = await db.update(userSessions)
        .set({ isActive: false, invalidatedAt: new Date(), invalidationReason: "owner_requested" })
        .where(and(eq(userSessions.userId, ctx.user.id), eq(userSessions.isActive, true)));
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
      logSecurityEvent({
        eventType: "sessions_revoked",
        severity: "medium",
        userId: ctx.user.id,
        email: ctx.user.email ?? undefined,
        ip: getClientIp(ctx.req),
        userAgent: ctx.req.headers["user-agent"],
        details: "Account owner requested sign-out of active sessions",
      });
      return { success: true, revokedSessionCount: result.affectedRows } as const;
    }),

    forgotPassword: publicProcedure
      .input(z.object({ email: safeEmail, origin: z.string().url().optional() }))
      .mutation(async ({ input, ctx }) => {
        // Always return success to prevent email enumeration
        try {
          const requestIp = getClientIp(ctx.req);
          if (!allowPasswordResetRequest(requestIp)) return { success: true };
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

          // Reset links carry a credential. Restrict their origin rather than
          // reflecting a caller-controlled URL into the email.
          const requestedOrigin = input.origin || ctx.req.headers.origin || "https://trueaxishq.com";
          const origin = getTrustedPaymentReturnOrigin(requestedOrigin) ?? "https://trueaxishq.com";
          const resetUrl = `${origin}/reset-password?token=${token}`;
          const resetEmailResult = await sendEmail({
            to: user.email!,
            subject: "Reset Your TrueAxis HQ Password",
            html: forgotPasswordEmail({ name: user.name || "there", resetUrl }),
          });
          // Also notify owner for audit purposes
          notifyOwner({
            title: "Password Reset Requested",
            content: `A password reset was requested for ${user.email}. ${wasAcceptedByConfiguredSmtp(resetEmailResult) ? "The reset email was accepted by configured SMTP." : "No configured SMTP acceptance was recorded for the reset email."}`,
          }).catch(() => {});

          // Public response remains generic to prevent account enumeration.
        } catch (err) {
          console.error("[Auth] forgotPassword error:", err);
          // Still return success to prevent enumeration
        }
        return { success: true };
      }),

    resetPassword: publicProcedure
      .input(z.object({
        token: z.string().min(1).max(200),
        newPassword: strongPasswordSchema,
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

        // Atomically consume the token before the password mutation. The earlier
        // read supports a helpful recovery message; this write is the final-use
        // predicate that prevents two concurrent submissions using the same link.
        const consumeResult = await db.update(passwordResetTokens).set({ used: true }).where(and(
          eq(passwordResetTokens.id, resetRecord.id),
          eq(passwordResetTokens.used, false),
          gt(passwordResetTokens.expiresAt, new Date()),
        ));
        if (!consumeResult[0].affectedRows) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired reset link. Please request a new one." });
        }

        const newHash = await hashPassword(input.newPassword);
        await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, resetRecord.userId));
        await db.update(userSessions)
          .set({ isActive: false, invalidatedAt: new Date(), invalidationReason: "password_reset" })
          .where(and(eq(userSessions.userId, resetRecord.userId), eq(userSessions.isActive, true)));
        logSecurityEvent({
          eventType: "password_reset",
          severity: "medium",
          userId: resetRecord.userId,
          details: "Password reset completed; active sessions invalidated",
        });

        // Password reset completed
        return { success: true };
      }),

    // ── SMS magic-link login (one-time 6-digit code; env-gated on Twilio) ────
    smsRequest: publicProcedure
      .input(z.object({ phone: z.string().trim().min(7).max(32) }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const ip = getClientIp(ctx.req);
        const phone = normalizePhoneToE164(input.phone);
        // Phone-shape errors are safe to reveal before anything else happens.
        if (!phone) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a valid phone number, e.g. +1 512 555 0100." });
        }
        // Honest global gate: SMS login is inactive until Twilio is configured.
        // This is product configuration, not account information, so stating it
        // does not enable enumeration.
        if (!getSmsDeliveryStatus().configured) {
          throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "SMS_LOGIN_NOT_CONFIGURED" });
        }
        // Rate limits first, silently — a dropped request looks like a sent one.
        if (!allowSmsLoginRequest(ip, phone)) return { success: true };

        const [user] = await db.select({ id: users.id, phone: users.phone })
          .from(users).where(eq(users.phone, phone)).limit(1);
        if (!user) return { success: true }; // silent — don't reveal if the phone belongs to an account

        // Burn any earlier live codes for this user.
        await db.update(smsLoginCodes).set({ used: true })
          .where(and(eq(smsLoginCodes.userId, user.id), eq(smsLoginCodes.used, false)));

        const code = generateSmsLoginCode();
        const expiresAt = new Date(Date.now() + SMS_LOGIN_CODE_TTL_MS);
        await db.insert(smsLoginCodes).values({
          userId: user.id,
          phone,
          codeHash: hashSmsLoginCode(phone, code),
          expiresAt,
          used: false,
        });

        const smsResult = await sendSms({
          to: phone,
          body: `Your TrueAxis HQ sign-in code is ${code}. It expires in 10 minutes. Never share this code.`,
        });
        // A code only "goes out" when Twilio accepted it — otherwise the row
        // stays unconsumed and expires harmlessly.
        if (!wasSmsAcceptedByConfiguredTwilio(smsResult)) {
          logSecurityEvent({ eventType: "sms_login_send_failed", severity: "medium", userId: user.id, ip, details: smsResult.error ?? "Twilio rejected the login code" });
          throw new TRPCError({ code: "BAD_REQUEST", message: "We couldn't send the code right now. Please try again." });
        }
        return { success: true };
      }),

    smsVerify: publicProcedure
      .input(z.object({
        phone: z.string().trim().min(7).max(32),
        code: z.string().regex(/^\d{6}$/),
        twoFactorCode: z.string().regex(/^[A-Za-z0-9-]{6,14}$/).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const ip = getClientIp(ctx.req);
        const phone = normalizePhoneToE164(input.phone);
        if (!phone) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid phone number." });
        }

        const [record] = await db.select()
          .from(smsLoginCodes)
          .where(and(eq(smsLoginCodes.phone, phone), eq(smsLoginCodes.used, false)))
          .orderBy(desc(smsLoginCodes.createdAt))
          .limit(1);

        const burnInvalid = async () => {
          if (!record) return;
          const attempts = (record.attempts ?? 0) + 1;
          if (attempts >= SMS_LOGIN_MAX_ATTEMPTS) {
            await db.update(smsLoginCodes).set({ used: true, attempts }).where(eq(smsLoginCodes.id, record.id));
          } else {
            await db.update(smsLoginCodes).set({ attempts }).where(eq(smsLoginCodes.id, record.id));
          }
        };

        if (!record || new Date() > record.expiresAt) {
          await burnInvalid();
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired code. Please request a new one." });
        }

        const [user] = await db.select().from(users).where(eq(users.id, record.userId)).limit(1);
        if (!user) {
          await burnInvalid();
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired code. Please request a new one." });
        }

        if (!verifySmsLoginCodeHash(phone, input.code, record.codeHash)) {
          await burnInvalid();
          logSecurityEvent({ eventType: "sms_login_code_invalid", severity: "medium", userId: user.id, ip, details: `Attempt ${(record.attempts ?? 0) + 1} of ${SMS_LOGIN_MAX_ATTEMPTS}` });
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid code. Please check the message and try again." });
        }

        // Atomically consume the code — this write is the single-use predicate.
        const consumeResult = await db.update(smsLoginCodes).set({ used: true }).where(and(
          eq(smsLoginCodes.id, record.id),
          eq(smsLoginCodes.used, false),
        ));
        if (!consumeResult[0].affectedRows) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This code has already been used. Please request a new one." });
        }

        // TOTP gate — SMS proves the phone; 2FA still proves the second factor.
        if (user.twoFactorEnabled) {
          if (!input.twoFactorCode) throw new TRPCError({ code: "UNAUTHORIZED", message: "TWO_FACTOR_CODE_REQUIRED" });
          const ok = await verifyTwoFactor(db, user.id, user.twoFactorSecret ?? null, input.twoFactorCode);
          if (!ok) {
            logSecurityEvent({ eventType: "two_factor_failed", severity: "high", ip, userId: user.id, userAgent: ctx.req.headers["user-agent"], details: "During SMS magic-link login" });
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid two-factor code." });
          }
        }

        await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
        logSecurityEvent({ eventType: "sms_login_success", severity: "low", ip, userId: user.id, details: user.twoFactorEnabled ? "SMS login with 2FA" : "SMS login" });
        const token = await createSessionToken(user.id, user.email ?? phone);
        await recordSession(user.id, token, ctx.req);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
      }),

    changePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string().min(1).max(128),
        newPassword: strongPasswordSchema,
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
        const filters = [eq(clients.userId, ctx.user.id)];
        if (input?.search) {
          const searchPattern = `%${input.search}%`;
          filters.push(or(
            like(clients.name, searchPattern),
            like(clients.email, searchPattern),
            like(clients.service, searchPattern),
          )!);
        }
        if (input?.status && input.status !== "all") {
          filters.push(eq(clients.status, input.status));
        }
        const filtered = await db.select().from(clients)
          .where(and(...filters))
          .orderBy(desc(clients.createdAt));
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

    listCustomFields: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(clientCustomFields).where(eq(clientCustomFields.userId, ctx.user.id)).orderBy(clientCustomFields.createdAt);
    }),
    createCustomField: protectedProcedure
      .input(z.object({ label: safeString(100), fieldKey: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{0,99}$/), fieldType: z.enum(["text", "select"]), options: z.array(z.string().trim().min(1).max(100)).max(30).optional() }))
      .mutation(async ({ ctx, input }) => {
        if (input.fieldType === "select" && (!input.options?.length || new Set(input.options).size !== input.options.length)) throw new TRPCError({ code: "BAD_REQUEST", message: "Select fields require unique options." });
        const db = await requireDb();
        const [result] = await db.insert(clientCustomFields).values({ userId: ctx.user.id, label: input.label, fieldKey: input.fieldKey, fieldType: input.fieldType, options: input.fieldType === "select" ? JSON.stringify(input.options) : null });
        return { id: Number(result.insertId) };
      }),
    getCustomFieldValues: protectedProcedure
      .input(z.object({ clientId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const [client] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, input.clientId), eq(clients.userId, ctx.user.id))).limit(1);
        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." });
        return db.select({ fieldId: clientCustomFieldValues.fieldId, value: clientCustomFieldValues.value }).from(clientCustomFieldValues).where(and(eq(clientCustomFieldValues.userId, ctx.user.id), eq(clientCustomFieldValues.clientId, input.clientId)));
      }),
    setCustomFieldValue: protectedProcedure
      .input(z.object({ clientId: z.number().int().positive(), fieldId: z.number().int().positive(), value: z.string().trim().max(2000).nullable() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [[client], [field]] = await Promise.all([
          db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, input.clientId), eq(clients.userId, ctx.user.id))).limit(1),
          db.select().from(clientCustomFields).where(and(eq(clientCustomFields.id, input.fieldId), eq(clientCustomFields.userId, ctx.user.id), eq(clientCustomFields.active, true))).limit(1),
        ]);
        if (!client || !field) throw new TRPCError({ code: "NOT_FOUND", message: "Client or custom field not found." });
        if (field.fieldType === "select" && input.value !== null && !JSON.parse(field.options ?? "[]").includes(input.value)) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose one of the configured options." });
        await db.insert(clientCustomFieldValues).values({ userId: ctx.user.id, clientId: input.clientId, fieldId: input.fieldId, value: input.value }).onDuplicateKeyUpdate({ set: { value: input.value, updatedAt: new Date() } });
        return { ok: true };
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
        const [result] = await db.insert(clients).values({
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
    exportCsv: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const rows = await db.select({
        name: clients.name,
        email: clients.email,
        phone: clients.phone,
        service: clients.service,
        status: clients.status,
        notes: clients.notes,
        createdAt: clients.createdAt,
      }).from(clients)
        .where(eq(clients.userId, ctx.user.id))
        .orderBy(desc(clients.createdAt))
        .limit(10_000);
      return { fileName: `trueaxis-clients-${new Date().toISOString().slice(0, 10)}.csv`, csv: buildClientCsv(rows) };
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

  // ── Customer Assets (private owner operations) ─────────────────────────────
  customerAssets: router({
    list: protectedProcedure
      .input(z.object({ clientId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const [client] = await db.select({ id: clients.id }).from(clients)
          .where(and(eq(clients.id, input.clientId), eq(clients.userId, ctx.user.id))).limit(1);
        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." });
        return db.select().from(customerAssets)
          .where(and(eq(customerAssets.userId, ctx.user.id), eq(customerAssets.clientId, input.clientId)))
          .orderBy(desc(customerAssets.updatedAt));
      }),
    create: protectedProcedure
      .input(z.object({ clientId: z.number().int().positive(), name: safeString(255), assetTag: safeOptionalString(128), functionalLocation: safeOptionalString(255), notes: safeOptionalString(2000) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [client] = await db.select({ id: clients.id }).from(clients)
          .where(and(eq(clients.id, input.clientId), eq(clients.userId, ctx.user.id))).limit(1);
        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." });
        const [result] = await db.insert(customerAssets).values({ userId: ctx.user.id, clientId: input.clientId, name: input.name, assetTag: input.assetTag || null, functionalLocation: input.functionalLocation || null, notes: input.notes || null });
        return { id: Number((result as any).insertId), success: true };
      }),
    update: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), name: safeString(255), assetTag: safeOptionalString(128), functionalLocation: safeOptionalString(255), notes: safeOptionalString(2000) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const result = await db.update(customerAssets).set({
          name: input.name,
          assetTag: input.assetTag || null,
          functionalLocation: input.functionalLocation || null,
          notes: input.notes || null,
          updatedAt: new Date(),
        }).where(and(eq(customerAssets.id, input.id), eq(customerAssets.userId, ctx.user.id)));
        if (!result[0].affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "Customer asset not found." });
        return { success: true };
      }),
    setActive: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), active: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const result = await db.update(customerAssets).set({ active: input.active, updatedAt: new Date() })
          .where(and(eq(customerAssets.id, input.id), eq(customerAssets.userId, ctx.user.id)));
        if (!result[0].affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "Customer asset not found." });
        return { success: true };
      }),
    serviceHistory: protectedProcedure
      .input(z.object({ assetId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const [asset] = await db.select({ id: customerAssets.id, clientId: customerAssets.clientId }).from(customerAssets)
          .where(and(eq(customerAssets.id, input.assetId), eq(customerAssets.userId, ctx.user.id))).limit(1);
        if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Customer asset not found." });
        const linkedJobs = await db.select({
          id: jobs.id,
          jobNumber: jobs.jobNumber,
          title: jobs.title,
          status: jobs.status,
          targetDate: jobs.targetDate,
          completedAt: jobs.completedAt,
          updatedAt: jobs.updatedAt,
        }).from(jobs)
          .where(and(eq(jobs.userId, ctx.user.id), eq(jobs.clientId, asset.clientId), eq(jobs.customerAssetId, asset.id)))
          .orderBy(desc(jobs.updatedAt))
          .limit(50);
        const responseCounts = await db.select({ jobId: assetInspectionResponses.jobId, count: sql<number>`count(*)` }).from(assetInspectionResponses)
          .where(and(eq(assetInspectionResponses.userId, ctx.user.id), eq(assetInspectionResponses.clientId, asset.clientId), eq(assetInspectionResponses.customerAssetId, asset.id)))
          .groupBy(assetInspectionResponses.jobId);
        const countByJob = new Map(responseCounts.map(row => [row.jobId, Number(row.count)]));
        return {
          entries: linkedJobs.map(job => ({
            ...job,
            inspectionResponseCount: countByJob.get(job.id) ?? 0,
          })),
        };
      }),
  }),

  // ── Asset Inspection Templates (private owner operations) ─────────────────
  assetInspectionTemplates: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(assetInspectionTemplates)
        .where(eq(assetInspectionTemplates.userId, ctx.user.id))
        .orderBy(desc(assetInspectionTemplates.updatedAt));
    }),
    create: protectedProcedure
      .input(z.object({
        name: safeString(255),
        fields: z.array(z.object({ id: safeString(64), label: safeString(255), required: z.boolean().default(false) })).min(1).max(50),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        if (new Set(input.fields.map(field => field.id)).size !== input.fields.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Each inspection question needs a unique field ID." });
        }
        const [result] = await db.insert(assetInspectionTemplates).values({
          userId: ctx.user.id,
          name: input.name,
          fields: JSON.stringify(input.fields),
        });
        const id = Number((result as any).insertId);
        await db.update(assetInspectionTemplates).set({ templateFamilyId: id, updatedAt: new Date() })
          .where(and(eq(assetInspectionTemplates.id, id), eq(assetInspectionTemplates.userId, ctx.user.id)));
        return { id, success: true };
      }),
    revise: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        name: safeString(255),
        fields: z.array(z.object({ id: safeString(64), label: safeString(255), required: z.boolean().default(false) })).min(1).max(50),
      }))
      .mutation(async ({ ctx, input }) => {
        if (new Set(input.fields.map(field => field.id)).size !== input.fields.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Each inspection question needs a unique field ID." });
        }
        const db = await requireDb();
        const [source] = await db.select({ id: assetInspectionTemplates.id, templateFamilyId: assetInspectionTemplates.templateFamilyId, version: assetInspectionTemplates.version, active: assetInspectionTemplates.active })
          .from(assetInspectionTemplates)
          .where(and(eq(assetInspectionTemplates.id, input.id), eq(assetInspectionTemplates.userId, ctx.user.id))).limit(1);
        if (!source?.active) throw new TRPCError({ code: "NOT_FOUND", message: "Active inspection template not found." });
        const familyId = source.templateFamilyId ?? source.id;
        let revisionId = 0;
        let revisionVersion = 0;
        await db.transaction(async (tx) => {
          const versions = await tx.select({ version: assetInspectionTemplates.version }).from(assetInspectionTemplates)
            .where(and(eq(assetInspectionTemplates.userId, ctx.user.id), eq(assetInspectionTemplates.templateFamilyId, familyId)));
          const nextVersion = Math.max(source.version, ...versions.map(template => template.version)) + 1;
          const deactivate = await tx.update(assetInspectionTemplates).set({ active: false, templateFamilyId: familyId, updatedAt: new Date() })
            .where(and(eq(assetInspectionTemplates.id, source.id), eq(assetInspectionTemplates.userId, ctx.user.id), eq(assetInspectionTemplates.active, true)));
          if (!deactivate[0].affectedRows) throw new TRPCError({ code: "CONFLICT", message: "This template was just revised. Refresh before trying again." });
          const [result] = await tx.insert(assetInspectionTemplates).values({
            userId: ctx.user.id,
            templateFamilyId: familyId,
            name: input.name,
            version: nextVersion,
            fields: JSON.stringify(input.fields),
            active: true,
          });
          revisionId = Number((result as any).insertId);
          revisionVersion = nextVersion;
        });
        return { id: revisionId, version: revisionVersion, success: true };
      }),
    setActive: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), active: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        if (input.active) {
          const [template] = await db.select({ templateFamilyId: assetInspectionTemplates.templateFamilyId }).from(assetInspectionTemplates)
            .where(and(eq(assetInspectionTemplates.id, input.id), eq(assetInspectionTemplates.userId, ctx.user.id))).limit(1);
          if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Inspection template not found." });
          if (template.templateFamilyId) {
            const [activeRevision] = await db.select({ id: assetInspectionTemplates.id }).from(assetInspectionTemplates)
              .where(and(eq(assetInspectionTemplates.userId, ctx.user.id), eq(assetInspectionTemplates.templateFamilyId, template.templateFamilyId), eq(assetInspectionTemplates.active, true), sql`${assetInspectionTemplates.id} != ${input.id}`)).limit(1);
            if (activeRevision) throw new TRPCError({ code: "CONFLICT", message: "Deactivate the current revision before reactivating this template." });
          }
        }
        const result = await db.update(assetInspectionTemplates).set({ active: input.active, updatedAt: new Date() })
          .where(and(eq(assetInspectionTemplates.id, input.id), eq(assetInspectionTemplates.userId, ctx.user.id)));
        if (!result[0].affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "Inspection template not found." });
        return { success: true };
      }),
  }),

  // ── Asset Inspection Responses (private owner operations) ─────────────────
  assetInspectionResponses: router({
    listForJob: protectedProcedure
      .input(z.object({ jobId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const [job] = await db.select({ id: jobs.id }).from(jobs)
          .where(and(eq(jobs.id, input.jobId), eq(jobs.userId, ctx.user.id))).limit(1);
        if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
        return db.select().from(assetInspectionResponses)
          .where(and(eq(assetInspectionResponses.userId, ctx.user.id), eq(assetInspectionResponses.jobId, input.jobId)))
          .orderBy(desc(assetInspectionResponses.updatedAt));
      }),
    create: protectedProcedure
      .input(z.object({
        jobId: z.number().int().positive(),
        customerAssetId: z.number().int().positive(),
        templateId: z.number().int().positive(),
        responses: z.array(z.object({ fieldId: safeString(64), value: safeOptionalString(4000) })).min(1).max(50),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [job] = await db.select({ id: jobs.id, clientId: jobs.clientId, customerAssetId: jobs.customerAssetId }).from(jobs)
          .where(and(eq(jobs.id, input.jobId), eq(jobs.userId, ctx.user.id))).limit(1);
        if (!job?.clientId) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
        if (job.customerAssetId !== input.customerAssetId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Inspection responses must use the asset linked to this job." });
        }
        const [asset] = await db.select({ id: customerAssets.id }).from(customerAssets)
          .where(and(eq(customerAssets.id, input.customerAssetId), eq(customerAssets.userId, ctx.user.id), eq(customerAssets.clientId, job.clientId))).limit(1);
        if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Customer asset not found for this job." });
        const [template] = await db.select({ id: assetInspectionTemplates.id, version: assetInspectionTemplates.version, fields: assetInspectionTemplates.fields }).from(assetInspectionTemplates)
          .where(and(eq(assetInspectionTemplates.id, input.templateId), eq(assetInspectionTemplates.userId, ctx.user.id), eq(assetInspectionTemplates.active, true))).limit(1);
        if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Active inspection template not found." });
        const templateFieldSchema = z.array(z.object({ id: safeString(64), label: safeString(255), required: z.boolean() })).min(1).max(50);
        let templateFields: z.infer<typeof templateFieldSchema>;
        try {
          templateFields = templateFieldSchema.parse(JSON.parse(template.fields));
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Inspection template fields are invalid." });
        }
        const submittedValues = new Map<string, string>();
        for (const response of input.responses) {
          if (submittedValues.has(response.fieldId)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Each inspection question may be answered once." });
          }
          if (!templateFields.some(field => field.id === response.fieldId)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Inspection answer does not match the selected template." });
          }
          submittedValues.set(response.fieldId, response.value ?? "");
        }
        for (const field of templateFields) {
          if (field.required && !submittedValues.get(field.id)?.trim()) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `A response is required for ${field.label}.` });
          }
        }
        const normalizedResponses = templateFields
          .filter(field => submittedValues.has(field.id))
          .map(field => ({ fieldId: field.id, value: submittedValues.get(field.id) ?? "" }));
        const [result] = await db.insert(assetInspectionResponses).values({ userId: ctx.user.id, jobId: job.id, clientId: job.clientId, customerAssetId: asset.id, templateId: template.id, templateVersion: template.version, templateFields: JSON.stringify(templateFields), responses: JSON.stringify(normalizedResponses) });
        return { id: Number((result as any).insertId), success: true };
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

    /**
     * Accountant-ready financial export: QuickBooks-format invoices CSV,
     * payments-received ledger, and a monthly accrual vs. cash summary.
     * Owner-scoped, date-ranged, hard-capped at 10k rows.
     */
    accountingExport: protectedProcedure
      .input(z.object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD").optional(),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD").optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const conditions = [eq(invoices.userId, ctx.user.id)];
        if (input?.from) conditions.push(gte(invoices.createdAt, new Date(`${input.from}T00:00:00.000Z`)));
        if (input?.to) conditions.push(lte(invoices.createdAt, new Date(`${input.to}T23:59:59.999Z`)));
        const rows = await db.select().from(invoices)
          .where(and(...conditions))
          .orderBy(desc(invoices.createdAt))
          .limit(10_000);
        const stamp = new Date().toISOString().slice(0, 10);
        return {
          fileName: `trueaxis-accounting-${stamp}.csv`,
          quickBooksInvoicesCsv: buildQuickBooksInvoiceCsv(rows),
          paymentsCsv: buildPaymentsCsv(rows),
          monthlySummaryCsv: buildMonthlySummaryCsv(rows),
          summary: summarizeAccounting(rows),
        } as const;
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
        const [result] = await db.insert(invoices).values({
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
            const origin = process.env.SITE_ORIGIN || process.env.VITE_SITE_URL || "https://trueaxishq.com";
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
          emailSent = wasAcceptedByConfiguredSmtp(result);
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
        const requestedOrigin = input.origin || ctx.req.headers.origin || process.env.SITE_ORIGIN || "https://trueaxishq.com";
        const origin = getTrustedPaymentReturnOrigin(requestedOrigin);
        if (!origin) throw new TRPCError({ code: "BAD_REQUEST", message: "Use an official TrueAxis HQ origin to continue to Checkout." });
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
                description: `Invoice #${inv.invoiceNumber} from ${ctx.user.name || "TrueAxis HQ"}`,
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
          // Only the verified webhook may mark an invoice paid. The return marker
          // prompts the dashboard to refresh; it never carries authority to alter
          // a financial record from a client-controlled URL.
          success_url: `${origin}/dashboard?panel=invoices&payment_returned=1`,
          cancel_url: `${origin}/dashboard?panel=invoices`,
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
        const { invoiceNumber, result } = await withInvoiceNumberRetry(invoiceNumber => db.insert(invoices).values({
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
        }));
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
        const emailResult = await sendEmail({
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
        return { success: true, emailSent: wasAcceptedByConfiguredSmtp(emailResult) };
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
          .where(and(eq(invoices.id, input.id), eq(invoices.userId, ctx.user.id)));
        return { token, payUrl, invoiceId: input.id };
      }),
    payByToken: publicProcedure
      .input(z.object({ token: z.string().min(1).max(128) }))
      .query(async ({ input }) => {
        const db = await requireDb();
        // Journey continuation: one joined query brings the owner's public booking
        // username along; the internal owner id is never selected or returned.
        const [row] = await db.select({
          invoiceNumber: invoices.invoiceNumber,
          clientName: invoices.clientName,
          service: invoices.service,
          amount: invoices.amount,
          currency: sql<string>`'usd'`,
          status: invoices.status,
          dueDate: invoices.dueDate,
          notes: invoices.notes,
          bookingUsername: users.bookingUsername,
        }).from(invoices)
          .leftJoin(users, eq(users.id, invoices.userId))
          .where(eq(invoices.payLinkToken, input.token)).limit(1);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Payment link not found or expired" });
        const { bookingUsername, ...publicInvoice } = row;
        const bookingUrl = bookingUsername ? `/book/${bookingUsername}` : null;
        if (row.status === "paid") return { invoice: publicInvoice, alreadyPaid: true, bookingUrl };
        return { invoice: publicInvoice, alreadyPaid: false, bookingUrl };
      }),
    createStripePaymentForToken: publicProcedure
      .input(z.object({ token: z.string().min(1).max(128), origin: z.string().url() }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const returnOrigin = getTrustedPaymentReturnOrigin(input.origin);
        if (!returnOrigin) throw new TRPCError({ code: "BAD_REQUEST", message: "Use the official TrueAxis HQ payment link to continue." });
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
          success_url: `${returnOrigin}/pay/${input.token}?payment_returned=1`,
          cancel_url: `${returnOrigin}/pay/${input.token}`,
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
        const [result] = await db.insert(bookings).values({
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
          slotKey: `${ctx.user.id}|${input.date}|${input.time}`,
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
        const [booking] = await db.select({ date: bookings.date, time: bookings.time })
          .from(bookings).where(and(eq(bookings.id, input.id), eq(bookings.userId, ctx.user.id))).limit(1);
        if (!booking) throw new TRPCError({ code: "NOT_FOUND" });
        await db.update(bookings).set({
          status: input.status,
          slotKey: input.status === "scheduled" ? `${ctx.user.id}|${booking.date}|${booking.time}` : null,
          reminderSentAt: input.status === "scheduled" ? null : undefined,
          checkInSentAt: input.status === "scheduled" ? null : undefined,
          updatedAt: new Date(),
        })
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

        const [result] = await db.insert(followUps).values({
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
        const emailResult = await sendEmail({
          to: fu.clientEmail as string,
          subject: fu.subject ?? "",
          html: followUpEmail({ clientName: fu.clientName, subject: fu.subject ?? "", body: fu.body ?? "" }),
        });
        const emailAccepted = wasAcceptedByConfiguredSmtp(emailResult);
        if (emailAccepted) {
          await db.update(followUps).set({ status: "sent", sentAt: new Date() })
            .where(and(eq(followUps.id, fu.id), eq(followUps.userId, ctx.user.id)));
        }
        return { success: true, emailSent: emailAccepted };
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
        const [result] = await db.insert(emailTemplates).values({ userId: ctx.user.id, ...input });
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
        bookingAvailability: getPublishedBookingSchedule(u.bookingAvailability),
      };
    }),

    clientExperiencePreflight: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const [user] = await db.select({
        bookingUsername: users.bookingUsername,
        bookingServices: users.bookingServices,
        businessName: users.businessName,
        businessWebsite: users.businessWebsite,
      }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });

      const [activePortal] = await db.select({ id: clientPortalTokens.id }).from(clientPortalTokens)
        .where(and(
          eq(clientPortalTokens.userId, ctx.user.id),
          eq(clientPortalTokens.revoked, false),
          sql`(${clientPortalTokens.expiresAt} IS NULL OR ${clientPortalTokens.expiresAt} > NOW())`,
        )).limit(1);
      const [automationStats] = await db.select({
        total: sql<number>`COUNT(*)`,
        active: sql<number>`SUM(CASE WHEN ${automations.active} = true THEN 1 ELSE 0 END)`,
      }).from(automations).where(eq(automations.userId, ctx.user.id));
      const email = getEmailDeliveryStatus();
      const services = user.bookingServices ? JSON.parse(user.bookingServices) : [];
      return buildClientExperiencePreflight({
        businessConfigured: Boolean(user.businessName && user.businessWebsite),
        businessName: user.businessName,
        bookingConfigured: Boolean(user.bookingUsername && Array.isArray(services) && services.length > 0),
        bookingUsername: user.bookingUsername,
        serviceCount: Array.isArray(services) ? services.length : 0,
        portalConfigured: Boolean(activePortal),
        paymentsConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
        emailConfigured: email.configured,
        automationCount: Number(automationStats?.total ?? 0),
        activeAutomationCount: Number(automationStats?.active ?? 0),
      });
    }),

    /** First-hour onboarding progress — powers the 'operational in under an hour' guarantee. */
    firstHourProgress: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const [user] = await db.select({
        businessName: users.businessName,
        bookingUsername: users.bookingUsername,
        bookingServices: users.bookingServices,
        createdAt: users.createdAt,
      }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      const [clientCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(clients).where(eq(clients.userId, ctx.user.id));
      const [jobCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(jobs).where(eq(jobs.userId, ctx.user.id));
      const [invoiceCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(invoices).where(eq(invoices.userId, ctx.user.id));
      const services = Array.isArray(user.bookingServices) ? user.bookingServices : (() => { try { return JSON.parse(user.bookingServices || "[]"); } catch { return []; } })();
      const steps = [
        { id: "profile", label: "Add your business name", detail: "Clients see it on invoices, proposals, and the booking page.", minutes: 2, done: Boolean(user.businessName), panel: "settings" },
        { id: "services", label: "Add a service you offer", detail: "These become bookable on your public booking page.", minutes: 3, done: Array.isArray(services) && services.length > 0, panel: "scheduling" },
        { id: "booking", label: "Set your booking handle", detail: user.bookingUsername ? `Live at /book/${user.bookingUsername}` : "Pick the /book/your-handle link you'll share with clients.", minutes: 2, done: Boolean(user.bookingUsername), panel: "scheduling" },
        { id: "client", label: "Add your first client", detail: "One contact is all it takes to start the pipeline.", minutes: 3, done: Number(clientCount.count) > 0, panel: "clients" },
        { id: "job", label: "Schedule your first job", detail: "A day-ticket or a multi-phase project — both work.", minutes: 5, done: Number(jobCount.count) > 0, panel: "scheduling" },
        { id: "invoice", label: "Send your first invoice", detail: "Paid online or on-site — your money keeps moving.", minutes: 5, done: Number(invoiceCount.count) > 0, panel: "billing" },
      ];
      const doneCount = steps.filter(step => step.done).length;
      const remainingMinutes = steps.filter(step => !step.done).reduce((sum, step) => sum + step.minutes, 0);
      // Show the checklist only while it can genuinely help: fresh account, not yet operational.
      const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
      const freshAccount = user.createdAt ? Date.now() - new Date(user.createdAt).getTime() < fourteenDaysMs : true;
      return {
        steps, doneCount, totalSteps: steps.length, remainingMinutes,
        showChecklist: freshAccount && doneCount < steps.length,
      };
    }),

    launchReadiness: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const [user] = await db.select({
        bookingUsername: users.bookingUsername,
        bookingServices: users.bookingServices,
        businessName: users.businessName,
        businessWebsite: users.businessWebsite,
      }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });

      const [activePortal] = await db.select({ id: clientPortalTokens.id }).from(clientPortalTokens)
        .where(and(
          eq(clientPortalTokens.userId, ctx.user.id),
          eq(clientPortalTokens.revoked, false),
          sql`(${clientPortalTokens.expiresAt} IS NULL OR ${clientPortalTokens.expiresAt} > NOW())`,
        )).limit(1);
      const email = getEmailDeliveryStatus();
      const services = user.bookingServices ? JSON.parse(user.bookingServices) : [];
      return {
        email: { configured: email.configured, sender: email.sender, host: email.host, port: email.port, secure: email.secure, issues: email.issues },
        booking: { configured: Boolean(user.bookingUsername && Array.isArray(services) && services.length > 0), username: user.bookingUsername ?? null },
        portal: { configured: Boolean(activePortal) },
        payments: { configured: Boolean(process.env.STRIPE_SECRET_KEY) },
        business: { configured: Boolean(user.businessName && user.businessWebsite), name: user.businessName ?? null },
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
        // Store phones in E.164 so SMS code sign-in can match them exactly.
        // An un-normalizable non-empty phone is rejected rather than silently
        // stored in a form that can never receive sign-in codes.
        let phone: string | null | undefined = input.phone;
        if (input.phone !== undefined) {
          const normalized = normalizePhoneToE164(input.phone);
          if (input.phone !== "" && !normalized) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a valid phone number, e.g. +1 512 555 0100 or +44 20 7946 0098." });
          }
          phone = normalized ?? null;
        }
        await db.update(users).set({ ...input, phone, updatedAt: new Date() }).where(eq(users.id, ctx.user.id));
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
        bookingServices: z.array(z.union([
          z.string().trim().max(100),
          z.object({
            name: z.string().trim().min(1).max(100),
            durationMinutes: z.number().int().min(15).max(480),
            active: z.boolean(),
            priceGuidance: z.string().trim().max(120).nullable(),
            depositAmountCents: z.number().int().min(50).max(500_000).nullable(),
          }),
        ])).max(20).optional(),
        bookingAvailability: z.object({
          weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
          timeSlots: z.array(z.enum(PUBLIC_BOOKING_TIME_SLOTS)).min(1).max(PUBLIC_BOOKING_TIME_SLOTS.length),
          bufferMinutes: z.number().int().min(0).max(120).optional(),
        }).optional(),
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
        if (input.bookingAvailability !== undefined) updateData.bookingAvailability = JSON.stringify(getPublishedBookingSchedule(JSON.stringify(input.bookingAvailability)));
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
        const systemPrompt = `You are TrueAxis HQ Assistant — a smart, friendly business advisor for freelancers and solo service providers. Help users grow their business, manage clients, understand analytics, write follow-up emails, create invoice descriptions, draft contracts, and give actionable advice. Be concise, warm, and practical. ${contextStr} The user's name is ${ctx.user.name ?? "there"}.

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
        const returnOrigin = getTrustedPaymentReturnOrigin(input.origin);
        if (!returnOrigin) throw new TRPCError({ code: "BAD_REQUEST", message: "Use the official TrueAxis HQ checkout to continue." });
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
            success_url: `${returnOrigin}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${returnOrigin}/pricing?cancelled=true`,
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
        const returnOrigin = getTrustedPaymentReturnOrigin(input.origin);
        if (!returnOrigin) throw new TRPCError({ code: "BAD_REQUEST", message: "Use the official TrueAxis HQ billing portal to continue." });
        const db = await requireDb();
        const result = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
        const customerId = result[0]?.stripeCustomerId;
        if (!customerId) throw new TRPCError({ code: "BAD_REQUEST", message: "No billing account found. Please subscribe to a plan first." });
        let portalSession;
        try {
          portalSession = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${returnOrigin}/dashboard`,
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
  // ── Owner-only Stripe recovery evidence ───────────────────────────────────
  stripeRecovery: router({
    list: ownerProcedure.query(async () => {
      const db = await requireDb();
      return db.select({
        id: stripeWebhookEvents.id,
        eventId: stripeWebhookEvents.eventId,
        eventType: stripeWebhookEvents.eventType,
        status: stripeWebhookEvents.status,
        attemptCount: stripeWebhookEvents.attemptCount,
        nextAttemptAt: stripeWebhookEvents.nextAttemptAt,
        lastError: stripeWebhookEvents.lastError,
        completedAt: stripeWebhookEvents.completedAt,
        createdAt: stripeWebhookEvents.processedAt,
      }).from(stripeWebhookEvents).orderBy(desc(stripeWebhookEvents.processedAt)).limit(100);
    }),
    processDue: ownerProcedure
      .input(z.object({ limit: z.number().int().min(1).max(25).default(10) }).optional())
      .mutation(async ({ input }) => processDueStripeEvents(input?.limit ?? 10)),
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
          bookingAvailability: users.bookingAvailability,
          avatarUrl: users.avatarUrl,
        }).from(users).where(eq(users.bookingUsername, input.username)).limit(1);
        if (!result[0]) return null;
        const host = result[0];
        const today = new Date().toISOString().slice(0, 10);
        const publicWindowEnd = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const bookedSlots = await db.select({ date: bookings.date, time: bookings.time })
          .from(bookings)
          .where(and(
            eq(bookings.userId, host.id),
            eq(bookings.status, "scheduled"),
            sql`${bookings.date} >= ${today}`,
            sql`${bookings.date} < ${publicWindowEnd}`,
          ));
        const serviceCatalog = getPublishedBookingServiceCatalog(host.bookingServices).filter(service => service.active);
        return {
          ...host,
          bookingServices: serviceCatalog.map(service => service.name),
          bookingServiceCatalog: serviceCatalog.map(service => ({ name: service.name, durationMinutes: service.durationMinutes, priceGuidance: service.priceGuidance, depositAmountCents: service.depositAmountCents })),
          bookingAvailability: getPublishedBookingSchedule(host.bookingAvailability),
          bookedSlots,
        };
      }),

    submit: publicProcedure
      .input(z.object({
        hostUsername: z.string().trim().min(1).max(100),
        clientName: safeString(100),
        clientEmail: safeEmail,
        clientPhone: z.string().trim().max(32).optional(),
        /** Express consent captured on the booking form: "Text me my confirmation and updates." */
        smsOptIn: z.boolean().optional(),
        service: safeString(200),
        message: z.string().trim().max(1000).optional(),
        preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        preferredTime: z.string().trim().min(1).max(50),
        photoUploadToken: z.string().regex(/^[a-f0-9]{64}$/).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const host = await db.select({ id: users.id, notifyNewBooking: users.notifyNewBooking, bookingUsername: users.bookingUsername, bookingServices: users.bookingServices, bookingAvailability: users.bookingAvailability })
          .from(users).where(eq(users.bookingUsername, input.hostUsername)).limit(1);
        if (!host[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Booking page not found." });

        const hostId = host[0].id;
        if (input.preferredDate < new Date().toISOString().slice(0, 10)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a future appointment date." });
        }
        const selectedService = getPublishedBookingServiceCatalog(host[0].bookingServices).find(service => service.active && service.name === input.service);
        if (!selectedService) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a service currently offered on this booking page." });
        }
        const publishedSchedule = getPublishedBookingSchedule(host[0].bookingAvailability);
        if (!isPublishedPublicBookingSlot(input.preferredDate, input.preferredTime, publishedSchedule)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an available weekday time slot from this booking page." });
        }

        let uploadSession: { id: number } | null = null;
        let uploadedEstimatePhotos: { photoKey: string; photoUrl: string }[] = [];
        if (input.photoUploadToken) {
          const [session] = await db.select().from(publicPhotoUploadSessions)
            .where(and(
              eq(publicPhotoUploadSessions.tokenHash, hashPublicUploadToken(input.photoUploadToken)),
              eq(publicPhotoUploadSessions.userId, hostId),
              eq(publicPhotoUploadSessions.purpose, "booking")
            )).limit(1);
          if (!session || session.consumedAt || new Date() > session.expiresAt) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Your photo-upload session has expired. Please upload again." });
          }
          uploadSession = { id: session.id };
          uploadedEstimatePhotos = await db.select({ photoKey: publicPhotoUploads.photoKey, photoUrl: publicPhotoUploads.photoUrl })
            .from(publicPhotoUploads).where(eq(publicPhotoUploads.sessionId, session.id));
        }

        if (uploadSession) {
          const consumeResult = await db.update(publicPhotoUploadSessions).set({ consumedAt: new Date() })
            .where(and(
              eq(publicPhotoUploadSessions.id, uploadSession.id),
              eq(publicPhotoUploadSessions.userId, hostId),
              eq(publicPhotoUploadSessions.purpose, "booking"),
              isNull(publicPhotoUploadSessions.consumedAt),
              gt(publicPhotoUploadSessions.expiresAt, new Date()),
            ));
          if (!consumeResult[0].affectedRows) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Your photo-upload session has expired. Please upload again." });
          }
        }

        // Associate the client only after a slot is safely reserved below.
        let clientId: number | null = null;
        let isNewClient = false;

        // ── Conflict detection: reject overlapping same-day durations, then retain
        // the unique start-slot key as the transactional final fallback below. ─────
        const scheduledBookings = await db.select({ id: bookings.id, time: bookings.time, duration: bookings.duration })
          .from(bookings)
          .where(and(
            eq(bookings.userId, hostId),
            eq(bookings.date, input.preferredDate),
            sql`${bookings.status} NOT IN ('cancelled', 'no_show')`,
          ));
        if (scheduledBookings.some(booking => doPublicBookingIntervalsOverlap(input.preferredTime, selectedService.durationMinutes + publishedSchedule.bufferMinutes, booking.time, (booking.duration ?? 60) + publishedSchedule.bufferMinutes))) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `The ${input.preferredDate} at ${input.preferredTime} overlaps an existing appointment. Please choose a different time.`,
          });
        }

        let newBookingId = 0;
        try {
          await db.transaction(async (tx) => {
            const [bookingResult] = await tx.insert(bookings).values({
              userId: hostId,
              clientId: null,
              clientName: input.clientName,
              clientEmail: input.clientEmail,
              clientPhone: normalizePhoneToE164(input.clientPhone) || null,
              service: input.service,
              duration: selectedService.durationMinutes,
              date: input.preferredDate,
              time: input.preferredTime,
              slotKey: `${hostId}|${input.preferredDate}|${input.preferredTime}`,
              notes: input.message || null,
              isPublicBooking: true,
              status: "scheduled",
              depositAmountCents: selectedService.depositAmountCents ?? null,
              depositStatus: selectedService.depositAmountCents ? "required" : null,
            });
            newBookingId = Number((bookingResult as any).insertId);

            if (input.clientEmail) {
              const initials = input.clientName
                .split(" ")
                .map((word: string) => word[0]?.toUpperCase() ?? "")
                .slice(0, 2)
                .join("");
              const existing = await tx.select({ id: clients.id }).from(clients)
                .where(and(eq(clients.userId, hostId), eq(clients.email, input.clientEmail))).limit(1);
              isNewClient = !existing[0];
              await tx.insert(clients).values({
                userId: hostId,
                name: input.clientName,
                email: input.clientEmail,
                phone: normalizePhoneToE164(input.clientPhone) || null,
                smsOptIn: input.smsOptIn === true,
                service: input.service || null,
                status: "active",
                avatarInitials: initials || input.clientName[0]?.toUpperCase() || "?",
                sessionsCount: 1,
                lastContactedAt: new Date(),
              }).onDuplicateKeyUpdate({
                set: {
                  sessionsCount: sql`${clients.sessionsCount} + 1`,
                  lastContactedAt: new Date(),
                  updatedAt: new Date(),
                  // Fill a missing phone, and honor a fresh opt-in — never silently revoke one.
                  ...(normalizePhoneToE164(input.clientPhone)
                    ? { phone: normalizePhoneToE164(input.clientPhone) }
                    : {}),
                  ...(input.smsOptIn === true ? { smsOptIn: true } : {}),
                },
              });
              const [client] = await tx.select({ id: clients.id }).from(clients)
                .where(and(eq(clients.userId, hostId), eq(clients.email, input.clientEmail))).limit(1);
              if (!client) throw new Error("Client record could not be linked to the booking.");
              clientId = client.id;
              const linkResult = await tx.update(bookings).set({ clientId: client.id }).where(and(
                eq(bookings.id, newBookingId),
                eq(bookings.userId, hostId),
                eq(bookings.status, "scheduled"),
              ));
              if (!linkResult[0].affectedRows) throw new Error("Booking could not be linked to the client.");
            }
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (message.includes("Duplicate") || message.includes("duplicate") || message.includes("1062")) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `The ${input.preferredDate} at ${input.preferredTime} slot is no longer available. Please choose a different time.`,
            });
          }
          throw error;
        }

        if (uploadSession && uploadedEstimatePhotos.length > 0 && newBookingId) {
          await db.insert(jobPhotos).values(uploadedEstimatePhotos.map((photo) => ({
            userId: hostId,
            bookingId: newBookingId,
            clientId: clientId !== null && clientId > 0 ? clientId : null,
            photoType: "estimate" as const,
            uploadedBy: "client" as const,
            photoUrl: photo.photoUrl,
            photoKey: photo.photoKey,
          })));
        }
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
        const siteOrigin = process.env.SITE_ORIGIN || process.env.VITE_SITE_URL || "https://trueaxishq.com";
        const cancelUrl = newBookingId ? `${siteOrigin}/booking/cancel/${cancelToken}` : undefined;
        const rescheduleUrl = newBookingId ? `${siteOrigin}/booking/reschedule/${rescheduleToken}` : undefined;
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
            rescheduleUrl,
          }),
        }).catch(() => {});
        // ── SMS confirmation (only when the client ticked the opt-in box on the
        // booking form AND provided a number — express consent, recorded on the
        // client record). Degrades to console mode when Twilio is unset. ──────────
        const smsTo = normalizePhoneToE164(input.clientPhone);
        if (smsTo && input.smsOptIn === true) {
          sendSms({
            to: smsTo,
            body: `${freelancerName}: ${input.service} confirmed for ${input.preferredDate} at ${input.preferredTime}. ${rescheduleUrl ? `Need a change? ${rescheduleUrl}` : "Reply to this message if anything changes."}`,
          }).catch(() => {});
        }
        // Send welcome email to new clients
        if (isNewClient) {
          sendEmail({
            to: input.clientEmail,
            subject: `Welcome to ${freelancerName} — We're excited to work with you!`,
            html: newClientWelcomeEmail({
              clientName: input.clientName,
              freelancerName,
              bookingUrl: `${siteOrigin}/book/${host[0].bookingUsername || ""}`,
            }),
          }).catch(() => {});
        }
        // ── Deposit collection: when the chosen service requires a booking deposit,
        // start a Stripe checkout immediately so the client pays before leaving the
        // flow. The webhook (never this return value) marks the deposit paid; if
        // Stripe is not configured the booking still stands and the owner collects
        // the deposit manually.
        let depositCheckoutUrl: string | null = null;
        if (selectedService.depositAmountCents && newBookingId) {
          try {
            const stripe = getStripe();
            const session = await stripe.checkout.sessions.create({
              payment_method_types: ["card"],
              line_items: [{
                price_data: {
                  currency: "usd",
                  product_data: { name: `Booking deposit — ${input.service} on ${input.preferredDate}` },
                  unit_amount: selectedService.depositAmountCents,
                },
                quantity: 1,
              }],
              mode: "payment",
              success_url: `${siteOrigin}/book/${host[0].bookingUsername || ""}?deposit_returned=1`,
              cancel_url: `${siteOrigin}/book/${host[0].bookingUsername || ""}`,
              metadata: {
                booking_id: String(newBookingId),
                deposit_amount_cents: String(selectedService.depositAmountCents),
                client_name: input.clientName,
              },
            });
            depositCheckoutUrl = session.url ?? null;
          } catch (error) {
            console.error("[Booking deposit] Stripe checkout unavailable:", error instanceof Error ? error.message : error);
          }
        }
        return { success: true, isNewClient, depositCheckoutUrl };
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

  // ── Private owner calendar feed ──────────────────────────────────────────────────
  // The public subscription URL is secret-bearing. Its value is returned only when
  // created or rotated and is never included in status responses.
  calendarFeed: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const [record] = await db.select({
        revoked: calendarFeedTokens.revoked,
        revokedAt: calendarFeedTokens.revokedAt,
        createdAt: calendarFeedTokens.createdAt,
        lastAccessedAt: calendarFeedTokens.lastAccessedAt,
      }).from(calendarFeedTokens)
        .where(eq(calendarFeedTokens.userId, ctx.user.id))
        .limit(1);
      return {
        exists: Boolean(record),
        active: Boolean(record && !record.revoked),
        revoked: Boolean(record?.revoked),
        revokedAt: record?.revokedAt ?? null,
        createdAt: record?.createdAt ?? null,
        lastAccessedAt: record?.lastAccessedAt ?? null,
      };
    }),

    create: protectedProcedure
      .input(z.object({ origin: z.string().url().optional() }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const requestedOrigin = input.origin || ctx.req.headers.origin || process.env.SITE_ORIGIN || "https://trueaxishq.com";
        const origin = getTrustedPaymentReturnOrigin(requestedOrigin);
        if (!origin) throw new TRPCError({ code: "BAD_REQUEST", message: "Use an official TrueAxis HQ origin to create a private calendar feed." });

        const [existing] = await db.select({ id: calendarFeedTokens.id, revoked: calendarFeedTokens.revoked })
          .from(calendarFeedTokens).where(eq(calendarFeedTokens.userId, ctx.user.id)).limit(1);
        if (existing && !existing.revoked) {
          throw new TRPCError({ code: "CONFLICT", message: "A private calendar feed is already active. Rotate it if you need a new URL." });
        }

        const token = randomBytes(32).toString("base64url");
        const tokenHash = hashCalendarFeedCredential(token);
        if (existing) {
          await db.update(calendarFeedTokens)
            .set({ tokenHash, revoked: false, revokedAt: null, lastAccessedAt: null, createdAt: new Date() })
            .where(and(eq(calendarFeedTokens.id, existing.id), eq(calendarFeedTokens.userId, ctx.user.id), eq(calendarFeedTokens.revoked, true)));
        } else {
          await db.insert(calendarFeedTokens).values({ userId: ctx.user.id, tokenHash });
        }
        return { feedUrl: `${origin}/api/calendar/feed/${token}.ics` };
      }),

    rotate: protectedProcedure
      .input(z.object({ origin: z.string().url().optional() }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const requestedOrigin = input.origin || ctx.req.headers.origin || process.env.SITE_ORIGIN || "https://trueaxishq.com";
        const origin = getTrustedPaymentReturnOrigin(requestedOrigin);
        if (!origin) throw new TRPCError({ code: "BAD_REQUEST", message: "Use an official TrueAxis HQ origin to rotate a private calendar feed." });
        const token = randomBytes(32).toString("base64url");
        const tokenHash = hashCalendarFeedCredential(token);
        const result = await db.update(calendarFeedTokens)
          .set({ tokenHash, lastAccessedAt: null, revokedAt: null })
          .where(and(eq(calendarFeedTokens.userId, ctx.user.id), eq(calendarFeedTokens.revoked, false)));
        if (!result[0]?.affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "No active private calendar feed was found." });
        return { feedUrl: `${origin}/api/calendar/feed/${token}.ics` };
      }),

    revoke: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await requireDb();
      await db.update(calendarFeedTokens)
        .set({ revoked: true, revokedAt: new Date() })
        .where(and(eq(calendarFeedTokens.userId, ctx.user.id), eq(calendarFeedTokens.revoked, false)));
      return { success: true };
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

        const requestedOrigin = input.origin || ctx.req.headers.origin || process.env.SITE_ORIGIN || "https://trueaxishq.com";
        const origin = getTrustedPaymentReturnOrigin(requestedOrigin);
        if (!origin) throw new TRPCError({ code: "BAD_REQUEST", message: "Use an official TrueAxis HQ origin to generate a client portal link." });

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

        if (existing && !existing.revoked && !isExpired && !isStale) {
          return { token: existing.token, url: `${origin}/portal/${existing.token}` };
        }

        // Create (or rotate) token — delete old one if present
        if (existing) {
          await db.delete(clientPortalTokens).where(and(
            eq(clientPortalTokens.id, existing.id),
            eq(clientPortalTokens.userId, ctx.user.id),
          ));
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

    revokeToken: protectedProcedure
      .input(z.object({ clientId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        await db.update(clientPortalTokens)
          .set({ revoked: true, revokedAt: new Date() })
          .where(and(
            eq(clientPortalTokens.userId, ctx.user.id),
            eq(clientPortalTokens.clientId, input.clientId),
            eq(clientPortalTokens.revoked, false),
          ));
        return { success: true };
      }),

    status: protectedProcedure
      .input(z.object({ clientId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const db = await requireDb();
        const [client] = await db.select({ id: clients.id }).from(clients)
          .where(and(eq(clients.id, input.clientId), eq(clients.userId, ctx.user.id)))
          .limit(1);
        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." });

        const [tokenRecord] = await db.select({
          revoked: clientPortalTokens.revoked,
          revokedAt: clientPortalTokens.revokedAt,
          expiresAt: clientPortalTokens.expiresAt,
          createdAt: clientPortalTokens.createdAt,
        }).from(clientPortalTokens)
          .where(and(eq(clientPortalTokens.userId, ctx.user.id), eq(clientPortalTokens.clientId, input.clientId)))
          .limit(1);

        const expired = Boolean(tokenRecord?.expiresAt && new Date() > tokenRecord.expiresAt);
        return {
          exists: Boolean(tokenRecord),
          active: Boolean(tokenRecord && !tokenRecord.revoked && !expired),
          revoked: Boolean(tokenRecord?.revoked),
          expired,
          expiresAt: tokenRecord?.expiresAt ?? null,
          revokedAt: tokenRecord?.revokedAt ?? null,
          createdAt: tokenRecord?.createdAt ?? null,
        };
      }),

    // Public: view the portal (no auth required — token is the secret)
    view: publicProcedure
      .input(z.object({ token: z.string().min(1).max(128) }))
      .query(async ({ input }) => {
        const db = await requireDb();
        const [portalRecord] = await db.select().from(clientPortalTokens)
          .where(and(eq(clientPortalTokens.token, input.token), eq(clientPortalTokens.revoked, false))).limit(1);

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
        const [client] = await db.select({
          name: clients.name,
          email: clients.email,
          phone: clients.phone,
          service: clients.service,
        }).from(clients)
          .where(and(eq(clients.id, portalRecord.clientId), eq(clients.userId, portalRecord.userId))).limit(1);
        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client record not found." });

        // Fetch client's invoices
        const clientInvoices = await db.select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          service: invoices.service,
          amount: invoices.amount,
          status: invoices.status,
          dueDate: invoices.dueDate,
          paidAt: invoices.paidAt,
        }).from(invoices)
          .where(and(eq(invoices.userId, portalRecord.userId), eq(invoices.clientId, portalRecord.clientId)))
          .orderBy(desc(invoices.createdAt));

        // Fetch client-safe appointment fields only.
        const clientBookings = await db.select({
          id: bookings.id,
          service: bookings.service,
          date: bookings.date,
          time: bookings.time,
          duration: bookings.duration,
          status: bookings.status,
        }).from(bookings)
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
        const returnOrigin = getTrustedPaymentReturnOrigin(input.origin);
        if (!returnOrigin) throw new TRPCError({ code: "BAD_REQUEST", message: "Use the official TrueAxis HQ portal link to continue." });
        const [portalRecord] = await db.select().from(clientPortalTokens)
          .where(and(eq(clientPortalTokens.token, input.token), eq(clientPortalTokens.revoked, false))).limit(1);
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
          success_url: `${returnOrigin}/portal/${input.token}?payment_returned=1`,
          cancel_url: `${returnOrigin}/portal/${input.token}`,
          allow_promotion_codes: true,
        });
                return { checkoutUrl: session.url };
      }),

    getBookingAvailability: publicProcedure
      .input(z.object({ token: z.string().min(1).max(128), bookingId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const db = await requireDb();
        const [portalRecord] = await db.select().from(clientPortalTokens)
          .where(and(eq(clientPortalTokens.token, input.token), eq(clientPortalTokens.revoked, false))).limit(1);
        if (!portalRecord || (portalRecord.expiresAt && new Date() > portalRecord.expiresAt)) throw new TRPCError({ code: "FORBIDDEN", message: "Portal link is no longer active." });
        const [booking] = await db.select({ id: bookings.id, date: bookings.date, time: bookings.time })
          .from(bookings).where(and(eq(bookings.id, input.bookingId), eq(bookings.userId, portalRecord.userId), eq(bookings.clientId, portalRecord.clientId))).limit(1);
        if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found." });
        const today = new Date().toISOString().slice(0, 10);
        const bookedSlots = await db.select({ date: bookings.date, time: bookings.time }).from(bookings).where(and(eq(bookings.userId, portalRecord.userId), eq(bookings.status, "scheduled"), sql`${bookings.date} >= ${today}`, sql`${bookings.id} != ${booking.id}`));
        return { booking, bookedSlots };
      }),

    rescheduleBooking: publicProcedure
      .input(z.object({ token: z.string().min(1).max(128), bookingId: z.number().int().positive(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().trim().min(1).max(32) }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const [portalRecord] = await db.select().from(clientPortalTokens)
          .where(and(eq(clientPortalTokens.token, input.token), eq(clientPortalTokens.revoked, false))).limit(1);
        if (!portalRecord || (portalRecord.expiresAt && new Date() > portalRecord.expiresAt)) throw new TRPCError({ code: "FORBIDDEN", message: "Portal link is no longer active." });
        const [booking] = await db.select().from(bookings).where(and(eq(bookings.id, input.bookingId), eq(bookings.userId, portalRecord.userId), eq(bookings.clientId, portalRecord.clientId))).limit(1);
        if (!booking || booking.status !== "scheduled") throw new TRPCError({ code: "BAD_REQUEST", message: "This appointment can no longer be rescheduled." });
        if (booking.date === input.date && booking.time === input.time) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a different appointment time." });
        if (input.date < new Date().toISOString().slice(0, 10)) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a future appointment date." });
        const nextSlotKey = `${portalRecord.userId}|${input.date}|${input.time}`;
        try {
          const rescheduleResult = await db.update(bookings).set({ date: input.date, time: input.time, slotKey: nextSlotKey, reminderSentAt: null, updatedAt: new Date() })
            .where(and(
              eq(bookings.id, booking.id),
              eq(bookings.userId, portalRecord.userId),
              eq(bookings.clientId, portalRecord.clientId),
              eq(bookings.status, "scheduled"),
              eq(bookings.date, booking.date),
              eq(bookings.time, booking.time),
            ));
          if (!rescheduleResult[0].affectedRows) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "This appointment was just changed. Refresh the portal before trying again." });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (message.includes("Duplicate") || message.includes("duplicate") || message.includes("1062")) throw new TRPCError({ code: "CONFLICT", message: "That appointment time was just taken. Please choose another." });
          throw error;
        }
        await db.insert(notifications).values({ userId: portalRecord.userId, title: `Booking Rescheduled — ${booking.clientName}`, body: `${booking.clientName} moved ${booking.service ?? "their appointment"} to ${input.date} at ${input.time}.`, type: "info", link: "/dashboard?panel=scheduling" });
        if (booking.clientEmail) sendEmail({ to: booking.clientEmail, subject: `Booking Rescheduled — ${booking.service ?? "Appointment"}`, html: bookingCancelConfirmEmail({ clientName: booking.clientName, serviceName: booking.service ?? "Appointment", date: input.date, time: input.time, previousDate: booking.date, previousTime: booking.time, action: "reschedule" }) }).catch(() => {});
        return { ok: true, date: input.date, time: input.time };
      }),

    cancelBooking: publicProcedure
      .input(z.object({ token: z.string().min(1).max(128), bookingId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const [portalRecord] = await db.select().from(clientPortalTokens)
          .where(and(eq(clientPortalTokens.token, input.token), eq(clientPortalTokens.revoked, false))).limit(1);
        if (!portalRecord || (portalRecord.expiresAt && new Date() > portalRecord.expiresAt)) throw new TRPCError({ code: "FORBIDDEN", message: "Portal link is no longer active." });
        const [booking] = await db.select().from(bookings).where(and(eq(bookings.id, input.bookingId), eq(bookings.userId, portalRecord.userId), eq(bookings.clientId, portalRecord.clientId))).limit(1);
        if (!booking || booking.status !== "scheduled") throw new TRPCError({ code: "BAD_REQUEST", message: "This appointment can no longer be cancelled." });
        const cancelResult = await db.update(bookings).set({ status: "cancelled", slotKey: null, updatedAt: new Date() }).where(and(
          eq(bookings.id, booking.id),
          eq(bookings.userId, portalRecord.userId),
          eq(bookings.clientId, portalRecord.clientId),
          eq(bookings.status, "scheduled"),
          eq(bookings.date, booking.date),
          eq(bookings.time, booking.time),
        ));
        if (!cancelResult[0].affectedRows) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This appointment was just changed. Refresh the portal before trying again." });
        }
        await db.insert(notifications).values({ userId: portalRecord.userId, title: `Booking Cancelled — ${booking.clientName}`, body: `${booking.clientName} cancelled ${booking.service ?? "their appointment"} on ${booking.date} at ${booking.time}.`, type: "warning", link: "/dashboard?panel=scheduling" });
        if (booking.clientEmail) sendEmail({ to: booking.clientEmail, subject: `Booking Cancelled — ${booking.service ?? "Appointment"}`, html: bookingCancelConfirmEmail({ clientName: booking.clientName, serviceName: booking.service ?? "Appointment", date: booking.date, time: booking.time, action: "cancel" }) }).catch(() => {});
        return { ok: true };
      }),

    // Public: get job photos for a client via portal token
    getPhotos: publicProcedure
      .input(z.object({ token: z.string().min(1).max(128) }))
      .query(async ({ input }) => {
        const db = await requireDb();
        const [portalRecord] = await db.select().from(clientPortalTokens)
          .where(and(eq(clientPortalTokens.token, input.token), eq(clientPortalTokens.revoked, false))).limit(1);
        if (!portalRecord) throw new TRPCError({ code: "NOT_FOUND", message: "Portal link not found or expired." });
        if (portalRecord.expiresAt && new Date() > portalRecord.expiresAt) {
          throw new TRPCError({ code: "FORBIDDEN", message: "This portal link has expired." });
        }
        // Fetch photos scoped strictly to this userId + clientId — never cross-user
        const photos = await db.select({
          id: jobPhotos.id,
          photoType: jobPhotos.photoType,
          uploadedBy: jobPhotos.uploadedBy,
          photoUrl: jobPhotos.photoUrl,
          caption: jobPhotos.caption,
          bookingId: jobPhotos.bookingId,
          sortOrder: jobPhotos.sortOrder,
          createdAt: jobPhotos.createdAt,
        }).from(jobPhotos)
          .where(and(
            eq(jobPhotos.userId, portalRecord.userId),
            eq(jobPhotos.clientId, portalRecord.clientId),
            eq(jobPhotos.clientVisible, true),
            // Only show estimate, wip, finished — never expose receipt/calculator photos
            inArray(jobPhotos.photoType, ["estimate", "wip", "finished"])
          ))
          .orderBy(jobPhotos.sortOrder, desc(jobPhotos.createdAt));
        return { photos };
      }),

    // Public: job progress for the portal client. Internal notes, receipt costs,
    // and owner-only controls are intentionally excluded from this view.
    getDocuments: publicProcedure
      .input(z.object({ token: z.string().min(1).max(128) }))
      .query(async ({ input }) => {
        const db = await requireDb();
        const [portalRecord] = await db.select().from(clientPortalTokens)
          .where(and(eq(clientPortalTokens.token, input.token), eq(clientPortalTokens.revoked, false))).limit(1);
        if (!portalRecord) throw new TRPCError({ code: "NOT_FOUND", message: "Portal link not found or expired." });
        if (portalRecord.expiresAt && new Date() > portalRecord.expiresAt) throw new TRPCError({ code: "FORBIDDEN", message: "Portal link has expired." });
        const documents = await db.select({ id: clientDocuments.id, fileName: clientDocuments.fileName, fileUrl: clientDocuments.fileUrl, mimeType: clientDocuments.mimeType, sizeBytes: clientDocuments.sizeBytes, createdAt: clientDocuments.createdAt })
          .from(clientDocuments)
          .where(and(eq(clientDocuments.userId, portalRecord.userId), eq(clientDocuments.clientId, portalRecord.clientId), eq(clientDocuments.clientVisible, true)))
          .orderBy(desc(clientDocuments.createdAt));
        return { documents };
      }),

    getJobs: publicProcedure
      .input(z.object({ token: z.string().min(1).max(128) }))
      .query(async ({ input }) => {
        const db = await requireDb();
        const [portalRecord] = await db.select().from(clientPortalTokens)
          .where(and(eq(clientPortalTokens.token, input.token), eq(clientPortalTokens.revoked, false))).limit(1);
        if (!portalRecord) throw new TRPCError({ code: "NOT_FOUND", message: "Portal link not found or expired." });
        if (portalRecord.expiresAt && new Date() > portalRecord.expiresAt) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Portal link has expired." });
        }
        const clientJobs = await db.select({
          id: jobs.id, jobNumber: jobs.jobNumber, title: jobs.title,
          clientSummary: sql<string | null>`case when ${jobs.clientSummaryVisible} then ${jobs.clientSummary} else null end`.as("clientSummary"),
          status: jobs.status, priority: jobs.priority, startDate: jobs.startDate, targetDate: jobs.targetDate,
          completedAt: jobs.completedAt, updatedAt: jobs.updatedAt, bookingId: jobs.bookingId, invoiceId: jobs.invoiceId, proposalId: jobs.proposalId,
        }).from(jobs).where(and(eq(jobs.userId, portalRecord.userId), eq(jobs.clientId, portalRecord.clientId))).orderBy(desc(jobs.updatedAt));
        const jobIds = clientJobs.map(job => job.id);
        if (!jobIds.length) return { jobs: [] };
        const proposalIds = clientJobs.flatMap(job => job.proposalId ? [job.proposalId] : []);
        const [tasks, activities, photos, jobProposals, clientVisits, approvals] = await Promise.all([
          db.select({ id: jobTasks.id, jobId: jobTasks.jobId, title: jobTasks.title, status: jobTasks.status, dueDate: jobTasks.dueDate, completedAt: jobTasks.completedAt, sortOrder: jobTasks.sortOrder, clientVisible: jobTasks.clientVisible })
            .from(jobTasks).where(and(eq(jobTasks.userId, portalRecord.userId), inArray(jobTasks.jobId, jobIds), eq(jobTasks.clientVisible, true))).orderBy(jobTasks.sortOrder, desc(jobTasks.createdAt)),
          db.select({ id: jobActivities.id, jobId: jobActivities.jobId, actor: jobActivities.actor, eventType: jobActivities.eventType, message: jobActivities.message, createdAt: jobActivities.createdAt })
            .from(jobActivities).where(and(eq(jobActivities.userId, portalRecord.userId), inArray(jobActivities.jobId, jobIds))).orderBy(desc(jobActivities.createdAt)),
          db.select({ id: jobPhotos.id, jobId: jobPhotos.jobId, photoType: jobPhotos.photoType, photoUrl: jobPhotos.photoUrl, caption: jobPhotos.caption, createdAt: jobPhotos.createdAt })
            .from(jobPhotos).where(and(eq(jobPhotos.userId, portalRecord.userId), inArray(jobPhotos.jobId, jobIds), eq(jobPhotos.clientVisible, true), inArray(jobPhotos.photoType, ["estimate", "wip", "finished"]))).orderBy(jobPhotos.sortOrder, desc(jobPhotos.createdAt)),
          proposalIds.length ? db.select({ id: proposals.id, title: proposals.title, status: proposals.status, token: proposals.token, validUntil: proposals.validUntil })
            .from(proposals).where(and(eq(proposals.userId, portalRecord.userId), eq(proposals.clientId, portalRecord.clientId), inArray(proposals.id, proposalIds))) : Promise.resolve([]),
          db.select({ id: serviceVisits.id, jobId: serviceVisits.jobId, title: serviceVisits.title, scheduledStart: serviceVisits.scheduledStart, scheduledEnd: serviceVisits.scheduledEnd, status: serviceVisits.status, siteLabel: serviceVisits.siteLabel, clientUpdate: serviceVisits.clientUpdate })
            .from(serviceVisits).where(and(eq(serviceVisits.userId, portalRecord.userId), inArray(serviceVisits.jobId, jobIds), eq(serviceVisits.clientVisible, true), inArray(serviceVisits.status, ["scheduled", "en_route", "in_progress", "completed"]))).orderBy(serviceVisits.scheduledStart),
          db.select({ id: clientApprovalRequests.id, jobId: clientApprovalRequests.jobId, title: clientApprovalRequests.title, description: clientApprovalRequests.description, status: clientApprovalRequests.status, clientResponse: clientApprovalRequests.clientResponse, respondedAt: clientApprovalRequests.respondedAt, createdAt: clientApprovalRequests.createdAt })
            .from(clientApprovalRequests).where(and(eq(clientApprovalRequests.userId, portalRecord.userId), eq(clientApprovalRequests.clientId, portalRecord.clientId), inArray(clientApprovalRequests.jobId, jobIds))).orderBy(desc(clientApprovalRequests.createdAt)),
        ]);
        return {
          jobs: clientJobs.map(job => ({
            ...job,
            tasks: tasks.filter(task => task.jobId === job.id),
            activities: activities.filter(activity => activity.jobId === job.id && isClientSafeJobActivityEvent(activity.eventType)),
            photos: photos.filter(photo => photo.jobId === job.id),
            visits: clientVisits.filter(visit => visit.jobId === job.id),
            approvals: approvals.filter(approval => approval.jobId === job.id),
            proposal: jobProposals.find(proposal => proposal.id === job.proposalId) ?? null,
          })),
        };
      }),

    respondToApproval: publicProcedure
      .input(z.object({ token: z.string().min(1).max(128), approvalId: z.number().int().positive(), response: z.enum(["approved", "changes_requested"]), note: safeOptionalString(2000) }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const [portalRecord] = await db.select().from(clientPortalTokens)
          .where(and(eq(clientPortalTokens.token, input.token), eq(clientPortalTokens.revoked, false))).limit(1);
        if (!portalRecord || (portalRecord.expiresAt && new Date() > portalRecord.expiresAt)) throw new TRPCError({ code: "FORBIDDEN", message: "This portal link is no longer active." });
        const [approval] = await db.select().from(clientApprovalRequests).where(and(
          eq(clientApprovalRequests.id, input.approvalId),
          eq(clientApprovalRequests.userId, portalRecord.userId),
          eq(clientApprovalRequests.clientId, portalRecord.clientId),
        )).limit(1);
        if (!approval) throw new TRPCError({ code: "NOT_FOUND", message: "Approval request not found." });
        if (approval.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "This approval request has already been answered." });
        const approvalUpdate = await db.update(clientApprovalRequests).set({ status: input.response, clientResponse: input.note ?? null, respondedAt: new Date(), updatedAt: new Date() }).where(and(
          eq(clientApprovalRequests.id, approval.id),
          eq(clientApprovalRequests.userId, portalRecord.userId),
          eq(clientApprovalRequests.clientId, portalRecord.clientId),
          eq(clientApprovalRequests.status, "pending"),
        ));
        if (!approvalUpdate[0].affectedRows) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This approval request has already been answered." });
        }
        const action = input.response === "approved" ? "approved" : "requested changes to";
        await db.insert(jobActivities).values({ userId: portalRecord.userId, jobId: approval.jobId, actor: "client", eventType: "approval_responded", message: `Client ${action} “${approval.title}”.`, metadata: JSON.stringify({ approvalId: approval.id, response: input.response, note: input.note ?? null }) });
        return { success: true, status: input.response };
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
        await db.update(contracts).set({ linkedInvoiceId: invoiceId }).where(and(
          eq(contracts.id, input.id),
          eq(contracts.userId, ctx.user.id),
        ));
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
        jobId: z.number().int().positive().optional(),
        projectName: z.string().trim().max(255).optional(),
        description: z.string().trim().max(1000).optional(),
        hourlyRate: z.string().optional(),
        billable: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        let resolvedClientId = input.clientId ?? null;
        if (input.jobId) {
          const [job] = await db.select({ id: jobs.id, clientId: jobs.clientId }).from(jobs)
            .where(and(eq(jobs.id, input.jobId), eq(jobs.userId, ctx.user.id))).limit(1);
          if (!job || (input.clientId && job.clientId !== input.clientId)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Selected job does not belong to this client." });
          }
          resolvedClientId = job.clientId;
        }
        // Stop any running timer first
        const running = await db.select().from(timeEntries)
          .where(and(eq(timeEntries.userId, ctx.user.id), sql`${timeEntries.endedAt} IS NULL`))
          .limit(1);
        if (running.length > 0) {
          const entry = running[0];
          const durationMinutes = Math.round((Date.now() - entry.startedAt.getTime()) / 60000);
          await db.update(timeEntries).set({ endedAt: new Date(), durationMinutes })
            .where(and(eq(timeEntries.id, entry.id), eq(timeEntries.userId, ctx.user.id)));
        }
        const [result] = await db.insert(timeEntries).values({
          userId: ctx.user.id,
          clientId: resolvedClientId,
          clientName: input.clientName ?? null,
          jobId: input.jobId ?? null,
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
          .where(and(eq(timeEntries.id, input.id), eq(timeEntries.userId, ctx.user.id)));
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
        const [entry] = await db.select().from(timeEntries)
          .where(and(eq(timeEntries.id, input.id), eq(timeEntries.userId, ctx.user.id))).limit(1);
        if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "Time entry not found." });
        if (!entry.endedAt && input.durationMinutes !== undefined) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Stop a running timer before editing its duration." });
        }
        const { id, ...fields } = input;
        await db.update(timeEntries).set(fields as any)
          .where(and(eq(timeEntries.id, id), eq(timeEntries.userId, ctx.user.id)));
        return { ok: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [entry] = await db.select().from(timeEntries)
          .where(and(eq(timeEntries.id, input.id), eq(timeEntries.userId, ctx.user.id))).limit(1);
        if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "Time entry not found." });
        if (entry.invoiced) throw new TRPCError({ code: "BAD_REQUEST", message: "Invoiced time entries cannot be deleted." });
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
        jobId: z.number().int().positive().optional(),
        description: z.string().trim().max(1000).optional(),
        durationMinutes: z.number().min(1),
        hourlyRate: z.string().optional(),
        billable: z.boolean().default(true),
        date: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        let resolvedClientId = input.clientId ?? null;
        if (input.jobId) {
          const [job] = await db.select({ id: jobs.id, clientId: jobs.clientId }).from(jobs)
            .where(and(eq(jobs.id, input.jobId), eq(jobs.userId, ctx.user.id))).limit(1);
          if (!job || (input.clientId && job.clientId !== input.clientId)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Selected job does not belong to this client." });
          }
          resolvedClientId = job.clientId;
        }
        const startedAt = input.date ? new Date(input.date + 'T09:00:00') : new Date();
        const endedAt = new Date(startedAt.getTime() + input.durationMinutes * 60000);
        const [result] = await db.insert(timeEntries).values({
          userId: ctx.user.id,
          clientId: resolvedClientId,
          clientName: input.clientName ?? null,
          jobId: input.jobId ?? null,
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

                // 7. Mark the time entry as invoiced (ownership already verified above)
        await db.update(timeEntries)
          .set({ invoiced: true })
          .where(and(eq(timeEntries.id, input.id), eq(timeEntries.userId, ctx.user.id)));
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
        // 5. Mark all entries as invoiced (ownership already verified above)
        await db.update(timeEntries)
          .set({ invoiced: true })
          .where(and(inArray(timeEntries.id, input.ids), eq(timeEntries.userId, ctx.user.id)));
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
    setClientVisibility: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), clientVisible: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [document] = await db.select({ id: clientDocuments.id, clientId: clientDocuments.clientId })
          .from(clientDocuments)
          .where(and(eq(clientDocuments.id, input.id), eq(clientDocuments.userId, ctx.user.id)))
          .limit(1);
        if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found." });
        await db.update(clientDocuments).set({ clientVisible: input.clientVisible })
          .where(and(eq(clientDocuments.id, document.id), eq(clientDocuments.userId, ctx.user.id), eq(clientDocuments.clientId, document.clientId)));
        return { ok: true, clientVisible: input.clientVisible };
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
        const expectedPrefix = `documents/${ctx.user.id}/`;
        if (!input.fileKey.startsWith(expectedPrefix) || input.fileKey.includes("..")) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Document upload could not be verified." });
        }
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

  // ── Migration / data import — the switching moat ─────────────────────────────
  migration: router({
    /** Dry-run: parse, detect the source system, auto-map, and validate. Nothing is written. */
    preview: protectedProcedure
      .input(z.object({
        csv: z.string().min(5).max(2_000_000),
        target: z.enum(["clients", "services"]),
        mapping: z.record(z.string(), z.number().int().min(0).max(999)).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const { headers, dataRows, detection } = parseImportFile(input.csv);
        const mapping = coerceMapping(headers, input.target, input.mapping);
        const analysis = analyzeRows(dataRows, input.target, mapping);

        // Duplicate check against the owner's existing records (read-only).
        const duplicates: { row: number; existingName: string; matchedOn: "email" | "phone" | "name" }[] = [];
        if (input.target === "clients") {
          const existing = await db.select({ id: clients.id, name: clients.name, email: clients.email, phone: clients.phone })
            .from(clients).where(eq(clients.userId, ctx.user.id));
          const byEmail = new Map(existing.filter(c => c.email).map(c => [normalizeEmail(c.email!), c]));
          const byPhone = new Map(existing.filter(c => c.phone).map(c => [normalizePhoneDigits(c.phone!), c]));
          for (const item of analysis.valid) {
            const record = item.record as ExtractedClientRow;
            if (record.email && byEmail.has(record.email)) {
              duplicates.push({ row: item.row, existingName: byEmail.get(record.email)!.name, matchedOn: "email" });
              continue;
            }
            const digits = normalizePhoneDigits(record.phone);
            if (!record.email && digits && byPhone.has(digits)) {
              duplicates.push({ row: item.row, existingName: byPhone.get(digits)!.name, matchedOn: "phone" });
            }
          }
        } else {
          const existing = await db.select({ id: priceBookItems.id, name: priceBookItems.name })
            .from(priceBookItems).where(eq(priceBookItems.userId, ctx.user.id));
          const byName = new Map(existing.map(s => [s.name.toLowerCase(), s]));
          for (const item of analysis.valid) {
            const record = item.record as ExtractedServiceRow;
            if (byName.has(record.name.toLowerCase())) {
              duplicates.push({ row: item.row, existingName: byName.get(record.name.toLowerCase())!.name, matchedOn: "name" });
            }
          }
        }

        return {
          source: detection.source,
          sourceLabel: detection.label,
          headers,
          mapping,
          totalRows: dataRows.length,
          validRows: analysis.valid.length,
          issueCount: analysis.issues.length,
          issues: analysis.issues.slice(0, 50),
          duplicateCount: duplicates.length,
          duplicates: duplicates.slice(0, 50),
          sample: analysis.valid.slice(0, 5).map(v => v.record),
        };
      }),

    /** Commit the import. Re-parses and re-validates everything server-side — the preview is never trusted. */
    commit: protectedProcedure
      .input(z.object({
        csv: z.string().min(5).max(2_000_000),
        target: z.enum(["clients", "services"]),
        mapping: z.record(z.string(), z.number().int().min(0).max(999)),
        duplicateMode: z.enum(["skip", "update", "create"]).default("skip"),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const { headers, dataRows, detection } = parseImportFile(input.csv);
        const mapping = coerceMapping(headers, input.target, input.mapping);
        const analysis = analyzeRows(dataRows, input.target, mapping);

        let created = 0, updated = 0, skipped = 0;
        const failed = analysis.issues.slice(0, 50);
        const skippedReasons = { duplicate: 0, emailConflict: 0, nothingToUpdate: 0 };

        if (input.target === "clients") {
          const existing = await db.select({ id: clients.id, name: clients.name, email: clients.email, phone: clients.phone, service: clients.service, notes: clients.notes })
            .from(clients).where(eq(clients.userId, ctx.user.id));
          const byEmail = new Map(existing.filter(c => c.email).map(c => [normalizeEmail(c.email!), c]));
          const byPhone = new Map(existing.filter(c => c.phone).map(c => [normalizePhoneDigits(c.phone!), c]));
          const toInsert: typeof clients.$inferInsert[] = [];

          for (const item of analysis.valid) {
            const record = item.record as ExtractedClientRow;
            const match = record.email ? byEmail.get(record.email) : byPhone.get(normalizePhoneDigits(record.phone));
            if (match) {
              if (input.duplicateMode === "update") {
                const patch: Partial<typeof clients.$inferInsert> = {};
                if (!match.email && record.email) patch.email = record.email;
                if (!match.phone && record.phone) patch.phone = record.phone;
                if (!match.service && record.service) patch.service = record.service;
                if (!match.notes && record.notes) patch.notes = record.notes;
                if (Object.keys(patch).length > 0) {
                  await db.update(clients).set(patch).where(and(eq(clients.id, match.id), eq(clients.userId, ctx.user.id)));
                  updated++;
                } else { skipped++; skippedReasons.nothingToUpdate++; }
              } else if (input.duplicateMode === "create") {
                if (match.email) { skipped++; skippedReasons.emailConflict++; }
                else {
                  // Phone-only match: a separate client with the same number is allowed.
                  toInsert.push(clientInsertValues(ctx.user.id, record));
                }
              } else { skipped++; skippedReasons.duplicate++; }
            } else {
              toInsert.push(clientInsertValues(ctx.user.id, record));
            }
          }
          for (let i = 0; i < toInsert.length; i += 500) {
            await db.insert(clients).values(toInsert.slice(i, i + 500));
          }
          created = toInsert.length;
        } else {
          const existing = await db.select({ id: priceBookItems.id, name: priceBookItems.name })
            .from(priceBookItems).where(eq(priceBookItems.userId, ctx.user.id));
          const byName = new Map(existing.map(s => [s.name.toLowerCase(), s]));
          const toInsert: typeof priceBookItems.$inferInsert[] = [];

          for (const item of analysis.valid) {
            const record = item.record as ExtractedServiceRow;
            const match = byName.get(record.name.toLowerCase());
            if (match) {
              if (input.duplicateMode === "update") {
                await db.update(priceBookItems).set({
                  unitPrice: record.price,
                  ...(record.description ? { description: record.description } : {}),
                  unit: record.unit,
                  category: record.category,
                }).where(and(eq(priceBookItems.id, match.id), eq(priceBookItems.userId, ctx.user.id)));
                updated++;
              } else { skipped++; skippedReasons.duplicate++; }
            } else {
              toInsert.push({
                userId: ctx.user.id,
                name: record.name,
                description: record.description ?? null,
                unit: record.unit,
                unitPrice: record.price,
                category: record.category,
                active: true,
              });
            }
          }
          for (let i = 0; i < toInsert.length; i += 500) {
            await db.insert(priceBookItems).values(toInsert.slice(i, i + 500));
          }
          created = toInsert.length;
        }

        await db.insert(auditLogs).values({
          userId: ctx.user.id,
          action: input.target === "clients" ? "import.clients" : "import.priceBook",
          entityType: "import",
          details: JSON.stringify({
            source: detection.source,
            created, updated, skipped, failed: analysis.issues.length,
            duplicateMode: input.duplicateMode, skippedReasons,
          }),
        });

        return { created, updated, skipped, failedCount: analysis.issues.length, failed, skippedReasons };
      }),
  }),

  // ── API Keys ──────────────────────────────────────────────────────────────────
  // ── Live "on my way" tracking (opt-in, consent-first) ───────────────────────
  tracking: router({
    /** Owner explicitly starts a live tracking link for a single visit. Nothing is ever shared without this action. */
    start: protectedProcedure
      .input(z.object({ visitId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [visit] = await db.select().from(serviceVisits)
          .where(and(eq(serviceVisits.id, input.visitId), eq(serviceVisits.userId, ctx.user.id))).limit(1);
        if (!visit) throw new TRPCError({ code: "NOT_FOUND", message: "Service visit not found." });
        if (visit.status !== "scheduled" && visit.status !== "en_route") {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Live tracking can only start while a visit is scheduled or en route. Current status: ${visit.status.replaceAll("_", " ")}.` });
        }
        const token = randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
        await db.update(serviceVisitTrackLinks).set({ active: false, revokedAt: new Date() })
          .where(and(eq(serviceVisitTrackLinks.visitId, visit.id), eq(serviceVisitTrackLinks.active, true)));
        await db.insert(serviceVisitTrackLinks).values({ userId: ctx.user.id, visitId: visit.id, token, active: true, expiresAt });
        if (visit.status === "scheduled") {
          await db.update(serviceVisits).set({ status: "en_route" })
            .where(and(eq(serviceVisits.id, visit.id), eq(serviceVisits.userId, ctx.user.id)));
          await db.insert(jobActivities).values({
            userId: ctx.user.id, jobId: visit.jobId, actor: "owner", eventType: "service_visit_status_changed",
            message: "Service visit marked en route (owner shared live tracking).",
            metadata: JSON.stringify({ visitId: visit.id, status: "en_route", trackingShared: true }),
          });
          await deliverWorkflowWebhookEvent(db, ctx.user.id, "service_visit.status_changed", { visitId: visit.id, jobId: visit.jobId, previousStatus: "scheduled", status: "en_route" });
        }
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "tracking.link_created", entityType: "serviceVisit", entityId: visit.id, details: JSON.stringify({ expiresAt: expiresAt.toISOString() }) });
        return { token, trackUrl: `/track/${token}`, expiresAt };
      }),
    /** A field device reports its position for the active, explicitly shared tracking link. */
    ping: protectedProcedure
      .input(z.object({ visitId: z.number().int().positive(), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracy: z.number().min(0).max(5000).optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [visit] = await db.select().from(serviceVisits)
          .where(and(eq(serviceVisits.id, input.visitId), eq(serviceVisits.userId, ctx.user.id))).limit(1);
        if (!visit) throw new TRPCError({ code: "NOT_FOUND", message: "Service visit not found." });
        const [link] = await db.select().from(serviceVisitTrackLinks)
          .where(and(eq(serviceVisitTrackLinks.visitId, visit.id), eq(serviceVisitTrackLinks.active, true))).limit(1);
        if (!link || link.revokedAt || link.expiresAt.getTime() < Date.now()) throw new TRPCError({ code: "BAD_REQUEST", message: "No active tracking link for this visit." });
        if (visit.status !== "en_route") throw new TRPCError({ code: "BAD_REQUEST", message: "Position reporting is only allowed while the visit is en route." });
        await db.update(serviceVisitTrackLinks)
          .set({ lastLat: input.lat, lastLng: input.lng, lastAccuracy: input.accuracy ?? null, lastPingAt: new Date() })
          .where(eq(serviceVisitTrackLinks.id, link.id));
        return { success: true };
      }),
    /** Immediately revoke the active tracking link for a visit. */
    stop: protectedProcedure
      .input(z.object({ visitId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const result = await db.update(serviceVisitTrackLinks).set({ active: false, revokedAt: new Date() })
          .where(and(eq(serviceVisitTrackLinks.visitId, input.visitId), eq(serviceVisitTrackLinks.userId, ctx.user.id), eq(serviceVisitTrackLinks.active, true)));
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "tracking.link_stopped", entityType: "serviceVisit", entityId: input.visitId, details: "{}" });
        return { success: true, stopped: result[0].affectedRows > 0 };
      }),
    /** The current active tracking link for a visit, if one exists. */
    active: protectedProcedure
      .input(z.object({ visitId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const [link] = await db.select().from(serviceVisitTrackLinks)
          .where(and(eq(serviceVisitTrackLinks.visitId, input.visitId), eq(serviceVisitTrackLinks.userId, ctx.user.id), eq(serviceVisitTrackLinks.active, true))).limit(1);
        if (!link || link.revokedAt) return null;
        return { token: link.token, trackUrl: `/track/${link.token}`, expiresAt: link.expiresAt, lastPingAt: link.lastPingAt };
      }),
  }),

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
          .where(and(eq(clientPortalTokens.token, input.token), eq(clientPortalTokens.revoked, false))).limit(1);
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
          .where(and(eq(clientPortalTokens.token, input.token), eq(clientPortalTokens.revoked, false))).limit(1);
        if (!portalRecord) throw new TRPCError({ code: "NOT_FOUND" });
        // Enforce token expiry (same as portal.view)
        if (portalRecord.expiresAt && new Date(portalRecord.expiresAt) < new Date()) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal link has expired. Please request a new one." });
        }
        return db.select({
          id: portalMessages.id,
          senderRole: portalMessages.senderRole,
          body: portalMessages.body,
          createdAt: portalMessages.createdAt,
        }).from(portalMessages)
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

  // ── Inventory & Purchase Orders (truck-level tracking) ───────────────────────
  inventory: router({
    listItems: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const [items, totals] = await Promise.all([
        db.select().from(inventoryItems).where(eq(inventoryItems.userId, ctx.user.id)).orderBy(inventoryItems.name),
        db.select({ itemId: inventoryMovements.itemId, total: sql<string>`COALESCE(SUM(${inventoryMovements.quantity}), 0)` })
          .from(inventoryMovements).where(eq(inventoryMovements.userId, ctx.user.id)).groupBy(inventoryMovements.itemId),
      ]);
      const onHand = new Map(totals.map(row => [row.itemId, Number(row.total)]));
      return items.map(item => ({ ...item, totalOnHand: onHand.get(item.id) ?? 0, lowStock: Number(item.reorderPoint) > 0 && (onHand.get(item.id) ?? 0) <= Number(item.reorderPoint) }));
    }),

    itemStock: protectedProcedure
      .input(z.object({ itemId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const rows = await db.select({ locationId: inventoryMovements.locationId, onHand: sql<string>`COALESCE(SUM(${inventoryMovements.quantity}), 0)` })
          .from(inventoryMovements).where(and(eq(inventoryMovements.userId, ctx.user.id), eq(inventoryMovements.itemId, input.itemId)))
          .groupBy(inventoryMovements.locationId);
        const locations = await db.select().from(inventoryLocations).where(eq(inventoryLocations.userId, ctx.user.id));
        const locationMap = new Map(locations.map(location => [location.id, location]));
        return rows.map(row => ({ locationId: row.locationId, locationName: locationMap.get(row.locationId)?.name ?? "Unknown", locationType: locationMap.get(row.locationId)?.type ?? "warehouse", onHand: Number(row.onHand) }))
          .filter(row => locationMap.has(row.locationId));
      }),

    listMovements: protectedProcedure
      .input(z.object({ itemId: z.number().int().positive().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const filters = [eq(inventoryMovements.userId, ctx.user.id)];
        if (input?.itemId) filters.push(eq(inventoryMovements.itemId, input.itemId));
        return db.select({
          id: inventoryMovements.id, type: inventoryMovements.type, quantity: inventoryMovements.quantity,
          note: inventoryMovements.note, createdAt: inventoryMovements.createdAt,
          itemName: inventoryItems.name, locationName: inventoryLocations.name, locationType: inventoryLocations.type,
        }).from(inventoryMovements)
          .innerJoin(inventoryItems, and(eq(inventoryMovements.itemId, inventoryItems.id), eq(inventoryItems.userId, ctx.user.id)))
          .innerJoin(inventoryLocations, and(eq(inventoryMovements.locationId, inventoryLocations.id), eq(inventoryLocations.userId, ctx.user.id)))
          .where(and(...filters)).orderBy(desc(inventoryMovements.createdAt)).limit(100);
      }),

    createItem: protectedProcedure
      .input(z.object({ name: safeString(255), sku: safeOptionalString(64), unit: safeOptionalString(16), unitCost: z.number().min(0).max(1_000_000).default(0), unitPrice: z.number().min(0).max(1_000_000).default(0), reorderPoint: z.number().min(0).max(1_000_000).default(0) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        try {
          const [result] = await db.insert(inventoryItems).values({ userId: ctx.user.id, name: input.name, sku: input.sku || null, unit: input.unit || "each", unitCost: String(input.unitCost), unitPrice: String(input.unitPrice), reorderPoint: String(input.reorderPoint) });
          return { id: Number(result.insertId) };
        } catch (error) {
          if (error instanceof Error && /Duplicate entry/.test(error.message)) throw new TRPCError({ code: "BAD_REQUEST", message: "An item with that SKU already exists." });
          throw error;
        }
      }),

    updateItem: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), name: safeOptionalString(255), sku: safeOptionalString(64), unit: safeOptionalString(16), unitCost: z.number().min(0).max(1_000_000).optional(), unitPrice: z.number().min(0).max(1_000_000).optional(), reorderPoint: z.number().min(0).max(1_000_000).optional(), active: z.boolean().optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const updates: Record<string, unknown> = {};
        if (input.name !== undefined) updates.name = input.name;
        if (input.sku !== undefined) updates.sku = input.sku || null;
        if (input.unit !== undefined) updates.unit = input.unit || "each";
        if (input.unitCost !== undefined) updates.unitCost = String(input.unitCost);
        if (input.unitPrice !== undefined) updates.unitPrice = String(input.unitPrice);
        if (input.reorderPoint !== undefined) updates.reorderPoint = String(input.reorderPoint);
        if (input.active !== undefined) updates.active = input.active;
        if (Object.keys(updates).length > 0) {
          try {
            await db.update(inventoryItems).set(updates).where(and(eq(inventoryItems.id, input.id), eq(inventoryItems.userId, ctx.user.id)));
          } catch (error) {
            if (error instanceof Error && /Duplicate entry/.test(error.message)) throw new TRPCError({ code: "BAD_REQUEST", message: "An item with that SKU already exists." });
            throw error;
          }
        }
        return { success: true };
      }),

    listLocations: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(inventoryLocations).where(eq(inventoryLocations.userId, ctx.user.id)).orderBy(inventoryLocations.type, inventoryLocations.name);
    }),

    createLocation: protectedProcedure
      .input(z.object({ name: safeString(100), type: z.enum(["warehouse", "truck"]).default("warehouse") }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        try {
          const [result] = await db.insert(inventoryLocations).values({ userId: ctx.user.id, name: input.name, type: input.type });
          return { id: Number(result.insertId) };
        } catch (error) {
          if (error instanceof Error && /Duplicate entry/.test(error.message)) throw new TRPCError({ code: "BAD_REQUEST", message: "A location with that name already exists." });
          throw error;
        }
      }),

    updateLocation: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), name: safeOptionalString(100), active: z.boolean().optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const updates: Record<string, unknown> = {};
        if (input.name !== undefined) updates.name = input.name;
        if (input.active !== undefined) updates.active = input.active;
        if (Object.keys(updates).length > 0) {
          try {
            await db.update(inventoryLocations).set(updates).where(and(eq(inventoryLocations.id, input.id), eq(inventoryLocations.userId, ctx.user.id)));
          } catch (error) {
            if (error instanceof Error && /Duplicate entry/.test(error.message)) throw new TRPCError({ code: "BAD_REQUEST", message: "A location with that name already exists." });
            throw error;
          }
        }
        return { success: true };
      }),

    receiveStock: protectedProcedure
      .input(z.object({ itemId: z.number().int().positive(), locationId: z.number().int().positive(), quantity: z.number().positive().max(1_000_000), unitCost: z.number().min(0).max(1_000_000).optional(), note: safeOptionalString(255) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireOwnedStockTargets(db, ctx.user.id, input.itemId, input.locationId);
        await db.insert(inventoryMovements).values({ userId: ctx.user.id, itemId: input.itemId, locationId: input.locationId, type: "receive", quantity: String(input.quantity), note: input.note || null });
        if (input.unitCost !== undefined) await db.update(inventoryItems).set({ unitCost: String(input.unitCost) }).where(and(eq(inventoryItems.id, input.itemId), eq(inventoryItems.userId, ctx.user.id)));
        return { success: true };
      }),

    adjustStock: protectedProcedure
      .input(z.object({ itemId: z.number().int().positive(), locationId: z.number().int().positive(), quantity: z.number().min(-1_000_000).max(1_000_000).refine(value => value !== 0, "An adjustment must change the quantity."), note: safeString(255) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await requireOwnedStockTargets(db, ctx.user.id, input.itemId, input.locationId);
        await db.insert(inventoryMovements).values({ userId: ctx.user.id, itemId: input.itemId, locationId: input.locationId, type: "adjust", quantity: String(input.quantity), note: input.note });
        return { success: true };
      }),

    consumeForJob: protectedProcedure
      .input(z.object({ itemId: z.number().int().positive(), locationId: z.number().int().positive(), jobId: z.number().int().positive(), quantity: z.number().positive().max(1_000_000) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [job] = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.id, input.jobId), eq(jobs.userId, ctx.user.id))).limit(1);
        if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
        const [item] = await db.select({ name: inventoryItems.name }).from(inventoryItems).where(and(eq(inventoryItems.id, input.itemId), eq(inventoryItems.userId, ctx.user.id))).limit(1);
        if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Inventory item not found." });
        const [location] = await db.select({ id: inventoryLocations.id }).from(inventoryLocations).where(and(eq(inventoryLocations.id, input.locationId), eq(inventoryLocations.userId, ctx.user.id))).limit(1);
        if (!location) throw new TRPCError({ code: "NOT_FOUND", message: "Stock location not found." });
        await db.insert(inventoryMovements).values({ userId: ctx.user.id, itemId: input.itemId, locationId: input.locationId, jobId: input.jobId, type: "consume", quantity: String(-input.quantity), note: `Used on job #${input.jobId}` });
        await db.insert(jobActivities).values({ userId: ctx.user.id, jobId: input.jobId, actor: "owner", eventType: "material_used", message: `Material used from stock: ${input.quantity} ${item.name}.` });
        return { success: true };
      }),

    listPurchaseOrders: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const [orders, lines, locations] = await Promise.all([
        db.select().from(purchaseOrders).where(eq(purchaseOrders.userId, ctx.user.id)).orderBy(desc(purchaseOrders.createdAt)).limit(100),
        db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.userId, ctx.user.id)),
        db.select().from(inventoryLocations).where(eq(inventoryLocations.userId, ctx.user.id)),
      ]);
      const locationMap = new Map(locations.map(location => [location.id, location.name]));
      return orders.map(order => ({ ...order, locationName: locationMap.get(order.locationId) ?? "Unknown", items: lines.filter(line => line.purchaseOrderId === order.id) }));
    }),

    createPurchaseOrder: protectedProcedure
      .input(z.object({ supplierName: safeString(255), locationId: z.number().int().positive(), expectedDate: safeOptionalString(32), notes: safeOptionalString(2000), items: z.array(z.object({ inventoryItemId: z.number().int().positive().optional(), description: safeString(255), quantity: z.number().positive().max(1_000_000), unitCost: z.number().min(0).max(1_000_000).default(0) })).min(1).max(50) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [location] = await db.select({ id: inventoryLocations.id }).from(inventoryLocations).where(and(eq(inventoryLocations.id, input.locationId), eq(inventoryLocations.userId, ctx.user.id))).limit(1);
        if (!location) throw new TRPCError({ code: "NOT_FOUND", message: "Receive-to location not found." });
        const existing = await db.select({ id: purchaseOrders.id }).from(purchaseOrders).where(eq(purchaseOrders.userId, ctx.user.id));
        const poNumber = `PO-${String(existing.length + 1).padStart(4, "0")}`;
        const total = input.items.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
        const values = { userId: ctx.user.id, supplierName: input.supplierName, locationId: input.locationId, expectedDate: input.expectedDate || null, notes: input.notes || null, totalAmount: String(total) };
        let order: { insertId: number | bigint } | null = null;
        let assignedNumber = poNumber;
        for (let attempt = 0; attempt < 3 && !order; attempt++) {
          try {
            [order] = await db.insert(purchaseOrders).values({ ...values, poNumber: assignedNumber });
          } catch (error) {
            // Two drafts created at once can race on the sequential number — step forward and retry.
            if (!(error instanceof Error) || !/Duplicate entry/.test(error.message)) throw error;
            assignedNumber = `PO-${String(existing.length + 2 + attempt).padStart(4, "0")}`;
          }
        }
        if (!order) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not assign a purchase order number. Try again." });
        await db.insert(purchaseOrderItems).values(input.items.map(line => ({ userId: ctx.user.id, purchaseOrderId: Number(order.insertId), inventoryItemId: line.inventoryItemId ?? null, description: line.description, quantity: String(line.quantity), unitCost: String(line.unitCost) })));
        return { id: Number(order.insertId), poNumber: assignedNumber };
      }),

    updatePurchaseOrder: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), supplierName: safeOptionalString(255), expectedDate: safeOptionalString(32), notes: safeOptionalString(2000) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [order] = await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, input.id), eq(purchaseOrders.userId, ctx.user.id))).limit(1);
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        if (order.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft purchase orders can be edited." });
        const updates: Record<string, unknown> = {};
        if (input.supplierName !== undefined) updates.supplierName = input.supplierName;
        if (input.expectedDate !== undefined) updates.expectedDate = input.expectedDate || null;
        if (input.notes !== undefined) updates.notes = input.notes || null;
        if (Object.keys(updates).length > 0) await db.update(purchaseOrders).set(updates).where(and(eq(purchaseOrders.id, input.id), eq(purchaseOrders.userId, ctx.user.id)));
        return { success: true };
      }),

    submitPurchaseOrder: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [order] = await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, input.id), eq(purchaseOrders.userId, ctx.user.id))).limit(1);
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        if (order.status !== "draft") throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft purchase orders can be submitted." });
        await db.update(purchaseOrders).set({ status: "ordered" }).where(and(eq(purchaseOrders.id, input.id), eq(purchaseOrders.userId, ctx.user.id)));
        return { success: true };
      }),

    receivePurchaseOrder: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [order] = await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, input.id), eq(purchaseOrders.userId, ctx.user.id))).limit(1);
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        if (order.status !== "ordered") throw new TRPCError({ code: "BAD_REQUEST", message: "Only ordered purchase orders can be received." });
        const lines = await db.select().from(purchaseOrderItems).where(and(eq(purchaseOrderItems.purchaseOrderId, input.id), eq(purchaseOrderItems.userId, ctx.user.id)));
        for (const line of lines) {
          if (!line.inventoryItemId) continue; // freeform lines carry no stock
          await db.insert(inventoryMovements).values({ userId: ctx.user.id, itemId: line.inventoryItemId, locationId: order.locationId, purchaseOrderId: order.id, type: "receive", quantity: String(line.quantity), note: `Received on ${order.poNumber}` });
          await db.update(purchaseOrderItems).set({ receivedQuantity: line.quantity }).where(and(eq(purchaseOrderItems.id, line.id), eq(purchaseOrderItems.userId, ctx.user.id)));
          if (Number(line.unitCost) > 0) {
            await db.update(inventoryItems).set({ unitCost: line.unitCost }).where(and(eq(inventoryItems.id, line.inventoryItemId), eq(inventoryItems.userId, ctx.user.id)));
          }
        }
        await db.update(purchaseOrders).set({ status: "received" }).where(and(eq(purchaseOrders.id, input.id), eq(purchaseOrders.userId, ctx.user.id)));
        return { success: true };
      }),

    cancelPurchaseOrder: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [order] = await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, input.id), eq(purchaseOrders.userId, ctx.user.id))).limit(1);
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        if (order.status === "received" || order.status === "cancelled") throw new TRPCError({ code: "BAD_REQUEST", message: "Received or cancelled purchase orders cannot change." });
        await db.update(purchaseOrders).set({ status: "cancelled" }).where(and(eq(purchaseOrders.id, input.id), eq(purchaseOrders.userId, ctx.user.id)));
        return { success: true };
      }),
  }),

  // ── Custom report builder ───────────────────────────────────────────────────
  reports: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(customReports).where(eq(customReports.userId, ctx.user.id)).orderBy(desc(customReports.updatedAt));
    }),

    create: protectedProcedure
      .input(z.object({ name: safeString(120), config: reportConfigSchema }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [result] = await db.insert(customReports).values({
          userId: ctx.user.id, name: input.name,
          dataset: input.config.dataset, metric: input.config.metric, groupBy: input.config.groupBy,
          filters: JSON.stringify(input.config.filters),
        });
        return { id: Number(result.insertId) };
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), name: safeOptionalString(120), config: reportConfigSchema.optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [report] = await db.select().from(customReports).where(and(eq(customReports.id, input.id), eq(customReports.userId, ctx.user.id))).limit(1);
        if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Report not found." });
        const updates: Record<string, unknown> = {};
        if (input.name !== undefined) updates.name = input.name;
        if (input.config !== undefined) {
          updates.dataset = input.config.dataset;
          updates.metric = input.config.metric;
          updates.groupBy = input.config.groupBy;
          updates.filters = JSON.stringify(input.config.filters);
        }
        if (Object.keys(updates).length > 0) await db.update(customReports).set(updates).where(and(eq(customReports.id, input.id), eq(customReports.userId, ctx.user.id)));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.delete(customReports).where(and(eq(customReports.id, input.id), eq(customReports.userId, ctx.user.id)));
        return { success: true };
      }),

    /** Runs a saved report. Reports are computed live — no stale snapshots. */
    run: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const [report] = await db.select().from(customReports).where(and(eq(customReports.id, input.id), eq(customReports.userId, ctx.user.id))).limit(1);
        if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Report not found." });
        let filters: Record<string, unknown> = {};
        try { filters = JSON.parse(report.filters); } catch { filters = {}; }
        const result = await runReportConfig(db, ctx.user.id, { dataset: report.dataset, metric: report.metric, groupBy: report.groupBy, filters: filters as ReportConfig["filters"] });
        return { id: report.id, name: report.name, dataset: report.dataset, metric: report.metric, groupBy: report.groupBy, filters, ...result };
      }),

    /** Runs an unsaved configuration from the builder, so you see it before you save. */
    preview: protectedProcedure
      .input(z.object({ config: reportConfigSchema }))
      .query(async ({ ctx, input }) => await runReportConfig(await requireDb(), ctx.user.id, input.config as ReportConfig)),
  }),

  priceBook: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(priceBookItems)
        .where(eq(priceBookItems.userId, ctx.user.id))
        .orderBy(priceBookItems.category, priceBookItems.name);
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().trim().min(1).max(255),
        description: z.string().trim().max(1024).optional(),
        category: z.string().trim().min(1).max(64).default("service"),
        unit: z.enum(["job", "hour", "day", "sq_ft", "linear_ft", "each", "month", "visit"]).default("job"),
        unitPrice: z.number().min(0).max(10_000_000),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [row] = await db.insert(priceBookItems).values({
          userId: ctx.user.id,
          name: input.name,
          description: input.description,
          category: input.category,
          unit: input.unit,
          unitPrice: input.unitPrice.toFixed(2),
        });
        return { id: row.insertId };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(1).max(255).optional(),
        description: z.string().trim().max(1024).nullable(),
        category: z.string().trim().min(1).max(64).optional(),
        unit: z.enum(["job", "hour", "day", "sq_ft", "linear_ft", "each", "month", "visit"]).optional(),
        unitPrice: z.number().min(0).max(10_000_000).optional(),
        active: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const updates: Record<string, unknown> = {};
        if (input.name !== undefined) updates.name = input.name;
        if (input.description !== undefined) updates.description = input.description ?? null;
        if (input.category !== undefined) updates.category = input.category;
        if (input.unit !== undefined) updates.unit = input.unit;
        if (input.unitPrice !== undefined) updates.unitPrice = input.unitPrice.toFixed(2);
        if (input.active !== undefined) updates.active = input.active;
        if (!Object.keys(updates).length) throw new TRPCError({ code: "BAD_REQUEST", message: "No changes provided." });
        const result = await db.update(priceBookItems).set(updates)
          .where(and(eq(priceBookItems.id, input.id), eq(priceBookItems.userId, ctx.user.id)));
        if (!result[0]?.affectedRows) throw new TRPCError({ code: "NOT_FOUND" });
        return { ok: true };
      }),

    remove: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const result = await db.delete(priceBookItems)
          .where(and(eq(priceBookItems.id, input.id), eq(priceBookItems.userId, ctx.user.id)));
        if (!result[0]?.affectedRows) throw new TRPCError({ code: "NOT_FOUND" });
        return { ok: true };
      }),
  }),

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
        const trustedOrigin = getTrustedPaymentReturnOrigin(input.origin);
        if (!trustedOrigin) throw new TRPCError({ code: "BAD_REQUEST", message: "Use an official TrueAxis HQ origin to create a testimonial request." });
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
        const testimonialUrl = `${trustedOrigin}/testimonial/${token}`;
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
        const submissionResult = await db.update(testimonials).set({
          body: input.body, rating: input.rating,
          status: "submitted", submittedAt: new Date(),
        }).where(and(eq(testimonials.id, t.id), eq(testimonials.status, "requested")));
        if (!submissionResult[0].affectedRows) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This testimonial has already been submitted." });
        }
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
        }).where(and(eq(testimonials.id, input.id), eq(testimonials.userId, ctx.user.id)));
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
        const today = new Date().toISOString().slice(0, 10);
        const bookedSlots = tokenRow.action === "reschedule"
          ? await db.select({ date: bookings.date, time: bookings.time }).from(bookings)
            .where(and(
              eq(bookings.userId, tokenRow.userId),
              eq(bookings.status, "scheduled"),
              sql`${bookings.date} >= ${today}`,
              sql`${bookings.id} != ${booking.id}`,
            ))
          : [];
        return {
          booking: { service: booking.service, date: booking.date, time: booking.time },
          action: tokenRow.action,
          freelancerName: host?.businessName || host?.name || "Your provider",
          bookingUsername: host?.bookingUsername,
          bookedSlots,
        };
      }),

    // Public: atomically move an existing booking using a one-time reschedule link.
    reschedule: publicProcedure
      .input(z.object({
        token: z.string().min(1).max(128),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.string().trim().min(1).max(32),
      }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const [tokenRow] = await db.select().from(bookingCancelTokens)
          .where(eq(bookingCancelTokens.token, input.token)).limit(1);
        if (!tokenRow || tokenRow.used || tokenRow.action !== "reschedule") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This reschedule link is no longer available." });
        }
        if (new Date() > tokenRow.expiresAt) throw new TRPCError({ code: "BAD_REQUEST", message: "This reschedule link has expired." });
        const [booking] = await db.select().from(bookings)
          .where(and(eq(bookings.id, tokenRow.bookingId), eq(bookings.userId, tokenRow.userId))).limit(1);
        if (!booking || booking.status !== "scheduled") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This booking can no longer be rescheduled." });
        }
        enforceBookingChangeWindow(booking.date, booking.time);
        if (booking.date === input.date && booking.time === input.time) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Please choose a different appointment time." });
        }
        if (input.date < new Date().toISOString().slice(0, 10)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Please choose a future appointment date." });
        }

        const nextSlotKey = `${tokenRow.userId}|${input.date}|${input.time}`;
        try {
          await db.transaction(async (tx) => {
            const tokenConsume = await tx.update(bookingCancelTokens).set({ used: true })
              .where(and(
                eq(bookingCancelTokens.id, tokenRow.id),
                eq(bookingCancelTokens.used, false),
                eq(bookingCancelTokens.action, "reschedule"),
                gt(bookingCancelTokens.expiresAt, new Date()),
              ));
            if (!tokenConsume[0].affectedRows) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "This reschedule link is no longer available." });
            }
            const bookingUpdate = await tx.update(bookings).set({
              date: input.date,
              time: input.time,
              slotKey: nextSlotKey,
              reminderSentAt: null,
              updatedAt: new Date(),
            }).where(and(
              eq(bookings.id, booking.id),
              eq(bookings.userId, tokenRow.userId),
              eq(bookings.status, "scheduled"),
              eq(bookings.date, booking.date),
              eq(bookings.time, booking.time),
            ));
            if (!bookingUpdate[0].affectedRows) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "This booking can no longer be rescheduled." });
            }
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (message.includes("Duplicate") || message.includes("duplicate") || message.includes("1062")) {
            throw new TRPCError({ code: "CONFLICT", message: "That appointment time was just taken. Please choose another." });
          }
          throw error;
        }

        await db.insert(notifications).values({
          userId: tokenRow.userId,
          title: `Booking Rescheduled — ${booking.clientName}`,
          body: `${booking.clientName} moved ${booking.service ?? "their session"} from ${booking.date} at ${booking.time} to ${input.date} at ${input.time}.`,
          type: "info",
          link: "/dashboard?panel=schedule",
        });
        if (booking.clientEmail) {
          sendEmail({
            to: booking.clientEmail,
            subject: `Booking Rescheduled — ${booking.service ?? "Session"}`,
            html: bookingCancelConfirmEmail({
              clientName: booking.clientName,
              serviceName: booking.service ?? "Session",
              date: input.date,
              time: input.time,
              previousDate: booking.date,
              previousTime: booking.time,
              action: "reschedule",
            }),
          }).catch(() => {});
        }
        return { ok: true, date: input.date, time: input.time };
      }),

    // Public: execute cancel
    cancel: publicProcedure
      .input(z.object({ token: z.string().min(1).max(128) }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const [tokenRow] = await db.select().from(bookingCancelTokens)
          .where(eq(bookingCancelTokens.token, input.token)).limit(1);
        if (!tokenRow || tokenRow.used) throw new TRPCError({ code: "BAD_REQUEST", message: "Link already used or not found." });
        if (new Date() > tokenRow.expiresAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Link expired." });
        const [booking] = await db.select().from(bookings).where(and(eq(bookings.id, tokenRow.bookingId), eq(bookings.userId, tokenRow.userId))).limit(1);
        if (!booking) throw new TRPCError({ code: "NOT_FOUND" });
        enforceBookingChangeWindow(booking.date, booking.time);
        await db.transaction(async (tx) => {
          const tokenConsume = await tx.update(bookingCancelTokens).set({ used: true })
            .where(and(
              eq(bookingCancelTokens.id, tokenRow.id),
              eq(bookingCancelTokens.used, false),
              eq(bookingCancelTokens.action, "cancel"),
              gt(bookingCancelTokens.expiresAt, new Date()),
            ));
          if (!tokenConsume[0].affectedRows) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Link already used or not found." });
          }
          const bookingUpdate = await tx.update(bookings)
            .set({ status: "cancelled", slotKey: null, reminderSentAt: null, checkInSentAt: null })
            .where(and(eq(bookings.id, booking.id), eq(bookings.userId, tokenRow.userId), eq(bookings.status, "scheduled")));
          if (!bookingUpdate[0].affectedRows) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "This booking can no longer be cancelled." });
          }
        });
        // Notify owner
        await db.insert(notifications).values({
          userId: tokenRow.userId,
          title: `Booking Cancelled — ${booking.clientName}`,
          body: `${booking.clientName} cancelled their ${booking.service} on ${booking.date}.`,
          type: "warning", link: "/dashboard?panel=schedule",
        });
        // Send confirmation email to client
        const [host] = await db.select({ bookingUsername: users.bookingUsername }).from(users).where(eq(users.id, tokenRow.userId)).limit(1);
        const siteOrigin = process.env.SITE_ORIGIN || process.env.VITE_SITE_URL || "https://trueaxishq.com";
        const rebookUrl = host?.bookingUsername ? `${siteOrigin}/book/${host.bookingUsername}` : undefined;
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
    status: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const [preference] = await db.select({ enabled: users.monthlyReportEnabled })
        .from(users).where(eq(users.id, ctx.user.id)).limit(1);
      return { enabled: preference?.enabled ?? false };
    }),
    toggle: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.update(users).set({ monthlyReportEnabled: input.enabled }).where(eq(users.id, ctx.user.id));
        return { ok: true, enabled: input.enabled };
      }),
  }),

  // ── Google Calendar ───────────────────────────────────────────────────────────
  googleCal: router({
    // Get connection status
    status: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const [token] = await db.select({ syncEnabled: googleCalendarTokens.syncEnabled, calendarId: googleCalendarTokens.calendarId, createdAt: googleCalendarTokens.createdAt, lastSyncedAt: googleCalendarTokens.lastSyncedAt, lastError: googleCalendarTokens.lastError, lastErrorKind: googleCalendarTokens.lastErrorKind, lastErrorAt: googleCalendarTokens.lastErrorAt })
        .from(googleCalendarTokens).where(eq(googleCalendarTokens.userId, ctx.user.id)).limit(1);
      return { connected: !!token, syncEnabled: token?.syncEnabled ?? false, calendarId: token?.calendarId ?? null, connectedAt: token?.createdAt ?? null, lastSyncedAt: token?.lastSyncedAt ?? null, lastError: token?.lastError ?? null, lastErrorKind: token?.lastErrorKind ?? null, lastErrorAt: token?.lastErrorAt ?? null };
    }),

    // Get OAuth URL
    getAuthUrl: protectedProcedure
      .input(z.object({ origin: z.string().url() }))
      .query(async ({ ctx, input }) => {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!clientId) return { url: null, status: "setup_required" as const };
        const stateSecret = process.env.JWT_SECRET;
        if (!stateSecret) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Google Calendar integration state is not configured." });
        let state: string;
        try {
          state = createGoogleOAuthState(ctx.user.id, input.origin, stateSecret);
        } catch {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Google Calendar integration requires a secure application origin." });
        }
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: `${input.origin}/api/google-calendar/callback`,
          response_type: "code",
          scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly",
          access_type: "offline",
          prompt: "consent",
          state,
        });
        return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, status: "ready" as const };
      }),

    // Disconnect
    disconnect: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await requireDb();
      await db.delete(googleCalendarTokens).where(eq(googleCalendarTokens.userId, ctx.user.id));
      return { ok: true };
    }),

    // Trigger an immediate sync for the signed-in owner; surfaces provider errors verbatim.
    syncNow: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await requireDb();
      const outcome = await runGoogleCalendarSyncForUser({ userId: ctx.user.id, db });
      if (outcome.status === "synced") {
        return { ok: true, status: "synced" as const, created: outcome.created, updated: outcome.updated, deleted: outcome.deleted };
      }
      if (outcome.status === "not_connected") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Google Calendar authorization is not connected." });
      }
      return { ok: false, status: outcome.status, message: outcome.message };
    }),

      // Toggle sync
    toggleSync: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [result] = await db.update(googleCalendarTokens).set({ syncEnabled: input.enabled })
          .where(eq(googleCalendarTokens.userId, ctx.user.id));
        if (result.affectedRows !== 1) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Google Calendar authorization is not connected." });
        }
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

      // Check first automation
      const [automationRow] = await db.select({ id: automations.id })
        .from(automations).where(eq(automations.userId, uid)).limit(1);
      const hasAutomation = !!automationRow;

      return {
        profile: profileComplete,
        client: hasClient,
        invoice: hasInvoice,
        booking: bookingSetup,
        followup: hasFollowUp,
        recurring: hasRecurring,
        automation: hasAutomation,
      };
    }),

    fastStartKits: protectedProcedure.query(() => [
      { id: "consultant", name: "Consultant / Coach", description: "Discovery, strategy, and ongoing advisory services.", services: ["Discovery session", "Strategy session", "Ongoing advisory"] },
      { id: "creative", name: "Creative Freelancer", description: "Discovery, kickoff, and review services for project-based work.", services: ["Discovery call", "Project kickoff", "Revision session"] },
      { id: "agency", name: "Agency", description: "Planning, delivery, and client review services for a small team.", services: ["Discovery call", "Sprint planning", "Project review"] },
      { id: "field_service", name: "Field Service", description: "Site visits, estimate walkthroughs, and completed service appointments.", services: ["Site visit", "Estimate walkthrough", "Service visit"] },
    ]),

    applyFastStartKit: protectedProcedure
      .input(z.object({ kitId: z.enum(["consultant", "creative", "agency", "field_service"]) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const kitServices: Record<typeof input.kitId, Array<{ name: string; description: string; durationMinutes: number }>> = {
          consultant: [
            { name: "Discovery session", description: "An introductory conversation to understand goals and fit. Update the price before publishing.", durationMinutes: 45 },
            { name: "Strategy session", description: "A focused working session for priorities, decisions, and next steps. Update the price before publishing.", durationMinutes: 60 },
            { name: "Ongoing advisory", description: "A recurring advisory session for continuing client support. Update the price before publishing.", durationMinutes: 60 },
          ],
          creative: [
            { name: "Discovery call", description: "A project-fit call to confirm scope and goals. Update the price before publishing.", durationMinutes: 30 },
            { name: "Project kickoff", description: "A structured kickoff to align scope, timeline, and working process. Update the price before publishing.", durationMinutes: 60 },
            { name: "Revision session", description: "A focused review session for feedback and next iterations. Update the price before publishing.", durationMinutes: 45 },
          ],
          agency: [
            { name: "Discovery call", description: "An initial client conversation to identify requirements and fit. Update the price before publishing.", durationMinutes: 30 },
            { name: "Sprint planning", description: "A planning session to align delivery priorities and responsibilities. Update the price before publishing.", durationMinutes: 60 },
            { name: "Project review", description: "A client review session for delivered work and next decisions. Update the price before publishing.", durationMinutes: 60 },
          ],
          field_service: [
            { name: "Site visit", description: "An on-site assessment or scheduled service appointment. Update the price before publishing.", durationMinutes: 60 },
            { name: "Estimate walkthrough", description: "A walkthrough to review the proposed scope and estimate. Update the price before publishing.", durationMinutes: 45 },
            { name: "Service visit", description: "A scheduled visit to complete documented work. Update the price before publishing.", durationMinutes: 120 },
          ],
        };
        const selectedServices = kitServices[input.kitId];
        const existing = await db.select({ name: services.name }).from(services).where(eq(services.userId, ctx.user.id));
        const existingNames = new Set(existing.map(service => service.name.trim().toLowerCase()));
        const toInsert = selectedServices.filter(service => !existingNames.has(service.name.toLowerCase()));
        if (toInsert.length) await db.insert(services).values(toInsert.map(service => ({ userId: ctx.user.id, name: service.name, description: service.description, price: "0", durationMinutes: service.durationMinutes, category: "fast_start", active: true })));
        return { added: toInsert.length, skipped: selectedServices.length - toInsert.length };
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
        jobId: z.number().int().positive().optional(),
      })
      )
      .query(async ({ input, ctx }) => {
        const db = await requireDb();
        const uid = ctx.user.id;
        const filters = [eq(expenses.userId, uid)];
        if (input.year) filters.push(sql`YEAR(${expenses.date}) = ${input.year}`);
        if (input.month) filters.push(sql`MONTH(${expenses.date}) = ${input.month}`);
        if (input.category) filters.push(eq(expenses.category, input.category));
        if (input.jobId) filters.push(eq(expenses.jobId, input.jobId));
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
        jobId: z.number().int().positive().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        if (input.jobId) {
          const [ownedJob] = await db.select({ id: jobs.id }).from(jobs)
            .where(and(eq(jobs.id, input.jobId), eq(jobs.userId, ctx.user.id))).limit(1);
          if (!ownedJob) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
        }
        const [row] = await db.insert(expenses).values({
          userId: ctx.user.id,
          jobId: input.jobId,
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
        jobId: z.number().int().positive().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const { id, amount, jobId, ...rest } = input;
        const updates: Record<string, unknown> = Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined));
        if (amount !== undefined) updates.amount = String(amount);
        if (jobId !== undefined) {
          if (jobId !== null) {
            const [ownedJob] = await db.select({ id: jobs.id }).from(jobs)
              .where(and(eq(jobs.id, jobId), eq(jobs.userId, ctx.user.id))).limit(1);
            if (!ownedJob) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
          }
          updates.jobId = jobId;
        }
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
        if (isProposalExpired(row.validUntil)) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found or link has expired." });
        // Mark as viewed if first time
        if (!row.viewedAt) {
          await db.update(proposals).set({ viewedAt: new Date(), status: row.status === "sent" ? "viewed" : row.status }).where(and(
            eq(proposals.id, row.id),
            eq(proposals.token, input.token),
            eq(proposals.status, row.status),
          ));
        }
        const { declineReason: _declineReason, ...publicProposal } = row;

        // Journey continuation for a signed proposal the client revisits: surface
        // the linked invoice's pay link and the owner's self-booking page so the
        // client can always reach the next step, not just at signing time.
        let continuation: { payUrl: string | null; paid: boolean; invoiceNumber: string | null; bookingUrl: string | null } | null = null;
        if (row.status === "signed" && row.linkedInvoiceId) {
          const [linkedInvoice] = await db.select({
            payLinkToken: invoices.payLinkToken,
            status: invoices.status,
            invoiceNumber: invoices.invoiceNumber,
          }).from(invoices).where(eq(invoices.id, row.linkedInvoiceId)).limit(1);
          const [owner] = await db.select({ bookingUsername: users.bookingUsername }).from(users).where(eq(users.id, row.userId)).limit(1);
          const payUrl = linkedInvoice?.payLinkToken ? `/pay/${linkedInvoice.payLinkToken}` : null;
          const paid = linkedInvoice?.status === "paid";
          const bookingUrl = owner?.bookingUsername ? `/book/${owner.bookingUsername}` : null;
          if (payUrl || bookingUrl) continuation = { payUrl, paid, invoiceNumber: linkedInvoice?.invoiceNumber ?? null, bookingUrl };
        }
        return { ...publicProposal, continuation };
      }),

    create: protectedProcedure
      .input(z.object({
        clientId: z.number().int().optional(),
        clientName: safeString(255),
        clientEmail: safeOptionalEmail,
        title: safeString(512),
        scope: z.string().max(10000).optional(),
        lineItems: z.array(proposalLineItemSchema),
        packageOptions: z.array(proposalPackageSchema).min(2).max(3).optional(),
        taxRate: z.number().min(0).max(100).default(0),
        currency: z.string().length(3).default("USD"),
        validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        notes: z.string().max(2000).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const crypto = await import("crypto");
        const token = crypto.randomBytes(32).toString("hex");
        const lineItems = normalizeProposalLineItems(input.lineItems);
        const packageOptions = input.packageOptions?.map(option => ({ ...option, lineItems: normalizeProposalLineItems(option.lineItems) })) as ProposalPackage[] | undefined;
        const subtotal = packageOptions ? 0 : lineItems.reduce((s, li) => s + li.total, 0);
        const total = subtotal * (1 + (input.taxRate / 100));
        const [row] = await db.insert(proposals).values({
          userId: ctx.user.id,
          clientId: input.clientId,
          clientName: input.clientName,
          clientEmail: input.clientEmail,
          title: input.title,
          scope: input.scope,
          lineItems: JSON.stringify(lineItems),
          packageOptions: packageOptions ? JSON.stringify(packageOptions) : null,
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

    duplicate: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const [source] = await db.select().from(proposals).where(and(eq(proposals.id, input.id), eq(proposals.userId, ctx.user.id))).limit(1);
        if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found." });
        const crypto = await import("crypto");
        const token = crypto.randomBytes(32).toString("hex");
        const hasPackageOptions = Boolean(source.packageOptions);
        const [result] = await db.insert(proposals).values({
          userId: ctx.user.id,
          clientId: null,
          clientName: "",
          clientEmail: null,
          title: `Copy of ${source.title}`.slice(0, 512),
          scope: source.scope,
          lineItems: hasPackageOptions ? "[]" : source.lineItems,
          subtotal: hasPackageOptions ? "0" : source.subtotal,
          taxRate: source.taxRate,
          total: hasPackageOptions ? "0" : source.total,
          currency: source.currency,
          packageOptions: source.packageOptions,
          notes: source.notes,
          token,
          status: "draft",
        });
        return { id: Number(result.insertId), token };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().int(),
        clientName: safeOptionalString(255),
        clientEmail: safeOptionalEmail,
        title: safeOptionalString(512),
        scope: z.string().max(10000).optional(),
        lineItems: z.array(proposalLineItemSchema).optional(),
        packageOptions: z.array(proposalPackageSchema).max(3).optional(),
        taxRate: z.number().min(0).max(100).optional(),
        currency: z.string().length(3).optional(),
        validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        notes: z.string().max(2000).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const [existing] = await db.select({ status: proposals.status, subtotal: proposals.subtotal, taxRate: proposals.taxRate }).from(proposals).where(and(eq(proposals.id, input.id), eq(proposals.userId, ctx.user.id))).limit(1);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found." });
        if (existing.status === "signed") throw new TRPCError({ code: "BAD_REQUEST", message: "Signed proposals cannot be edited." });
        const { id, lineItems, packageOptions, taxRate, ...rest } = input;
        const updates: Record<string, unknown> = { ...rest };
        if (lineItems !== undefined) {
          const normalizedLineItems = normalizeProposalLineItems(lineItems);
          updates.lineItems = JSON.stringify(normalizedLineItems);
          const subtotal = normalizedLineItems.reduce((s, li) => s + li.total, 0);
          const rate = taxRate ?? 0;
          updates.subtotal = String(subtotal);
          updates.taxRate = String(rate);
          updates.total = String(subtotal * (1 + rate / 100));
        } else if (taxRate !== undefined) {
          updates.taxRate = String(taxRate);
          updates.total = String(Number(existing.subtotal) * (1 + taxRate / 100));
        }
        if (packageOptions !== undefined) {
          const normalizedPackages = packageOptions.length ? packageOptions.map(option => ({ ...option, lineItems: normalizeProposalLineItems(option.lineItems) })) : null;
          updates.packageOptions = normalizedPackages ? JSON.stringify(normalizedPackages) : null;
          if (normalizedPackages) {
            updates.lineItems = "[]";
            updates.subtotal = "0";
            updates.taxRate = String(taxRate ?? existing.taxRate ?? 0);
            updates.total = "0";
          }
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
        const requestedOrigin = input.origin || ctx.req.headers.origin || process.env.SITE_ORIGIN || "https://trueaxishq.com";
        const origin = getTrustedPaymentReturnOrigin(requestedOrigin);
        if (!origin) throw new TRPCError({ code: "BAD_REQUEST", message: "Use an official TrueAxis HQ origin to send a proposal." });
        const link = `${origin}/proposal/${row.token}`;
        let emailAccepted = false;
        if (row.clientEmail) {
          const emailResult = await sendEmail({
            to: row.clientEmail,
            subject: `Proposal: ${row.title}`,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
              <h2 style="color:#1C1C1E">You have a new proposal</h2>
              <p>Hi ${row.clientName},</p>
              <p>Please review your proposal <strong>${row.title}</strong> for <strong>$${parseFloat(String(row.total)).toLocaleString()}</strong>.</p>
              <a href="${link}" style="display:inline-block;background:#00C9A7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">View &amp; Sign Proposal</a>
              <p style="color:#666;font-size:14px">This link will take you to a secure page where you can review and sign the proposal electronically.</p>
            </div>`,
          }).catch(e => {
            console.error("[Proposals] Email failed:", e);
            return { success: false, mode: "smtp" as const };
          });
          emailAccepted = wasAcceptedByConfiguredSmtp(emailResult);
        }
        if (emailAccepted) {
          await db.update(proposals).set({ status: "sent", sentAt: new Date() }).where(and(eq(proposals.id, input.id), eq(proposals.userId, ctx.user.id)));
        }
        return { success: true, link, emailAccepted };
      }),

    sign: publicProcedure
      .input(z.object({
        token: z.string().min(1),
        signatureName: safeString(255),
        selectedPackageId: z.string().min(1).max(64).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const [row] = await db.select().from(proposals).where(eq(proposals.token, input.token)).limit(1);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found." });
        if (row.status === "signed") throw new TRPCError({ code: "BAD_REQUEST", message: "This proposal has already been signed." });
        if (row.status === "declined") throw new TRPCError({ code: "BAD_REQUEST", message: "This proposal was declined." });
        if (isProposalExpired(row.validUntil)) throw new TRPCError({ code: "BAD_REQUEST", message: "This proposal is no longer available for signature." });
        const packageOptions = parseProposalPackages(row.packageOptions);
        const selectedPackage = packageOptions.length ? packageOptions.find(option => option.id === input.selectedPackageId) : undefined;
        if (packageOptions.length && !selectedPackage) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose one of the available proposal options before signing." });
        if (!packageOptions.length && input.selectedPackageId) throw new TRPCError({ code: "BAD_REQUEST", message: "This proposal does not have selectable options." });
        const selectedLineItems = selectedPackage ? normalizeProposalLineItems(selectedPackage.lineItems) : null;
        const selectedSubtotal = selectedPackage ? getProposalPackageSubtotal(selectedPackage) : null;
        const selectedTotal = selectedSubtotal === null ? null : Math.round(selectedSubtotal * (1 + Number(row.taxRate ?? 0) / 100) * 100) / 100;
        const [signatureClaim] = await db.update(proposals).set({
          status: "signed",
          signedAt: new Date(),
          signatureName: input.signatureName,
          ...(selectedPackage ? {
            selectedPackageId: selectedPackage.id,
            selectedPackage: JSON.stringify(selectedPackage),
            lineItems: JSON.stringify(selectedLineItems),
            subtotal: String(selectedSubtotal),
            total: String(selectedTotal),
          } : {}),
        }).where(and(eq(proposals.id, row.id), eq(proposals.token, input.token), eq(proposals.status, row.status)));
        // Atomic claim: a concurrent signature or replay must never create a second invoice.
        if (!signatureClaim || signatureClaim.affectedRows !== 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This proposal has already been signed." });
        }

        // ── Quote-to-cash continuation ──────────────────────────────────────
        // The signature claim owns this proposal: create the linked invoice once
        // (with a payment token) so the client can pay immediately, and surface
        // the owner's booking link when self-scheduling is configured.
        let invoiceNumber: string | null = null;
        let payUrl: string | null = null;
        if (!row.linkedInvoiceId) {
          const nextInvoiceNumber = generateInvoiceNumber();
          const payToken = randomBytes(32).toString("hex");
          const [createdInvoice] = await db.insert(invoices).values({
            userId: row.userId,
            clientId: row.clientId ?? null,
            invoiceNumber: nextInvoiceNumber,
            clientName: row.clientName,
            clientEmail: row.clientEmail || null,
            service: row.title,
            amount: String(selectedTotal ?? row.total),
            status: "draft",
            lineItems: row.lineItems,
            payLinkToken: payToken,
            notes: row.notes,
          });
          const invoiceId = Number(createdInvoice.insertId);
          await db.update(proposals).set({ linkedInvoiceId: invoiceId }).where(eq(proposals.id, row.id));
          invoiceNumber = nextInvoiceNumber;
          payUrl = `/pay/${payToken}`;
        }

        let bookingUrl: string | null = null;
        const [owner] = await db.select({ bookingUsername: users.bookingUsername }).from(users).where(eq(users.id, row.userId)).limit(1);
        if (owner?.bookingUsername) bookingUrl = `/book/${owner.bookingUsername}`;

        // Notify the owner
        notifyOwner({
          title: `Proposal Signed: ${row.title}`,
          content: `${row.clientName} signed your proposal "${row.title}"${selectedPackage ? ` after selecting ${selectedPackage.name}` : ""} for $${(selectedTotal ?? parseFloat(String(row.total))).toLocaleString()}.${invoiceNumber ? ` Draft invoice ${invoiceNumber} is ready in Billing.` : ""}`,
        }).catch(() => {});
        return { success: true, selectedPackageId: selectedPackage?.id ?? null, total: selectedTotal ?? Number(row.total), invoiceNumber, payUrl, bookingUrl };
      }),

    decline: publicProcedure
      .input(z.object({
        token: z.string().min(1),
        reason: z.string().trim().max(1000).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const [row] = await db.select().from(proposals).where(eq(proposals.token, input.token)).limit(1);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found." });
        if (isProposalExpired(row.validUntil)) throw new TRPCError({ code: "BAD_REQUEST", message: "This proposal is no longer available for a decision." });
        if (row.status === "signed") throw new TRPCError({ code: "BAD_REQUEST", message: "This proposal has already been signed." });
        if (row.status === "declined") throw new TRPCError({ code: "BAD_REQUEST", message: "This proposal has already been declined." });
        await db.update(proposals).set({
          status: "declined",
          declineReason: input.reason || null,
        }).where(and(eq(proposals.id, row.id), eq(proposals.token, input.token), eq(proposals.status, row.status)));
        return { success: true };
      }),

    convertToInvoice: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDb();
        const [row] = await db.select().from(proposals)
          .where(and(eq(proposals.id, input.id), eq(proposals.userId, ctx.user.id))).limit(1);
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        if (row.packageOptions && row.status !== "signed") throw new TRPCError({ code: "BAD_REQUEST", message: "A package proposal can only be converted after the client signs a selected option." });
        if (row.packageOptions && !row.selectedPackageId) throw new TRPCError({ code: "BAD_REQUEST", message: "The signed proposal does not include a package selection." });
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
        await db.update(proposals).set({ linkedInvoiceId: invId }).where(and(
          eq(proposals.id, row.id),
          eq(proposals.userId, ctx.user.id),
        ));
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

    preview: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .query(async ({ input, ctx }) => {
        const db = await requireDb();
        const [automation] = await db.select().from(automations)
          .where(and(eq(automations.id, input.id), eq(automations.userId, ctx.user.id))).limit(1);
        if (!automation) throw new TRPCError({ code: "NOT_FOUND" });

        // This is intentionally read-only: previews do not send, enqueue, write logs, or alter run counters.
        return buildAutomationPreview({
          name: automation.name,
          trigger: automation.trigger,
          triggerDelayHours: automation.triggerDelayHours,
          actions: parseAutomationPreviewActions(automation.actions),
        });
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
          type: z.enum(SUPPORTED_AUTOMATION_ACTIONS),
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
        actions: z.array(z.object({ type: z.enum(SUPPORTED_AUTOMATION_ACTIONS), config: z.record(z.string(), z.any()) })).optional(),
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
        const actions = JSON.parse(auto.actions || "[]") as Array<{ type: string; config: Record<string, unknown> }>;
        let executed = 0;
        const skipped: string[] = [];
        for (const action of actions) {
          try {
            if (action.type === "notify_owner") {
              const delivered = await notifyOwner({
                title: typeof action.config.title === "string" ? action.config.title : "Automation test",
                content: typeof action.config.message === "string" ? action.config.message : `Automation "${auto.name}" was manually tested.`,
              });
              if (delivered) executed++;
              else skipped.push("Owner notification service unavailable");
            } else {
              skipped.push(`${action.type} runs automatically when a matching ${auto.trigger} event is due.`);
            }
          } catch (e) {
            skipped.push(e instanceof Error ? e.message : "Automation test failed");
          }
        }
        if (executed > 0) {
          await db.update(automations).set({ runCount: sql`${automations.runCount} + 1`, lastRunAt: new Date() }).where(and(
            eq(automations.id, auto.id),
            eq(automations.userId, ctx.user.id),
          ));
        }
        await db.insert(automationLogs).values({
          automationId: auto.id,
          userId: ctx.user.id,
          trigger: "manual",
          status: executed > 0 ? "success" : "skipped",
          actionsExecuted: executed,
          errorMessage: skipped.length ? skipped.join(" | ").slice(0, 4000) : null,
        });
        return { success: true, actionsExecuted: executed, skipped };
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
          userId: intakeForms.userId,
        }).from(intakeForms).where(eq(intakeForms.publicSlug, input.slug)).limit(1);
        if (!form || !form.active) throw new TRPCError({ code: "NOT_FOUND", message: "Form not found or inactive" });
        // Fetch host's booking username so the success screen can show a booking CTA
        const [host] = await db.select({ bookingUsername: users.bookingUsername, name: users.name, businessName: users.businessName })
          .from(users).where(eq(users.id, form.userId)).limit(1);
        return {
          id: form.id,
          name: form.name,
          description: form.description,
          fields: form.fields,
          hostBookingUsername: host?.bookingUsername ?? null,
          hostName: host?.businessName || host?.name || null,
        };
      }),

    submitResponse: publicProcedure
      .input(z.object({
        slug: z.string(),
        respondentName: z.string().optional(),
        respondentEmail: z.string().email().optional(),
        answers: z.record(z.string(), z.any()),
        photoUploadToken: z.string().regex(/^[a-f0-9]{64}$/).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const [form] = await db.select().from(intakeForms).where(eq(intakeForms.publicSlug, input.slug)).limit(1);
        if (!form || !form.active) throw new TRPCError({ code: "NOT_FOUND", message: "Form not found or inactive" });

        let uploadSession: { id: number } | null = null;
        let uploadedEstimatePhotos: { photoKey: string; photoUrl: string }[] = [];
        if (input.photoUploadToken) {
          const [session] = await db.select().from(publicPhotoUploadSessions)
            .where(and(
              eq(publicPhotoUploadSessions.tokenHash, hashPublicUploadToken(input.photoUploadToken)),
              eq(publicPhotoUploadSessions.userId, form.userId),
              eq(publicPhotoUploadSessions.purpose, "intake")
            )).limit(1);
          if (!session || session.consumedAt || new Date() > session.expiresAt) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Your photo-upload session has expired. Please upload again." });
          }
          uploadSession = { id: session.id };
          uploadedEstimatePhotos = await db.select({ photoKey: publicPhotoUploads.photoKey, photoUrl: publicPhotoUploads.photoUrl })
            .from(publicPhotoUploads).where(eq(publicPhotoUploads.sessionId, session.id));
        }

        const { _estimatePhotos: _ignoredUntrustedPhotoUrls, ...submittedAnswers } = input.answers;
        const savedAnswers = {
          ...submittedAnswers,
          ...(uploadedEstimatePhotos.length > 0 ? { _estimatePhotos: JSON.stringify(uploadedEstimatePhotos.map((photo) => photo.photoUrl)) } : {}),
        };
        if (uploadSession) {
          const consumeResult = await db.update(publicPhotoUploadSessions).set({ consumedAt: new Date() })
            .where(and(
              eq(publicPhotoUploadSessions.id, uploadSession.id),
              eq(publicPhotoUploadSessions.userId, form.userId),
              eq(publicPhotoUploadSessions.purpose, "intake"),
              isNull(publicPhotoUploadSessions.consumedAt),
              gt(publicPhotoUploadSessions.expiresAt, new Date()),
            ));
          if (!consumeResult[0].affectedRows) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Your photo-upload session has expired. Please upload again." });
          }
        }
        const [responseResult] = await db.insert(intakeResponses).values({
          formId: form.id,
          userId: form.userId,
          respondentName: input.respondentName ?? null,
          respondentEmail: input.respondentEmail ?? null,
          answers: JSON.stringify(savedAnswers),
        });
        const responseId = Number((responseResult as any).insertId);
        let existingClientId: number | null = null;
        if (input.respondentEmail) {
          const [existingClient] = await db.select({ id: clients.id }).from(clients)
            .where(and(eq(clients.userId, form.userId), eq(clients.email, input.respondentEmail))).limit(1);
          existingClientId = existingClient?.id ?? null;
        }
        if (uploadSession && uploadedEstimatePhotos.length > 0) {
          await db.insert(jobPhotos).values(uploadedEstimatePhotos.map((photo) => ({
            userId: form.userId,
            clientId: existingClientId,
            photoType: "estimate" as const,
            uploadedBy: "client" as const,
            photoUrl: photo.photoUrl,
            photoKey: photo.photoKey,
            caption: responseId ? `Intake response #${responseId}` : "Intake estimate photo",
          }))); 
        }
        // Send auto-reply email to respondent
        if (input.respondentEmail) {
          const [host] = await db.select({ name: users.name, businessName: users.businessName, bookingUsername: users.bookingUsername })
            .from(users).where(eq(users.id, form.userId)).limit(1);
          const freelancerName = host?.businessName || host?.name || "Your service provider";
          const siteOrigin = process.env.SITE_ORIGIN || process.env.VITE_SITE_URL || "https://trueaxishq.com";
          const bookingUrl = host?.bookingUsername ? `${siteOrigin}/book/${host.bookingUsername}` : undefined;
          sendEmail({
            to: input.respondentEmail,
            subject: `We received your submission — ${form.name}`,
            html: intakeAutoReplyEmail({
              respondentName: input.respondentName || "there",
              formName: form.name,
              freelancerName,
              bookingUrl,
            }),
          }).catch(() => {});
        }
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

  // ── Job Photos ──────────────────────────────────────────────────────────────
  photos: router({
    beginPublicUpload: publicProcedure
      .input(z.object({
        hostUsername: z.string().trim().min(1).max(64),
        purpose: z.enum(["booking", "intake"]),
      }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        const [host] = await db.select({ id: users.id }).from(users)
          .where(eq(users.bookingUsername, input.hostUsername)).limit(1);
        if (!host) throw new TRPCError({ code: "NOT_FOUND", message: "Host not found" });
        const uploadToken = createPublicUploadToken();
        const expiresAt = new Date(Date.now() + PUBLIC_UPLOAD_TTL_MS);
        await db.insert(publicPhotoUploadSessions).values({
          tokenHash: hashPublicUploadToken(uploadToken),
          userId: host.id,
          purpose: input.purpose,
          maxUploads: PUBLIC_UPLOAD_MAX_FILES,
          expiresAt,
        });
        return { uploadToken, expiresAt, maxUploads: PUBLIC_UPLOAD_MAX_FILES };
      }),

    // Get upload URL — returns a presigned-style upload endpoint via the storage proxy
    getUploadUrl: protectedProcedure
      .input(z.object({
        fileName: z.string().min(1).max(255),
        contentType: z.string().min(1).max(100),
        photoType: z.enum(["estimate", "wip", "finished", "receipt"]),
        bookingId: z.number().int().positive().optional(),
        clientId: z.number().int().positive().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const crypto = await import("crypto");
        const ext = input.fileName.split(".").pop()?.toLowerCase() || "jpg";
        const key = `job-photos/${ctx.user.id}/${input.photoType}/${crypto.randomBytes(12).toString("hex")}.${ext}`;
        // Return the key so the client can POST to /api/photos/upload
        return { key, uploadEndpoint: `/api/photos/upload` };
      }),

    // Confirm upload — called after client has successfully uploaded the file
    confirmUpload: protectedProcedure
      .input(z.object({
        photoUrl: z.string().url(),
        photoKey: z.string().min(1).max(512),
        photoType: z.enum(["estimate", "wip", "finished", "receipt"]),
        bookingId: z.number().int().positive().optional(),
        clientId: z.number().int().positive().optional(),
        caption: z.string().max(512).optional(),
        lineItemLabel: z.string().max(255).optional(),
        lineItemAmount: z.number().min(0).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        let verifiedClientId: number | null = null;
        if (input.clientId) {
          const [client] = await db.select({ id: clients.id })
            .from(clients)
            .where(and(
              eq(clients.id, input.clientId),
              eq(clients.userId, ctx.user.id),
              eq(clients.status, "active"),
            ))
            .limit(1);
          if (!client) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Only active clients in your workspace can be selected for an owner photo.",
            });
          }
          verifiedClientId = client.id;
        }
        const [result] = await db.insert(jobPhotos).values({
          userId: ctx.user.id,
          bookingId: input.bookingId ?? null,
          clientId: verifiedClientId,
          photoType: input.photoType,
          uploadedBy: "owner",
          photoUrl: input.photoUrl,
          photoKey: input.photoKey,
          caption: input.caption ?? null,
          lineItemLabel: input.lineItemLabel ?? null,
          lineItemAmount: input.lineItemAmount != null ? String(input.lineItemAmount) : null,
        });
        return { id: (result as any).insertId as number };
      }),

    // Portal uploads are associated immediately. Public booking/intake uploads are
    // only verified here and associated when their submitted workflow succeeds.
    confirmClientUpload: publicProcedure
      .input(z.object({
        photoUrl: z.string().url(),
        photoKey: z.string().min(1).max(512),
        portalToken: z.string().min(1).max(128).optional(),
        uploadToken: z.string().regex(/^[a-f0-9]{64}$/).optional(),
        caption: z.string().max(512).optional(),
      }).refine(input => Boolean(input.portalToken || input.uploadToken), {
        message: "A portal token or upload session is required.",
      }))
      .mutation(async ({ input }) => {
        const db = await requireDb();
        if (input.portalToken) {
          const [portalRecord] = await db.select({
            userId: clientPortalTokens.userId,
            clientId: clientPortalTokens.clientId,
            expiresAt: clientPortalTokens.expiresAt,
          }).from(clientPortalTokens)
            .where(and(eq(clientPortalTokens.token, input.portalToken), eq(clientPortalTokens.revoked, false)))
            .limit(1);
          if (!portalRecord || (portalRecord.expiresAt && portalRecord.expiresAt < new Date())) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Portal link not found or expired." });
          }
          if (!isOwnerPhotoKeyForType(input.photoKey, portalRecord.userId, "estimate")) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Photo upload does not belong to this portal." });
          }
          const [result] = await db.insert(jobPhotos).values({
            userId: portalRecord.userId,
            clientId: portalRecord.clientId,
            photoType: "estimate",
            uploadedBy: "client",
            photoUrl: input.photoUrl,
            photoKey: input.photoKey,
            caption: input.caption ?? null,
          });
          return { id: (result as any).insertId as number, pendingAssociation: false };
        }

        const [session] = await db.select().from(publicPhotoUploadSessions)
          .where(eq(publicPhotoUploadSessions.tokenHash, hashPublicUploadToken(input.uploadToken!))).limit(1);
        if (!session || session.consumedAt || new Date() > session.expiresAt) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Photo-upload session is invalid or expired." });
        }
        const [upload] = await db.select({ id: publicPhotoUploads.id }).from(publicPhotoUploads)
          .where(and(eq(publicPhotoUploads.sessionId, session.id), eq(publicPhotoUploads.photoKey, input.photoKey), eq(publicPhotoUploads.photoUrl, input.photoUrl))).limit(1);
        if (!upload) throw new TRPCError({ code: "FORBIDDEN", message: "Photo was not registered to this upload session." });
        return { id: upload.id, pendingAssociation: true };
      }),

    // List photos for a booking or all owner photos
    list: protectedProcedure
      .input(z.object({
        bookingId: z.number().int().positive().optional(),
        clientId: z.number().int().positive().optional(),
        photoType: z.enum(["estimate", "wip", "finished", "receipt"]).optional(),
      }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const conditions = [eq(jobPhotos.userId, ctx.user.id)];
        if (input.bookingId) conditions.push(eq(jobPhotos.bookingId, input.bookingId));
        if (input.clientId) conditions.push(eq(jobPhotos.clientId, input.clientId));
        if (input.photoType) conditions.push(eq(jobPhotos.photoType, input.photoType));
        return db.select().from(jobPhotos)
          .where(and(...conditions))
          .orderBy(jobPhotos.sortOrder, desc(jobPhotos.createdAt));
      }),

    listAttachableForJob: protectedProcedure
      .input(z.object({ jobId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const [job] = await db.select({ id: jobs.id, clientId: jobs.clientId }).from(jobs)
          .where(and(eq(jobs.id, input.jobId), eq(jobs.userId, ctx.user.id))).limit(1);
        if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
        return db.select({
          id: jobPhotos.id,
          photoUrl: jobPhotos.photoUrl,
          photoType: jobPhotos.photoType,
          caption: jobPhotos.caption,
          createdAt: jobPhotos.createdAt,
        }).from(jobPhotos).where(and(
          eq(jobPhotos.userId, ctx.user.id),
          isNull(jobPhotos.jobId),
          ne(jobPhotos.photoType, "receipt"),
          or(isNull(jobPhotos.clientId), eq(jobPhotos.clientId, job.clientId)),
        )).orderBy(jobPhotos.sortOrder, desc(jobPhotos.createdAt));
      }),

    // Update caption or line item details
    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        caption: z.string().max(512).optional(),
        lineItemLabel: z.string().max(255).optional(),
        lineItemAmount: z.number().min(0).optional(),
        sortOrder: z.number().int().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.update(jobPhotos).set({
          caption: input.caption ?? undefined,
          lineItemLabel: input.lineItemLabel ?? undefined,
          lineItemAmount: input.lineItemAmount != null ? String(input.lineItemAmount) : undefined,
          sortOrder: input.sortOrder ?? undefined,
        }).where(and(eq(jobPhotos.id, input.id), eq(jobPhotos.userId, ctx.user.id)));
        return { success: true };
      }),

    // Delete a photo
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.delete(jobPhotos)
          .where(and(eq(jobPhotos.id, input.id), eq(jobPhotos.userId, ctx.user.id)));
        return { success: true };
      }),
    extractReceiptTotal: protectedProcedure
      .input(z.object({ photoId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [photo] = await db.select({
          photoUrl: jobPhotos.photoUrl,
          photoKey: jobPhotos.photoKey,
          photoType: jobPhotos.photoType,
        }).from(jobPhotos)
          .where(and(eq(jobPhotos.id, input.photoId), eq(jobPhotos.userId, ctx.user.id)))
          .limit(1);
        if (!photo || photo.photoType !== "receipt" || !isOwnerPhotoKeyForType(photo.photoKey, ctx.user.id, "receipt")) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Receipt photo not found." });
        }
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a receipt OCR assistant. Extract all line items and the grand total from the receipt image provided. Return a JSON object with:
- items: array of { description: string, qty: number, unitPrice: number } (qty defaults to 1 if not shown, unitPrice is the per-unit cost)
- subtotal: number (sum before tax, 0 if not shown)
- tax: number (tax amount, 0 if not shown)
- total: number (the final grand total — the most important field)
- currency: string (e.g. "USD", default "USD")
- note: string (any caveat about readability, empty string if clear)
Be precise with dollar amounts. If a value is ambiguous, use your best estimate.`,
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Please extract all line items and the total from this receipt image." },
                { type: "image_url", image_url: { url: photo.photoUrl, detail: "high" } },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "receipt_extraction",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        description: { type: "string" },
                        qty: { type: "number" },
                        unitPrice: { type: "number" },
                      },
                      required: ["description", "qty", "unitPrice"],
                      additionalProperties: false,
                    },
                  },
                  subtotal: { type: "number" },
                  tax: { type: "number" },
                  total: { type: "number" },
                  currency: { type: "string" },
                  note: { type: "string" },
                },
                required: ["items", "subtotal", "tax", "total", "currency", "note"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = (response as any).choices?.[0]?.message?.content ?? "{}";
        try {
          const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
          return {
            items: (parsed.items ?? []) as { description: string; qty: number; unitPrice: number }[],
            subtotal: Number(parsed.subtotal ?? 0),
            tax: Number(parsed.tax ?? 0),
            total: Number(parsed.total ?? 0),
            currency: String(parsed.currency ?? "USD"),
            note: String(parsed.note ?? ""),
          };
        } catch {
          return { items: [], subtotal: 0, tax: 0, total: 0, currency: "USD", note: "Could not parse receipt." };
        }
      }),
    // Add receipt line items to an existing invoice or create a new draft invoice
    addToInvoice: protectedProcedure
      .input(z.object({
        invoiceId: z.number().int().positive().optional(),
        clientName: z.string().min(1).max(255).optional(),
        clientEmail: z.string().email().optional(),
        clientId: z.number().int().positive().optional(),
        lineItems: z.array(z.object({
          description: z.string().trim().max(500),
          qty: z.number().positive().max(9999),
          unitPrice: z.number().min(0).max(999999),
        })).min(1),
        notes: z.string().max(2000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        if (input.invoiceId) {
          // Append line items to existing invoice
          const [existing] = await db.select()
            .from(invoices)
            .where(and(eq(invoices.id, input.invoiceId), eq(invoices.userId, ctx.user.id)))
            .limit(1);
          if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
          const existingItems: { description: string; qty: number; unitPrice: number }[] =
            existing.lineItems ? JSON.parse(existing.lineItems) : [];
          const merged = [...existingItems, ...input.lineItems];
          const newAmount = merged.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
          await db.update(invoices).set({
            lineItems: JSON.stringify(merged),
            amount: String(newAmount),
            updatedAt: new Date(),
          }).where(and(eq(invoices.id, input.invoiceId), eq(invoices.userId, ctx.user.id)));
          return { invoiceId: input.invoiceId, created: false };
        } else {
          // Create a new draft invoice
          const total = input.lineItems.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
          const invoiceNumber = generateInvoiceNumber();
          const [result] = await db.insert(invoices).values({
            userId: ctx.user.id,
            clientId: input.clientId ?? null,
            invoiceNumber,
            clientName: input.clientName ?? "New Client",
            clientEmail: input.clientEmail ?? null,
            service: input.lineItems.map(i => i.description).join(", "),
            amount: String(total),
            status: "draft",
            lineItems: JSON.stringify(input.lineItems),
            notes: input.notes ?? null,
          });
          return { invoiceId: (result as any).insertId as number, created: true };
        }
      }),
    // Calculate receipt total from all receipt-type photos for a booking
    receiptTotal: protectedProcedure
      .input(z.object({ bookingId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const items = await db.select()
          .from(jobPhotos)
          .where(and(
            eq(jobPhotos.userId, ctx.user.id),
            eq(jobPhotos.bookingId, input.bookingId),
            eq(jobPhotos.photoType, "receipt")
          ))
          .orderBy(jobPhotos.sortOrder, desc(jobPhotos.createdAt));
        const total = items.reduce((sum, p) => sum + parseFloat(String(p.lineItemAmount ?? "0")), 0);
        return { items, total: total.toFixed(2) };
      }),
  }),

  // ── Authenticated Staff Access ──────────────────────────────────────────────
  staffAccess: router({
    getInvite: publicProcedure
      .input(z.object({ token: z.string().trim().length(64) }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const now = new Date();
        const [invite] = await db.select({
          teamMemberName: teamMembers.name,
          email: workspaceStaffInvites.email,
          role: workspaceStaffInvites.role,
          expiresAt: workspaceStaffInvites.expiresAt,
          acceptedAt: workspaceStaffInvites.acceptedAt,
          revoked: workspaceStaffInvites.revoked,
          teamMemberActive: teamMembers.active,
        }).from(workspaceStaffInvites)
          .innerJoin(teamMembers, and(eq(workspaceStaffInvites.teamMemberId, teamMembers.id), eq(workspaceStaffInvites.ownerUserId, teamMembers.userId)))
          .where(eq(workspaceStaffInvites.token, input.token)).limit(1);
        if (!invite || !invite.teamMemberActive || invite.revoked || invite.acceptedAt || invite.expiresAt <= now) {
          throw new TRPCError({ code: "NOT_FOUND", message: "This staff access link is unavailable or expired." });
        }
        return {
          teamMemberName: invite.teamMemberName,
          role: invite.role,
          expiresAt: invite.expiresAt,
          canAcceptWithSignedInEmail: ctx.user ? isStaffInviteEmailMatch(invite.email, ctx.user.email) : null,
        };
      }),

    register: publicProcedure
      .input(z.object({
        token: z.string().trim().length(64),
        name: safeString(255),
        email: safeEmail,
        password: strongPasswordSchema,
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const email = normalizeStaffInviteEmail(input.email);
        if (!email) throw new TRPCError({ code: "BAD_REQUEST", message: "This staff access link is unavailable or does not match this email address." });
        const now = new Date();
        const [invite] = await db.select({
          id: workspaceStaffInvites.id,
          ownerUserId: workspaceStaffInvites.ownerUserId,
          teamMemberId: workspaceStaffInvites.teamMemberId,
          email: workspaceStaffInvites.email,
          role: workspaceStaffInvites.role,
          expiresAt: workspaceStaffInvites.expiresAt,
          acceptedAt: workspaceStaffInvites.acceptedAt,
          revoked: workspaceStaffInvites.revoked,
          teamMemberActive: teamMembers.active,
        }).from(workspaceStaffInvites)
          .innerJoin(teamMembers, and(eq(workspaceStaffInvites.teamMemberId, teamMembers.id), eq(workspaceStaffInvites.ownerUserId, teamMembers.userId)))
          .where(eq(workspaceStaffInvites.token, input.token)).limit(1);
        if (!invite || !invite.teamMemberActive || invite.revoked || invite.acceptedAt || invite.expiresAt <= now || !isStaffInviteEmailMatch(invite.email, email)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This staff access link is unavailable or does not match this email address." });
        }
        const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
        if (existingUser) throw new TRPCError({ code: "CONFLICT", message: "An account already exists for this email. Sign in to accept the staff access link." });
        const passwordHash = await hashPassword(input.password);
        let userId = 0;
        try {
          await db.transaction(async (tx) => {
            const claim = await tx.update(workspaceStaffInvites).set({ acceptedAt: now })
              .where(and(eq(workspaceStaffInvites.id, invite.id), eq(workspaceStaffInvites.revoked, false), isNull(workspaceStaffInvites.acceptedAt), gt(workspaceStaffInvites.expiresAt, now), normalizedStaffInviteEmailPredicate(email), activeStaffInviteRosterPredicate(invite)));
            if (!claim[0].affectedRows) throw new TRPCError({ code: "BAD_REQUEST", message: "This staff access link is no longer available." });
            const [userResult] = await tx.insert(users).values({ openId: `email:${email}`, name: input.name, email, loginMethod: "email", passwordHash, lastSignedIn: now });
            userId = Number(userResult.insertId);
            await tx.insert(workspaceStaffMemberships).values({ ownerUserId: invite.ownerUserId, memberUserId: userId, teamMemberId: invite.teamMemberId, role: invite.role, active: true, acceptedAt: now });
            await tx.update(workspaceStaffInvites).set({ acceptedUserId: userId }).where(and(eq(workspaceStaffInvites.id, invite.id), isNull(workspaceStaffInvites.acceptedUserId)));
          });
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: "CONFLICT", message: "Unable to activate staff access. Please ask the workspace owner for a new link." });
        }
        const token = await createSessionToken(userId, email);
        await recordSession(userId, token, ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
        return { success: true, user: { id: userId, name: input.name, email, role: "staff" } };
      }),

    accept: staffProcedure
      .input(z.object({ token: z.string().trim().length(64) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const now = new Date();
        const [invite] = await db.select({
          id: workspaceStaffInvites.id,
          ownerUserId: workspaceStaffInvites.ownerUserId,
          teamMemberId: workspaceStaffInvites.teamMemberId,
          email: workspaceStaffInvites.email,
          role: workspaceStaffInvites.role,
          expiresAt: workspaceStaffInvites.expiresAt,
          acceptedAt: workspaceStaffInvites.acceptedAt,
          revoked: workspaceStaffInvites.revoked,
          teamMemberActive: teamMembers.active,
        }).from(workspaceStaffInvites)
          .innerJoin(teamMembers, and(eq(workspaceStaffInvites.teamMemberId, teamMembers.id), eq(workspaceStaffInvites.ownerUserId, teamMembers.userId)))
          .where(eq(workspaceStaffInvites.token, input.token)).limit(1);
        const email = normalizeStaffInviteEmail(ctx.user.email);
        if (!invite || !email || !invite.teamMemberActive || invite.revoked || invite.acceptedAt || invite.expiresAt <= now || !isStaffInviteEmailMatch(invite.email, email)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This staff access link is unavailable or does not match your signed-in email." });
        }
        try {
          await db.transaction(async (tx) => {
            const claim = await tx.update(workspaceStaffInvites).set({ acceptedAt: now, acceptedUserId: ctx.user.id })
              .where(and(eq(workspaceStaffInvites.id, invite.id), eq(workspaceStaffInvites.revoked, false), isNull(workspaceStaffInvites.acceptedAt), gt(workspaceStaffInvites.expiresAt, now), normalizedStaffInviteEmailPredicate(email), activeStaffInviteRosterPredicate(invite)));
            if (!claim[0].affectedRows) throw new TRPCError({ code: "BAD_REQUEST", message: "This staff access link is no longer available." });
            const [existingByUser] = await tx.select({ id: workspaceStaffMemberships.id, teamMemberId: workspaceStaffMemberships.teamMemberId, active: workspaceStaffMemberships.active })
              .from(workspaceStaffMemberships).where(and(eq(workspaceStaffMemberships.ownerUserId, invite.ownerUserId), eq(workspaceStaffMemberships.memberUserId, ctx.user.id))).limit(1);
            if (existingByUser && existingByUser.teamMemberId !== invite.teamMemberId) throw new TRPCError({ code: "CONFLICT", message: "Your account already has staff access for another team member in this workspace." });
            if (existingByUser) {
              await tx.update(workspaceStaffMemberships).set({ role: invite.role, active: true, revokedAt: null, updatedAt: now }).where(eq(workspaceStaffMemberships.id, existingByUser.id));
            } else {
              await tx.insert(workspaceStaffMemberships).values({ ownerUserId: invite.ownerUserId, memberUserId: ctx.user.id, teamMemberId: invite.teamMemberId, role: invite.role, active: true, acceptedAt: now });
            }
          });
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: "CONFLICT", message: "Unable to activate staff access. Please ask the workspace owner for a new link." });
        }
        return { success: true };
      }),

    workspaces: staffProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select({
        ownerUserId: workspaceStaffMemberships.ownerUserId,
        teamMemberId: workspaceStaffMemberships.teamMemberId,
        role: workspaceStaffMemberships.role,
        teamMemberName: teamMembers.name,
        ownerName: users.name,
      }).from(workspaceStaffMemberships)
        .innerJoin(teamMembers, and(eq(workspaceStaffMemberships.teamMemberId, teamMembers.id), eq(workspaceStaffMemberships.ownerUserId, teamMembers.userId)))
        .innerJoin(users, eq(workspaceStaffMemberships.ownerUserId, users.id))
        .where(and(eq(workspaceStaffMemberships.memberUserId, ctx.user.id), eq(workspaceStaffMemberships.active, true), eq(teamMembers.active, true)));
    }),

    assignments: staffProcedure
      .input(z.object({ ownerUserId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const membership = await requireActiveStaffMembership(db, ctx.user.id, input.ownerUserId);
        const [assignments, visits] = await Promise.all([
          db.select({
            id: jobAssignments.id,
            jobId: jobs.id,
            jobNumber: jobs.jobNumber,
            jobTitle: jobs.title,
            jobStatus: jobs.status,
            assignmentRole: jobAssignments.assignmentRole,
            status: jobAssignments.status,
            plannedMinutes: jobAssignments.plannedMinutes,
            note: jobAssignments.note,
            targetDate: jobs.targetDate,
          }).from(jobAssignments)
            .innerJoin(jobs, and(eq(jobAssignments.jobId, jobs.id), eq(jobs.userId, input.ownerUserId)))
            .where(and(eq(jobAssignments.userId, input.ownerUserId), eq(jobAssignments.teamMemberId, membership.teamMemberId)))
            .orderBy(desc(jobAssignments.createdAt)),
          db.select({
            id: serviceVisits.id,
            jobId: serviceVisits.jobId,
            jobNumber: jobs.jobNumber,
            jobTitle: jobs.title,
            title: serviceVisits.title,
            scheduledStart: serviceVisits.scheduledStart,
            scheduledEnd: serviceVisits.scheduledEnd,
            status: serviceVisits.status,
            siteLabel: serviceVisits.siteLabel,
          }).from(serviceVisits)
            .innerJoin(jobs, and(eq(serviceVisits.jobId, jobs.id), eq(jobs.userId, input.ownerUserId)))
            .where(and(eq(serviceVisits.userId, input.ownerUserId), eq(serviceVisits.teamMemberId, membership.teamMemberId)))
            .orderBy(serviceVisits.scheduledStart),
        ]);
        return { membership, assignments, visits };
      }),

    updateAssignmentStatus: staffProcedure
      .input(z.object({ ownerUserId: z.number().int().positive(), assignmentId: z.number().int().positive(), status: z.enum(["acknowledged", "declined", "completed"]) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const membership = await requireActiveStaffMembership(db, ctx.user.id, input.ownerUserId);
        const [assignment] = await db.select({ id: jobAssignments.id, jobId: jobAssignments.jobId, status: jobAssignments.status })
          .from(jobAssignments).where(and(eq(jobAssignments.id, input.assignmentId), eq(jobAssignments.userId, input.ownerUserId), eq(jobAssignments.teamMemberId, membership.teamMemberId))).limit(1);
        if (!assignment) throw new TRPCError({ code: "NOT_FOUND", message: "Assigned work not found." });
        const expectedStatus = input.status === "completed" ? "acknowledged" : "assigned";
        if (assignment.status !== expectedStatus) throw new TRPCError({ code: "CONFLICT", message: "This assignment is no longer available for that update." });
        const now = new Date();
        const update = await db.update(jobAssignments).set({ status: input.status, acknowledgedAt: input.status === "acknowledged" ? now : undefined, completedAt: input.status === "completed" ? now : undefined, updatedAt: now })
          .where(and(eq(jobAssignments.id, assignment.id), eq(jobAssignments.userId, input.ownerUserId), eq(jobAssignments.teamMemberId, membership.teamMemberId), eq(jobAssignments.status, expectedStatus)));
        if (!update[0].affectedRows) throw new TRPCError({ code: "CONFLICT", message: "This assignment changed before your update could be saved." });
        await db.insert(jobActivities).values({ userId: input.ownerUserId, jobId: assignment.jobId, actor: "staff", eventType: "staff_assignment_status_changed", message: `${membership.teamMemberName} marked their assignment ${input.status.replaceAll("_", " ")}.`, metadata: JSON.stringify({ assignmentId: assignment.id, teamMemberId: membership.teamMemberId, status: input.status }) });
        return { success: true };
      }),
  }),

  // ── Team Operations & Resource Planning ─────────────────────────────────────
  team: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(teamMembers)
        .where(eq(teamMembers.userId, ctx.user.id))
        .orderBy(teamMembers.active, teamMembers.name);
    }),

    create: protectedProcedure
      .input(z.object({
        name: safeString(255),
        email: safeOptionalEmail.optional(),
        phone: safeOptionalString(32),
        role: z.enum(["coordinator", "manager", "specialist", "technician", "contractor"]).default("specialist"),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a 6-digit hex color.").default("#D4922A"),
        weeklyCapacityMinutes: z.number().int().min(60).max(10_080).default(2400),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [result] = await db.insert(teamMembers).values({
          userId: ctx.user.id,
          name: input.name,
          email: input.email?.trim().toLowerCase() || null,
          phone: input.phone ?? null,
          role: input.role,
          color: input.color,
          weeklyCapacityMinutes: input.weeklyCapacityMinutes,
          active: true,
        });
        return { id: Number(result.insertId) };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        name: safeOptionalString(255),
        email: safeOptionalEmail.optional(),
        phone: safeOptionalString(32),
        role: z.enum(["coordinator", "manager", "specialist", "technician", "contractor"]).optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a 6-digit hex color.").optional(),
        weeklyCapacityMinutes: z.number().int().min(60).max(10_080).optional(),
        active: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const { id, email, ...rest } = input;
        const updates: Record<string, unknown> = { ...rest, updatedAt: new Date() };
        if (email !== undefined) updates.email = email.trim().toLowerCase() || null;
        const result = await db.update(teamMembers).set(updates)
          .where(and(eq(teamMembers.id, id), eq(teamMembers.userId, ctx.user.id)));
        if (!result[0].affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "Team member not found." });
        return { success: true };
      }),

    listStaffAccess: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const [memberships, invites] = await Promise.all([
        db.select({
          id: workspaceStaffMemberships.id,
          teamMemberId: workspaceStaffMemberships.teamMemberId,
          role: workspaceStaffMemberships.role,
          active: workspaceStaffMemberships.active,
          acceptedAt: workspaceStaffMemberships.acceptedAt,
          revokedAt: workspaceStaffMemberships.revokedAt,
          teamMemberName: teamMembers.name,
          email: users.email,
          userName: users.name,
        }).from(workspaceStaffMemberships)
          .innerJoin(teamMembers, and(eq(workspaceStaffMemberships.teamMemberId, teamMembers.id), eq(teamMembers.userId, ctx.user.id)))
          .innerJoin(users, eq(workspaceStaffMemberships.memberUserId, users.id))
          .where(eq(workspaceStaffMemberships.ownerUserId, ctx.user.id)),
        db.select({
          id: workspaceStaffInvites.id,
          teamMemberId: workspaceStaffInvites.teamMemberId,
          email: workspaceStaffInvites.email,
          role: workspaceStaffInvites.role,
          expiresAt: workspaceStaffInvites.expiresAt,
          acceptedAt: workspaceStaffInvites.acceptedAt,
          revoked: workspaceStaffInvites.revoked,
          teamMemberName: teamMembers.name,
        }).from(workspaceStaffInvites)
          .innerJoin(teamMembers, and(eq(workspaceStaffInvites.teamMemberId, teamMembers.id), eq(teamMembers.userId, ctx.user.id)))
          .where(eq(workspaceStaffInvites.ownerUserId, ctx.user.id))
          .orderBy(desc(workspaceStaffInvites.createdAt)),
      ]);
      return { memberships, invites };
    }),

    createStaffInvite: protectedProcedure
      .input(z.object({
        teamMemberId: z.number().int().positive(),
        role: staffWorkspaceRoleSchema.default("field_member"),
        origin: safeUrl,
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const trustedOrigin = getTrustedPaymentReturnOrigin(input.origin);
        if (!trustedOrigin) throw new TRPCError({ code: "BAD_REQUEST", message: "Use an official TrueAxis HQ origin to create a staff access link." });
        const [member] = await db.select({ id: teamMembers.id, email: teamMembers.email, name: teamMembers.name, active: teamMembers.active })
          .from(teamMembers).where(and(eq(teamMembers.id, input.teamMemberId), eq(teamMembers.userId, ctx.user.id))).limit(1);
        if (!member?.active) throw new TRPCError({ code: "NOT_FOUND", message: "Choose an active team member." });
        const email = normalizeStaffInviteEmail(member.email);
        if (!email) throw new TRPCError({ code: "BAD_REQUEST", message: "Add an email address to this team member before creating access." });
        const [existingMembership] = await db.select({ id: workspaceStaffMemberships.id, active: workspaceStaffMemberships.active })
          .from(workspaceStaffMemberships).where(and(eq(workspaceStaffMemberships.ownerUserId, ctx.user.id), eq(workspaceStaffMemberships.teamMemberId, member.id))).limit(1);
        if (existingMembership?.active) throw new TRPCError({ code: "CONFLICT", message: "This team member already has active staff access." });
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const token = randomBytes(32).toString("hex");
        await db.update(workspaceStaffInvites).set({ revoked: true, revokedAt: now })
          .where(and(eq(workspaceStaffInvites.ownerUserId, ctx.user.id), eq(workspaceStaffInvites.teamMemberId, member.id), eq(workspaceStaffInvites.revoked, false), isNull(workspaceStaffInvites.acceptedAt)));
        const [result] = await db.insert(workspaceStaffInvites).values({ ownerUserId: ctx.user.id, teamMemberId: member.id, email, role: input.role, token, expiresAt });
        return { id: Number(result.insertId), expiresAt, accessUrl: `${trustedOrigin}/staff-access?token=${encodeURIComponent(token)}`, message: `Share this access link privately with ${member.name}. It does not send email automatically.` };
      }),

    revokeStaffAccess: protectedProcedure
      .input(z.object({ teamMemberId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const now = new Date();
        const [memberResult, inviteResult, membershipResult] = await Promise.all([
          db.update(teamMembers).set({ active: false, updatedAt: now }).where(and(eq(teamMembers.id, input.teamMemberId), eq(teamMembers.userId, ctx.user.id))),
          db.update(workspaceStaffInvites).set({ revoked: true, revokedAt: now }).where(and(eq(workspaceStaffInvites.ownerUserId, ctx.user.id), eq(workspaceStaffInvites.teamMemberId, input.teamMemberId), eq(workspaceStaffInvites.revoked, false))),
          db.update(workspaceStaffMemberships).set({ active: false, revokedAt: now, updatedAt: now }).where(and(eq(workspaceStaffMemberships.ownerUserId, ctx.user.id), eq(workspaceStaffMemberships.teamMemberId, input.teamMemberId), eq(workspaceStaffMemberships.active, true))),
        ]);
        if (!memberResult[0].affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "Team member not found." });
        return { success: true, revokedInviteCount: inviteResult[0].affectedRows, revokedMembershipCount: membershipResult[0].affectedRows };
      }),

    capacity: protectedProcedure.input(z.object({ weekStart: z.string().datetime().optional() }).optional()).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const now = new Date();
      const requestedWeekStart = input?.weekStart ? new Date(input.weekStart) : now;
      if (Number.isNaN(requestedWeekStart.getTime())) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a valid UTC planning week." });
      const weekStart = new Date(Date.UTC(requestedWeekStart.getUTCFullYear(), requestedWeekStart.getUTCMonth(), requestedWeekStart.getUTCDate() - ((requestedWeekStart.getUTCDay() + 6) % 7)));
      if (input?.weekStart && requestedWeekStart.getTime() !== weekStart.getTime()) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a Monday at 00:00 UTC for the planning week." });
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      const [members, assignments, scheduledVisits, availabilityBlocks] = await Promise.all([
        db.select().from(teamMembers).where(eq(teamMembers.userId, ctx.user.id)).orderBy(teamMembers.active, teamMembers.name),
        db.select({
          teamMemberId: jobAssignments.teamMemberId,
          plannedMinutes: jobAssignments.plannedMinutes,
          status: jobAssignments.status,
        }).from(jobAssignments).where(and(
          eq(jobAssignments.userId, ctx.user.id),
          inArray(jobAssignments.status, ["assigned", "acknowledged"]),
        )),
        db.select({ teamMemberId: serviceVisits.teamMemberId, scheduledStart: serviceVisits.scheduledStart, scheduledEnd: serviceVisits.scheduledEnd })
          .from(serviceVisits).where(and(
            eq(serviceVisits.userId, ctx.user.id),
            inArray(serviceVisits.status, ["scheduled", "en_route", "in_progress"]),
            lt(serviceVisits.scheduledStart, weekEnd),
            gt(serviceVisits.scheduledEnd, weekStart),
          )),
        db.select({ teamMemberId: staffAvailabilityBlocks.teamMemberId, startsAt: staffAvailabilityBlocks.startsAt, endsAt: staffAvailabilityBlocks.endsAt })
          .from(staffAvailabilityBlocks).where(and(
            eq(staffAvailabilityBlocks.userId, ctx.user.id),
            lt(staffAvailabilityBlocks.startsAt, weekEnd),
            gt(staffAvailabilityBlocks.endsAt, weekStart),
          )),
      ]);
      return members.map(member => {
        const plannedMinutes = assignments
          .filter(assignment => assignment.teamMemberId === member.id)
          .reduce((sum, assignment) => sum + Math.max(0, assignment.plannedMinutes ?? 0), 0);
        const capacity = Math.max(1, member.weeklyCapacityMinutes);
        const scheduledMinutes = scheduledVisits
          .filter(visit => visit.teamMemberId === member.id)
          .reduce((sum, visit) => {
            const scheduledStart = Math.max(visit.scheduledStart.getTime(), weekStart.getTime());
            const scheduledEnd = Math.min(visit.scheduledEnd.getTime(), weekEnd.getTime());
            return sum + Math.max(0, Math.round((scheduledEnd - scheduledStart) / 60_000));
          }, 0);
        const privateAvailabilityMinutes = availabilityBlocks
          .filter(block => block.teamMemberId === member.id)
          .reduce((sum, block) => {
            const startsAt = Math.max(block.startsAt.getTime(), weekStart.getTime());
            const endsAt = Math.min(block.endsAt.getTime(), weekEnd.getTime());
            return sum + Math.max(0, Math.round((endsAt - startsAt) / 60_000));
          }, 0);
        return {
          ...member,
          plannedMinutes,
          remainingMinutes: Math.max(0, capacity - plannedMinutes),
          loadRatio: plannedMinutes / capacity,
          overCapacity: plannedMinutes > capacity,
          scheduledMinutes,
          scheduledRemainingMinutes: Math.max(0, capacity - scheduledMinutes),
          scheduledLoadRatio: scheduledMinutes / capacity,
          scheduledOverCapacity: scheduledMinutes > capacity,
          privateAvailabilityMinutes,
          scheduleWindow: { startsAt: weekStart, endsAt: weekEnd },
        };
      });
    }),

    listAssignments: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select({
        id: jobAssignments.id,
        jobId: jobAssignments.jobId,
        jobNumber: jobs.jobNumber,
        jobTitle: jobs.title,
        jobStatus: jobs.status,
        teamMemberId: jobAssignments.teamMemberId,
        teamMemberName: teamMembers.name,
        teamMemberRole: teamMembers.role,
        teamMemberColor: teamMembers.color,
        assignmentRole: jobAssignments.assignmentRole,
        status: jobAssignments.status,
        plannedMinutes: jobAssignments.plannedMinutes,
        note: jobAssignments.note,
        acknowledgedAt: jobAssignments.acknowledgedAt,
        completedAt: jobAssignments.completedAt,
        createdAt: jobAssignments.createdAt,
      }).from(jobAssignments)
        .innerJoin(jobs, and(eq(jobAssignments.jobId, jobs.id), eq(jobs.userId, ctx.user.id)))
        .innerJoin(teamMembers, and(eq(jobAssignments.teamMemberId, teamMembers.id), eq(teamMembers.userId, ctx.user.id)))
        .where(eq(jobAssignments.userId, ctx.user.id))
        .orderBy(desc(jobAssignments.createdAt));
    }),

    assignToJob: protectedProcedure
      .input(z.object({
        jobId: z.number().int().positive(),
        teamMemberId: z.number().int().positive(),
        assignmentRole: z.enum(["lead", "support", "reviewer", "coordinator"]).default("support"),
        plannedMinutes: z.number().int().min(0).max(10_080).optional(),
        note: safeOptionalString(1000),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [[job], [member], [existing]] = await Promise.all([
          db.select({ id: jobs.id, title: jobs.title }).from(jobs).where(and(eq(jobs.id, input.jobId), eq(jobs.userId, ctx.user.id))).limit(1),
          db.select({ id: teamMembers.id, name: teamMembers.name, active: teamMembers.active }).from(teamMembers).where(and(eq(teamMembers.id, input.teamMemberId), eq(teamMembers.userId, ctx.user.id))).limit(1),
          db.select({ id: jobAssignments.id }).from(jobAssignments).where(and(eq(jobAssignments.userId, ctx.user.id), eq(jobAssignments.jobId, input.jobId), eq(jobAssignments.teamMemberId, input.teamMemberId))).limit(1),
        ]);
        if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
        if (!member || !member.active) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an active team member." });
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "This team member is already assigned to the job." });
        const [result] = await db.insert(jobAssignments).values({
          userId: ctx.user.id,
          jobId: input.jobId,
          teamMemberId: input.teamMemberId,
          assignmentRole: input.assignmentRole,
          plannedMinutes: input.plannedMinutes ?? null,
          note: input.note ?? null,
        });
        await db.insert(jobActivities).values({
          userId: ctx.user.id,
          jobId: input.jobId,
          actor: "owner",
          eventType: "team_member_assigned",
          message: `${member.name} assigned as ${input.assignmentRole} on this job.`,
          metadata: JSON.stringify({ assignmentId: Number(result.insertId), teamMemberId: member.id, assignmentRole: input.assignmentRole }),
        });
        return { id: Number(result.insertId) };
      }),

    updateAssignment: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        assignmentRole: z.enum(["lead", "support", "reviewer", "coordinator"]).optional(),
        status: z.enum(["assigned", "acknowledged", "declined", "completed"]).optional(),
        plannedMinutes: z.number().int().min(0).max(10_080).nullable().optional(),
        note: safeOptionalString(1000),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [assignment] = await db.select({ id: jobAssignments.id, jobId: jobAssignments.jobId, status: jobAssignments.status })
          .from(jobAssignments).where(and(eq(jobAssignments.id, input.id), eq(jobAssignments.userId, ctx.user.id))).limit(1);
        if (!assignment) throw new TRPCError({ code: "NOT_FOUND", message: "Assignment not found." });
        const { id, status, ...rest } = input;
        const updates: Record<string, unknown> = { ...rest, updatedAt: new Date() };
        if (status) {
          updates.status = status;
          if (status === "acknowledged" && assignment.status !== "acknowledged") updates.acknowledgedAt = new Date();
          if (status === "completed" && assignment.status !== "completed") updates.completedAt = new Date();
        }
        await db.update(jobAssignments).set(updates).where(and(eq(jobAssignments.id, id), eq(jobAssignments.userId, ctx.user.id)));
        if (status && status !== assignment.status) {
          await db.insert(jobActivities).values({
            userId: ctx.user.id,
            jobId: assignment.jobId,
            actor: "owner",
            eventType: "assignment_status_changed",
            message: `Assignment status changed to ${status.replaceAll("_", " ")}.`,
          });
        }
        return { success: true };
      }),

    removeAssignment: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [assignment] = await db.select({ jobId: jobAssignments.jobId, teamMemberId: jobAssignments.teamMemberId }).from(jobAssignments)
          .where(and(eq(jobAssignments.id, input.id), eq(jobAssignments.userId, ctx.user.id))).limit(1);
        if (!assignment) throw new TRPCError({ code: "NOT_FOUND", message: "Assignment not found." });
        await db.delete(jobAssignments).where(and(eq(jobAssignments.id, input.id), eq(jobAssignments.userId, ctx.user.id)));
        await db.insert(jobActivities).values({ userId: ctx.user.id, jobId: assignment.jobId, actor: "owner", eventType: "team_member_unassigned", message: "Removed a team assignment from this job." });
        return { success: true };
      }),
  }),

  // ── Dispatch Planning ───────────────────────────────────────────────────────
  dispatch: router({
    listVisits: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const [visits, availabilityBlocks] = await Promise.all([
        db.select({
        id: serviceVisits.id,
        jobId: serviceVisits.jobId,
        jobNumber: jobs.jobNumber,
        jobTitle: jobs.title,
        clientName: clients.name,
        teamMemberId: serviceVisits.teamMemberId,
        teamMemberName: teamMembers.name,
        teamMemberColor: teamMembers.color,
        title: serviceVisits.title,
        scheduledStart: serviceVisits.scheduledStart,
        scheduledEnd: serviceVisits.scheduledEnd,
        status: serviceVisits.status,
        siteLabel: serviceVisits.siteLabel,
        dispatchNote: serviceVisits.dispatchNote,
        clientVisible: serviceVisits.clientVisible,
        clientUpdate: serviceVisits.clientUpdate,
        createdAt: serviceVisits.createdAt,
      }).from(serviceVisits)
        .innerJoin(jobs, and(eq(serviceVisits.jobId, jobs.id), eq(jobs.userId, ctx.user.id)))
        .innerJoin(clients, and(eq(jobs.clientId, clients.id), eq(clients.userId, ctx.user.id)))
        .leftJoin(teamMembers, and(eq(serviceVisits.teamMemberId, teamMembers.id), eq(teamMembers.userId, ctx.user.id)))
        .where(eq(serviceVisits.userId, ctx.user.id))
        .orderBy(serviceVisits.scheduledStart),
        db.select({ teamMemberId: staffAvailabilityBlocks.teamMemberId, startsAt: staffAvailabilityBlocks.startsAt, endsAt: staffAvailabilityBlocks.endsAt })
          .from(staffAvailabilityBlocks).where(eq(staffAvailabilityBlocks.userId, ctx.user.id)),
      ]);
      return visits.map(visit => ({
        ...visit,
        availabilityConflict: visit.status !== "cancelled" && visit.teamMemberId !== null && availabilityBlocks.some(block => block.teamMemberId === visit.teamMemberId && block.startsAt < visit.scheduledEnd && block.endsAt > visit.scheduledStart),
      }));
    }),

    listAvailabilityBlocks: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select({
        id: staffAvailabilityBlocks.id,
        teamMemberId: staffAvailabilityBlocks.teamMemberId,
        teamMemberName: teamMembers.name,
        teamMemberColor: teamMembers.color,
        startsAt: staffAvailabilityBlocks.startsAt,
        endsAt: staffAvailabilityBlocks.endsAt,
        reason: staffAvailabilityBlocks.reason,
      }).from(staffAvailabilityBlocks)
        .innerJoin(teamMembers, and(eq(staffAvailabilityBlocks.teamMemberId, teamMembers.id), eq(teamMembers.userId, ctx.user.id)))
        .where(eq(staffAvailabilityBlocks.userId, ctx.user.id))
        .orderBy(staffAvailabilityBlocks.startsAt);
    }),

    createAvailabilityBlock: protectedProcedure
      .input(z.object({ teamMemberId: z.number().int().positive(), startsAt: z.date(), endsAt: z.date(), reason: safeOptionalString(500) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        if (input.endsAt <= input.startsAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Availability must end after it starts." });
        const [member] = await db.select({ id: teamMembers.id, active: teamMembers.active }).from(teamMembers)
          .where(and(eq(teamMembers.id, input.teamMemberId), eq(teamMembers.userId, ctx.user.id))).limit(1);
        if (!member?.active) throw new TRPCError({ code: "NOT_FOUND", message: "Active team member not found." });
        const [overlap] = await db.select({ id: staffAvailabilityBlocks.id }).from(staffAvailabilityBlocks)
          .where(and(eq(staffAvailabilityBlocks.userId, ctx.user.id), eq(staffAvailabilityBlocks.teamMemberId, input.teamMemberId), lt(staffAvailabilityBlocks.startsAt, input.endsAt), gt(staffAvailabilityBlocks.endsAt, input.startsAt))).limit(1);
        if (overlap) throw new TRPCError({ code: "CONFLICT", message: "This overlaps an existing private availability block for the selected team member." });
        const [result] = await db.insert(staffAvailabilityBlocks).values({ userId: ctx.user.id, teamMemberId: input.teamMemberId, startsAt: input.startsAt, endsAt: input.endsAt, reason: input.reason || null });
        return { id: Number((result as any).insertId), success: true };
      }),

    updateAvailabilityBlock: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), startsAt: z.date(), endsAt: z.date(), reason: safeOptionalString(500) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        if (input.endsAt <= input.startsAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Availability must end after it starts." });
        const [block] = await db.select({ id: staffAvailabilityBlocks.id, teamMemberId: staffAvailabilityBlocks.teamMemberId })
          .from(staffAvailabilityBlocks).where(and(eq(staffAvailabilityBlocks.id, input.id), eq(staffAvailabilityBlocks.userId, ctx.user.id))).limit(1);
        if (!block) throw new TRPCError({ code: "NOT_FOUND", message: "Private availability block not found." });
        const [overlap] = await db.select({ id: staffAvailabilityBlocks.id }).from(staffAvailabilityBlocks)
          .where(and(
            eq(staffAvailabilityBlocks.userId, ctx.user.id),
            eq(staffAvailabilityBlocks.teamMemberId, block.teamMemberId),
            ne(staffAvailabilityBlocks.id, input.id),
            lt(staffAvailabilityBlocks.startsAt, input.endsAt),
            gt(staffAvailabilityBlocks.endsAt, input.startsAt),
          )).limit(1);
        if (overlap) throw new TRPCError({ code: "CONFLICT", message: "This overlaps another private availability block for the same team member." });
        await db.update(staffAvailabilityBlocks).set({ startsAt: input.startsAt, endsAt: input.endsAt, reason: input.reason || null, updatedAt: new Date() })
          .where(and(eq(staffAvailabilityBlocks.id, input.id), eq(staffAvailabilityBlocks.userId, ctx.user.id)));
        return { success: true };
      }),

    deleteAvailabilityBlock: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const result = await db.delete(staffAvailabilityBlocks).where(and(eq(staffAvailabilityBlocks.id, input.id), eq(staffAvailabilityBlocks.userId, ctx.user.id)));
        if (!result[0].affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "Private availability block not found." });
        return { success: true };
      }),

    createVisit: protectedProcedure
      .input(z.object({
        jobId: z.number().int().positive(),
        teamMemberId: z.number().int().positive(),
        title: safeString(255),
        scheduledStart: z.date(),
        scheduledEnd: z.date(),
        siteLabel: safeOptionalString(255),
        dispatchNote: safeOptionalString(1000),
        clientVisible: z.boolean().default(false),
        clientUpdate: z.string().trim().max(500).nullable().optional(),
        allowConflict: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        if (input.scheduledEnd <= input.scheduledStart) throw new TRPCError({ code: "BAD_REQUEST", message: "A service visit must end after it starts." });
        const [[job], [member], [assignment], existingVisits, availabilityBlocks] = await Promise.all([
          db.select({ id: jobs.id, title: jobs.title }).from(jobs).where(and(eq(jobs.id, input.jobId), eq(jobs.userId, ctx.user.id))).limit(1),
          db.select({ id: teamMembers.id, name: teamMembers.name, active: teamMembers.active }).from(teamMembers).where(and(eq(teamMembers.id, input.teamMemberId), eq(teamMembers.userId, ctx.user.id))).limit(1),
          db.select({ id: jobAssignments.id }).from(jobAssignments).where(and(
            eq(jobAssignments.userId, ctx.user.id),
            eq(jobAssignments.jobId, input.jobId),
            eq(jobAssignments.teamMemberId, input.teamMemberId),
            inArray(jobAssignments.status, ["assigned", "acknowledged"]),
          )).limit(1),
          db.select({ id: serviceVisits.id, scheduledStart: serviceVisits.scheduledStart, scheduledEnd: serviceVisits.scheduledEnd, status: serviceVisits.status })
            .from(serviceVisits).where(and(eq(serviceVisits.userId, ctx.user.id), eq(serviceVisits.teamMemberId, input.teamMemberId))),
          db.select({ startsAt: staffAvailabilityBlocks.startsAt, endsAt: staffAvailabilityBlocks.endsAt }).from(staffAvailabilityBlocks)
            .where(and(eq(staffAvailabilityBlocks.userId, ctx.user.id), eq(staffAvailabilityBlocks.teamMemberId, input.teamMemberId))),
        ]);
        if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
        if (!member?.active) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an active team member." });
        if (!assignment) throw new TRPCError({ code: "BAD_REQUEST", message: "Assign this team member to the job before dispatching a visit." });
        const visitConflict = hasDispatchConflict(existingVisits.map(visit => ({ id: visit.id, start: visit.scheduledStart, end: visit.scheduledEnd, status: visit.status })), {
          start: input.scheduledStart,
          end: input.scheduledEnd,
          status: "scheduled",
        });
        const availabilityConflict = availabilityBlocks.some(block => block.startsAt < input.scheduledEnd && block.endsAt > input.scheduledStart);
        const conflict = visitConflict || availabilityConflict;
        if (conflict && !input.allowConflict) throw new TRPCError({ code: "CONFLICT", message: availabilityConflict ? "This visit overlaps a private availability block for the selected team member. Confirm the exception to schedule it." : "This visit overlaps another active visit for the selected team member. Confirm the exception to schedule it." });
        const [result] = await db.insert(serviceVisits).values({
          userId: ctx.user.id,
          jobId: input.jobId,
          teamMemberId: input.teamMemberId,
          title: input.title,
          scheduledStart: input.scheduledStart,
          scheduledEnd: input.scheduledEnd,
          siteLabel: input.siteLabel ?? null,
          dispatchNote: input.dispatchNote ?? null,
          clientVisible: input.clientVisible,
          clientUpdate: input.clientVisible ? input.clientUpdate ?? null : null,
        });
        await db.insert(jobActivities).values({
          userId: ctx.user.id,
          jobId: input.jobId,
          actor: "owner",
          eventType: "service_visit_scheduled",
          message: `${member.name} scheduled for ${input.title}.`,
          metadata: JSON.stringify({ visitId: Number(result.insertId), teamMemberId: member.id, scheduledStart: input.scheduledStart.toISOString(), conflictAcknowledged: conflict, availabilityConflictAcknowledged: availabilityConflict }),
        });
        await deliverWorkflowWebhookEvent(db, ctx.user.id, "service_visit.scheduled", { visitId: Number(result.insertId), jobId: input.jobId, teamMemberId: member.id, title: input.title, scheduledStart: input.scheduledStart.toISOString(), scheduledEnd: input.scheduledEnd.toISOString() });
        return { id: Number(result.insertId), conflictAcknowledged: conflict };
      }),

    updateVisit: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        teamMemberId: z.number().int().positive().optional(),
        title: safeOptionalString(255),
        scheduledStart: z.date().optional(),
        scheduledEnd: z.date().optional(),
        status: z.enum(["scheduled", "en_route", "in_progress", "completed", "cancelled"]).optional(),
        siteLabel: safeOptionalString(255),
        dispatchNote: safeOptionalString(1000),
        clientVisible: z.boolean().optional(),
        clientUpdate: z.string().trim().max(500).nullable().optional(),
        allowConflict: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [visit] = await db.select().from(serviceVisits).where(and(eq(serviceVisits.id, input.id), eq(serviceVisits.userId, ctx.user.id))).limit(1);
        if (!visit) throw new TRPCError({ code: "NOT_FOUND", message: "Service visit not found." });
        const scheduledStart = input.scheduledStart ?? visit.scheduledStart;
        const scheduledEnd = input.scheduledEnd ?? visit.scheduledEnd;
        const status = input.status ?? visit.status;
        const teamMemberId = input.teamMemberId ?? visit.teamMemberId;
        if (scheduledEnd <= scheduledStart) throw new TRPCError({ code: "BAD_REQUEST", message: "A service visit must end after it starts." });
        if ((input.scheduledStart || input.scheduledEnd) && (["completed", "cancelled"].includes(visit.status) || ["completed", "cancelled"].includes(status))) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only active service visits can have their time corrected." });
        }
        if (input.clientUpdate !== undefined && ["completed", "cancelled"].includes(visit.status)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only active service visits can have client updates corrected." });
        }
        let reassignedMemberName: string | null = null;
        if (input.teamMemberId !== undefined && input.teamMemberId !== visit.teamMemberId) {
          if (["completed", "cancelled"].includes(visit.status) || ["completed", "cancelled"].includes(status)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Only active service visits can be reassigned." });
          }
          const [[member], [assignment]] = await Promise.all([
            db.select({ id: teamMembers.id, name: teamMembers.name, active: teamMembers.active }).from(teamMembers)
              .where(and(eq(teamMembers.id, input.teamMemberId), eq(teamMembers.userId, ctx.user.id))).limit(1),
            db.select({ id: jobAssignments.id }).from(jobAssignments).where(and(
              eq(jobAssignments.userId, ctx.user.id),
              eq(jobAssignments.jobId, visit.jobId),
              eq(jobAssignments.teamMemberId, input.teamMemberId),
              inArray(jobAssignments.status, ["assigned", "acknowledged"]),
            )).limit(1),
          ]);
          if (!member?.active || !assignment) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an active team member assigned to this job." });
          }
          reassignedMemberName = member.name;
        }
        if (teamMemberId && (input.teamMemberId !== undefined || input.scheduledStart || input.scheduledEnd || (input.status && input.status !== "cancelled")) && status !== "cancelled") {
          const [existingVisits, availabilityBlocks] = await Promise.all([
            db.select({ id: serviceVisits.id, scheduledStart: serviceVisits.scheduledStart, scheduledEnd: serviceVisits.scheduledEnd, status: serviceVisits.status })
              .from(serviceVisits).where(and(eq(serviceVisits.userId, ctx.user.id), eq(serviceVisits.teamMemberId, teamMemberId))),
            db.select({ startsAt: staffAvailabilityBlocks.startsAt, endsAt: staffAvailabilityBlocks.endsAt }).from(staffAvailabilityBlocks)
              .where(and(eq(staffAvailabilityBlocks.userId, ctx.user.id), eq(staffAvailabilityBlocks.teamMemberId, teamMemberId))),
          ]);
          const visitConflict = hasDispatchConflict(existingVisits.map(item => ({ id: item.id, start: item.scheduledStart, end: item.scheduledEnd, status: item.status })), {
            id: visit.id,
            start: scheduledStart,
            end: scheduledEnd,
            status,
          });
          const availabilityConflict = availabilityBlocks.some(block => block.startsAt < scheduledEnd && block.endsAt > scheduledStart);
          const conflict = visitConflict || availabilityConflict;
          if (conflict && !input.allowConflict) throw new TRPCError({ code: "CONFLICT", message: availabilityConflict ? "This visit overlaps a private availability block for the selected team member. Confirm the exception to save it." : "This visit overlaps another active visit for the selected team member. Confirm the exception to save it." });
        }
        const { id, allowConflict: _allowConflict, clientVisible: clientVisibleInput, clientUpdate: clientUpdateInput, ...rest } = input;
        const clientVisible = clientVisibleInput ?? visit.clientVisible;
        const clientUpdate = clientVisible ? (clientUpdateInput === undefined ? visit.clientUpdate : clientUpdateInput) : null;
        await db.update(serviceVisits).set({ ...rest, clientVisible, clientUpdate, updatedAt: new Date() }).where(and(eq(serviceVisits.id, id), eq(serviceVisits.userId, ctx.user.id)));
        if (input.scheduledStart || input.scheduledEnd) {
          await db.insert(jobActivities).values({
            userId: ctx.user.id,
            jobId: visit.jobId,
            actor: "owner",
            eventType: "service_visit_time_corrected",
            message: "Service visit timing corrected.",
            metadata: JSON.stringify({ visitId: visit.id, scheduledStart: scheduledStart.toISOString(), scheduledEnd: scheduledEnd.toISOString() }),
          });
        }
        if (reassignedMemberName) {
          await db.insert(jobActivities).values({
            userId: ctx.user.id,
            jobId: visit.jobId,
            actor: "owner",
            eventType: "service_visit_reassigned",
            message: `Service visit reassigned to ${reassignedMemberName}.`,
            metadata: JSON.stringify({ visitId: visit.id, teamMemberId }),
          });
        }
        if (input.status && input.status !== visit.status) {
          await db.insert(jobActivities).values({
            userId: ctx.user.id,
            jobId: visit.jobId,
            actor: "owner",
            eventType: "service_visit_status_changed",
            message: `Service visit status changed to ${input.status.replaceAll("_", " ")}.`,
            metadata: JSON.stringify({ visitId: visit.id, status: input.status }),
          });
          await deliverWorkflowWebhookEvent(db, ctx.user.id, "service_visit.status_changed", { visitId: visit.id, jobId: visit.jobId, previousStatus: visit.status, status: input.status });
          // Live tracking links live only while a visit is en route; leaving that state revokes them immediately.
          if (input.status !== "en_route") {
            await db.update(serviceVisitTrackLinks).set({ active: false, revokedAt: new Date() })
              .where(and(eq(serviceVisitTrackLinks.visitId, visit.id), eq(serviceVisitTrackLinks.active, true)));
          }
        }
        return { success: true };
      }),

    cancelVisit: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [visit] = await db.select({ jobId: serviceVisits.jobId, status: serviceVisits.status }).from(serviceVisits)
          .where(and(eq(serviceVisits.id, input.id), eq(serviceVisits.userId, ctx.user.id))).limit(1);
        if (!visit) throw new TRPCError({ code: "NOT_FOUND", message: "Service visit not found." });
        await db.update(serviceVisits).set({ status: "cancelled", updatedAt: new Date() }).where(and(eq(serviceVisits.id, input.id), eq(serviceVisits.userId, ctx.user.id)));
        if (visit.status !== "cancelled") await db.insert(jobActivities).values({ userId: ctx.user.id, jobId: visit.jobId, actor: "owner", eventType: "service_visit_cancelled", message: "Cancelled a service visit." });
        return { success: true };
      }),
  }),

  recurringServicePlans: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select({
        id: recurringServicePlans.id,
        jobId: recurringServicePlans.jobId,
        customerAssetId: recurringServicePlans.customerAssetId,
        jobNumber: jobs.jobNumber,
        jobTitle: jobs.title,
        customerAssetName: customerAssets.name,
        customerAssetTag: customerAssets.assetTag,
        name: recurringServicePlans.name,
        serviceName: recurringServicePlans.serviceName,
        frequency: recurringServicePlans.frequency,
        weekday: recurringServicePlans.weekday,
        dayOfMonth: recurringServicePlans.dayOfMonth,
        startDate: recurringServicePlans.startDate,
        endDate: recurringServicePlans.endDate,
        startTime: recurringServicePlans.startTime,
        durationMinutes: recurringServicePlans.durationMinutes,
        nextVisitAt: recurringServicePlans.nextVisitAt,
        planningNote: recurringServicePlans.planningNote,
        active: recurringServicePlans.active,
        customerAssetActive: customerAssets.active,
      }).from(recurringServicePlans)
        .innerJoin(jobs, and(eq(recurringServicePlans.jobId, jobs.id), eq(jobs.userId, ctx.user.id)))
        .leftJoin(customerAssets, and(eq(recurringServicePlans.customerAssetId, customerAssets.id), eq(customerAssets.userId, ctx.user.id)))
        .where(eq(recurringServicePlans.userId, ctx.user.id))
        .orderBy(desc(recurringServicePlans.createdAt));
    }),

    create: protectedProcedure.input(z.object({
      jobId: z.number().int().positive(),
      customerAssetId: z.number().int().positive().nullable().optional(),
      name: safeString(255),
      serviceName: safeString(255),
      frequency: z.enum(["weekly", "monthly"]),
      weekday: z.number().int().min(0).max(6).nullable().optional(),
      dayOfMonth: z.number().int().min(1).max(28).nullable().optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("09:00"),
      durationMinutes: z.number().int().min(15).max(480).default(60),
      planningNote: safeOptionalString(1000),
    })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const recurrenceInput = { frequency: input.frequency, weekday: input.weekday ?? null, dayOfMonth: input.dayOfMonth ?? null, startDate: input.startDate, endDate: input.endDate ?? null };
      if (!isValidRecurringServicePlanInput(recurrenceInput)) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a valid recurrence schedule." });
      const [job] = await db.select({ id: jobs.id, clientId: jobs.clientId }).from(jobs).where(and(eq(jobs.id, input.jobId), eq(jobs.userId, ctx.user.id))).limit(1);
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      const customerAssetId = input.customerAssetId ?? null;
      if (customerAssetId) {
        const [asset] = await db.select({ id: customerAssets.id }).from(customerAssets).where(and(
          eq(customerAssets.id, customerAssetId),
          eq(customerAssets.userId, ctx.user.id),
          eq(customerAssets.clientId, job.clientId),
          eq(customerAssets.active, true),
        )).limit(1);
        if (!asset) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an active asset belonging to this job's client." });
      }
      const firstDate = nextRecurringServiceDate(recurrenceInput, input.startDate);
      const [result] = await db.insert(recurringServicePlans).values({
        userId: ctx.user.id, jobId: input.jobId, customerAssetId, name: input.name, serviceName: input.serviceName,
        frequency: input.frequency, weekday: input.weekday ?? null, dayOfMonth: input.dayOfMonth ?? null,
        startDate: input.startDate, endDate: input.endDate ?? null, durationMinutes: input.durationMinutes,
        startTime: input.startTime, nextVisitAt: firstDate ? new Date(`${firstDate}T${input.startTime}:00.000Z`) : null, planningNote: input.planningNote ?? null,
      });
      return { id: Number(result.insertId) };
    }),

    setActive: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), active: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const result = await db.update(recurringServicePlans).set({ active: input.active, updatedAt: new Date() })
          .where(and(eq(recurringServicePlans.id, input.id), eq(recurringServicePlans.userId, ctx.user.id)));
        if (!result[0].affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "Recurring service plan not found." });
        return { success: true, active: input.active };
      }),

    setCustomerAsset: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), customerAssetId: z.number().int().positive().nullable() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [plan] = await db.select({ id: recurringServicePlans.id, clientId: jobs.clientId }).from(recurringServicePlans)
          .innerJoin(jobs, and(eq(recurringServicePlans.jobId, jobs.id), eq(jobs.userId, ctx.user.id)))
          .where(and(eq(recurringServicePlans.id, input.id), eq(recurringServicePlans.userId, ctx.user.id))).limit(1);
        if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Recurring service plan not found." });
        if (input.customerAssetId) {
          const [asset] = await db.select({ id: customerAssets.id }).from(customerAssets).where(and(
            eq(customerAssets.id, input.customerAssetId),
            eq(customerAssets.userId, ctx.user.id),
            eq(customerAssets.clientId, plan.clientId),
            eq(customerAssets.active, true),
          )).limit(1);
          if (!asset) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an active asset belonging to this plan's job client." });
        }
        const result = await db.update(recurringServicePlans).set({ customerAssetId: input.customerAssetId, updatedAt: new Date() })
          .where(and(eq(recurringServicePlans.id, plan.id), eq(recurringServicePlans.userId, ctx.user.id)));
        if (!result[0].affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "Recurring service plan not found." });
        return { success: true, customerAssetId: input.customerAssetId };
      }),

    setNextVisitDate: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), nextVisitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [plan] = await db.select({
          id: recurringServicePlans.id,
          frequency: recurringServicePlans.frequency,
          weekday: recurringServicePlans.weekday,
          dayOfMonth: recurringServicePlans.dayOfMonth,
          startDate: recurringServicePlans.startDate,
          endDate: recurringServicePlans.endDate,
          startTime: recurringServicePlans.startTime,
        }).from(recurringServicePlans)
          .where(and(eq(recurringServicePlans.id, input.id), eq(recurringServicePlans.userId, ctx.user.id))).limit(1);
        if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Recurring service plan not found." });
        const recurrenceInput = { frequency: plan.frequency, weekday: plan.weekday, dayOfMonth: plan.dayOfMonth, startDate: plan.startDate, endDate: plan.endDate } as const;
        const eligibleDate = nextRecurringServiceDate(recurrenceInput, input.nextVisitDate);
        if (eligibleDate !== input.nextVisitDate) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a date that matches this plan's recurrence and date range." });
        const nextVisitAt = new Date(`${input.nextVisitDate}T${plan.startTime}:00.000Z`);
        if (nextVisitAt.getTime() <= Date.now()) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a future eligible visit date." });
        const [existing] = await db.select({ id: serviceVisits.id }).from(serviceVisits).where(and(
          eq(serviceVisits.userId, ctx.user.id),
          eq(serviceVisits.recurringServicePlanId, plan.id),
          eq(serviceVisits.scheduledStart, nextVisitAt),
        )).limit(1);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "A visit already exists for that plan date." });
        await db.update(recurringServicePlans).set({ nextVisitAt, updatedAt: new Date() })
          .where(and(eq(recurringServicePlans.id, plan.id), eq(recurringServicePlans.userId, ctx.user.id)));
        return { success: true, nextVisitAt };
      }),

    generateNextVisit: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [plan] = await db.select().from(recurringServicePlans).where(and(eq(recurringServicePlans.id, input.id), eq(recurringServicePlans.userId, ctx.user.id), eq(recurringServicePlans.active, true))).limit(1);
      if (!plan?.nextVisitAt) throw new TRPCError({ code: "NOT_FOUND", message: "Active recurring plan not found." });
      const [job] = await db.select({ id: jobs.id, clientId: jobs.clientId, status: jobs.status }).from(jobs).where(and(eq(jobs.id, plan.jobId), eq(jobs.userId, ctx.user.id))).limit(1);
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      if (["completed", "cancelled"].includes(job.status)) throw new TRPCError({ code: "CONFLICT", message: "This job is completed or cancelled. Resume active work before generating a future visit." });
      if (plan.customerAssetId) {
        const [asset] = await db.select({ id: customerAssets.id }).from(customerAssets).where(and(
          eq(customerAssets.id, plan.customerAssetId),
          eq(customerAssets.userId, ctx.user.id),
          eq(customerAssets.clientId, job.clientId),
          eq(customerAssets.active, true),
        )).limit(1);
        if (!asset) throw new TRPCError({ code: "CONFLICT", message: "Linked asset is inactive or no longer belongs to this job's client. Reactivate the asset before generating a visit." });
      }
      const start = plan.nextVisitAt;
      const end = new Date(start.getTime() + plan.durationMinutes * 60_000);
      const [existing] = await db.select({ id: serviceVisits.id }).from(serviceVisits).where(and(eq(serviceVisits.userId, ctx.user.id), eq(serviceVisits.recurringServicePlanId, plan.id), eq(serviceVisits.scheduledStart, start))).limit(1);
      if (existing) return { id: existing.id, created: false };
      let result: { insertId: number | bigint } | null = null;
      try {
        const [inserted] = await db.insert(serviceVisits).values({ userId: ctx.user.id, jobId: plan.jobId, recurringServicePlanId: plan.id, title: plan.serviceName, scheduledStart: start, scheduledEnd: end, clientVisible: false });
        result = inserted;
      } catch (error) {
        if (!String(error).includes("serviceVisits_recurring_plan_start_unique_idx")) throw error;
        const [duplicate] = await db.select({ id: serviceVisits.id }).from(serviceVisits).where(and(eq(serviceVisits.userId, ctx.user.id), eq(serviceVisits.recurringServicePlanId, plan.id), eq(serviceVisits.scheduledStart, start))).limit(1);
        if (duplicate) return { id: duplicate.id, created: false };
        throw error;
      }
      const recurrenceInput = { frequency: plan.frequency, weekday: plan.weekday, dayOfMonth: plan.dayOfMonth, startDate: plan.startDate, endDate: plan.endDate } as const;
      const nextDate = nextRecurringServiceDate(recurrenceInput, start.toISOString().slice(0, 10));
      const nextAfterGenerated = nextDate === start.toISOString().slice(0, 10) ? nextRecurringServiceDate(recurrenceInput, new Date(start.getTime() + 86_400_000).toISOString().slice(0, 10)) : nextDate;
      await db.update(recurringServicePlans).set({ nextVisitAt: nextAfterGenerated ? new Date(`${nextAfterGenerated}T${plan.startTime}:00.000Z`) : null }).where(and(eq(recurringServicePlans.id, plan.id), eq(recurringServicePlans.userId, ctx.user.id)));
      return { id: Number(result.insertId), created: true };
    }),
  }),

  // ── Integration Readiness ──────────────────────────────────────────────────
  // ── SMS (Twilio, env-gated) ──────────────────────────────────────────────────
  sms: router({
    /** Owner-facing delivery status: "console" (not configured) vs "twilio" (live). */
    status: protectedProcedure.query(async () => {
      const { configured } = getSmsDeliveryStatus();
      return {
        configured,
        mode: configured ? ("twilio" as const) : ("console" as const),
        from: configured ? ENV.twilioFromNumber : null,
      };
    }),

    /** Sends one test message so the owner can verify their Twilio setup end to end. */
    sendTest: protectedProcedure
      .input(z.object({
        to: z.string().trim().min(7).max(32),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const to = normalizePhoneToE164(input.to);
        if (!to) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a valid phone number, e.g. +1 512 555 0100." });
        }
        const result = await sendSms({
          to,
          body: `TrueAxis HQ test message — SMS is working for ${to}.`,
        });
        if (!result.success) {
          throw new TRPCError({ code: "BAD_REQUEST", message: result.error ?? "Twilio rejected the message." });
        }
        await db.insert(auditLogs).values({
          userId: ctx.user.id,
          action: "sms.test",
          entityType: "integration",
          details: JSON.stringify({ to, mode: result.mode, id: result.id }),
        });
        return { mode: result.mode, id: result.id };
      }),
  }),

  integrations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const [stored, [googleToken]] = await Promise.all([
        db.select().from(integrationConnections).where(eq(integrationConnections.userId, ctx.user.id)),
        db.select({ id: googleCalendarTokens.id, syncEnabled: googleCalendarTokens.syncEnabled, expiresAt: googleCalendarTokens.expiresAt, updatedAt: googleCalendarTokens.updatedAt })
          .from(googleCalendarTokens).where(eq(googleCalendarTokens.userId, ctx.user.id)).limit(1),
      ]);
      const byProvider = new Map(stored.map(connection => [connection.provider, connection]));
      return INTEGRATION_PROVIDERS.map(provider => {
        const catalog = integrationCatalog[provider];
        const connection = byProvider.get(provider);
        // Google status is sourced from the secure OAuth-token record, not a UI flag.
        const googleAuthorized = provider === "google_calendar" && Boolean(googleToken?.syncEnabled);
        return {
          provider,
          ...catalog,
          status: googleAuthorized ? "connected" as const : (connection?.status ?? "not_connected"),
          configurationNote: connection?.configurationNote ?? null,
          lastCheckedAt: googleAuthorized ? (googleToken?.updatedAt ?? null) : (connection?.lastCheckedAt ?? null),
          isProviderAuthorized: googleAuthorized,
        };
      });
    }),

    prepare: protectedProcedure
      .input(z.object({ provider: z.enum(INTEGRATION_PROVIDERS), configurationNote: safeOptionalString(1000) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [googleToken] = input.provider === "google_calendar"
          ? await db.select({ id: googleCalendarTokens.id, syncEnabled: googleCalendarTokens.syncEnabled }).from(googleCalendarTokens).where(eq(googleCalendarTokens.userId, ctx.user.id)).limit(1)
          : [];
        if (googleToken?.syncEnabled) throw new TRPCError({ code: "CONFLICT", message: "Google Calendar is already authorized. Manage it from Settings." });
        const catalog = integrationCatalog[input.provider];
        const [existing] = await db.select({ id: integrationConnections.id }).from(integrationConnections)
          .where(and(eq(integrationConnections.userId, ctx.user.id), eq(integrationConnections.provider, input.provider))).limit(1);
        const values = {
          category: catalog.category,
          status: "needs_configuration" as const,
          configurationNote: input.configurationNote ?? null,
          lastCheckedAt: null,
          updatedAt: new Date(),
        };
        if (existing) {
          await db.update(integrationConnections).set(values).where(and(eq(integrationConnections.id, existing.id), eq(integrationConnections.userId, ctx.user.id)));
        } else {
          await db.insert(integrationConnections).values({ userId: ctx.user.id, provider: input.provider, ...values });
        }
        return { success: true, status: "needs_configuration" as const };
      }),

    disconnect: protectedProcedure
      .input(z.object({ provider: z.enum(INTEGRATION_PROVIDERS) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        if (input.provider === "google_calendar") {
          await db.delete(googleCalendarTokens).where(eq(googleCalendarTokens.userId, ctx.user.id));
        }
        const catalog = integrationCatalog[input.provider];
        const [existing] = await db.select({ id: integrationConnections.id }).from(integrationConnections)
          .where(and(eq(integrationConnections.userId, ctx.user.id), eq(integrationConnections.provider, input.provider))).limit(1);
        const values = { category: catalog.category, status: "not_connected" as const, configurationNote: null, lastCheckedAt: null, updatedAt: new Date() };
        if (existing) await db.update(integrationConnections).set(values).where(and(eq(integrationConnections.id, existing.id), eq(integrationConnections.userId, ctx.user.id)));
        else await db.insert(integrationConnections).values({ userId: ctx.user.id, provider: input.provider, ...values });
        return { success: true };
      }),
  }),

  // ── Workflow Webhooks ──────────────────────────────────────────────────────
  webhooks: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const hooks = await db.select({
        id: workflowWebhooks.id,
        name: workflowWebhooks.name,
        endpointUrl: workflowWebhooks.endpointUrl,
        events: workflowWebhooks.events,
        active: workflowWebhooks.active,
        failureCount: workflowWebhooks.failureCount,
        lastDeliveredAt: workflowWebhooks.lastDeliveredAt,
        lastError: workflowWebhooks.lastError,
        createdAt: workflowWebhooks.createdAt,
        updatedAt: workflowWebhooks.updatedAt,
      }).from(workflowWebhooks).where(eq(workflowWebhooks.userId, ctx.user.id)).orderBy(desc(workflowWebhooks.updatedAt));
      return hooks.map(hook => ({ ...hook, events: parseWebhookEvents(hook.events) }));
    }),

    deliveries: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select({
        id: workflowWebhookDeliveries.id,
        webhookId: workflowWebhookDeliveries.webhookId,
        webhookName: workflowWebhooks.name,
        eventId: workflowWebhookDeliveries.eventId,
        eventType: workflowWebhookDeliveries.eventType,
        status: workflowWebhookDeliveries.status,
        responseStatus: workflowWebhookDeliveries.responseStatus,
        responseSummary: workflowWebhookDeliveries.responseSummary,
        errorMessage: workflowWebhookDeliveries.errorMessage,
        attemptCount: workflowWebhookDeliveries.attemptCount,
        nextAttemptAt: workflowWebhookDeliveries.nextAttemptAt,
        lastAttemptAt: workflowWebhookDeliveries.lastAttemptAt,
        terminalAt: workflowWebhookDeliveries.terminalAt,
        deliveredAt: workflowWebhookDeliveries.deliveredAt,
        createdAt: workflowWebhookDeliveries.createdAt,
      }).from(workflowWebhookDeliveries)
        .innerJoin(workflowWebhooks, and(eq(workflowWebhookDeliveries.webhookId, workflowWebhooks.id), eq(workflowWebhooks.userId, ctx.user.id)))
        .where(eq(workflowWebhookDeliveries.userId, ctx.user.id))
        .orderBy(desc(workflowWebhookDeliveries.createdAt))
        .limit(100);
    }),

    processDue: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(25).default(10) }).optional())
      .mutation(async ({ ctx, input }) => processDueWorkflowWebhookDeliveries(await requireDb(), ctx.user.id, input?.limit ?? 10)),

    create: protectedProcedure
      .input(z.object({
        name: safeString(255),
        endpointUrl: safeUrl,
        events: z.array(z.enum(WORKFLOW_WEBHOOK_EVENTS)).min(1).max(WORKFLOW_WEBHOOK_EVENTS.length),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const existing = await db.select({ id: workflowWebhooks.id }).from(workflowWebhooks).where(eq(workflowWebhooks.userId, ctx.user.id));
        if (existing.length >= 3) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "You can keep up to three webhook endpoints per workspace." });
        let endpointUrl: string;
        try { endpointUrl = await validateWebhookEndpoint(input.endpointUrl); }
        catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Webhook endpoint is invalid." }); }
        const signingSecret = createWebhookSigningSecret();
        const [result] = await db.insert(workflowWebhooks).values({
          userId: ctx.user.id,
          name: input.name,
          endpointUrl,
          encryptedSecret: encryptWebhookSecret(signingSecret),
          events: JSON.stringify(Array.from(new Set(input.events))),
          active: true,
        });
        return { id: Number(result.insertId), signingSecret };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        name: safeOptionalString(255),
        endpointUrl: safeUrl.optional(),
        events: z.array(z.enum(WORKFLOW_WEBHOOK_EVENTS)).min(1).max(WORKFLOW_WEBHOOK_EVENTS.length).optional(),
        active: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const { id, endpointUrl: rawEndpoint, events, ...rest } = input;
        const updates: Record<string, unknown> = { ...rest, updatedAt: new Date() };
        if (rawEndpoint !== undefined) {
          try { updates.endpointUrl = await validateWebhookEndpoint(rawEndpoint); }
          catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Webhook endpoint is invalid." }); }
        }
        if (events) updates.events = JSON.stringify(Array.from(new Set(events)));
        const result = await db.update(workflowWebhooks).set(updates).where(and(eq(workflowWebhooks.id, id), eq(workflowWebhooks.userId, ctx.user.id)));
        if (!result[0].affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "Webhook endpoint not found." });
        return { success: true };
      }),

    remove: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const result = await db.delete(workflowWebhooks).where(and(eq(workflowWebhooks.id, input.id), eq(workflowWebhooks.userId, ctx.user.id)));
        if (!result[0].affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "Webhook endpoint not found." });
        return { success: true };
      }),
  }),

  // ── Unified Job Workspace ──────────────────────────────────────────────────
  jobs: router({
    costReport: protectedProcedure
      .input(z.object({ status: jobWorkspaceStatusSchema.optional() }).optional())
      .query(async ({ ctx, input }) => getOwnerJobCostReport(await requireDb(), ctx.user.id, input?.status)),

    exportCostReport: protectedProcedure
      .input(z.object({ status: jobWorkspaceStatusSchema.optional() }).optional())
      .query(async ({ ctx, input }) => {
        const rows = await getOwnerJobCostReport(await requireDb(), ctx.user.id, input?.status);
        return { fileName: `trueaxis-job-cost-report-${new Date().toISOString().slice(0, 10)}.csv`, csv: buildJobCostCsv(rows) };
      }),

    list: protectedProcedure
      .input(z.object({ status: z.enum(["lead", "quoted", "approved", "scheduled", "in_progress", "awaiting_client", "completed", "cancelled"]).optional() }).optional())
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const filters = [eq(jobs.userId, ctx.user.id)];
        if (input?.status) filters.push(eq(jobs.status, input.status));
        return db.select({
          id: jobs.id, jobNumber: jobs.jobNumber, title: jobs.title, status: jobs.status,
          priority: jobs.priority, targetDate: jobs.targetDate, budgetAmount: jobs.budgetAmount,
          clientId: jobs.clientId, clientName: clients.name, clientEmail: clients.email,
          createdAt: jobs.createdAt, updatedAt: jobs.updatedAt,
        }).from(jobs).innerJoin(clients, eq(jobs.clientId, clients.id)).where(and(...filters)).orderBy(desc(jobs.updatedAt));
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const [job] = await db.select().from(jobs).where(and(eq(jobs.id, input.id), eq(jobs.userId, ctx.user.id))).limit(1);
        if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
        const [client] = await db.select({ id: clients.id, name: clients.name, email: clients.email, avatarInitials: clients.avatarInitials }).from(clients)
          .where(and(eq(clients.id, job.clientId), eq(clients.userId, ctx.user.id))).limit(1);
        const [booking] = job.bookingId ? await db.select().from(bookings).where(and(eq(bookings.id, job.bookingId), eq(bookings.userId, ctx.user.id))).limit(1) : [];
        const [invoice] = job.invoiceId ? await db.select().from(invoices).where(and(eq(invoices.id, job.invoiceId), eq(invoices.userId, ctx.user.id))).limit(1) : [];
        const [proposal] = job.proposalId ? await db.select().from(proposals).where(and(eq(proposals.id, job.proposalId), eq(proposals.userId, ctx.user.id))).limit(1) : [];
        const [contract] = job.contractId ? await db.select().from(contracts).where(and(eq(contracts.id, job.contractId), eq(contracts.userId, ctx.user.id))).limit(1) : [];
        const [tasks, activities, photos, entries, approvals, jobExpenses, phases] = await Promise.all([
          db.select().from(jobTasks).where(and(eq(jobTasks.jobId, job.id), eq(jobTasks.userId, ctx.user.id))).orderBy(jobTasks.sortOrder, desc(jobTasks.createdAt)),
          db.select().from(jobActivities).where(and(eq(jobActivities.jobId, job.id), eq(jobActivities.userId, ctx.user.id))).orderBy(desc(jobActivities.createdAt)).limit(100),
          db.select().from(jobPhotos).where(and(eq(jobPhotos.jobId, job.id), eq(jobPhotos.userId, ctx.user.id))).orderBy(jobPhotos.sortOrder, desc(jobPhotos.createdAt)),
          db.select().from(timeEntries).where(and(eq(timeEntries.jobId, job.id), eq(timeEntries.userId, ctx.user.id))).orderBy(desc(timeEntries.startedAt)),
          db.select().from(clientApprovalRequests).where(and(eq(clientApprovalRequests.jobId, job.id), eq(clientApprovalRequests.userId, ctx.user.id), eq(clientApprovalRequests.clientId, job.clientId))).orderBy(desc(clientApprovalRequests.createdAt)),
          db.select().from(expenses).where(and(eq(expenses.jobId, job.id), eq(expenses.userId, ctx.user.id))).orderBy(desc(expenses.createdAt)),
          db.select().from(jobPhases).where(and(eq(jobPhases.jobId, job.id), eq(jobPhases.userId, ctx.user.id))).orderBy(jobPhases.position, jobPhases.id),
        ]);
        const receiptCost = photos.filter(photo => photo.photoType === "receipt").reduce((sum, photo) => sum + Number(photo.lineItemAmount ?? 0), 0);
        const laborCost = entries.reduce((sum, entry) => sum + ((entry.durationMinutes ?? 0) / 60) * Number(entry.hourlyRate ?? 0), 0);
        const expenseCost = jobExpenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
        const revenue = Number(invoice?.amount ?? job.budgetAmount ?? 0);
        return {
          job, client, booking: booking ?? null, invoice: invoice ?? null, proposal: proposal ?? null, contract: contract ?? null,
          tasks, activities, photos, entries, approvals, expenses: jobExpenses, phases,
          financials: calculateJobCosting({ revenue, receiptCost, laborCost, expenseCost }),
        };
      }),

    setCustomerAsset: protectedProcedure
      .input(z.object({ jobId: z.number().int().positive(), customerAssetId: z.number().int().positive().nullable() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [job] = await db.select({ id: jobs.id, clientId: jobs.clientId }).from(jobs)
          .where(and(eq(jobs.id, input.jobId), eq(jobs.userId, ctx.user.id))).limit(1);
        if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
        if (input.customerAssetId !== null) {
          const [asset] = await db.select({ id: customerAssets.id }).from(customerAssets)
            .where(and(eq(customerAssets.id, input.customerAssetId), eq(customerAssets.userId, ctx.user.id), eq(customerAssets.clientId, job.clientId), eq(customerAssets.active, true))).limit(1);
          if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "Active customer asset not found for this job's client." });
        }
        await db.update(jobs).set({ customerAssetId: input.customerAssetId, updatedAt: new Date() })
          .where(and(eq(jobs.id, job.id), eq(jobs.userId, ctx.user.id), eq(jobs.clientId, job.clientId)));
        return { ok: true };
      }),

    listChecklistTemplates: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const templates = await db.select().from(jobChecklistTemplates)
        .where(eq(jobChecklistTemplates.userId, ctx.user.id))
        .orderBy(desc(jobChecklistTemplates.updatedAt));
      if (!templates.length) return [];
      const templateIds = templates.map(template => template.id);
      const items = await db.select({ id: jobChecklistTemplateItems.id, templateId: jobChecklistTemplateItems.templateId, title: jobChecklistTemplateItems.title, sortOrder: jobChecklistTemplateItems.sortOrder })
        .from(jobChecklistTemplateItems)
        .where(and(eq(jobChecklistTemplateItems.userId, ctx.user.id), inArray(jobChecklistTemplateItems.templateId, templateIds)))
        .orderBy(jobChecklistTemplateItems.sortOrder, jobChecklistTemplateItems.createdAt);
      return templates.map(template => ({ ...template, items: items.filter(item => item.templateId === template.id) }));
    }),

    createChecklistTemplateFromJob: protectedProcedure
      .input(z.object({ jobId: z.number().int().positive(), name: safeString(255) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [job] = await db.select({ id: jobs.id, title: jobs.title }).from(jobs)
          .where(and(eq(jobs.id, input.jobId), eq(jobs.userId, ctx.user.id))).limit(1);
        if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
        const tasks = await db.select({ title: jobTasks.title, sortOrder: jobTasks.sortOrder }).from(jobTasks)
          .where(and(eq(jobTasks.jobId, job.id), eq(jobTasks.userId, ctx.user.id)))
          .orderBy(jobTasks.sortOrder, jobTasks.createdAt);
        if (!tasks.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Add at least one checklist item before saving a template." });
        const [templateResult] = await db.insert(jobChecklistTemplates).values({ userId: ctx.user.id, name: input.name });
        const templateId = Number(templateResult.insertId);
        await db.insert(jobChecklistTemplateItems).values(tasks.map((task, index) => ({ userId: ctx.user.id, templateId, title: task.title, sortOrder: index })));
        await db.insert(jobActivities).values({ userId: ctx.user.id, jobId: job.id, actor: "owner", eventType: "checklist_template_created", message: `Saved this checklist as template “${input.name}”.`, metadata: JSON.stringify({ templateId }) });
        return { id: templateId, itemCount: tasks.length };
      }),

    deleteChecklistTemplate: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [template] = await db.select({ id: jobChecklistTemplates.id }).from(jobChecklistTemplates)
          .where(and(eq(jobChecklistTemplates.id, input.id), eq(jobChecklistTemplates.userId, ctx.user.id))).limit(1);
        if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Checklist template not found." });
        await db.delete(jobChecklistTemplateItems).where(and(eq(jobChecklistTemplateItems.templateId, template.id), eq(jobChecklistTemplateItems.userId, ctx.user.id)));
        await db.delete(jobChecklistTemplates).where(and(eq(jobChecklistTemplates.id, template.id), eq(jobChecklistTemplates.userId, ctx.user.id)));
        return { ok: true };
      }),

    create: protectedProcedure
      .input(z.object({
        clientId: z.number().int().positive(),
        title: safeString(255), description: safeOptionalString(5000),
        status: z.enum(["lead", "quoted", "approved", "scheduled", "in_progress", "awaiting_client", "completed", "cancelled"]).default("lead"),
        priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
        startDate: safeOptionalString(32), targetDate: safeOptionalString(32),
        budgetAmount: z.number().min(0).max(99_999_999).optional(),
        bookingId: z.number().int().positive().optional(), invoiceId: z.number().int().positive().optional(), proposalId: z.number().int().positive().optional(), contractId: z.number().int().positive().optional(), templateId: z.number().int().positive().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [client] = await db.select({ id: clients.id, name: clients.name }).from(clients)
          .where(and(eq(clients.id, input.clientId), eq(clients.userId, ctx.user.id))).limit(1);
        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." });
        if (input.bookingId) {
          const [booking] = await db.select({ id: bookings.id, clientId: bookings.clientId }).from(bookings).where(and(eq(bookings.id, input.bookingId), eq(bookings.userId, ctx.user.id))).limit(1);
          if (!booking || (booking.clientId && booking.clientId !== input.clientId)) throw new TRPCError({ code: "BAD_REQUEST", message: "Booking does not belong to this client." });
        }
        let templateItems: { title: string; sortOrder: number }[] = [];
        let templateName: string | null = null;
        if (input.templateId) {
          const [template] = await db.select({ id: jobChecklistTemplates.id, name: jobChecklistTemplates.name }).from(jobChecklistTemplates)
            .where(and(eq(jobChecklistTemplates.id, input.templateId), eq(jobChecklistTemplates.userId, ctx.user.id))).limit(1);
          if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Checklist template not found." });
          templateName = template.name;
          templateItems = await db.select({ title: jobChecklistTemplateItems.title, sortOrder: jobChecklistTemplateItems.sortOrder }).from(jobChecklistTemplateItems)
            .where(and(eq(jobChecklistTemplateItems.templateId, template.id), eq(jobChecklistTemplateItems.userId, ctx.user.id)))
            .orderBy(jobChecklistTemplateItems.sortOrder, jobChecklistTemplateItems.createdAt);
        }
        const jobNumber = `JOB-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
        const [result] = await db.insert(jobs).values({
          userId: ctx.user.id, clientId: input.clientId, title: input.title, description: input.description ?? null,
          status: input.status, priority: input.priority, startDate: input.startDate ?? null, targetDate: input.targetDate ?? null,
          budgetAmount: input.budgetAmount === undefined ? null : String(input.budgetAmount), bookingId: input.bookingId ?? null,
          invoiceId: input.invoiceId ?? null, proposalId: input.proposalId ?? null, contractId: input.contractId ?? null,
          completedAt: input.status === "completed" ? new Date() : null, jobNumber,
        });
        const jobId = Number(result.insertId);
        await db.insert(jobActivities).values({ userId: ctx.user.id, jobId, actor: "owner", eventType: "job_created", message: `Created ${jobNumber} for ${client.name}.` });
        if (templateItems.length) {
          await db.insert(jobTasks).values(templateItems.map((item, index) => ({ userId: ctx.user.id, jobId, title: item.title, status: "todo" as const, sortOrder: index })));
          await db.insert(jobActivities).values({ userId: ctx.user.id, jobId, actor: "system", eventType: "checklist_template_applied", message: `Applied checklist template “${templateName}” with ${templateItems.length} item${templateItems.length === 1 ? "" : "s"}.`, metadata: JSON.stringify({ templateId: input.templateId }) });
        }
        return { id: jobId, jobNumber };
      }),

    createFromBooking: protectedProcedure
      .input(z.object({ bookingId: z.number().int().positive(), targetDate: safeOptionalString(32) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [booking] = await db.select().from(bookings).where(and(eq(bookings.id, input.bookingId), eq(bookings.userId, ctx.user.id))).limit(1);
        if (!booking?.clientId) throw new TRPCError({ code: "BAD_REQUEST", message: "This booking must be linked to a client before creating a job." });
        const [existing] = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.bookingId, booking.id), eq(jobs.userId, ctx.user.id))).limit(1);
        if (existing) return { id: existing.id, existing: true };
        const jobNumber = `JOB-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
        const [result] = await db.insert(jobs).values({
          userId: ctx.user.id, clientId: booking.clientId, bookingId: booking.id, jobNumber,
          title: booking.service ?? `Work for ${booking.clientName}`, description: booking.notes ?? null,
          status: "scheduled", priority: "normal", startDate: booking.date, targetDate: input.targetDate ?? booking.date,
        });
        const jobId = Number(result.insertId);
        await db.insert(jobActivities).values({ userId: ctx.user.id, jobId, actor: "system", eventType: "job_created_from_booking", message: `Created from booking on ${booking.date} at ${booking.time}.` });
        return { id: jobId, existing: false };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(), title: safeOptionalString(255), description: safeOptionalString(5000),
        clientSummary: safeOptionalString(2000).nullable().optional(), clientSummaryVisible: z.boolean().optional(),
        status: z.enum(["lead", "quoted", "approved", "scheduled", "in_progress", "awaiting_client", "completed", "cancelled"]).optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(), startDate: safeOptionalString(32), targetDate: safeOptionalString(32), budgetAmount: z.number().min(0).max(99_999_999).nullable().optional(), invoiceId: z.number().int().positive().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [current] = await db.select().from(jobs).where(and(eq(jobs.id, input.id), eq(jobs.userId, ctx.user.id))).limit(1);
        if (!current) throw new TRPCError({ code: "NOT_FOUND" });
        const { id, budgetAmount, ...rest } = input;
        const updates: Record<string, unknown> = { ...rest, updatedAt: new Date() };
        if (budgetAmount !== undefined) updates.budgetAmount = budgetAmount === null ? null : String(budgetAmount);
        if (input.status === "completed" && current.status !== "completed") updates.completedAt = new Date();
        if (input.status && input.status !== current.status) {
          await db.insert(jobActivities).values({ userId: ctx.user.id, jobId: id, actor: "owner", eventType: "status_changed", message: `Status changed from ${current.status.replaceAll("_", " ")} to ${input.status.replaceAll("_", " ")}.` });
        }
        if (input.clientSummary !== undefined || input.clientSummaryVisible !== undefined) {
          await db.insert(jobActivities).values({ userId: ctx.user.id, jobId: id, actor: "owner", eventType: "client_summary_updated", message: "Updated the reviewed client job summary." });
        }
        await db.update(jobs).set(updates).where(and(eq(jobs.id, id), eq(jobs.userId, ctx.user.id), eq(jobs.clientId, current.clientId)));
        if (input.status && input.status !== current.status) {
          await deliverWorkflowWebhookEvent(db, ctx.user.id, "job.status_changed", { jobId: id, jobNumber: current.jobNumber, previousStatus: current.status, status: input.status });
        }
        return { success: true };
      }),

    addTask: protectedProcedure
      .input(z.object({ jobId: z.number().int().positive(), title: safeString(255), description: safeOptionalString(5000), dueDate: safeOptionalString(32) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [job] = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.id, input.jobId), eq(jobs.userId, ctx.user.id))).limit(1);
        if (!job) throw new TRPCError({ code: "NOT_FOUND" });
        const [result] = await db.insert(jobTasks).values({ userId: ctx.user.id, jobId: input.jobId, title: input.title, description: input.description ?? null, dueDate: input.dueDate ?? null });
        await db.insert(jobActivities).values({ userId: ctx.user.id, jobId: input.jobId, actor: "owner", eventType: "task_added", message: `Added checklist item: ${input.title}.` });
        return { id: Number(result.insertId) };
      }),

    updateTask: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["todo", "in_progress", "done"]).optional(), title: safeOptionalString(255), dueDate: safeOptionalString(32), clientVisible: z.boolean().optional(), phaseId: z.number().int().positive().nullable().optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [task] = await db.select().from(jobTasks).where(and(eq(jobTasks.id, input.id), eq(jobTasks.userId, ctx.user.id))).limit(1);
        if (!task) throw new TRPCError({ code: "NOT_FOUND" });
        // A phase assignment must reference a phase of the same job and owner.
        if (input.phaseId !== undefined && input.phaseId !== null) {
          const [phase] = await db.select({ id: jobPhases.id }).from(jobPhases).where(and(eq(jobPhases.id, input.phaseId), eq(jobPhases.userId, ctx.user.id), eq(jobPhases.jobId, task.jobId))).limit(1);
          if (!phase) throw new TRPCError({ code: "BAD_REQUEST", message: "That phase does not belong to this job." });
        }
        const { id, ...inputUpdates } = input;
        const updates: Record<string, unknown> = { ...inputUpdates };
        if (input.status === "done" && task.status !== "done") updates.completedAt = new Date();
        if (input.status && input.status !== task.status) await db.insert(jobActivities).values({ userId: ctx.user.id, jobId: task.jobId, actor: "owner", eventType: "task_status_changed", message: `Checklist item “${task.title}” marked ${input.status.replaceAll("_", " ")}.` });
        if (input.clientVisible !== undefined && input.clientVisible !== task.clientVisible) await db.insert(jobActivities).values({ userId: ctx.user.id, jobId: task.jobId, actor: "owner", eventType: "task_visibility_changed", message: `Checklist item “${task.title}” is now ${input.clientVisible ? "shared with the client" : "private to the workspace"}.` });
        await db.update(jobTasks).set(updates).where(and(eq(jobTasks.id, id), eq(jobTasks.userId, ctx.user.id)));
        return { success: true };
      }),

    deleteTask: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db.delete(jobTasks).where(and(eq(jobTasks.id, input.id), eq(jobTasks.userId, ctx.user.id)));
        return { success: true };
      }),

    // ─── Hybrid workflows: project phases ───────────────────────────────────
    // Jobs without phases are day-tickets; adding phases turns the same job
    // record into a multi-phase project. One client, one evidence trail.
    addPhase: protectedProcedure
      .input(z.object({ jobId: z.number().int().positive(), name: safeString(100), scheduledDate: safeOptionalString(32), notes: safeOptionalString(2000) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [job] = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.id, input.jobId), eq(jobs.userId, ctx.user.id))).limit(1);
        if (!job) throw new TRPCError({ code: "NOT_FOUND" });
        const existing = await db.select({ position: jobPhases.position }).from(jobPhases).where(and(eq(jobPhases.jobId, input.jobId), eq(jobPhases.userId, ctx.user.id)));
        const position = existing.reduce((max, phase) => Math.max(max, phase.position), 0) + 1;
        const [result] = await db.insert(jobPhases).values({ userId: ctx.user.id, jobId: input.jobId, name: input.name, position, scheduledDate: input.scheduledDate ?? null, notes: input.notes ?? null });
        await db.insert(jobActivities).values({ userId: ctx.user.id, jobId: input.jobId, actor: "owner", eventType: "phase_added", message: `Added project phase: ${input.name}.` });
        return { id: Number(result.insertId), position };
      }),

    updatePhase: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), name: safeOptionalString(100), status: z.enum(["planned", "in_progress", "done"]).optional(), scheduledDate: safeOptionalString(32), notes: safeOptionalString(2000) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [phase] = await db.select().from(jobPhases).where(and(eq(jobPhases.id, input.id), eq(jobPhases.userId, ctx.user.id))).limit(1);
        if (!phase) throw new TRPCError({ code: "NOT_FOUND" });
        const updates: Record<string, unknown> = {};
        if (input.name !== undefined) updates.name = input.name;
        if (input.status !== undefined) updates.status = input.status;
        if (input.scheduledDate !== undefined) updates.scheduledDate = input.scheduledDate ?? null;
        if (input.notes !== undefined) updates.notes = input.notes ?? null;
        if (Object.keys(updates).length > 0) await db.update(jobPhases).set(updates).where(and(eq(jobPhases.id, input.id), eq(jobPhases.userId, ctx.user.id)));
        if (input.status !== undefined && input.status !== phase.status) {
          await db.insert(jobActivities).values({ userId: ctx.user.id, jobId: phase.jobId, actor: "owner", eventType: "phase_status_changed", message: `Project phase “${input.name ?? phase.name}” marked ${input.status.replaceAll("_", " ")}.` });
        }
        return { success: true };
      }),

    deletePhase: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [phase] = await db.select({ id: jobPhases.id, jobId: jobPhases.jobId }).from(jobPhases).where(and(eq(jobPhases.id, input.id), eq(jobPhases.userId, ctx.user.id))).limit(1);
        if (!phase) throw new TRPCError({ code: "NOT_FOUND" });
        // Removing a phase never destroys work: its tasks are unlinked, not deleted.
        await db.update(jobTasks).set({ phaseId: null }).where(and(eq(jobTasks.phaseId, input.id), eq(jobTasks.userId, ctx.user.id)));
        await db.delete(jobPhases).where(and(eq(jobPhases.id, input.id), eq(jobPhases.userId, ctx.user.id)));
        await db.insert(jobActivities).values({ userId: ctx.user.id, jobId: phase.jobId, actor: "owner", eventType: "phase_removed", message: `Removed project phase. Its checklist items were kept and unassigned.` });
        return { success: true };
      }),

    reorderPhases: protectedProcedure
      .input(z.object({ jobId: z.number().int().positive(), phaseIds: z.array(z.number().int().positive()).min(1).max(50) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [job] = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.id, input.jobId), eq(jobs.userId, ctx.user.id))).limit(1);
        if (!job) throw new TRPCError({ code: "NOT_FOUND" });
        const phases = await db.select({ id: jobPhases.id }).from(jobPhases).where(and(eq(jobPhases.jobId, input.jobId), eq(jobPhases.userId, ctx.user.id)));
        const knownIds = new Set(phases.map(phase => phase.id));
        if (new Set(input.phaseIds).size !== input.phaseIds.length || input.phaseIds.some(id => !knownIds.has(id))) throw new TRPCError({ code: "BAD_REQUEST", message: "The phase order must list this job's phases exactly once." });
        let position = 1;
        for (const phaseId of input.phaseIds) {
          await db.update(jobPhases).set({ position }).where(and(eq(jobPhases.id, phaseId), eq(jobPhases.userId, ctx.user.id)));
          position += 1;
        }
        return { success: true };
      }),

    addUpdate: protectedProcedure
      .input(z.object({ jobId: z.number().int().positive(), message: safeString(5000), visibleToClient: z.boolean().default(false), clientRequestId: z.string().min(8).max(64).optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [job] = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.id, input.jobId), eq(jobs.userId, ctx.user.id))).limit(1);
        if (!job) throw new TRPCError({ code: "NOT_FOUND" });
        // Idempotent replay: an offline client retrying the same queued update
        // (e.g. the server committed but the response was lost) must never
        // double-post. A clientRequestId matches the original row instead.
        if (input.clientRequestId) {
          const [existing] = await db.select({ id: jobActivities.id }).from(jobActivities)
            .where(and(eq(jobActivities.userId, ctx.user.id), eq(jobActivities.clientRequestId, input.clientRequestId)))
            .limit(1);
          if (existing) return { id: Number(existing.id), replayed: true };
        }
        try {
          const [result] = await db.insert(jobActivities).values({ userId: ctx.user.id, jobId: input.jobId, actor: "owner", eventType: input.visibleToClient ? "client_update" : "internal_note", message: input.message, metadata: JSON.stringify({ visibleToClient: input.visibleToClient }), clientRequestId: input.clientRequestId ?? null });
          return { id: Number(result.insertId), replayed: false };
        } catch (error) {
          // Concurrent replay raced past the SELECT: the unique index makes the
          // second insert fail — return the winner's row so both callers succeed.
          if (input.clientRequestId && error instanceof Error && /Duplicate entry/.test(error.message)) {
            const [existing] = await db.select({ id: jobActivities.id }).from(jobActivities)
              .where(and(eq(jobActivities.userId, ctx.user.id), eq(jobActivities.clientRequestId, input.clientRequestId)))
              .limit(1);
            if (existing) return { id: Number(existing.id), replayed: true };
          }
          throw error;
        }
      }),

    createApprovalRequest: protectedProcedure
      .input(z.object({ jobId: z.number().int().positive(), title: safeString(255), description: safeOptionalString(5000) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [job] = await db.select({ id: jobs.id, clientId: jobs.clientId }).from(jobs)
          .where(and(eq(jobs.id, input.jobId), eq(jobs.userId, ctx.user.id))).limit(1);
        if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
        const [result] = await db.insert(clientApprovalRequests).values({ userId: ctx.user.id, clientId: job.clientId, jobId: job.id, title: input.title, description: input.description ?? null });
        const approvalId = Number(result.insertId);
        await db.insert(jobActivities).values({ userId: ctx.user.id, jobId: job.id, actor: "owner", eventType: "approval_requested", message: `Requested client approval for “${input.title}”.`, metadata: JSON.stringify({ approvalId }) });
        return { id: approvalId };
      }),

    deleteApprovalRequest: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [approval] = await db.select({ id: clientApprovalRequests.id, jobId: clientApprovalRequests.jobId, title: clientApprovalRequests.title }).from(clientApprovalRequests)
          .where(and(eq(clientApprovalRequests.id, input.id), eq(clientApprovalRequests.userId, ctx.user.id))).limit(1);
        if (!approval) throw new TRPCError({ code: "NOT_FOUND", message: "Approval request not found." });
        await db.delete(clientApprovalRequests).where(and(eq(clientApprovalRequests.id, approval.id), eq(clientApprovalRequests.userId, ctx.user.id)));
        await db.insert(jobActivities).values({ userId: ctx.user.id, jobId: approval.jobId, actor: "owner", eventType: "approval_removed", message: `Removed approval request for “${approval.title}”.` });
        return { success: true };
      }),

    setPhotoClientVisibility: protectedProcedure
      .input(z.object({ jobId: z.number().int().positive(), photoId: z.number().int().positive(), clientVisible: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [job] = await db.select({ id: jobs.id, clientId: jobs.clientId }).from(jobs)
          .where(and(eq(jobs.id, input.jobId), eq(jobs.userId, ctx.user.id))).limit(1);
        const [photo] = await db.select({ id: jobPhotos.id, jobId: jobPhotos.jobId, clientId: jobPhotos.clientId, photoType: jobPhotos.photoType, clientVisible: jobPhotos.clientVisible }).from(jobPhotos)
          .where(and(eq(jobPhotos.id, input.photoId), eq(jobPhotos.userId, ctx.user.id))).limit(1);
        if (!job || !photo || photo.jobId !== job.id || photo.clientId !== job.clientId) throw new TRPCError({ code: "NOT_FOUND", message: "Job photo not found." });
        if (photo.photoType === "receipt") throw new TRPCError({ code: "BAD_REQUEST", message: "Receipt photos remain private to the workspace." });
        const [update] = await db.update(jobPhotos).set({ clientVisible: input.clientVisible })
          .where(and(eq(jobPhotos.id, photo.id), eq(jobPhotos.userId, ctx.user.id), eq(jobPhotos.jobId, job.id), eq(jobPhotos.clientId, job.clientId)));
        if (!update.affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "Job photo not found." });
        if (photo.clientVisible !== input.clientVisible) {
          await db.insert(jobActivities).values({ userId: ctx.user.id, jobId: job.id, actor: "owner", eventType: "photo_visibility_changed", message: `Proof photo is now ${input.clientVisible ? "shared with the client" : "private to the workspace"}.` });
        }
        return { success: true, clientVisible: input.clientVisible };
      }),

    attachPhoto: protectedProcedure
      .input(z.object({ jobId: z.number().int().positive(), photoId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [job] = await db.select({ id: jobs.id, clientId: jobs.clientId }).from(jobs).where(and(eq(jobs.id, input.jobId), eq(jobs.userId, ctx.user.id))).limit(1);
        const [photo] = await db.select({ id: jobPhotos.id, photoType: jobPhotos.photoType, clientId: jobPhotos.clientId, jobId: jobPhotos.jobId }).from(jobPhotos).where(and(eq(jobPhotos.id, input.photoId), eq(jobPhotos.userId, ctx.user.id))).limit(1);
        if (!job || !photo || photo.jobId !== null || photo.photoType === "receipt" || (photo.clientId !== null && photo.clientId !== job.clientId)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "An unlinked non-receipt proof photo for this client is required." });
        }
        const [update] = await db.update(jobPhotos).set({ jobId: job.id, clientId: job.clientId, clientVisible: false })
          .where(and(
            eq(jobPhotos.id, photo.id),
            eq(jobPhotos.userId, ctx.user.id),
            isNull(jobPhotos.jobId),
            or(isNull(jobPhotos.clientId), eq(jobPhotos.clientId, job.clientId)),
          ));
        if (!update.affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "Proof photo is no longer available to attach." });
        await db.insert(jobActivities).values({ userId: ctx.user.id, jobId: job.id, actor: "owner", eventType: "photo_linked", message: `Linked a ${photo.photoType === "wip" ? "work-in-progress" : photo.photoType} photo.` });
        return { success: true };
      }),
  }),

  // ── Owner action cards (next-best-actions surfaced from live data) ─────────
  dashboard: router({
    actionCards: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const todayKey = new Date().toISOString().slice(0, 10);

      const [actionableInvoices, awaitingSignature, awaitingClientJobs, pendingApprovals, todaysBookings] = await Promise.all([
        db.select({ id: invoices.id, clientName: invoices.clientName, amount: invoices.amount, status: invoices.status })
          .from(invoices)
          .where(and(eq(invoices.userId, ctx.user.id), inArray(invoices.status, ["overdue", "draft"])))
          .orderBy(desc(invoices.amount))
          .limit(100),
        db.select({ id: proposals.id, title: proposals.title, clientName: proposals.clientName, validUntil: proposals.validUntil, total: proposals.total, sentAt: proposals.sentAt })
          .from(proposals)
          .where(and(eq(proposals.userId, ctx.user.id), inArray(proposals.status, ["sent", "viewed"])))
          .orderBy(desc(proposals.sentAt))
          .limit(50),
        db.select({ id: jobs.id, title: jobs.title, client: clients.name })
          .from(jobs)
          .leftJoin(clients, eq(jobs.clientId, clients.id))
          .where(and(eq(jobs.userId, ctx.user.id), eq(jobs.status, "awaiting_client")))
          .orderBy(desc(jobs.updatedAt))
          .limit(20),
        db.select({ id: clientApprovalRequests.id, title: clientApprovalRequests.title })
          .from(clientApprovalRequests)
          .where(and(eq(clientApprovalRequests.userId, ctx.user.id), eq(clientApprovalRequests.status, "pending")))
          .orderBy(desc(clientApprovalRequests.createdAt))
          .limit(20),
        db.select({ id: bookings.id, clientName: bookings.clientName, service: bookings.service, time: bookings.time })
          .from(bookings)
          .where(and(eq(bookings.userId, ctx.user.id), eq(bookings.status, "scheduled"), or(eq(bookings.date, todayKey), eq(bookings.date, new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })))))
          .orderBy(bookings.time)
          .limit(20),
      ]);

      type ActionCard = {
        id: string;
        priority: number;
        title: string;
        detail: string;
        count: number;
        target: ActivePanelTarget;
      };
      const cards: ActionCard[] = [];
      const overdueInvoices = actionableInvoices.filter(inv => inv.status === "overdue");
      const draftInvoices = actionableInvoices.filter(inv => inv.status === "draft");

      if (overdueInvoices.length) {
        const total = overdueInvoices.reduce((sum, inv) => sum + parseFloat(String(inv.amount ?? 0)), 0);
        cards.push({
          id: "overdue_invoices",
          priority: 1,
          title: `Collect ${overdueInvoices.length} overdue ${overdueInvoices.length === 1 ? "invoice" : "invoices"}`,
          detail: `$${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} outstanding — top: ${overdueInvoices[0].clientName}`,
          count: overdueInvoices.length,
          target: "billing",
        });
      }

      const expiring = awaitingSignature
        .map(p => ({ proposal: p, daysLeft: daysUntilProposalExpiry(p.validUntil) }))
        .filter(p => p.daysLeft !== null && p.daysLeft >= 0 && p.daysLeft <= 3)
        .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));

      if (expiring.length) {
        const soonest = expiring[0];
        cards.push({
          id: "quotes_expiring",
          priority: 0,
          title: `${expiring.length} ${expiring.length === 1 ? "quote expires" : "quotes expire"} within 3 days`,
          detail: soonest.daysLeft === 0
            ? `"${soonest.proposal.title}" for ${soonest.proposal.clientName} expires today`
            : `"${soonest.proposal.title}" expires in ${soonest.daysLeft} ${soonest.daysLeft === 1 ? "day" : "days"}`,
          count: expiring.length,
          target: "proposals",
        });
      }

      if (awaitingSignature.length) {
        cards.push({
          id: "awaiting_signature",
          priority: 2,
          title: `${awaitingSignature.length} ${awaitingSignature.length === 1 ? "proposal is" : "proposals are"} awaiting signature`,
          detail: `Top: "${awaitingSignature[0].title}" for ${awaitingSignature[0].clientName}`,
          count: awaitingSignature.length,
          target: "proposals",
        });
      }

      if (awaitingClientJobs.length) {
        cards.push({
          id: "jobs_awaiting_client",
          priority: 3,
          title: `${awaitingClientJobs.length} ${awaitingClientJobs.length === 1 ? "job" : "jobs"} waiting on client`,
          detail: `Top: "${awaitingClientJobs[0].title}"${awaitingClientJobs[0].client ? ` — ${awaitingClientJobs[0].client}` : ""}`,
          count: awaitingClientJobs.length,
          target: "jobs",
        });
      }

      if (pendingApprovals.length) {
        cards.push({
          id: "pending_approvals",
          priority: 4,
          title: `${pendingApprovals.length} pending client ${pendingApprovals.length === 1 ? "approval" : "approvals"}`,
          detail: `Top: "${pendingApprovals[0].title}"`,
          count: pendingApprovals.length,
          target: "jobs",
        });
      }

      if (draftInvoices.length) {
        cards.push({
          id: "draft_invoices",
          priority: 5,
          title: `Send ${draftInvoices.length} draft ${draftInvoices.length === 1 ? "invoice" : "invoices"}`,
          detail: `Top: ${draftInvoices[0].clientName}`,
          count: draftInvoices.length,
          target: "billing",
        });
      }

      if (todaysBookings.length) {
        cards.push({
          id: "todays_bookings",
          priority: 6,
          title: `${todaysBookings.length} ${todaysBookings.length === 1 ? "job" : "jobs"} on today's schedule`,
          detail: `First: ${todaysBookings[0].time} — ${todaysBookings[0].clientName}`,
          count: todaysBookings.length,
          target: "scheduling",
        });
      }

      cards.sort((a, b) => a.priority - b.priority);
      return { cards: cards.slice(0, 6), generatedAt: new Date().toISOString() };
    }),
  }),
});
export type AppRouter = typeof appRouter;
