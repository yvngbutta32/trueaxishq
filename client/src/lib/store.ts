/* SkillBridge AI — Global App Store
 * Provides shared state for clients, invoices, bookings, follow-ups across all dashboard pages.
 * Uses React context + localStorage persistence so data survives page refreshes.
 */

export type ClientStatus = "active" | "inactive" | "lead";
export type InvoiceStatus = "paid" | "pending" | "overdue" | "draft";
export type FollowUpStatus = "sent" | "pending" | "replied";

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  service: string;
  status: ClientStatus;
  totalRevenue: number;
  lastContact: string;
  avatar: string;
  notes: string;
  joinedDate: string;
}

export interface Invoice {
  id: string;
  clientId: string;
  clientName: string;
  service: string;
  amount: number;
  status: InvoiceStatus;
  dueDate: string;
  issuedDate: string;
  description: string;
}

export interface Booking {
  id: string;
  clientId: string;
  client: string;
  service: string;
  date: string;
  time: string;
  duration: string;
  status: "confirmed" | "pending" | "cancelled";
  notes: string;
}

export interface FollowUp {
  id: string;
  clientId: string;
  clientName: string;
  type: "email" | "sms";
  message: string;
  status: FollowUpStatus;
  scheduledAt: string;
  sentAt?: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: "booking" | "invoice" | "followup" | "ai";
  read: boolean;
  createdAt: string;
}

