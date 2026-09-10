import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Password auth for self-hosted accounts.
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
},
(t) => [uniqueIndex("users_email_idx").on(t.email)]
);

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
  pipelineStage: mysqlEnum("pipelineStage", ["inquiry", "proposal_sent", "active", "completed", "lost"]).default("inquiry"),
  notes: text("notes"),
  avatarInitials: varchar("avatarInitials", { length: 4 }),
  totalRevenue: decimal("totalRevenue", { precision: 10, scale: 2 }).default("0"),
  sessionsCount: int("sessionsCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastContactedAt: timestamp("lastContactedAt"),
  defaultRate: decimal("defaultRate", { precision: 10, scale: 2 }),
},
(t) => [
  index("clients_userId_idx").on(t.userId),
  uniqueIndex("clients_user_email_unique_idx").on(t.userId, t.email),
]
);

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// ─── Customer Assets (private owner operations) ──────────────────────────────
// Assets are deliberately owner-scoped and linked to one owner-scoped client.
// They are not part of the public client-portal projection.
export const customerAssets = mysqlTable("customerAssets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientId: int("clientId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  assetTag: varchar("assetTag", { length: 128 }),
  functionalLocation: varchar("functionalLocation", { length: 255 }),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("customerAssets_owner_client_idx").on(t.userId, t.clientId),
  index("customerAssets_owner_active_idx").on(t.userId, t.active),
]);

export type CustomerAsset = typeof customerAssets.$inferSelect;
export type InsertCustomerAsset = typeof customerAssets.$inferInsert;

// ─── Asset Inspection Templates (private owner operations) ─────────────────
// These records are intentionally separate from generic job checklists and
// public portal projections. They are foundations only; offline use, client
// delivery, regulatory compliance, and automated maintenance are out of scope.
export const assetInspectionTemplates = mysqlTable("assetInspectionTemplates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  templateFamilyId: int("templateFamilyId"), // Root template id for later private revisions; intentionally no foreign key.
  name: varchar("name", { length: 255 }).notNull(),
  version: int("version").default(1).notNull(),
  fields: text("fields").notNull(), // JSON inspection field definitions
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("assetInspectionTemplates_owner_active_idx").on(t.userId, t.active),
  index("assetInspectionTemplates_owner_family_idx").on(t.userId, t.templateFamilyId),
]);

export type AssetInspectionTemplate = typeof assetInspectionTemplates.$inferSelect;
export type InsertAssetInspectionTemplate = typeof assetInspectionTemplates.$inferInsert;

// ─── Asset Inspection Responses (private owner operations) ─────────────────
// Responses retain the selected template version and are deliberately separate
// from client portal data, attachments, automated maintenance, and offline sync.
export const assetInspectionResponses = mysqlTable("assetInspectionResponses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  jobId: int("jobId").notNull(),
  clientId: int("clientId").notNull(),
  customerAssetId: int("customerAssetId").notNull(),
  templateId: int("templateId").notNull(),
  templateVersion: int("templateVersion").notNull(),
  templateFields: text("templateFields").notNull(), // JSON field-definition snapshot at response creation
  responses: text("responses").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("assetInspectionResponses_owner_job_idx").on(t.userId, t.jobId),
  index("assetInspectionResponses_owner_asset_idx").on(t.userId, t.customerAssetId),
]);
export type AssetInspectionResponse = typeof assetInspectionResponses.$inferSelect;
export type InsertAssetInspectionResponse = typeof assetInspectionResponses.$inferInsert;

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
  lineItems: text("lineItems"), // JSON: [{description, qty, unitPrice}]
  paidAt: timestamp("paidAt"),
  payLinkToken: varchar("payLinkToken", { length: 64 }),
  stripePaymentLinkUrl: text("stripePaymentLinkUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
},
(t) => [
  index("invoices_userId_idx").on(t.userId),
  index("invoices_status_idx").on(t.status),
  uniqueIndex("invoices_owner_number_unique_idx").on(t.userId, t.invoiceNumber),
]
);

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
  slotKey: varchar("slotKey", { length: 160 }).unique(),
  duration: int("duration").default(60),
  status: mysqlEnum("status", ["scheduled", "completed", "cancelled", "no_show"]).default("scheduled").notNull(),
  notes: text("notes"),
  isPublicBooking: boolean("isPublicBooking").default(false),
  reminderSentAt: timestamp("reminderSentAt"),
  checkInSentAt: timestamp("checkInSentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
},
(t) => [index("bookings_userId_idx").on(t.userId), index("bookings_date_idx").on(t.date), uniqueIndex("bookings_live_slot_unique_idx").on(t.slotKey)]
);

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
},
(t) => [index("followUps_userId_idx").on(t.userId)]
);

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
},
(t) => [index("emailTemplates_userId_idx").on(t.userId)]
);

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
},
(t) => [index("clientPulse_userId_idx").on(t.userId), index("clientPulse_clientId_idx").on(t.clientId)]
);

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
},
(t) => [uniqueIndex("prt_token_idx").on(t.token), index("prt_userId_idx").on(t.userId)]
);

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
},
(t) => [index("securityEvents_ip_idx").on(t.ip), index("securityEvents_userId_idx").on(t.userId)]
);

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
},
(t) => [index("userSessions_userId_idx").on(t.userId), uniqueIndex("userSessions_tokenHash_idx").on(t.tokenHash)]
);

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = typeof userSessions.$inferInsert;

