/* TrueAxis HQ — Full Dashboard (DB-backed)
 * All panels connected to real tRPC/database procedures
 * Design: "Kinetic Warmth" — Dark sidebar (#1C1C1E), Teal (#E8A020), Coral (#FF6B6B)
 */

import { useState, useEffect, useRef } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import ClientPulsePanel from "./ClientPulse";
import TimeTrackingPanel from "./TimeTracking";
import RecurringInvoicesPanel from "./RecurringInvoices";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AIAssistant from "@/components/AIAssistant";
import { HealthMonitor } from "@/components/HealthMonitor";
import {
  LayoutDashboard, Users, Calendar, FileText, Mail,
  BarChart3, Settings, Zap, Plus, TrendingUp,
  DollarSign, Clock, CheckCircle, ArrowUpRight,
  ChevronRight, LogOut, X, Edit2, Trash2, Send,
  Download, Phone, AlertCircle, RefreshCw, User,
  Building, Save, Bot, CreditCard,
  ExternalLink, Bell, Search, ChevronDown, Loader2,
  Globe, ToggleLeft, ToggleRight, Printer, Eye, EyeOff,
  Copy, Check, Star, Activity, HeartPulse, MoreHorizontal, Camera, FileSignature, Sparkles, Upload,
  Home
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
  PieChart, Pie, Cell
} from "recharts";