// ─── Default seed data ────────────────────────────────────────────────────────
export const defaultClients: Client[] = [
  { id: "c1", name: "Alex Thompson", email: "alex@example.com", phone: "+1 (555) 234-5678", service: "Business Coaching", status: "active", totalRevenue: 2800, lastContact: "2 hours ago", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60&h=60&fit=crop", notes: "Interested in scaling to $500K/year. Has a team of 3.", joinedDate: "Jan 2026" },
  { id: "c2", name: "Maria Garcia", email: "maria@example.com", phone: "+1 (555) 345-6789", service: "Brand Consulting", status: "active", totalRevenue: 3640, lastContact: "4 hours ago", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop", notes: "Rebranding a healthcare startup. Needs logo + messaging.", joinedDate: "Feb 2026" },
  { id: "c3", name: "James Kim", email: "james@example.com", phone: "+1 (555) 456-7890", service: "SEO Strategy", status: "active", totalRevenue: 1680, lastContact: "Yesterday", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop", notes: "E-commerce store in the fitness niche. 10K monthly visitors.", joinedDate: "Jan 2026" },
  { id: "c4", name: "Priya Sharma", email: "priya@example.com", phone: "+1 (555) 567-8901", service: "Life Coaching", status: "active", totalRevenue: 2520, lastContact: "2 days ago", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&h=60&fit=crop", notes: "Career transition from finance to entrepreneurship.", joinedDate: "Dec 2025" },
  { id: "c5", name: "David Park", email: "david@example.com", phone: "+1 (555) 678-9012", service: "Consulting", status: "lead", totalRevenue: 0, lastContact: "5 days ago", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=60&h=60&fit=crop", notes: "Referred by Alex Thompson. Interested in 3-month package.", joinedDate: "Mar 2026" },
  { id: "c6", name: "Sarah Lee", email: "sarah@example.com", phone: "+1 (555) 789-0123", service: "Strategy Session", status: "active", totalRevenue: 1400, lastContact: "Today", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&h=60&fit=crop", notes: "Monthly strategy retainer. Very responsive.", joinedDate: "Nov 2025" },
  { id: "c7", name: "Tom Rivera", email: "tom@example.com", phone: "+1 (555) 890-1234", service: "Brand Review", status: "lead", totalRevenue: 0, lastContact: "1 week ago", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=60&h=60&fit=crop", notes: "Small restaurant chain looking for brand refresh.", joinedDate: "Mar 2026" },
  { id: "c8", name: "Emma Wilson", email: "emma@example.com", phone: "+1 (555) 901-2345", service: "Coaching Call", status: "inactive", totalRevenue: 840, lastContact: "2 weeks ago", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=60&h=60&fit=crop", notes: "Paused sessions. May return in Q2.", joinedDate: "Oct 2025" },
];

export const defaultInvoices: Invoice[] = [
  { id: "inv-001", clientId: "c1", clientName: "Alex Thompson", service: "Business Coaching — March", amount: 350, status: "paid", dueDate: "Mar 1, 2026", issuedDate: "Feb 25, 2026", description: "4 x 60-min coaching sessions" },
  { id: "inv-002", clientId: "c2", clientName: "Maria Garcia", service: "Brand Consulting — March", amount: 520, status: "pending", dueDate: "Mar 10, 2026", issuedDate: "Mar 1, 2026", description: "Brand strategy + logo concepts" },
  { id: "inv-003", clientId: "c3", clientName: "James Kim", service: "SEO Strategy Package", amount: 280, status: "paid", dueDate: "Feb 28, 2026", issuedDate: "Feb 20, 2026", description: "Monthly SEO audit + keyword research" },
  { id: "inv-004", clientId: "c4", clientName: "Priya Sharma", service: "Life Coaching — February", amount: 420, status: "overdue", dueDate: "Feb 15, 2026", issuedDate: "Feb 1, 2026", description: "4 x 60-min coaching sessions" },
  { id: "inv-005", clientId: "c6", clientName: "Sarah Lee", service: "Strategy Session — March", amount: 350, status: "paid", dueDate: "Mar 5, 2026", issuedDate: "Mar 1, 2026", description: "Monthly strategy retainer" },
  { id: "inv-006", clientId: "c1", clientName: "Alex Thompson", service: "Business Coaching — February", amount: 350, status: "paid", dueDate: "Feb 1, 2026", issuedDate: "Jan 25, 2026", description: "4 x 60-min coaching sessions" },
  { id: "inv-007", clientId: "c8", clientName: "Emma Wilson", service: "Coaching Package", amount: 840, status: "paid", dueDate: "Jan 15, 2026", issuedDate: "Jan 5, 2026", description: "8-week coaching program" },
];

export const defaultBookings: Booking[] = [
  { id: "b1", clientId: "c6", client: "Sarah Lee", service: "Strategy Session", date: "Today", time: "2:00 PM", duration: "60 min", status: "confirmed", notes: "Discuss Q2 goals" },
  { id: "b2", clientId: "c7", client: "Tom Rivera", service: "Brand Review", date: "Today", time: "4:30 PM", duration: "45 min", status: "confirmed", notes: "Initial discovery call" },
  { id: "b3", clientId: "c8", client: "Emma Wilson", service: "Coaching Call", date: "Tomorrow", time: "10:00 AM", duration: "60 min", status: "pending", notes: "Check-in after pause" },
  { id: "b4", clientId: "c5", client: "David Park", service: "Consulting", date: "Tomorrow", time: "2:00 PM", duration: "90 min", status: "confirmed", notes: "Package proposal" },
  { id: "b5", clientId: "c1", client: "Alex Thompson", service: "Business Coaching", date: "Mar 8", time: "11:00 AM", duration: "60 min", status: "confirmed", notes: "Monthly review" },
  { id: "b6", clientId: "c2", client: "Maria Garcia", service: "Brand Consulting", date: "Mar 9", time: "3:00 PM", duration: "60 min", status: "confirmed", notes: "Logo presentation" },
];

export const defaultFollowUps: FollowUp[] = [
  { id: "f1", clientId: "c5", clientName: "David Park", type: "email", message: "Hi David! Just following up on our conversation last week. I'd love to schedule a discovery call to discuss how I can help you reach your goals. Are you available this week?", status: "pending", scheduledAt: "Mar 6, 2026 9:00 AM" },
  { id: "f2", clientId: "c7", clientName: "Tom Rivera", type: "email", message: "Hi Tom! I noticed we haven't connected in a while. I have some exciting new brand strategy frameworks that would be perfect for your restaurant chain. Want to hop on a quick call?", status: "pending", scheduledAt: "Mar 6, 2026 10:00 AM" },
  { id: "f3", clientId: "c8", clientName: "Emma Wilson", type: "email", message: "Hi Emma! Hope you're doing well. Just wanted to check in and see how things are going since we last spoke. I'm here whenever you're ready to continue.", status: "pending", scheduledAt: "Mar 6, 2026 11:00 AM" },
  { id: "f4", clientId: "c4", clientName: "Priya Sharma", type: "email", message: "Hi Priya! Your invoice #inv-004 for $420 was due on Feb 15. Could you please arrange payment at your earliest convenience? Let me know if you have any questions.", status: "sent", scheduledAt: "Mar 1, 2026 9:00 AM", sentAt: "Mar 1, 2026 9:00 AM" },
  { id: "f5", clientId: "c3", clientName: "James Kim", type: "email", message: "Hi James! Your March SEO report is ready. We've seen a 23% increase in organic traffic this month. Let's schedule a call to review the results!", status: "replied", scheduledAt: "Mar 3, 2026 2:00 PM", sentAt: "Mar 3, 2026 2:00 PM" },
];

export const defaultNotifications: Notification[] = [
  { id: "n1", title: "New booking confirmed", body: "Sarah Lee booked a Strategy Session for Today at 2:00 PM", type: "booking", read: false, createdAt: "1 hour ago" },
  { id: "n2", title: "Invoice paid", body: "Alex Thompson paid Invoice #inv-001 for $350", type: "invoice", read: false, createdAt: "2 hours ago" },
  { id: "n3", title: "AI Follow-up sent", body: "Automated follow-up sent to 3 inactive leads", type: "ai", read: false, createdAt: "3 hours ago" },
  { id: "n4", title: "Overdue invoice", body: "Priya Sharma's invoice #inv-004 is 19 days overdue", type: "invoice", read: true, createdAt: "Yesterday" },
  { id: "n5", title: "New lead inquiry", body: "Tom Rivera submitted an intake form for Brand Review", type: "booking", read: true, createdAt: "Yesterday" },
];