// ─── Client Portal Tokens ─────────────────────────────────────────────────────

export const clientPortalTokens = mysqlTable("clientPortalTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),       // freelancer who owns this portal
  clientId: int("clientId").notNull(),   // client who can view it
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt"),     // null = never expires
  revoked: boolean("revoked").default(false).notNull(),
  revokedAt: timestamp("revokedAt"),
  lastViewedAt: timestamp("lastViewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
},
(t) => [index("portal_userId_clientId_idx").on(t.userId, t.clientId)]
);

export type ClientPortalToken = typeof clientPortalTokens.$inferSelect;
export type InsertClientPortalToken = typeof clientPortalTokens.$inferInsert;

// ─── Owner Calendar Feed Tokens ──────────────────────────────────────────────

export const calendarFeedTokens = mysqlTable("calendarFeedTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // The raw bearer credential is returned only at creation or rotation and is
  // never persisted, so database access alone cannot redeem a subscription URL.
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  revoked: boolean("revoked").default(false).notNull(),
  revokedAt: timestamp("revokedAt"),
  lastAccessedAt: timestamp("lastAccessedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [uniqueIndex("calendar_feed_tokens_user_idx").on(t.userId)]);

export type CalendarFeedToken = typeof calendarFeedTokens.$inferSelect;
export type InsertCalendarFeedToken = typeof calendarFeedTokens.$inferInsert;

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
},
(t) => [index("contracts_userId_idx").on(t.userId)]
);

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
},
(t) => [index("notifications_userId_idx").on(t.userId), index("notifications_read_idx").on(t.read)]
);

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── Time Tracking ────────────────────────────────────────────────────────────
export const timeEntries = mysqlTable("timeEntries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientId: int("clientId"),
  jobId: int("jobId"),
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
},
(t) => [index("timeEntries_userId_idx").on(t.userId), index("timeEntries_jobId_idx").on(t.jobId)]
);

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
  clientVisible: boolean("clientVisible").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
},
(t) => [index("clientDocuments_userId_idx").on(t.userId), index("clientDocuments_clientId_idx").on(t.clientId), index("clientDocuments_owner_visible_idx").on(t.userId, t.clientVisible)]
);

export type ClientDocument = typeof clientDocuments.$inferSelect;
export type InsertClientDocument = typeof clientDocuments.$inferInsert;

export const clientCustomFields = mysqlTable("clientCustomFields", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), label: varchar("label", { length: 100 }).notNull(), fieldKey: varchar("fieldKey", { length: 100 }).notNull(), fieldType: mysqlEnum("fieldType", ["text", "select"]).notNull(), options: text("options"), active: boolean("active").default(true).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [index("clientCustomFields_owner_idx").on(t.userId), uniqueIndex("clientCustomFields_owner_key_unique").on(t.userId, t.fieldKey)]);

export const clientCustomFieldValues = mysqlTable("clientCustomFieldValues", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), clientId: int("clientId").notNull(), fieldId: int("fieldId").notNull(), value: text("value"), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [index("clientCustomFieldValues_owner_client_idx").on(t.userId, t.clientId), uniqueIndex("clientCustomFieldValues_owner_client_field_unique").on(t.userId, t.clientId, t.fieldId)]);

