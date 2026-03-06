/* SkillBridge AI — App Context
 * Global state provider for clients, invoices, bookings, follow-ups, and notifications.
 * Persists to localStorage so data survives page refreshes.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  Client, Invoice, Booking, FollowUp, Notification,
  defaultClients, defaultInvoices, defaultBookings, defaultFollowUps, defaultNotifications
} from "@/lib/store";

interface AppContextType {
  // Clients
  clients: Client[];
  addClient: (client: Omit<Client, "id">) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  // Invoices
  invoices: Invoice[];
  addInvoice: (invoice: Omit<Invoice, "id">) => void;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;

  // Bookings
  bookings: Booking[];
  addBooking: (booking: Omit<Booking, "id">) => void;
  updateBooking: (id: string, updates: Partial<Booking>) => void;
  deleteBooking: (id: string) => void;

  // Follow-Ups
  followUps: FollowUp[];
  sendFollowUp: (id: string) => void;
  addFollowUp: (fu: Omit<FollowUp, "id">) => void;

  // Notifications
  notifications: Notification[];
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  unreadCount: number;

  // User profile
  userName: string;
  setUserName: (name: string) => void;
  userEmail: string;
  setUserEmail: (email: string) => void;
  businessName: string;
  setBusinessName: (name: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function generateId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>(() => loadFromStorage("sb_clients", defaultClients));
  const [invoices, setInvoices] = useState<Invoice[]>(() => loadFromStorage("sb_invoices", defaultInvoices));
  const [bookings, setBookings] = useState<Booking[]>(() => loadFromStorage("sb_bookings", defaultBookings));
  const [followUps, setFollowUps] = useState<FollowUp[]>(() => loadFromStorage("sb_followups", defaultFollowUps));
  const [notifications, setNotifications] = useState<Notification[]>(() => loadFromStorage("sb_notifications", defaultNotifications));
  const [userName, setUserNameState] = useState(() => loadFromStorage("sb_userName", "Alex"));
  const [userEmail, setUserEmailState] = useState(() => loadFromStorage("sb_userEmail", "alex@mycoachingbiz.com"));
  const [businessName, setBusinessNameState] = useState(() => loadFromStorage("sb_businessName", "Alex's Coaching Studio"));

  // Persist on change
  useEffect(() => saveToStorage("sb_clients", clients), [clients]);
  useEffect(() => saveToStorage("sb_invoices", invoices), [invoices]);
  useEffect(() => saveToStorage("sb_bookings", bookings), [bookings]);
  useEffect(() => saveToStorage("sb_followups", followUps), [followUps]);
  useEffect(() => saveToStorage("sb_notifications", notifications), [notifications]);
  useEffect(() => saveToStorage("sb_userName", userName), [userName]);
  useEffect(() => saveToStorage("sb_userEmail", userEmail), [userEmail]);
  useEffect(() => saveToStorage("sb_businessName", businessName), [businessName]);

  const setUserName = (name: string) => setUserNameState(name);
  const setUserEmail = (email: string) => setUserEmailState(email);
  const setBusinessName = (name: string) => setBusinessNameState(name);

  // Clients
  const addClient = (client: Omit<Client, "id">) => {
    const newClient = { ...client, id: generateId("c") };
    setClients(prev => [newClient, ...prev]);
    addNotification({ title: "New client added", body: `${client.name} was added as a ${client.status}`, type: "booking" });
  };
  const updateClient = (id: string, updates: Partial<Client>) =>
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  const deleteClient = (id: string) =>
    setClients(prev => prev.filter(c => c.id !== id));

  // Invoices
  const addInvoice = (invoice: Omit<Invoice, "id">) => {
    const newInvoice = { ...invoice, id: generateId("inv") };
    setInvoices(prev => [newInvoice, ...prev]);
    addNotification({ title: "Invoice created", body: `Invoice for ${invoice.clientName} — $${invoice.amount}`, type: "invoice" });
  };
  const updateInvoice = (id: string, updates: Partial<Invoice>) =>
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  const deleteInvoice = (id: string) =>
    setInvoices(prev => prev.filter(i => i.id !== id));

  // Bookings
  const addBooking = (booking: Omit<Booking, "id">) => {
    const newBooking = { ...booking, id: generateId("b") };
    setBookings(prev => [newBooking, ...prev]);
    addNotification({ title: "New booking", body: `${booking.client} booked ${booking.service} for ${booking.date} at ${booking.time}`, type: "booking" });
  };
  const updateBooking = (id: string, updates: Partial<Booking>) =>
    setBookings(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  const deleteBooking = (id: string) =>
    setBookings(prev => prev.filter(b => b.id !== id));

  // Follow-Ups
  const sendFollowUp = (id: string) => {
    setFollowUps(prev => prev.map(f =>
      f.id === id ? { ...f, status: "sent" as const, sentAt: new Date().toLocaleString() } : f
    ));
    addNotification({ title: "Follow-up sent", body: "Automated follow-up email delivered successfully", type: "followup" });
  };
  const addFollowUp = (fu: Omit<FollowUp, "id">) => {
    setFollowUps(prev => [{ ...fu, id: generateId("f") }, ...prev]);
  };

  // Notifications
  const addNotification = (n: Omit<Notification, "id" | "read" | "createdAt">) => {
    setNotifications(prev => [
      { ...n, id: generateId("n"), read: false, createdAt: "Just now" },
      ...prev.slice(0, 19)
    ]);
  };
  const markNotificationRead = (id: string) =>
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  const markAllNotificationsRead = () =>
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <AppContext.Provider value={{
      clients, addClient, updateClient, deleteClient,
      invoices, addInvoice, updateInvoice, deleteInvoice,
      bookings, addBooking, updateBooking, deleteBooking,
      followUps, sendFollowUp, addFollowUp,
      notifications, markNotificationRead, markAllNotificationsRead, unreadCount,
      userName, setUserName, userEmail, setUserEmail, businessName, setBusinessName,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
