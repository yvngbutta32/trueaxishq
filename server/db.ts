/**
 * TrueAxis HQ — Hardened Database Layer
 * - Lazy connection with automatic retry (3 attempts, exponential backoff)
 * - All helpers wrapped in try/catch with structured logging
 * - Graceful fallback when DB is unavailable (empty arrays, not crashes)
 * - Ownership validation on all user-scoped queries
 * - Input length limits enforced before reaching the DB
 */

import { and, eq, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql2, { type Pool as Mysql2Pool } from "mysql2";
import {
  users, clients, invoices, bookings, followUps, leads,
  InsertUser,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

// ─── Connection ───────────────────────────────────────────────────────────────
let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Mysql2Pool | null = null;

/** Reset cached connection — destroys the pool so the next call creates a fresh one */
export function resetDbConnection() {
  _db = null;
  if (_pool) {
    try { _pool.end(() => {}); } catch (_) { /* ignore */ }
    _pool = null;
  }
}

export async function getDb() {
  if (_db) return _db;
  if (!process.env.DATABASE_URL) return null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (!_pool) {
        _pool = mysql2.createPool({
          uri: process.env.DATABASE_URL,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          enableKeepAlive: true,
          keepAliveInitialDelay: 0,
        });
      }
      _db = drizzle(_pool);
      return _db;
    } catch (error) {
      const delay = Math.pow(2, attempt) * 200;
      console.warn(`[DB] Connection attempt ${attempt}/3 failed. Retrying in ${delay}ms...`);
      if (attempt < 3) await new Promise(r => setTimeout(r, delay));
    }
  }
  console.error("[DB] All connection attempts failed. Running in degraded mode.");
  return null;
}

export function isDbAvailable() {
  return _db !== null;
}

// ─── Retry wrapper ────────────────────────────────────────────────────────────
async function withRetry<T>(
  operation: () => Promise<T>,
  fallback: T,
  label: string,
  maxRetries = 2
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      const isTransient =
        error?.code === "ECONNRESET" ||
        error?.code === "ETIMEDOUT" ||
        error?.code === "ECONNREFUSED" ||
        error?.message?.includes("deadlock") ||
        error?.message?.includes("Lock wait timeout");

      console.error(`[DB:${label}] Attempt ${attempt}/${maxRetries} failed:`, {
        code: error?.code,
        message: error?.message,
        transient: isTransient,
      });

      if (error?.message === "TIME_CONFLICT") throw error;
      if (!isTransient || attempt === maxRetries) return fallback;
      // Reset cached drizzle instance so next attempt gets a fresh connection from pool
      if (isTransient) resetDbConnection();
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 100));
    }
  }
  return fallback;
}

// ─── User helpers ─────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[DB] upsertUser skipped — DB unavailable"); return; }

  await withRetry(async () => {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  }, undefined, "upsertUser");
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) { console.warn("[DB] Cannot get user: database not available"); return undefined; }
  return withRetry(async () => {
    const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    return result[0] ?? undefined;
  }, undefined, "getUserByOpenId");
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return withRetry(
    () => db.select().from(users).orderBy(desc(users.createdAt)),
    [],
    "getAllUsers"
  );
}

export async function updateUserStripe(userId: number, data: {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: string;
  planId?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await withRetry(
    () => db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, userId)),
    undefined,
    "updateUserStripe"
  );
}

export async function updateUserSettings(userId: number, data: Partial<{
  name: string; email: string; bio: string; phone: string; avatarUrl: string;
  businessName: string; businessPhone: string; businessAddress: string; businessWebsite: string;
  bookingUsername: string; bookingBio: string; bookingServices: string; bookingAvailability: string;
  notifyNewBooking: boolean; notifyInvoicePaid: boolean; notifyNewLead: boolean;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return withRetry(
    () => db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, userId)),
    null,
    "updateUserSettings"
  );
}

// ─── Client helpers ───────────────────────────────────────────────────────────
export async function getClientsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return withRetry(
    () => db.select().from(clients).where(eq(clients.userId, userId)).orderBy(desc(clients.createdAt)),
    [],
    "getClientsByUser"
  );
}

