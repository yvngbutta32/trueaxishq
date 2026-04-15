import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Password auth (self-hosted, no Manus OAuth dependency)
  passwordHash: varchar("passwordHash", { length: 255 }),
  // Stripe identifiers
  stripeCustomerId: varchar("stripeCustomerId", { length: 64 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 64 }),
  subscriptionStatus: varchar("subscriptionStatus", { length: 32 }).default("free"),
  planId: varchar("planId", { length: 32 }).default("free"),
  // Profile
  bio: text("bio"),
  phone: varchar("phone", { length: 32 }),
  avatarUrl: text("avatarUrl"),
  // Business info
  businessName: text("businessName"),
  businessPhone: varchar("businessPhone", { length: 32 }),
  businessAddress: text("businessAddress"),
  businessWebsite: varchar("businessWebsite", { length: 512 }),
  // Booking page config
  bookingUsername: varchar("bookingUsername", { length: 64 }).unique(),
  bookingBio: text("bookingBio"),
  bookingServices: text("bookingServices"),
  bookingAvailability: text("bookingAvailability"),
  // Notification preferences
  notifyNewBooking: boolean("notifyNewBooking").default(true),
  notifyInvoicePaid: boolean("notifyInvoicePaid").default(true),
  notifyNewLead: boolean("notifyNewLead").default(true),
  monthlyReportEnabled: boolean("monthlyReportEnabled").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Leads (email capture from landing page) ──────────────────────────────────

