/* SkillBridge AI — Full Dashboard (DB-backed)
 * All panels connected to real tRPC/database procedures
 * Design: "Kinetic Warmth" — Dark sidebar (#1C1C1E), Teal (#00C9A7), Coral (#FF6B6B)
 */

import { useState, useEffect, useRef } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import ClientPulsePanel from "./ClientPulse";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import AIAssistant from "@/components/AIAssistant";
import { HealthMonitor } from "@/components/HealthMonitor";
import {
  LayoutDashboard, Users, Calendar, FileText, Mail,
  BarChart3, Settings, Zap, Plus, TrendingUp,
  DollarSign, Clock, CheckCircle, ArrowUpRight,
  ChevronRight, LogOut, X, Edit2, Trash2, Send,
  Download, Phone, AlertCircle, RefreshCw, User,
  Building, Save, Moon, Sun, Bot, CreditCard,
  ExternalLink, Bell, Search, ChevronDown, Loader2,
  Globe, ToggleLeft, ToggleRight, Printer, Eye,
  Copy, Check, Star, Activity, HeartPulse
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
  PieChart, Pie, Cell
} from "recharts";

type ActivePanel = "overview" | "clients" | "scheduling" | "invoices" | "followups" | "analytics" | "settings" | "ai" | "pulse";