type ActivePanel = "overview" | "clients" | "scheduling" | "invoices" | "followups" | "analytics" | "settings" | "ai" | "pulse" | "contracts" | "time" | "recurring";

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
          <h2 className="font-bold text-[#1C1C1E] text-base" style={{ fontFamily: "Space Grotesk, sans-serif" }}>{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Close dialog">
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
// ─── Input Field ─────────────────────────────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = "text", required, textarea, rows = 3, autoComplete, enterKeyHint }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean; textarea?: boolean; rows?: number;
  autoComplete?: string; enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
}) {
  const cls = "form-input-light";
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}{required && " *"}</label>
      {textarea
        ? <textarea
            value={value}
            onChange={e => { onChange(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
            placeholder={placeholder}
            rows={rows}
            className={`${cls} resize-none overflow-hidden`}
            style={{ minHeight: `${(rows ?? 3) * 1.6}rem` }}
            enterKeyHint={enterKeyHint}
            autoComplete={autoComplete}
          />
        : <input
            type={type === "number" ? "text" : type}
            inputMode={type === "number" ? "decimal" : type === "email" ? "email" : type === "tel" ? "tel" : type === "url" ? "url" : undefined}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className={cls}
            autoComplete={autoComplete}
            enterKeyHint={enterKeyHint}
          />
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
  { icon: FileSignature, label: "Contracts", panel: "contracts" },
  { icon: Clock, label: "Time Tracking", panel: "time" },
  { icon: RefreshCw, label: "Recurring", panel: "recurring" },
  { icon: BarChart3, label: "Analytics", panel: "analytics" },
  { icon: Settings, label: "Settings", panel: "settings" },
  { icon: Bot, label: "AI Assistant", panel: "ai" },
];

function Sidebar({ active, setActive, collapsed, setCollapsed }: {
  active: ActivePanel; setActive: (p: ActivePanel) => void;
  collapsed: boolean; setCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
}) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { data: settings } = trpc.settings.get.useQuery(undefined, { retry: 1 });

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-[#1C1C1E] flex flex-col transition-all duration-300 z-40 ${collapsed ? "w-16" : "w-60"}`}
      aria-label="Main navigation"
    >
      {/* Logo — click navigates to dashboard */}
      <div className="flex items-center justify-center px-3 py-4 border-b border-white/10">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center justify-center"
          aria-label="Go to dashboard"
          title="Dashboard"
          style={{ background: "none", border: "none", minHeight: "auto", minWidth: "auto", padding: 0 }}
        >
          {collapsed ? (
            <div className="w-8 h-8 rounded-lg overflow-hidden">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/logo-r1_d9d437c8.png"
                alt="TrueAxis HQ — Dashboard"
                className="w-full h-full object-cover object-left"
              />
            </div>
          ) : (
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/logo-r1_d9d437c8.png"
              alt="TrueAxis HQ — Dashboard"
              className="h-9 w-auto object-contain"
            />
          )}
        </button>
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
              active === item.panel ? "bg-[#E8A020]/15 text-[#E8A020]" : "text-gray-600 hover:bg-white/5 hover:text-white"
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
          <div className="bg-[#E8A020]/10 border border-[#E8A020]/20 rounded-xl p-3 mb-2">
            <p className="text-xs font-semibold text-[#E8A020] mb-0.5 capitalize">{settings.planId || "Pro"} Plan</p>
            <p className="text-xs text-gray-600">Active subscription</p>
          </div>
        )}
        {!collapsed && (!settings?.subscriptionStatus || settings.subscriptionStatus === "inactive") && (
          <button
            onClick={() => navigate("/pricing")}
            className="w-full bg-gradient-to-r from-[#E8A020] to-[#D4911A] text-white text-xs font-semibold px-3 py-2 rounded-xl mb-2 hover:opacity-90 transition-opacity"
          >
            Upgrade to Pro →
          </button>
        )}
        <button onClick={() => navigate("/billing")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-white/5 hover:text-white transition-all" aria-label="Billing">
          <CreditCard className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Billing</span>}
        </button>
        {user?.role === "admin" && (
          <button onClick={() => navigate("/admin")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-white/5 hover:text-white transition-all" aria-label="Admin panel">
            <Star className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Admin Panel</span>}
          </button>
        )}
        <button
          onClick={() => navigate("/")}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-white/5 hover:text-white transition-all"
          aria-label="Go to home page"
          title="Home"
        >
          <Home className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Home</span>}
        </button>
        {/* Collapse / Expand toggle */}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-white/5 hover:text-white transition-all"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform duration-300 ${collapsed ? "" : "rotate-180"}`} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

// ─── Changelog Modal ─────────────────────────────────────────────────────────
const CHANGELOG_VERSION = "1.4.0";
const CHANGELOG_KEY = `trueaxis_changelog_${CHANGELOG_VERSION}`;

function ChangelogModal() {
  const [open, setOpen] = useState(() => !localStorage.getItem(CHANGELOG_KEY));
  const dismiss = () => { localStorage.setItem(CHANGELOG_KEY, "1"); setOpen(false); };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="What's new">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={dismiss} aria-hidden="true" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="font-extrabold text-[#1C1C1E] text-base" style={{ fontFamily: "Space Grotesk, sans-serif" }}>What's New in v{CHANGELOG_VERSION} 🎉</h2>
            <p className="text-xs text-gray-600 mt-0.5">TrueAxis HQ — Latest Updates</p>
          </div>
          <button onClick={dismiss} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Close">
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {([
            { emoji: "🔔", title: "Live Notifications", desc: "Real-time bell with unread badge — never miss an important event." },
            { emoji: "⏱", title: "Time Tracking", desc: "Start/stop timer, log billable hours, and see summary stats per client." },
            { emoji: "🔁", title: "Recurring Invoices", desc: "Set weekly, monthly, or custom billing schedules — invoices generate automatically." },
            { emoji: "📄", title: "Contracts & Proposals", desc: "Write, send, and convert proposals to invoices with one click." },
            { emoji: "🌐", title: "Client Portal", desc: "Clients can view their invoices and bookings via a secure token link." },
            { emoji: "📅", title: "iCal Export", desc: "Share your booking calendar with any calendar app via a live iCal feed." },
            { emoji: "💳", title: "Stripe Pay Now", desc: "Clients can pay invoices instantly — webhooks auto-mark them paid." },
            { emoji: "🤖", title: "Background Automation", desc: "Overdue detection and recurring invoice generation run every 5 minutes, hands-free." },
          ] as { emoji: string; title: string; desc: string }[]).map(item => (
            <div key={item.title} className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0">{item.emoji}</span>
              <div>
                <p className="text-sm font-bold text-[#1C1C1E]">{item.title}</p>
                <p className="text-xs text-gray-600 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 pb-5">
          <button
            onClick={dismiss}
            className="w-full gradient-amber text-white font-semibold py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity"
          >
            Got it, let's go! 🚀
          </button>
        </div>
      </div>
    </div>
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
    { label: "Total Revenue", value: formatCurrency(analytics?.totalRevenue || 0), change: "+12% this month", icon: DollarSign, color: "#E8A020" },
    { label: "Active Clients", value: String(analytics?.activeClients || 0), change: `${analytics?.totalClients || 0} total`, icon: Users, color: "#6366F1" },
    { label: "Sessions Completed", value: String(analytics?.completedSessions || 0), change: `${analytics?.upcomingSessions || 0} upcoming`, icon: CheckCircle, color: "#F59E0B" },
    { label: "Outstanding", value: formatCurrency(analytics?.outstanding || 0), change: "Awaiting payment", icon: Clock, color: "#FF6B6B" },
  ];

  const monthlyData = analytics?.monthlyRevenue || [];
  const clientGrowthData = analytics?.clientGrowth || [];

  return (
    <div className="space-y-6">
      <ChangelogModal />
      <div>
        <h1 className="text-2xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
          {getGreeting()}, {userName || "there"} 👋
        </h1>
        <p className="text-sm text-gray-600 mt-1">Here's what's happening with your business today.</p>
      </div>
      <OnboardingChecklist onNavigate={(panel) => setActivePanel(panel as ActivePanel)} />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 card-lift">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: s.color }}>
                <s.icon className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500" aria-hidden="true" />
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-[#1C1C1E] leading-tight" style={{ fontFamily: "Space Grotesk, sans-serif" }}>{s.value}</p>
            <p className="text-[11px] sm:text-xs text-gray-600 mt-0.5 leading-snug">{s.label}</p>
            <p className="text-[11px] sm:text-xs font-medium mt-1" style={{ color: s.color }}>{s.change}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {([
          { icon: Plus, label: "Add Client", color: "#6366F1", panel: "clients" },
          { icon: Calendar, label: "New Booking", color: "#F59E0B", panel: "scheduling" },
          { icon: FileText, label: "New Invoice", color: "#E8A020", panel: "invoices" },
          { icon: Mail, label: "AI Follow-Up", color: "#5A9A7A", panel: "followups" },
        ] as { icon: React.ElementType; label: string; color: string; panel: ActivePanel }[]).map(({ icon: Icon, label, color, panel }) => (
          <button
            key={label}
            onClick={() => setActivePanel(panel)}
            className="bg-white rounded-2xl p-3 sm:p-4 border border-gray-100 card-lift flex flex-col items-center gap-1.5 sm:gap-2 text-center hover:border-[#E8A020]/30 transition-all group"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-white transition-transform group-hover:scale-110" style={{ backgroundColor: color }}>
              <Icon className="w-4 h-4" aria-hidden="true" />
            </div>
            <span className="text-[11px] sm:text-xs font-semibold text-[#1C1C1E] leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <h3 className="font-bold text-[#1C1C1E] text-sm mb-4" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Revenue (Last 6 Months)</h3>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E8A020" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#E8A020" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: "12px" }} formatter={(v: number) => [formatCurrency(v), "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#E8A020" strokeWidth={2.5} fill="url(#amberGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-gray-600">
              <Activity className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">Revenue data will appear once you create paid invoices.</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <h3 className="font-bold text-[#1C1C1E] text-sm mb-4" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Client Growth</h3>
          {clientGrowthData.some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={clientGrowthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: "12px" }} />
                <Bar dataKey="count" fill="#E8A020" radius={[6, 6, 0, 0]} name="New Clients" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-gray-600">
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
                <HeartPulse className="w-4 h-4 text-[#E8A020]" />
                <h3 className="font-bold text-sm text-[#1C1C1E]" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Client Pulse</h3>
                <span className="text-xs bg-[#E8A020]/10 text-[#E8A020] font-semibold px-2 py-0.5 rounded-full">AI</span>
              </div>
              <button onClick={() => setActivePanel("pulse")} className="text-xs text-[#E8A020] hover:underline font-medium flex items-center gap-1">
                View All <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-2xl font-extrabold" style={{ fontFamily: "Space Grotesk, sans-serif", color: avgScore !== null ? (avgScore >= 70 ? "#E8A020" : avgScore >= 40 ? "#F59E0B" : "#FF6B6B") : "#9CA3AF" }}>{avgScore ?? "—"}</p>
                <p className="text-xs text-gray-600 mt-0.5">Avg Health</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-xl">
                <p className="text-2xl font-extrabold text-[#FF6B6B]" style={{ fontFamily: "Space Grotesk, sans-serif" }}>{churnRisk}</p>
                <p className="text-xs text-gray-600 mt-0.5">Churn Risk</p>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-xl">
                <p className="text-2xl font-extrabold text-yellow-600" style={{ fontFamily: "Space Grotesk, sans-serif" }}>{goingSilent}</p>
                <p className="text-xs text-gray-600 mt-0.5">Going Silent</p>
              </div>
              <div className="text-center p-3 bg-[#E8A020]/10 rounded-xl">
                <p className="text-2xl font-extrabold text-[#E8A020]" style={{ fontFamily: "Space Grotesk, sans-serif" }}>{upsellReady}</p>
                <p className="text-xs text-gray-600 mt-0.5">Upsell Ready</p>
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
            <h3 className="font-bold text-sm text-[#1C1C1E]" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Recent Clients</h3>
            <span className="text-xs text-[#E8A020] font-medium">{recentClients?.length || 0} total</span>
          </div>
          {!recentClients || recentClients.length === 0 ? (
            <div className="py-10 text-center text-gray-600">
              <Users className="w-7 h-7 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No clients yet. Add your first client!</p>
            </div>
          ) : recentClients.slice(0, 5).map(c => (
            <div key={c.id} className="flex items-center gap-3 px-5 py-3 border-t border-gray-50 hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 rounded-full gradient-amber flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {c.avatarInitials || c.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1C1C1E] truncate">{c.name}</p>
                <p className="text-xs text-gray-600 truncate">{c.service || "General Client"}</p>
              </div>
              <Badge className={`text-xs border-0 ${c.status === "active" ? "bg-green-50 text-green-600" : c.status === "prospect" ? "bg-yellow-50 text-yellow-600" : "bg-gray-100 text-gray-600"}`}>
                {c.status}
              </Badge>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h3 className="font-bold text-sm text-[#1C1C1E]" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Upcoming Sessions</h3>
            <span className="text-xs text-[#E8A020] font-medium">{recentBookings?.length || 0} scheduled</span>
          </div>
          {!recentBookings || recentBookings.length === 0 ? (
            <div className="py-10 text-center text-gray-600">
              <Calendar className="w-7 h-7 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No upcoming sessions. Create a booking!</p>
            </div>
          ) : recentBookings.slice(0, 5).map(b => (
            <div key={b.id} className="flex items-center gap-3 px-5 py-3 border-t border-gray-50 hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 rounded-xl bg-[#E8A020]/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-[#E8A020]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1C1C1E] truncate">{b.clientName}</p>
                <p className="text-xs text-gray-600">{b.date} at {b.time}</p>
              </div>
              <span className="text-xs text-gray-600">{b.duration}m</span>
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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "prospect">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", service: "", status: "active" as "active" | "inactive" | "prospect", notes: "" });
  const [clientConfirm, setClientConfirm] = useState<ConfirmState>(defaultConfirm);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState<Array<{ name: string; email: string; phone: string; service: string; status: string }>>([]);

  // Read search from header quick-search on mount
  useEffect(() => {
    const stored = sessionStorage.getItem("dashboardSearch");
    if (stored) {
      setSearch(stored);
      setDebouncedSearch(stored);
      sessionStorage.removeItem("dashboardSearch");
    }
  }, []);

  // Debounce search to prevent excessive API calls
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: clientList, isLoading } = trpc.clients.list.useQuery({ search: debouncedSearch, status: statusFilter });
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
  const importCsv = trpc.clients.importCsv.useMutation({
    onSuccess: (data) => { utils.clients.list.invalidate(); toast.success(`Imported ${data.imported} clients${data.skipped ? `, skipped ${data.skipped}` : ""}.`); setShowCsvImport(false); setCsvText(""); setCsvPreview([]); },
    onError: (e) => toast.error(e.message),
  });

  function exportClientsCSV() {
    if (!clientList || clientList.length === 0) { toast.info("No clients to export."); return; }
    const headers = ["Name", "Email", "Phone", "Service", "Status", "Pulse Score", "Last Activity"];
    const rows = clientList.map(c => {
      const pulse = pulseMap.get(c.id);
      return [
        c.name, c.email || "", c.phone || "", c.service || "",
        c.status, pulse?.healthScore ?? "",
        (c as any).lastActivity ? new Date((c as any).lastActivity).toLocaleDateString() : ""
      ];
    });
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `clients-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Clients exported!");
  }



  const parseCsv = (text: string) => {
    const lines = text.trim().split("\n").filter(l => l.trim());
    if (lines.length === 0) return;
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/["']/g, ""));
    const nameIdx = headers.findIndex(h => h.includes("name"));
    const emailIdx = headers.findIndex(h => h.includes("email"));
    const phoneIdx = headers.findIndex(h => h.includes("phone") || h.includes("tel"));
    const serviceIdx = headers.findIndex(h => h.includes("service") || h.includes("niche") || h.includes("type"));
    const statusIdx = headers.findIndex(h => h.includes("status"));
    const dataLines = nameIdx >= 0 ? lines.slice(1) : lines;
    const rows = dataLines.slice(0, 500).map(line => {
      const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
      return {
        name: nameIdx >= 0 ? cols[nameIdx] || "" : cols[0] || "",
        email: emailIdx >= 0 ? cols[emailIdx] || "" : cols[1] || "",
        phone: phoneIdx >= 0 ? cols[phoneIdx] || "" : cols[2] || "",
        service: serviceIdx >= 0 ? cols[serviceIdx] || "" : cols[3] || "",
        status: statusIdx >= 0 ? cols[statusIdx] || "active" : "active",
      };
    }).filter(r => r.name.trim());
    setCsvPreview(rows);
  };

  const { data: clientDocs, refetch: refetchDocs } = trpc.documents.list.useQuery(
    { clientId: selectedId! },
    { enabled: !!selectedId }
  );
  const saveDoc = trpc.documents.save.useMutation({
    onSuccess: () => { refetchDocs(); toast.success("Document uploaded!"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteDoc = trpc.documents.delete.useMutation({
    onSuccess: () => { refetchDocs(); toast.success("Document removed."); },
    onError: (e) => toast.error(e.message),
  });
  const [docUploading, setDocUploading] = useState(false);

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("File must be under 20 MB."); return; }
    setDocUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/document", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Upload failed"); }
      const data = await res.json();
      await saveDoc.mutateAsync({ clientId: selectedId, fileName: data.fileName, fileKey: data.fileKey, fileUrl: data.fileUrl, mimeType: data.mimeType, sizeBytes: data.sizeBytes });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setDocUploading(false);
      e.target.value = "";
    }
  };

  const getPortalToken = trpc.portal.getToken.useMutation({
    onSuccess: (data) => {
      navigator.clipboard.writeText(data.url)
        .then(() => toast.success("Portal link copied to clipboard!"))
        .catch(() => toast.info(`Portal link: ${data.url}`));
    },
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
          <h2 className="text-xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Clients</h2>
          <p className="text-sm text-gray-600">{clientList?.length || 0} clients in your roster</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={exportClientsCSV} title="Export clients as CSV">
            <Download className="w-3.5 h-3.5" />Export CSV
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowCsvImport(true)}>
            <Upload className="w-3.5 h-3.5" />Import CSV
          </Button>
          <Button size="sm" className="gradient-amber text-white border-0 hover:opacity-90 gap-1.5" onClick={() => setShowAdd(true)}>
            <Plus className="w-3.5 h-3.5" />Add Client
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients by name, email, or service..."
            className="form-input-light pl-9"
            aria-label="Search clients"
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
          className="form-input-light"
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
        <div className="hidden sm:grid grid-cols-4 gap-4 px-5 py-3 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide">
          <span className="col-span-2">Client</span>
          <span>Service</span>
          <span>Status</span>
        </div>
        {isLoading ? (
          <div className="space-y-px">
            {[...Array(4)].map((_, i) => <div key={i} className="px-5 py-4 border-t border-gray-50"><Skeleton className="h-10" /></div>)}
          </div>
        ) : !clientList || clientList.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium text-gray-600">No clients found</p>
            <p className="text-xs mt-1">{search ? "Try adjusting your search." : "Add your first client to get started."}</p>
          </div>
        ) : clientList.map(c => (
          <div
            key={c.id}
            className="flex sm:grid sm:grid-cols-4 gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 border-t border-gray-50 hover:bg-gray-50 transition-colors items-center cursor-pointer"
            onClick={() => setSelectedId(c.id)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === "Enter" && setSelectedId(c.id)}
            aria-label={`View ${c.name}'s profile`}
          >
            <div className="col-span-2 flex items-center gap-3 min-w-0 flex-1 sm:flex-none">
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full gradient-amber flex items-center justify-center text-white text-xs font-bold">
                  {c.avatarInitials || c.name.slice(0, 2).toUpperCase()}
                </div>
                {(() => {
                  const p = pulseMap.get(c.id);
                  if (!p) return null;
                  const score = p.healthScore;
                  const isGood = score >= 70;
                  const isMid = score >= 40;
                  const bg = isGood ? "#22c55e" : isMid ? "#f59e0b" : "#ef4444";
                  const label = isGood ? "Healthy" : isMid ? "Needs attention" : "At risk";
                  return (
                    <span
                      title={`Client Pulse: ${score}/100 — ${label}`}
                      className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] px-0.5 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-extrabold text-white leading-none"
                      style={{ backgroundColor: bg }}
                    >
                      {score}
                    </span>
                  );
                })()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1C1C1E] truncate">{c.name}</p>
                <p className="text-xs text-gray-600 truncate">
                  {c.email || "No email"}
                  {(c as any).lastActivity && (
                    <span className="ml-2 text-gray-500">· last seen {new Date((c as any).lastActivity).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  )}
                </p>
              </div>
            </div>
            <p className="hidden sm:block text-sm text-gray-600 truncate">{c.service || "—"}</p>
            <div className="flex items-center justify-between ml-auto sm:ml-0 flex-shrink-0 gap-2">
              <Badge className={`text-xs border-0 ${c.status === "active" ? "bg-green-50 text-green-600" : c.status === "prospect" ? "bg-yellow-50 text-yellow-600" : "bg-gray-100 text-gray-600"}`}>
                {c.status}
              </Badge>
              <button
                onClick={e => { e.stopPropagation(); setClientConfirm({ open: true, title: "Remove Client?", description: `Remove ${c.name} from your clients? This cannot be undone.`, onConfirm: () => deleteClient.mutate({ id: c.id }) }); }}
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors"
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
          <Field label="Full Name" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="Jane Smith" required autoComplete="name" enterKeyHint="next" />
          <Field label="Email Address" value={form.email} onChange={v => setForm(p => ({ ...p, email: v }))} placeholder="jane@example.com" type="email" autoComplete="email" enterKeyHint="next" />
          <Field label="Phone Number" value={form.phone} onChange={v => setForm(p => ({ ...p, phone: v }))} placeholder="+1 (555) 000-0000" type="tel" autoComplete="tel" enterKeyHint="next" />
          <Field label="Service / Niche" value={form.service} onChange={v => setForm(p => ({ ...p, service: v }))} placeholder="Business Coaching, Web Design..." autoComplete="off" enterKeyHint="next" />
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as typeof form.status }))} className="form-input-light">
              <option value="active">Active</option>
              <option value="prospect">Prospect / Lead</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <Field label="Notes" value={form.notes} onChange={v => setForm(p => ({ ...p, notes: v }))} placeholder="Any important notes about this client..." textarea rows={3} />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="flex-1 gradient-amber text-white border-0 hover:opacity-90" onClick={handleCreate} disabled={createClient.isPending}>
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
              <div className="w-14 h-14 rounded-2xl gradient-amber flex items-center justify-center text-white text-lg font-bold">
                {selectedClient.avatarInitials || selectedClient.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1C1C1E]">{selectedClient.name}</h3>
                <p className="text-sm text-gray-600">{selectedClient.service || "General Client"}</p>
                <Badge className={`text-xs border-0 mt-1 ${selectedClient.status === "active" ? "bg-green-50 text-green-600" : selectedClient.status === "prospect" ? "bg-yellow-50 text-yellow-600" : "bg-gray-100 text-gray-600"}`}>
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
                    <Icon className="w-3.5 h-3.5 text-gray-600" />
                    <p className="text-xs text-gray-600">{label}</p>
                  </div>
                  <p className="text-sm font-semibold text-[#1C1C1E] truncate">{value}</p>
                </div>
              ))}
            </div>
            {selectedClient.notes && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-600 mb-1">Notes</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedClient.notes}</p>
              </div>
            )}
            {/* Document Storage */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-600">Documents ({clientDocs?.length || 0})</p>
                <label className={`text-xs font-semibold cursor-pointer px-3 py-1.5 rounded-lg transition-colors ${docUploading ? 'opacity-50 pointer-events-none' : 'bg-[#E8A020]/10 text-[#E8A020] hover:bg-[#E8A020]/20'}`}>
                  {docUploading ? 'Uploading...' : '+ Upload'}
                  <input type="file" className="sr-only" onChange={handleDocUpload} disabled={docUploading} accept="*/*" />
                </label>
              </div>
              {!clientDocs || clientDocs.length === 0 ? (
                <p className="text-xs text-gray-600 text-center py-3">No documents yet. Upload contracts, briefs, or any files.</p>
              ) : (
                <div className="space-y-2">
                  {clientDocs.map(doc => (
                    <div key={doc.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-100">
                      <FileText className="w-3.5 h-3.5 text-[#E8A020] flex-shrink-0" />
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-xs font-medium text-[#1C1C1E] truncate hover:underline">{doc.fileName}</a>
                      {doc.sizeBytes && <span className="text-[10px] text-gray-600 flex-shrink-0">{(doc.sizeBytes / 1024).toFixed(0)} KB</span>}
                      <button onClick={() => deleteDoc.mutate({ id: doc.id })} className="p-1 rounded hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors flex-shrink-0" aria-label="Delete document">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3 flex-wrap">
              <Button
                className="flex-1 gradient-amber text-white border-0 hover:opacity-90 gap-2"
                onClick={() => { updateClient.mutate({ id: selectedClient.id, status: "active" }); }}
                disabled={updateClient.isPending}
              >
                <CheckCircle className="w-4 h-4" />Mark Active
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2 border-blue-200 text-blue-600 hover:bg-blue-50"
                onClick={() => getPortalToken.mutate({ clientId: selectedClient.id, origin: window.location.origin })}
                disabled={getPortalToken.isPending}
              >
                <ExternalLink className="w-4 h-4" />{getPortalToken.isPending ? "Generating..." : "Share Portal"}
              </Button>
              <Button variant="outline" className="gap-2 border-red-200 text-red-500 hover:bg-red-50" onClick={() => setClientConfirm({ open: true, title: "Remove Client?", description: `Remove ${selectedClient.name}? This cannot be undone.`, onConfirm: () => { deleteClient.mutate({ id: selectedClient.id }); setSelectedId(null); } })}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={clientConfirm.open}
        onOpenChange={(open) => !open && setClientConfirm(defaultConfirm)}
        title={clientConfirm.title}
        description={clientConfirm.description}
        onConfirm={() => { clientConfirm.onConfirm(); setClientConfirm(defaultConfirm); }}
        confirmLabel="Remove"
        variant="destructive"
      />

      {/* CSV Import Modal */}
      <Modal open={showCsvImport} onClose={() => { setShowCsvImport(false); setCsvText(""); setCsvPreview([]); }} title="Import Clients from CSV">
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            <strong>Expected columns:</strong> name, email, phone, service, status (active/inactive/prospect). First row can be a header row.
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Paste CSV content</label>
            <textarea
              value={csvText}
              onChange={e => { setCsvText(e.target.value); parseCsv(e.target.value); }}
              placeholder={`name,email,phone,service\nJane Smith,jane@example.com,+1555000,Coaching\nJohn Doe,john@example.com,,Web Design`}
              rows={6}
              className="form-input-light resize-none font-mono text-xs"
            />
          </div>
          {csvPreview.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">{csvPreview.length} client{csvPreview.length > 1 ? "s" : ""} detected — preview (first 5):</p>
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                {csvPreview.slice(0, 5).map((row, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 border-t border-gray-50 first:border-t-0 text-xs">
                    <div className="w-6 h-6 rounded-full gradient-amber flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                      {row.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#1C1C1E] truncate">{row.name}</p>
                      <p className="text-gray-600 truncate">{row.email || "No email"}</p>
                    </div>
                    <span className="text-gray-600">{row.service || "—"}</span>
                  </div>
                ))}
                {csvPreview.length > 5 && <div className="px-3 py-2 text-xs text-gray-600 border-t border-gray-50">+{csvPreview.length - 5} more...</div>}
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => { setShowCsvImport(false); setCsvText(""); setCsvPreview([]); }}>Cancel</Button>
            <Button
              className="flex-1 gradient-amber text-white border-0 hover:opacity-90"
              onClick={() => importCsv.mutate({ rows: csvPreview.map(r => ({ name: r.name, email: r.email || undefined, phone: r.phone || undefined, service: r.service || undefined, status: (r.status as any) || "active" })) })}
              disabled={csvPreview.length === 0 || importCsv.isPending}
            >
              {importCsv.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : `Import ${csvPreview.length} Client${csvPreview.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Scheduling Panel ─────────────────────────────────────────────────────────
function SchedulingPanel() {
  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ clientName: "", clientEmail: "", service: "", date: "", time: "", duration: 60, notes: "" });
  const [schedConfirm, setSchedConfirm] = useState<ConfirmState>(defaultConfirm);
  const [smartSuggestions, setSmartSuggestions] = useState<{ date: string; time: string; reason: string }[]>([]);

  const smartSchedule = trpc.ai.smartSchedule.useMutation({
    onSuccess: (data) => {
      setSmartSuggestions(data.suggestions);
      if (data.suggestions.length > 0) toast.success("AI found 3 optimal time slots!");
      else toast.info("No suggestions available. Please enter a date manually.");
    },
    onError: () => toast.error("AI scheduling unavailable. Please set a date manually."),
  });

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
    no_show: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Scheduling</h2>
          <p className="text-sm text-gray-600">{bookingList?.filter(b => b.status === "scheduled").length || 0} upcoming sessions</p>
        </div>
        <Button size="sm" className="gradient-amber text-white border-0 hover:opacity-90 gap-1.5" onClick={() => setShowAdd(true)}>
          <Plus className="w-3.5 h-3.5" />New Booking
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="hidden sm:grid grid-cols-5 gap-4 px-5 py-3 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide">
          <span className="col-span-2">Client / Service</span>
          <span>Date & Time</span>
          <span>Duration</span>
          <span>Status</span>
        </div>
        {isLoading ? (
          <div className="space-y-px">{[...Array(3)].map((_, i) => <div key={i} className="px-5 py-4 border-t border-gray-50"><Skeleton className="h-10" /></div>)}</div>
        ) : !bookingList || bookingList.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium text-gray-600">No bookings yet</p>
            <p className="text-xs mt-1">Create your first booking or share your booking page with clients.</p>
          </div>
        ) : bookingList.map(b => (
          <div key={b.id} className="flex flex-col sm:grid sm:grid-cols-5 gap-2 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 border-t border-gray-50 hover:bg-gray-50 transition-colors">
            <div className="sm:col-span-2">
              <p className="text-sm font-semibold text-[#1C1C1E]">{b.clientName}</p>
              <p className="text-xs text-gray-600">{b.service || "General Session"}</p>
              {/* Mobile-only: show date/time inline */}
              <div className="flex items-center gap-2 mt-0.5 sm:hidden">
                <span className="text-xs text-gray-600">{b.date} · {b.time}</span>
                <span className="text-xs text-gray-600">{b.duration}m</span>
              </div>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-[#1C1C1E]">{b.date}</p>
              <p className="text-xs text-gray-600">{b.time}</p>
            </div>
            <p className="hidden sm:block text-sm text-gray-600">{b.duration} min</p>
            <div className="flex items-center justify-between">
              <select
                value={b.status}
                onChange={e => updateStatus.mutate({ id: b.id, status: e.target.value as any })}
                className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${statusColor[b.status] || "bg-gray-100 text-gray-600"}`}
                aria-label="Update booking status"
              >
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
              </select>
              <button onClick={() => setSchedConfirm({ open: true, title: "Remove Booking?", description: "Remove this booking? This cannot be undone.", onConfirm: () => deleteBooking.mutate({ id: b.id }) })} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors ml-2" aria-label="Delete booking">
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
              className="form-input-light"
            >
              <option value="">— Or enter manually below —</option>
              {clientList?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Field label="Client Name" value={form.clientName} onChange={v => setForm(p => ({ ...p, clientName: v }))} placeholder="Jane Smith" required autoComplete="name" enterKeyHint="next" />
          <Field label="Client Email" value={form.clientEmail} onChange={v => setForm(p => ({ ...p, clientEmail: v }))} placeholder="jane@example.com" type="email" autoComplete="email" enterKeyHint="next" />
          <Field label="Service" value={form.service} onChange={v => setForm(p => ({ ...p, service: v }))} placeholder="Strategy Session, Coaching Call..." autoComplete="off" enterKeyHint="next" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date *" value={form.date} onChange={v => setForm(p => ({ ...p, date: v }))} placeholder="2026-03-20" type="date" required />
            <Field label="Time *" value={form.time} onChange={v => setForm(p => ({ ...p, time: v }))} placeholder="14:00" type="time" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Duration (minutes)</label>
            <select value={form.duration} onChange={e => setForm(p => ({ ...p, duration: parseInt(e.target.value) }))} className="form-input-light">
              {[15, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} minutes</option>)}
            </select>
          </div>
          <Field label="Notes" value={form.notes} onChange={v => setForm(p => ({ ...p, notes: v }))} placeholder="Session goals, preparation notes..." textarea />

          {/* AI Smart Schedule */}
          <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />AI Time Suggestions</p>
              <Button size="sm" variant="outline" className="h-6 text-xs px-2 border-amber-200 text-amber-700 hover:bg-amber-100" onClick={() => smartSchedule.mutate({ clientName: form.clientName || "client", service: form.service, notes: form.notes })} disabled={smartSchedule.isPending}>
                {smartSchedule.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Suggest Times"}
              </Button>
            </div>
            {smartSuggestions.length > 0 ? (
              <div className="space-y-1.5">
                {smartSuggestions.map((s, i) => (
                  <button key={i} onClick={() => { setForm(p => ({ ...p, date: s.date, time: s.time })); setSmartSuggestions([]); toast.success("Time slot applied!"); }} className="w-full text-left px-3 py-2 rounded-lg bg-white border border-amber-100 hover:border-amber-300 transition-colors">
                    <span className="text-xs font-semibold text-[#1C1C1E]">{s.date} at {s.time}</span>
                    <span className="text-xs text-gray-600 ml-2">{s.reason}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-amber-600 opacity-70">Click "Suggest Times" to get AI-recommended slots based on your schedule.</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="flex-1 gradient-amber text-white border-0 hover:opacity-90" onClick={() => createBooking.mutate(form)} disabled={createBooking.isPending}>
              {createBooking.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Booking"}
            </Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={schedConfirm.open}
        onOpenChange={(open) => !open && setSchedConfirm(defaultConfirm)}
        title={schedConfirm.title}
        description={schedConfirm.description}
        onConfirm={() => { schedConfirm.onConfirm(); setSchedConfirm(defaultConfirm); }}
        confirmLabel="Remove"
        variant="destructive"
      />
    </div>
  );
}

// ─── Invoices Panel ───────────────────────────────────────────────────────────
function InvoicesPanel() {
  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<any>(null);
  const [form, setForm] = useState({ clientName: "", clientEmail: "", service: "", amount: "", dueDate: "", notes: "", status: "draft" as "draft" | "sent" });
  const [invConfirm, setInvConfirm] = useState<ConfirmState>(defaultConfirm);
  const [invFilter, setInvFilter] = useState<"all" | "unpaid" | "paid" | "overdue">("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);

  // Handle Stripe redirect back: ?paid=<invoiceId> — auto-mark as paid and clean URL
  const markPaidFromUrl = trpc.invoices.markPaid.useMutation({
    onSuccess: () => {
      utils.invoices.list.invalidate();
      utils.invoices.stats.invalidate();
      toast.success("Payment received! Invoice marked as paid.");
    },
  });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paidId = params.get("paid");
    if (paidId) {
      const id = parseInt(paidId, 10);
      if (!isNaN(id)) {
        markPaidFromUrl.mutate({ id });
      }
      // Clean the URL so the param doesn't persist on refresh
      const cleanUrl = window.location.pathname + "?panel=invoices";
      window.history.replaceState({}, "", cleanUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSelect(id: number) {
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function toggleSelectAll() {
    if (selectedIds.size === filteredInvoices.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredInvoices.map(i => i.id)));
  }
  // bulkMarkPaid, bulkDelete, bulkRemind are handled via individual mutations below

  const { data: invoiceList, isLoading } = trpc.invoices.list.useQuery({ status: "all" });

  const filteredInvoices = (invoiceList || []).filter(inv => {
    if (invFilter === "all") return true;
    if (invFilter === "unpaid") return inv.status === "draft" || inv.status === "sent";
    return inv.status === invFilter;
  });

  function exportInvoicesCSV() {
    if (!invoiceList || invoiceList.length === 0) { toast.info("No invoices to export."); return; }
    const headers = ["Invoice #", "Client", "Email", "Service", "Amount", "Due Date", "Status", "Notes"];
    const rows = invoiceList.map(inv => [
      inv.invoiceNumber, inv.clientName, inv.clientEmail || "",
      inv.service || "", inv.amount, inv.dueDate || "", inv.status, (inv.notes || "").replace(/,/g, ";")
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `invoices-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Invoices exported!");
  }
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
    onSuccess: (data) => { utils.followUps.list.invalidate(); toast.success(data.emailSent ? `Reminder sent to client & saved to Follow-Ups.` : `Reminder draft saved to Follow-Ups: "${data.subject}"`); },
    onError: (e) => toast.error(e.message),
  });
  const payNow = trpc.invoices.payNow.useMutation({
    onSuccess: (data) => { window.open(data.url, "_blank"); toast.success("Opening secure payment page..."); },
    onError: (e) => toast.error(e.message),
  });
  const duplicateInvoice = trpc.invoices.duplicate.useMutation({
    onSuccess: (data) => { utils.invoices.list.invalidate(); utils.invoices.stats.invalidate(); toast.success(`Invoice duplicated as ${data.invoiceNumber} (draft).`); },
    onError: (e) => toast.error(e.message),
  });
  const sendReceipt = trpc.invoices.sendReceipt.useMutation({
    onSuccess: (data) => toast.success(data.emailSent ? "Receipt sent to client!" : "Receipt prepared (email not configured)."),
    onError: (e) => toast.error(e.message),
  });
  const categorizeInvoice = trpc.ai.categorizeInvoice.useMutation({
    onSuccess: (data) => {
      const tagStr = data.tags.length > 0 ? ` [${data.tags.join(", ")}]` : "";
      setForm(p => ({ ...p, notes: p.notes ? `${p.notes}\nCategory: ${data.category}${tagStr}` : `Category: ${data.category}${tagStr}` }));
      toast.success(`Categorized as: ${data.category} (${Math.round(data.confidence * 100)}% confidence)`);
    },
    onError: () => toast.error("AI categorization unavailable."),
  });

  const statusColor: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600",
    sent: "bg-blue-50 text-blue-600",
    paid: "bg-green-50 text-green-600",
    overdue: "bg-red-50 text-red-500",
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Invoices</h2>
          <p className="text-sm text-gray-600">{invoiceList?.length || 0} total invoices</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-gray-600 border-gray-200" onClick={exportInvoicesCSV} title="Export all invoices as CSV">
            <Download className="w-3.5 h-3.5" />Export CSV
          </Button>
          <Button size="sm" className="gradient-amber text-white border-0 hover:opacity-90 gap-1.5" onClick={() => setShowAdd(true)}>
            <Plus className="w-3.5 h-3.5" />New Invoice
          </Button>
        </div>
      </div>
      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl overflow-x-auto">
        {(["all", "unpaid", "paid", "overdue"] as const).map(f => (
          <button key={f} onClick={() => setInvFilter(f)} className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
            invFilter === f ? "bg-white text-[#1C1C1E] shadow-sm" : "text-gray-600 hover:text-gray-700"
          }`}>{f}</button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Paid", value: formatCurrency(invoiceStats?.totalRevenue || 0), color: "#E8A020", bg: "bg-[#E8A020]/10" },
          { label: "Outstanding", value: formatCurrency(invoiceStats?.outstanding || 0), color: "#6366F1", bg: "bg-indigo-50" },
          { label: "Overdue", value: String(invoiceStats?.overdue || 0), color: "#FF6B6B", bg: "bg-red-50" },
          { label: "Total Invoices", value: String(invoiceStats?.total || 0), color: "#F59E0B", bg: "bg-yellow-50" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-3 sm:p-4`}>
            <p className="text-[11px] sm:text-xs font-semibold mb-1" style={{ color: s.color }}>{s.label}</p>
            <p className="text-lg sm:text-xl font-extrabold text-[#1C1C1E] leading-tight" style={{ fontFamily: "Space Grotesk, sans-serif" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Bulk action toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 p-3 bg-[#1C1C1E] text-white rounded-xl">
          <span className="text-xs font-semibold flex-1">{selectedIds.size} selected</span>
          <button
            onClick={() => {
              const unpaidIds = Array.from(selectedIds).filter(id => filteredInvoices.find(i => i.id === id && i.status !== "paid"));
              if (unpaidIds.length === 0) { toast.info("All selected invoices are already paid."); return; }
              Promise.all(unpaidIds.map(id => markPaid.mutateAsync({ id })))
                .then(() => { utils.invoices.list.invalidate(); utils.invoices.stats.invalidate(); setSelectedIds(new Set()); toast.success(`${unpaidIds.length} invoice${unpaidIds.length > 1 ? "s" : ""} marked as paid!`); })
                .catch(e => toast.error(e.message));
            }}
            className="text-xs bg-[#E8A020] hover:bg-[#d4911c] text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
            disabled={bulkPending}
          >Mark Paid</button>
          <button
            onClick={() => {
              const withEmail = Array.from(selectedIds).filter(id => filteredInvoices.find(i => i.id === id && i.clientEmail && i.status !== "paid"));
              if (withEmail.length === 0) { toast.info("No unpaid invoices with client email selected."); return; }
              Promise.all(withEmail.map(id => sendReminder.mutateAsync({ id })))
                .then(() => { setSelectedIds(new Set()); toast.success(`Reminders sent for ${withEmail.length} invoice${withEmail.length > 1 ? "s" : ""}.`); })
                .catch(e => toast.error(e.message));
            }}
            className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
            disabled={bulkPending}
          >Send Reminder</button>
          <button
            onClick={() => setInvConfirm({ open: true, title: "Delete Selected", description: `Delete ${selectedIds.size} invoice${selectedIds.size > 1 ? "s" : ""}? This cannot be undone.`, onConfirm: () => {
              Promise.all(Array.from(selectedIds).map(id => deleteInvoice.mutateAsync({ id })))
                .then(() => { utils.invoices.list.invalidate(); utils.invoices.stats.invalidate(); setSelectedIds(new Set()); toast.success("Selected invoices deleted."); })
                .catch(e => toast.error(e.message));
            }})}
            className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
            disabled={bulkPending}
          >Delete</button>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 hover:text-white px-2 py-1.5 transition-colors">✕ Clear</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="hidden sm:grid grid-cols-5 gap-4 px-5 py-3 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide">
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" className="rounded w-3.5 h-3.5 accent-[#E8A020] cursor-pointer" checked={filteredInvoices.length > 0 && selectedIds.size === filteredInvoices.length} onChange={toggleSelectAll} title="Select all" />
            <span>Client / Service</span>
          </div>
          <span>Amount</span>
          <span>Due Date</span>
          <span>Status</span>
        </div>
        {isLoading ? (
          <div className="space-y-px">{[...Array(3)].map((_, i) => <div key={i} className="px-5 py-4 border-t border-gray-50"><Skeleton className="h-10" /></div>)}</div>
        ) : !invoiceList || invoiceList.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium text-gray-600">No invoices yet</p>
            <p className="text-xs mt-1">Create your first invoice to start tracking payments.</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium text-gray-600">No {invFilter !== "all" ? invFilter : ""} invoices</p>
          </div>
        ) : filteredInvoices.map(inv => (
          <div key={inv.id} className={`flex flex-col sm:grid sm:grid-cols-5 gap-2 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 border-t border-gray-50 hover:bg-gray-50 transition-colors ${selectedIds.has(inv.id) ? "bg-[#E8A020]/5" : ""}`}>
            <div className="sm:col-span-2 flex items-start gap-2">
              <input type="checkbox" className="mt-1 rounded w-3.5 h-3.5 accent-[#E8A020] cursor-pointer flex-shrink-0" checked={selectedIds.has(inv.id)} onChange={() => toggleSelect(inv.id)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#1C1C1E] truncate">{inv.clientName}</p>
                <p className="text-xs text-gray-600 truncate">{inv.invoiceNumber} · {inv.service || "General Service"}</p>
                {/* Mobile-only inline amount + due date */}
                <div className="flex items-center gap-3 mt-1 sm:hidden">
                  <span className="text-xs font-bold text-[#1C1C1E]">{formatCurrency(inv.amount)}</span>
                  {inv.dueDate && <span className="text-xs text-gray-600">Due {inv.dueDate}</span>}
                </div>
              </div>
            </div>
            <p className="hidden sm:block text-sm font-bold text-[#1C1C1E]">{formatCurrency(inv.amount)}</p>
            <p className="hidden sm:block text-sm text-gray-600">{inv.dueDate || "—"}</p>
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <Badge className={`text-xs border-0 flex-shrink-0 ${statusColor[inv.status] || "bg-gray-100 text-gray-600"}`}>{inv.status}</Badge>
              {inv.status !== "paid" && (
                <button onClick={() => markPaid.mutate({ id: inv.id })} className="text-xs text-[#E8A020] hover:underline font-medium" disabled={markPaid.isPending}>
                  Mark Paid
                </button>
              )}
              {inv.status === "paid" && inv.clientEmail && (
                <button
                  onClick={() => sendReceipt.mutate({ id: inv.id })}
                  className="text-xs text-green-600 hover:underline font-medium flex items-center gap-1"
                  disabled={sendReceipt.isPending}
                  title="Email receipt to client"
                >
                  <Mail className="w-3 h-3" />{sendReceipt.isPending ? "..." : "Receipt"}
                </button>
              )}
              {(inv.status === "sent" || inv.status === "overdue") && (
                <>
                  <button
                    onClick={() => payNow.mutate({ id: inv.id, origin: window.location.origin })}
                    className="text-xs text-green-600 hover:underline font-medium flex items-center gap-1"
                    disabled={payNow.isPending}
                    title="Send client to Stripe checkout to pay this invoice"
                  >
                    <CreditCard className="w-3 h-3" />{payNow.isPending ? "..." : "Pay Now"}
                  </button>
                  <button
                    onClick={() => sendReminder.mutate({ id: inv.id })}
                    className="text-xs text-[#FF6B6B] hover:underline font-medium flex items-center gap-1"
                    disabled={sendReminder.isPending}
                    title="Send payment reminder to client"
                  >
                    <Bell className="w-3 h-3" />Remind
                  </button>
                </>
              )}
              <button onClick={() => setPreviewInvoice(inv)} className="p-1 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-600 transition-colors" aria-label="Preview invoice" title="Preview invoice">
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { const link = `${window.location.origin}/portal?invoice=${inv.id}`; navigator.clipboard.writeText(link).then(() => toast.success("Invoice link copied!")).catch(() => toast.info(`Invoice link: ${link}`)); }} className="p-1 rounded hover:bg-blue-50 text-gray-500 hover:text-blue-500 transition-colors" aria-label="Copy invoice link" title="Copy shareable invoice link">
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => duplicateInvoice.mutate({ id: inv.id })} className="p-1 rounded hover:bg-[#E8A020]/10 text-gray-500 hover:text-[#E8A020] transition-colors" aria-label="Duplicate invoice" title="Duplicate invoice" disabled={duplicateInvoice.isPending}>
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setInvConfirm({ open: true, title: "Delete Invoice?", description: "Delete this invoice? This cannot be undone.", onConfirm: () => deleteInvoice.mutate({ id: inv.id }) })} className="p-1 rounded hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors" aria-label="Delete invoice">
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
            <select onChange={e => { const c = clientList?.find(c => c.id === parseInt(e.target.value)); if (c) setForm(p => ({ ...p, clientName: c.name, clientEmail: c.email || "" })); }} className="form-input-light">
              <option value="">— Or enter manually below —</option>
              {clientList?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Field label="Client Name" value={form.clientName} onChange={v => setForm(p => ({ ...p, clientName: v }))} placeholder="Jane Smith" required autoComplete="name" enterKeyHint="next" />
          <Field label="Client Email" value={form.clientEmail} onChange={v => setForm(p => ({ ...p, clientEmail: v }))} placeholder="jane@example.com" type="email" autoComplete="email" enterKeyHint="next" />
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-600">Service Description</label>
              {form.service && (
                <Button size="sm" variant="outline" className="h-5 text-[10px] px-2 border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => categorizeInvoice.mutate({ service: form.service, notes: form.notes, amount: parseFloat(form.amount) || 0 })} disabled={categorizeInvoice.isPending}>
                  {categorizeInvoice.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <><Sparkles className="w-2.5 h-2.5 mr-1" />AI Categorize</>}
                </Button>
              )}
            </div>
            <input value={form.service} onChange={e => setForm(p => ({ ...p, service: e.target.value }))} placeholder="3-month coaching program, web design..." className="form-input-light" autoComplete="off" enterKeyHint="next" />
          </div>
          <Field label="Amount ($) *" value={form.amount} onChange={v => setForm(p => ({ ...p, amount: v }))} placeholder="500.00" type="number" required autoComplete="off" enterKeyHint="next" />
          <Field label="Due Date" value={form.dueDate} onChange={v => setForm(p => ({ ...p, dueDate: v }))} type="date" autoComplete="off" />
          <Field label="Notes" value={form.notes} onChange={v => setForm(p => ({ ...p, notes: v }))} placeholder="Payment terms, bank details..." textarea enterKeyHint="done" />
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Send as</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as "draft" | "sent" }))} className="form-input-light">
              <option value="draft">Save as Draft</option>
              <option value="sent">Mark as Sent</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="flex-1 gradient-amber text-white border-0 hover:opacity-90" onClick={() => createInvoice.mutate({ ...form, amount: parseFloat(form.amount) || 0 })} disabled={createInvoice.isPending}>
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
                <h3 className="text-2xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: "Space Grotesk, sans-serif" }}>INVOICE</h3>
                <p className="text-sm text-gray-600 mt-1">{previewInvoice.invoiceNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-600">Issued</p>
                <p className="text-sm font-semibold">{formatDate(previewInvoice.createdAt)}</p>
                {previewInvoice.dueDate && <>
                  <p className="text-xs text-gray-600 mt-1">Due</p>
                  <p className="text-sm font-semibold">{previewInvoice.dueDate}</p>
                </>}
              </div>
            </div>
            <div className="border-t border-b border-gray-100 py-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Client</span>
                <span className="font-semibold">{previewInvoice.clientName}</span>
              </div>
              {previewInvoice.clientEmail && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Email</span>
                  <span>{previewInvoice.clientEmail}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Service</span>
                <span>{previewInvoice.service || "Professional Services"}</span>
              </div>
            </div>
            <div className="flex justify-between items-center bg-[#E8A020]/10 rounded-xl p-4">
              <span className="font-bold text-[#1C1C1E]">Total Amount</span>
              <span className="text-2xl font-extrabold text-[#E8A020]" style={{ fontFamily: "Space Grotesk, sans-serif" }}>{formatCurrency(previewInvoice.amount)}</span>
            </div>
            {previewInvoice.notes && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-600 mb-1">Notes</p>
                <p className="text-sm text-gray-700">{previewInvoice.notes}</p>
              </div>
            )}
            <div className="flex gap-3">
              <Button className="flex-1 gradient-amber text-white border-0 hover:opacity-90 gap-2" onClick={() => { window.print(); }}>
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
      <ConfirmDialog
        open={invConfirm.open}
        onOpenChange={(open) => !open && setInvConfirm(defaultConfirm)}
        title={invConfirm.title}
        description={invConfirm.description}
        onConfirm={() => { invConfirm.onConfirm(); setInvConfirm(defaultConfirm); }}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  );
}

// ─── Follow-Ups Panel ─────────────────────────────────────────────────────────
function FollowUpsPanel() {
  const utils = trpc.useUtils();
  const [showGenerate, setShowGenerate] = useState(false);
  const [previewFollowUp, setPreviewFollowUp] = useState<any>(null);
  const [form, setForm] = useState({ clientName: "", clientEmail: "", service: "", context: "", tone: "professional" as "professional" | "friendly" | "motivational" });
  const [fuConfirm, setFuConfirm] = useState<ConfirmState>(defaultConfirm);

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
          <h2 className="text-xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: "Space Grotesk, sans-serif" }}>AI Follow-Ups</h2>
          <p className="text-sm text-gray-600">Let AI write personalized follow-up emails for your clients</p>
        </div>
        <Button size="sm" className="gradient-amber text-white border-0 hover:opacity-90 gap-1.5" onClick={() => setShowGenerate(true)}>
          <Zap className="w-3.5 h-3.5" />Generate Email
        </Button>
      </div>

      {/* Info Card */}
      <div className="bg-gradient-to-r from-[#E8A020]/10 to-[#6366F1]/10 border border-[#E8A020]/20 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl gradient-amber flex items-center justify-center text-white flex-shrink-0">
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
          <div className="bg-white rounded-2xl border border-gray-100 text-center py-16 text-gray-600">
            <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium text-gray-600">No follow-ups generated yet</p>
            <p className="text-xs mt-1">Generate your first AI follow-up email above.</p>
          </div>
        ) : followUpList.map(f => (
          <div key={f.id} className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-[#E8A020]/30 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-[#1C1C1E]">{f.clientName}</p>
                  <Badge className={`text-xs border-0 ${f.status === "sent" ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>
                    {f.status}
                  </Badge>
                </div>
                <p className="text-xs text-gray-600 mt-0.5 font-medium">{f.subject}</p>
                <p className="text-xs text-gray-600 mt-1 line-clamp-2">{f.body}</p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => copyToClipboard(f.body)} className="p-1.5 rounded-lg hover:bg-[#E8A020]/10 text-gray-600 hover:text-[#E8A020] transition-colors" aria-label="Copy email body to clipboard" title="Copy email body">
                  <Copy className="w-4 h-4" />
                </button>
                <button onClick={() => setPreviewFollowUp(f)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-600 transition-colors" aria-label="Preview email">
                  <Eye className="w-4 h-4" />
                </button>
                {f.status === "draft" && (
                  <button onClick={() => markSent.mutate({ id: f.id })} className="p-1.5 rounded-lg hover:bg-green-50 text-gray-600 hover:text-green-600 transition-colors" aria-label="Mark as sent">
                    <Send className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => setFuConfirm({ open: true, title: "Delete Follow-Up?", description: "Delete this follow-up email? This cannot be undone.", onConfirm: () => deleteFollowUp.mutate({ id: f.id }) })} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors" aria-label="Delete follow-up">
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
            <select onChange={e => { const c = clientList?.find(c => c.id === parseInt(e.target.value)); if (c) setForm(p => ({ ...p, clientName: c.name, clientEmail: c.email || "", service: c.service || "" })); }} className="form-input-light">
              <option value="">— Or enter manually below —</option>
              {clientList?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Field label="Client Name *" value={form.clientName} onChange={v => setForm(p => ({ ...p, clientName: v }))} placeholder="Jane Smith" required autoComplete="name" enterKeyHint="next" />
          <Field label="Client Email" value={form.clientEmail} onChange={v => setForm(p => ({ ...p, clientEmail: v }))} placeholder="jane@example.com" type="email" autoComplete="email" enterKeyHint="next" />
          <Field label="Service / Context" value={form.service} onChange={v => setForm(p => ({ ...p, service: v }))} placeholder="Business coaching, web design..." autoComplete="off" enterKeyHint="next" />
          <Field label="Additional Context (optional)" value={form.context} onChange={v => setForm(p => ({ ...p, context: v }))} placeholder="Last session was about goal-setting, they struggled with time management..." textarea enterKeyHint="done" />
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email Tone</label>
            <div className="grid grid-cols-3 gap-2">
              {(["professional", "friendly", "motivational"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setForm(p => ({ ...p, tone: t }))}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border-2 transition-all capitalize ${form.tone === t ? "border-[#E8A020] bg-[#E8A020]/10 text-[#E8A020]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowGenerate(false)}>Cancel</Button>
            <Button className="flex-1 gradient-amber text-white border-0 hover:opacity-90 gap-2" onClick={() => generate.mutate(form)} disabled={generate.isPending}>
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
                <span className="text-xs font-semibold text-gray-600 w-12">To:</span>
                <span className="text-sm text-gray-700">{previewFollowUp.clientEmail || previewFollowUp.clientName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-600 w-12">Subject:</span>
                <span className="text-sm font-semibold text-[#1C1C1E]">{previewFollowUp.subject}</span>
              </div>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{previewFollowUp.body}</p>
            </div>
            <div className="flex gap-3">
              <Button className="flex-1 gradient-amber text-white border-0 hover:opacity-90 gap-2" onClick={() => copyToClipboard(previewFollowUp.body)}>
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
      <ConfirmDialog
        open={fuConfirm.open}
        onOpenChange={(open) => !open && setFuConfirm(defaultConfirm)}
        title={fuConfirm.title}
        description={fuConfirm.description}
        onConfirm={() => { fuConfirm.onConfirm(); setFuConfirm(defaultConfirm); }}
        confirmLabel="Delete"
        variant="destructive"
      />
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
    { label: "Total Revenue", value: formatCurrency(analytics?.totalRevenue || 0), icon: DollarSign, color: "#E8A020" },
    { label: "Active Clients", value: String(analytics?.activeClients || 0), icon: Users, color: "#6366F1" },
    { label: "Sessions Booked", value: String((analytics?.completedSessions || 0) + (analytics?.completedSessions || 0)), icon: Calendar, color: "#F59E0B" },
    { label: "Conversion Rate", value: analytics?.totalClients ? `${Math.round((analytics.activeClients / analytics.totalClients) * 100)}%` : "0%", icon: TrendingUp, color: "#FF6B6B" },
  ];

  const pieData = [
    { name: "Active", value: analytics?.activeClients || 0, color: "#E8A020" },
    { name: "Prospects", value: analytics?.totalClients || 0, color: "#6366F1" },
    { name: "Inactive", value: analytics?.activeClients || 0, color: "#E5E7EB" },
  ].filter(d => d.value > 0);

  const topServices = analytics?.topServices || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Analytics</h2>
        <p className="text-sm text-gray-600">Your business performance at a glance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white mb-3" style={{ backgroundColor: s.color }}>
              <s.icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: "Space Grotesk, sans-serif" }}>{s.value}</p>
            <p className="text-xs text-gray-600 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <h3 className="font-bold text-[#1C1C1E] text-sm mb-4" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Revenue Trend</h3>
          {analytics?.monthlyRevenue?.some(d => d.revenue > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={analytics.monthlyRevenue}>
                <defs>
                  <linearGradient id="amberGrad3" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E8A020" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#E8A020" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: "12px" }} formatter={(v: number) => [formatCurrency(v), "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#E8A020" strokeWidth={2.5} fill="url(#amberGrad3)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-gray-600">
              <DollarSign className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm text-center">Revenue data will appear once you create and mark invoices as paid.</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <h3 className="font-bold text-[#1C1C1E] text-sm mb-4" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Client Breakdown</h3>
          {pieData.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <div className="w-36 h-36 flex-shrink-0 mx-auto sm:mx-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 flex-1 min-w-0">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-sm text-gray-600 truncate">{d.name}</span>
                    <span className="text-sm font-bold text-[#1C1C1E] ml-auto pl-2 flex-shrink-0">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-36 flex flex-col items-center justify-center text-gray-600">
              <Users className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Add clients to see breakdown.</p>
            </div>
          )}
        </div>

        {topServices.length > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 lg:col-span-2">
            <h3 className="font-bold text-[#1C1C1E] text-sm mb-4" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Top Services by Revenue</h3>
            <div className="space-y-3">
              {topServices.slice(0, 5).map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-4">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-[#1C1C1E]">{s.name ?? s.service}</span>
                      <span className="text-sm font-bold text-[#E8A020]">{formatCurrency(s.revenue)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#E8A020] rounded-full" style={{ width: `${Math.min((s.revenue / topServices[0].revenue) * 100, 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Revenue Forecast */}
        {analytics?.forecast && analytics.forecast.some(d => d.revenue > 0) && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[#1C1C1E] text-sm" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Revenue Forecast (90-Day)</h3>
              <div className="flex items-center gap-4 text-xs text-gray-600">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#E8A020] inline-block" />Actual</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#E8A020] opacity-40 inline-block border-dashed border-t border-[#E8A020]" />Projected</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={analytics.forecast}>
                <defs>
                  <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E8A020" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#E8A020" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: "12px" }} formatter={(v: number, _: string, p: any) => [formatCurrency(v), p.payload.projected ? "Projected" : "Actual"]} />
                <Area type="monotone" dataKey="revenue" stroke="#E8A020" strokeWidth={2.5} fill="url(#forecastGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Client LTV */}
        {analytics?.clientLTV && analytics.clientLTV.length > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <h3 className="font-bold text-[#1C1C1E] text-sm mb-4" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Top Clients by LTV</h3>
            <div className="space-y-3">
              {analytics.clientLTV.slice(0, 6).map((c: any, i: number) => (
                <div key={c.clientId} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-[#1C1C1E] truncate">{c.name}</span>
                      <span className="text-sm font-bold text-[#E8A020] ml-2 flex-shrink-0">{formatCurrency(c.ltv)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min((c.ltv / analytics.clientLTV[0].ltv) * 100, 100)}%`, background: i === 0 ? "#E8A020" : "#6366F1" }} />
                    </div>
                    <p className="text-[10px] text-gray-600 mt-0.5">{c.invoiceCount} invoice{c.invoiceCount !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Referral Sources */}
        {analytics?.referralSources && analytics.referralSources.length > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <h3 className="font-bold text-[#1C1C1E] text-sm mb-4" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Lead Sources</h3>
            <div className="space-y-3">
              {analytics.referralSources.slice(0, 6).map((s: any, i: number) => {
                const total = analytics.referralSources.reduce((sum: number, r: any) => sum + r.count, 0);
                const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                const colors = ["#E8A020", "#6366F1", "#5A9A7A", "#FF6B6B", "#F59E0B", "#8B5CF6"];
                return (
                  <div key={s.source} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: colors[i % colors.length] }} />
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-[#1C1C1E] capitalize">{s.source.replace(/_/g, " ")}</span>
                        <span className="text-xs font-bold text-gray-600">{s.count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: colors[i % colors.length] }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────
// ─── Change Password Section ─────────────────────────────────────────────────
function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);

  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (e) => toast.error(e.message || "Failed to update password."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const isDisabled = changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
      <h3 className="font-bold text-sm text-[#1C1C1E] flex items-center gap-2">
        <Settings className="w-4 h-4 text-[#E8A020]" />Change Password
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Current Password</label>
          <div className="relative">
            <input
              type={showPasswords ? "text" : "password"}
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              autoComplete="current-password"
              className="form-input-light pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPasswords(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-600"
              aria-label={showPasswords ? "Hide passwords" : "Show passwords"}
            >
              {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">New Password</label>
          <input
            type={showPasswords ? "text" : "password"}
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Min. 8 characters"
            autoComplete="new-password"
            className="form-input-light"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Confirm New Password</label>
          <input
            type={showPasswords ? "text" : "password"}
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            autoComplete="new-password"
            className={`form-input-light ${
              confirmPassword && confirmPassword !== newPassword ? "border-red-300" : "border-gray-200"
            }`}
          />
          {confirmPassword && confirmPassword !== newPassword && (
            <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
          )}
        </div>
        <Button
          type="submit"
          disabled={isDisabled}
          className="gradient-amber text-white border-0 hover:opacity-90 gap-2 disabled:opacity-40"
        >
          {changePasswordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Update Password</>}
        </Button>
      </form>
    </div>
  );
}

function CopyBookingLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(url)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); })
      .catch(() => toast.error("Could not copy — please copy the link manually."));
  };
  return (
    <button
      onClick={handleCopy}
      className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
        copied
          ? "bg-green-50 text-green-600 border border-green-200"
          : "bg-[#E8A020]/10 text-[#E8A020] border border-[#E8A020]/30 hover:bg-[#E8A020]/20"
      }`}
      aria-label="Copy booking link to clipboard"
    >
      {copied ? (
        <><CheckCircle className="w-4 h-4" />Copied to clipboard!</>
      ) : (
        <><Copy className="w-4 h-4" />Copy Booking Link</>
      )}
    </button>
  );
}

// ─── API Keys Section ────────────────────────────────────────────────────────
function ApiKeysSection() {
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const { data: keys, isLoading } = trpc.apiKeys.list.useQuery();
  const createKey = trpc.apiKeys.create.useMutation({
    onSuccess: (data) => { setCreatedKey(data.key); setNewKeyName(""); utils.apiKeys.list.invalidate(); toast.success("API key created! Copy it now — it won't be shown again."); },
    onError: (e) => toast.error(e.message),
  });
  const revokeKey = trpc.apiKeys.revoke.useMutation({
    onSuccess: () => { utils.apiKeys.list.invalidate(); toast.success("API key revoked."); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
      <h3 className="font-bold text-sm text-[#1C1C1E] flex items-center gap-2"><Zap className="w-4 h-4 text-[#E8A020]" />API Keys</h3>
      <p className="text-xs text-gray-600">Use API keys to integrate TrueAxis HQ with Zapier, Make, or your own tools.</p>
      {createdKey && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-green-700 mb-1">Your new API key (copy it now — it won't be shown again):</p>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono bg-white px-2 py-1 rounded border border-green-200 flex-1 truncate">{createdKey}</code>
            <button onClick={() => { navigator.clipboard.writeText(createdKey); toast.success("Copied!"); }} className="p-1.5 rounded hover:bg-green-100 text-green-600"><Copy className="w-3.5 h-3.5" /></button>
          </div>
          <button onClick={() => setCreatedKey(null)} className="text-xs text-green-600 hover:underline mt-1">Dismiss</button>
        </div>
      )}
      {isLoading ? <Skeleton className="h-10" /> : keys && keys.length > 0 ? (
        <div className="space-y-2">
          {keys.map(k => (
            <div key={k.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-[#1C1C1E]">{k.name}</p>
                <p className="text-xs text-gray-600 font-mono">{k.keyPrefix}... · Created {new Date(k.createdAt).toLocaleDateString()}{k.lastUsedAt ? ` · Last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : " · Never used"}</p>
              </div>
              <button onClick={() => revokeKey.mutate({ id: k.id })} className="text-xs text-red-500 hover:underline font-medium" disabled={revokeKey.isPending}>Revoke</button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-600">No API keys yet.</p>
      )}
      <div className="flex gap-2">
        <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Key name (e.g. Zapier)" className="form-input-light flex-1" autoComplete="off" enterKeyHint="done" onKeyDown={e => e.key === 'Enter' && newKeyName.trim() && createKey.mutate({ name: newKeyName.trim() })} />
        <Button size="sm" className="gradient-amber text-white border-0 hover:opacity-90" onClick={() => newKeyName.trim() && createKey.mutate({ name: newKeyName.trim() })} disabled={createKey.isPending || !newKeyName.trim()}>
          {createKey.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Generate"}
        </Button>
      </div>
    </div>
  );
}

// ─── Audit Log Section ────────────────────────────────────────────────────────
function AuditLogSection() {
  const { data: logs, isLoading } = trpc.auditLog.list.useQuery({ limit: 20, offset: 0 });
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
      <h3 className="font-bold text-sm text-[#1C1C1E] flex items-center gap-2"><Activity className="w-4 h-4 text-[#E8A020]" />Activity Log</h3>
      <p className="text-xs text-gray-600">A record of your recent account activity.</p>
      {isLoading ? <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div> : !logs || logs.length === 0 ? (
        <p className="text-xs text-gray-600">No activity recorded yet.</p>
      ) : (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {logs.map(log => (
            <div key={log.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
              <div className="w-1.5 h-1.5 rounded-full bg-[#E8A020] mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#1C1C1E]">{log.action.replace(/\./g, ' › ')}</p>
                {log.details && <p className="text-xs text-gray-600 truncate">{log.details}</p>}
              </div>
              <p className="text-xs text-gray-600 shrink-0">{new Date(log.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsPanel() {
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { data: settings, isLoading } = trpc.settings.get.useQuery(undefined, { retry: 1 });
  const [profile, setProfile] = useState({ name: "", bio: "", phone: "" });
  const [business, setBusiness] = useState({ businessName: "", businessPhone: "", businessAddress: "", businessWebsite: "" });
  const [bookingPage, setBookingPage] = useState({ bookingUsername: "", bookingBio: "", bookingServices: ["Coaching Session", "Strategy Call", "Consultation"] });
  const [notifications, setNotifications] = useState({ notifyNewBooking: true, notifyInvoicePaid: true, notifyNewLead: true });
  const [newService, setNewService] = useState("");
  const [showPresetServices, setShowPresetServices] = useState(false);
  const PRESET_SERVICES = [
    // Coaching & Consulting
    "Life Coaching", "Business Coaching", "Executive Coaching", "Career Coaching",
    "Health & Wellness Coaching", "Relationship Coaching", "Mindset Coaching",
    "Business Consulting", "Strategy Consulting", "Financial Consulting",
    "Marketing Consulting", "HR Consulting", "Operations Consulting",
    // Creative & Design
    "Graphic Design", "Logo Design", "Brand Identity", "UI/UX Design",
    "Web Design", "Social Media Design", "Video Editing", "Photography",
    "Videography", "Content Creation", "Copywriting", "Ghostwriting",
    // Tech & Development
    "Web Development", "Mobile App Development", "Software Development",
    "WordPress Development", "Shopify Development", "SEO Services",
    "Social Media Management", "Email Marketing", "Paid Ads Management",
    // Education & Tutoring
    "Tutoring", "Math Tutoring", "English Tutoring", "SAT/ACT Prep",
    "Language Lessons", "Music Lessons", "Fitness Training", "Yoga Instruction",
    // Professional Services
    "Legal Advice", "Tax Preparation", "Bookkeeping", "Accounting",
    "Real Estate Consulting", "Insurance Consulting", "Therapy / Counseling",
    "Nutrition Consulting", "Personal Styling", "Interior Design",
    // General
    "Strategy Call", "Discovery Call", "Consultation", "Workshop",
    "Group Session", "VIP Day", "Done-For-You Service", "Other",
  ];
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings?.avatarUrl) setAvatarUrl(settings.avatarUrl);
  }, [settings?.avatarUrl]);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB."); return; }
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await fetch("/api/upload/avatar", { method: "POST", body: fd, credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      setAvatarUrl(json.url);
      utils.settings.get.invalidate();
      toast.success("Profile photo updated!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function handleAvatarRemove() {
    setAvatarUploading(true);
    try {
      const res = await fetch("/api/upload/avatar", { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to remove photo");
      setAvatarUrl(null);
      utils.settings.get.invalidate();
      toast.success("Profile photo removed.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setAvatarUploading(false);
    }
  }

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
    <div className="space-y-6 max-w-2xl w-full">
      <div>
        <h2 className="text-xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Settings</h2>
        <p className="text-sm text-gray-600">Manage your profile, business info, and preferences</p>
      </div>

      {/* Profile */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <h3 className="font-bold text-sm text-[#1C1C1E] flex items-center gap-2"><User className="w-4 h-4 text-[#E8A020]" />Profile</h3>

        {/* Avatar Upload */}
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-[#E8A020] to-[#D4911A] flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile photo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-lg font-bold">{profile.name?.slice(0, 2).toUpperCase() || "U"}</span>
              )}
            </div>
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-[#E8A020] flex items-center justify-center shadow-md hover:bg-[#D4911A] transition-colors disabled:opacity-50"
              aria-label="Change profile photo"
            >
              {avatarUploading ? <Loader2 className="w-3 h-3 text-white animate-spin" /> : <Camera className="w-3 h-3 text-white" />}
            </button>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#1C1C1E] mb-0.5">Profile Photo</p>
            <p className="text-xs text-gray-600 mb-2">JPEG, PNG, WebP or GIF · Max 5 MB</p>
            <div className="flex gap-2">
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                className="text-xs font-semibold text-[#E8A020] hover:underline disabled:opacity-50 transition-opacity"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, minHeight: "auto", minWidth: "auto" }}
              >
                {avatarUrl ? "Change photo" : "Upload photo"}
              </button>
              {avatarUrl && (
                <>
                  <span className="text-gray-200">·</span>
                  <button
                    onClick={handleAvatarRemove}
                    disabled={avatarUploading}
                    className="text-xs font-semibold text-red-400 hover:underline disabled:opacity-50 transition-opacity"
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, minHeight: "auto", minWidth: "auto" }}
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
            aria-label="Upload profile photo"
          />
        </div>

        <Field label="Your Name" value={profile.name} onChange={v => setProfile(p => ({ ...p, name: v }))} placeholder="Alex Smith" autoComplete="name" enterKeyHint="next" />
        <Field label="Phone Number" value={profile.phone} onChange={v => setProfile(p => ({ ...p, phone: v }))} placeholder="+1 (555) 000-0000" type="tel" autoComplete="tel" enterKeyHint="next" />
        <Field label="Bio (shown on booking page)" value={profile.bio} onChange={v => setProfile(p => ({ ...p, bio: v }))} placeholder="I help entrepreneurs build scalable businesses..." textarea rows={3} enterKeyHint="done" />
        <Button className="gradient-amber text-white border-0 hover:opacity-90 gap-2" onClick={() => updateProfile.mutate(profile)} disabled={updateProfile.isPending}>
          {updateProfile.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Save Profile</>}
        </Button>
      </div>

      {/* Business */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <h3 className="font-bold text-sm text-[#1C1C1E] flex items-center gap-2"><Building className="w-4 h-4 text-[#E8A020]" />Business Info</h3>
        <Field label="Business Name" value={business.businessName} onChange={v => setBusiness(p => ({ ...p, businessName: v }))} placeholder="My Coaching Studio" autoComplete="organization" enterKeyHint="next" />
        <Field label="Business Phone" value={business.businessPhone} onChange={v => setBusiness(p => ({ ...p, businessPhone: v }))} placeholder="+1 (555) 000-0000" type="tel" autoComplete="tel" enterKeyHint="next" />
        <Field label="Business Address" value={business.businessAddress} onChange={v => setBusiness(p => ({ ...p, businessAddress: v }))} placeholder="123 Main St, New York, NY 10001" autoComplete="street-address" enterKeyHint="next" />
        <Field label="Website" value={business.businessWebsite} onChange={v => setBusiness(p => ({ ...p, businessWebsite: v }))} placeholder="https://yourwebsite.com" type="url" autoComplete="url" enterKeyHint="done" />
        <Button className="gradient-amber text-white border-0 hover:opacity-90 gap-2" onClick={() => updateBusiness.mutate(business)} disabled={updateBusiness.isPending}>
          {updateBusiness.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Save Business Info</>}
        </Button>
      </div>

      {/* Booking Page */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <h3 className="font-bold text-sm text-[#1C1C1E] flex items-center gap-2"><Globe className="w-4 h-4 text-[#E8A020]" />Booking Page</h3>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Your Booking URL</label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm text-gray-600 flex-shrink-0 truncate max-w-full">{window.location.origin}/book/</span>
            <input
              value={bookingPage.bookingUsername}
              onChange={e => setBookingPage(p => ({ ...p, bookingUsername: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
              placeholder="your-name"
              className="form-input-light flex-1 min-w-0"
              autoComplete="username"
              enterKeyHint="done"
              inputMode="url"
            />
          </div>
          {bookingUrl && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100 min-w-0">
                <span className="text-xs text-gray-600 flex-1 truncate font-mono min-w-0">{bookingUrl}</span>
                <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-[#E8A020] transition-colors flex-shrink-0" title="Preview booking page">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <CopyBookingLinkButton url={bookingUrl} />
            </div>
          )}
        </div>
        <Field label="Booking Page Bio" value={bookingPage.bookingBio} onChange={v => setBookingPage(p => ({ ...p, bookingBio: v }))} placeholder="Book a session with me..." textarea rows={2} enterKeyHint="done" />
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">Services Offered</label>
          <div className="space-y-2 mb-3">
            {bookingPage.bookingServices.map((s, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                <span className="text-sm flex-1">{s}</span>
                <button onClick={() => setBookingPage(p => ({ ...p, bookingServices: p.bookingServices.filter((_, j) => j !== i) }))} className="text-gray-600 hover:text-red-500 transition-colors" aria-label={`Remove ${s}`}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mb-2">
            <input value={newService} onChange={e => setNewService(e.target.value)} placeholder="Type a custom service..." className="form-input-light" autoComplete="off" enterKeyHint="done" onKeyDown={e => { if (e.key === "Enter" && newService.trim()) { setBookingPage(p => ({ ...p, bookingServices: [...p.bookingServices, newService.trim()] })); setNewService(""); } }} />
            <Button size="sm" variant="outline" onClick={() => { if (newService.trim()) { setBookingPage(p => ({ ...p, bookingServices: [...p.bookingServices, newService.trim()] })); setNewService(""); } }}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setShowPresetServices(p => !p)}
            className="text-xs text-[#E8A020] hover:text-[#d4901c] font-semibold flex items-center gap-1 mb-2 transition-colors"
          >
            <Zap className="w-3 h-3" />
            {showPresetServices ? "Hide" : "Browse"} 50+ preset services
          </button>
          {showPresetServices && (
            <div className="flex flex-wrap gap-1.5 p-3 bg-gray-50 rounded-xl border border-gray-100 max-h-48 overflow-y-auto">
              {PRESET_SERVICES.filter(s => !bookingPage.bookingServices.includes(s)).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setBookingPage(p => ({ ...p, bookingServices: [...p.bookingServices, s] }))}
                  className="text-xs bg-white border border-gray-200 hover:border-[#E8A020] hover:text-[#E8A020] text-gray-600 rounded-full px-2.5 py-1 transition-colors"
                >
                  + {s}
                </button>
              ))}
              {PRESET_SERVICES.filter(s => !bookingPage.bookingServices.includes(s)).length === 0 && (
                <p className="text-xs text-gray-600">All preset services added!</p>
              )}
            </div>
          )}
        </div>
        <Button className="gradient-amber text-white border-0 hover:opacity-90 gap-2" onClick={() => updateBookingPage.mutate(bookingPage)} disabled={updateBookingPage.isPending}>
          {updateBookingPage.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Save Booking Page</>}
        </Button>
      </div>

      {/* iCal Feed */}
      <div className="space-y-3 p-5 bg-white rounded-2xl border border-gray-100">
        <h3 className="font-bold text-sm text-[#1C1C1E] flex items-center gap-2"><Calendar className="w-4 h-4 text-[#E8A020]" />Calendar Sync (iCal)</h3>
        <p className="text-xs text-gray-600">Subscribe to your booking calendar in Google Calendar, Apple Calendar, or Outlook using this live iCal feed URL.</p>
        {user?.id ? (
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100 min-w-0">
            <span className="text-xs text-gray-600 flex-1 truncate font-mono min-w-0">{window.location.origin}/api/calendar/{user.id}.ics</span>
            <button
              onClick={() => {
                const url = `${window.location.origin}/api/calendar/${user!.id}.ics`;
                navigator.clipboard.writeText(url).then(() => toast.success("iCal URL copied!")).catch(() => toast.info(`iCal URL: ${url}`));
              }}
              className="text-gray-600 hover:text-[#E8A020] transition-colors flex-shrink-0 p-1 rounded hover:bg-[#E8A020]/10"
              title="Copy iCal feed URL"
              aria-label="Copy iCal feed URL"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <a href={`${window.location.origin}/api/calendar/${user!.id}.ics`} download className="text-gray-600 hover:text-[#E8A020] transition-colors flex-shrink-0 p-1 rounded hover:bg-[#E8A020]/10" title="Download .ics file" aria-label="Download iCal file">
              <Download className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : (
          <p className="text-xs text-gray-600">Sign in to access your iCal feed.</p>
        )}
        {user?.id && (
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <a
              href={`https://calendar.google.com/calendar/r?cid=webcal://${typeof window !== 'undefined' ? window.location.host : ''}/api/calendar/${user.id}.ics`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors border border-blue-100"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 3h-3V1.5h-1.5V3h-6V1.5H7.5V3h-3C3.675 3 3 3.675 3 4.5v15C3 20.325 3.675 21 4.5 21h15c.825 0 1.5-.675 1.5-1.5v-15c0-.825-.675-1.5-1.5-1.5zm0 16.5h-15V9h15v10.5zM7.5 4.5V6H9V4.5h6V6h1.5V4.5h1.5V7.5h-12V4.5h1.5z"/></svg>
              Add to Google Calendar
            </a>
            <a
              href={`webcal://${typeof window !== 'undefined' ? window.location.host : ''}/api/calendar/${user.id}.ics`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-semibold transition-colors border border-gray-100"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>
              Subscribe (Apple / Outlook)
            </a>
          </div>
        )}
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <h3 className="font-bold text-sm text-[#1C1C1E] flex items-center gap-2"><Bell className="w-4 h-4 text-[#E8A020]" />Notifications</h3>
        {[
          { key: "notifyNewBooking" as const, label: "New Booking", desc: "Get notified when a client books a session" },
          { key: "notifyInvoicePaid" as const, label: "Invoice Paid", desc: "Get notified when an invoice is marked as paid" },
          { key: "notifyNewLead" as const, label: "New Lead", desc: "Get notified when someone joins the waitlist" },
        ].map(n => (
          <div key={n.key} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1C1C1E]">{n.label}</p>
              <p className="text-xs text-gray-600">{n.desc}</p>
            </div>
            <button
              onClick={() => setNotifications(p => ({ ...p, [n.key]: !p[n.key] }))}
              className={`w-11 h-6 rounded-full transition-colors relative ${notifications[n.key] ? "bg-[#E8A020]" : "bg-gray-200"}`}
              aria-label={`${notifications[n.key] ? "Disable" : "Enable"} ${n.label} notifications`}
              role="switch"
              aria-checked={notifications[n.key]}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifications[n.key] ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
        ))}
        <Button className="gradient-amber text-white border-0 hover:opacity-90 gap-2" onClick={() => updateNotifications.mutate(notifications)} disabled={updateNotifications.isPending}>
          {updateNotifications.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Save Preferences</>}
        </Button>
      </div>

      {/* Change Password */}
      <ChangePasswordSection />

      {/* Subscription */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <h3 className="font-bold text-sm text-[#1C1C1E] flex items-center gap-2"><CreditCard className="w-4 h-4 text-[#E8A020]" />Subscription</h3>
        <div className="flex items-center justify-between p-3 bg-[#E8A020]/5 border border-[#E8A020]/20 rounded-xl">
          <div>
            <p className="text-sm font-semibold text-[#1C1C1E] capitalize">{settings?.subscriptionStatus ?? "free"} Plan</p>
            <p className="text-xs text-gray-600">{settings?.subscriptionStatus === "active" ? "Active subscription" : "No active subscription"}</p>
          </div>
          <Badge className={`border-0 ${settings?.subscriptionStatus === "active" ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-600"}`}>
            {settings?.subscriptionStatus === "active" ? "Active" : "Free"}
          </Badge>
        </div>
        <Button className="w-full gradient-amber text-white border-0 hover:opacity-90" onClick={() => navigate("/billing")}>
          {settings?.subscriptionStatus === "active" ? "Manage Subscription" : "Upgrade to Pro — $99/month"}
        </Button>
      </div>

      {/* API Keys */}
      <ApiKeysSection />

      {/* Audit Log */}
      <AuditLogSection />
    </div>
  );
}

// ─── Contracts & Proposals Panel ────────────────────────────────────────────
function ContractsPanel() {
  const utils = trpc.useUtils();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<"all" | "contract" | "proposal">("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(defaultConfirm);
  const emptyForm = { clientName: "", clientEmail: "", title: "", type: "contract" as "contract" | "proposal", body: "", proposalAmount: "", expiresAt: "" };
  const [form, setForm] = useState(emptyForm);

  const { data: list = [], isLoading } = trpc.contracts.list.useQuery({ type: filterType });
  const { data: selected } = trpc.contracts.get.useQuery({ id: selectedId! }, { enabled: !!selectedId });
  const { data: clientList = [] } = trpc.clients.list.useQuery();

  const createMut = trpc.contracts.create.useMutation({ onSuccess: () => { utils.contracts.list.invalidate(); setShowForm(false); setForm(emptyForm); toast.success("Created!"); } });
  const updateMut = trpc.contracts.update.useMutation({ onSuccess: () => { utils.contracts.list.invalidate(); utils.contracts.get.invalidate(); setShowForm(false); setEditingId(null); toast.success("Saved!"); } });
  const deleteMut = trpc.contracts.delete.useMutation({ onSuccess: () => { utils.contracts.list.invalidate(); setSelectedId(null); toast.success("Deleted."); } });
  const convertMut = trpc.contracts.convertToInvoice.useMutation({ onSuccess: (data) => { utils.contracts.list.invalidate(); toast.success(`Converted to invoice #${data.invoiceId}!`); } });

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600",
    sent: "bg-blue-100 text-blue-700",
    signed: "bg-green-100 text-green-700",
    declined: "bg-red-100 text-red-700",
    expired: "bg-orange-100 text-orange-700",
  };

  function openEdit(c: typeof list[0]) {
    setForm({ clientName: c.clientName, clientEmail: c.clientEmail || "", title: c.title, type: c.type, body: c.body, proposalAmount: String(c.proposalAmount || ""), expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString().split("T")[0] : "" });
    setEditingId(c.id);
    setShowForm(true);
  }

  function handleSubmit() {
    if (!form.clientName.trim() || !form.title.trim() || !form.body.trim()) { toast.error("Client name, title, and body are required."); return; }
    if (editingId) {
      updateMut.mutate({ id: editingId, ...form });
    } else {
      createMut.mutate(form);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <ConfirmDialog open={confirm.open} onOpenChange={(o) => { if (!o) setConfirm(defaultConfirm); }} title={confirm.title} description={confirm.description} onConfirm={() => { confirm.onConfirm(); setConfirm(defaultConfirm); }} />
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#1C1C1E]" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Contracts & Proposals</h2>
          <p className="text-sm text-gray-600 mt-0.5">Create, send, and track contracts and proposals</p>
        </div>
        <Button onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(true); }} className="bg-[#E8A020] hover:bg-[#D4911A] text-white gap-2">
          <Plus className="w-4 h-4" /> New
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {(["all", "contract", "proposal"] as const).map(t => (
          <button key={t} onClick={() => setFilterType(t)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all capitalize ${ filterType === t ? "bg-[#E8A020] text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-[#E8A020]" }`}>{t === "all" ? "All" : t + "s"}</button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <FileSignature className="w-10 h-10 text-gray-500 mx-auto mb-3" />
          <p className="font-semibold text-gray-700 mb-1">No {filterType === "all" ? "contracts or proposals" : filterType + "s"} yet</p>
          <p className="text-sm text-gray-600 mb-4">Create your first one to get started</p>
          <Button onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(true); }} size="sm" className="bg-[#E8A020] hover:bg-[#D4911A] text-white">Create {filterType === "proposal" ? "Proposal" : "Contract"}</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${ c.type === "proposal" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700" }`}>{c.type}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColors[c.status] || "bg-gray-100 text-gray-600"}`}>{c.status}</span>
                    {c.proposalAmount && <span className="text-xs font-semibold text-[#E8A020]">{formatCurrency(c.proposalAmount)}</span>}
                  </div>
                  <p className="font-semibold text-[#1C1C1E] truncate">{c.title}</p>
                  <p className="text-sm text-gray-600">{c.clientName}{c.clientEmail ? ` · ${c.clientEmail}` : ""}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={e => { e.stopPropagation(); openEdit(c); }} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Edit"><Edit2 className="w-3.5 h-3.5 text-gray-600" /></button>
                  {c.type === "proposal" && c.status === "signed" && !c.linkedInvoiceId && (
                    <button onClick={e => { e.stopPropagation(); convertMut.mutate({ id: c.id }); }} className="p-1.5 rounded-lg hover:bg-green-50 transition-colors" aria-label="Convert to invoice" title="Convert to Invoice"><ArrowUpRight className="w-3.5 h-3.5 text-green-600" /></button>
                  )}
                  <button onClick={e => { e.stopPropagation(); setConfirm({ open: true, title: "Delete?", description: `Delete "${c.title}"? This cannot be undone.`, onConfirm: () => deleteMut.mutate({ id: c.id }) }); }} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" aria-label="Delete"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                </div>
              </div>
              {/* Expanded detail */}
              {selectedId === c.id && selected && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">{selected.body}</div>
                  <div className="flex items-center gap-3 mt-3">
                    {c.status === "draft" && <button onClick={e => { e.stopPropagation(); updateMut.mutate({ id: c.id, status: "sent" }); }} className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"><Send className="w-3 h-3" /> Mark as Sent</button>}
                    {c.status === "sent" && <button onClick={e => { e.stopPropagation(); updateMut.mutate({ id: c.id, status: "signed" }); }} className="text-xs font-semibold text-green-600 hover:underline flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Mark as Signed</button>}
                    {c.status === "sent" && <button onClick={e => { e.stopPropagation(); updateMut.mutate({ id: c.id, status: "declined" }); }} className="text-xs font-semibold text-red-500 hover:underline">Mark as Declined</button>}
                    {c.expiresAt && <span className="text-xs text-gray-600 ml-auto">Expires {formatDate(c.expiresAt)}</span>}
                    {c.sentAt && <span className="text-xs text-gray-600">Sent {formatDate(c.sentAt)}</span>}
                    {c.signedAt && <span className="text-xs text-green-600 font-medium">Signed {formatDate(c.signedAt)}</span>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={showForm} onClose={() => { setShowForm(false); setEditingId(null); }} title={editingId ? "Edit" : "New Contract / Proposal"} wide>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Type *</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as "contract" | "proposal" }))} className="form-input-light">
                <option value="contract">Contract</option>
                <option value="proposal">Proposal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Client *</label>
              <input list="contract-clients" value={form.clientName} onChange={e => { const c = clientList.find(c => c.name === e.target.value); setForm(p => ({ ...p, clientName: e.target.value, clientEmail: c?.email || p.clientEmail })); }} placeholder="Client name" className="form-input-light" />
              <datalist id="contract-clients">{clientList.map(c => <option key={c.id} value={c.name} />)}</datalist>
            </div>
          </div>
          <Field label="Title *" value={form.title} onChange={v => setForm(p => ({ ...p, title: v }))} placeholder="e.g. Freelance Web Design Contract" />
          <Field label="Client Email" value={form.clientEmail} onChange={v => setForm(p => ({ ...p, clientEmail: v }))} type="email" placeholder="client@example.com" />
          {form.type === "proposal" && <Field label="Proposal Amount ($)" value={form.proposalAmount} onChange={v => setForm(p => ({ ...p, proposalAmount: v }))} type="number" placeholder="1500" />}
          <Field label="Expiry Date" value={form.expiresAt} onChange={v => setForm(p => ({ ...p, expiresAt: v }))} type="date" />
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Body / Terms *</label>
            <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} rows={10} placeholder="Enter the contract terms, scope of work, deliverables, payment terms..." className="form-input-light resize-y" />
            <p className="text-xs text-gray-600 mt-1">Markdown supported. Use **bold**, # headings, - bullet lists.</p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending} className="bg-[#E8A020] hover:bg-[#D4911A] text-white flex-1">
              {(createMut.isPending || updateMut.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? "Save Changes" : "Create"}
            </Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }} className="flex-1">Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Mobile Bottom Nav ────────────────────────────────────────────────────────
// Strategy: 4 primary daily-use tabs + 1 "All Features" tab that opens a
// full-screen sheet listing every panel. 2 taps max to reach anything.
function MobileBottomNav({ active, setActive }: { active: ActivePanel; setActive: (p: ActivePanel) => void }) {
  const [showSheet, setShowSheet] = useState(false);
  const [, navigate] = useLocation();
  const { user } = useAuth();

  // Primary 4 tabs — the highest-frequency daily actions
  const primaryTabs = [
    { icon: LayoutDashboard, label: "Overview",  panel: "overview"   as ActivePanel },
    { icon: Users,           label: "Clients",   panel: "clients"    as ActivePanel },
    { icon: Calendar,        label: "Schedule",  panel: "scheduling" as ActivePanel },
    { icon: FileText,        label: "Invoices",  panel: "invoices"   as ActivePanel },
  ];

  // All panels available in the full-feature sheet, grouped by category
  const sheetSections = [
    {
      label: "Business",
      items: [
        { icon: Mail,          label: "Follow-Ups",    panel: "followups"  as ActivePanel },
        { icon: HeartPulse,    label: "Client Pulse",  panel: "pulse"      as ActivePanel, badge: "AI" },
        { icon: BarChart3,     label: "Analytics",     panel: "analytics"  as ActivePanel },
        { icon: Bot,           label: "AI Assistant",  panel: "ai"         as ActivePanel, badge: "AI" },
      ],
    },
    {
      label: "Finance",
      items: [
        { icon: RefreshCw,     label: "Recurring",     panel: "recurring"  as ActivePanel },
        { icon: Clock,         label: "Time Tracking", panel: "time"       as ActivePanel },
        { icon: FileSignature, label: "Contracts",     panel: "contracts"  as ActivePanel },
      ],
    },
    {
      label: "Account",
      items: [
        { icon: Settings,      label: "Settings",      panel: "settings"   as ActivePanel },
      ],
    },
  ];

  const isSheetPanelActive = !primaryTabs.some(t => t.panel === active);

  const handleSheetNav = (panel: ActivePanel) => {
    setActive(panel);
    setShowSheet(false);
  };

  return (
    // Outer wrapper: shrink-0 so the nav never gets squashed in the flex column.
    // NO fixed/transform on the nav itself — avoids iOS stacking-context bugs.
    // The sheet uses absolute positioning relative to this wrapper.
    <div className="shrink-0 relative md:hidden">
      {/* Full-feature sheet backdrop — covers only the viewport above the nav */}
      {showSheet && (
        <div
          className="fixed inset-0 z-40 bg-black/60"
          onClick={() => setShowSheet(false)}
          aria-hidden="true"
        />
      )}

      {/* Full-feature sheet — absolutely positioned above the nav bar, no transforms */}
      <div
        className={`absolute left-0 right-0 z-50 bg-[#1C1C1E] rounded-t-3xl shadow-2xl overflow-y-auto ${
          showSheet ? "block" : "hidden"
        }`}
        style={{ bottom: "100%", maxHeight: "70vh" }}
        role="dialog"
        aria-label="All features"
        aria-hidden={!showSheet}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="px-4 pb-6 pt-1 space-y-5">
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest px-1">All Features</p>

          {sheetSections.map((section) => (
            <div key={section.label}>
              <p className="text-[10px] font-semibold text-[#E8A020]/70 uppercase tracking-wider mb-2 px-1">{section.label}</p>
              <div className="grid grid-cols-4 gap-1.5">
                {section.items.map((item) => (
                  <button
                    key={item.panel}
                    onClick={() => handleSheetNav(item.panel)}
                    aria-label={item.label}
                    className={`relative flex flex-col items-center justify-center py-3.5 px-1 rounded-2xl gap-1.5 transition-all active:scale-95 ${
                      active === item.panel
                        ? "bg-[#E8A020]/20 text-[#E8A020]"
                        : "bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {item.badge && (
                      <span className="absolute top-1.5 right-1.5 text-[8px] font-bold bg-violet-500/30 text-violet-300 px-1 py-0.5 rounded-full leading-none">
                        {item.badge}
                      </span>
                    )}
                    <item.icon className="w-5 h-5" aria-hidden="true" />
                    <span className="text-[10px] font-medium text-center leading-tight">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Quick links row */}
          <div className="border-t border-white/10 pt-4 flex gap-2">
            <button
              onClick={() => { navigate("/billing"); setShowSheet(false); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white transition-all text-xs font-medium"
            >
              <CreditCard className="w-4 h-4" />
              Billing
            </button>
            {user?.role === "admin" && (
              <button
                onClick={() => { navigate("/admin"); setShowSheet(false); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white transition-all text-xs font-medium"
              >
                <Star className="w-4 h-4" />
                Admin
              </button>
            )}
            <button
              onClick={() => { navigate("/"); setShowSheet(false); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white transition-all text-xs font-medium"
            >
              <Home className="w-4 h-4" />
              Home
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Nav Bar — wrapper div already has display:block; nav fills it */}
      <nav
        className="w-full"
        aria-label="Mobile navigation"
        style={{
          background: "rgba(28, 28, 30, 0.97)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 10px)",
          paddingLeft:  "max(env(safe-area-inset-left,   0px), 0px)",
          paddingRight: "max(env(safe-area-inset-right,  0px), 0px)",
        }}
      >
        <div className="flex items-stretch">
          {/* 4 primary tabs */}
          {primaryTabs.map((tab) => {
            const isActive = active === tab.panel && !showSheet;
            return (
              <button
                key={tab.panel}
                onClick={() => { setActive(tab.panel); setShowSheet(false); }}
                aria-label={tab.label}
                aria-current={isActive ? "page" : undefined}
                className="flex-1 flex flex-col items-center justify-center pt-2.5 pb-1 gap-1 min-h-[52px] transition-all active:scale-95 relative"
                style={{ color: isActive ? "#E8A020" : "#6B7280" }}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[#E8A020]" />
                )}
                <tab.icon className="w-[22px] h-[22px]" aria-hidden="true" />
                <span className="text-[11px] font-medium leading-none">{tab.label}</span>
              </button>
            );
          })}

          {/* All Features button — opens the full sheet */}
          <button
            onClick={() => setShowSheet(v => !v)}
            aria-label="All features"
            aria-expanded={showSheet}
            className="flex-1 flex flex-col items-center justify-center pt-2.5 pb-1 gap-1 min-h-[52px] transition-all active:scale-95 relative"
            style={{ color: isSheetPanelActive || showSheet ? "#E8A020" : "#6B7280" }}
          >
            {(isSheetPanelActive || showSheet) && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[#E8A020]" />
            )}
            {/* 3×3 grid icon to signal "all features" */}
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.9" />
              <rect x="10" y="2" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.9" />
              <rect x="2" y="10" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.9" />
              <rect x="10" y="10" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.9" />
              <rect x="18" y="2" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
              <rect x="18" y="10" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
              <rect x="2" y="18" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
              <rect x="10" y="18" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
            </svg>
            <span className="text-[11px] font-medium leading-none">More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  // Read ?panel= from URL on first render for deep-linking (e.g. /dashboard?panel=invoices)
  const [active, setActive] = useState<ActivePanel>(() => {
    if (typeof window !== "undefined") {
      const param = new URLSearchParams(window.location.search).get("panel");
      const valid: ActivePanel[] = ["overview","clients","scheduling","invoices","followups","analytics","settings","ai","pulse","contracts","time","recurring"];
      if (param && valid.includes(param as ActivePanel)) return param as ActivePanel;
    }
    return "overview";
  });
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("trueaxis_sidebar_collapsed") === "1"; } catch { return false; }
  });
  const handleSetCollapsed = (v: boolean | ((prev: boolean) => boolean)) => {
    setCollapsed(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      try { localStorage.setItem("trueaxis_sidebar_collapsed", next ? "1" : "0"); } catch {}
      return next;
    });
  };
  const [showNotifications, setShowNotifications] = useState(false);
  // Floating AI assistant — visible when user opens the AI panel or clicks the bubble
  const [aiVisible, setAiVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState>(defaultConfirm);
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const utils = trpc.useUtils();
  // Notifications — real-time bell
  const { data: notifList } = trpc.notifications.list.useQuery(undefined, { refetchInterval: 30_000, enabled: isAuthenticated });
  const { data: unreadData } = trpc.notifications.unreadCount.useQuery(undefined, { refetchInterval: 30_000, enabled: isAuthenticated });
  const { data: settings } = trpc.settings.get.useQuery(undefined, { enabled: isAuthenticated, retry: 1 });
  const markReadMutation = trpc.notifications.markRead.useMutation({ onSuccess: () => { utils.notifications.list.invalidate(); utils.notifications.unreadCount.invalidate(); } });
  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({ onSuccess: () => { utils.notifications.list.invalidate(); utils.notifications.unreadCount.invalidate(); } });
  const dismissNotifMutation = trpc.notifications.dismiss.useMutation({ onSuccess: () => { utils.notifications.list.invalidate(); utils.notifications.unreadCount.invalidate(); } });
  const unreadCount = unreadData?.count ?? 0;

  // Scroll to top of main content when switching panels
  const setActiveWithScroll = (panel: ActivePanel) => {
    setActive(panel);
    // Automatically show the floating AI widget when navigating to the AI panel
    if (panel === "ai") setAiVisible(true);
    requestAnimationFrame(() => {
      mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  // Global keyboard shortcuts: Alt+1..9 for panel navigation
  useEffect(() => {
    const panels: ActivePanel[] = ["overview", "clients", "scheduling", "invoices", "followups", "analytics", "ai", "pulse", "settings"];
    const handleKey = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const idx = parseInt(e.key) - 1;
        if (idx >= 0 && idx < panels.length) {
          e.preventDefault();
          setActiveWithScroll(panels[idx]);
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/");
  }, [loading, isAuthenticated, navigate]);

  if (loading) return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-[#E8A020] animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-600">Loading your dashboard...</p>
      </div>
    </div>
  );

  const panelTitles: Record<ActivePanel, string> = {
    overview: "Dashboard", clients: "Clients", scheduling: "Scheduling",
    invoices: "Invoices", followups: "Follow-Ups", analytics: "Analytics",
    settings: "Settings", ai: "AI Assistant", pulse: "Client Pulse",
    contracts: "Contracts & Proposals", time: "Time Tracking", recurring: "Recurring Invoices",
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
      case "ai": return (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-full gradient-amber flex items-center justify-center shadow-lg">
            <span className="text-3xl">✨</span>
          </div>
          <h2 className="text-xl font-bold text-[#1C1C1E]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>AI Assistant</h2>
          <p className="text-gray-600 text-sm max-w-xs">
            Your AI assistant is floating on screen — drag it anywhere and chat while you work.
          </p>
          {!aiVisible && (
            <button
              onClick={() => setAiVisible(true)}
              className="mt-2 px-5 py-2.5 rounded-xl gradient-amber text-white text-sm font-semibold shadow hover:opacity-90 transition-all"
            >
              Open AI Assistant
            </button>
          )}
          {aiVisible && (
            <p className="text-xs text-[#E8A020] font-medium">AI Assistant is open — look for the floating bubble ✨</p>
          )}
        </div>
      );
      case "pulse": return <ClientPulsePanel />;
      case "contracts": return <ContractsPanel />;
      case "time": return <TimeTrackingPanel />;
      case "recurring": return <RecurringInvoicesPanel />;
      default: return null;
    }
  };

  return (
    <div className="bg-[#F5F5F7] flex flex-col md:flex-row overflow-x-hidden w-full" style={{ height: '100dvh' }}>
      {/* Skip link */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded-xl focus:shadow-lg focus:text-[#E8A020] focus:font-semibold">
        Skip to main content
      </a>

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar active={active} setActive={setActiveWithScroll} collapsed={collapsed} setCollapsed={handleSetCollapsed} />
      </div>

      {/* Main Content */}
      <main
        id="main-content"
        ref={mainRef}
        className={`flex-1 min-w-0 transition-all duration-300 ${collapsed ? "md:ml-16" : "md:ml-60"} md:pb-8 overflow-y-auto overflow-x-hidden`}
        style={{ minHeight: 0 } as React.CSSProperties}
        tabIndex={-1}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile logo + panel title */}
            <div className="flex items-center gap-2 md:hidden">
              <button
                onClick={() => setActiveWithScroll("overview")}
                aria-label="Go to Overview"
                title="Overview"
                style={{ background: "none", border: "none", minHeight: "auto", minWidth: "auto", padding: 0 }}
              >
                <img
                  src="https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/logo-r1_d9d437c8.png"
                  alt="TrueAxis HQ — Dashboard"
                  className="h-7 w-auto object-contain"
                />
              </button>
              <span className="text-sm font-bold text-[#1C1C1E]" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                {panelTitles[active]}
              </span>
            </div>
            <h1 className="hidden md:block text-base font-bold text-[#1C1C1E]" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              {panelTitles[active]}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative hidden lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && search.trim()) {
                    sessionStorage.setItem("dashboardSearch", search.trim());
                    setActiveWithScroll("clients");
                    setSearch("");
                  }
                }}
                placeholder="Search clients... (Enter)"
                className="form-input-light pl-8 pr-4 w-52"
                aria-label="Quick search — press Enter to search clients"
                autoComplete="off"
                enterKeyHint="search"
              />
            </div>

            {/* Health Monitor */}
            <HealthMonitor />
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications && unreadCount > 0) markAllReadMutation.mutate(); }}
                className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors"
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                aria-expanded={showNotifications}
              >
                <Bell className="w-4 h-4 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" aria-hidden="true" />
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-bold text-[#1C1C1E]">Notifications</p>
                    {(notifList?.length ?? 0) > 0 && (
                      <button onClick={() => markAllReadMutation.mutate()} className="text-xs text-[#E8A020] hover:underline font-medium">Mark all read</button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {!notifList || notifList.length === 0 ? (
                      <div className="py-8 text-center">
                        <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                        <p className="text-xs text-gray-600">No notifications yet</p>
                      </div>
                    ) : (
                      notifList.map(n => (
                        <div key={n.id} className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${!n.read ? 'bg-amber-50/50' : ''}`}>
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.type === 'success' ? 'bg-green-400' : n.type === 'error' ? 'bg-red-400' : 'bg-blue-400'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-[#1C1C1E] truncate">{n.title}</p>
                            <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{n.body}</p>
                            <p className="text-[10px] text-gray-600 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                          </div>
                          <button onClick={() => dismissNotifMutation.mutate({ id: n.id })} className="p-1 rounded hover:bg-gray-200 transition-colors flex-shrink-0" aria-label="Dismiss">
                            <X className="w-3 h-3 text-gray-600" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Plan Badge */}
            {settings?.subscriptionStatus === "active" && (
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E8A020]/15 text-[#E8A020] border border-[#E8A020]/30 capitalize">
                {settings.planId || "Pro"}
              </span>
            )}

            {/* User Avatar */}
            <div
              className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 cursor-pointer"
              aria-label={`Logged in as ${user?.name || "User"}`}
              onClick={() => setActiveWithScroll("settings")}
              title="Go to Settings"
            >
              {(user as any)?.avatarUrl ? (
                <img src={(user as any).avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full gradient-amber flex items-center justify-center text-white text-xs font-bold">
                  {user?.name?.slice(0, 2).toUpperCase() || "U"}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Panel Content — pb-[72px] ensures content clears the fixed-height mobile nav bar */}
        <div className="p-4 md:p-6 max-w-6xl mx-auto w-full overflow-x-hidden pb-[72px] md:pb-6">
          {renderPanel()}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <MobileBottomNav active={active} setActive={setActiveWithScroll} />
      {/* Floating AI Assistant — persists across all panels, draggable */}
      <AIAssistant
        visible={aiVisible}
        onClose={() => setAiVisible(false)}
      />

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
 