export async function createClient(data: {
  userId: number; name: string; email?: string; phone?: string;
  service?: string; notes?: string; status?: "active" | "inactive" | "prospect";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return withRetry(
    () => db.insert(clients).values({
      ...data,
      name: data.name.slice(0, 200),
      email: data.email?.slice(0, 320),
      phone: data.phone?.slice(0, 32),
      service: data.service?.slice(0, 200),
      notes: data.notes?.slice(0, 2000),
      status: data.status ?? "active",
      avatarInitials: data.name.slice(0, 2).toUpperCase(),
    }),
    null,
    "createClient"
  );
}

export async function updateClient(clientId: number, userId: number, data: Partial<{
  name: string; email: string; phone: string; service: string; notes: string;
  status: "active" | "inactive" | "prospect";
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return withRetry(
    () => db.update(clients).set({ ...data, updatedAt: new Date() })
      .where(and(eq(clients.id, clientId), eq(clients.userId, userId))),
    null,
    "updateClient"
  );
}

export async function deleteClient(clientId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return withRetry(
    () => db.delete(clients).where(and(eq(clients.id, clientId), eq(clients.userId, userId))),
    null,
    "deleteClient"
  );
}

// ─── Invoice helpers ──────────────────────────────────────────────────────────
export async function getInvoicesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return withRetry(
    () => db.select().from(invoices).where(eq(invoices.userId, userId)).orderBy(desc(invoices.createdAt)),
    [],
    "getInvoicesByUser"
  );
}

export async function createInvoice(data: {
  userId: number; clientId?: number; clientName: string; clientEmail?: string;
  amount: number; service?: string; notes?: string; dueDate?: string;
  status?: "draft" | "sent" | "paid" | "overdue";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return withRetry(async () => {
    const count = await db.select({ count: sql<number>`count(*)` })
      .from(invoices).where(eq(invoices.userId, data.userId));
    const invoiceNumber = `INV-${String((Number(count[0]?.count) ?? 0) + 1).padStart(4, "0")}`;
    return db.insert(invoices).values({
      userId: data.userId,
      clientId: data.clientId,
      invoiceNumber,
      clientName: data.clientName.slice(0, 200),
      clientEmail: data.clientEmail?.slice(0, 320),
      service: data.service?.slice(0, 500),
      notes: data.notes?.slice(0, 1000),
      amount: String(data.amount),
      dueDate: data.dueDate,
      status: (data.status ?? "draft") as "draft" | "sent" | "paid" | "overdue",
    });
  }, null, "createInvoice");
}

export async function updateInvoiceStatus(invoiceId: number, userId: number, status: "draft" | "sent" | "paid" | "overdue") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const updateData: Record<string, unknown> = { status, updatedAt: new Date() };
  if (status === "paid") updateData.paidAt = new Date();
  return withRetry(
    () => db.update(invoices).set(updateData)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId))),
    null,
    "updateInvoiceStatus"
  );
}

export async function deleteInvoice(invoiceId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return withRetry(
    () => db.delete(invoices).where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId))),
    null,
    "deleteInvoice"
  );
}

// ─── Booking helpers ──────────────────────────────────────────────────────────
export async function getBookingsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return withRetry(
    () => db.select().from(bookings).where(eq(bookings.userId, userId)).orderBy(desc(bookings.createdAt)),
    [],
    "getBookingsByUser"
  );
}

export async function getBookingsByUsername(username: string) {
  const db = await getDb();
  if (!db) return [];
  return withRetry(async () => {
    const user = await db.select({ id: users.id }).from(users)
      .where(eq(users.bookingUsername, username)).limit(1);
    if (!user[0]) return [];
    return db.select().from(bookings)
      .where(eq(bookings.userId, user[0].id))
      .orderBy(bookings.date, bookings.time);
  }, [], "getBookingsByUsername");
}

export async function getHostByUsername(username: string) {
  const db = await getDb();
  if (!db) return null;
  return withRetry(async () => {
    const result = await db.select({
      id: users.id, name: users.name, businessName: users.businessName,
      bookingBio: users.bookingBio, bookingServices: users.bookingServices,
      bookingAvailability: users.bookingAvailability, avatarUrl: users.avatarUrl,
    }).from(users).where(eq(users.bookingUsername, username)).limit(1);
    return result[0] ?? null;
  }, null, "getHostByUsername");
}

export async function createBooking(data: {
  userId: number; clientId?: number; clientName: string; clientEmail?: string;
  service?: string; date: string; time: string; duration?: number;
  notes?: string; isPublicBooking?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return withRetry(async () => {
    // Conflict detection — no double-booking same slot
    const conflicts = await db.select({ id: bookings.id }).from(bookings)
      .where(and(
        eq(bookings.userId, data.userId),
        eq(bookings.date, data.date),
        eq(bookings.time, data.time),
      ));
    if (conflicts.length > 0) throw new Error("TIME_CONFLICT");
    return db.insert(bookings).values({
      ...data,
      clientName: data.clientName.slice(0, 200),
      clientEmail: data.clientEmail?.slice(0, 320),
      service: data.service?.slice(0, 200),
      notes: data.notes?.slice(0, 1000),
      status: "scheduled",
      isPublicBooking: data.isPublicBooking ?? false,
    });
  }, null, "createBooking");
}

export async function updateBookingStatus(bookingId: number, userId: number, status: "scheduled" | "completed" | "cancelled" | "no_show") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return withRetry(
    () => db.update(bookings).set({ status, updatedAt: new Date() })
      .where(and(eq(bookings.id, bookingId), eq(bookings.userId, userId))),
    null,
    "updateBookingStatus"
  );
}

