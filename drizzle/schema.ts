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