interface ConfirmState {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
}
const defaultConfirm: ConfirmState = { open: false, title: "", description: "", onConfirm: () => {} };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatCurrency(n: number | string) {
  return `$${parseFloat(String(n)).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />;
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        tabIndex={-1}
        className={`relative bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[90vh] overflow-y-auto outline-none`}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-[#1C1C1E] text-base" style={{ fontFamily: "Sora, sans-serif" }}>{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Close dialog">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Input Field ─────────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = "text", required, textarea, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean; textarea?: boolean; rows?: number;
}) {
  const cls = "w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors";
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}{required && " *"}</label>
      {textarea
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} className={`${cls} resize-none`} />
        : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      }
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
const navItems: { icon: React.ElementType; label: string; panel: ActivePanel; badge?: string }[] = [
  { icon: LayoutDashboard, label: "Dashboard", panel: "overview" },
  { icon: Users, label: "Clients", panel: "clients" },
  { icon: Calendar, label: "Scheduling", panel: "scheduling" },
  { icon: FileText, label: "Invoices", panel: "invoices" },
  { icon: Mail, label: "Follow-Ups", panel: "followups" },
  { icon: HeartPulse, label: "Client Pulse", panel: "pulse", badge: "AI" },
  { icon: BarChart3, label: "Analytics", panel: "analytics" },
  { icon: Settings, label: "Settings", panel: "settings" },
  { icon: Bot, label: "AI Assistant", panel: "ai" },
];

function Sidebar({ active, setActive, collapsed, setCollapsed }: {
  active: ActivePanel; setActive: (p: ActivePanel) => void;
  collapsed: boolean; setCollapsed: (v: boolean) => void;
}) {
  const [, navigate] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { data: settings } = trpc.settings.get.useQuery(undefined, { retry: 1 });

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-[#1C1C1E] flex flex-col transition-all duration-300 z-40 ${collapsed ? "w-16" : "w-60"}`}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-8 h-8 rounded-lg gradient-teal flex items-center justify-center flex-shrink-0"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Zap className="w-4 h-4 text-white" />
        </button>
        {!collapsed && (
          <span className="font-bold text-white text-sm" style={{ fontFamily: "Sora, sans-serif" }}>
            SkillBridge <span className="text-[#00C9A7]">AI</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto" aria-label="Dashboard sections">
        {navItems.map((item) => (
          <button
            key={item.panel}
            onClick={() => setActive(item.panel)}
            aria-current={active === item.panel ? "page" : undefined}
            aria-label={item.label}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative ${
              active === item.panel ? "bg-[#00C9A7]/15 text-[#00C9A7]" : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            {!collapsed && <span>{item.label}</span>}
            {!collapsed && item.badge && active !== item.panel && (
              <span className="ml-auto text-[9px] font-bold bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded-full">{item.badge}</span>
            )}
            {!collapsed && active === item.panel && <ChevronRight className="w-3 h-3 ml-auto" aria-hidden="true" />}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/10 space-y-1">
        {!collapsed && settings?.subscriptionStatus === "active" && (
          <div className="bg-[#00C9A7]/10 border border-[#00C9A7]/20 rounded-xl p-3 mb-2">
            <p className="text-xs font-semibold text-[#00C9A7] mb-0.5 capitalize">{settings.planId || "Pro"} Plan</p>
            <p className="text-xs text-gray-400">Active subscription</p>
          </div>
        )}
        {!collapsed && (!settings?.subscriptionStatus || settings.subscriptionStatus === "inactive") && (
          <button
            onClick={() => navigate("/pricing")}
            className="w-full bg-gradient-to-r from-[#00C9A7] to-[#00a88c] text-white text-xs font-semibold px-3 py-2 rounded-xl mb-2 hover:opacity-90 transition-opacity"
          >
            Upgrade to Pro →
          </button>
        )}
        <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
          {theme === "dark" ? <Sun className="w-4 h-4 flex-shrink-0" /> : <Moon className="w-4 h-4 flex-shrink-0" />}
          {!collapsed && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
        </button>
        <button onClick={() => navigate("/billing")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all" aria-label="Billing">
          <CreditCard className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Billing</span>}
        </button>
        {user?.role === "admin" && (
          <button onClick={() => navigate("/admin")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all" aria-label="Admin panel">
            <Star className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Admin Panel</span>}
          </button>
        )}
        <button onClick={() => navigate("/")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all" aria-label="Back to website">
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Back to Site</span>}
        </button>
      </div>
    </aside>
  );
}

// ─── Overview Panel ───────────────────────────────────────────────────────────
function OverviewPanel({ userName, setActivePanel }: { userName: string; setActivePanel: (p: ActivePanel) => void }) {
  const { data: analytics, isLoading } = trpc.analytics.overview.useQuery(undefined, { retry: 2 });
  const { data: recentClients } = trpc.clients.list.useQuery({ search: "", status: "all" });
  const { data: recentBookings } = trpc.bookings.list.useQuery({ status: "scheduled" });
  const { data: pulseData } = trpc.pulse.getAll.useQuery(undefined, { retry: 1 });

  if (isLoading) return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );

  const stats = [
    { label: "Total Revenue", value: formatCurrency(analytics?.totalRevenue || 0), change: "+12% this month", icon: DollarSign, color: "#00C9A7" },
    { label: "Active Clients", value: String(analytics?.activeClients || 0), change: `${analytics?.totalClients || 0} total`, icon: Users, color: "#6366F1" },
    { label: "Sessions Completed", value: String(analytics?.completedSessions || 0), change: `${analytics?.completedSessions || 0} upcoming`, icon: CheckCircle, color: "#F59E0B" },
    { label: "Outstanding", value: formatCurrency(analytics?.outstanding || 0), change: "Awaiting payment", icon: Clock, color: "#FF6B6B" },
  ];

  const monthlyData = analytics?.monthlyRevenue || [];
  const clientGrowthData = analytics?.clientGrowth || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: "Sora, sans-serif" }}>
          {getGreeting()}, {userName || "there"} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">Here's what's happening with your business today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-5 border border-gray-100 card-lift">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: s.color }}>
                <s.icon className="w-5 h-5" aria-hidden="true" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-300" aria-hidden="true" />
            </div>
            <p className="text-2xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: "Sora, sans-serif" }}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            <p className="text-xs font-medium mt-1" style={{ color: s.color }}>{s.change}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <h3 className="font-bold text-[#1C1C1E] text-sm mb-4" style={{ fontFamily: "Sora, sans-serif" }}>Revenue (Last 6 Months)</h3>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00C9A7" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#00C9A7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: "12px" }} formatter={(v: number) => [formatCurrency(v), "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#00C9A7" strokeWidth={2.5} fill="url(#tealGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-gray-400">
              <Activity className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">Revenue data will appear once you create paid invoices.</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <h3 className="font-bold text-[#1C1C1E] text-sm mb-4" style={{ fontFamily: "Sora, sans-serif" }}>Client Growth</h3>
          {clientGrowthData.some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={clientGrowthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: "12px" }} />
                <Bar dataKey="count" fill="#00C9A7" radius={[6, 6, 0, 0]} name="New Clients" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-gray-400">
              <Users className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">Add your first client to see growth trends.</p>
            </div>
          )}
        </div>
      </div>

      {/* Client Pulse Summary Widget */}
      {pulseData && pulseData.length > 0 && (() => {
        const withPulse = pulseData.filter(d => d.pulse !== null);
        const churnRisk = withPulse.filter(d => d.pulse?.churnRisk === true).length;
        const upsellReady = withPulse.filter(d => d.pulse?.upsellReady === true).length;
        const goingSilent = withPulse.filter(d => d.pulse?.goingSilent === true).length;
        const avgScore = withPulse.length > 0
          ? Math.round(withPulse.reduce((s, d) => s + (d.pulse?.healthScore ?? 0), 0) / withPulse.length)
          : null;
        if (withPulse.length === 0) return null;
        return (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-[#00C9A7]" />
                <h3 className="font-bold text-sm text-[#1C1C1E]" style={{ fontFamily: "Sora, sans-serif" }}>Client Pulse</h3>
                <span className="text-xs bg-[#00C9A7]/10 text-[#00C9A7] font-semibold px-2 py-0.5 rounded-full">AI</span>
              </div>
              <button onClick={() => setActivePanel("pulse")} className="text-xs text-[#00C9A7] hover:underline font-medium flex items-center gap-1">
                View All <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-2xl font-extrabold" style={{ fontFamily: "Sora, sans-serif", color: avgScore !== null ? (avgScore >= 70 ? "#00C9A7" : avgScore >= 40 ? "#F59E0B" : "#FF6B6B") : "#9CA3AF" }}>{avgScore ?? "—"}</p>
                <p className="text-xs text-gray-500 mt-0.5">Avg Health</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-xl">
                <p className="text-2xl font-extrabold text-[#FF6B6B]" style={{ fontFamily: "Sora, sans-serif" }}>{churnRisk}</p>
                <p className="text-xs text-gray-500 mt-0.5">Churn Risk</p>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-xl">
                <p className="text-2xl font-extrabold text-yellow-600" style={{ fontFamily: "Sora, sans-serif" }}>{goingSilent}</p>
                <p className="text-xs text-gray-500 mt-0.5">Going Silent</p>
              </div>
              <div className="text-center p-3 bg-[#00C9A7]/10 rounded-xl">
                <p className="text-2xl font-extrabold text-[#00C9A7]" style={{ fontFamily: "Sora, sans-serif" }}>{upsellReady}</p>
                <p className="text-xs text-gray-500 mt-0.5">Upsell Ready</p>
              </div>
            </div>
            {churnRisk > 0 && (
              <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
                <AlertCircle className="w-4 h-4 text-[#FF6B6B] flex-shrink-0" />
                <p className="text-xs text-red-700">
                  <strong>{churnRisk} client{churnRisk > 1 ? "s" : ""}</strong> at risk of churning. <button onClick={() => setActivePanel("pulse")} className="underline font-semibold">Take action →</button>
                </p>
              </div>
            )}
          </div>
        );
      })()}

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h3 className="font-bold text-sm text-[#1C1C1E]" style={{ fontFamily: "Sora, sans-serif" }}>Recent Clients</h3>
            <span className="text-xs text-[#00C9A7] font-medium">{recentClients?.length || 0} total</span>
          </div>
          {!recentClients || recentClients.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <Users className="w-7 h-7 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No clients yet. Add your first client!</p>
            </div>
          ) : recentClients.slice(0, 5).map(c => (
            <div key={c.id} className="flex items-center gap-3 px-5 py-3 border-t border-gray-50 hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 rounded-full gradient-teal flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {c.avatarInitials || c.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1C1C1E] truncate">{c.name}</p>
                <p className="text-xs text-gray-400 truncate">{c.service || "General Client"}</p>
              </div>
              <Badge className={`text-xs border-0 ${c.status === "active" ? "bg-green-50 text-green-600" : c.status === "prospect" ? "bg-yellow-50 text-yellow-600" : "bg-gray-100 text-gray-500"}`}>
                {c.status}
              </Badge>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h3 className="font-bold text-sm text-[#1C1C1E]" style={{ fontFamily: "Sora, sans-serif" }}>Upcoming Sessions</h3>
            <span className="text-xs text-[#00C9A7] font-medium">{recentBookings?.length || 0} scheduled</span>
          </div>
          {!recentBookings || recentBookings.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <Calendar className="w-7 h-7 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No upcoming sessions. Create a booking!</p>
            </div>
          ) : recentBookings.slice(0, 5).map(b => (
            <div key={b.id} className="flex items-center gap-3 px-5 py-3 border-t border-gray-50 hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 rounded-xl bg-[#00C9A7]/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-[#00C9A7]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1C1C1E] truncate">{b.clientName}</p>
                <p className="text-xs text-gray-400">{b.date} at {b.time}</p>
              </div>
              <span className="text-xs text-gray-400">{b.duration}m</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Clients Panel ────────────────────────────────────────────────────────────
function ClientsPanel() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "prospect">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", service: "", status: "active" as "active" | "inactive" | "prospect", notes: "" });

  const { data: clientList, isLoading } = trpc.clients.list.useQuery({ search, status: statusFilter });
  const { data: selectedClient } = trpc.clients.get.useQuery({ id: selectedId! }, { enabled: !!selectedId });
  const { data: pulseData } = trpc.pulse.getAll.useQuery(undefined, { retry: 1 });
  const pulseMap = new Map((pulseData ?? []).map(d => [d.client.id, d.pulse]));

  const createClient = trpc.clients.create.useMutation({
    onSuccess: () => { utils.clients.list.invalidate(); toast.success("Client added successfully!"); setShowAdd(false); setForm({ name: "", email: "", phone: "", service: "", status: "active", notes: "" }); },
    onError: (e) => toast.error(e.message),
  });
  const deleteClient = trpc.clients.delete.useMutation({
    onSuccess: () => { utils.clients.list.invalidate(); toast.success("Client removed."); },
    onError: (e) => toast.error(e.message),
  });
  const updateClient = trpc.clients.update.useMutation({
    onSuccess: () => { utils.clients.list.invalidate(); utils.clients.get.invalidate({ id: selectedId! }); toast.success("Client updated!"); },
    onError: (e) => toast.error(e.message),
  });

  const handleCreate = () => {
    if (!form.name.trim()) { toast.error("Client name is required."); return; }
    createClient.mutate(form);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: "Sora, sans-serif" }}>Clients</h2>
          <p className="text-sm text-gray-500">{clientList?.length || 0} clients in your roster</p>
        </div>
        <Button size="sm" className="gradient-teal text-white border-0 hover:opacity-90 gap-1.5" onClick={() => setShowAdd(true)}>
          <Plus className="w-3.5 h-3.5" />Add Client
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients by name, email, or service..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors"
            aria-label="Search clients"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors bg-white"
          aria-label="Filter by status"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="prospect">Prospect</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="hidden sm:grid grid-cols-4 gap-4 px-5 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <span className="col-span-2">Client</span>
          <span>Service</span>
          <span>Status</span>
        </div>
        {isLoading ? (
          <div className="space-y-px">
            {[...Array(4)].map((_, i) => <div key={i} className="px-5 py-4 border-t border-gray-50"><Skeleton className="h-10" /></div>)}
          </div>
        ) : !clientList || clientList.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium text-gray-500">No clients found</p>
            <p className="text-xs mt-1">{search ? "Try adjusting your search." : "Add your first client to get started."}</p>
          </div>
        ) : clientList.map(c => (
          <div
            key={c.id}
            className="flex sm:grid sm:grid-cols-4 gap-4 px-5 py-4 border-t border-gray-50 hover:bg-gray-50 transition-colors items-center cursor-pointer"
            onClick={() => setSelectedId(c.id)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === "Enter" && setSelectedId(c.id)}
            aria-label={`View ${c.name}'s profile`}
          >
            <div className="col-span-2 flex items-center gap-3 min-w-0">
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full gradient-teal flex items-center justify-center text-white text-xs font-bold">
                  {c.avatarInitials || c.name.slice(0, 2).toUpperCase()}
                </div>
                {(() => {
                  const p = pulseMap.get(c.id);
                  if (!p) return null;
                  const score = p.healthScore;
                  const color = score >= 70 ? "#00C9A7" : score >= 40 ? "#F59E0B" : "#FF6B6B";
                  return (
                    <span
                      title={`Health score: ${score}`}
                      className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {score >= 70 ? "✓" : score >= 40 ? "!" : "✕"}
                    </span>
                  );
                })()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1C1C1E] truncate">{c.name}</p>
                <p className="text-xs text-gray-400 truncate">{c.email || "No email"}</p>
              </div>
            </div>
            <p className="hidden sm:block text-sm text-gray-600 truncate">{c.service || "—"}</p>
            <div className="flex items-center justify-between ml-auto sm:ml-0">
              <Badge className={`text-xs border-0 ${c.status === "active" ? "bg-green-50 text-green-600" : c.status === "prospect" ? "bg-yellow-50 text-yellow-600" : "bg-gray-100 text-gray-500"}`}>
                {c.status}
              </Badge>
              <button
                onClick={e => { e.stopPropagation(); if (window.confirm(`Remove ${c.name} from your clients? This cannot be undone.`)) deleteClient.mutate({ id: c.id }); }}
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors ml-3"
                aria-label={`Delete ${c.name}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Client Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add New Client">
        <div className="space-y-4">
          <Field label="Full Name" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="Jane Smith" required />
          <Field label="Email Address" value={form.email} onChange={v => setForm(p => ({ ...p, email: v }))} placeholder="jane@example.com" type="email" />
          <Field label="Phone Number" value={form.phone} onChange={v => setForm(p => ({ ...p, phone: v }))} placeholder="+1 (555) 000-0000" />
          <Field label="Service / Niche" value={form.service} onChange={v => setForm(p => ({ ...p, service: v }))} placeholder="Business Coaching, Web Design..." />
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as typeof form.status }))} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors">
              <option value="active">Active</option>
              <option value="prospect">Prospect / Lead</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <Field label="Notes" value={form.notes} onChange={v => setForm(p => ({ ...p, notes: v }))} placeholder="Any important notes about this client..." textarea rows={3} />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="flex-1 gradient-teal text-white border-0 hover:opacity-90" onClick={handleCreate} disabled={createClient.isPending}>
              {createClient.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Client"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Client Profile Modal */}
      <Modal open={!!selectedId} onClose={() => setSelectedId(null)} title="Client Profile" wide>
        {selectedClient && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl gradient-teal flex items-center justify-center text-white text-lg font-bold">
                {selectedClient.avatarInitials || selectedClient.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1C1C1E]">{selectedClient.name}</h3>
                <p className="text-sm text-gray-500">{selectedClient.service || "General Client"}</p>
                <Badge className={`text-xs border-0 mt-1 ${selectedClient.status === "active" ? "bg-green-50 text-green-600" : selectedClient.status === "prospect" ? "bg-yellow-50 text-yellow-600" : "bg-gray-100 text-gray-500"}`}>
                  {selectedClient.status}
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Mail, label: "Email", value: selectedClient.email || "Not provided" },
                { icon: Phone, label: "Phone", value: selectedClient.phone || "Not provided" },
                { icon: Calendar, label: "Added", value: formatDate(selectedClient.createdAt) },
                { icon: Clock, label: "Last Updated", value: formatDate(selectedClient.updatedAt) },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-3.5 h-3.5 text-gray-400" />
                    <p className="text-xs text-gray-400">{label}</p>
                  </div>
                  <p className="text-sm font-semibold text-[#1C1C1E] truncate">{value}</p>
                </div>
              ))}
            </div>
            {selectedClient.notes && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedClient.notes}</p>
              </div>
            )}
            <div className="flex gap-3">
              <Button
                className="flex-1 gradient-teal text-white border-0 hover:opacity-90 gap-2"
                onClick={() => { updateClient.mutate({ id: selectedClient.id, status: "active" }); }}
                disabled={updateClient.isPending}
              >
                <CheckCircle className="w-4 h-4" />Mark Active
              </Button>
              <Button variant="outline" className="flex-1 gap-2 border-red-200 text-red-500 hover:bg-red-50" onClick={() => { if (window.confirm(`Remove ${selectedClient.name}? This cannot be undone.`)) { deleteClient.mutate({ id: selectedClient.id }); setSelectedId(null); } }}>
                <Trash2 className="w-4 h-4" />Remove
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
  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ clientName: "", clientEmail: "", service: "", date: "", time: "", duration: 60, notes: "" });

  const { data: bookingList, isLoading } = trpc.bookings.list.useQuery({ status: "all" });
  const { data: clientList } = trpc.clients.list.useQuery({ search: "", status: "all" });

  const createBooking = trpc.bookings.create.useMutation({
    onSuccess: () => { utils.bookings.list.invalidate(); toast.success("Booking confirmed!"); setShowAdd(false); setForm({ clientName: "", clientEmail: "", service: "", date: "", time: "", duration: 60, notes: "" }); },
    onError: (e) => toast.error(e.message),
  });
  const updateStatus = trpc.bookings.updateStatus.useMutation({
    onSuccess: () => { utils.bookings.list.invalidate(); toast.success("Status updated."); },
    onError: (e) => toast.error(e.message),
  });
  const deleteBooking = trpc.bookings.delete.useMutation({
    onSuccess: () => { utils.bookings.list.invalidate(); toast.success("Booking removed."); },
    onError: (e) => toast.error(e.message),
  });

  const statusColor: Record<string, string> = {
    scheduled: "bg-green-50 text-green-600",
    completed: "bg-blue-50 text-blue-600",
    cancelled: "bg-red-50 text-red-500",
    no_show: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: "Sora, sans-serif" }}>Scheduling</h2>
          <p className="text-sm text-gray-500">{bookingList?.filter(b => b.status === "scheduled").length || 0} upcoming sessions</p>
        </div>
        <Button size="sm" className="gradient-teal text-white border-0 hover:opacity-90 gap-1.5" onClick={() => setShowAdd(true)}>
          <Plus className="w-3.5 h-3.5" />New Booking
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="hidden sm:grid grid-cols-5 gap-4 px-5 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <span className="col-span-2">Client / Service</span>
          <span>Date & Time</span>
          <span>Duration</span>
          <span>Status</span>
        </div>
        {isLoading ? (
          <div className="space-y-px">{[...Array(3)].map((_, i) => <div key={i} className="px-5 py-4 border-t border-gray-50"><Skeleton className="h-10" /></div>)}</div>
        ) : !bookingList || bookingList.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium text-gray-500">No bookings yet</p>
            <p className="text-xs mt-1">Create your first booking or share your booking page with clients.</p>
          </div>
        ) : bookingList.map(b => (
          <div key={b.id} className="flex flex-col sm:grid sm:grid-cols-5 gap-2 sm:gap-4 px-5 py-4 border-t border-gray-50 hover:bg-gray-50 transition-colors">
            <div className="sm:col-span-2">
              <p className="text-sm font-semibold text-[#1C1C1E]">{b.clientName}</p>
              <p className="text-xs text-gray-400">{b.service || "General Session"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-[#1C1C1E]">{b.date}</p>
              <p className="text-xs text-gray-400">{b.time}</p>
            </div>
            <p className="text-sm text-gray-600">{b.duration} min</p>
            <div className="flex items-center justify-between">
              <select
                value={b.status}
                onChange={e => updateStatus.mutate({ id: b.id, status: e.target.value as any })}
                className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${statusColor[b.status] || "bg-gray-100 text-gray-500"}`}
                aria-label="Update booking status"
              >
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
              </select>
              <button onClick={() => { if (window.confirm("Remove this booking? This cannot be undone.")) deleteBooking.mutate({ id: b.id }); }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors ml-2" aria-label="Delete booking">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Booking">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Select Existing Client</label>
            <select
              onChange={e => {
                const c = clientList?.find(c => c.id === parseInt(e.target.value));
                if (c) setForm(p => ({ ...p, clientName: c.name, clientEmail: c.email || "", service: c.service || "" }));
              }}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors"
            >
              <option value="">— Or enter manually below —</option>
              {clientList?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Field label="Client Name" value={form.clientName} onChange={v => setForm(p => ({ ...p, clientName: v }))} placeholder="Jane Smith" required />
          <Field label="Client Email" value={form.clientEmail} onChange={v => setForm(p => ({ ...p, clientEmail: v }))} placeholder="jane@example.com" type="email" />
          <Field label="Service" value={form.service} onChange={v => setForm(p => ({ ...p, service: v }))} placeholder="Strategy Session, Coaching Call..." />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date *" value={form.date} onChange={v => setForm(p => ({ ...p, date: v }))} placeholder="2026-03-20" type="date" required />
            <Field label="Time *" value={form.time} onChange={v => setForm(p => ({ ...p, time: v }))} placeholder="14:00" type="time" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Duration (minutes)</label>
            <select value={form.duration} onChange={e => setForm(p => ({ ...p, duration: parseInt(e.target.value) }))} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors">
              {[15, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} minutes</option>)}
            </select>
          </div>
          <Field label="Notes" value={form.notes} onChange={v => setForm(p => ({ ...p, notes: v }))} placeholder="Session goals, preparation notes..." textarea />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="flex-1 gradient-teal text-white border-0 hover:opacity-90" onClick={() => createBooking.mutate(form)} disabled={createBooking.isPending}>
              {createBooking.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Booking"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Invoices Panel ───────────────────────────────────────────────────────────
function InvoicesPanel() {
  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<any>(null);
  const [form, setForm] = useState({ clientName: "", clientEmail: "", service: "", amount: "", dueDate: "", notes: "", status: "draft" as "draft" | "sent" });

  const { data: invoiceList, isLoading } = trpc.invoices.list.useQuery({ status: "all" });
  const { data: invoiceStats } = trpc.invoices.stats.useQuery();
  const { data: clientList } = trpc.clients.list.useQuery({ search: "", status: "all" });

  const createInvoice = trpc.invoices.create.useMutation({
    onSuccess: () => { utils.invoices.list.invalidate(); utils.invoices.stats.invalidate(); toast.success("Invoice created!"); setShowAdd(false); setForm({ clientName: "", clientEmail: "", service: "", amount: "", dueDate: "", notes: "", status: "draft" }); },
    onError: (e) => toast.error(e.message),
  });
  const markPaid = trpc.invoices.markPaid.useMutation({
    onSuccess: () => { utils.invoices.list.invalidate(); utils.invoices.stats.invalidate(); toast.success("Invoice marked as paid!"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteInvoice = trpc.invoices.delete.useMutation({
    onSuccess: () => { utils.invoices.list.invalidate(); utils.invoices.stats.invalidate(); toast.success("Invoice deleted."); },
    onError: (e) => toast.error(e.message),
  });
  const sendReminder = trpc.invoices.sendReminder.useMutation({
    onSuccess: (data) => { utils.followUps.list.invalidate(); toast.success(`Reminder draft saved to Follow-Ups: "${data.subject}"`); },
    onError: (e) => toast.error(e.message),
  });

  const statusColor: Record<string, string> = {
    draft: "bg-gray-100 text-gray-500",
    sent: "bg-blue-50 text-blue-600",
    paid: "bg-green-50 text-green-600",
    overdue: "bg-red-50 text-red-500",
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: "Sora, sans-serif" }}>Invoices</h2>
          <p className="text-sm text-gray-500">{invoiceList?.length || 0} total invoices</p>
        </div>
        <Button size="sm" className="gradient-teal text-white border-0 hover:opacity-90 gap-1.5" onClick={() => setShowAdd(true)}>
          <Plus className="w-3.5 h-3.5" />New Invoice
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Paid", value: formatCurrency(invoiceStats?.totalRevenue || 0), color: "#00C9A7", bg: "bg-[#00C9A7]/10" },
          { label: "Outstanding", value: formatCurrency(invoiceStats?.outstanding || 0), color: "#6366F1", bg: "bg-indigo-50" },
          { label: "Overdue", value: String(invoiceStats?.overdue || 0), color: "#FF6B6B", bg: "bg-red-50" },
          { label: "Total Invoices", value: String(invoiceStats?.total || 0), color: "#F59E0B", bg: "bg-yellow-50" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4`}>
            <p className="text-xs font-semibold mb-1" style={{ color: s.color }}>{s.label}</p>
            <p className="text-xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: "Sora, sans-serif" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="hidden sm:grid grid-cols-5 gap-4 px-5 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <span className="col-span-2">Client / Service</span>
          <span>Amount</span>
          <span>Due Date</span>
          <span>Status</span>
        </div>
        {isLoading ? (
          <div className="space-y-px">{[...Array(3)].map((_, i) => <div key={i} className="px-5 py-4 border-t border-gray-50"><Skeleton className="h-10" /></div>)}</div>
        ) : !invoiceList || invoiceList.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium text-gray-500">No invoices yet</p>
            <p className="text-xs mt-1">Create your first invoice to start tracking payments.</p>
          </div>
        ) : invoiceList.map(inv => (
          <div key={inv.id} className="flex flex-col sm:grid sm:grid-cols-5 gap-2 sm:gap-4 px-5 py-4 border-t border-gray-50 hover:bg-gray-50 transition-colors">
            <div className="sm:col-span-2">
              <p className="text-sm font-semibold text-[#1C1C1E]">{inv.clientName}</p>
              <p className="text-xs text-gray-400">{inv.invoiceNumber} · {inv.service || "General Service"}</p>
            </div>
            <p className="text-sm font-bold text-[#1C1C1E]">{formatCurrency(inv.amount)}</p>
            <p className="text-sm text-gray-500">{inv.dueDate || "—"}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`text-xs border-0 ${statusColor[inv.status] || "bg-gray-100 text-gray-500"}`}>{inv.status}</Badge>
              {inv.status !== "paid" && (
                <button onClick={() => markPaid.mutate({ id: inv.id })} className="text-xs text-[#00C9A7] hover:underline font-medium" disabled={markPaid.isPending}>
                  Mark Paid
                </button>
              )}
              {(inv.status === "sent" || inv.status === "overdue") && (
                <button
                  onClick={() => sendReminder.mutate({ id: inv.id })}
                  className="text-xs text-[#FF6B6B] hover:underline font-medium flex items-center gap-1"
                  disabled={sendReminder.isPending}
                  title="Generate a payment reminder email draft"
                >
                  <Bell className="w-3 h-3" />Remind
                </button>
              )}
              <button onClick={() => setPreviewInvoice(inv)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" aria-label="Preview invoice">
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { if (window.confirm("Delete this invoice? This cannot be undone.")) deleteInvoice.mutate({ id: inv.id }); }} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors" aria-label="Delete invoice">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Invoice Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Create Invoice">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Select Client</label>
            <select onChange={e => { const c = clientList?.find(c => c.id === parseInt(e.target.value)); if (c) setForm(p => ({ ...p, clientName: c.name, clientEmail: c.email || "" })); }} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors">
              <option value="">— Or enter manually below —</option>
              {clientList?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Field label="Client Name" value={form.clientName} onChange={v => setForm(p => ({ ...p, clientName: v }))} placeholder="Jane Smith" required />
          <Field label="Client Email" value={form.clientEmail} onChange={v => setForm(p => ({ ...p, clientEmail: v }))} placeholder="jane@example.com" type="email" />
          <Field label="Service Description" value={form.service} onChange={v => setForm(p => ({ ...p, service: v }))} placeholder="3-month coaching program, web design..." />
          <Field label="Amount ($) *" value={form.amount} onChange={v => setForm(p => ({ ...p, amount: v }))} placeholder="500.00" type="number" required />
          <Field label="Due Date" value={form.dueDate} onChange={v => setForm(p => ({ ...p, dueDate: v }))} type="date" />
          <Field label="Notes" value={form.notes} onChange={v => setForm(p => ({ ...p, notes: v }))} placeholder="Payment terms, bank details..." textarea />
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Send as</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as "draft" | "sent" }))} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors">
              <option value="draft">Save as Draft</option>
              <option value="sent">Mark as Sent</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="flex-1 gradient-teal text-white border-0 hover:opacity-90" onClick={() => createInvoice.mutate({ ...form, amount: parseFloat(form.amount) || 0 })} disabled={createInvoice.isPending}>
              {createInvoice.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Invoice"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invoice Preview Modal */}
      <Modal open={!!previewInvoice} onClose={() => setPreviewInvoice(null)} title="Invoice Preview" wide>
        {previewInvoice && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: "Sora, sans-serif" }}>INVOICE</h3>
                <p className="text-sm text-gray-500 mt-1">{previewInvoice.invoiceNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Issued</p>
                <p className="text-sm font-semibold">{formatDate(previewInvoice.createdAt)}</p>
                {previewInvoice.dueDate && <>
                  <p className="text-xs text-gray-400 mt-1">Due</p>
                  <p className="text-sm font-semibold">{previewInvoice.dueDate}</p>
                </>}
              </div>
            </div>
            <div className="border-t border-b border-gray-100 py-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Client</span>
                <span className="font-semibold">{previewInvoice.clientName}</span>
              </div>
              {previewInvoice.clientEmail && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Email</span>
                  <span>{previewInvoice.clientEmail}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Service</span>
                <span>{previewInvoice.service || "Professional Services"}</span>
              </div>
            </div>
            <div className="flex justify-between items-center bg-[#00C9A7]/10 rounded-xl p-4">
              <span className="font-bold text-[#1C1C1E]">Total Amount</span>
              <span className="text-2xl font-extrabold text-[#00C9A7]" style={{ fontFamily: "Sora, sans-serif" }}>{formatCurrency(previewInvoice.amount)}</span>
            </div>
            {previewInvoice.notes && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-700">{previewInvoice.notes}</p>
              </div>
            )}
            <div className="flex gap-3">
              <Button className="flex-1 gradient-teal text-white border-0 hover:opacity-90 gap-2" onClick={() => { window.print(); }}>
                <Printer className="w-4 h-4" />Print / Save PDF
              </Button>
              {previewInvoice.status !== "paid" && (
                <Button variant="outline" className="flex-1 gap-2" onClick={() => { markPaid.mutate({ id: previewInvoice.id }); setPreviewInvoice(null); }}>
                  <CheckCircle className="w-4 h-4 text-green-500" />Mark Paid
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Follow-Ups Panel ─────────────────────────────────────────────────────────
function FollowUpsPanel() {
  const utils = trpc.useUtils();
  const [showGenerate, setShowGenerate] = useState(false);
  const [previewFollowUp, setPreviewFollowUp] = useState<any>(null);
  const [form, setForm] = useState({ clientName: "", clientEmail: "", service: "", context: "", tone: "professional" as "professional" | "friendly" | "motivational" });

  const { data: followUpList, isLoading } = trpc.followUps.list.useQuery();
  const { data: clientList } = trpc.clients.list.useQuery({ search: "", status: "all" });

  const generate = trpc.followUps.generate.useMutation({
    onSuccess: (data) => {
      utils.followUps.list.invalidate();
      setPreviewFollowUp(data);
      setShowGenerate(false);
      toast.success("AI follow-up email generated!");
    },
    onError: (e) => toast.error(e.message),
  });
  const markSent = trpc.followUps.markSent.useMutation({
    onSuccess: () => { utils.followUps.list.invalidate(); toast.success("Follow-up marked as sent."); },
    onError: (e) => toast.error(e.message),
  });
  const deleteFollowUp = trpc.followUps.delete.useMutation({
    onSuccess: () => { utils.followUps.list.invalidate(); toast.success("Follow-up deleted."); },
    onError: (e) => toast.error(e.message),
  });

  const [copied, setCopied] = useState(false);
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: "Sora, sans-serif" }}>AI Follow-Ups</h2>
          <p className="text-sm text-gray-500">Let AI write personalized follow-up emails for your clients</p>
        </div>
        <Button size="sm" className="gradient-teal text-white border-0 hover:opacity-90 gap-1.5" onClick={() => setShowGenerate(true)}>
          <Zap className="w-3.5 h-3.5" />Generate Email
        </Button>
      </div>

      {/* Info Card */}
      <div className="bg-gradient-to-r from-[#00C9A7]/10 to-[#6366F1]/10 border border-[#00C9A7]/20 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl gradient-teal flex items-center justify-center text-white flex-shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-[#1C1C1E] text-sm">How AI Follow-Ups Work</h3>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              Select a client, choose a tone, and our AI writes a personalized follow-up email in seconds. The email checks in on their progress, encourages rebooking, and sounds like it came directly from you. Copy the email and send it from your preferred email client.
            </p>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)
        ) : !followUpList || followUpList.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 text-center py-16 text-gray-400">
            <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium text-gray-500">No follow-ups generated yet</p>
            <p className="text-xs mt-1">Generate your first AI follow-up email above.</p>
          </div>
        ) : followUpList.map(f => (
          <div key={f.id} className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-[#00C9A7]/30 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-[#1C1C1E]">{f.clientName}</p>
                  <Badge className={`text-xs border-0 ${f.status === "sent" ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>
                    {f.status}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 font-medium">{f.subject}</p>
                <p className="text-xs text-gray-400 mt-1 line-clamp-2">{f.body}</p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => setPreviewFollowUp(f)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" aria-label="Preview email">
                  <Eye className="w-4 h-4" />
                </button>
                {f.status === "draft" && (
                  <button onClick={() => markSent.mutate({ id: f.id })} className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors" aria-label="Mark as sent">
                    <Send className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => { if (window.confirm("Delete this follow-up email? This cannot be undone.")) deleteFollowUp.mutate({ id: f.id }); }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors" aria-label="Delete follow-up">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Generate Modal */}
      <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate AI Follow-Up Email">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Select Client</label>
            <select onChange={e => { const c = clientList?.find(c => c.id === parseInt(e.target.value)); if (c) setForm(p => ({ ...p, clientName: c.name, clientEmail: c.email || "", service: c.service || "" })); }} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors">
              <option value="">— Or enter manually below —</option>
              {clientList?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Field label="Client Name *" value={form.clientName} onChange={v => setForm(p => ({ ...p, clientName: v }))} placeholder="Jane Smith" required />
          <Field label="Client Email" value={form.clientEmail} onChange={v => setForm(p => ({ ...p, clientEmail: v }))} placeholder="jane@example.com" type="email" />
          <Field label="Service / Context" value={form.service} onChange={v => setForm(p => ({ ...p, service: v }))} placeholder="Business coaching, web design..." />
          <Field label="Additional Context (optional)" value={form.context} onChange={v => setForm(p => ({ ...p, context: v }))} placeholder="Last session was about goal-setting, they struggled with time management..." textarea />
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email Tone</label>
            <div className="grid grid-cols-3 gap-2">
              {(["professional", "friendly", "motivational"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setForm(p => ({ ...p, tone: t }))}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border-2 transition-all capitalize ${form.tone === t ? "border-[#00C9A7] bg-[#00C9A7]/10 text-[#00C9A7]" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowGenerate(false)}>Cancel</Button>
            <Button className="flex-1 gradient-teal text-white border-0 hover:opacity-90 gap-2" onClick={() => generate.mutate(form)} disabled={generate.isPending}>
              {generate.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</> : <><Zap className="w-4 h-4" />Generate</>}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal open={!!previewFollowUp} onClose={() => setPreviewFollowUp(null)} title="Email Preview" wide>
        {previewFollowUp && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 w-12">To:</span>
                <span className="text-sm text-gray-700">{previewFollowUp.clientEmail || previewFollowUp.clientName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 w-12">Subject:</span>
                <span className="text-sm font-semibold text-[#1C1C1E]">{previewFollowUp.subject}</span>
              </div>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{previewFollowUp.body}</p>
            </div>
            <div className="flex gap-3">
              <Button className="flex-1 gradient-teal text-white border-0 hover:opacity-90 gap-2" onClick={() => copyToClipboard(previewFollowUp.body)}>
                {copied ? <><Check className="w-4 h-4" />Copied!</> : <><Copy className="w-4 h-4" />Copy Email</>}
              </Button>
              {previewFollowUp.status === "draft" && previewFollowUp.id && (
                <Button variant="outline" className="flex-1 gap-2" onClick={() => { markSent.mutate({ id: previewFollowUp.id }); setPreviewFollowUp(null); }}>
                  <Send className="w-4 h-4" />Mark Sent
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Analytics Panel ──────────────────────────────────────────────────────────
function AnalyticsPanel() {
  const { data: analytics, isLoading } = trpc.analytics.overview.useQuery(undefined, { retry: 2 });

  if (isLoading) return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      <div className="grid lg:grid-cols-2 gap-6">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64" />)}</div>
    </div>
  );

  const stats = [
    { label: "Total Revenue", value: formatCurrency(analytics?.totalRevenue || 0), icon: DollarSign, color: "#00C9A7" },
    { label: "Active Clients", value: String(analytics?.activeClients || 0), icon: Users, color: "#6366F1" },
    { label: "Sessions Booked", value: String((analytics?.completedSessions || 0) + (analytics?.completedSessions || 0)), icon: Calendar, color: "#F59E0B" },
    { label: "Conversion Rate", value: analytics?.totalClients ? `${Math.round((analytics.activeClients / analytics.totalClients) * 100)}%` : "0%", icon: TrendingUp, color: "#FF6B6B" },
  ];

  const pieData = [
    { name: "Active", value: analytics?.activeClients || 0, color: "#00C9A7" },
    { name: "Prospects", value: analytics?.totalClients || 0, color: "#6366F1" },
    { name: "Inactive", value: analytics?.activeClients || 0, color: "#E5E7EB" },
  ].filter(d => d.value > 0);

  const topServices = analytics?.topServices || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: "Sora, sans-serif" }}>Analytics</h2>
        <p className="text-sm text-gray-500">Your business performance at a glance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white mb-3" style={{ backgroundColor: s.color }}>
              <s.icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: "Sora, sans-serif" }}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <h3 className="font-bold text-[#1C1C1E] text-sm mb-4" style={{ fontFamily: "Sora, sans-serif" }}>Revenue Trend</h3>
          {analytics?.monthlyRevenue?.some(d => d.revenue > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={analytics.monthlyRevenue}>
                <defs>
                  <linearGradient id="tealGrad3" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00C9A7" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#00C9A7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: "12px" }} formatter={(v: number) => [formatCurrency(v), "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#00C9A7" strokeWidth={2.5} fill="url(#tealGrad3)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-gray-400">
              <DollarSign className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm text-center">Revenue data will appear once you create and mark invoices as paid.</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <h3 className="font-bold text-[#1C1C1E] text-sm mb-4" style={{ fontFamily: "Sora, sans-serif" }}>Client Breakdown</h3>
          {pieData.length > 0 ? (
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
                    <span className="text-sm font-bold text-[#1C1C1E] ml-auto pl-4">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-36 flex flex-col items-center justify-center text-gray-400">
              <Users className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Add clients to see breakdown.</p>
            </div>
          )}
        </div>

        {topServices.length > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 lg:col-span-2">
            <h3 className="font-bold text-[#1C1C1E] text-sm mb-4" style={{ fontFamily: "Sora, sans-serif" }}>Top Services by Revenue</h3>
            <div className="space-y-3">
              {topServices.slice(0, 5).map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-[#1C1C1E]">{s.service}</span>
                      <span className="text-sm font-bold text-[#00C9A7]">{formatCurrency(s.revenue)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#00C9A7] rounded-full" style={{ width: `${Math.min((s.revenue / topServices[0].revenue) * 100, 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────
function SettingsPanel() {
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const { data: settings, isLoading } = trpc.settings.get.useQuery(undefined, { retry: 1 });
  const [profile, setProfile] = useState({ name: "", bio: "", phone: "" });
  const [business, setBusiness] = useState({ businessName: "", businessPhone: "", businessAddress: "", businessWebsite: "" });
  const [bookingPage, setBookingPage] = useState({ bookingUsername: "", bookingBio: "", bookingServices: ["Coaching Session", "Strategy Call", "Consultation"] });
  const [notifications, setNotifications] = useState({ notifyNewBooking: true, notifyInvoicePaid: true, notifyNewLead: true });
  const [newService, setNewService] = useState("");

  useEffect(() => {
    if (settings) {
      setProfile({ name: settings.name || "", bio: settings.bio || "", phone: settings.phone || "" });
      setBusiness({ businessName: settings.businessName || "", businessPhone: settings.businessPhone || "", businessAddress: settings.businessAddress || "", businessWebsite: settings.businessWebsite || "" });
      setBookingPage({ bookingUsername: settings.bookingUsername || "", bookingBio: settings.bookingBio || "", bookingServices: settings.bookingServices || ["Coaching Session", "Strategy Call", "Consultation"] });
      setNotifications({ notifyNewBooking: settings.notifyNewBooking ?? true, notifyInvoicePaid: settings.notifyInvoicePaid ?? true, notifyNewLead: settings.notifyNewLead ?? true });
    }
  }, [settings]);

  const updateProfile = trpc.settings.updateProfile.useMutation({ onSuccess: () => { utils.settings.get.invalidate(); toast.success("Profile saved!"); }, onError: (e) => toast.error(e.message) });
  const updateBusiness = trpc.settings.updateBusiness.useMutation({ onSuccess: () => { utils.settings.get.invalidate(); toast.success("Business info saved!"); }, onError: (e) => toast.error(e.message) });
  const updateBookingPage = trpc.settings.updateBookingPage.useMutation({ onSuccess: () => { utils.settings.get.invalidate(); toast.success("Booking page saved!"); }, onError: (e) => toast.error(e.message) });
  const updateNotifications = trpc.settings.updateNotifications.useMutation({ onSuccess: () => { utils.settings.get.invalidate(); toast.success("Notification preferences saved!"); }, onError: (e) => toast.error(e.message) });

  if (isLoading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>;

  const bookingUrl = bookingPage.bookingUsername ? `${window.location.origin}/book/${bookingPage.bookingUsername}` : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: "Sora, sans-serif" }}>Settings</h2>
        <p className="text-sm text-gray-500">Manage your profile, business info, and preferences</p>
      </div>

      {/* Profile */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <h3 className="font-bold text-sm text-[#1C1C1E] flex items-center gap-2"><User className="w-4 h-4 text-[#00C9A7]" />Profile</h3>
        <Field label="Your Name" value={profile.name} onChange={v => setProfile(p => ({ ...p, name: v }))} placeholder="Alex Smith" />
        <Field label="Phone Number" value={profile.phone} onChange={v => setProfile(p => ({ ...p, phone: v }))} placeholder="+1 (555) 000-0000" />
        <Field label="Bio (shown on booking page)" value={profile.bio} onChange={v => setProfile(p => ({ ...p, bio: v }))} placeholder="I help entrepreneurs build scalable businesses..." textarea rows={3} />
        <Button className="gradient-teal text-white border-0 hover:opacity-90 gap-2" onClick={() => updateProfile.mutate(profile)} disabled={updateProfile.isPending}>
          {updateProfile.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Save Profile</>}
        </Button>
      </div>

      {/* Business */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <h3 className="font-bold text-sm text-[#1C1C1E] flex items-center gap-2"><Building className="w-4 h-4 text-[#00C9A7]" />Business Info</h3>
        <Field label="Business Name" value={business.businessName} onChange={v => setBusiness(p => ({ ...p, businessName: v }))} placeholder="My Coaching Studio" />
        <Field label="Business Phone" value={business.businessPhone} onChange={v => setBusiness(p => ({ ...p, businessPhone: v }))} placeholder="+1 (555) 000-0000" />
        <Field label="Business Address" value={business.businessAddress} onChange={v => setBusiness(p => ({ ...p, businessAddress: v }))} placeholder="123 Main St, New York, NY 10001" />
        <Field label="Website" value={business.businessWebsite} onChange={v => setBusiness(p => ({ ...p, businessWebsite: v }))} placeholder="https://yourwebsite.com" type="url" />
        <Button className="gradient-teal text-white border-0 hover:opacity-90 gap-2" onClick={() => updateBusiness.mutate(business)} disabled={updateBusiness.isPending}>
          {updateBusiness.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Save Business Info</>}
        </Button>
      </div>

      {/* Booking Page */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <h3 className="font-bold text-sm text-[#1C1C1E] flex items-center gap-2"><Globe className="w-4 h-4 text-[#00C9A7]" />Booking Page</h3>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Your Booking URL</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400 flex-shrink-0">{window.location.origin}/book/</span>
            <input
              value={bookingPage.bookingUsername}
              onChange={e => setBookingPage(p => ({ ...p, bookingUsername: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
              placeholder="your-name"
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors"
            />
          </div>
          {bookingUrl && (
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#00C9A7] hover:underline flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />Preview your booking page
              </a>
              <button
                onClick={() => { navigator.clipboard.writeText(bookingUrl).then(() => toast.success("Booking link copied to clipboard!")).catch(() => toast.error("Could not copy link")); }}
                className="text-xs text-gray-500 hover:text-[#00C9A7] flex items-center gap-1 transition-colors"
              >
                <Copy className="w-3 h-3" />Copy link
              </button>
            </div>
          )}
        </div>
        <Field label="Booking Page Bio" value={bookingPage.bookingBio} onChange={v => setBookingPage(p => ({ ...p, bookingBio: v }))} placeholder="Book a session with me..." textarea rows={2} />
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">Services Offered</label>
          <div className="space-y-2 mb-3">
            {bookingPage.bookingServices.map((s, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                <span className="text-sm flex-1">{s}</span>
                <button onClick={() => setBookingPage(p => ({ ...p, bookingServices: p.bookingServices.filter((_, j) => j !== i) }))} className="text-gray-400 hover:text-red-500 transition-colors" aria-label={`Remove ${s}`}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newService} onChange={e => setNewService(e.target.value)} placeholder="Add a service..." className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors" onKeyDown={e => { if (e.key === "Enter" && newService.trim()) { setBookingPage(p => ({ ...p, bookingServices: [...p.bookingServices, newService.trim()] })); setNewService(""); } }} />
            <Button size="sm" variant="outline" onClick={() => { if (newService.trim()) { setBookingPage(p => ({ ...p, bookingServices: [...p.bookingServices, newService.trim()] })); setNewService(""); } }}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <Button className="gradient-teal text-white border-0 hover:opacity-90 gap-2" onClick={() => updateBookingPage.mutate(bookingPage)} disabled={updateBookingPage.isPending}>
          {updateBookingPage.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Save Booking Page</>}
        </Button>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <h3 className="font-bold text-sm text-[#1C1C1E] flex items-center gap-2"><Bell className="w-4 h-4 text-[#00C9A7]" />Notifications</h3>
        {[
          { key: "notifyNewBooking" as const, label: "New Booking", desc: "Get notified when a client books a session" },
          { key: "notifyInvoicePaid" as const, label: "Invoice Paid", desc: "Get notified when an invoice is marked as paid" },
          { key: "notifyNewLead" as const, label: "New Lead", desc: "Get notified when someone joins the waitlist" },
        ].map(n => (
          <div key={n.key} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1C1C1E]">{n.label}</p>
              <p className="text-xs text-gray-400">{n.desc}</p>
            </div>
            <button
              onClick={() => setNotifications(p => ({ ...p, [n.key]: !p[n.key] }))}
              className={`w-11 h-6 rounded-full transition-colors relative ${notifications[n.key] ? "bg-[#00C9A7]" : "bg-gray-200"}`}
              aria-label={`${notifications[n.key] ? "Disable" : "Enable"} ${n.label} notifications`}
              role="switch"
              aria-checked={notifications[n.key]}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifications[n.key] ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
        ))}
        <Button className="gradient-teal text-white border-0 hover:opacity-90 gap-2" onClick={() => updateNotifications.mutate(notifications)} disabled={updateNotifications.isPending}>
          {updateNotifications.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Save Preferences</>}
        </Button>
      </div>

      {/* Subscription */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <h3 className="font-bold text-sm text-[#1C1C1E] flex items-center gap-2"><CreditCard className="w-4 h-4 text-[#00C9A7]" />Subscription</h3>
        <div className="flex items-center justify-between p-3 bg-[#00C9A7]/5 border border-[#00C9A7]/20 rounded-xl">
          <div>
            <p className="text-sm font-semibold text-[#1C1C1E] capitalize">{settings?.subscriptionStatus ?? "free"} Plan</p>
            <p className="text-xs text-gray-500">{settings?.subscriptionStatus === "active" ? "Active subscription" : "No active subscription"}</p>
          </div>
          <Badge className={`border-0 ${settings?.subscriptionStatus === "active" ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"}`}>
            {settings?.subscriptionStatus === "active" ? "Active" : "Free"}
          </Badge>
        </div>
        <Button className="w-full gradient-teal text-white border-0 hover:opacity-90" onClick={() => navigate("/billing")}>
          {settings?.subscriptionStatus === "active" ? "Manage Subscription" : "Upgrade to Pro — $99/month"}
        </Button>
      </div>
    </div>
  );
}

// ─── Mobile Bottom Nav ────────────────────────────────────────────────────────
function MobileBottomNav({ active, setActive }: { active: ActivePanel; setActive: (p: ActivePanel) => void }) {
  const mobileNavItems = [
    { icon: LayoutDashboard, label: "Home", panel: "overview" as ActivePanel },
    { icon: Users, label: "Clients", panel: "clients" as ActivePanel },
    { icon: Calendar, label: "Schedule", panel: "scheduling" as ActivePanel },
    { icon: FileText, label: "Invoices", panel: "invoices" as ActivePanel },
    { icon: Bot, label: "AI", panel: "ai" as ActivePanel },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#1C1C1E] border-t border-white/10 flex md:hidden" aria-label="Mobile navigation" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {mobileNavItems.map((item) => (
        <button
          key={item.panel}
          onClick={() => setActive(item.panel)}
          aria-label={item.label}
          aria-current={active === item.panel ? "page" : undefined}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 min-h-[56px] transition-colors ${active === item.panel ? "text-[#00C9A7]" : "text-gray-500 hover:text-gray-300"}`}
        >
          <item.icon className="w-5 h-5" aria-hidden="true" />
          <span className="text-[10px] font-medium">{item.label}</span>
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
  const [confirm, setConfirm] = useState<ConfirmState>(defaultConfirm);
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/");
  }, [loading, isAuthenticated, navigate]);

  if (loading) return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-[#00C9A7] animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Loading your dashboard...</p>
      </div>
    </div>
  );

  const panelTitles: Record<ActivePanel, string> = {
    overview: "Dashboard", clients: "Clients", scheduling: "Scheduling",
    invoices: "Invoices", followups: "Follow-Ups", analytics: "Analytics",
    settings: "Settings", ai: "AI Assistant", pulse: "Client Pulse",
  };

  const renderPanel = () => {
    switch (active) {
      case "overview": return <OverviewPanel userName={user?.name || ""} setActivePanel={setActive} />;
      case "clients": return <ClientsPanel />;
      case "scheduling": return <SchedulingPanel />;
      case "invoices": return <InvoicesPanel />;
      case "followups": return <FollowUpsPanel />;
      case "analytics": return <AnalyticsPanel />;
      case "settings": return <SettingsPanel />;
      case "ai": return <AIAssistant />;
      case "pulse": return <ClientPulsePanel />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex">
      {/* Skip link */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded-xl focus:shadow-lg focus:text-[#00C9A7] focus:font-semibold">
        Skip to main content
      </a>

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar active={active} setActive={setActive} collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      {/* Main Content */}
      <main
        id="main-content"
        className={`flex-1 transition-all duration-300 ${collapsed ? "md:ml-16" : "md:ml-60"} pb-20 md:pb-0`}
        tabIndex={-1}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile logo */}
            <div className="flex items-center gap-2 md:hidden">
              <div className="w-7 h-7 rounded-lg gradient-teal flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-[#1C1C1E] text-sm" style={{ fontFamily: "Sora, sans-serif" }}>SkillBridge</span>
            </div>
            <h1 className="hidden md:block text-base font-bold text-[#1C1C1E]" style={{ fontFamily: "Sora, sans-serif" }}>
              {panelTitles[active]}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative hidden lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Quick search..."
                className="pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors w-48"
                aria-label="Quick search"
              />
            </div>

            {/* Health Monitor */}
            <HealthMonitor />
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors"
                aria-label="Notifications"
                aria-expanded={showNotifications}
              >
                <Bell className="w-4 h-4 text-gray-500" />
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 p-4">
                  <p className="text-sm font-bold text-[#1C1C1E] mb-2">Notifications</p>
                  <p className="text-xs text-gray-400 text-center py-4">No new notifications</p>
                </div>
              )}
            </div>

            {/* User Avatar */}
            <div className="w-8 h-8 rounded-full gradient-teal flex items-center justify-center text-white text-xs font-bold" aria-label={`Logged in as ${user?.name || "User"}`}>
              {user?.name?.slice(0, 2).toUpperCase() || "U"}
            </div>
          </div>
        </header>

        {/* Panel Content */}
        <div className="p-4 md:p-6 max-w-6xl mx-auto">
          {renderPanel()}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <MobileBottomNav active={active} setActive={setActive} />
      {/* Global Confirm Dialog */}
      <ConfirmDialog
        open={confirm.open}
        onOpenChange={(open) => !open && setConfirm(defaultConfirm)}
        title={confirm.title}
        description={confirm.description}
        onConfirm={() => { confirm.onConfirm(); setConfirm(defaultConfirm); }}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  );
}