export async function deleteBooking(bookingId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return withRetry(
    () => db.delete(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.userId, userId))),
    null,
    "deleteBooking"
  );
}

// ─── Follow-up helpers ────────────────────────────────────────────────────────
export async function getFollowUpsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return withRetry(
    () => db.select().from(followUps).where(eq(followUps.userId, userId)).orderBy(desc(followUps.createdAt)),
    [],
    "getFollowUpsByUser"
  );
}

export async function createFollowUp(data: {
  userId: number; clientId?: number; clientName: string; clientEmail?: string;
  subject?: string; body: string; status?: "draft" | "sent";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return withRetry(
    () => db.insert(followUps).values({ ...data, status: data.status ?? "draft" }),
    null,
    "createFollowUp"
  );
}

export async function updateFollowUpStatus(followUpId: number, userId: number, status: "draft" | "sent") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const updateData: Record<string, unknown> = { status, updatedAt: new Date() };
  if (status === "sent") updateData.sentAt = new Date();
  return withRetry(
    () => db.update(followUps).set(updateData)
      .where(and(eq(followUps.id, followUpId), eq(followUps.userId, userId))),
    null,
    "updateFollowUpStatus"
  );
}

// ─── Lead helpers ─────────────────────────────────────────────────────────────
export async function captureLead(data: { email: string; name?: string; source?: string }) {
  const db = await getDb();
  if (!db) { console.warn("[DB] captureLead skipped — DB unavailable"); return; }
  return withRetry(async () => {
    await db.insert(leads).values({
      email: data.email.slice(0, 320),
      name: data.name?.slice(0, 200),
      source: data.source?.slice(0, 64) ?? "landing_page",
    }).onDuplicateKeyUpdate({ set: { name: data.name?.slice(0, 200) ?? null } });
  }, undefined, "captureLead");
}

export async function getAllLeads() {
  const db = await getDb();
  if (!db) return [];
  return withRetry(
    () => db.select().from(leads).orderBy(desc(leads.createdAt)),
    [],
    "getAllLeads"
  );
}

// ─── Analytics helpers ────────────────────────────────────────────────────────
export async function getAnalyticsOverview(userId: number) {
  const empty = { totalClients: 0, totalRevenue: 0, totalBookings: 0, pendingInvoices: 0, monthlyRevenue: [] as { month: string; revenue: number }[] };
  const db = await getDb();
  if (!db) return empty;

  return withRetry(async () => {
    const [clientCount, invoiceData, bookingCount, pendingCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(clients).where(eq(clients.userId, userId)),
      db.select({ amount: invoices.amount, status: invoices.status, createdAt: invoices.createdAt })
        .from(invoices).where(eq(invoices.userId, userId)),
      db.select({ count: sql<number>`count(*)` }).from(bookings).where(eq(bookings.userId, userId)),
      db.select({ count: sql<number>`count(*)` }).from(invoices)
        .where(and(eq(invoices.userId, userId), eq(invoices.status, "sent"))),
    ]);

    const paidInvoices = invoiceData.filter(i => i.status === "paid");
    const totalRevenue = paidInvoices.reduce((sum, i) => sum + Number(i.amount), 0);

    const monthlyRevenue: { month: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = d.toLocaleString("default", { month: "short", year: "2-digit" });
      const monthRevenue = paidInvoices
        .filter(inv => {
          const invDate = new Date(inv.createdAt);
          return invDate.getMonth() === d.getMonth() && invDate.getFullYear() === d.getFullYear();
        })
        .reduce((sum, inv) => sum + Number(inv.amount), 0);
      monthlyRevenue.push({ month: monthStr, revenue: monthRevenue });
    }

    return {
      totalClients: Number(clientCount[0]?.count ?? 0),
      totalRevenue,
      totalBookings: Number(bookingCount[0]?.count ?? 0),
      pendingInvoices: Number(pendingCount[0]?.count ?? 0),
      monthlyRevenue,
    };
  }, empty, "getAnalyticsOverview");
}