// ─── Reusable Job Checklist Templates ────────────────────────────────────────
export const jobChecklistTemplates = mysqlTable("jobChecklistTemplates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [index("jobChecklistTemplates_owner_idx").on(t.userId)]);

export const jobChecklistTemplateItems = mysqlTable("jobChecklistTemplateItems", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  templateId: int("templateId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("jobChecklistTemplateItems_template_idx").on(t.templateId), index("jobChecklistTemplateItems_owner_template_idx").on(t.userId, t.templateId)]);

export type JobChecklistTemplate = typeof jobChecklistTemplates.$inferSelect;
export type InsertJobChecklistTemplate = typeof jobChecklistTemplates.$inferInsert;
export type JobChecklistTemplateItem = typeof jobChecklistTemplateItems.$inferSelect;
export type InsertJobChecklistTemplateItem = typeof jobChecklistTemplateItems.$inferInsert;

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
},
(t) => [index("recurringInvoices_userId_idx").on(t.userId)]
);

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
},
(t) => [index("auditLogs_userId_idx").on(t.userId)]
);
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
},
(t) => [index("userApiKeys_userId_idx").on(t.userId)]
);
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
},
(t) => [index("portalMessages_userId_idx").on(t.userId), index("portalMessages_clientId_idx").on(t.clientId)]
);
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
},
(t) => [index("followUpRules_userId_idx").on(t.userId)]
);
export type FollowUpRule = typeof followUpRules.$inferSelect;
export type InsertFollowUpRule = typeof followUpRules.$inferInsert;

// ─── Client Tags ──────────────────────────────────────────────────────────────
export const clientTags = mysqlTable("clientTags", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientId: int("clientId").notNull(),
  tag: varchar("tag", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
},
(t) => [index("clientTags_userId_idx").on(t.userId), index("clientTags_clientId_idx").on(t.clientId)]
);
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
  serviceName: varchar("serviceName", { length: 255 }),  // service name for context
  body: text("body"),                    // testimonial text (filled by client)
  rating: int("rating"),                 // 1-5
  status: mysqlEnum("status", ["requested", "submitted", "approved", "rejected"]).default("requested").notNull(),
  requestToken: varchar("requestToken", { length: 128 }).unique(), // for public submission link
  approvedAt: timestamp("approvedAt"),
  submittedAt: timestamp("submittedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
},
(t) => [index("testimonials_userId_idx").on(t.userId), uniqueIndex("testimonials_requestToken_idx").on(t.requestToken)]
);
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
},
(t) => [index("bookingCancelTokens_userId_idx").on(t.userId), uniqueIndex("bookingCancelTokens_token_idx").on(t.token)]
);
export type BookingCancelToken = typeof bookingCancelTokens.$inferSelect;
export type InsertBookingCancelToken = typeof bookingCancelTokens.$inferInsert;

// ─── Google Calendar Tokens ───────────────────────────────────────────────────
// OAuth token ciphertext is stored using authenticated encryption with the server
// secret-derived key. Column names remain stable for backwards-compatible schema
// access; raw provider bearer tokens must never be persisted in these fields.
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

// ─── Service / Package Catalog ────────────────────────────────────────────────
export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  durationMinutes: int("durationMinutes").default(60),
  category: varchar("category", { length: 64 }).default("service"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
},
(t) => [index("services_userId_idx").on(t.userId)]
);
export type Service = typeof services.$inferSelect;
export type InsertService = typeof services.$inferInsert;

// ─── Expenses ─────────────────────────────────────────────────────────────────
export const expenses = mysqlTable("expenses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  jobId: int("jobId"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  category: varchar("category", { length: 64 }).notNull().default("other"),
  description: varchar("description", { length: 512 }).notNull(),
  vendor: varchar("vendor", { length: 255 }),
  date: varchar("date", { length: 32 }).notNull(),
  receiptUrl: text("receiptUrl"),
  taxDeductible: boolean("taxDeductible").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
},
(t) => [index("expenses_userId_idx").on(t.userId), index("expenses_owner_job_idx").on(t.userId, t.jobId)]
);
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;

// ─── Proposals ────────────────────────────────────────────────────────────────
export const proposals = mysqlTable("proposals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientId: int("clientId"),
  clientName: varchar("clientName", { length: 255 }).notNull(),
  clientEmail: varchar("clientEmail", { length: 320 }),
  title: varchar("title", { length: 512 }).notNull(),
  scope: text("scope"),
  lineItems: text("lineItems").notNull(), // JSON: [{id,name,description,qty,unitPrice,total}]
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default("0").notNull(),
  taxRate: decimal("taxRate", { precision: 5, scale: 2 }).default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).default("0").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  validUntil: varchar("validUntil", { length: 32 }),
  status: mysqlEnum("status", ["draft", "sent", "viewed", "signed", "declined"]).default("draft").notNull(),
  token: varchar("token", { length: 128 }).unique(), // public signing link token
  packageOptions: text("packageOptions"), // JSON: owner-defined client-selectable proposal packages; null for a standard proposal
  selectedPackageId: varchar("selectedPackageId", { length: 64 }), // immutable token-scoped choice recorded when signed
  selectedPackage: text("selectedPackage"), // JSON snapshot of the selected package at signing
  declineReason: varchar("declineReason", { length: 1000 }), // optional token-scoped client note; owner-visible only
  signedAt: timestamp("signedAt"),
  signatureName: varchar("signatureName", { length: 255 }),
  viewedAt: timestamp("viewedAt"),
  sentAt: timestamp("sentAt"),
  linkedInvoiceId: int("linkedInvoiceId"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
},
(t) => [uniqueIndex("proposals_token_idx").on(t.token), index("proposals_userId_idx").on(t.userId)]
);
export type Proposal = typeof proposals.$inferSelect;
export type InsertProposal = typeof proposals.$inferInsert;

