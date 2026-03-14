/* SkillBridge AI — Full Dashboard
 * Design: "Kinetic Warmth" — Dark sidebar (#1C1C1E), Teal (#00C9A7), Coral (#FF6B6B)
 * All panels are fully functional with real state from AppContext (localStorage-persisted)
 */

import { useState, useMemo, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AIAssistant from "@/components/AIAssistant";
import type { Client, Invoice, Booking, FollowUp } from "@/lib/store";
import {
  LayoutDashboard, Users, Calendar, FileText, Mail,
  BarChart3, Settings, Zap, Bell, Search, Plus,
  TrendingUp, DollarSign, Clock, CheckCircle,
  ArrowUpRight, ChevronRight, LogOut, X, Edit2,
  Trash2, Send, Eye, Download, Phone, MessageSquare,
  AlertCircle, RefreshCw, User, Building, Save,
  ChevronLeft, ChevronDown, Moon, Sun, Bot, CreditCard,
  Shield, ExternalLink
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────
type ActivePanel = "overview" | "clients" | "scheduling" | "invoices" | "followups" | "analytics" | "settings" | "ai";

// ─── Greeting ────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ─── Modal Wrapper ───────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-[#1C1C1E] text-base" style={{ fontFamily: 'Sora, sans-serif' }}>{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
const navItems: { icon: React.ElementType; label: string; panel: ActivePanel }[] = [
  { icon: LayoutDashboard, label: "Dashboard", panel: "overview" },
  { icon: Users, label: "Clients", panel: "clients" },
  { icon: Calendar, label: "Scheduling", panel: "scheduling" },
  { icon: FileText, label: "Invoices", panel: "invoices" },
  { icon: Mail, label: "Follow-Ups", panel: "followups" },
  { icon: BarChart3, label: "Analytics", panel: "analytics" },
  { icon: Settings, label: "Settings", panel: "settings" },
  { icon: Bot, label: "AI Assistant", panel: "ai" },
];

function Sidebar({ active, setActive, collapsed, setCollapsed }: {
  active: ActivePanel; setActive: (p: ActivePanel) => void;
  collapsed: boolean; setCollapsed: (v: boolean) => void;
}) {
  const [, navigate] = useLocation();
  const { unreadCount } = useApp();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  return (
    <aside className={`fixed left-0 top-0 h-full bg-[#1C1C1E] flex flex-col transition-all duration-300 z-40 ${collapsed ? "w-16" : "w-60"}`}>
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg gradient-teal flex items-center justify-center flex-shrink-0 cursor-pointer" onClick={() => setCollapsed(!collapsed)}>
          <Zap className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="font-bold text-white text-sm" style={{ fontFamily: 'Sora, sans-serif' }}>
            SkillBridge <span className="text-[#00C9A7]">AI</span>
          </span>
        )}
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.panel}
            onClick={() => setActive(item.panel)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative ${
              active === item.panel
                ? "bg-[#00C9A7]/15 text-[#00C9A7]"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
            {!collapsed && item.panel === "followups" && unreadCount > 0 && (
              <span className="ml-auto bg-[#FF6B6B] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {unreadCount}
              </span>
            )}
            {!collapsed && active === item.panel && item.panel !== "followups" && (
              <ChevronRight className="w-3 h-3 ml-auto" />
            )}
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-white/10 space-y-2">
        {!collapsed && (
          <div className="bg-[#00C9A7]/10 border border-[#00C9A7]/20 rounded-xl p-3">
            <p className="text-xs font-semibold text-[#00C9A7] mb-1">Pro Trial</p>
            <p className="text-xs text-gray-400">11 days remaining</p>
            <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-[#00C9A7] rounded-full" style={{ width: "79%" }} />
            </div>
          </div>
        )}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 flex-shrink-0" /> : <Moon className="w-4 h-4 flex-shrink-0" />}
          {!collapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
        <button
          onClick={() => navigate("/billing")}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all"
          aria-label="Go to billing"
        >
          <CreditCard className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Billing</span>}
        </button>
        <button
          onClick={() => navigate("/")}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all"
          aria-label="Back to website"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Back to Site</span>}
        </button>
      </div>
    </aside>
  );
}

// ─── Notifications Panel ──────────────────────────────────────────────────────
function NotificationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useApp();
  if (!open) return null;
  const iconMap = { booking: Calendar, invoice: FileText, followup: Mail, ai: Zap };
  const colorMap = { booking: "#00C9A7", invoice: "#FF6B6B", followup: "#6366F1", ai: "#F59E0B" };

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <h3 className="font-bold text-sm text-[#1C1C1E]">Notifications</h3>
        <button onClick={markAllNotificationsRead} className="text-xs text-[#00C9A7] hover:underline">Mark all read</button>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No notifications</p>
        ) : notifications.map((n) => {
          const Icon = iconMap[n.type];
          const color = colorMap[n.type];
          return (
            <div
              key={n.id}
              onClick={() => markNotificationRead(n.id)}
              className={`flex items-start gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors ${!n.read ? "bg-[#00C9A7]/5" : ""}`}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}20` }}>
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${!n.read ? "text-[#1C1C1E]" : "text-gray-600"}`}>{n.title}</p>
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>
                <p className="text-xs text-gray-300 mt-1">{n.createdAt}</p>
              </div>
              {!n.read && <div className="w-2 h-2 rounded-full bg-[#00C9A7] flex-shrink-0 mt-1" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Overview Panel ───────────────────────────────────────────────────────────
const revenueData = [
  { month: "Sep", revenue: 3200 }, { month: "Oct", revenue: 4100 },
  { month: "Nov", revenue: 3800 }, { month: "Dec", revenue: 5200 },
  { month: "Jan", revenue: 4900 }, { month: "Feb", revenue: 6800 },
  { month: "Mar", revenue: 8420 },
];
const bookingsChartData = [
  { day: "Mon", bookings: 4 }, { day: "Tue", bookings: 7 },
  { day: "Wed", bookings: 5 }, { day: "Thu", bookings: 9 },
  { day: "Fri", bookings: 6 }, { day: "Sat", bookings: 2 }, { day: "Sun", bookings: 1 },
];

function StatCard({ title, value, change, icon: Icon, color }: {
  title: string; value: string; change: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 card-lift">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: color }}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center gap-1">
          <ArrowUpRight className="w-3 h-3" />{change}
        </span>
      </div>
      <p className="text-2xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: 'Sora, sans-serif' }}>{value}</p>
      <p className="text-sm text-gray-500 mt-1">{title}</p>
    </div>
  );
}

function OverviewPanel({ setActive }: { setActive: (p: ActivePanel) => void }) {
  const { clients, invoices, bookings, followUps, sendFollowUp, userName } = useApp();
  const activeClients = clients.filter(c => c.status === "active").length;
  const thisMonthRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const pendingFollowUps = followUps.filter(f => f.status === "pending");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: 'Sora, sans-serif' }}>
            {getGreeting()}, {userName} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">Here's what's happening with your business today.</p>
        </div>
        <Badge className="bg-[#00C9A7]/10 text-[#00C9A7] border border-[#00C9A7]/20 text-xs px-3 py-1">
          Pro Trial — 11 days left
        </Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Revenue This Month" value={`$${thisMonthRevenue.toLocaleString()}`} change="+23%" icon={DollarSign} color="#00C9A7" />
        <StatCard title="Active Clients" value={String(activeClients)} change="+8%" icon={Users} color="#FF6B6B" />
        <StatCard title="Bookings This Week" value={String(bookings.length)} change="+15%" icon={Calendar} color="#00C9A7" />
        <StatCard title="Hours Saved" value="14 hrs" change="+5%" icon={Clock} color="#FF6B6B" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-[#1C1C1E] text-sm" style={{ fontFamily: 'Sora, sans-serif' }}>Revenue Trend</h3>
              <p className="text-xs text-gray-400 mt-0.5">Last 7 months</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
              <TrendingUp className="w-3 h-3" />+163% YTD
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00C9A7" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#00C9A7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '12px' }} formatter={(v: number) => [`$${v.toLocaleString()}`, 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke="#00C9A7" strokeWidth={2.5} fill="url(#tealGrad)" dot={{ fill: '#00C9A7', strokeWidth: 0, r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="mb-5">
            <h3 className="font-bold text-[#1C1C1E] text-sm" style={{ fontFamily: 'Sora, sans-serif' }}>Bookings This Week</h3>
            <p className="text-xs text-gray-400 mt-0.5">{bookings.length} total</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={bookingsChartData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '12px' }} />
              <Bar dataKey="bookings" fill="#FF6B6B" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#1C1C1E] text-sm" style={{ fontFamily: 'Sora, sans-serif' }}>Recent Clients</h3>
            <button className="text-xs text-[#00C9A7] font-medium hover:underline" onClick={() => setActive("clients")}>View all</button>
          </div>
          <div className="space-y-2">
            {clients.slice(0, 4).map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setActive("clients")}>
                <img src={c.avatar} alt={c.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1C1C1E] truncate">{c.name}</p>
                  <p className="text-xs text-gray-400 truncate">{c.service}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  c.status === 'active' ? 'bg-green-50 text-green-600' :
                  c.status === 'lead' ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-100 text-gray-500'
                }`}>{c.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#1C1C1E] text-sm" style={{ fontFamily: 'Sora, sans-serif' }}>Upcoming Bookings</h3>
            <button className="text-xs text-[#00C9A7] font-medium hover:underline" onClick={() => setActive("scheduling")}>View calendar</button>
          </div>
          <div className="space-y-2">
            {bookings.slice(0, 4).map((b) => (
              <div key={b.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setActive("scheduling")}>
                <div className="w-9 h-9 rounded-xl bg-[#00C9A7]/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 text-[#00C9A7]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1C1C1E] truncate">{b.client}</p>
                  <p className="text-xs text-gray-400 truncate">{b.service}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-medium text-[#1C1C1E]">{b.date}</p>
                  <p className="text-xs text-gray-400">{b.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {pendingFollowUps.length > 0 && (
        <div className="bg-gradient-to-r from-[#1C1C1E] to-[#1A2E2A] rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#00C9A7]/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-[#00C9A7]" />
            </div>
            <div>
              <p className="text-sm font-bold text-white" style={{ fontFamily: 'Sora, sans-serif' }}>
                AI Insight: {pendingFollowUps.length} leads haven't heard from you recently
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Send automated follow-ups to recover potential revenue.</p>
            </div>
          </div>
          <Button size="sm" className="gradient-teal text-white border-0 hover:opacity-90 flex-shrink-0"
            onClick={() => { pendingFollowUps.forEach(f => sendFollowUp(f.id)); toast.success(`${pendingFollowUps.length} follow-up emails sent!`); setActive("followups"); }}>
            <Send className="w-3.5 h-3.5 mr-1.5" />Send All
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Clients Panel ────────────────────────────────────────────────────────────
function ClientsPanel() {
  const { clients, addClient, updateClient, deleteClient } = useApp();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "lead" | "inactive">("all");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", service: "", status: "lead" as Client["status"], notes: "" });

  const filtered = useMemo(() =>
    clients.filter(c =>
      (filter === "all" || c.status === filter) &&
      (c.name.toLowerCase().includes(search.toLowerCase()) ||
       c.email.toLowerCase().includes(search.toLowerCase()) ||
       c.service.toLowerCase().includes(search.toLowerCase()))
    ), [clients, search, filter]);

  const handleAdd = () => {
    if (!form.name || !form.email) { toast.error("Name and email are required"); return; }
    addClient({ ...form, totalRevenue: 0, lastContact: "Just now", avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(form.name)}&background=00C9A7&color=fff&size=60`, joinedDate: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) });
    setForm({ name: "", email: "", phone: "", service: "", status: "lead", notes: "" });
    setShowAdd(false);
    toast.success(`${form.name} added successfully!`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: 'Sora, sans-serif' }}>Clients</h2>
          <p className="text-sm text-gray-500">{clients.length} total · {clients.filter(c => c.status === "active").length} active</p>
        </div>
        <Button size="sm" className="gradient-teal text-white border-0 hover:opacity-90 gap-1.5" onClick={() => setShowAdd(true)}>
          <Plus className="w-3.5 h-3.5" />Add Client
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..." className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors" />
        </div>
        <div className="flex gap-2">
          {(["all", "active", "lead", "inactive"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-2 text-xs font-medium rounded-xl transition-colors capitalize ${filter === f ? "bg-[#00C9A7] text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-[#00C9A7]"}`}>{f}</button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No clients found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(c => (
              <div key={c.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
                <img src={c.avatar} alt={c.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#1C1C1E]">{c.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      c.status === 'active' ? 'bg-green-50 text-green-600' :
                      c.status === 'lead' ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-100 text-gray-500'
                    }`}>{c.status}</span>
                  </div>
                  <p className="text-xs text-gray-400">{c.email} · {c.service}</p>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-[#1C1C1E]">${c.totalRevenue.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">{c.lastContact}</p>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => setSelectedClient(c)} className="p-2 rounded-lg hover:bg-[#00C9A7]/10 text-gray-400 hover:text-[#00C9A7] transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { if (confirm(`Delete ${c.name}?`)) { deleteClient(c.id); toast.success("Client deleted"); }}} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Client Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add New Client">
        <div className="space-y-4">
          {[
            { label: "Full Name *", key: "name", placeholder: "Jane Smith" },
            { label: "Email *", key: "email", placeholder: "jane@example.com" },
            { label: "Phone", key: "phone", placeholder: "+1 (555) 000-0000" },
            { label: "Service", key: "service", placeholder: "Business Coaching" },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">{f.label}</label>
              <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as Client["status"] }))} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors">
              <option value="lead">Lead</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any relevant notes..." rows={3} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="flex-1 gradient-teal text-white border-0 hover:opacity-90" onClick={handleAdd}>Add Client</Button>
          </div>
        </div>
      </Modal>

      {/* Client Detail Modal */}
      <Modal open={!!selectedClient} onClose={() => setSelectedClient(null)} title="Client Profile" wide>
        {selectedClient && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <img src={selectedClient.avatar} alt={selectedClient.name} className="w-16 h-16 rounded-2xl object-cover" />
              <div>
                <h3 className="text-lg font-bold text-[#1C1C1E]">{selectedClient.name}</h3>
                <p className="text-sm text-gray-500">{selectedClient.service}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${
                  selectedClient.status === 'active' ? 'bg-green-50 text-green-600' :
                  selectedClient.status === 'lead' ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-100 text-gray-500'
                }`}>{selectedClient.status}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Mail, label: "Email", value: selectedClient.email },
                { icon: Phone, label: "Phone", value: selectedClient.phone || "Not provided" },
                { icon: DollarSign, label: "Total Revenue", value: `$${selectedClient.totalRevenue.toLocaleString()}` },
                { icon: Clock, label: "Last Contact", value: selectedClient.lastContact },
                { icon: Calendar, label: "Joined", value: selectedClient.joinedDate },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-3.5 h-3.5 text-gray-400" />
                    <p className="text-xs text-gray-400">{label}</p>
                  </div>
                  <p className="text-sm font-semibold text-[#1C1C1E]">{value}</p>
                </div>
              ))}
            </div>
            {selectedClient.notes && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-700">{selectedClient.notes}</p>
              </div>
            )}
            <div className="flex gap-3">
              <Button className="flex-1 gradient-teal text-white border-0 hover:opacity-90 gap-2" onClick={() => { toast.success(`Email drafted for ${selectedClient.name}`); setSelectedClient(null); }}>
                <Mail className="w-4 h-4" />Send Email
              </Button>
              <Button variant="outline" className="flex-1 gap-2" onClick={() => { updateClient(selectedClient.id, { status: "active" }); toast.success("Status updated to active"); setSelectedClient(null); }}>
                <Edit2 className="w-4 h-4" />Mark Active
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Scheduling Panel ─────────────────────────────────────────────────────────
function SchedulingPanel() {
  const { bookings, addBooking, updateBooking, deleteBooking, clients } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ clientId: "", client: "", service: "", date: "", time: "", duration: "60 min", notes: "" });

  const handleAdd = () => {
    if (!form.client || !form.date || !form.time) { toast.error("Client, date and time are required"); return; }
    addBooking({ ...form, status: "confirmed" });
    setForm({ clientId: "", client: "", service: "", date: "", time: "", duration: "60 min", notes: "" });
    setShowAdd(false);
    toast.success("Booking confirmed!");
  };

  const statusColor = { confirmed: "bg-green-50 text-green-600", pending: "bg-yellow-50 text-yellow-600", cancelled: "bg-red-50 text-red-500" };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: 'Sora, sans-serif' }}>Scheduling</h2>
          <p className="text-sm text-gray-500">{bookings.length} upcoming bookings</p>
        </div>
        <Button size="sm" className="gradient-teal text-white border-0 hover:opacity-90 gap-1.5" onClick={() => setShowAdd(true)}>
          <Plus className="w-3.5 h-3.5" />New Booking
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-5 gap-4 px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <span className="col-span-2">Client / Service</span>
          <span>Date & Time</span>
          <span>Duration</span>
          <span>Status</span>
        </div>
        {bookings.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No bookings yet</p>
          </div>
        ) : bookings.map(b => (
          <div key={b.id} className="grid grid-cols-5 gap-4 px-4 py-3.5 border-t border-gray-50 hover:bg-gray-50 transition-colors items-center">
            <div className="col-span-2">
              <p className="text-sm font-semibold text-[#1C1C1E]">{b.client}</p>
              <p className="text-xs text-gray-400">{b.service}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-[#1C1C1E]">{b.date}</p>
              <p className="text-xs text-gray-400">{b.time}</p>
            </div>
            <p className="text-sm text-gray-600">{b.duration}</p>
            <div className="flex items-center justify-between">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[b.status]}`}>{b.status}</span>
              <button onClick={() => { deleteBooking(b.id); toast.success("Booking removed"); }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors ml-2">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Booking">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Client *</label>
            <select value={form.clientId} onChange={e => { const c = clients.find(c => c.id === e.target.value); setForm(p => ({ ...p, clientId: e.target.value, client: c?.name || "", service: c?.service || "" })); }} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors">
              <option value="">Select a client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {[
            { label: "Service", key: "service", placeholder: "Strategy Session" },
            { label: "Date *", key: "date", placeholder: "e.g. Mar 10, 2026" },
            { label: "Time *", key: "time", placeholder: "e.g. 2:00 PM" },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">{f.label}</label>
              <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Duration</label>
            <select value={form.duration} onChange={e => setForm(p => ({ ...p, duration: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors">
              {["30 min", "45 min", "60 min", "90 min", "120 min"].map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="flex-1 gradient-teal text-white border-0 hover:opacity-90" onClick={handleAdd}>Confirm Booking</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Invoices Panel ───────────────────────────────────────────────────────────
function InvoicesPanel() {
  const { invoices, addInvoice, updateInvoice, deleteInvoice, clients } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ clientId: "", clientName: "", service: "", amount: "", description: "", dueDate: "", status: "pending" as Invoice["status"] });

  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const totalPending = invoices.filter(i => i.status === "pending").reduce((s, i) => s + i.amount, 0);
  const totalOverdue = invoices.filter(i => i.status === "overdue").reduce((s, i) => s + i.amount, 0);

  const handleAdd = () => {
    if (!form.clientName || !form.amount) { toast.error("Client and amount are required"); return; }
    addInvoice({ ...form, amount: parseFloat(form.amount), issuedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) });
    setForm({ clientId: "", clientName: "", service: "", amount: "", description: "", dueDate: "", status: "pending" });
    setShowAdd(false);
    toast.success("Invoice created!");
  };

  const statusColor: Record<Invoice["status"], string> = {
    paid: "bg-green-50 text-green-600",
    pending: "bg-yellow-50 text-yellow-600",
    overdue: "bg-red-50 text-red-500",
    draft: "bg-gray-100 text-gray-500"
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: 'Sora, sans-serif' }}>Invoices</h2>
          <p className="text-sm text-gray-500">{invoices.length} total invoices</p>
        </div>
        <Button size="sm" className="gradient-teal text-white border-0 hover:opacity-90 gap-1.5" onClick={() => setShowAdd(true)}>
          <Plus className="w-3.5 h-3.5" />New Invoice
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Paid", value: totalPaid, color: "#00C9A7", bg: "bg-[#00C9A7]/10" },
          { label: "Pending", value: totalPending, color: "#F59E0B", bg: "bg-yellow-50" },
          { label: "Overdue", value: totalOverdue, color: "#FF6B6B", bg: "bg-red-50" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4`}>
            <p className="text-xs font-semibold mb-1" style={{ color: s.color }}>{s.label}</p>
            <p className="text-xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: 'Sora, sans-serif' }}>${s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-5 gap-4 px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <span className="col-span-2">Client / Service</span>
          <span>Amount</span>
          <span>Due Date</span>
          <span>Status</span>
        </div>
        {invoices.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No invoices yet</p>
          </div>
        ) : invoices.map(inv => (
          <div key={inv.id} className="grid grid-cols-5 gap-4 px-4 py-3.5 border-t border-gray-50 hover:bg-gray-50 transition-colors items-center">
            <div className="col-span-2">
              <p className="text-sm font-semibold text-[#1C1C1E]">{inv.clientName}</p>
              <p className="text-xs text-gray-400">{inv.service}</p>
            </div>
            <p className="text-sm font-bold text-[#1C1C1E]">${inv.amount.toLocaleString()}</p>
            <p className="text-sm text-gray-600">{inv.dueDate}</p>
            <div className="flex items-center justify-between">
              <button onClick={() => { const next = inv.status === "pending" ? "paid" : inv.status === "overdue" ? "paid" : "pending"; updateInvoice(inv.id, { status: next as Invoice["status"] }); toast.success(`Invoice marked as ${next}`); }} className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer hover:opacity-80 transition-opacity ${statusColor[inv.status]}`}>{inv.status}</button>
              <button onClick={() => { deleteInvoice(inv.id); toast.success("Invoice deleted"); }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors ml-2">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Create Invoice">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Client *</label>
            <select value={form.clientId} onChange={e => { const c = clients.find(c => c.id === e.target.value); setForm(p => ({ ...p, clientId: e.target.value, clientName: c?.name || "", service: c?.service || "" })); }} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors">
              <option value="">Select a client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {[
            { label: "Service Description", key: "service", placeholder: "Business Coaching — March" },
            { label: "Amount ($) *", key: "amount", placeholder: "350" },
            { label: "Due Date", key: "dueDate", placeholder: "Mar 15, 2026" },
            { label: "Notes", key: "description", placeholder: "4 x 60-min sessions" },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">{f.label}</label>
              <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors" />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="flex-1 gradient-teal text-white border-0 hover:opacity-90" onClick={handleAdd}>Create Invoice</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Follow-Ups Panel ─────────────────────────────────────────────────────────
function FollowUpsPanel() {
  const { followUps, sendFollowUp, addFollowUp, clients } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [preview, setPreview] = useState<FollowUp | null>(null);
  const [form, setForm] = useState({ clientId: "", clientName: "", type: "email" as FollowUp["type"], message: "", scheduledAt: "" });

  const handleSendAll = () => {
    const pending = followUps.filter(f => f.status === "pending");
    pending.forEach(f => sendFollowUp(f.id));
    toast.success(`${pending.length} follow-ups sent!`);
  };

  const statusColor = { sent: "bg-green-50 text-green-600", pending: "bg-yellow-50 text-yellow-600", replied: "bg-blue-50 text-blue-600" };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: 'Sora, sans-serif' }}>AI Follow-Ups</h2>
          <p className="text-sm text-gray-500">{followUps.filter(f => f.status === "pending").length} pending · {followUps.filter(f => f.status === "sent").length} sent</p>
        </div>
        <div className="flex gap-2">
          {followUps.some(f => f.status === "pending") && (
            <Button size="sm" variant="outline" className="gap-1.5 border-[#00C9A7] text-[#00C9A7] hover:bg-[#00C9A7]/5" onClick={handleSendAll}>
              <Send className="w-3.5 h-3.5" />Send All Pending
            </Button>
          )}
          <Button size="sm" className="gradient-teal text-white border-0 hover:opacity-90 gap-1.5" onClick={() => setShowAdd(true)}>
            <Plus className="w-3.5 h-3.5" />New Follow-Up
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {followUps.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 text-center py-12 text-gray-400">
            <Mail className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No follow-ups yet</p>
          </div>
        ) : followUps.map(f => (
          <div key={f.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${f.type === "email" ? "bg-[#00C9A7]/10" : "bg-[#FF6B6B]/10"}`}>
              {f.type === "email" ? <Mail className="w-4 h-4 text-[#00C9A7]" /> : <MessageSquare className="w-4 h-4 text-[#FF6B6B]" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold text-[#1C1C1E]">{f.clientName}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[f.status]}`}>{f.status}</span>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2">{f.message}</p>
              <p className="text-xs text-gray-300 mt-1">{f.status === "sent" ? `Sent ${f.sentAt}` : `Scheduled: ${f.scheduledAt}`}</p>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <button onClick={() => setPreview(f)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"><Eye className="w-3.5 h-3.5" /></button>
              {f.status === "pending" && (
                <button onClick={() => { sendFollowUp(f.id); toast.success(`Follow-up sent to ${f.clientName}!`); }} className="p-2 rounded-lg hover:bg-[#00C9A7]/10 text-gray-400 hover:text-[#00C9A7] transition-colors"><Send className="w-3.5 h-3.5" /></button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Preview Modal */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title="Follow-Up Preview" wide>
        {preview && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-[#00C9A7]/10 flex items-center justify-center"><Mail className="w-4 h-4 text-[#00C9A7]" /></div>
              <div>
                <p className="text-xs text-gray-400">To</p>
                <p className="text-sm font-semibold text-[#1C1C1E]">{preview.clientName}</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-400 mb-2">MESSAGE</p>
              <p className="text-sm text-gray-700 leading-relaxed">{preview.message}</p>
            </div>
            {preview.status === "pending" && (
              <Button className="w-full gradient-teal text-white border-0 hover:opacity-90 gap-2" onClick={() => { sendFollowUp(preview.id); toast.success("Follow-up sent!"); setPreview(null); }}>
                <Send className="w-4 h-4" />Send Now
              </Button>
            )}
          </div>
        )}
      </Modal>

      {/* Add Follow-Up Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Follow-Up" wide>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Client</label>
            <select value={form.clientId} onChange={e => { const c = clients.find(c => c.id === e.target.value); setForm(p => ({ ...p, clientId: e.target.value, clientName: c?.name || "" })); }} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors">
              <option value="">Select a client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Type</label>
            <div className="flex gap-3">
              {(["email", "sms"] as const).map(t => (
                <button key={t} onClick={() => setForm(p => ({ ...p, type: t }))} className={`flex-1 py-2.5 text-sm font-medium rounded-xl border transition-colors capitalize ${form.type === t ? "border-[#00C9A7] bg-[#00C9A7]/5 text-[#00C9A7]" : "border-gray-200 text-gray-600"}`}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Message</label>
            <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} rows={5} placeholder="Write your follow-up message..." className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="flex-1 gradient-teal text-white border-0 hover:opacity-90" onClick={() => {
              if (!form.clientName || !form.message) { toast.error("Client and message required"); return; }
              addFollowUp({ ...form, status: "pending", scheduledAt: new Date().toLocaleString() });
              setShowAdd(false);
              toast.success("Follow-up created!");
            }}>Create Follow-Up</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Analytics Panel ──────────────────────────────────────────────────────────
function AnalyticsPanel() {
  const { clients, invoices, bookings } = useApp();
  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const activeClients = clients.filter(c => c.status === "active").length;
  const conversionRate = clients.length > 0 ? Math.round((activeClients / clients.length) * 100) : 0;

  const pieData = [
    { name: "Active", value: clients.filter(c => c.status === "active").length, color: "#00C9A7" },
    { name: "Leads", value: clients.filter(c => c.status === "lead").length, color: "#FF6B6B" },
    { name: "Inactive", value: clients.filter(c => c.status === "inactive").length, color: "#E5E7EB" },
  ];

  const invoiceData = [
    { name: "Paid", value: invoices.filter(i => i.status === "paid").length, color: "#00C9A7" },
    { name: "Pending", value: invoices.filter(i => i.status === "pending").length, color: "#F59E0B" },
    { name: "Overdue", value: invoices.filter(i => i.status === "overdue").length, color: "#FF6B6B" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: 'Sora, sans-serif' }}>Analytics</h2>
        <p className="text-sm text-gray-500">Your business performance at a glance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue", value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, color: "#00C9A7" },
          { label: "Total Clients", value: String(clients.length), icon: Users, color: "#FF6B6B" },
          { label: "Total Bookings", value: String(bookings.length), icon: Calendar, color: "#00C9A7" },
          { label: "Conversion Rate", value: `${conversionRate}%`, icon: TrendingUp, color: "#FF6B6B" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white mb-3" style={{ backgroundColor: s.color }}>
              <s.icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: 'Sora, sans-serif' }}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <h3 className="font-bold text-[#1C1C1E] text-sm mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="tealGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00C9A7" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#00C9A7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '12px' }} formatter={(v: number) => [`$${v.toLocaleString()}`, 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke="#00C9A7" strokeWidth={2.5} fill="url(#tealGrad2)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <h3 className="font-bold text-[#1C1C1E] text-sm mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>Client Breakdown</h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-sm text-gray-600">{d.name}</span>
                  <span className="text-sm font-bold text-[#1C1C1E] ml-auto">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 lg:col-span-2">
          <h3 className="font-bold text-[#1C1C1E] text-sm mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>Invoice Status</h3>
          <div className="grid grid-cols-3 gap-4">
            {invoiceData.map(d => (
              <div key={d.name} className="text-center p-4 rounded-xl" style={{ backgroundColor: `${d.color}15` }}>
                <p className="text-2xl font-extrabold" style={{ color: d.color, fontFamily: 'Sora, sans-serif' }}>{d.value}</p>
                <p className="text-xs text-gray-500 mt-1">{d.name} Invoices</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────
function SettingsPanel() {
  const { userName, setUserName, userEmail, setUserEmail, businessName, setBusinessName } = useApp();
  const [localName, setLocalName] = useState(userName);
  const [localEmail, setLocalEmail] = useState(userEmail);
  const [localBiz, setLocalBiz] = useState(businessName);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setUserName(localName);
    setUserEmail(localEmail);
    setBusinessName(localBiz);
    setSaved(true);
    toast.success("Settings saved!");
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: 'Sora, sans-serif' }}>Settings</h2>
        <p className="text-sm text-gray-500">Manage your account and business preferences</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        <h3 className="font-bold text-sm text-[#1C1C1E] flex items-center gap-2" style={{ fontFamily: 'Sora, sans-serif' }}>
          <User className="w-4 h-4 text-[#00C9A7]" />Profile
        </h3>
        {[
          { label: "Your Name", value: localName, setter: setLocalName, placeholder: "Alex Smith" },
          { label: "Email Address", value: localEmail, setter: setLocalEmail, placeholder: "alex@example.com" },
        ].map(f => (
          <div key={f.label}>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">{f.label}</label>
            <input value={f.value} onChange={e => f.setter(e.target.value)} placeholder={f.placeholder} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors" />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        <h3 className="font-bold text-sm text-[#1C1C1E] flex items-center gap-2" style={{ fontFamily: 'Sora, sans-serif' }}>
          <Building className="w-4 h-4 text-[#00C9A7]" />Business
        </h3>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Business Name</label>
          <input value={localBiz} onChange={e => setLocalBiz(e.target.value)} placeholder="My Coaching Studio" className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <h3 className="font-bold text-sm text-[#1C1C1E] flex items-center gap-2" style={{ fontFamily: 'Sora, sans-serif' }}>
          <Zap className="w-4 h-4 text-[#00C9A7]" />Subscription
        </h3>
        <div className="flex items-center justify-between p-3 bg-[#00C9A7]/5 border border-[#00C9A7]/20 rounded-xl">
          <div>
            <p className="text-sm font-semibold text-[#1C1C1E]">Pro Trial</p>
            <p className="text-xs text-gray-500">11 days remaining · Up to unlimited clients</p>
          </div>
          <Badge className="bg-[#00C9A7] text-white border-0">Active</Badge>
        </div>
        <Button className="w-full gradient-teal text-white border-0 hover:opacity-90" onClick={() => toast.success("Redirecting to upgrade page...")}>
          Upgrade to Pro — $99/month
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
        <h3 className="font-bold text-sm text-[#1C1C1E] flex items-center gap-2" style={{ fontFamily: 'Sora, sans-serif' }}>
          <AlertCircle className="w-4 h-4 text-[#FF6B6B]" />Danger Zone
        </h3>
        <Button variant="outline" className="w-full border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300" onClick={() => {
          if (confirm("Reset all data to defaults? This cannot be undone.")) {
            localStorage.clear();
            window.location.reload();
          }
        }}>
          <RefreshCw className="w-4 h-4 mr-2" />Reset All Data
        </Button>
      </div>

      <Button className="gradient-teal text-white border-0 hover:opacity-90 gap-2 w-full" onClick={handleSave}>
        <Save className="w-4 h-4" />{saved ? "Saved!" : "Save Settings"}
      </Button>
    </div>
  );
}

// ─── Mobile Bottom Nav ───────────────────────────────────────────────────────
function MobileBottomNav({ active, setActive }: { active: ActivePanel; setActive: (p: ActivePanel) => void }) {
  const { unreadCount } = useApp();
  const mobileNavItems = [
    { icon: LayoutDashboard, label: "Home", panel: "overview" as ActivePanel },
    { icon: Users, label: "Clients", panel: "clients" as ActivePanel },
    { icon: Calendar, label: "Schedule", panel: "scheduling" as ActivePanel },
    { icon: FileText, label: "Invoices", panel: "invoices" as ActivePanel },
    { icon: Bot, label: "AI", panel: "ai" as ActivePanel },
  ];
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#1C1C1E] border-t border-white/10 flex md:hidden safe-area-bottom"
      aria-label="Mobile navigation"
    >
      {mobileNavItems.map((item) => (
        <button
          key={item.panel}
          onClick={() => setActive(item.panel)}
          aria-label={item.label}
          aria-current={active === item.panel ? "page" : undefined}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 min-h-[56px] transition-colors relative ${
            active === item.panel ? "text-[#00C9A7]" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          <item.icon className="w-5 h-5" aria-hidden="true" />
          <span className="text-[10px] font-medium">{item.label}</span>
          {item.panel === "followups" && unreadCount > 0 && (
            <span className="absolute top-1.5 right-1/4 w-4 h-4 bg-[#FF6B6B] rounded-full text-white text-[9px] flex items-center justify-center font-bold">
              {unreadCount}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [active, setActive] = useState<ActivePanel>("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [search, setSearch] = useState("");
  const { unreadCount, clients, addClient } = useApp();

  // New Client quick-add modal
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [qForm, setQForm] = useState({ name: "", email: "", service: "", status: "lead" as Client["status"] });

  const panelTitles: Record<ActivePanel, string> = {
    overview: "Dashboard", clients: "Clients", scheduling: "Scheduling",
    invoices: "Invoices", followups: "Follow-Ups", analytics: "Analytics", settings: "Settings", ai: "AI Assistant"
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex">
      {/* Sidebar — hidden on mobile, shown on md+ */}
      <div className="hidden md:block">
        <Sidebar active={active} setActive={setActive} collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav active={active} setActive={setActive} />

      <main className={`flex-1 transition-all duration-300 md:${collapsed ? "ml-16" : "ml-60"} min-h-screen pb-20 md:pb-0`} id="main-content">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between sticky top-0 z-30" role="banner">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:flex p-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#00C9A7]"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <LayoutDashboard className="w-4 h-4 text-gray-500" aria-hidden="true" />
            </button>
            {/* Mobile: show current panel title */}
            <div className="flex md:hidden items-center gap-2">
              <div className="w-7 h-7 rounded-lg gradient-teal flex items-center justify-center" aria-hidden="true">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-sm text-[#1C1C1E]" style={{ fontFamily: 'Sora, sans-serif' }}>{panelTitles[active]}</span>
            </div>
            <div className="hidden md:flex items-center gap-2 text-sm text-gray-400" aria-label="Breadcrumb">
              <span className="text-gray-300">/</span>
              <span className="font-medium text-[#1C1C1E]">{panelTitles[active]}</span>
            </div>
          </div>
          <div className="relative hidden md:block">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <label htmlFor="dashboard-search" className="sr-only">Search clients and invoices</label>
            <input
              id="dashboard-search"
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search clients, invoices..."
              className="pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl w-64 focus:outline-none focus:ring-2 focus:ring-[#00C9A7] transition-colors"
              onFocus={() => setActive("clients")}
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell className="w-4 h-4 text-gray-500" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-[#FF6B6B] rounded-full text-white text-xs flex items-center justify-center font-bold leading-none">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              <NotificationsPanel open={showNotifications} onClose={() => setShowNotifications(false)} />
            </div>
            <Button
              size="sm"
              className="gradient-teal text-white border-0 hover:opacity-90 gap-1.5 focus:ring-2 focus:ring-[#00C9A7] focus:ring-offset-2"
              onClick={() => setShowQuickAdd(true)}
              aria-label="Add new client"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">New Client</span>
            </Button>
            <button
              className="w-8 h-8 rounded-full bg-[#00C9A7] flex items-center justify-center text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#00C9A7] focus:ring-offset-2"
              onClick={() => setActive("settings")}
              aria-label="Open settings"
            >
              A
            </button>
          </div>
        </header>

        {/* Panel Content */}
        <div className="p-4 sm:p-6">
          {active === "overview" && <OverviewPanel setActive={setActive} />}
          {active === "clients" && <ClientsPanel />}
          {active === "scheduling" && <SchedulingPanel />}
          {active === "invoices" && <InvoicesPanel />}
          {active === "followups" && <FollowUpsPanel />}
          {active === "analytics" && <AnalyticsPanel />}
          {active === "settings" && <SettingsPanel />}
        {active === "ai" && <AIAssistant />}
        </div>
      </main>

      {/* Quick Add Client Modal */}
      <Modal open={showQuickAdd} onClose={() => setShowQuickAdd(false)} title="Quick Add Client">
        <div className="space-y-4">
          {[
            { label: "Full Name *", key: "name", placeholder: "Jane Smith" },
            { label: "Email *", key: "email", placeholder: "jane@example.com" },
            { label: "Service", key: "service", placeholder: "Business Coaching" },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">{f.label}</label>
              <input value={(qForm as any)[f.key]} onChange={e => setQForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors" />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowQuickAdd(false)}>Cancel</Button>
            <Button className="flex-1 gradient-teal text-white border-0 hover:opacity-90" onClick={() => {
              if (!qForm.name || !qForm.email) { toast.error("Name and email required"); return; }
              addClient({ ...qForm, phone: "", notes: "", totalRevenue: 0, lastContact: "Just now", avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(qForm.name)}&background=00C9A7&color=fff&size=60`, joinedDate: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) });
              setQForm({ name: "", email: "", service: "", status: "lead" });
              setShowQuickAdd(false);
              setActive("clients");
              toast.success(`${qForm.name} added!`);
            }}>Add Client</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