export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  name: varchar("name", { length: 255 }),
  source: varchar("source", { length: 64 }).default("landing_page"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

// ─── Clients ──────────────────────────────────────────────────────────────────

export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  service: varchar("service", { length: 255 }),
  status: mysqlEnum("status", ["active", "inactive", "prospect"]).default("active").notNull(),
  notes: text("notes"),
  avatarInitials: varchar("avatarInitials", { length: 4 }),
  totalRevenue: decimal("totalRevenue", { precision: 10, scale: 2 }).default("0"),
  sessionsCount: int("sessionsCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastContactedAt: timestamp("lastContactedAt"),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// ─── Invoices ─────────────────────────────────────────────────────────────────

export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientId: int("clientId"),
  invoiceNumber: varchar("invoiceNumber", { length: 32 }).notNull(),
  clientName: varchar("clientName", { length: 255 }).notNull(),
  clientEmail: varchar("clientEmail", { length: 320 }),
  service: text("service"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["draft", "sent", "paid", "overdue"]).default("draft").notNull(),
  dueDate: varchar("dueDate", { length: 32 }),
  notes: text("notes"),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

// ─── Bookings / Appointments ──────────────────────────────────────────────────

export const bookings = mysqlTable("bookings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientId: int("clientId"),
  clientName: varchar("clientName", { length: 255 }).notNull(),
  clientEmail: varchar("clientEmail", { length: 320 }),
  service: varchar("service", { length: 255 }),
  date: varchar("date", { length: 32 }).notNull(),
  time: varchar("time", { length: 32 }).notNull(),
  duration: int("duration").default(60),
  status: mysqlEnum("status", ["scheduled", "completed", "cancelled", "no_show"]).default("scheduled").notNull(),
  notes: text("notes"),
  isPublicBooking: boolean("isPublicBooking").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;

// ─── Follow-Up Emails ─────────────────────────────────────────────────────────

export const followUps = mysqlTable("followUps", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientId: int("clientId"),
  clientName: varchar("clientName", { length: 255 }).notNull(),
  clientEmail: varchar("clientEmail", { length: 320 }),
  subject: varchar("subject", { length: 512 }),
  body: text("body").notNull(),
  status: mysqlEnum("status", ["draft", "sent"]).default("draft").notNull(),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FollowUp = typeof followUps.$inferSelect;
export type InsertFollowUp = typeof followUps.$inferInsert;

// ─── Email Templates ──────────────────────────────────────────────────────────

export const emailTemplates = mysqlTable("emailTemplates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 512 }).notNull(),
  body: text("body").notNull(),
  category: varchar("category", { length: 64 }).default("follow_up"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = typeof emailTemplates.$inferInsert;

// ─── Client Pulse (AI Relationship Intelligence) ──────────────────────────────

export const clientPulse = mysqlTable("clientPulse", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientId: int("clientId").notNull(),
  // Health score 0-100
  healthScore: int("healthScore").default(100).notNull(),
  // Risk flags
  churnRisk: boolean("churnRisk").default(false).notNull(),
  upsellReady: boolean("upsellReady").default(false).notNull(),
  goingSilent: boolean("goingSilent").default(false).notNull(),
  // Signal data used for scoring
  daysSinceLastContact: int("daysSinceLastContact").default(0),
  daysSinceLastBooking: int("daysSinceLastBooking").default(0),
  daysSinceLastInvoice: int("daysSinceLastInvoice").default(0),
  totalInvoicesPaid: int("totalInvoicesPaid").default(0),
  totalBookings: int("totalBookings").default(0),
  followUpResponseRate: decimal("followUpResponseRate", { precision: 5, scale: 2 }).default("0"),
  revenueLastThirtyDays: decimal("revenueLastThirtyDays", { precision: 10, scale: 2 }).default("0"),
  revenueLastNinetyDays: decimal("revenueLastNinetyDays", { precision: 10, scale: 2 }).default("0"),
  // AI-generated insight
  aiInsight: text("aiInsight"),
  aiAction: text("aiAction"),
  aiActionType: varchar("aiActionType", { length: 32 }), // 're_engage' | 'upsell' | 'check_in' | 'maintain'
  // Timestamps
  lastComputedAt: timestamp("lastComputedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ClientPulse = typeof clientPulse.$inferSelect;
export type InsertClientPulse = typeof clientPulse.$inferInsert;

// ─── Platform Settings (admin-editable site config) ─────────────────────────────

export const platformSettings = mysqlTable("platformSettings", {
  id: int("id").autoincrement().primaryKey(),
  // Site identity
  siteName: varchar("siteName", { length: 255 }).default("TrueAxis HQ").notNull(),
  siteTagline: varchar("siteTagline", { length: 512 }).default("The AI-powered business platform for freelancers & coaches"),
  supportEmail: varchar("supportEmail", { length: 320 }).default("support@trueaxishq.com"),
  supportPhone: varchar("supportPhone", { length: 32 }),
  // Announcement banner
  announcementEnabled: boolean("announcementEnabled").default(false).notNull(),
  announcementText: varchar("announcementText", { length: 512 }),
  announcementColor: varchar("announcementColor", { length: 32 }).default("teal"),
  // Social links
  socialTwitter: varchar("socialTwitter", { length: 255 }),
  socialLinkedin: varchar("socialLinkedin", { length: 255 }),
  socialInstagram: varchar("socialInstagram", { length: 255 }),
  socialYoutube: varchar("socialYoutube", { length: 255 }),
  // Feature flags
  featureClientPulse: boolean("featureClientPulse").default(true).notNull(),
  featureBookingPage: boolean("featureBookingPage").default(true).notNull(),
  featureInvoicing: boolean("featureInvoicing").default(true).notNull(),
  featureFollowUps: boolean("featureFollowUps").default(true).notNull(),
  featureAnalytics: boolean("featureAnalytics").default(true).notNull(),
  featureAIAssistant: boolean("featureAIAssistant").default(true).notNull(),
  // Maintenance
  maintenanceMode: boolean("maintenanceMode").default(false).notNull(),
  maintenanceMessage: varchar("maintenanceMessage", { length: 512 }),
  // Free trial config
  freeTrialDays: int("freeTrialDays").default(14).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlatformSettings = typeof platformSettings.$inferSelect;
export type InsertPlatformSettings = typeof platformSettings.$inferInsert;

// ─── Password Reset Tokens ────────────────────────────────────────────────────

export const passwordResetTokens = mysqlTable("passwordResetTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// ─── Invite Codes (invitation-only registration) ─────────────────────────────

export const inviteCodes = mysqlTable("inviteCodes", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  createdBy: int("createdBy").notNull(), // admin user id
  note: varchar("note", { length: 255 }), // optional label (e.g. "for John")
  usedBy: int("usedBy"), // user id who used it
  usedAt: timestamp("usedAt"),
  expiresAt: timestamp("expiresAt"), // null = never expires
  revoked: boolean("revoked").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InviteCode = typeof inviteCodes.$inferSelect;
export type InsertInviteCode = typeof inviteCodes.$inferInsert;

// ─── Security Events (audit log for failed logins, blocks, suspicious activity) ─

export const securityEvents = mysqlTable("securityEvents", {
  id: int("id").autoincrement().primaryKey(),
  eventType: varchar("eventType", { length: 64 }).notNull(), // 'failed_login' | 'account_locked' | 'ip_blocked' | 'suspicious_payload' | 'rate_limit' | 'password_reset' | 'password_changed'
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("low").notNull(),
  ip: varchar("ip", { length: 64 }),
  userId: int("userId"),
  email: varchar("email", { length: 320 }),
  details: text("details"),
  userAgent: text("userAgent"),
  resolved: boolean("resolved").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SecurityEvent = typeof securityEvents.$inferSelect;
export type InsertSecurityEvent = typeof securityEvents.$inferInsert;

// ─── User Sessions (for forced logout and session management) ─────────────────

export const userSessions = mysqlTable("userSessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(), // SHA-256 of JWT
  ip: varchar("ip", { length: 64 }),
  userAgent: text("userAgent"),
  isActive: boolean("isActive").default(true).notNull(),
  invalidatedAt: timestamp("invalidatedAt"),
  invalidationReason: varchar("invalidationReason", { length: 64 }), // 'logout' | 'password_changed' | 'admin_revoke'
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = typeof userSessions.$inferInsert;

// ─── Client Portal Tokens ─────────────────────────────────────────────────────

export const clientPortalTokens = mysqlTable("clientPortalTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),       // freelancer who owns this portal
  clientId: int("clientId").notNull(),   // client who can view it
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt"),     // null = never expires
  lastViewedAt: timestamp("lastViewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ClientPortalToken = typeof clientPortalTokens.$inferSelect;
export type InsertClientPortalToken = typeof clientPortalTokens.$inferInsert;

// ─── Contracts & Proposals ────────────────────────────────────────────────────

export const contracts = mysqlTable("contracts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientId: int("clientId"),
  clientName: varchar("clientName", { length: 255 }).notNull(),
  clientEmail: varchar("clientEmail", { length: 320 }),
  title: varchar("title", { length: 512 }).notNull(),
  type: mysqlEnum("type", ["contract", "proposal"]).default("contract").notNull(),
  status: mysqlEnum("status", ["draft", "sent", "signed", "declined", "expired"]).default("draft").notNull(),
  // Content stored as rich text (markdown)
  body: text("body").notNull(),
  // Linked invoice (for proposal → invoice conversion)
  linkedInvoiceId: int("linkedInvoiceId"),
  // Value / amount for proposals
  proposalAmount: decimal("proposalAmount", { precision: 10, scale: 2 }),
  // Signature
  signedAt: timestamp("signedAt"),
  signatureData: text("signatureData"), // base64 or typed name
  // Expiry
  expiresAt: timestamp("expiresAt"),
  // Timestamps
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Contract = typeof contracts.$inferSelect;
export type InsertContract = typeof contracts.$inferInsert;

// ─── In-App Notifications ─────────────────────────────────────────────────────
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  type: mysqlEnum("type", ["info", "success", "warning", "error"]).default("info").notNull(),
  link: varchar("link", { length: 512 }),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── Time Tracking ────────────────────────────────────────────────────────────
export const timeEntries = mysqlTable("timeEntries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientId: int("clientId"),
  clientName: varchar("clientName", { length: 255 }),
  projectName: varchar("projectName", { length: 255 }),
  description: text("description"),
  startedAt: timestamp("startedAt").notNull(),
  endedAt: timestamp("endedAt"),
  durationMinutes: int("durationMinutes"), // null = timer running
  hourlyRate: decimal("hourlyRate", { precision: 10, scale: 2 }),
  billable: boolean("billable").default(true).notNull(),
  invoiced: boolean("invoiced").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeEntry = typeof timeEntries.$inferInsert;

// ─── Client Documents ─────────────────────────────────────────────────────────
export const clientDocuments = mysqlTable("clientDocuments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientId: int("clientId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 1024 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  sizeBytes: int("sizeBytes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ClientDocument = typeof clientDocuments.$inferSelect;
export type InsertClientDocument = typeof clientDocuments.$inferInsert;

// ─── Recurring Invoices ───────────────────────────────────────────────────────
export const recurringInvoices = mysqlTable("recurringInvoices", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientId: int("clientId"),
  clientName: varchar("clientName", { length: 255 }).notNull(),
  clientEmail: varchar("clientEmail", { length: 320 }),
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  frequency: mysqlEnum("frequency", ["weekly", "biweekly", "monthly", "quarterly", "yearly"]).notNull(),
  nextDueAt: timestamp("nextDueAt").notNull(),
  active: boolean("active").default(true).notNull(),
  lastInvoiceId: int("lastInvoiceId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RecurringInvoice = typeof recurringInvoices.$inferSelect;
export type InsertRecurringInvoice = typeof recurringInvoices.$inferInsert;
// ─── Audit Log ────────────────────────────────────────────────────────────────
export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 128 }).notNull(),
  entityType: varchar("entityType", { length: 64 }),
  entityId: int("entityId"),
  details: text("details"),
  ip: varchar("ip", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ─── User API Keys ─────────────────────────────────────────────────────────────
export const userApiKeys = mysqlTable("userApiKeys", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  keyHash: varchar("keyHash", { length: 256 }).notNull(),
  keyPrefix: varchar("keyPrefix", { length: 16 }).notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
  expiresAt: timestamp("expiresAt"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type UserApiKey = typeof userApiKeys.$inferSelect;
export type InsertUserApiKey = typeof userApiKeys.$inferInsert;

// ─── Contact Messages ──────────────────────────────────────────────────────────
export const contactMessages = mysqlTable("contactMessages", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ContactMessage = typeof contactMessages.$inferSelect;
export type InsertContactMessage = typeof contactMessages.$inferInsert;

// ─── Client Portal Messages ───────────────────────────────────────────────────
export const portalMessages = mysqlTable("portalMessages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),       // freelancer (owner)
  clientId: int("clientId").notNull(),   // client who sent/received
  senderRole: mysqlEnum("senderRole", ["client", "owner"]).notNull(),
  body: text("body").notNull(),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PortalMessage = typeof portalMessages.$inferSelect;
export type InsertPortalMessage = typeof portalMessages.$inferInsert;

// ─── Follow-Up Sequence Rules ─────────────────────────────────────────────────
export const followUpRules = mysqlTable("followUpRules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  triggerDays: int("triggerDays").notNull().default(30), // days since last booking
  emailSubject: varchar("emailSubject", { length: 512 }).notNull(),
  emailBody: text("emailBody").notNull(),
  active: boolean("active").default(true).notNull(),
  lastRunAt: timestamp("lastRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type FollowUpRule = typeof followUpRules.$inferSelect;
export type InsertFollowUpRule = typeof followUpRules.$inferInsert;

// ─── Client Tags ──────────────────────────────────────────────────────────────
export const clientTags = mysqlTable("clientTags", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientId: int("clientId").notNull(),
  tag: varchar("tag", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ClientTag = typeof clientTags.$inferSelect;
export type InsertClientTag = typeof clientTags.$inferInsert;

// ─── Testimonials ─────────────────────────────────────────────────────────────
export const testimonials = mysqlTable("testimonials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),       // freelancer
  clientId: int("clientId"),
  clientName: varchar("clientName", { length: 255 }).notNull(),
  clientEmail: varchar("clientEmail", { length: 320 }),
  invoiceId: int("invoiceId"),           // invoice that triggered the request
  body: text("body"),                    // testimonial text (filled by client)
  rating: int("rating"),                 // 1-5
  status: mysqlEnum("status", ["requested", "submitted", "approved", "rejected"]).default("requested").notNull(),
  requestToken: varchar("requestToken", { length: 128 }).unique(), // for public submission link
  approvedAt: timestamp("approvedAt"),
  submittedAt: timestamp("submittedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Testimonial = typeof testimonials.$inferSelect;
export type InsertTestimonial = typeof testimonials.$inferInsert;

// ─── Booking Cancel / Reschedule Tokens ───────────────────────────────────────
export const bookingCancelTokens = mysqlTable("bookingCancelTokens", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  action: mysqlEnum("action", ["cancel", "reschedule"]).notNull(),
  used: boolean("used").default(false).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BookingCancelToken = typeof bookingCancelTokens.$inferSelect;
export type InsertBookingCancelToken = typeof bookingCancelTokens.$inferInsert;

// ─── Google Calendar Tokens ───────────────────────────────────────────────────
export const googleCalendarTokens = mysqlTable("googleCalendarTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  expiresAt: timestamp("expiresAt"),
  calendarId: varchar("calendarId", { length: 255 }).default("primary"),
  syncEnabled: boolean("syncEnabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GoogleCalendarToken = typeof googleCalendarTokens.$inferSelect;
export type InsertGoogleCalendarToken = typeof googleCalendarTokens.$inferInsert;
