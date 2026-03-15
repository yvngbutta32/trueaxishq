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
  siteName: varchar("siteName", { length: 255 }).default("SkillBridge AI").notNull(),
  siteTagline: varchar("siteTagline", { length: 512 }).default("The AI-powered business platform for freelancers & coaches"),
  supportEmail: varchar("supportEmail", { length: 320 }).default("support@skillbridge.ai"),
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