// ─── Workflow Automations ─────────────────────────────────────────────────────
export const automations = mysqlTable("automations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  trigger: varchar("trigger", { length: 64 }).notNull(), // 'booking_confirmed' | 'invoice_sent' | 'invoice_overdue' | 'client_added' | 'proposal_signed'
  triggerDelayHours: int("triggerDelayHours").default(0), // delay after trigger
  conditions: text("conditions"), // JSON: [{field, operator, value}]
  actions: text("actions").notNull(), // JSON: [{type, config}]
  active: boolean("active").default(true).notNull(),
  runCount: int("runCount").default(0).notNull(),
  lastRunAt: timestamp("lastRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
},
(t) => [index("automations_userId_idx").on(t.userId)]
);
export type Automation = typeof automations.$inferSelect;
export type InsertAutomation = typeof automations.$inferInsert;

// ─── Automation Logs ──────────────────────────────────────────────────────────
export const automationLogs = mysqlTable("automationLogs", {
  id: int("id").autoincrement().primaryKey(),
  automationId: int("automationId").notNull(),
  userId: int("userId").notNull(),
  trigger: varchar("trigger", { length: 64 }).notNull(),
  entityType: varchar("entityType", { length: 64 }),
  entityId: int("entityId"),
  status: mysqlEnum("status", ["success", "failed", "skipped"]).default("success").notNull(),
  actionsExecuted: int("actionsExecuted").default(0).notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
},
(t) => [index("automationLogs_userId_idx").on(t.userId), index("automationLogs_automationId_idx").on(t.automationId)]
);
export type AutomationLog = typeof automationLogs.$inferSelect;
export type InsertAutomationLog = typeof automationLogs.$inferInsert;

// ── Intake / Questionnaire Forms ─────────────────────────────────────────────
export const intakeForms = mysqlTable("intakeForms", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  fields: text("fields").notNull(), // JSON array of field definitions
  active: boolean("active").default(true).notNull(),
  publicSlug: varchar("publicSlug", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
},
(t) => [index("intakeForms_userId_idx").on(t.userId)]
);
export type IntakeForm = typeof intakeForms.$inferSelect;
export type InsertIntakeForm = typeof intakeForms.$inferInsert;

export const intakeResponses = mysqlTable("intakeResponses", {
  id: int("id").autoincrement().primaryKey(),
  formId: int("formId").notNull(),
  userId: int("userId").notNull(),
  respondentName: varchar("respondentName", { length: 255 }),
  respondentEmail: varchar("respondentEmail", { length: 255 }),
  answers: text("answers").notNull(), // JSON object field_id → answer
  linkedClientId: int("linkedClientId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
},
(t) => [index("intakeResponses_userId_idx").on(t.userId), index("intakeResponses_formId_idx").on(t.formId)]
);
export type IntakeResponse = typeof intakeResponses.$inferSelect;
export type InsertIntakeResponse = typeof intakeResponses.$inferInsert;

// ── Revenue Goals & Forecasting ───────────────────────────────────────────────
export const revenueGoals = mysqlTable("revenueGoals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  year: int("year").notNull(),
  month: int("month"), // null = annual goal
  targetAmount: decimal("targetAmount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),
  label: varchar("label", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
},
(t) => [index("revenueGoals_userId_idx").on(t.userId)]
);
export type RevenueGoal = typeof revenueGoals.$inferSelect;
export type InsertRevenueGoal = typeof revenueGoals.$inferInsert;

// ── Contract Templates ────────────────────────────────────────────────────────
export const contractTemplates = mysqlTable("contractTemplates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }),
  body: text("body").notNull(),
  isBuiltIn: boolean("isBuiltIn").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
},
(t) => [index("contractTemplates_userId_idx").on(t.userId)]
);
export type ContractTemplate = typeof contractTemplates.$inferSelect;
export type InsertContractTemplate = typeof contractTemplates.$inferInsert;

// ── Stripe Webhook Events (durable processing and idempotency) ────────────────
// Stores a bounded encrypted event envelope plus processing state so accepted
// events can be recovered after a process restart. It is not an assertion of
// provider delivery or receiver-side processing completion.
export const stripeWebhookEvents = mysqlTable("stripeWebhookEvents", {
  id: int("id").autoincrement().primaryKey(),
  eventId: varchar("eventId", { length: 255 }).notNull(),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  processedAt: timestamp("processedAt").defaultNow().notNull(),
  status: mysqlEnum("status", ["received", "processing", "processed", "retryable", "terminal"]).default("processed").notNull(),
  payloadCiphertext: text("payloadCiphertext"),
  attemptCount: int("attemptCount").default(0).notNull(),
  nextAttemptAt: timestamp("nextAttemptAt"),
  lastError: varchar("lastError", { length: 1000 }),
  completedAt: timestamp("completedAt"),
  processingStartedAt: timestamp("processingStartedAt"),
},
(t) => [
  uniqueIndex("stripeWebhookEvents_eventId_idx").on(t.eventId),
  index("stripeWebhookEvents_retry_due_idx").on(t.status, t.nextAttemptAt),
]
);
export type StripeWebhookEvent = typeof stripeWebhookEvents.$inferSelect;
export type InsertStripeWebhookEvent = typeof stripeWebhookEvents.$inferInsert;

// ── Job Photos ────────────────────────────────────────────────────────────────
// Stores photos attached to bookings/jobs: estimate photos from clients,
// work-in-progress and finished photos from the business owner,
// and receipt photos linked to line items for the photo receipt calculator.
export const jobPhotos = mysqlTable("jobPhotos", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),          // owner of the job
  // Reference to the associated booking (nullable — can also attach to a client)
  bookingId: int("bookingId"),
  clientId: int("clientId"),
  jobId: int("jobId"),
  // Photo classification
  photoType: mysqlEnum("photoType", ["estimate", "wip", "finished", "receipt"]).notNull().default("estimate"),
  uploadedBy: mysqlEnum("uploadedBy", ["client", "owner"]).notNull().default("client"),
  // S3 storage
  photoUrl: text("photoUrl").notNull(),
  photoKey: varchar("photoKey", { length: 512 }).notNull(),
  // Optional metadata
  caption: varchar("caption", { length: 512 }),
  clientVisible: boolean("clientVisible").notNull().default(false),
  // Receipt calculator fields (only used when photoType = 'receipt')
  lineItemLabel: varchar("lineItemLabel", { length: 255 }),
  lineItemAmount: decimal("lineItemAmount", { precision: 10, scale: 2 }),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
},
(t) => [
  index("jobPhotos_userId_idx").on(t.userId),
  index("jobPhotos_bookingId_idx").on(t.bookingId),
  index("jobPhotos_clientId_idx").on(t.clientId),
  index("jobPhotos_jobId_idx").on(t.jobId),
  index("jobPhotos_photoType_idx").on(t.photoType),
  index("jobPhotos_user_job_clientVisible_idx").on(t.userId, t.jobId, t.clientVisible),
]
);
export type JobPhoto = typeof jobPhotos.$inferSelect;
export type InsertJobPhoto = typeof jobPhotos.$inferInsert;

// ─── Unified Job Workspace ───────────────────────────────────────────────────
export const jobs = mysqlTable("jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientId: int("clientId").notNull(),
  customerAssetId: int("customerAssetId"),
  bookingId: int("bookingId"),
  invoiceId: int("invoiceId"),
  proposalId: int("proposalId"),
  contractId: int("contractId"),
  jobNumber: varchar("jobNumber", { length: 64 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  // Private operational scope remains separate from the explicit, owner-reviewed portal summary.
  clientSummary: text("clientSummary"),
  clientSummaryVisible: boolean("clientSummaryVisible").notNull().default(false),
  status: mysqlEnum("status", ["lead", "quoted", "approved", "scheduled", "in_progress", "awaiting_client", "completed", "cancelled"]).notNull().default("lead"),
  priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]).notNull().default("normal"),
  startDate: varchar("startDate", { length: 32 }),
  targetDate: varchar("targetDate", { length: 32 }),
  budgetAmount: decimal("budgetAmount", { precision: 12, scale: 2 }),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("jobs_userId_idx").on(t.userId),
  index("jobs_clientId_idx").on(t.clientId),
  index("jobs_user_clientSummaryVisible_idx").on(t.userId, t.clientId, t.clientSummaryVisible),
  index("jobs_customerAssetId_idx").on(t.customerAssetId),
  index("jobs_bookingId_idx").on(t.bookingId),
  uniqueIndex("jobs_userId_jobNumber_unique_idx").on(t.userId, t.jobNumber),
]);
export type Job = typeof jobs.$inferSelect;

export const jobTasks = mysqlTable("jobTasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  jobId: int("jobId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  clientVisible: boolean("clientVisible").notNull().default(false),
  status: mysqlEnum("status", ["todo", "in_progress", "done"]).notNull().default("todo"),
  dueDate: varchar("dueDate", { length: 32 }),
  sortOrder: int("sortOrder").notNull().default(0),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [index("jobTasks_userId_idx").on(t.userId), index("jobTasks_jobId_idx").on(t.jobId), index("jobTasks_user_job_clientVisible_idx").on(t.userId, t.jobId, t.clientVisible)]);
export type JobTask = typeof jobTasks.$inferSelect;

export const jobActivities = mysqlTable("jobActivities", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  jobId: int("jobId").notNull(),
  actor: varchar("actor", { length: 32 }).notNull(),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  message: text("message").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("jobActivities_userId_idx").on(t.userId), index("jobActivities_jobId_idx").on(t.jobId)]);
export type JobActivity = typeof jobActivities.$inferSelect;

// ─── Client Deliverable Approvals ────────────────────────────────────────────
// Explicit owner-created review requests. These are token-scoped through the
// client portal and intentionally exclude staffing, dispatch, and internal notes.
export const clientApprovalRequests = mysqlTable("clientApprovalRequests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientId: int("clientId").notNull(),
  jobId: int("jobId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["pending", "approved", "changes_requested"]).notNull().default("pending"),
  clientResponse: text("clientResponse"),
  respondedAt: timestamp("respondedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("clientApprovalRequests_userId_idx").on(t.userId),
  index("clientApprovalRequests_jobId_idx").on(t.jobId),
  index("clientApprovalRequests_clientId_idx").on(t.clientId),
  index("clientApprovalRequests_owner_status_idx").on(t.userId, t.status),
]);
export type ClientApprovalRequest = typeof clientApprovalRequests.$inferSelect;

// ─── Team Operations & Dispatch Foundation ────────────────────────────────────
// Team members are owner-managed operational roster records. They are not
// authenticated accounts, so a matching email never grants access to a workspace.
export const teamMembers = mysqlTable("teamMembers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  role: mysqlEnum("role", ["coordinator", "manager", "specialist", "technician", "contractor"]).notNull().default("specialist"),
  color: varchar("color", { length: 16 }).notNull().default("#D4922A"),
  weeklyCapacityMinutes: int("weeklyCapacityMinutes").notNull().default(2400),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [index("teamMembers_userId_idx").on(t.userId), index("teamMembers_user_active_idx").on(t.userId, t.active)]);
export type TeamMember = typeof teamMembers.$inferSelect;

// Owner-managed scheduling exceptions. These are private planning aids, not
// attendance, payroll, location, recurring-hours, or client-facing records.
export const staffAvailabilityBlocks = mysqlTable("staffAvailabilityBlocks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  teamMemberId: int("teamMemberId").notNull(),
  startsAt: timestamp("startsAt").notNull(),
  endsAt: timestamp("endsAt").notNull(),
  reason: varchar("reason", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("staffAvailabilityBlocks_owner_member_start_idx").on(t.userId, t.teamMemberId, t.startsAt),
  index("staffAvailabilityBlocks_owner_start_idx").on(t.userId, t.startsAt),
]);
export type StaffAvailabilityBlock = typeof staffAvailabilityBlocks.$inferSelect;

// Authenticated staff access is a separate, opt-in layer over the owner roster.
// A roster email alone never grants workspace access.
export const workspaceStaffInvites = mysqlTable("workspaceStaffInvites", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId").notNull(),
  teamMemberId: int("teamMemberId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("role", ["field_member", "operations_manager"]).notNull().default("field_member"),
  token: varchar("token", { length: 128 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  acceptedUserId: int("acceptedUserId"),
  revoked: boolean("revoked").notNull().default(false),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("workspaceStaffInvites_owner_idx").on(t.ownerUserId),
  index("workspaceStaffInvites_member_idx").on(t.teamMemberId),
  uniqueIndex("workspaceStaffInvites_token_unique_idx").on(t.token),
]);
export type WorkspaceStaffInvite = typeof workspaceStaffInvites.$inferSelect;

export const workspaceStaffMemberships = mysqlTable("workspaceStaffMemberships", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId").notNull(),
  memberUserId: int("memberUserId").notNull(),
  teamMemberId: int("teamMemberId").notNull(),
  role: mysqlEnum("role", ["field_member", "operations_manager"]).notNull().default("field_member"),
  active: boolean("active").notNull().default(true),
  acceptedAt: timestamp("acceptedAt").defaultNow().notNull(),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("workspaceStaffMemberships_owner_idx").on(t.ownerUserId),
  index("workspaceStaffMemberships_member_idx").on(t.memberUserId),
  uniqueIndex("workspaceStaffMemberships_owner_member_unique_idx").on(t.ownerUserId, t.memberUserId),
  uniqueIndex("workspaceStaffMemberships_owner_team_unique_idx").on(t.ownerUserId, t.teamMemberId),
]);
export type WorkspaceStaffMembership = typeof workspaceStaffMemberships.$inferSelect;

export const jobAssignments = mysqlTable("jobAssignments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  jobId: int("jobId").notNull(),
  teamMemberId: int("teamMemberId").notNull(),
  assignmentRole: mysqlEnum("assignmentRole", ["lead", "support", "reviewer", "coordinator"]).notNull().default("support"),
  status: mysqlEnum("status", ["assigned", "acknowledged", "declined", "completed"]).notNull().default("assigned"),
  plannedMinutes: int("plannedMinutes"),
  note: varchar("note", { length: 1000 }),
  acknowledgedAt: timestamp("acknowledgedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("jobAssignments_userId_idx").on(t.userId),
  index("jobAssignments_jobId_idx").on(t.jobId),
  index("jobAssignments_memberId_idx").on(t.teamMemberId),
  uniqueIndex("jobAssignments_owner_job_member_unique_idx").on(t.userId, t.jobId, t.teamMemberId),
]);
export type JobAssignment = typeof jobAssignments.$inferSelect;

// A service visit is a planned execution window inside a job. It does not claim
// GPS tracking or automated routing. Owners may optionally share a curated
// appointment window and client-safe update; staffing and dispatch notes stay private.
export const serviceVisits = mysqlTable("serviceVisits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  jobId: int("jobId").notNull(),
  recurringServicePlanId: int("recurringServicePlanId"),
  teamMemberId: int("teamMemberId"),
  title: varchar("title", { length: 255 }).notNull(),
  scheduledStart: timestamp("scheduledStart").notNull(),
  scheduledEnd: timestamp("scheduledEnd").notNull(),
  status: mysqlEnum("status", ["scheduled", "en_route", "in_progress", "completed", "cancelled"]).notNull().default("scheduled"),
  siteLabel: varchar("siteLabel", { length: 255 }),
  dispatchNote: varchar("dispatchNote", { length: 1000 }),
  clientVisible: boolean("clientVisible").notNull().default(false),
  clientUpdate: varchar("clientUpdate", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("serviceVisits_userId_idx").on(t.userId),
  index("serviceVisits_jobId_idx").on(t.jobId),
  index("serviceVisits_member_time_idx").on(t.teamMemberId, t.scheduledStart),
  index("serviceVisits_owner_time_idx").on(t.userId, t.scheduledStart),
  index("serviceVisits_recurring_plan_start_idx").on(t.recurringServicePlanId, t.scheduledStart),
  uniqueIndex("serviceVisits_recurring_plan_start_unique_idx").on(t.recurringServicePlanId, t.scheduledStart),
]);
export type ServiceVisit = typeof serviceVisits.$inferSelect;

// Owner-private recurring service definitions. Plans generate internal service
// visits only when an owner explicitly requests generation; no billing, provider
// sync, client membership, or public-plan behavior is implied by this model.
export const recurringServicePlans = mysqlTable("recurringServicePlans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  jobId: int("jobId").notNull(),
  customerAssetId: int("customerAssetId"), // Private same-client asset context; intentionally no foreign key.
  name: varchar("name", { length: 255 }).notNull(),
  serviceName: varchar("serviceName", { length: 255 }).notNull(),
  frequency: mysqlEnum("frequency", ["weekly", "monthly"]).notNull(),
  weekday: int("weekday"),
  dayOfMonth: int("dayOfMonth"),
  startDate: varchar("startDate", { length: 10 }).notNull(),
  endDate: varchar("endDate", { length: 10 }),
  startTime: varchar("startTime", { length: 5 }).notNull().default("09:00"),
  durationMinutes: int("durationMinutes").notNull().default(60),
  nextVisitAt: timestamp("nextVisitAt"),
  planningNote: varchar("planningNote", { length: 1000 }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("recurringServicePlans_userId_idx").on(t.userId),
  index("recurringServicePlans_jobId_idx").on(t.jobId),
  index("recurringServicePlans_owner_asset_idx").on(t.userId, t.customerAssetId),
  index("recurringServicePlans_owner_active_idx").on(t.userId, t.active),
]);
export type RecurringServicePlan = typeof recurringServicePlans.$inferSelect;

// ─── Integration Readiness ────────────────────────────────────────────────────
// This table stores only owner-visible readiness metadata. Provider credentials and
// access tokens remain in their dedicated secure integration paths.
export const integrationConnections = mysqlTable("integrationConnections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  provider: mysqlEnum("provider", ["google_calendar", "outlook_calendar", "quickbooks", "gmail", "outlook", "slack", "twilio", "zapier", "stripe"]).notNull(),
  category: mysqlEnum("category", ["calendar", "accounting", "communications", "automation", "payments"]).notNull(),
  status: mysqlEnum("status", ["not_connected", "needs_configuration", "connected", "error"]).notNull().default("not_connected"),
  configurationNote: varchar("configurationNote", { length: 1000 }),
  lastCheckedAt: timestamp("lastCheckedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("integrationConnections_userId_idx").on(t.userId),
  uniqueIndex("integrationConnections_owner_provider_unique_idx").on(t.userId, t.provider),
]);
export type IntegrationConnection = typeof integrationConnections.$inferSelect;

// ─── Outbound Workflow Webhooks ───────────────────────────────────────────────
// Subscription secrets are stored encrypted; delivery rows retain only bounded
// outcome evidence, never the original outbound payload.
export const workflowWebhooks = mysqlTable("workflowWebhooks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  endpointUrl: varchar("endpointUrl", { length: 2048 }).notNull(),
  encryptedSecret: text("encryptedSecret").notNull(),
  events: text("events").notNull(),
  active: boolean("active").notNull().default(true),
  failureCount: int("failureCount").notNull().default(0),
  lastDeliveredAt: timestamp("lastDeliveredAt"),
  lastError: varchar("lastError", { length: 1000 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("workflowWebhooks_userId_idx").on(t.userId),
  index("workflowWebhooks_user_active_idx").on(t.userId, t.active),
]);
export type WorkflowWebhook = typeof workflowWebhooks.$inferSelect;

export const workflowWebhookDeliveries = mysqlTable("workflowWebhookDeliveries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  webhookId: int("webhookId").notNull(),
  eventId: varchar("eventId", { length: 64 }).notNull(),
  eventType: mysqlEnum("eventType", ["job.status_changed", "service_visit.scheduled", "service_visit.status_changed"]).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "delivered", "failed", "retryable", "terminal"]).notNull().default("pending"),
  endpointUrl: varchar("endpointUrl", { length: 2048 }),
  payloadCiphertext: text("payloadCiphertext"),
  attemptCount: int("attemptCount").notNull().default(0),
  nextAttemptAt: timestamp("nextAttemptAt"),
  lastAttemptAt: timestamp("lastAttemptAt"),
  processingStartedAt: timestamp("processingStartedAt"),
  terminalAt: timestamp("terminalAt"),
  responseStatus: int("responseStatus"),
  responseSummary: varchar("responseSummary", { length: 1000 }),
  errorMessage: varchar("errorMessage", { length: 1000 }),
  deliveredAt: timestamp("deliveredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("workflowWebhookDeliveries_userId_idx").on(t.userId),
  index("workflowWebhookDeliveries_webhookId_idx").on(t.webhookId),
  index("workflowWebhookDeliveries_event_created_idx").on(t.eventType, t.createdAt),
  index("workflowWebhookDeliveries_owner_retry_due_idx").on(t.userId, t.status, t.nextAttemptAt),
  uniqueIndex("workflowWebhookDeliveries_webhook_event_unique_idx").on(t.webhookId, t.eventId),
]);
export type WorkflowWebhookDelivery = typeof workflowWebhookDeliveries.$inferSelect;

// ─── Background Job Run Guards ───────────────────────────────────────────────
// A durable primary key makes periodic jobs idempotent across multiple workers.
export const jobRunGuards = mysqlTable("jobRunGuards", {
  jobKey: varchar("jobKey", { length: 255 }).primaryKey(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Public Photo Upload Sessions ────────────────────────────────────────────
// A short-lived, hashed authorization record for a public booking or intake upload.
// Upload objects are registered separately so only objects created by that session
// can be attached to the resulting business record.
export const publicPhotoUploadSessions = mysqlTable("publicPhotoUploadSessions", {
  id: int("id").autoincrement().primaryKey(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  userId: int("userId").notNull(),
  purpose: mysqlEnum("purpose", ["booking", "intake"]).notNull(),
  referenceId: int("referenceId"),
  maxUploads: int("maxUploads").notNull().default(5),
  uploadCount: int("uploadCount").notNull().default(0),
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("publicPhotoUploadSessions_userId_idx").on(t.userId),
  index("publicPhotoUploadSessions_expiresAt_idx").on(t.expiresAt),
]);
export type PublicPhotoUploadSession = typeof publicPhotoUploadSessions.$inferSelect;

export const publicPhotoUploads = mysqlTable("publicPhotoUploads", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  photoKey: varchar("photoKey", { length: 512 }).notNull().unique(),
  photoUrl: text("photoUrl").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("publicPhotoUploads_sessionId_idx").on(t.sessionId),
]);
export type PublicPhotoUpload = typeof publicPhotoUploads.$inferSelect;
