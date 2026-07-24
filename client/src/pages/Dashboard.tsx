/* TrueAxis HQ — Full Dashboard (DB-backed)
 * All panels connected to real tRPC/database procedures
 * Design: "Kinetic Warmth" — Dark sidebar (#1C2333), Teal (#D4922A), Coral (#FF6B6B)
 */

import { useState, useEffect, useRef, useLayoutEffect, useCallback, memo, useMemo } from "react";
import { useFormFields } from "@/hooks/useFormFields";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import ClientPulsePanel from "./ClientPulse";
import TimeTrackingPanel from "./TimeTracking";
import Services from "./Services";
import Expenses from "./Expenses";
import Proposals from "./Proposals";
import Automations from "./Automations";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AIAssistant from "@/components/AIAssistant";
import { HealthMonitor } from "@/components/HealthMonitor";
import { PanelErrorBoundary } from "@/components/PanelErrorBoundary";
import GlobalSearch from "@/components/GlobalSearch";
import BillingPanel from "./BillingPanel";
import OutreachPanel from "./OutreachPanel";
import DealsPanel from "./DealsPanel";
import InsightsPanel from "./InsightsPanel";
import {
  LayoutDashboard, Users, Calendar, FileText, Mail,
  BarChart3, Settings, Zap, Plus, TrendingUp,
  DollarSign, Clock, CheckCircle, ArrowUpRight,
  ChevronRight, LogOut, X, Edit2, Trash2, Send,
  Download, Phone, AlertCircle, RefreshCw, User,
  Building, Save, Bot, CreditCard,
  ExternalLink, Bell, Search, ChevronDown, Loader2, Link,
  Globe, ToggleLeft, ToggleRight, Printer, Eye, EyeOff,
  Copy, Check, Star, Activity, HeartPulse, MoreHorizontal, Camera, FileSignature, Sparkles, Upload,
  Home, Crown, ArrowRight, Shield, Inbox, MessageSquare, Tag, ThumbsUp, CalendarX, Link2, Wifi, WifiOff,
  Package, Receipt
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
  PieChart, Pie, Cell
} from "recharts";

type ActivePanel = "overview" | "clients" | "scheduling" | "invoices" | "followups" | "analytics" | "settings" | "ai" | "pulse" | "contracts" | "time" | "inbox" | "testimonials" | "services" | "expenses" | "proposals" | "automations" | "billing" | "outreach" | "deals" | "insights";

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
  return <div className={`animate-pulse bg-white/8 rounded-lg ${className}`} />;
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Keep a ref so the keydown handler always calls the latest onClose without
  // being listed as a dependency — this prevents the effect from re-running
  // (and stealing focus from inputs) every time the parent re-renders and
  // passes a new inline arrow function as onClose.
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    document.addEventListener("keydown", handleKey);
    // Focus the modal backdrop only on initial open, not on every re-render.
    // requestAnimationFrame defers until after paint so the modal is visible.
    const raf = requestAnimationFrame(() => { ref.current?.focus(); });
    return () => { document.removeEventListener("keydown", handleKey); cancelAnimationFrame(raf); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        tabIndex={-1}
        className={`relative bg-[#161B22] rounded-xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[90vh] overflow-y-auto outline-none`}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <h2 className="font-bold text-[#F5EFE3] text-base">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#243040] transition-colors" aria-label="Close dialog">
            <X className="w-4 h-4 text-[rgba(245,239,227,0.55)]" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
// ─── Input Field ─────────────────────────────────────────────────────────────────────────────────
// Memoized to prevent re-renders when parent state changes unrelated to this field
const Field = memo(function Field({ label, value, onChange, placeholder, type = "text", required, textarea, rows = 3, autoComplete, enterKeyHint }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean; textarea?: boolean; rows?: number;
  autoComplete?: string; enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
}) {
  const cls = "form-input-light";
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea using useLayoutEffect to avoid synchronous layout reflow in onChange
  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  return (
    <div>
      <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">{label}{required && " *"}</label>
      {textarea
        ? <textarea
            ref={taRef}
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            rows={rows}
            className={`${cls} resize-none overflow-hidden`}
            style={{ minHeight: `${(rows ?? 3) * 1.6}rem` }}
            enterKeyHint={enterKeyHint}
            autoComplete={autoComplete ?? "off"}
            autoCorrect="off"
            spellCheck={false}
          />
        : <input
            type={type === "number" ? "text" : type}
            inputMode={type === "number" ? "decimal" : type === "email" ? "email" : type === "tel" ? "tel" : type === "url" ? "url" : undefined}
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            className={cls}
            autoComplete={autoComplete ?? (type === "email" ? "email" : type === "tel" ? "tel" : "off")}
            autoCorrect={type === "email" || type === "tel" || type === "number" || type === "url" ? "off" : undefined}
            autoCapitalize={type === "email" || type === "tel" || type === "number" || type === "url" ? "none" : "sentences"}
            spellCheck={type === "email" || type === "tel" || type === "number" || type === "url" ? false : undefined}
            enterKeyHint={enterKeyHint}
          />
      }
    </div>
  );
});
// ─── useFormField ─────────────────────────────────────────────────────────────
// Returns a stable setter for a single field in a form state object.
// Using this avoids creating new arrow function references on every render,
// which would bypass React.memo on the Field component and cause unnecessary re-renders.
function useFormField<T extends Record<string, unknown>>(setter: React.Dispatch<React.SetStateAction<T>>, field: keyof T) {
  return useCallback((v: string) => setter(p => ({ ...p, [field]: v })), [setter, field]);
}

// ─── LineItemRow ──────────────────────────────────────────────────────────────
// Memoized row for invoice line items. Stable onChangeDesc/onChangeQty/onChangePrice
// callbacks prevent re-renders of sibling rows when one field changes.
interface LineItem { description: string; qty: number; unitPrice: number; }
const LineItemRow = memo(function LineItemRow({
  item, idx, onChangeDesc, onChangeQty, onChangePrice, onRemove
}: {
  item: LineItem; idx: number;
  onChangeDesc: (idx: number, v: string) => void;
  onChangeQty: (idx: number, v: string) => void;
  onChangePrice: (idx: number, v: string) => void;
  onRemove: (idx: number) => void;
}) {
  const handleDesc  = useCallback((e: React.ChangeEvent<HTMLInputElement>) => onChangeDesc(idx, e.target.value), [idx, onChangeDesc]);
  const handleQty   = useCallback((e: React.ChangeEvent<HTMLInputElement>) => onChangeQty(idx, e.target.value), [idx, onChangeQty]);
  const handlePrice = useCallback((e: React.ChangeEvent<HTMLInputElement>) => onChangePrice(idx, e.target.value), [idx, onChangePrice]);
  const handleRemove = useCallback(() => onRemove(idx), [idx, onRemove]);
  return (
    <div className="grid grid-cols-[1fr_60px_80px_28px] gap-1.5 items-center">
      <input
        value={item.description}
        onChange={handleDesc}
        placeholder="Description"
        className="form-input-light text-xs"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="sentences"
        spellCheck={false}
      />
      <input
        type="text"
        inputMode="decimal"
        min="1"
        value={item.qty}
        onChange={handleQty}
        placeholder="Qty"
        className="form-input-light text-xs text-center"
        autoComplete="off"
      />
      <input
        type="text"
        inputMode="decimal"
        min="0"
        value={item.unitPrice}
        onChange={handlePrice}
        placeholder="Price"
        className="form-input-light text-xs"
        autoComplete="off"
      />
      <button
        type="button"
        onClick={handleRemove}
        className="text-red-400 hover:text-red-600 text-lg leading-none"
        aria-label={`Remove line item ${idx + 1}`}
      >&times;</button>
    </div>
  );
});

// ─── Sidebar ─────────────────────────────────────────────────────────────────
const navItems: { icon: React.ElementType; label: string; panel: ActivePanel; badge?: string }[] = [
  { icon: LayoutDashboard, label: "Dashboard",  panel: "overview"   },
  { icon: Users,           label: "Clients",    panel: "clients"    },
  { icon: Calendar,        label: "Scheduling", panel: "scheduling" },
  { icon: FileText,        label: "Billing",    panel: "billing"    },
  { icon: Mail,            label: "Outreach",   panel: "outreach"   },
  { icon: FileSignature,   label: "Deals",      panel: "deals"      },
  { icon: BarChart3,       label: "Insights",   panel: "insights",  badge: "AI" },
  { icon: Settings,        label: "Settings",   panel: "settings"   },
  { icon: Bot,             label: "AI Assistant", panel: "ai"       },
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
      className={`fixed left-0 top-0 h-full bg-[#1C2333] flex flex-col transition-all duration-300 z-40 ${collapsed ? "w-16" : "w-60"}`}
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

      {/* Nav — scrollable, footer stays pinned */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto min-h-0 scroll-smooth sidebar-scrollbar" aria-label="Dashboard sections">
        {navItems.map((item) => (
          <button
            key={item.panel}
            onClick={() => setActive(item.panel)}
            aria-current={active === item.panel ? "page" : undefined}
            aria-label={item.label}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative ${
              active === item.panel
                ? "bg-[#D4922A]/15 text-[#D4922A] border-l-2 border-[#D4922A] pl-[10px]"
                : "text-[rgba(245,239,227,0.55)] hover:bg-white/8 hover:text-white border-l-2 border-transparent pl-[10px]"
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

        {(user as any)?.isOwner && (
          <button onClick={() => navigate("/admin")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[rgba(245,239,227,0.40)] hover:bg-white/8 hover:text-white transition-all" aria-label="Admin panel">
            <Star className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Admin Panel</span>}
          </button>
        )}
        {/* Keyboard shortcuts hint */}
        {!collapsed && (
          <div className="px-3 py-2 rounded-xl bg-white/4 border border-white/6">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[rgba(245,239,227,0.30)] mb-1.5">Shortcuts</p>
            <div className="space-y-1">
              {[
                { keys: ["⌘", "K"], label: "Search" },
                { keys: ["N"],       label: "Billing" },
                { keys: ["C"],       label: "Clients" },
                { keys: ["B"],       label: "Schedule" },
                { keys: ["O"],       label: "Outreach" },
                { keys: ["D"],       label: "Deals" },
                { keys: ["I"],       label: "Insights" },
              ].map(({ keys, label }) => (
                <div key={label + keys.join()} className="flex items-center justify-between">
                  <span className="text-[10px] text-[rgba(245,239,227,0.40)]">{label}</span>
                  <div className="flex items-center gap-0.5">
                    {keys.map(k => (
                      <kbd key={k} className="px-1 py-0.5 rounded border border-white/15 text-[9px] text-[rgba(245,239,227,0.40)] font-mono leading-none">{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Collapse / Expand toggle */}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[rgba(245,239,227,0.40)] hover:bg-white/8 hover:text-white transition-all"
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
      <div className="relative bg-[#161B22] rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <div>
            <h2 className="font-extrabold text-[#F5EFE3] text-base">What's New in v{CHANGELOG_VERSION} 🎉</h2>
            <p className="text-xs text-[rgba(245,239,227,0.55)] mt-0.5">TrueAxis HQ — Latest Updates</p>
          </div>
          <button onClick={dismiss} className="p-2 rounded-lg hover:bg-[#243040] transition-colors" aria-label="Close">
            <X className="w-4 h-4 text-[rgba(245,239,227,0.55)]" />
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
                <p className="text-sm font-bold text-[#F5EFE3]">{item.title}</p>
                <p className="text-xs text-[rgba(245,239,227,0.55)] mt-0.5">{item.desc}</p>
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
  const { data: overdueInvoices } = trpc.invoices.list.useQuery({ status: "overdue" }, { retry: 1 });
  const { data: pulseData } = trpc.pulse.getAll.useQuery(undefined, { retry: 1 });
  const { data: pnlData } = trpc.expenses.pnl.useQuery({}, { retry: 1 });
  const todayStr = new Date().toISOString().split("T")[0];
  const todayBookings = (recentBookings || []).filter(b => b.date === todayStr);

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
    { label: "Total Revenue", value: formatCurrency(analytics?.totalRevenue || 0), change: "+12% this month", icon: DollarSign, color: "#D4922A" },
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
        <h1 className="text-2xl font-extrabold text-[#F5EFE3]">
          {getGreeting()}, {userName || "there"} 👋
        </h1>
        <p className="text-sm text-[rgba(245,239,227,0.55)] mt-1">Here's what's happening with your business today.</p>
      </div>
      <OnboardingChecklist onNavigate={(panel) => setActivePanel(panel as ActivePanel)} />

      {/* ⚠️ Overdue Invoice Alert Banner */}
      {overdueInvoices && overdueInvoices.length > 0 && (
        <button
          onClick={() => setActivePanel("invoices")}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/8 hover:bg-red-500/12 transition-all text-left group alert-pulse"
          aria-label={`${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? 's' : ''} — click to view`}
        >
          <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-4 h-4 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-400">
              {overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? 's' : ''} — {formatCurrency(overdueInvoices.reduce((s, i) => s + parseFloat(String(i.amount)), 0))} outstanding
            </p>
            <p className="text-xs text-[rgba(245,239,227,0.45)] mt-0.5">
              {overdueInvoices.slice(0, 2).map(i => i.clientName).join(", ")}{overdueInvoices.length > 2 ? ` +${overdueInvoices.length - 2} more` : ""}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </button>
      )}

      {/* 📅 Today's Sessions Banner */}
      {todayBookings.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#D4922A]/25 bg-[#D4922A]/6">
          <div className="w-8 h-8 rounded-lg bg-[#D4922A]/15 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-4 h-4 text-[#D4922A]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#D4922A]">
              {todayBookings.length} session{todayBookings.length > 1 ? 's' : ''} today
            </p>
            <p className="text-xs text-[rgba(245,239,227,0.45)] mt-0.5 truncate">
              {todayBookings.map(b => `${b.clientName} at ${b.time}`).join(" · ")}
            </p>
          </div>
          <button onClick={() => setActivePanel("scheduling")} className="text-xs text-[#D4922A] font-semibold hover:underline flex-shrink-0">View</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-[#161B22] rounded-xl p-4 sm:p-5 border border-white/8 card-lift group transition-all duration-200 hover:border-white/15" style={{ '--card-glow': s.color } as React.CSSProperties}>
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white stat-icon-pop" style={{ backgroundColor: s.color }}>
                <s.icon className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[rgba(245,239,227,0.45)]" aria-hidden="true" />
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-[#F5EFE3] leading-tight">{s.value}</p>
            <p className="text-[11px] sm:text-xs text-[rgba(245,239,227,0.55)] mt-0.5 leading-snug">{s.label}</p>
            <p className="text-[11px] sm:text-xs font-medium mt-1" style={{ color: s.color }}>{s.change}</p>
          </div>
        ))}
      </div>

      {/* P&L Summary Card */}
      {pnlData && (
        <button
          onClick={() => setActivePanel("insights")}
          className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-white/8 bg-[#161B22] hover:border-[#D4922A]/40 hover:bg-[#D4922A]/5 transition-all text-left group card-lift"
          style={{ '--card-glow': pnlData.netProfit >= 0 ? '#22c55e' : '#FF6B6B' } as React.CSSProperties}
          aria-label="View P&L breakdown in Insights"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: pnlData.netProfit >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(255,107,107,0.15)' }}>
            <TrendingUp className="w-4 h-4" style={{ color: pnlData.netProfit >= 0 ? '#22c55e' : '#FF6B6B' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-base font-extrabold" style={{ color: pnlData.netProfit >= 0 ? '#22c55e' : '#FF6B6B' }}>
                {pnlData.netProfit >= 0 ? '+' : ''}{formatCurrency(pnlData.netProfit)} net profit
              </span>
              <span className="text-xs text-[rgba(245,239,227,0.45)]">this period</span>
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-xs text-[rgba(245,239,227,0.55)]">Revenue: <span className="text-[#D4922A] font-semibold">{formatCurrency(pnlData.totalRevenue)}</span></span>
              <span className="text-xs text-[rgba(245,239,227,0.30)]">·</span>
              <span className="text-xs text-[rgba(245,239,227,0.55)]">Expenses: <span className="text-red-400 font-semibold">{formatCurrency(pnlData.totalExpenses)}</span></span>
              <span className="text-xs text-[rgba(245,239,227,0.30)]">·</span>
              <span className="text-xs text-[rgba(245,239,227,0.55)]">Margin: <span className="font-semibold" style={{ color: pnlData.netProfit >= 0 ? '#22c55e' : '#FF6B6B' }}>{pnlData.profitMargin}%</span></span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[rgba(245,239,227,0.30)] group-hover:text-[#D4922A] transition-colors flex-shrink-0" />
        </button>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {([
          { icon: Plus, label: "Add Client", color: "#6366F1", panel: "clients", shortcut: "C" },
          { icon: Calendar, label: "New Booking", color: "#F59E0B", panel: "scheduling", shortcut: "B" },
          { icon: FileText, label: "New Invoice", color: "#D4922A", panel: "billing", shortcut: "N" },
          { icon: Mail, label: "Outreach", color: "#5A9A7A", panel: "outreach", shortcut: "O" },
        ] as { icon: React.ElementType; label: string; color: string; panel: ActivePanel; shortcut: string | null }[]).map(({ icon: Icon, label, color, panel, shortcut }) => (
          <button
            key={label}
            onClick={() => setActivePanel(panel)}
            className="bg-[#161B22] rounded-xl p-3 sm:p-4 border border-white/8 card-lift flex flex-col items-center gap-1.5 sm:gap-2 text-center transition-all group relative"
            style={{ '--card-glow': color } as React.CSSProperties}
          >
            {shortcut && (
              <kbd className="absolute top-2 right-2 px-1 py-0.5 rounded border border-white/12 text-[8px] text-[rgba(245,239,227,0.30)] font-mono leading-none hidden sm:block">{shortcut}</kbd>
            )}
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-white stat-icon-pop" style={{ backgroundColor: color }}>
              <Icon className="w-4 h-4" aria-hidden="true" />
            </div>
            <span className="text-[11px] sm:text-xs font-semibold text-[#F5EFE3] leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-[#161B22] rounded-xl p-5 border border-white/8">
          <h3 className="font-bold text-[#F5EFE3] text-sm mb-4">Revenue (Last 6 Months)</h3>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4922A" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#D4922A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: "12px" }} formatter={(v: number) => [formatCurrency(v), "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#D4922A" strokeWidth={2.5} fill="url(#amberGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-[rgba(245,239,227,0.55)]">
              <Activity className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">Revenue data will appear once you create paid invoices.</p>
            </div>
          )}
        </div>

        <div className="bg-[#161B22] rounded-xl p-5 border border-white/8">
          <h3 className="font-bold text-[#F5EFE3] text-sm mb-4">Client Growth</h3>
          {clientGrowthData.some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={clientGrowthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: "12px" }} />
                <Bar dataKey="count" fill="#D4922A" radius={[6, 6, 0, 0]} name="New Clients" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-[rgba(245,239,227,0.55)]">
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
          <div className="bg-[#161B22] rounded-xl border border-white/8 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-[#D4922A]" />
                <h3 className="font-bold text-sm text-[#F5EFE3]">Client Pulse</h3>
                <span className="text-xs bg-[#D4922A]/10 text-[#D4922A] font-semibold px-2 py-0.5 rounded-full">AI</span>
              </div>
              <button onClick={() => setActivePanel("pulse")} className="text-xs text-[#D4922A] hover:underline font-medium flex items-center gap-1">
                View All <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-[#1C2333] rounded-xl">
                <p className="text-2xl font-extrabold" style={{ color: avgScore !== null ? (avgScore >= 70 ? "#D4922A" : avgScore >= 40 ? "#F59E0B" : "#FF6B6B") : "#9CA3AF" }}>{avgScore ?? "—"}</p>
                <p className="text-xs text-[rgba(245,239,227,0.55)] mt-0.5">Avg Health</p>
              </div>
              <div className="text-center p-3 bg-red-500/10 rounded-xl">
                <p className="text-2xl font-extrabold text-[#FF6B6B]">{churnRisk}</p>
                <p className="text-xs text-[rgba(245,239,227,0.55)] mt-0.5">Churn Risk</p>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-xl">
                <p className="text-2xl font-extrabold text-yellow-600">{goingSilent}</p>
                <p className="text-xs text-[rgba(245,239,227,0.55)] mt-0.5">Going Silent</p>
              </div>
              <div className="text-center p-3 bg-[#D4922A]/10 rounded-xl">
                <p className="text-2xl font-extrabold text-[#D4922A]">{upsellReady}</p>
                <p className="text-xs text-[rgba(245,239,227,0.55)] mt-0.5">Upsell Ready</p>
              </div>
            </div>
            {churnRisk > 0 && (
              <div className="mt-3 flex items-center gap-2 p-3 bg-red-500/10 rounded-xl border border-red-100">
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
        <div className="bg-[#161B22] rounded-xl border border-white/8 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h3 className="font-bold text-sm text-[#F5EFE3]">Recent Clients</h3>
            <span className="text-xs text-[#D4922A] font-medium">{recentClients?.length || 0} total</span>
          </div>
          {!recentClients || recentClients.length === 0 ? (
            <div className="py-10 text-center text-[rgba(245,239,227,0.55)]">
              <Users className="w-7 h-7 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No clients yet. Add your first client!</p>
            </div>
          ) : recentClients.slice(0, 5).map(c => (
            <div key={c.id} className="flex items-center gap-3 px-5 py-3 border-t border-white/5 hover:bg-[#1C2333] transition-colors">
              <div className="w-8 h-8 rounded-full gradient-amber flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {c.avatarInitials || c.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#F5EFE3] truncate">{c.name}</p>
                <p className="text-xs text-[rgba(245,239,227,0.55)] truncate">{c.service || "General Client"}</p>
              </div>
              <Badge className={`text-xs border-0 ${c.status === "active" ? "bg-green-500/10 text-green-600" : c.status === "prospect" ? "bg-yellow-50 text-yellow-600" : "bg-[#243040] text-[rgba(245,239,227,0.55)]"}`}>
                {c.status}
              </Badge>
            </div>
          ))}
        </div>

        <div className="bg-[#161B22] rounded-xl border border-white/8 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h3 className="font-bold text-sm text-[#F5EFE3]">Upcoming Sessions</h3>
            <span className="text-xs text-[#D4922A] font-medium">{recentBookings?.length || 0} scheduled</span>
          </div>
          {!recentBookings || recentBookings.length === 0 ? (
            <div className="py-10 text-center text-[rgba(245,239,227,0.55)]">
              <Calendar className="w-7 h-7 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No upcoming sessions. Create a booking!</p>
            </div>
          ) : recentBookings.slice(0, 5).map(b => (
            <div key={b.id} className="flex items-center gap-3 px-5 py-3 border-t border-white/5 hover:bg-[#1C2333] transition-colors">
              <div className="w-8 h-8 rounded-xl bg-[#D4922A]/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-[#D4922A]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#F5EFE3] truncate">{b.clientName}</p>
                <p className="text-xs text-[rgba(245,239,227,0.55)]">{b.date} at {b.time}</p>
              </div>
              <span className="text-xs text-[rgba(245,239,227,0.55)]">{b.duration}m</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Clients Panel ────────────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { id: "inquiry" as const, label: "Inquiry", color: "#6B7280", bg: "rgba(107,114,128,0.15)", desc: "New leads" },
  { id: "proposal_sent" as const, label: "Proposal Sent", color: "#D4922A", bg: "rgba(212,146,42,0.15)", desc: "Awaiting decision" },
  { id: "active" as const, label: "Active", color: "#00C9A7", bg: "rgba(0,201,167,0.15)", desc: "Current clients" },
  { id: "completed" as const, label: "Completed", color: "#3B82F6", bg: "rgba(59,130,246,0.15)", desc: "Finished projects" },
  { id: "lost" as const, label: "Lost", color: "#EF4444", bg: "rgba(239,68,68,0.15)", desc: "Didn't convert" },
];
type PipelineStageId = "inquiry" | "proposal_sent" | "active" | "completed" | "lost";

function ClientsPanel() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "prospect">("all");
  const [viewMode, setViewMode] = useState<"list" | "pipeline">("list");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", service: "", status: "active" as "active" | "inactive" | "prospect", notes: "", defaultRate: "" });
  const setClientFormField = useFormFields(setForm);
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
  const { data: pipelineData, isLoading: pipelineLoading } = trpc.clients.listByStage.useQuery(undefined, { enabled: viewMode === "pipeline" });
  const updateStage = trpc.clients.updateStage.useMutation({
    onSuccess: () => { utils.clients.listByStage.invalidate(); toast.success("Stage updated!"); },
    onError: (e) => toast.error(e.message),
  });
  const pulseMap = new Map((pulseData ?? []).map(d => [d.client.id, d.pulse]));

  const createClient = trpc.clients.create.useMutation({
    onSuccess: () => { utils.clients.list.invalidate(); toast.success("Client added successfully!"); setShowAdd(false); setForm({ name: "", email: "", phone: "", service: "", status: "active", notes: "", defaultRate: "" }); },
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



  // Detect delimiter: tab, semicolon, or comma
  const detectDelimiter = (firstLine: string): string => {
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    if (tabCount >= semiCount && tabCount >= commaCount) return "\t";
    if (semiCount > commaCount) return ";";
    return ",";
  };

  // RFC 4180-compliant CSV field parser (handles quoted fields with commas/newlines)
  const parseCSVLine = (line: string, delim: string): string[] => {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === delim && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const parseCsv = (text: string) => {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return;
    const delim = detectDelimiter(lines[0]);
    const rawHeaders = parseCSVLine(lines[0], delim).map(h => h.toLowerCase().replace(/["'\s_-]/g, ""));

    // Column detection — broad aliases covering:
    // HoneyBook, Dubsado, 17hats, Calendly, Acuity, Square, Stripe, Mailchimp,
    // ActiveCampaign, Pipedrive, Salesforce, Zoho, Airtable, Google Contacts,
    // Outlook Contacts, Notion, and generic CRM exports
    const findCol = (aliases: string[]): number =>
      rawHeaders.findIndex(h => aliases.some(a => h.includes(a)));

    const fullNameIdx  = findCol(["fullname","clientname","contactname","displayname","name"]);
    const firstNameIdx = findCol(["firstname","givenname","first"]);
    const lastNameIdx  = findCol(["lastname","surname","familyname","last"]);
    const emailIdx     = findCol(["email","emailaddress","mail","e-mail"]);
    const phoneIdx     = findCol(["phone","mobile","cell","tel","phonenumber","mobilephone","cellphone","contactphone"]);
    const serviceIdx   = findCol(["service","services","niche","type","category","product","package","plan","tier","offering","jobtype","appointmenttype","sessiontype"]);
    const statusIdx    = findCol(["status","clientstatus","leadstatus","stage","state","relationship","tag","label"]);
    const companyIdx   = findCol(["company","business","organization","org","employer","account"]);
    const notesIdx     = findCol(["notes","note","memo","description","comment","comments","bio","details"]);

    const hasHeaders = fullNameIdx >= 0 || firstNameIdx >= 0 || emailIdx >= 0;
    const dataLines = hasHeaders ? lines.slice(1) : lines;

    const normalizeStatus = (s: string): "active" | "inactive" | "prospect" => {
      const v = s.toLowerCase().trim();
      if (["inactive","churned","lost","closed","archived","unsubscribed","cancelled","canceled"].some(x => v.includes(x))) return "inactive";
      if (["prospect","lead","potential","trial","new","pending","inquiry","interested","warm","cold","qualified"].some(x => v.includes(x))) return "prospect";
      return "active";
    };

    const rows = dataLines.slice(0, 500).map(line => {
      const cols = parseCSVLine(line, delim);
      const get = (idx: number) => (idx >= 0 ? cols[idx] || "" : "").trim();

      // Build full name: prefer fullName column, fallback to first+last
      let name = "";
      if (fullNameIdx >= 0) {
        name = get(fullNameIdx);
      } else if (firstNameIdx >= 0 || lastNameIdx >= 0) {
        name = [get(firstNameIdx), get(lastNameIdx)].filter(Boolean).join(" ");
      } else {
        name = get(0);
      }

      // Append company to service if no service column but company exists
      let service = get(serviceIdx);
      if (!service && companyIdx >= 0) service = get(companyIdx);

      // Build notes from notes column
      const notes = get(notesIdx);

      const rawStatus = statusIdx >= 0 ? get(statusIdx) : "";
      const status = rawStatus ? normalizeStatus(rawStatus) : "active";

      return {
        name,
        email: get(emailIdx) || (emailIdx < 0 ? get(1) : ""),
        phone: get(phoneIdx),
        service,
        status,
        notes,
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

  // Tags & Messages
  const [profileTab, setProfileTab] = useState<"info" | "tags" | "messages">("info");
  const { data: clientTagsData = [] } = trpc.tags.listForClient.useQuery({ clientId: selectedId! }, { enabled: !!selectedId });
  const [newTag, setNewTag] = useState("");
  const addTag = trpc.tags.add.useMutation({ onSuccess: () => utils.tags.listForClient.invalidate({ clientId: selectedId! }) });
  const removeTag = trpc.tags.remove.useMutation({ onSuccess: () => utils.tags.listForClient.invalidate({ clientId: selectedId! }) });
  const { data: messages = [] } = trpc.portalMsg.list.useQuery({ clientId: selectedId! }, { enabled: !!selectedId && profileTab === "messages" });
  const [msgText, setMsgText] = useState("");
  const sendReply = trpc.portalMsg.reply.useMutation({ onSuccess: () => { utils.portalMsg.list.invalidate({ clientId: selectedId! }); setMsgText(""); } });

  const getPortalToken = trpc.portal.getToken.useMutation({
    onSuccess: (data) => {
      navigator.clipboard.writeText(data.url)
        .then(() => toast.success("Portal link copied to clipboard!"))
        .catch(() => toast.info(`Portal link: ${data.url}`));
    },
    onError: (e) => toast.error(e.message),
  });

  // Stable field setters — prevents Field memo from being bypassed on every render
  const setFormName        = useFormField(setForm, "name");
  const setFormEmail       = useFormField(setForm, "email");
  const setFormPhone       = useFormField(setForm, "phone");
  const setFormService     = useFormField(setForm, "service");
  const setFormNotes       = useFormField(setForm, "notes");
  const setFormDefaultRate = useFormField(setForm, "defaultRate");

  const handleCreate = () => {
    if (!form.name.trim()) { toast.error("Client name is required."); return; }
    createClient.mutate(form);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#F5EFE3]">Clients</h2>
          <p className="text-sm text-[rgba(245,239,227,0.55)]">{clientList?.length || 0} clients in your roster</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            <button onClick={() => setViewMode("list")} className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "list" ? "bg-[#D4922A] text-white" : "bg-transparent text-[rgba(245,239,227,0.55)] hover:bg-white/5"}`}>List</button>
            <button onClick={() => setViewMode("pipeline")} className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "pipeline" ? "bg-[#D4922A] text-white" : "bg-transparent text-[rgba(245,239,227,0.55)] hover:bg-white/5"}`}>Pipeline</button>
          </div>
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

      {/* Pipeline Kanban View */}
      {viewMode === "pipeline" && (
        <div className="space-y-3">
          {pipelineLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {PIPELINE_STAGES.map(s => <div key={s.id} className="bg-[#161B22] rounded-xl border border-white/8 p-3 min-h-[200px]"><Skeleton className="h-6 w-24 mb-3" />{[0,1].map(i => <Skeleton key={i} className="h-16 mb-2" />)}</div>)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {PIPELINE_STAGES.map(stage => {
                const stageClients = (pipelineData as Record<string, Array<{id:number;name:string;email:string|null;service:string|null;status:string}>>)?.[stage.id] ?? [];
                return (
                  <div key={stage.id} className="bg-[#161B22] rounded-xl border border-white/8 p-3 min-h-[200px] flex flex-col gap-2">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <div className="text-xs font-bold" style={{ color: stage.color }}>{stage.label}</div>
                        <div className="text-[10px] text-[rgba(245,239,227,0.40)]">{stage.desc}</div>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: stage.bg, color: stage.color }}>{stageClients.length}</span>
                    </div>
                    {stageClients.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-[10px] text-[rgba(245,239,227,0.25)] text-center">No clients</div>
                    ) : stageClients.map(c => (
                      <div key={c.id} className="bg-[#1C2333] rounded-lg p-2.5 border border-white/5 hover:border-white/15 transition-all cursor-pointer group" onClick={() => setSelectedId(c.id)}>
                        <div className="text-xs font-semibold text-[#F5EFE3] truncate">{c.name}</div>
                        {c.service && <div className="text-[10px] text-[rgba(245,239,227,0.45)] truncate mt-0.5">{c.service}</div>}
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {PIPELINE_STAGES.filter(s => s.id !== stage.id).map(s => (
                            <button key={s.id} onClick={e => { e.stopPropagation(); updateStage.mutate({ id: c.id, pipelineStage: s.id as PipelineStageId }); }} className="text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: s.bg, color: s.color }} title={`Move to ${s.label}`}>→ {s.label}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-[rgba(245,239,227,0.35)] text-center">Hover a client card to see stage move buttons</p>
        </div>
      )}
      {/* Filters */}
      {viewMode === "list" && <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgba(245,239,227,0.55)]" aria-hidden="true" />
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
      </div>}
      {/* Table */}
      {viewMode === "list" && <div className="bg-[#161B22] rounded-xl border border-white/8 overflow-hidden">
        <div className="hidden sm:grid grid-cols-4 gap-4 px-5 py-3 bg-[#1C2333] text-xs font-semibold text-[rgba(245,239,227,0.55)] uppercase tracking-wide">
          <span className="col-span-2">Client</span>
          <span>Service</span>
          <span>Status</span>
        </div>
        {isLoading ? (
          <div className="space-y-px">
            {[...Array(4)].map((_, i) => <div key={i} className="px-5 py-4 border-t border-white/5"><Skeleton className="h-10" /></div>)}
          </div>
        ) : !clientList || clientList.length === 0 ? (
          <div className="text-center py-16 text-[rgba(245,239,227,0.55)]">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium text-[rgba(245,239,227,0.55)]">No clients found</p>
            <p className="text-xs mt-1">{search ? "Try adjusting your search." : "Add your first client to get started."}</p>
          </div>
        ) : clientList.map(c => (
          <div
            key={c.id}
            className="flex sm:grid sm:grid-cols-4 gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 border-t border-white/5 hover:bg-[#1C2333] transition-colors items-center cursor-pointer"
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
                <p className="text-sm font-semibold text-[#F5EFE3] truncate">{c.name}</p>
                <p className="text-xs text-[rgba(245,239,227,0.55)] truncate">
                  {c.email || "No email"}
                  {(c as any).lastActivity && (
                    <span className="ml-2 text-[rgba(245,239,227,0.45)]">· last seen {new Date((c as any).lastActivity).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  )}
                </p>
              </div>
            </div>
            <p className="hidden sm:block text-sm text-[rgba(245,239,227,0.55)] truncate">{c.service || "—"}</p>
            <div className="flex items-center justify-between ml-auto sm:ml-0 flex-shrink-0 gap-2">
              <Badge className={`text-xs border-0 ${c.status === "active" ? "bg-green-500/10 text-green-600" : c.status === "prospect" ? "bg-yellow-50 text-yellow-600" : "bg-[#243040] text-[rgba(245,239,227,0.55)]"}`}>
                {c.status}
              </Badge>
              <button
                onClick={e => { e.stopPropagation(); setClientConfirm({ open: true, title: "Remove Client?", description: `Remove ${c.name} from your clients? This cannot be undone.`, onConfirm: () => deleteClient.mutate({ id: c.id }) }); }}
                className="p-2 rounded-lg hover:bg-red-500/100/10 text-[rgba(245,239,227,0.45)] hover:text-red-500 transition-colors"
                aria-label={`Delete ${c.name}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
                ))}
      </div>}
      {/* Add Client Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add New Client">
        <div className="space-y-4">
          <Field label="Full Name" value={form.name} onChange={setFormName} placeholder="Jane Smith" required autoComplete="name" enterKeyHint="next" />
          <Field label="Email Address" value={form.email} onChange={setFormEmail} placeholder="jane@example.com" type="email" autoComplete="email" enterKeyHint="next" />
          <Field label="Phone Number" value={form.phone} onChange={setFormPhone} placeholder="+1 (555) 000-0000" type="tel" autoComplete="tel" enterKeyHint="next" />
          <Field label="Service / Niche" value={form.service} onChange={setFormService} placeholder="Business Coaching, Web Design..." autoComplete="off" enterKeyHint="next" />
          <Field label="Default Hourly Rate ($)" value={form.defaultRate} onChange={setFormDefaultRate} placeholder="0.00" type="number" autoComplete="off" enterKeyHint="next" />
          <div>
            <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as typeof form.status }))} className="form-input-light">
              <option value="active">Active</option>
              <option value="prospect">Prospect / Lead</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <Field label="Notes" value={form.notes} onChange={setFormNotes} placeholder="Any important notes about this client..." textarea rows={3} />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="flex-1 gradient-amber text-white border-0 hover:opacity-90" onClick={handleCreate} disabled={createClient.isPending}>
              {createClient.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Client"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Client Profile Modal */}
      <Modal open={!!selectedId} onClose={() => { setSelectedId(null); setProfileTab("info"); }} title="Client Profile" wide>
        {selectedClient && (
          <div className="space-y-4">
            {/* Profile Tab Bar */}
            <div className="flex gap-1 bg-[#243040] rounded-xl p-1">
              {(["info", "tags", "messages"] as const).map(t => (
                <button key={t} onClick={() => setProfileTab(t)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    profileTab === t ? "bg-[#D4922A]/20 text-[#D4922A] shadow-sm" : "text-[rgba(245,239,227,0.45)] hover:text-[rgba(245,239,227,0.75)]"
                  }`}>
                  {t === "messages" ? "Messages" : t === "tags" ? "Tags" : "Info"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl gradient-amber flex items-center justify-center text-white text-lg font-bold">
                {selectedClient.avatarInitials || selectedClient.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#F5EFE3]">{selectedClient.name}</h3>
                <p className="text-sm text-[rgba(245,239,227,0.55)]">{selectedClient.service || "General Client"}</p>
                <Badge className={`text-xs border-0 mt-1 ${selectedClient.status === "active" ? "bg-green-500/10 text-green-600" : selectedClient.status === "prospect" ? "bg-yellow-50 text-yellow-600" : "bg-[#243040] text-[rgba(245,239,227,0.55)]"}`}>
                  {selectedClient.status}
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Mail, label: "Email", value: selectedClient.email || "Not provided" },
                { icon: Phone, label: "Phone", value: selectedClient.phone || "Not provided" },
                { icon: DollarSign, label: "Default Rate", value: selectedClient.defaultRate ? `$${parseFloat(selectedClient.defaultRate).toFixed(2)}/hr` : "Not set" },
                { icon: Calendar, label: "Added", value: formatDate(selectedClient.createdAt) },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-[#1C2333] rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-3.5 h-3.5 text-[rgba(245,239,227,0.55)]" />
                    <p className="text-xs text-[rgba(245,239,227,0.55)]">{label}</p>
                  </div>
                  <p className="text-sm font-semibold text-[#F5EFE3] truncate">{value}</p>
                </div>
              ))}
            </div>
            {profileTab === "tags" && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input value={newTag} onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && newTag.trim()) { addTag.mutate({ clientId: selectedClient.id, tag: newTag.trim() }); setNewTag(""); } }}
                    placeholder="Add tag (e.g. VIP, Referral, Hot Lead)" className="form-input-light flex-1 text-sm" />
                  <Button size="sm" onClick={() => { if (newTag.trim()) { addTag.mutate({ clientId: selectedClient.id, tag: newTag.trim() }); setNewTag(""); } }}
                    disabled={!newTag.trim() || addTag.isPending} className="gradient-amber text-white border-0">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {clientTagsData.length === 0 && <p className="text-xs text-[rgba(245,239,227,0.40)]">No tags yet. Add your first tag above.</p>}
                  {clientTagsData.map(t => (
                    <span key={t.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4922A]/10 text-[#D4922A] text-xs font-semibold">
                      {t.tag}
                      <button onClick={() => removeTag.mutate({ clientId: selectedClient.id, tag: t.tag })} className="hover:text-red-500 transition-colors" aria-label={`Remove ${t.tag}`}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {profileTab === "messages" && (
              <div className="space-y-3">
                <div className="max-h-64 overflow-y-auto space-y-2 bg-[#1C2333] rounded-xl p-3">
                  {messages.length === 0 && <p className="text-xs text-[rgba(245,239,227,0.40)] text-center py-4">No messages yet. Clients can message you from their portal.</p>}
                  {(messages as Array<{ id: number; senderRole: string; body: string; createdAt: Date }>).map(m => (
                    <div key={m.id} className={`flex ${ m.senderRole === "owner" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                        m.senderRole === "owner" ? "bg-[#D4922A] text-white" : "bg-[#161B22] border border-white/10 text-[#F5EFE3]"
                      }`}>
                        <p>{m.body}</p>
                        <p className={`text-[10px] mt-1 ${ m.senderRole === "owner" ? "text-white/70" : "text-[rgba(245,239,227,0.40)]"}`}>{new Date(m.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={msgText} onChange={e => setMsgText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && msgText.trim()) { sendReply.mutate({ clientId: selectedClient.id, body: msgText }); } }}
                    placeholder="Reply to client..." className="form-input-light flex-1 text-sm" />
                  <Button size="sm" onClick={() => { if (msgText.trim()) sendReply.mutate({ clientId: selectedClient.id, body: msgText }); }}
                    disabled={!msgText.trim() || sendReply.isPending} className="gradient-amber text-white border-0">
                    Send
                  </Button>
                </div>
              </div>
            )}
            {profileTab === "info" && selectedClient.notes && (
              <div className="bg-[#1C2333] rounded-xl p-4">
                <p className="text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1">Notes</p>
                <p className="text-sm text-[rgba(245,239,227,0.75)] whitespace-pre-wrap">{selectedClient.notes}</p>
              </div>
            )}
            {/* Document Storage & Actions - only show on Info tab */}
            {profileTab === "info" && (
              <>
                <div className="bg-[#1C2333] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-[rgba(245,239,227,0.55)]">Documents ({clientDocs?.length || 0})</p>
                    <label className={`text-xs font-semibold cursor-pointer px-3 py-1.5 rounded-lg transition-colors ${docUploading ? 'opacity-50 pointer-events-none' : 'bg-[#D4922A]/10 text-[#D4922A] hover:bg-[#D4922A]/20'}`}>
                      {docUploading ? 'Uploading...' : '+ Upload'}
                      <input type="file" className="sr-only" onChange={handleDocUpload} disabled={docUploading} accept="*/*" />
                    </label>
                  </div>
                  {!clientDocs || clientDocs.length === 0 ? (
                    <p className="text-xs text-[rgba(245,239,227,0.55)] text-center py-3">No documents yet. Upload contracts, briefs, or any files.</p>
                  ) : (
                    <div className="space-y-2">
                      {clientDocs.map(doc => (
                        <div key={doc.id} className="flex items-center gap-2 bg-[#161B22] rounded-lg px-3 py-2 border border-white/8">
                          <FileText className="w-3.5 h-3.5 text-[#D4922A] flex-shrink-0" />
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-xs font-medium text-[#F5EFE3] truncate hover:underline">{doc.fileName}</a>
                          {doc.sizeBytes && <span className="text-[10px] text-[rgba(245,239,227,0.55)] flex-shrink-0">{(doc.sizeBytes / 1024).toFixed(0)} KB</span>}
                          <button onClick={() => deleteDoc.mutate({ id: doc.id })} className="p-2 rounded hover:bg-red-500/100/10 text-[rgba(245,239,227,0.45)] hover:text-red-500 transition-colors flex-shrink-0" aria-label="Delete document">
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
                  <Button variant="outline" className="gap-2 border-red-200 text-red-500 hover:bg-red-500/100/10" onClick={() => setClientConfirm({ open: true, title: "Remove Client?", description: `Remove ${selectedClient.name}? This cannot be undone.`, onConfirm: () => { deleteClient.mutate({ id: selectedClient.id }); setSelectedId(null); } })}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
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
          {/* Info + Download Template */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 flex items-start justify-between gap-3">
            <div>
              <strong>Expected columns:</strong> name, email, phone, service, status (active/inactive/prospect). First row can be a header row — works with exports from HoneyBook, Dubsado, 17hats, Notion, and most CRMs.
            </div>
            <button
              onClick={() => {
                const template = "name,email,phone,service,status\nJane Smith,jane@example.com,+15550001234,Coaching,active\nJohn Doe,john@example.com,,Web Design,active";
                const blob = new Blob([template], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = "clients-import-template.csv"; a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex-shrink-0 text-blue-700 underline underline-offset-2 font-semibold hover:text-blue-900 whitespace-nowrap"
            >
              Download Template
            </button>
          </div>

          {/* File upload */}
          <div>
            <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">Upload a CSV file</label>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-white/10 rounded-xl p-4 cursor-pointer hover:border-[#D4922A]/60 hover:bg-amber-500/5 transition-colors">
              <Upload className="w-4 h-4 text-[rgba(245,239,227,0.45)]" />
              <span className="text-xs text-[rgba(245,239,227,0.55)]">Click to choose a .csv file, or drag and drop</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = ev => {
                    const text = ev.target?.result as string;
                    setCsvText(text);
                    parseCsv(text);
                  };
                  reader.readAsText(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          {/* Or paste manually */}
          <div>
            <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">Or paste CSV content directly</label>
            <textarea
              value={csvText}
              onChange={e => { setCsvText(e.target.value); parseCsv(e.target.value); }}
              placeholder={`name,email,phone,service\nJane Smith,jane@example.com,+1555000,Coaching\nJohn Doe,john@example.com,,Web Design`}
              rows={5}
              className="form-input-light resize-none font-mono text-xs"
            />
          </div>
          {csvPreview.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-2">{csvPreview.length} client{csvPreview.length > 1 ? "s" : ""} detected — preview (first 5):</p>
              <div className="border border-white/8 rounded-xl overflow-hidden">
                {csvPreview.slice(0, 5).map((row, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 border-t border-white/5 first:border-t-0 text-xs">
                    <div className="w-6 h-6 rounded-full gradient-amber flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                      {row.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#F5EFE3] truncate">{row.name}</p>
                      <p className="text-[rgba(245,239,227,0.55)] truncate">{row.email || "No email"}</p>
                    </div>
                    <span className="text-[rgba(245,239,227,0.55)]">{row.service || "—"}</span>
                  </div>
                ))}
                {csvPreview.length > 5 && <div className="px-3 py-2 text-xs text-[rgba(245,239,227,0.55)] border-t border-white/5">+{csvPreview.length - 5} more...</div>}
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
  const setSchedFormField = useFormFields(setForm);
  const setSchedClientName  = setSchedFormField("clientName");
  const setSchedClientEmail = setSchedFormField("clientEmail");
  const setSchedService     = setSchedFormField("service");
  const setSchedDate        = setSchedFormField("date");
  const setSchedTime        = setSchedFormField("time");
  const setSchedNotes       = setSchedFormField("notes");
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
    scheduled: "bg-green-500/10 text-green-600",
    completed: "bg-blue-50 text-blue-600",
    cancelled: "bg-red-500/10 text-red-500",
    no_show: "bg-[#243040] text-[rgba(245,239,227,0.55)]",
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#F5EFE3]">Scheduling</h2>
          <p className="text-sm text-[rgba(245,239,227,0.55)]">{bookingList?.filter(b => b.status === "scheduled").length || 0} upcoming sessions</p>
        </div>
        <Button size="sm" className="gradient-amber text-white border-0 hover:opacity-90 gap-1.5" onClick={() => setShowAdd(true)}>
          <Plus className="w-3.5 h-3.5" />New Booking
        </Button>
      </div>

      <div className="bg-[#161B22] rounded-xl border border-white/8 overflow-hidden">
        <div className="hidden sm:grid grid-cols-5 gap-4 px-5 py-3 bg-[#1C2333] text-xs font-semibold text-[rgba(245,239,227,0.55)] uppercase tracking-wide">
          <span className="col-span-2">Client / Service</span>
          <span>Date & Time</span>
          <span>Duration</span>
          <span>Status</span>
        </div>
        {isLoading ? (
          <div className="space-y-px">{[...Array(3)].map((_, i) => <div key={i} className="px-5 py-4 border-t border-white/5"><Skeleton className="h-10" /></div>)}</div>
        ) : !bookingList || bookingList.length === 0 ? (
          <div className="text-center py-16 text-[rgba(245,239,227,0.55)]">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium text-[rgba(245,239,227,0.55)]">No bookings yet</p>
            <p className="text-xs mt-1">Create your first booking or share your booking page with clients.</p>
          </div>
        ) : bookingList.map(b => (
          <div key={b.id} className="flex flex-col sm:grid sm:grid-cols-5 gap-2 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 border-t border-white/5 hover:bg-[#1C2333] transition-colors">
            <div className="sm:col-span-2">
              <p className="text-sm font-semibold text-[#F5EFE3]">{b.clientName}</p>
              <p className="text-xs text-[rgba(245,239,227,0.55)]">{b.service || "General Session"}</p>
              {/* Mobile-only: show date/time inline */}
              <div className="flex items-center gap-2 mt-0.5 sm:hidden">
                <span className="text-xs text-[rgba(245,239,227,0.55)]">{b.date} · {b.time}</span>
                <span className="text-xs text-[rgba(245,239,227,0.55)]">{b.duration}m</span>
              </div>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-[#F5EFE3]">{b.date}</p>
              <p className="text-xs text-[rgba(245,239,227,0.55)]">{b.time}</p>
            </div>
            <p className="hidden sm:block text-sm text-[rgba(245,239,227,0.55)]">{b.duration} min</p>
            <div className="flex items-center justify-between">
              <select
                value={b.status}
                onChange={e => updateStatus.mutate({ id: b.id, status: e.target.value as any })}
                className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${statusColor[b.status] || "bg-[#243040] text-[rgba(245,239,227,0.55)]"}`}
                aria-label="Update booking status"
              >
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
              </select>
              <button onClick={() => setSchedConfirm({ open: true, title: "Remove Booking?", description: "Remove this booking? This cannot be undone.", onConfirm: () => deleteBooking.mutate({ id: b.id }) })} className="p-2 rounded-lg hover:bg-red-500/100/10 text-[rgba(245,239,227,0.45)] hover:text-red-500 transition-colors ml-2" aria-label="Delete booking">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Booking">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">Select Existing Client</label>
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
          <Field label="Client Name" value={form.clientName} onChange={setSchedClientName} placeholder="Jane Smith" required autoComplete="name" enterKeyHint="next" />
          <Field label="Client Email" value={form.clientEmail} onChange={setSchedClientEmail} placeholder="jane@example.com" type="email" autoComplete="email" enterKeyHint="next" />
          <Field label="Service" value={form.service} onChange={setSchedService} placeholder="Strategy Session, Coaching Call..." autoComplete="off" enterKeyHint="next" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date *" value={form.date} onChange={setSchedDate} placeholder="2026-03-20" type="date" required />
            <Field label="Time *" value={form.time} onChange={setSchedTime} placeholder="14:00" type="time" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">Duration (minutes)</label>
            <select value={form.duration} onChange={e => setForm(p => ({ ...p, duration: parseInt(e.target.value) }))} className="form-input-light">
              {[15, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} minutes</option>)}
            </select>
          </div>
          <Field label="Notes" value={form.notes} onChange={setSchedNotes} placeholder="Session goals, preparation notes..." textarea />

          {/* AI Smart Schedule */}
          <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />AI Time Suggestions</p>
              <Button size="sm" variant="outline" className="h-6 text-xs px-2 border-amber-500/30 text-amber-400 hover:bg-amber-100" onClick={() => smartSchedule.mutate({ clientName: form.clientName || "client", service: form.service, notes: form.notes })} disabled={smartSchedule.isPending}>
                {smartSchedule.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Suggest Times"}
              </Button>
            </div>
            {smartSuggestions.length > 0 ? (
              <div className="space-y-1.5">
                {smartSuggestions.map((s, i) => (
                  <button key={i} onClick={() => { setForm(p => ({ ...p, date: s.date, time: s.time })); setSmartSuggestions([]); toast.success("Time slot applied!"); }} className="w-full text-left px-3 py-2 rounded-lg bg-[#161B22] border border-amber-500/20 hover:border-amber-300 transition-colors">
                    <span className="text-xs font-semibold text-[#F5EFE3]">{s.date} at {s.time}</span>
                    <span className="text-xs text-[rgba(245,239,227,0.55)] ml-2">{s.reason}</span>
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

// ─── Frequency helpers (shared by InvoicesPanel) ────────────────────────────
const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 Weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};
const FREQUENCY_COLORS: Record<string, string> = {
  weekly: "#6366F1",
  biweekly: "#D4922A",
  monthly: "#10B981",
  quarterly: "#FF6B6B",
  yearly: "#8B5CF6",
};

// ─── Invoices Panel ───────────────────────────────────────────────────────────
function InvoicesPanel() {
  const utils = trpc.useUtils();

  // ── Top-level tab: invoices vs recurring ──────────────────────────────────
  const [invTab, setInvTab] = useState<"invoices" | "recurring">("invoices");

  // ── Recurring state ───────────────────────────────────────────────────────
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const defaultRecurringForm = {
    clientId: "",
    clientName: "",
    clientEmail: "",
    description: "",
    amount: "",
    currency: "USD",
    frequency: "monthly" as "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly",
    nextDueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  };
  const [recurringForm, setRecurringForm] = useState(defaultRecurringForm);
  const setRecurringFormField = useFormFields(setRecurringForm);
  const setRecurClientName  = setRecurringFormField("clientName");
  const setRecurClientEmail = setRecurringFormField("clientEmail");
  const setRecurAmount      = setRecurringFormField("amount");
  const setRecurFrequency   = setRecurringFormField("frequency");
  const setRecurNextDueAt   = setRecurringFormField("nextDueAt");
  const setRecurDescription = setRecurringFormField("description");
  const { data: schedules, isLoading: schedulesLoading } = trpc.recurring.list.useQuery(undefined, { retry: 1 });
  const createSchedule = trpc.recurring.create.useMutation({
    onSuccess: () => {
      utils.recurring.list.invalidate();
      toast.success("Recurring schedule created!");
      setShowRecurringForm(false);
      setRecurringForm(defaultRecurringForm);
    },
    onError: (e) => toast.error(e.message),
  });
  const toggleSchedule = trpc.recurring.toggle.useMutation({
    onSuccess: () => utils.recurring.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const deleteScheduleM = trpc.recurring.delete.useMutation({
    onSuccess: () => { utils.recurring.list.invalidate(); toast.success("Schedule deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const activeScheduleCount = schedules?.filter((s: any) => s.active).length ?? 0;
  const estMonthlyRevenue = schedules?.filter((s: any) => s.active).reduce((sum: number, s: any) => {
    const amt = parseFloat(String(s.amount));
    const mult = s.frequency === "weekly" ? 4.33 : s.frequency === "biweekly" ? 2.17 : s.frequency === "monthly" ? 1 : s.frequency === "quarterly" ? 0.33 : 0.083;
    return sum + amt * mult;
  }, 0) ?? 0;

  // ── Invoice state ─────────────────────────────────────────────────────────
  const [showAdd, setShowAdd] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<any>(null);
  const [form, setForm] = useState({ clientName: "", clientEmail: "", service: "", amount: "", dueDate: "", notes: "", status: "draft" as "draft" | "sent" });
  const setInvFormField = useFormFields(setForm);
  // Pre-called stable setters — NEVER call setInvFormField("x") inline in JSX
  // because that creates a new function reference every render, bypassing React.memo
  const setInvClientName  = setInvFormField("clientName");
  const setInvClientEmail = setInvFormField("clientEmail");
  const setInvService     = setInvFormField("service");
  const setInvAmount      = setInvFormField("amount");
  const setInvDueDate     = setInvFormField("dueDate");
  const setInvNotes       = setInvFormField("notes");
  const setInvStatus      = setInvFormField("status");
  const [lineItems, setLineItems] = useState<{ description: string; qty: number; unitPrice: number }[]>([]);
  const [useLineItems, setUseLineItems] = useState(false);
  const lineItemsTotal = lineItems.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  // Edit invoice state
  const [editInvoice, setEditInvoice] = useState<any>(null);
  const [editForm, setEditForm] = useState({ clientName: "", clientEmail: "", service: "", amount: "", dueDate: "", notes: "", status: "draft" as "draft" | "sent" | "paid" | "overdue" });
  const setEditFormField = useFormFields(setEditForm);
  // Pre-called stable setters for edit form
  const setEditClientName  = setEditFormField("clientName");
  const setEditClientEmail = setEditFormField("clientEmail");
  const setEditService     = setEditFormField("service");
  const setEditAmount      = setEditFormField("amount");
  const setEditDueDate     = setEditFormField("dueDate");
  const setEditNotes       = setEditFormField("notes");
  const setEditStatus      = setEditFormField("status");
  const [editLineItems, setEditLineItems] = useState<{ description: string; qty: number; unitPrice: number }[]>([]);
  const [editUseLineItems, setEditUseLineItems] = useState(false);
  const editLineItemsTotal = editLineItems.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  // Stable callbacks for create line items — prevent re-renders of sibling rows
  const handleLineDesc  = useCallback((idx: number, v: string) => setLineItems(p => p.map((it, i) => i === idx ? { ...it, description: v } : it)), []);
  const handleLineQty   = useCallback((idx: number, v: string) => setLineItems(p => p.map((it, i) => i === idx ? { ...it, qty: parseFloat(v) || 1 } : it)), []);
  const handleLinePrice = useCallback((idx: number, v: string) => setLineItems(p => p.map((it, i) => i === idx ? { ...it, unitPrice: parseFloat(v) || 0 } : it)), []);
  const handleLineRemove = useCallback((idx: number) => setLineItems(p => p.filter((_, i) => i !== idx)), []);
  // Stable callbacks for edit line items
  const handleEditLineDesc  = useCallback((idx: number, v: string) => setEditLineItems(p => p.map((it, i) => i === idx ? { ...it, description: v } : it)), []);
  const handleEditLineQty   = useCallback((idx: number, v: string) => setEditLineItems(p => p.map((it, i) => i === idx ? { ...it, qty: parseFloat(v) || 1 } : it)), []);
  const handleEditLinePrice = useCallback((idx: number, v: string) => setEditLineItems(p => p.map((it, i) => i === idx ? { ...it, unitPrice: parseFloat(v) || 0 } : it)), []);
  const handleEditLineRemove = useCallback((idx: number) => setEditLineItems(p => p.filter((_, i) => i !== idx)), []);
  function openEditInvoice(inv: any) {
    const items = inv.lineItems ? (typeof inv.lineItems === "string" ? JSON.parse(inv.lineItems) : inv.lineItems) : [];
    const hasItems = Array.isArray(items) && items.length > 0;
    setEditForm({ clientName: inv.clientName || "", clientEmail: inv.clientEmail || "", service: inv.service || "", amount: String(inv.amount || ""), dueDate: inv.dueDate ? inv.dueDate.slice(0, 10) : "", notes: inv.notes || "", status: inv.status || "draft" });
    setEditLineItems(hasItems ? items : []);
    setEditUseLineItems(hasItems);
    setEditInvoice(inv);
  }
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
  const { data: invoiceStats } = trpc.invoices.stats.useQuery(undefined, { retry: 1 });
  const { data: clientList } = trpc.clients.list.useQuery({ search: "", status: "all" });

  const createInvoice = trpc.invoices.create.useMutation({
    onSuccess: () => { utils.invoices.list.invalidate(); utils.invoices.stats.invalidate(); toast.success("Invoice created!"); setShowAdd(false); setForm({ clientName: "", clientEmail: "", service: "", amount: "", dueDate: "", notes: "", status: "draft" }); setLineItems([]); setUseLineItems(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateInvoice = trpc.invoices.update.useMutation({
    onSuccess: () => { utils.invoices.list.invalidate(); utils.invoices.stats.invalidate(); toast.success("Invoice updated!"); setEditInvoice(null); },
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
  const generatePayLink = trpc.invoices.generatePayLink.useMutation({
    onSuccess: (data) => {
      const payUrl = `${window.location.origin}/pay/${data.token}`;
      navigator.clipboard.writeText(payUrl)
        .then(() => toast.success("Direct pay link copied! Client can pay without logging in."))
        .catch(() => toast.info(`Pay link: ${payUrl}`));
    },
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
    draft: "bg-[#243040] text-[rgba(245,239,227,0.55)]",
    sent: "bg-blue-50 text-blue-600",
    paid: "bg-green-500/10 text-green-600",
    overdue: "bg-red-500/10 text-red-500",
  };

  return (
    <div className="space-y-5">
      {/* Panel header with top-level tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#F5EFE3]">Invoices</h2>
          <p className="text-sm text-[rgba(245,239,227,0.55)]">
            {invTab === "invoices" ? `${invoiceList?.length || 0} total invoices` : `${schedules?.length || 0} schedules · ${formatCurrency(estMonthlyRevenue)}/mo est.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {invTab === "invoices" ? (
            <>
              <Button size="sm" variant="outline" className="gap-1.5 text-[rgba(245,239,227,0.55)] border-white/10" onClick={exportInvoicesCSV} title="Export all invoices as CSV">
                <Download className="w-3.5 h-3.5" />Export CSV
              </Button>
              <Button size="sm" className="gradient-amber text-white border-0 hover:opacity-90 gap-1.5" onClick={() => setShowAdd(true)}>
                <Plus className="w-3.5 h-3.5" />New Invoice
              </Button>
            </>
          ) : (
            <Button size="sm" className="gradient-amber text-white border-0 hover:opacity-90 gap-1.5" onClick={() => setShowRecurringForm(v => !v)}>
              <Plus className="w-3.5 h-3.5" />{showRecurringForm ? "Cancel" : "New Schedule"}
            </Button>
          )}
        </div>
      </div>

      {/* Top-level tab switcher */}
      <div className="flex gap-1 p-1 bg-[#243040] rounded-xl overflow-x-auto">
        <button
          onClick={() => setInvTab("invoices")}
          className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            invTab === "invoices" ? "bg-[#D4922A]/20 text-[#D4922A] shadow-sm" : "text-[rgba(245,239,227,0.55)] hover:text-[rgba(245,239,227,0.75)]"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />Invoices
        </button>
        <button
          onClick={() => setInvTab("recurring")}
          className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            invTab === "recurring" ? "bg-[#D4922A]/20 text-[#D4922A] shadow-sm" : "text-[rgba(245,239,227,0.55)] hover:text-[rgba(245,239,227,0.75)]"
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />Recurring
          {activeScheduleCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-green-500/15 text-green-400 rounded-full">{activeScheduleCount}</span>
          )}
        </button>
      </div>

      {/* ── Recurring tab content ── */}
      {invTab === "recurring" && (
        <div className="space-y-5">
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#161B22] rounded-xl p-4 shadow-sm border border-white/8">
              <p className="text-2xl font-bold text-[#F5EFE3]">{activeScheduleCount}</p>
              <p className="text-xs text-[rgba(245,239,227,0.45)] mt-0.5">Active Schedules</p>
            </div>
            <div className="bg-[#161B22] rounded-xl p-4 shadow-sm border border-white/8">
              <p className="text-2xl font-bold text-[#F5EFE3]">{formatCurrency(estMonthlyRevenue)}</p>
              <p className="text-xs text-[rgba(245,239,227,0.45)] mt-0.5">Est. Monthly Revenue</p>
            </div>
          </div>

          {/* Create form */}
          {showRecurringForm && (
            <div className="bg-[#161B22] rounded-xl p-5 shadow-sm border border-white/8">
              <h3 className="font-bold text-sm text-[#F5EFE3] mb-4">New Recurring Schedule</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">Client</label>
                  <select
                    value={recurringForm.clientId}
                    onChange={e => {
                      const c = clientList?.find((c: any) => String(c.id) === e.target.value);
                      setRecurringForm(p => ({ ...p, clientId: e.target.value, clientName: c?.name || p.clientName, clientEmail: (c as any)?.email || p.clientEmail }));
                    }}
                    className="form-input-light"
                  >
                    <option value="">Select client or type below</option>
                    {clientList?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <Field label="Client Name" required value={recurringForm.clientName} onChange={setRecurClientName} placeholder="Client or company name" autoComplete="organization" enterKeyHint="next" />
                <Field label="Client Email" value={recurringForm.clientEmail} onChange={setRecurClientEmail} placeholder="client@example.com" type="email" autoComplete="email" enterKeyHint="next" />
                <Field label="Amount ($)" required value={recurringForm.amount} onChange={setRecurAmount} placeholder="e.g. 500" type="number" enterKeyHint="next" />
                <div>
                  <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">Frequency *</label>
                  <select value={recurringForm.frequency} onChange={e => setRecurFrequency(e.target.value)} className="form-input-light">
                    {Object.entries(FREQUENCY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">First Due Date *</label>
                  <input type="date" value={recurringForm.nextDueAt} onChange={e => setRecurNextDueAt(e.target.value)} className="form-input-light" />
                </div>
                <div className="sm:col-span-2">
                  <Field label="Description" value={recurringForm.description} onChange={setRecurDescription} placeholder="e.g. Monthly retainer — web maintenance" enterKeyHint="done" />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={() => {
                    if (!recurringForm.clientName.trim()) { toast.error("Client name is required"); return; }
                    if (!recurringForm.amount || parseFloat(recurringForm.amount) <= 0) { toast.error("Amount must be greater than 0"); return; }
                    if (!recurringForm.nextDueAt) { toast.error("Next due date is required"); return; }
                    const client = clientList?.find((c: any) => String(c.id) === recurringForm.clientId);
                    createSchedule.mutate({
                      clientId: client?.id,
                      clientName: recurringForm.clientName.trim(),
                      clientEmail: recurringForm.clientEmail.trim() || undefined,
                      description: recurringForm.description.trim() || undefined,
                      amount: recurringForm.amount,
                      currency: recurringForm.currency,
                      frequency: recurringForm.frequency,
                      nextDueAt: new Date(recurringForm.nextDueAt + "T12:00:00").toISOString(),
                    });
                  }}
                  disabled={createSchedule.isPending}
                  className="gradient-amber text-white border-0 hover:opacity-90 gap-2"
                >
                  {createSchedule.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create Schedule
                </Button>
                <Button variant="outline" onClick={() => setShowRecurringForm(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Schedules list */}
          <div className="bg-[#161B22] rounded-xl shadow-sm border border-white/8 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/8">
              <h3 className="font-bold text-sm text-[#F5EFE3]">All Schedules</h3>
            </div>
            {schedulesLoading ? (
              <div className="p-8 text-center"><Loader2 className="w-6 h-6 text-[#D4922A] animate-spin mx-auto" /></div>
            ) : !schedules || schedules.length === 0 ? (
              <div className="p-10 text-center">
                <RefreshCw className="w-10 h-10 text-[rgba(245,239,227,0.25)] mx-auto mb-3" />
                <p className="text-sm font-semibold text-[rgba(245,239,227,0.45)]">No recurring schedules yet</p>
                <p className="text-xs text-[rgba(245,239,227,0.40)] mt-1">Click "New Schedule" to set up automatic billing</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {schedules.map((s: any) => {
                  const color = FREQUENCY_COLORS[s.frequency] || "#6366F1";
                  return (
                    <div key={s.id} className={`flex items-center gap-4 px-5 py-4 hover:bg-[#1C2333] transition-colors ${!s.active ? "opacity-50" : ""}`}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + "15" }}>
                        <RefreshCw className="w-4 h-4" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-[#F5EFE3] truncate">{s.clientName}</p>
                          <span className="px-2 py-0.5 text-xs rounded-full font-semibold" style={{ background: color + "15", color }}>
                            {FREQUENCY_LABELS[s.frequency]}
                          </span>
                          {!s.active && <span className="px-2 py-0.5 text-xs rounded-full bg-[#243040] text-[rgba(245,239,227,0.45)] font-semibold">Paused</span>}
                        </div>
                        <p className="text-xs text-[rgba(245,239,227,0.40)] mt-0.5">
                          {s.description || "No description"} · Next: {new Date(s.nextDueAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-[#F5EFE3]">{formatCurrency(s.amount)}</p>
                        <p className="text-xs text-[rgba(245,239,227,0.40)]">{s.currency}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleSchedule.mutate({ id: s.id, active: !s.active })}
                          disabled={toggleSchedule.isPending}
                          className="p-2 rounded-lg hover:bg-[#243040] text-[rgba(245,239,227,0.40)] hover:text-[rgba(245,239,227,0.55)] transition-colors"
                          title={s.active ? "Pause schedule" : "Resume schedule"}
                        >
                          {s.active ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                        <button
                          onClick={() => deleteScheduleM.mutate({ id: s.id })}
                          disabled={deleteScheduleM.isPending}
                          className="p-2 rounded-lg hover:bg-red-500/100/10 text-[rgba(245,239,227,0.35)] hover:text-red-400 transition-colors"
                          aria-label="Delete schedule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Info box */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
            <Calendar className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Automatic Invoice Generation</p>
              <p className="text-xs text-amber-400 mt-0.5">Invoices are generated automatically at midnight on each due date. You’ll receive a notification when a new invoice is created. Clients with email addresses on file will be notified automatically.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Invoices tab content ── */}
      {invTab === "invoices" && (
      <>
      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-[#243040] rounded-xl overflow-x-auto">
        {(["all", "unpaid", "paid", "overdue"] as const).map(f => (
          <button key={f} onClick={() => setInvFilter(f)} className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
            invFilter === f ? "bg-[#D4922A]/20 text-[#D4922A] shadow-sm" : "text-[rgba(245,239,227,0.55)] hover:text-[rgba(245,239,227,0.75)]"
          }`}>{f}</button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Paid", value: formatCurrency(invoiceStats?.totalRevenue || 0), color: "#D4922A", bg: "bg-[#D4922A]/10" },
          { label: "Outstanding", value: formatCurrency(invoiceStats?.outstanding || 0), color: "#6366F1", bg: "bg-indigo-50" },
          { label: "Overdue", value: String(invoiceStats?.overdue || 0), color: "#FF6B6B", bg: "bg-red-500/10" },
          { label: "Total Invoices", value: String(invoiceStats?.total || 0), color: "#F59E0B", bg: "bg-yellow-50" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3 sm:p-4`}>
            <p className="text-[11px] sm:text-xs font-semibold mb-1" style={{ color: s.color }}>{s.label}</p>
            <p className="text-lg sm:text-xl font-extrabold text-[#F5EFE3] leading-tight">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Bulk action toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 p-3 bg-[#1C2333] text-white rounded-xl">
          <span className="text-xs font-semibold flex-1">{selectedIds.size} selected</span>
          <button
            onClick={() => {
              const unpaidIds = Array.from(selectedIds).filter(id => filteredInvoices.find(i => i.id === id && i.status !== "paid"));
              if (unpaidIds.length === 0) { toast.info("All selected invoices are already paid."); return; }
              Promise.all(unpaidIds.map(id => markPaid.mutateAsync({ id })))
                .then(() => { utils.invoices.list.invalidate(); utils.invoices.stats.invalidate(); setSelectedIds(new Set()); toast.success(`${unpaidIds.length} invoice${unpaidIds.length > 1 ? "s" : ""} marked as paid!`); })
                .catch(e => toast.error(e.message));
            }}
            className="text-xs bg-[#D4922A] hover:bg-[#d4911c] text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
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
            className="text-xs bg-red-500/100 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
            disabled={bulkPending}
          >Delete</button>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-[rgba(245,239,227,0.45)] hover:text-white px-2 py-1.5 transition-colors">✕ Clear</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#161B22] rounded-xl border border-white/8 overflow-hidden">
        <div className="hidden sm:grid grid-cols-5 gap-4 px-5 py-3 bg-[#1C2333] text-xs font-semibold text-[rgba(245,239,227,0.55)] uppercase tracking-wide">
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" className="rounded w-3.5 h-3.5 accent-[#D4922A] cursor-pointer" checked={filteredInvoices.length > 0 && selectedIds.size === filteredInvoices.length} onChange={toggleSelectAll} title="Select all" />
            <span>Client / Service</span>
          </div>
          <span>Amount</span>
          <span>Due Date</span>
          <span>Status</span>
        </div>
        {isLoading ? (
          <div className="space-y-px">{[...Array(3)].map((_, i) => <div key={i} className="px-5 py-4 border-t border-white/5"><Skeleton className="h-10" /></div>)}</div>
        ) : !invoiceList || invoiceList.length === 0 ? (
          <div className="text-center py-16 text-[rgba(245,239,227,0.55)]">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium text-[rgba(245,239,227,0.55)]">No invoices yet</p>
            <p className="text-xs mt-1">Create your first invoice to start tracking payments.</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-12 text-[rgba(245,239,227,0.55)]">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium text-[rgba(245,239,227,0.55)]">No {invFilter !== "all" ? invFilter : ""} invoices</p>
          </div>
        ) : filteredInvoices.map(inv => (
          <div key={inv.id} className={`flex flex-col sm:grid sm:grid-cols-5 gap-2 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 border-t border-white/5 hover:bg-[#1C2333] transition-colors ${selectedIds.has(inv.id) ? "bg-[#D4922A]/5" : ""}`}>
            <div className="sm:col-span-2 flex items-start gap-2">
              <input type="checkbox" className="mt-1 rounded w-3.5 h-3.5 accent-[#D4922A] cursor-pointer flex-shrink-0" checked={selectedIds.has(inv.id)} onChange={() => toggleSelect(inv.id)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#F5EFE3] truncate">{inv.clientName}</p>
                <p className="text-xs text-[rgba(245,239,227,0.55)] truncate">{inv.invoiceNumber} · {inv.service || "General Service"}</p>
                {/* Mobile-only inline amount + due date */}
                <div className="flex items-center gap-3 mt-1 sm:hidden">
                  <span className="text-xs font-bold text-[#F5EFE3]">{formatCurrency(inv.amount)}</span>
                  {inv.dueDate && <span className="text-xs text-[rgba(245,239,227,0.55)]">Due {inv.dueDate}</span>}
                </div>
              </div>
            </div>
            <p className="hidden sm:block text-sm font-bold text-[#F5EFE3]">{formatCurrency(inv.amount)}</p>
            <p className="hidden sm:block text-sm text-[rgba(245,239,227,0.55)]">{inv.dueDate || "—"}</p>
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <Badge className={`text-xs border-0 flex-shrink-0 ${statusColor[inv.status] || "bg-[#243040] text-[rgba(245,239,227,0.55)]"}`}>{inv.status}</Badge>
              {inv.status !== "paid" && (
                <button onClick={() => markPaid.mutate({ id: inv.id })} className="text-xs text-[#D4922A] hover:underline font-medium" disabled={markPaid.isPending}>
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
              <button onClick={() => setPreviewInvoice(inv)} className="p-2 rounded hover:bg-[#243040] text-[rgba(245,239,227,0.55)] hover:text-[rgba(245,239,227,0.55)] transition-colors" aria-label="Preview invoice" title="Preview invoice">
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => openEditInvoice(inv)} className="p-2 rounded hover:bg-indigo-50 text-[rgba(245,239,227,0.45)] hover:text-indigo-600 transition-colors" aria-label="Edit invoice" title="Edit invoice">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { const link = `${window.location.origin}/portal?invoice=${inv.id}`; navigator.clipboard.writeText(link).then(() => toast.success("Invoice link copied!")).catch(() => toast.info(`Invoice link: ${link}`)); }} className="p-2 rounded hover:bg-blue-50 text-[rgba(245,239,227,0.45)] hover:text-blue-500 transition-colors" aria-label="Copy invoice link" title="Copy shareable invoice link">
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              {(inv.status === "sent" || inv.status === "overdue" || inv.status === "draft") && (
                <button
                  onClick={() => generatePayLink.mutate({ id: inv.id })}
                  className="p-2 rounded hover:bg-green-500/10 text-[rgba(245,239,227,0.45)] hover:text-green-500 transition-colors"
                  aria-label="Generate direct pay link"
                  title="Generate a direct pay link — client pays without logging in"
                  disabled={generatePayLink.isPending}
                >
                  <Link className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => duplicateInvoice.mutate({ id: inv.id })} className="p-2 rounded hover:bg-[#D4922A]/10 text-[rgba(245,239,227,0.45)] hover:text-[#D4922A] transition-colors" aria-label="Duplicate invoice" title="Duplicate invoice" disabled={duplicateInvoice.isPending}>
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setInvConfirm({ open: true, title: "Delete Invoice?", description: "Delete this invoice? This cannot be undone.", onConfirm: () => deleteInvoice.mutate({ id: inv.id }) })} className="p-2 rounded hover:bg-red-500/100/10 text-[rgba(245,239,227,0.45)] hover:text-red-500 transition-colors" aria-label="Delete invoice">
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
            <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">Select Client</label>
            <select onChange={e => { const c = clientList?.find(c => c.id === parseInt(e.target.value)); if (c) setForm(p => ({ ...p, clientName: c.name, clientEmail: c.email || "" })); }} className="form-input-light">
              <option value="">— Or enter manually below —</option>
              {clientList?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Field label="Client Name" value={form.clientName} onChange={setInvClientName} placeholder="Jane Smith" required autoComplete="name" enterKeyHint="next" />
          <Field label="Client Email" value={form.clientEmail} onChange={setInvClientEmail} placeholder="jane@example.com" type="email" autoComplete="email" enterKeyHint="next" />
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[rgba(245,239,227,0.55)]">Service Description</label>
              {form.service && (
                <Button size="sm" variant="outline" className="h-5 text-[10px] px-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={() => categorizeInvoice.mutate({ service: form.service, notes: form.notes, amount: parseFloat(form.amount) || 0 })} disabled={categorizeInvoice.isPending}>
                  {categorizeInvoice.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <><Sparkles className="w-2.5 h-2.5 mr-1" />AI Categorize</>}
                </Button>
              )}
            </div>
            <input value={form.service} onChange={e => setInvService(e.target.value)} placeholder="3-month coaching program, web design..." className="form-input-light" autoComplete="off" autoCorrect="off" autoCapitalize="sentences" spellCheck={false} enterKeyHint="next" />
          </div>
          {/* Line Items Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setUseLineItems(p => !p)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${useLineItems ? 'bg-[#D4922A]' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-[#161B22] shadow transition-transform ${useLineItems ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-xs font-semibold text-[rgba(245,239,227,0.55)]">Itemized line items</span>
          </div>

          {useLineItems ? (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)]">Line Items</label>
              {lineItems.map((item, idx) => (
                <LineItemRow
                  key={idx}
                  item={item}
                  idx={idx}
                  onChangeDesc={handleLineDesc}
                  onChangeQty={handleLineQty}
                  onChangePrice={handleLinePrice}
                  onRemove={handleLineRemove}
                />
              ))}
              <button
                type="button"
                onClick={() => setLineItems(p => [...p, { description: "", qty: 1, unitPrice: 0 }])}
                className="text-xs text-[#D4922A] hover:underline font-semibold"
              >+ Add line item</button>
              {lineItems.length > 0 && (
                <div className="text-right text-sm font-bold text-[#F5EFE3] pt-1">
                  Total: {formatCurrency(lineItemsTotal)}
                </div>
              )}
            </div>
          ) : (
            <Field label="Amount ($) *" value={form.amount} onChange={setInvAmount} placeholder="500.00" type="number" required autoComplete="off" enterKeyHint="next" />
          )}
          <Field label="Due Date" value={form.dueDate} onChange={setInvDueDate} type="date" autoComplete="off" />
          <Field label="Notes" value={form.notes} onChange={setInvNotes} placeholder="Payment terms, bank details..." textarea enterKeyHint="done" />
          <div>
            <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">Send as</label>
            <select value={form.status} onChange={e => setInvStatus(e.target.value)} className="form-input-light">
              <option value="draft">Save as Draft</option>
              <option value="sent">Mark as Sent</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="flex-1 gradient-amber text-white border-0 hover:opacity-90" onClick={() => createInvoice.mutate(useLineItems ? { ...form, amount: undefined, lineItems: lineItems.filter(i => i.description.trim()) } : { ...form, amount: parseFloat(form.amount) || 0 })} disabled={createInvoice.isPending || (useLineItems && lineItems.length === 0)}>
              {createInvoice.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Invoice"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Invoice Modal */}
      <Modal open={!!editInvoice} onClose={() => setEditInvoice(null)} title={`Edit Invoice ${editInvoice?.invoiceNumber || ""}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">Select Client</label>
            <select onChange={e => { const c = clientList?.find(c => c.id === parseInt(e.target.value)); if (c) setEditForm(p => ({ ...p, clientName: c.name, clientEmail: c.email || "" })); }} className="form-input-light">
              <option value="">— Or enter manually below —</option>
              {clientList?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Field label="Client Name" value={editForm.clientName} onChange={setEditClientName} placeholder="Jane Smith" required />
          <Field label="Client Email" value={editForm.clientEmail} onChange={setEditClientEmail} placeholder="jane@example.com" type="email" />
          <Field label="Service Description" value={editForm.service} onChange={setEditService} placeholder="3-month coaching program..." />
          {/* Line Items Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditUseLineItems(p => !p)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${editUseLineItems ? 'bg-[#D4922A]' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-[#161B22] shadow transition-transform ${editUseLineItems ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-xs font-semibold text-[rgba(245,239,227,0.55)]">Itemized line items</span>
          </div>
          {editUseLineItems ? (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)]">Line Items</label>
              {editLineItems.map((item, idx) => (
                <LineItemRow
                  key={idx}
                  item={item}
                  idx={idx}
                  onChangeDesc={handleEditLineDesc}
                  onChangeQty={handleEditLineQty}
                  onChangePrice={handleEditLinePrice}
                  onRemove={handleEditLineRemove}
                />
              ))}
              <button type="button" onClick={() => setEditLineItems(p => [...p, { description: "", qty: 1, unitPrice: 0 }])} className="text-xs text-[#D4922A] hover:underline font-semibold">+ Add line item</button>
              {editLineItems.length > 0 && (
                <div className="text-right text-sm font-bold text-[#F5EFE3] pt-1">Total: {formatCurrency(editLineItemsTotal)}</div>
              )}
            </div>
          ) : (
            <Field label="Amount ($) *" value={editForm.amount} onChange={setEditAmount} placeholder="500.00" type="number" required />
          )}
          <Field label="Due Date" value={editForm.dueDate} onChange={setEditDueDate} type="date" />
          <Field label="Notes" value={editForm.notes} onChange={setEditNotes} placeholder="Payment terms, bank details..." textarea />
          <div>
            <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">Status</label>
            <select value={editForm.status} onChange={e => setEditStatus(e.target.value)} className="form-input-light">
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditInvoice(null)}>Cancel</Button>
            <Button
              className="flex-1 gradient-amber text-white border-0 hover:opacity-90"
              onClick={() => updateInvoice.mutate(editUseLineItems
                ? { id: editInvoice.id, ...editForm, amount: undefined, lineItems: editLineItems.filter(i => i.description.trim()) }
                : { id: editInvoice.id, ...editForm, amount: parseFloat(editForm.amount) || 0 }
              )}
              disabled={updateInvoice.isPending || (editUseLineItems && editLineItems.length === 0)}
            >
              {updateInvoice.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invoice Preview Modal */}
      <Modal open={!!previewInvoice} onClose={() => setPreviewInvoice(null)} title="Invoice Preview" wide>
        {previewInvoice && (
          <div className="font-sans">
            {/* Accent bar */}
            <div className="h-1 bg-[#D4922A] rounded-t-lg -mx-6 -mt-2 mb-5" />

            {/* Header: INVOICE label + meta */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[11px] font-bold tracking-widest text-[rgba(245,239,227,0.40)] uppercase mb-1">Invoice</p>
                <p className="text-3xl font-extrabold text-[#D4922A] tracking-tight">
                  {previewInvoice.invoiceNumber || `#${previewInvoice.id}`}
                </p>
              </div>
              <div className="text-right space-y-1">
                <div className="flex items-center justify-end gap-2">
                  <span className="text-[11px] text-[rgba(245,239,227,0.40)] uppercase tracking-wide">Status</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                    previewInvoice.status === "paid" ? "bg-green-500/15 text-green-400" :
                    previewInvoice.status === "overdue" ? "bg-red-500/15 text-red-400" :
                    "bg-amber-500/15 text-amber-400"
                  }`}>{previewInvoice.status}</span>
                </div>
                <p className="text-xs text-[rgba(245,239,227,0.45)]">Issued {formatDate(previewInvoice.createdAt)}</p>
                {previewInvoice.dueDate && (
                  <p className="text-xs text-[rgba(245,239,227,0.45)]">Due {formatDate(previewInvoice.dueDate)}</p>
                )}
              </div>
            </div>

            {/* Bill To */}
            <div className="mb-4">
              <p className="text-[10px] font-bold tracking-widest text-[rgba(245,239,227,0.40)] uppercase mb-1">Bill To</p>
              <p className="text-sm font-semibold text-[#F5EFE3]">{previewInvoice.clientName}</p>
              {previewInvoice.clientEmail && <p className="text-xs text-[rgba(245,239,227,0.45)]">{previewInvoice.clientEmail}</p>}
            </div>

            {/* Line items table */}
            {(() => {
              let parsedItems: { description: string; qty: number; unitPrice: number }[] = [];
              try { if (previewInvoice.lineItems) parsedItems = JSON.parse(previewInvoice.lineItems); } catch {}
              const hasItems = parsedItems.length > 0;
              return (
                <div className="overflow-x-auto mb-4">
                <div className="border border-white/10 rounded-lg overflow-hidden min-w-[280px]">
                  <div className="grid grid-cols-[1fr_60px_90px] bg-[#1C2333] border-b border-white/10">
                    <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-[rgba(245,239,227,0.40)] uppercase">Description</div>
                    <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-[rgba(245,239,227,0.40)] uppercase text-center">Qty</div>
                    <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-[rgba(245,239,227,0.40)] uppercase text-right">Amount</div>
                  </div>
                  {hasItems ? parsedItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_60px_90px] bg-[#161B22] border-b border-white/8 last:border-0">
                      <div className="px-4 py-2.5"><p className="text-sm font-medium text-[#F5EFE3]">{item.description}</p></div>
                      <div className="px-4 py-2.5 text-sm text-[rgba(245,239,227,0.55)] text-center">{item.qty}</div>
                      <div className="px-4 py-2.5 text-sm font-semibold text-[#F5EFE3] text-right">{formatCurrency(item.qty * item.unitPrice)}</div>
                    </div>
                  )) : (
                    <div className="grid grid-cols-[1fr_60px_90px] bg-[#1C2333]">
                      <div className="px-4 py-3">
                        <p className="text-sm font-medium text-[#F5EFE3]">{previewInvoice.service || "Professional Services"}</p>
                        <p className="text-xs text-[rgba(245,239,227,0.40)] mt-0.5">{previewInvoice.clientName}</p>
                      </div>
                      <div className="px-4 py-3 text-sm text-[rgba(245,239,227,0.55)] text-center">1</div>
                      <div className="px-4 py-3 text-sm font-bold text-[#F5EFE3] text-right">{formatCurrency(previewInvoice.amount)}</div>
                    </div>
                  )}
                  <div className="grid grid-cols-[1fr_auto] bg-amber-500/10 border-t border-white/10">
                    <div className="px-4 py-3 text-xs font-bold text-[rgba(245,239,227,0.45)] uppercase tracking-wide">Total Due</div>
                    <div className="px-4 py-3 text-xl font-extrabold text-[#D4922A] text-right">{formatCurrency(previewInvoice.amount)}</div>
                  </div>
                </div>
                </div>
              );
            })()}

            {/* Notes */}
            {previewInvoice.notes && (
              <div className="bg-[#1C2333] border border-white/10 rounded-lg p-3 mb-4">
                <p className="text-[10px] font-bold tracking-widest text-[rgba(245,239,227,0.40)] uppercase mb-1">Notes</p>
                <p className="text-sm text-[rgba(245,239,227,0.55)] leading-relaxed">{previewInvoice.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <a
                href={`/api/invoices/${previewInvoice.id}/pdf`}
                download
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-[#D4922A] text-white hover:bg-[#D4911A] transition-colors"
              >
                <Download className="w-4 h-4" /> Download PDF
              </a>
              {previewInvoice.status !== "paid" && (
                <Button variant="outline" className="flex-1 gap-2" onClick={() => { markPaid.mutate({ id: previewInvoice.id }); setPreviewInvoice(null); }}>
                  <CheckCircle className="w-4 h-4 text-green-500" /> Mark Paid
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
      </>
      )} {/* end invTab === "invoices" */}

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
  const [fuTab, setFuTab] = useState<"emails" | "sequences">("emails");
  const [showGenerate, setShowGenerate] = useState(false);
  const [previewFollowUp, setPreviewFollowUp] = useState<any>(null);
  const [form, setForm] = useState({ clientName: "", clientEmail: "", service: "", context: "", tone: "professional" as "professional" | "friendly" | "motivational" });
  const setFollowFormField = useFormFields(setForm);
  const setFollowClientName  = setFollowFormField("clientName");
  const setFollowClientEmail = setFollowFormField("clientEmail");
  const setFollowService     = setFollowFormField("service");
  const setFollowContext     = setFollowFormField("context");
  const [fuConfirm, setFuConfirm] = useState<ConfirmState>(defaultConfirm);
  // Sequences
  const [showAddRule, setShowAddRule] = useState(false);
  const [ruleForm, setRuleForm] = useState({ triggerDays: 30, tone: "friendly" as "professional" | "friendly" | "motivational", context: "" });
  const setRuleFormField = useFormFields(setRuleForm);
  const setRuleContext = setRuleFormField("context");
  const { data: rules = [], isLoading: rulesLoading } = trpc.followUpRules.list.useQuery(undefined, { retry: 1 });
  const addRule = trpc.followUpRules.create.useMutation({ onSuccess: () => { utils.followUpRules.list.invalidate(); setShowAddRule(false); toast.success("Sequence rule created!"); } });
  const deleteRule = trpc.followUpRules.delete.useMutation({ onSuccess: () => { utils.followUpRules.list.invalidate(); toast.success("Rule deleted."); } });
  const toggleRule = trpc.followUpRules.update.useMutation({ onSuccess: () => utils.followUpRules.list.invalidate() });

  const { data: followUpList, isLoading } = trpc.followUps.list.useQuery(undefined, { retry: 1 });
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
  const sendEmailMut = trpc.followUps.sendEmail.useMutation({
    onSuccess: () => { utils.followUps.list.invalidate(); setPreviewFollowUp(null); toast.success("Email sent successfully!"); },
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
          <h2 className="text-xl font-extrabold text-[#F5EFE3]">AI Follow-Ups</h2>
          <p className="text-sm text-[rgba(245,239,227,0.55)]">Let AI write personalized follow-up emails for your clients</p>
        </div>
        {fuTab === "emails" ? (
          <Button size="sm" className="gradient-amber text-white border-0 hover:opacity-90 gap-1.5" onClick={() => setShowGenerate(true)}>
            <Zap className="w-3.5 h-3.5" />Generate Email
          </Button>
        ) : (
          <Button size="sm" className="gradient-amber text-white border-0 hover:opacity-90 gap-1.5" onClick={() => setShowAddRule(true)}>
            <Plus className="w-3.5 h-3.5" />New Rule
          </Button>
        )}
      </div>
      {/* Tab Bar */}
      <div className="flex gap-1 bg-[#243040] rounded-xl p-1">
        {(["emails", "sequences"] as const).map(t => (
          <button key={t} onClick={() => setFuTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
              fuTab === t ? "bg-[#D4922A]/20 text-[#D4922A] shadow-sm" : "text-[rgba(245,239,227,0.45)] hover:text-[rgba(245,239,227,0.75)]"
            }`}>
            {t === "sequences" ? "Auto-Sequences" : "AI Emails"}
          </button>
        ))}
      </div>

      {fuTab === "sequences" && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-[#6366F1]/10 to-[#D4922A]/10 border border-[#6366F1]/20 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#6366F1] flex items-center justify-center text-white flex-shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[#F5EFE3] text-sm">Automated Follow-Up Rules</h3>
                <p className="text-xs text-[rgba(245,239,227,0.55)] mt-1 leading-relaxed">
                  Set a rule once and the system automatically generates and queues a follow-up email when a client hasn't booked in X days. Rules run daily — passive revenue recovery while you sleep.
                </p>
              </div>
            </div>
          </div>
          {rulesLoading ? (
            [...Array(2)].map((_, i) => <Skeleton key={i} className="h-16" />)
          ) : rules.length === 0 ? (
            <div className="bg-[#161B22] rounded-xl border border-white/8 text-center py-12 text-[rgba(245,239,227,0.55)]">
              <Zap className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No automation rules yet</p>
              <p className="text-xs mt-1">Create your first rule to start automating follow-ups.</p>
            </div>
          ) : (rules as Array<{ id: number; name: string; triggerDays: number; emailSubject: string; active: boolean }>).map(r => (
            <div key={r.id} className="bg-[#161B22] rounded-xl border border-white/8 p-4 flex items-center gap-3">
              <div className={`w-2 h-10 rounded-full flex-shrink-0 ${r.active ? "bg-green-400" : "bg-gray-200"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#F5EFE3]">{r.name}</p>
                <p className="text-xs text-[rgba(245,239,227,0.55)] mt-0.5">Triggers after <span className="font-semibold text-[#D4922A]">{r.triggerDays} days</span> of no booking · {r.emailSubject}</p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => toggleRule.mutate({ id: r.id, active: !r.active })} className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${r.active ? "bg-green-500/15 text-green-400 hover:bg-green-500/25" : "bg-[#243040] text-[rgba(245,239,227,0.45)] hover:bg-white/12"}`}>
                  {r.active ? "Active" : "Paused"}
                </button>
                <button onClick={() => deleteRule.mutate({ id: r.id })} className="p-2 rounded-lg hover:bg-red-500/100/10 text-[rgba(245,239,227,0.45)] hover:text-red-500 transition-colors" aria-label="Delete rule">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {/* Add Rule Modal */}
          <Modal open={showAddRule} onClose={() => setShowAddRule(false)} title="New Automation Rule">
            <div className="space-y-4">
              <Field label="Rule Name *" value={ruleForm.context} onChange={setRuleContext} placeholder="e.g. 30-Day Re-engagement" required />
              <div>
                <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">Trigger: No booking in</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={1} max={365} value={ruleForm.triggerDays} onChange={e => setRuleForm(p => ({ ...p, triggerDays: parseInt(e.target.value) || 30 }))}
                    className="form-input-light w-24 text-center" />
                  <span className="text-sm text-[rgba(245,239,227,0.55)]">days</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">Email Tone</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["professional", "friendly", "motivational"] as const).map(t => (
                    <button key={t} onClick={() => setRuleForm(p => ({ ...p, tone: t }))}
                      className={`py-2 px-3 text-xs font-semibold rounded-xl border-2 transition-all capitalize ${ruleForm.tone === t ? "border-[#D4922A] bg-[#D4922A]/10 text-[#D4922A]" : "border-white/10 text-[rgba(245,239,227,0.55)] hover:border-white/15"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowAddRule(false)}>Cancel</Button>
                <Button className="flex-1 gradient-amber text-white border-0 hover:opacity-90" onClick={() => addRule.mutate({ name: ruleForm.context || `${ruleForm.triggerDays}-Day Rule`, triggerDays: ruleForm.triggerDays, emailSubject: `Checking in — let's reconnect`, emailBody: `Hi {{clientName}}, I noticed it's been a while since we last connected. I'd love to catch up and see how things are going. Would you like to schedule a session?` })} disabled={addRule.isPending}>
                  {addRule.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Rule"}
                </Button>
              </div>
            </div>
          </Modal>
        </div>
      )}
      {fuTab === "emails" && <>
      {/* Info Card */}
      <div className="bg-gradient-to-r from-[#D4922A]/10 to-[#6366F1]/10 border border-[#D4922A]/20 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl gradient-amber flex items-center justify-center text-white flex-shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-[#F5EFE3] text-sm">How AI Follow-Ups Work</h3>
            <p className="text-xs text-[rgba(245,239,227,0.55)] mt-1 leading-relaxed">
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
          <div className="bg-[#161B22] rounded-xl border border-white/8 text-center py-16 text-[rgba(245,239,227,0.55)]">
            <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium text-[rgba(245,239,227,0.55)]">No follow-ups generated yet</p>
            <p className="text-xs mt-1">Generate your first AI follow-up email above.</p>
          </div>
        ) : followUpList.map(f => (
          <div key={f.id} className="bg-[#161B22] rounded-xl border border-white/8 p-4 hover:border-[#D4922A]/30 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-[#F5EFE3]">{f.clientName}</p>
                  <Badge className={`text-xs border-0 ${f.status === "sent" ? "bg-green-500/10 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>
                    {f.status}
                  </Badge>
                </div>
                <p className="text-xs text-[rgba(245,239,227,0.55)] mt-0.5 font-medium">{f.subject}</p>
                <p className="text-xs text-[rgba(245,239,227,0.55)] mt-1 line-clamp-2">{f.body}</p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => copyToClipboard(f.body)} className="p-2 rounded-lg hover:bg-[#D4922A]/10 text-[rgba(245,239,227,0.55)] hover:text-[#D4922A] transition-colors" aria-label="Copy email body to clipboard" title="Copy email body">
                  <Copy className="w-4 h-4" />
                </button>
                <button onClick={() => setPreviewFollowUp(f)} className="p-2 rounded-lg hover:bg-[#243040] text-[rgba(245,239,227,0.55)] hover:text-[rgba(245,239,227,0.55)] transition-colors" aria-label="Preview email">
                  <Eye className="w-4 h-4" />
                </button>
                {f.status === "draft" && (
                  <button onClick={() => markSent.mutate({ id: f.id })} className="p-2 rounded-lg hover:bg-green-500/10 text-[rgba(245,239,227,0.55)] hover:text-green-600 transition-colors" aria-label="Mark as sent">
                    <Send className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => setFuConfirm({ open: true, title: "Delete Follow-Up?", description: "Delete this follow-up email? This cannot be undone.", onConfirm: () => deleteFollowUp.mutate({ id: f.id }) })} className="p-2 rounded-lg hover:bg-red-500/100/10 text-[rgba(245,239,227,0.45)] hover:text-red-500 transition-colors" aria-label="Delete follow-up">
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
            <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">Select Client</label>
            <select onChange={e => { const c = clientList?.find(c => c.id === parseInt(e.target.value)); if (c) setForm(p => ({ ...p, clientName: c.name, clientEmail: c.email || "", service: c.service || "" })); }} className="form-input-light">
              <option value="">— Or enter manually below —</option>
              {clientList?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Field label="Client Name *" value={form.clientName} onChange={setFollowClientName} placeholder="Jane Smith" required autoComplete="name" enterKeyHint="next" />
          <Field label="Client Email" value={form.clientEmail} onChange={setFollowClientEmail} placeholder="jane@example.com" type="email" autoComplete="email" enterKeyHint="next" />
          <Field label="Service / Context" value={form.service} onChange={setFollowService} placeholder="Business coaching, web design..." autoComplete="off" enterKeyHint="next" />
          <Field label="Additional Context (optional)" value={form.context} onChange={setFollowContext} placeholder="Last session was about goal-setting, they struggled with time management..." textarea enterKeyHint="done" />
          <div>
            <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">Email Tone</label>
            <div className="grid grid-cols-3 gap-2">
              {(["professional", "friendly", "motivational"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setForm(p => ({ ...p, tone: t }))}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border-2 transition-all capitalize ${form.tone === t ? "border-[#D4922A] bg-[#D4922A]/10 text-[#D4922A]" : "border-white/10 text-[rgba(245,239,227,0.55)] hover:border-white/15"}`}
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

      {/* Email Preview Modal */}
      <Modal open={!!previewFollowUp} onClose={() => setPreviewFollowUp(null)} title="Email Preview" wide>
        {previewFollowUp && (
          <div className="font-sans">
            {/* Email client header */}
            <div className="bg-[#1C2333] border border-white/10 rounded-xl mb-4 overflow-hidden">
              <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2">
                <span className="text-[11px] font-bold text-[rgba(245,239,227,0.40)] uppercase tracking-wide w-14">From</span>
                <span className="text-sm text-[rgba(245,239,227,0.75)]">TrueAxis HQ &lt;noreply@trueaxishq.com&gt;</span>
              </div>
              <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2">
                <span className="text-[11px] font-bold text-[rgba(245,239,227,0.40)] uppercase tracking-wide w-14">To</span>
                <span className="text-sm text-[rgba(245,239,227,0.75)]">{previewFollowUp.clientEmail || previewFollowUp.clientName}</span>
              </div>
              <div className="px-4 py-2 flex items-center gap-2">
                <span className="text-[11px] font-bold text-[rgba(245,239,227,0.40)] uppercase tracking-wide w-14">Subject</span>
                <span className="text-sm font-semibold text-[#F5EFE3]">{previewFollowUp.subject}</span>
              </div>
            </div>

            {/* Email body — rendered as it will appear */}
            <div className="bg-[#161B22] rounded-xl p-4 mb-4">
              <div className="bg-[#161B22] rounded-lg shadow-sm overflow-hidden">
                {/* Top accent bar */}
                <div className="h-1 bg-[#D4922A]" />
                {/* Brand header */}
                <div className="px-5 py-4 border-b border-white/8 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[#D4922A] flex items-center justify-center">
                    <span className="text-white font-black text-xs">T</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#F5EFE3] leading-none">TrueAxis HQ</p>
                    <p className="text-[10px] text-[rgba(245,239,227,0.40)] mt-0.5">AI-Powered Business OS for Freelancers</p>
                  </div>
                </div>
                {/* Body */}
                <div className="px-5 py-5">
                  <h2 className="text-base font-bold text-[#F5EFE3] mb-2">{previewFollowUp.subject}</h2>
                  <p className="text-sm text-[rgba(245,239,227,0.45)] mb-3">Hi {previewFollowUp.clientName},</p>
                  {previewFollowUp.body.split("\n").filter((l: string) => l.trim()).map((line: string, i: number) => (
                    <p key={i} className="text-sm text-[rgba(245,239,227,0.55)] leading-relaxed mb-2">{line}</p>
                  ))}
                </div>
                {/* Footer */}
                <div className="px-5 py-3 bg-[#1C2333] border-t border-white/8">
                  <p className="text-[10px] text-[rgba(245,239,227,0.40)] text-center">&copy; {new Date().getFullYear()} TrueAxis HQ &mdash; <span className="text-[#D4922A]">Unsubscribe</span></p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button className="flex-1 bg-[#D4922A] hover:bg-[#D4911A] text-white gap-2" onClick={() => copyToClipboard(previewFollowUp.body)}>
                {copied ? <><Check className="w-4 h-4" />Copied!</> : <><Copy className="w-4 h-4" />Copy Body</>}
              </Button>
              {previewFollowUp.clientEmail && previewFollowUp.status === "draft" && previewFollowUp.id && (
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2" onClick={() => sendEmailMut.mutate({ id: previewFollowUp.id })} disabled={sendEmailMut.isPending}>
                  {sendEmailMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" />Send Email</>}
                </Button>
              )}
              {(!previewFollowUp.clientEmail || previewFollowUp.status !== "draft") && previewFollowUp.id && previewFollowUp.status === "draft" && (
                <Button variant="outline" className="flex-1 gap-2" onClick={() => { markSent.mutate({ id: previewFollowUp.id }); setPreviewFollowUp(null); }}>
                  <Send className="w-4 h-4" />Mark Sent
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
      </>
      }
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
    { label: "Total Revenue", value: formatCurrency(analytics?.totalRevenue || 0), icon: DollarSign, color: "#D4922A" },
    { label: "Active Clients", value: String(analytics?.activeClients || 0), icon: Users, color: "#6366F1" },
    { label: "Sessions Booked", value: String(analytics?.completedSessions || 0), icon: Calendar, color: "#F59E0B" },
    { label: "Conversion Rate", value: analytics?.totalClients ? `${Math.round((analytics.activeClients / analytics.totalClients) * 100)}%` : "0%", icon: TrendingUp, color: "#FF6B6B" },
  ];

  const pieData = [
    { name: "Active", value: analytics?.activeClients || 0, color: "#D4922A" },
    { name: "Prospects", value: analytics?.totalClients || 0, color: "#6366F1" },
    { name: "Inactive", value: analytics?.activeClients || 0, color: "#E5E7EB" },
  ].filter(d => d.value > 0);

  const topServices = analytics?.topServices || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-[#F5EFE3]">Analytics</h2>
        <p className="text-sm text-[rgba(245,239,227,0.55)]">Your business performance at a glance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-[#161B22] rounded-xl p-4 border border-white/8">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white mb-3" style={{ backgroundColor: s.color }}>
              <s.icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-extrabold text-[#F5EFE3]">{s.value}</p>
            <p className="text-xs text-[rgba(245,239,227,0.55)] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-[#161B22] rounded-xl p-5 border border-white/8">
          <h3 className="font-bold text-[#F5EFE3] text-sm mb-4">Revenue Trend</h3>
          {analytics?.monthlyRevenue?.some(d => d.revenue > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={analytics.monthlyRevenue}>
                <defs>
                  <linearGradient id="amberGrad3" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4922A" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#D4922A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: "12px" }} formatter={(v: number) => [formatCurrency(v), "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#D4922A" strokeWidth={2.5} fill="url(#amberGrad3)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-[rgba(245,239,227,0.55)]">
              <DollarSign className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm text-center">Revenue data will appear once you create and mark invoices as paid.</p>
            </div>
          )}
        </div>

        <div className="bg-[#161B22] rounded-xl p-5 border border-white/8">
          <h3 className="font-bold text-[#F5EFE3] text-sm mb-4">Client Breakdown</h3>
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
                    <span className="text-sm text-[rgba(245,239,227,0.55)] truncate">{d.name}</span>
                    <span className="text-sm font-bold text-[#F5EFE3] ml-auto pl-2 flex-shrink-0">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-36 flex flex-col items-center justify-center text-[rgba(245,239,227,0.55)]">
              <Users className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Add clients to see breakdown.</p>
            </div>
          )}
        </div>

        {topServices.length > 0 && (
          <div className="bg-[#161B22] rounded-xl p-5 border border-white/8 lg:col-span-2">
            <h3 className="font-bold text-[#F5EFE3] text-sm mb-4">Top Services by Revenue</h3>
            <div className="space-y-3">
              {topServices.slice(0, 5).map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-[rgba(245,239,227,0.55)] w-4">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-[#F5EFE3]">{s.name ?? s.service}</span>
                      <span className="text-sm font-bold text-[#D4922A]">{formatCurrency(s.revenue)}</span>
                    </div>
                    <div className="h-1.5 bg-[#243040] rounded-full overflow-hidden">
                      <div className="h-full bg-[#D4922A] rounded-full" style={{ width: `${Math.min((s.revenue / topServices[0].revenue) * 100, 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Revenue Forecast */}
        {analytics?.forecast && analytics.forecast.some(d => d.revenue > 0) && (
          <div className="bg-[#161B22] rounded-xl p-5 border border-white/8 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[#F5EFE3] text-sm">Revenue Forecast (90-Day)</h3>
              <div className="flex items-center gap-4 text-xs text-[rgba(245,239,227,0.55)]">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#D4922A] inline-block" />Actual</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#D4922A] opacity-40 inline-block border-dashed border-t border-[#D4922A]" />Projected</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={analytics.forecast}>
                <defs>
                  <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4922A" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#D4922A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: "12px" }} formatter={(v: number, _: string, p: any) => [formatCurrency(v), p.payload.projected ? "Projected" : "Actual"]} />
                <Area type="monotone" dataKey="revenue" stroke="#D4922A" strokeWidth={2.5} fill="url(#forecastGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Client LTV */}
        {analytics?.clientLTV && analytics.clientLTV.length > 0 && (
          <div className="bg-[#161B22] rounded-xl p-5 border border-white/8">
            <h3 className="font-bold text-[#F5EFE3] text-sm mb-4">Top Clients by LTV</h3>
            <div className="space-y-3">
              {analytics.clientLTV.slice(0, 6).map((c: any, i: number) => (
                <div key={c.clientId} className="flex items-center gap-3">
                  <span className="text-xs text-[rgba(245,239,227,0.55)] w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-[#F5EFE3] truncate">{c.name}</span>
                      <span className="text-sm font-bold text-[#D4922A] ml-2 flex-shrink-0">{formatCurrency(c.ltv)}</span>
                    </div>
                    <div className="h-1.5 bg-[#243040] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min((c.ltv / analytics.clientLTV[0].ltv) * 100, 100)}%`, background: i === 0 ? "#D4922A" : "#6366F1" }} />
                    </div>
                    <p className="text-[10px] text-[rgba(245,239,227,0.55)] mt-0.5">{c.invoiceCount} invoice{c.invoiceCount !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Referral Sources */}
        {analytics?.referralSources && analytics.referralSources.length > 0 && (
          <div className="bg-[#161B22] rounded-xl p-5 border border-white/8">
            <h3 className="font-bold text-[#F5EFE3] text-sm mb-4">Lead Sources</h3>
            <div className="space-y-3">
              {analytics.referralSources.slice(0, 6).map((s: any, i: number) => {
                const total = analytics.referralSources.reduce((sum: number, r: any) => sum + r.count, 0);
                const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                const colors = ["#D4922A", "#6366F1", "#5A9A7A", "#FF6B6B", "#F59E0B", "#8B5CF6"];
                return (
                  <div key={s.source} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: colors[i % colors.length] }} />
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-[#F5EFE3] capitalize">{s.source.replace(/_/g, " ")}</span>
                        <span className="text-xs font-bold text-[rgba(245,239,227,0.55)]">{s.count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-[#243040] rounded-full overflow-hidden">
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

// ─── Settings Panel ─────────────────────────────────────────────────────
// ─── Billing Section (inline in Settings) ─────────────────────────────────────────────────────
const BILLING_PLAN_ICONS: Record<string, React.ElementType> = { starter: Zap, pro: Star, agency: Crown };
const BILLING_PLAN_COLORS: Record<string, string> = { starter: "bg-blue-500", pro: "bg-[#D4922A]", agency: "bg-purple-600" };

function BillingSection() {
  const { isAuthenticated } = useAuth();
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const subscriptionQuery = trpc.billing.getSubscription.useQuery(undefined, { enabled: isAuthenticated });
  const plansQuery = trpc.billing.getPlans.useQuery(undefined, { retry: 1 });
  const checkoutMutation = trpc.billing.createCheckout.useMutation({
    onSuccess: (data) => { if (data.url) { toast.info("Redirecting to checkout…"); window.open(data.url, "_blank"); } },
    onError: (e) => toast.error("Checkout error: " + e.message),
  });
  const portalMutation = trpc.billing.createPortal.useMutation({
    onSuccess: (data) => { if (data.url) { toast.info("Opening billing portal…"); window.open(data.url, "_blank"); } },
    onError: (e) => toast.error("Portal error: " + e.message),
  });

  const currentPlan = subscriptionQuery.data?.planId ?? "free";
  const currentStatus = subscriptionQuery.data?.status ?? "free";
  const hasActiveSubscription = currentStatus === "active";
  const plans = plansQuery.data ?? [];

  return (
    <div className="bg-[#161B22] rounded-xl border border-white/8 p-6 space-y-5">
      <h3 className="font-bold text-sm text-[#F5EFE3] flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-[#D4922A]" />Billing &amp; Subscription
      </h3>

      {/* Current plan status */}
      <div className="flex items-center justify-between p-3 bg-[#1C2333] border border-white/8 rounded-xl">
        <div className="flex items-center gap-3">
          {(() => {
            const Icon = BILLING_PLAN_ICONS[currentPlan] ?? Zap;
            const color = BILLING_PLAN_COLORS[currentPlan] ?? "bg-gray-400";
            return <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}><Icon className="w-4 h-4 text-white" /></div>;
          })()}
          <div>
            <p className="text-sm font-semibold text-[#F5EFE3] capitalize">
              {currentPlan === "free" ? "Free Plan" : `${currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} Plan`}
            </p>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mt-0.5 ${
              currentStatus === "active" ? "bg-green-500/15 text-green-400" :
              currentStatus === "past_due" ? "bg-yellow-500/15 text-yellow-400" :
              currentStatus === "cancelled" ? "bg-red-500/15 text-red-400" :
              "bg-[#243040] text-[rgba(245,239,227,0.55)]"
            }`}>
              {currentStatus === "active" && <CheckCircle className="w-3 h-3" />}
              {currentStatus === "active" ? "Active" : currentStatus === "past_due" ? "Payment Due" : currentStatus === "cancelled" ? "Cancelled" : "Free"}
            </span>
          </div>
        </div>
        {hasActiveSubscription && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => portalMutation.mutate({ origin: window.location.origin })} disabled={portalMutation.isPending}>
            {portalMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><CreditCard className="w-3.5 h-3.5" />Manage<ExternalLink className="w-3 h-3" /></>}
          </Button>
        )}
      </div>

      {/* Interval toggle */}
      <div className="flex items-center gap-2">
        {(["monthly", "annual"] as const).map(opt => (
          <button
            key={opt}
            onClick={() => setBillingInterval(opt)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all border ${
              billingInterval === opt
                ? "gradient-amber text-white border-transparent shadow-sm"
                : "bg-[#1C2333] text-[rgba(245,239,227,0.55)] border-white/10 hover:border-white/15"
            }`}
          >
            {opt === "monthly" ? "Monthly" : (
              <span className="flex items-center justify-center gap-1.5">
                Annual
                <span className="text-[10px] bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded-full font-bold">Save 20%</span>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Plans grid */}
      <div className="grid sm:grid-cols-3 gap-3">
        {plansQuery.isLoading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-64" />)
        ) : (
          plans.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            const price = billingInterval === "annual"
              ? Math.round((plan.annualPrice / 100) * 0.8)
              : plan.monthlyPrice / 100;
            const Icon = BILLING_PLAN_ICONS[plan.id] ?? Zap;
            const color = BILLING_PLAN_COLORS[plan.id] ?? "bg-gray-400";
            return (
              <div
                key={plan.id}
                className={`rounded-xl border-2 p-4 flex flex-col transition-all ${
                  plan.highlighted ? "border-[#D4922A] shadow-md shadow-[#D4922A]/10 bg-[#D4922A]/3" :
                  isCurrent ? "border-blue-300 bg-blue-50/30" :
                  "border-white/8 bg-[#1C2333] hover:border-white/10"
                }`}
              >
                {plan.highlighted && (
                  <div className="text-[10px] font-bold text-[#D4922A] bg-[#D4922A]/10 rounded-full px-2 py-0.5 text-center mb-3 -mt-0.5">Most Popular</div>
                )}
                {isCurrent && !plan.highlighted && (
                  <div className="text-[10px] font-bold text-blue-600 bg-blue-50 rounded-full px-2 py-0.5 text-center mb-3 -mt-0.5">Current Plan</div>
                )}
                <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center mb-3`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <p className="text-sm font-extrabold text-[#F5EFE3] mb-0.5">{plan.name}</p>
                <p className="text-[11px] text-[rgba(245,239,227,0.45)] mb-3 leading-snug">{plan.description}</p>
                <div className="mb-3">
                  <span className="text-xl font-extrabold text-[#F5EFE3]">${price}</span>
                  <span className="text-xs text-[rgba(245,239,227,0.45)]">/mo</span>
                  {billingInterval === "annual" && <p className="text-[10px] text-green-600 font-semibold">Billed annually</p>}
                </div>
                <ul className="space-y-1.5 mb-4 flex-1">
                  {plan.features.slice(0, 4).map((feature: string) => (
                    <li key={feature} className="flex items-start gap-1.5 text-[11px] text-[rgba(245,239,227,0.55)]">
                      <CheckCircle className="w-3 h-3 text-[#D4922A] flex-shrink-0 mt-0.5" />{feature}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Button variant="outline" size="sm" className="w-full text-xs" disabled>Current Plan</Button>
                ) : (
                  <Button
                    size="sm"
                    className={`w-full gap-1.5 text-xs ${
                      plan.highlighted ? "gradient-amber text-white border-0" : "bg-gray-200 text-[rgba(245,239,227,0.75)] border-0 hover:bg-gray-300"
                    }`}
                    onClick={() => checkoutMutation.mutate({ planId: plan.id as "starter" | "pro" | "agency", interval: billingInterval, origin: window.location.origin })}
                    disabled={checkoutMutation.isPending}
                  >
                    {checkoutMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Get Started<ArrowRight className="w-3 h-3" /></>}
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Test mode notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-start gap-2">
        <Shield className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-yellow-800">Test Mode Active</p>
          <p className="text-[11px] text-yellow-700 mt-0.5">Use card <code className="bg-yellow-100 px-1 rounded font-mono">4242 4242 4242 4242</code> with any future expiry to test payments.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Change Password Section ─────────────────────────────────────────────────────
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
    <div className="bg-[#161B22] rounded-xl border border-white/8 p-6 space-y-4">
      <h3 className="font-bold text-sm text-[#F5EFE3] flex items-center gap-2">
        <Settings className="w-4 h-4 text-[#D4922A]" />Change Password
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">Current Password</label>
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(245,239,227,0.55)] hover:text-[rgba(245,239,227,0.55)]"
              aria-label={showPasswords ? "Hide passwords" : "Show passwords"}
            >
              {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">New Password</label>
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
          <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">Confirm New Password</label>
          <input
            type={showPasswords ? "text" : "password"}
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            autoComplete="new-password"
            className={`form-input-light ${
              confirmPassword && confirmPassword !== newPassword ? "border-red-300" : "border-white/10"
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
          ? "bg-green-500/10 text-green-600 border border-green-200"
          : "bg-[#D4922A]/10 text-[#D4922A] border border-[#D4922A]/30 hover:bg-[#D4922A]/20"
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
  const { data: keys, isLoading } = trpc.apiKeys.list.useQuery(undefined, { retry: 1 });
  const createKey = trpc.apiKeys.create.useMutation({
    onSuccess: (data) => { setCreatedKey(data.key); setNewKeyName(""); utils.apiKeys.list.invalidate(); toast.success("API key created! Copy it now — it won't be shown again."); },
    onError: (e) => toast.error(e.message),
  });
  const revokeKey = trpc.apiKeys.revoke.useMutation({
    onSuccess: () => { utils.apiKeys.list.invalidate(); toast.success("API key revoked."); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="bg-[#161B22] rounded-xl border border-white/8 p-6 space-y-4">
      <h3 className="font-bold text-sm text-[#F5EFE3] flex items-center gap-2"><Zap className="w-4 h-4 text-[#D4922A]" />API Keys</h3>
      <p className="text-xs text-[rgba(245,239,227,0.55)]">Use API keys to integrate TrueAxis HQ with Zapier, Make, or your own tools.</p>
      {createdKey && (
        <div className="bg-green-500/10 border border-green-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-green-700 mb-1">Your new API key (copy it now — it won't be shown again):</p>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono bg-[#1C2333] px-2 py-1 rounded border border-white/10 flex-1 truncate text-[#F5EFE3]">{createdKey}</code>
            <button onClick={() => { navigator.clipboard.writeText(createdKey); toast.success("Copied!"); }} className="p-2 rounded hover:bg-green-500/20 text-green-600" aria-label="Copy API key"><Copy className="w-3.5 h-3.5" /></button>
          </div>
          <button onClick={() => setCreatedKey(null)} className="text-xs text-green-600 hover:underline mt-1">Dismiss</button>
        </div>
      )}
      {isLoading ? <Skeleton className="h-10" /> : keys && keys.length > 0 ? (
        <div className="space-y-2">
          {keys.map(k => (
            <div key={k.id} className="flex items-center justify-between p-3 bg-[#1C2333] rounded-xl">
              <div>
                <p className="text-sm font-semibold text-[#F5EFE3]">{k.name}</p>
                <p className="text-xs text-[rgba(245,239,227,0.55)] font-mono">{k.keyPrefix}... · Created {new Date(k.createdAt).toLocaleDateString()}{k.lastUsedAt ? ` · Last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : " · Never used"}</p>
              </div>
              <button onClick={() => revokeKey.mutate({ id: k.id })} className="text-xs text-red-500 hover:underline font-medium" disabled={revokeKey.isPending}>Revoke</button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[rgba(245,239,227,0.55)]">No API keys yet.</p>
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
  const { data: logs, isLoading } = trpc.auditLog.list.useQuery({ limit: 20, offset: 0 }, { retry: 1 });
  return (
    <div className="bg-[#161B22] rounded-xl border border-white/8 p-6 space-y-4">
      <h3 className="font-bold text-sm text-[#F5EFE3] flex items-center gap-2"><Activity className="w-4 h-4 text-[#D4922A]" />Activity Log</h3>
      <p className="text-xs text-[rgba(245,239,227,0.55)]">A record of your recent account activity.</p>
      {isLoading ? <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div> : !logs || logs.length === 0 ? (
        <p className="text-xs text-[rgba(245,239,227,0.55)]">No activity recorded yet.</p>
      ) : (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {logs.map(log => (
            <div key={log.id} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
              <div className="w-1.5 h-1.5 rounded-full bg-[#D4922A] mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#F5EFE3]">{log.action.replace(/\./g, ' › ')}</p>
                {log.details && <p className="text-xs text-[rgba(245,239,227,0.55)] truncate">{log.details}</p>}
              </div>
              <p className="text-xs text-[rgba(245,239,227,0.55)] shrink-0">{new Date(log.createdAt).toLocaleString()}</p>
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
  const setProfileField = useFormFields(setProfile);
  const setProfileName  = setProfileField("name");
  const setProfileBio   = setProfileField("bio");
  const setProfilePhone = setProfileField("phone");
  const [business, setBusiness] = useState({ businessName: "", businessPhone: "", businessAddress: "", businessWebsite: "" });
  const setBusinessField = useFormFields(setBusiness);
  const setBusinessName    = setBusinessField("businessName");
  const setBusinessPhone   = setBusinessField("businessPhone");
  const setBusinessAddress = setBusinessField("businessAddress");
  const setBusinessWebsite = setBusinessField("businessWebsite");
  const [bookingPage, setBookingPage] = useState({ bookingUsername: "", bookingBio: "", bookingServices: ["Coaching Session", "Strategy Call", "Consultation"] });
  const setBookingPageField = useFormFields(setBookingPage);
  const setBookingUsername = setBookingPageField("bookingUsername");
  const setBookingBio      = setBookingPageField("bookingBio");
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
        <h2 className="text-xl font-extrabold text-[#F5EFE3]">Settings</h2>
        <p className="text-sm text-[rgba(245,239,227,0.55)]">Manage your profile, business info, and preferences</p>
      </div>

      {/* Profile */}
      <div className="bg-[#161B22] rounded-xl border border-white/8 p-6 space-y-4">
        <h3 className="font-bold text-sm text-[#F5EFE3] flex items-center gap-2"><User className="w-4 h-4 text-[#D4922A]" />Profile</h3>

        {/* Avatar Upload */}
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-[#D4922A] to-[#D4911A] flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile photo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-lg font-bold">{profile.name?.slice(0, 2).toUpperCase() || "U"}</span>
              )}
            </div>
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-[#D4922A] flex items-center justify-center shadow-md hover:bg-[#D4911A] transition-colors disabled:opacity-50"
              aria-label="Change profile photo"
            >
              {avatarUploading ? <Loader2 className="w-3 h-3 text-white animate-spin" /> : <Camera className="w-3 h-3 text-white" />}
            </button>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#F5EFE3] mb-0.5">Profile Photo</p>
            <p className="text-xs text-[rgba(245,239,227,0.55)] mb-2">JPEG, PNG, WebP or GIF · Max 5 MB</p>
            <div className="flex gap-2">
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                className="text-xs font-semibold text-[#D4922A] hover:underline disabled:opacity-50 transition-opacity"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, minHeight: "auto", minWidth: "auto" }}
              >
                {avatarUrl ? "Change photo" : "Upload photo"}
              </button>
              {avatarUrl && (
                <>
                  <span className="text-[rgba(245,239,227,0.25)]">·</span>
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

        <Field label="Your Name" value={profile.name} onChange={setProfileName} placeholder="Alex Smith" autoComplete="name" enterKeyHint="next" />
        <Field label="Phone Number" value={profile.phone} onChange={setProfilePhone} placeholder="+1 (555) 000-0000" type="tel" autoComplete="tel" enterKeyHint="next" />
        <Field label="Bio (shown on booking page)" value={profile.bio} onChange={setProfileBio} placeholder="I help entrepreneurs build scalable businesses..." textarea rows={3} enterKeyHint="done" />
        <Button className="gradient-amber text-white border-0 hover:opacity-90 gap-2" onClick={() => updateProfile.mutate(profile)} disabled={updateProfile.isPending}>
          {updateProfile.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Save Profile</>}
        </Button>
      </div>

      {/* Business */}
      <div className="bg-[#161B22] rounded-xl border border-white/8 p-6 space-y-4">
        <h3 className="font-bold text-sm text-[#F5EFE3] flex items-center gap-2"><Building className="w-4 h-4 text-[#D4922A]" />Business Info</h3>
        <Field label="Business Name" value={business.businessName} onChange={setBusinessName} placeholder="My Coaching Studio" autoComplete="organization" enterKeyHint="next" />
        <Field label="Business Phone" value={business.businessPhone} onChange={setBusinessPhone} placeholder="+1 (555) 000-0000" type="tel" autoComplete="tel" enterKeyHint="next" />
        <Field label="Business Address" value={business.businessAddress} onChange={setBusinessAddress} placeholder="123 Main St, New York, NY 10001" autoComplete="street-address" enterKeyHint="next" />
        <Field label="Website" value={business.businessWebsite} onChange={setBusinessWebsite} placeholder="https://yourwebsite.com" type="url" autoComplete="url" enterKeyHint="done" />
        <Button className="gradient-amber text-white border-0 hover:opacity-90 gap-2" onClick={() => updateBusiness.mutate(business)} disabled={updateBusiness.isPending}>
          {updateBusiness.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Save Business Info</>}
        </Button>
      </div>

      {/* Booking Page */}
      <div className="bg-[#161B22] rounded-xl border border-white/8 p-6 space-y-4">
        <h3 className="font-bold text-sm text-[#F5EFE3] flex items-center gap-2"><Globe className="w-4 h-4 text-[#D4922A]" />Booking Page</h3>
        <div>
          <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">Your Booking URL</label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm text-[rgba(245,239,227,0.55)] flex-shrink-0 truncate max-w-full">{window.location.origin}/book/</span>
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
              <div className="flex items-center gap-2 bg-[#1C2333] rounded-xl px-3 py-2 border border-white/8 min-w-0">
                <span className="text-xs text-[rgba(245,239,227,0.55)] flex-1 truncate font-mono min-w-0">{bookingUrl}</span>
                <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="text-[rgba(245,239,227,0.55)] hover:text-[#D4922A] transition-colors flex-shrink-0" title="Preview booking page">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <CopyBookingLinkButton url={bookingUrl} />
            </div>
          )}
        </div>
        <Field label="Booking Page Bio" value={bookingPage.bookingBio} onChange={setBookingBio} placeholder="Book a session with me..." textarea rows={2} enterKeyHint="done" />
        <div>
          <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-2">Services Offered</label>
          <div className="space-y-2 mb-3">
            {bookingPage.bookingServices.map((s, i) => (
              <div key={i} className="flex items-center gap-2 bg-[#1C2333] rounded-xl px-3 py-2">
                <span className="text-sm flex-1">{s}</span>
                <button onClick={() => setBookingPage(p => ({ ...p, bookingServices: p.bookingServices.filter((_, j) => j !== i) }))} className="text-[rgba(245,239,227,0.55)] hover:text-red-500 transition-colors" aria-label={`Remove ${s}`}>
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
            className="text-xs text-[#D4922A] hover:text-[#d4901c] font-semibold flex items-center gap-1 mb-2 transition-colors"
          >
            <Zap className="w-3 h-3" />
            {showPresetServices ? "Hide" : "Browse"} 50+ preset services
          </button>
          {showPresetServices && (
            <div className="flex flex-wrap gap-1.5 p-3 bg-[#1C2333] rounded-xl border border-white/8 max-h-48 overflow-y-auto">
              {PRESET_SERVICES.filter(s => !bookingPage.bookingServices.includes(s)).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setBookingPage(p => ({ ...p, bookingServices: [...p.bookingServices, s] }))}
                  className="text-xs bg-[#161B22] border border-white/10 hover:border-[#D4922A] hover:text-[#D4922A] text-[rgba(245,239,227,0.55)] rounded-full px-2.5 py-1 transition-colors"
                >
                  + {s}
                </button>
              ))}
              {PRESET_SERVICES.filter(s => !bookingPage.bookingServices.includes(s)).length === 0 && (
                <p className="text-xs text-[rgba(245,239,227,0.55)]">All preset services added!</p>
              )}
            </div>
          )}
        </div>
        <Button className="gradient-amber text-white border-0 hover:opacity-90 gap-2" onClick={() => updateBookingPage.mutate(bookingPage)} disabled={updateBookingPage.isPending}>
          {updateBookingPage.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Save Booking Page</>}
        </Button>
      </div>

      {/* iCal Feed */}
      <div className="space-y-3 p-5 bg-[#161B22] rounded-xl border border-white/8">
        <h3 className="font-bold text-sm text-[#F5EFE3] flex items-center gap-2"><Calendar className="w-4 h-4 text-[#D4922A]" />Calendar Sync (iCal)</h3>
        <p className="text-xs text-[rgba(245,239,227,0.55)]">Subscribe to your booking calendar in Google Calendar, Apple Calendar, or Outlook using this live iCal feed URL.</p>
        {user?.id ? (
          <div className="flex items-center gap-2 bg-[#1C2333] rounded-xl px-3 py-2 border border-white/8 min-w-0">
            <span className="text-xs text-[rgba(245,239,227,0.55)] flex-1 truncate font-mono min-w-0">{window.location.origin}/api/calendar/{user.id}.ics</span>
            <button
              onClick={() => {
                const url = `${window.location.origin}/api/calendar/${user!.id}.ics`;
                navigator.clipboard.writeText(url).then(() => toast.success("iCal URL copied!")).catch(() => toast.info(`iCal URL: ${url}`));
              }}
              className="text-[rgba(245,239,227,0.55)] hover:text-[#D4922A] transition-colors flex-shrink-0 p-2 rounded hover:bg-[#D4922A]/10"
              title="Copy iCal feed URL"
              aria-label="Copy iCal feed URL"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <a href={`${window.location.origin}/api/calendar/${user!.id}.ics`} download className="text-[rgba(245,239,227,0.55)] hover:text-[#D4922A] transition-colors flex-shrink-0 p-2 rounded hover:bg-[#D4922A]/10" title="Download .ics file" aria-label="Download iCal file">
              <Download className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : (
          <p className="text-xs text-[rgba(245,239,227,0.55)]">Sign in to access your iCal feed.</p>
        )}
        {user?.id && (
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <a
              href={`https://calendar.google.com/calendar/r?cid=webcal://${typeof window !== 'undefined' ? window.location.host : ''}/api/calendar/${user.id}.ics`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-500/15 text-blue-400 text-xs font-semibold transition-colors border border-blue-500/20"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 3h-3V1.5h-1.5V3h-6V1.5H7.5V3h-3C3.675 3 3 3.675 3 4.5v15C3 20.325 3.675 21 4.5 21h15c.825 0 1.5-.675 1.5-1.5v-15c0-.825-.675-1.5-1.5-1.5zm0 16.5h-15V9h15v10.5zM7.5 4.5V6H9V4.5h6V6h1.5V4.5h1.5V7.5h-12V4.5h1.5z"/></svg>
              Add to Google Calendar
            </a>
            <a
              href={`webcal://${typeof window !== 'undefined' ? window.location.host : ''}/api/calendar/${user.id}.ics`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1C2333] hover:bg-[#243040] text-[rgba(245,239,227,0.55)] text-xs font-semibold transition-colors border border-white/8"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>
              Subscribe (Apple / Outlook)
            </a>
          </div>
        )}
      </div>

      {/* Notifications */}
      <div className="bg-[#161B22] rounded-xl border border-white/8 p-6 space-y-4">
        <h3 className="font-bold text-sm text-[#F5EFE3] flex items-center gap-2"><Bell className="w-4 h-4 text-[#D4922A]" />Notifications</h3>
        {[
          { key: "notifyNewBooking" as const, label: "New Booking", desc: "Get notified when a client books a session" },
          { key: "notifyInvoicePaid" as const, label: "Invoice Paid", desc: "Get notified when an invoice is marked as paid" },
          { key: "notifyNewLead" as const, label: "New Lead", desc: "Get notified when someone joins the waitlist" },
        ].map(n => (
          <div key={n.key} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#F5EFE3]">{n.label}</p>
              <p className="text-xs text-[rgba(245,239,227,0.55)]">{n.desc}</p>
            </div>
            <button
              onClick={() => setNotifications(p => ({ ...p, [n.key]: !p[n.key] }))}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4922A] focus-visible:ring-offset-2 ${notifications[n.key] ? "bg-[#D4922A]" : "bg-gray-200"}`}
              aria-label={`${notifications[n.key] ? "Disable" : "Enable"} ${n.label} notifications`}
              role="switch"
              aria-checked={notifications[n.key]}
              type="button"
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#161B22] shadow ring-0 transition duration-200 ease-in-out ${notifications[n.key] ? "translate-x-5" : "translate-x-0"}`}
              />
            </button>
          </div>
        ))}
        <Button className="gradient-amber text-white border-0 hover:opacity-90 gap-2" onClick={() => updateNotifications.mutate(notifications)} disabled={updateNotifications.isPending}>
          {updateNotifications.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Save Preferences</>}
        </Button>
      </div>

      {/* Change Password */}
      <ChangePasswordSection />

      {/* Billing & Subscription — inline */}
      <BillingSection />

      {/* API Keys */}
      <ApiKeysSection />

      {/* Audit Log */}
      <AuditLogSection />

      {/* Integrations */}
      <IntegrationsSection />
    </div>
  );
}

// ─── Integrations Section ────────────────────────────────────────────────────────
function IntegrationsSection() {
  const utils = trpc.useUtils();
  const { data: calStatus } = trpc.googleCal.status.useQuery(undefined, { retry: 1 });
  const { data: calAuthData } = trpc.googleCal.getAuthUrl.useQuery(
    { origin: window.location.origin },
    { enabled: !calStatus?.connected }
  );
  const disconnectCal = trpc.googleCal.disconnect.useMutation({
    onSuccess: () => { utils.googleCal.status.invalidate(); toast.success("Google Calendar disconnected."); },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const [monthlyEnabled, setMonthlyEnabled] = useState(true);
  const toggleMonthly = trpc.reportSettings.toggle.useMutation({
    onSuccess: () => toast.success("Preferences saved!"),
    onError: (e: { message: string }) => toast.error(e.message),
  });

  return (
    <div className="bg-[#161B22] rounded-xl border border-white/8 p-6 space-y-5">
      <h3 className="font-bold text-sm text-[#F5EFE3] flex items-center gap-2">
        <Zap className="w-4 h-4 text-[#D4922A]" />Integrations & Automation
      </h3>

      {/* Google Calendar */}
      <div className="flex items-center justify-between gap-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#F5EFE3]">Google Calendar</p>
            <p className="text-xs text-[rgba(245,239,227,0.55)]">
              {calStatus?.connected ? `Connected · Google Calendar synced` : "Sync bookings to your Google Calendar"}
            </p>
          </div>
        </div>
        {calStatus?.connected ? (
          <Button size="sm" variant="outline" className="border-red-200 text-red-500 hover:bg-red-500/100/10" onClick={() => disconnectCal.mutate()} disabled={disconnectCal.isPending}>
            {disconnectCal.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Disconnect"}
          </Button>
        ) : (
          <Button size="sm" className="gradient-amber text-white border-0 hover:opacity-90" onClick={() => { if (calAuthData?.url) window.open(calAuthData.url, "_blank"); }} disabled={!calAuthData?.url}>
            Connect
          </Button>
        )}
      </div>

      {/* Monthly Business Report */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
            <Mail className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#F5EFE3]">Monthly Business Report</p>
            <p className="text-xs text-[rgba(245,239,227,0.55)]">Auto-sent on the 1st: MRR, new clients, top insights</p>
          </div>
        </div>
        <button
          onClick={() => { const next = !monthlyEnabled; setMonthlyEnabled(next); toggleMonthly.mutate({ enabled: next }); }}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4922A] ${
            monthlyEnabled ? "bg-[#D4922A]" : "bg-gray-200"
          }`}
          role="switch"
          aria-checked={monthlyEnabled}
          aria-label="Toggle monthly business report email"
          type="button"
        >
          <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#161B22] shadow ring-0 transition duration-200 ease-in-out ${
            monthlyEnabled ? "translate-x-5" : "translate-x-0"
          }`} />
        </button>
      </div>
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
  const [previewContract, setPreviewContract] = useState<any>(null);
  const emptyForm = { clientName: "", clientEmail: "", title: "", type: "contract" as "contract" | "proposal", body: "", proposalAmount: "", expiresAt: "" };

  const CONTRACT_TEMPLATES = [
    {
      label: "Web Design Contract",
      type: "contract" as const,
      title: "Freelance Web Design Contract",
      body: `# Freelance Web Design Contract

## Parties
This agreement is between **[Your Business Name]** ("Designer") and **[Client Name]** ("Client").

## Scope of Work
Designer agrees to provide the following services:
- Custom website design and development
- Up to [X] pages / screens
- Responsive design for desktop, tablet, and mobile
- [X] rounds of revisions

## Timeline
- Project start: [Start Date]
- First draft delivery: [Draft Date]
- Final delivery: [End Date]

## Payment
- Total project fee: $[Amount]
- 50% deposit due before work begins
- Remaining 50% due upon final delivery
- Late payments incur a 1.5% monthly fee

## Intellectual Property
All final deliverables become Client's property upon receipt of full payment. Designer retains the right to display the work in their portfolio.

## Revisions
This contract includes [X] rounds of revisions. Additional revisions are billed at $[Rate]/hour.

## Termination
Either party may terminate this agreement with 7 days written notice. Client is responsible for payment for all work completed to date.

## Limitation of Liability
Designer's total liability shall not exceed the total fees paid under this contract.

## Governing Law
This agreement is governed by the laws of [State/Country].`,
    },
    {
      label: "Coaching Contract",
      type: "contract" as const,
      title: "Coaching Services Agreement",
      body: `# Coaching Services Agreement

## Parties
This agreement is between **[Your Name / Business]** ("Coach") and **[Client Name]** ("Client").

## Services
Coach agrees to provide:
- [X] coaching sessions per month, each [Duration] minutes
- Session delivery via [Zoom / Phone / In-Person]
- Email support between sessions (response within 48 hours)

## Program Duration
This agreement covers a [X]-month engagement beginning [Start Date].

## Investment
- Monthly fee: $[Amount]
- Payment due on the [1st] of each month
- Full program paid in advance: $[Discounted Amount]

## Cancellation Policy
Sessions cancelled with less than 24 hours notice are forfeited. Coach will make reasonable efforts to reschedule.

## Confidentiality
Coach agrees to keep all client information strictly confidential.

## Results Disclaimer
Coaching results depend on client effort and commitment. Coach makes no guarantees of specific outcomes.

## Termination
Either party may terminate with 30 days written notice. No refunds for sessions already paid.

## Governing Law
This agreement is governed by the laws of [State/Country].`,
    },
    {
      label: "Consulting Proposal",
      type: "proposal" as const,
      title: "Consulting Services Proposal",
      body: `# Consulting Services Proposal

## Executive Summary
Thank you for the opportunity to submit this proposal. We are excited to partner with **[Client Company]** to [brief description of goal].

## Problem Statement
[Client Company] is currently facing [describe the challenge or opportunity]. This proposal outlines how we will address this effectively.

## Proposed Solution
We recommend the following approach:
- **Phase 1:** Discovery & Audit ([Duration])
- **Phase 2:** Strategy Development ([Duration])
- **Phase 3:** Implementation & Support ([Duration])

## Deliverables
- Comprehensive audit report
- Strategic roadmap with prioritized recommendations
- [X] implementation sessions
- Final summary report and next-steps guide

## Investment
| Phase | Description | Fee |
|-------|-------------|-----|
| Phase 1 | Discovery & Audit | $[Amount] |
| Phase 2 | Strategy | $[Amount] |
| Phase 3 | Implementation | $[Amount] |
| **Total** | | **$[Total]** |

## Timeline
Estimated project duration: [X] weeks from signed agreement.

## Why Us
- [X] years of experience in [field]
- Proven track record with [type of clients]
- [Key differentiator]

## Next Steps
To proceed, please sign and return this proposal. A 50% deposit will initiate the project.

This proposal is valid for 30 days from the date above.`,
    },
    {
      label: "Retainer Agreement",
      type: "contract" as const,
      title: "Monthly Retainer Agreement",
      body: `# Monthly Retainer Agreement

## Parties
This retainer agreement is between **[Your Business Name]** ("Service Provider") and **[Client Name]** ("Client").

## Retainer Services
Service Provider will make available up to **[X] hours per month** for the following services:
- [Service 1]
- [Service 2]
- [Service 3]

## Monthly Retainer Fee
- Fee: $[Amount] per month
- Invoiced on the 1st of each month
- Payment due within [X] days of invoice

## Unused Hours
Unused hours do not roll over to the following month.

## Additional Hours
Hours beyond the retainer are billed at $[Rate]/hour, invoiced separately.

## Term
This agreement begins [Start Date] and continues month-to-month until terminated.

## Termination
Either party may terminate with 30 days written notice. Client is responsible for fees through the notice period.

## Confidentiality
Both parties agree to keep proprietary information confidential.

## Governing Law
This agreement is governed by the laws of [State/Country].`,
    },
  ];
  const [form, setForm] = useState(emptyForm);
    const setContractFormField = useFormFields(setForm);
  const setContractTitle         = setContractFormField("title");
  const setContractClientEmail   = setContractFormField("clientEmail");
  const setContractProposalAmount = setContractFormField("proposalAmount");
  const setContractExpiresAt     = setContractFormField("expiresAt");
  const { data: list = [], isLoading } = trpc.contracts.list.useQuery({ type: filterType }, { retry: 1 });
  const { data: selected } = trpc.contracts.get.useQuery({ id: selectedId! }, { enabled: !!selectedId });
  const { data: clientList = [] } = trpc.clients.list.useQuery(undefined, { retry: 1 });

  const createMut = trpc.contracts.create.useMutation({ onSuccess: () => { utils.contracts.list.invalidate(); setShowForm(false); setForm(emptyForm); toast.success("Created!"); } });
  const updateMut = trpc.contracts.update.useMutation({ onSuccess: () => { utils.contracts.list.invalidate(); utils.contracts.get.invalidate(); setShowForm(false); setEditingId(null); toast.success("Saved!"); } });
  const deleteMut = trpc.contracts.delete.useMutation({ onSuccess: () => { utils.contracts.list.invalidate(); setSelectedId(null); toast.success("Deleted."); } });
  const convertMut = trpc.contracts.convertToInvoice.useMutation({ onSuccess: (data) => { utils.contracts.list.invalidate(); toast.success(`Converted to invoice #${data.invoiceId}!`); } });

  const statusColors: Record<string, string> = {
    draft: "bg-[#243040] text-[rgba(245,239,227,0.55)]",
    sent: "bg-blue-500/15 text-blue-400",
    signed: "bg-green-500/15 text-green-400",
    declined: "bg-red-500/15 text-red-400",
    expired: "bg-orange-500/15 text-orange-400",
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
    <div className="max-w-6xl mx-auto">
      <ConfirmDialog open={confirm.open} onOpenChange={(o) => { if (!o) setConfirm(defaultConfirm); }} title={confirm.title} description={confirm.description} onConfirm={() => { confirm.onConfirm(); setConfirm(defaultConfirm); }} />
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#F5EFE3]">Contracts & Proposals</h2>
          <p className="text-sm text-[rgba(245,239,227,0.55)] mt-0.5">Create, send, and track contracts and proposals</p>
        </div>
        <Button onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(true); }} className="bg-[#D4922A] hover:bg-[#D4911A] text-white gap-2">
          <Plus className="w-4 h-4" /> New
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {(["all", "contract", "proposal"] as const).map(t => (
          <button key={t} onClick={() => setFilterType(t)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all capitalize ${ filterType === t ? "bg-[#D4922A] text-white" : "bg-[#1C2333] text-[rgba(245,239,227,0.55)] border border-white/10 hover:border-[#D4922A]" }`}>{t === "all" ? "All" : t + "s"}</button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : list.length === 0 ? (
        <div className="bg-[#161B22] rounded-xl border border-white/8 p-12 text-center">
          <FileSignature className="w-10 h-10 text-[rgba(245,239,227,0.45)] mx-auto mb-3" />
          <p className="font-semibold text-[rgba(245,239,227,0.75)] mb-1">No {filterType === "all" ? "contracts or proposals" : filterType + "s"} yet</p>
          <p className="text-sm text-[rgba(245,239,227,0.55)] mb-4">Create your first one to get started</p>
          <Button onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(true); }} size="sm" className="bg-[#D4922A] hover:bg-[#D4911A] text-white">Create {filterType === "proposal" ? "Proposal" : "Contract"}</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(c => (
            <div key={c.id} className="bg-[#161B22] rounded-xl border border-white/8 p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${ c.type === "proposal" ? "bg-violet-500/15 text-violet-400" : "bg-blue-500/15 text-blue-400" }`}>{c.type}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColors[c.status] || "bg-[#243040] text-[rgba(245,239,227,0.55)]"}`}>{c.status}</span>
                    {c.proposalAmount && <span className="text-xs font-semibold text-[#D4922A]">{formatCurrency(c.proposalAmount)}</span>}
                  </div>
                  <p className="font-semibold text-[#F5EFE3] truncate">{c.title}</p>
                  <p className="text-sm text-[rgba(245,239,227,0.55)]">{c.clientName}{c.clientEmail ? ` · ${c.clientEmail}` : ""}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={e => { e.stopPropagation(); setPreviewContract(c); }} className="p-2 rounded-lg hover:bg-blue-50 transition-colors" aria-label="Preview" title="Preview"><Eye className="w-3.5 h-3.5 text-blue-500" /></button>
                  <button onClick={e => { e.stopPropagation(); openEdit(c); }} className="p-2 rounded-lg hover:bg-[#243040] transition-colors" aria-label="Edit"><Edit2 className="w-3.5 h-3.5 text-[rgba(245,239,227,0.55)]" /></button>
                  {c.type === "proposal" && c.status === "signed" && !c.linkedInvoiceId && (
                    <button onClick={e => { e.stopPropagation(); convertMut.mutate({ id: c.id }); }} className="p-2 rounded-lg hover:bg-green-500/10 transition-colors" aria-label="Convert to invoice" title="Convert to Invoice"><ArrowUpRight className="w-3.5 h-3.5 text-green-600" /></button>
                  )}
                  <button onClick={e => { e.stopPropagation(); setConfirm({ open: true, title: "Delete?", description: `Delete "${c.title}"? This cannot be undone.`, onConfirm: () => deleteMut.mutate({ id: c.id }) }); }} className="p-2 rounded-lg hover:bg-red-500/100/10 transition-colors" aria-label="Delete"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                </div>
              </div>
              {/* Expanded detail */}
              {selectedId === c.id && selected && (
                <div className="mt-4 pt-4 border-t border-white/8">
                  <div className="bg-[#1C2333] rounded-xl p-4 text-sm text-[rgba(245,239,227,0.75)] whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">{selected.body}</div>
                  <div className="flex items-center gap-3 mt-3">
                    {c.status === "draft" && <button onClick={e => { e.stopPropagation(); updateMut.mutate({ id: c.id, status: "sent" }); }} className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"><Send className="w-3 h-3" /> Mark as Sent</button>}
                    {c.status === "sent" && <button onClick={e => { e.stopPropagation(); updateMut.mutate({ id: c.id, status: "signed" }); }} className="text-xs font-semibold text-green-600 hover:underline flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Mark as Signed</button>}
                    {c.status === "sent" && <button onClick={e => { e.stopPropagation(); updateMut.mutate({ id: c.id, status: "declined" }); }} className="text-xs font-semibold text-red-500 hover:underline">Mark as Declined</button>}
                    {c.expiresAt && <span className="text-xs text-[rgba(245,239,227,0.55)] ml-auto">Expires {formatDate(c.expiresAt)}</span>}
                    {c.sentAt && <span className="text-xs text-[rgba(245,239,227,0.55)]">Sent {formatDate(c.sentAt)}</span>}
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
              <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">Type *</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as "contract" | "proposal" }))} className="form-input-light">
                <option value="contract">Contract</option>
                <option value="proposal">Proposal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">Client *</label>
              <input list="contract-clients" value={form.clientName} onChange={e => { const c = clientList.find(c => c.name === e.target.value); setForm(p => ({ ...p, clientName: e.target.value, clientEmail: c?.email || p.clientEmail })); }} placeholder="Client name" className="form-input-light" />
              <datalist id="contract-clients">{clientList.map(c => <option key={c.id} value={c.name} />)}</datalist>
            </div>
          </div>
          <Field label="Title *" value={form.title} onChange={setContractTitle} placeholder="e.g. Freelance Web Design Contract" />
          <Field label="Client Email" value={form.clientEmail} onChange={setContractClientEmail} type="email" placeholder="client@example.com" />
          {form.type === "proposal" && <Field label="Proposal Amount ($)" value={form.proposalAmount} onChange={setContractProposalAmount} type="number" placeholder="1500" />}
          <Field label="Expiry Date" value={form.expiresAt} onChange={setContractExpiresAt} type="date" />
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[rgba(245,239,227,0.55)]">Body / Terms *</label>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[rgba(245,239,227,0.40)]">Start from template:</span>
                <select
                  className="text-xs border border-white/10 rounded-lg px-2 py-1 bg-[#1C2333] text-[rgba(245,239,227,0.75)] hover:border-[#D4922A] focus:outline-none focus:ring-1 focus:ring-[#D4922A]"
                  defaultValue=""
                  onChange={e => {
                    const tpl = CONTRACT_TEMPLATES.find(t => t.label === e.target.value);
                    if (tpl) {
                      setForm(p => ({ ...p, type: tpl.type, title: p.title || tpl.title, body: tpl.body }));
                      e.target.value = "";
                    }
                  }}
                >
                  <option value="">— Choose template —</option>
                  {CONTRACT_TEMPLATES.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} rows={10} placeholder="Enter the contract terms, scope of work, deliverables, payment terms..." className="form-input-light resize-y" />
            <p className="text-xs text-[rgba(245,239,227,0.55)] mt-1">Markdown supported. Use **bold**, # headings, - bullet lists.</p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending} className="bg-[#D4922A] hover:bg-[#D4911A] text-white flex-1">
              {(createMut.isPending || updateMut.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? "Save Changes" : "Create"}
            </Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }} className="flex-1">Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Contract / Proposal Preview Modal */}
      <Modal open={!!previewContract} onClose={() => setPreviewContract(null)} title="Document Preview" wide>
        {previewContract && (
          <div className="font-sans">
            {/* Accent bar */}
            <div className="h-1 bg-[#D4922A] rounded-t-lg -mx-6 -mt-2 mb-5" />

            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide mr-2 ${
                  previewContract.type === "proposal" ? "bg-violet-500/15 text-violet-400" : "bg-blue-500/15 text-blue-400"
                }`}>{previewContract.type}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                  previewContract.status === "signed" ? "bg-green-500/15 text-green-400" :
                  previewContract.status === "sent" ? "bg-blue-500/15 text-blue-400" :
                  previewContract.status === "declined" ? "bg-red-500/15 text-red-400" :
                  "bg-[#243040] text-[rgba(245,239,227,0.55)]"
                }`}>{previewContract.status}</span>
                <h2 className="text-xl font-extrabold text-[#F5EFE3] mt-2 tracking-tight">{previewContract.title}</h2>
              </div>
              {previewContract.proposalAmount && (
                <div className="text-right">
                  <p className="text-[10px] text-[rgba(245,239,227,0.40)] uppercase tracking-wide">Value</p>
                  <p className="text-xl font-extrabold text-[#D4922A]">{formatCurrency(previewContract.proposalAmount)}</p>
                </div>
              )}
            </div>

            {/* Parties */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-[#1C2333] border border-white/10 rounded-lg p-3">
                <p className="text-[10px] font-bold text-[rgba(245,239,227,0.40)] uppercase tracking-wide mb-1">Client</p>
                <p className="text-sm font-semibold text-[#F5EFE3]">{previewContract.clientName}</p>
                {previewContract.clientEmail && <p className="text-xs text-[rgba(245,239,227,0.45)]">{previewContract.clientEmail}</p>}
              </div>
              <div className="bg-[#1C2333] border border-white/10 rounded-lg p-3">
                <p className="text-[10px] font-bold text-[rgba(245,239,227,0.40)] uppercase tracking-wide mb-1">Dates</p>
                <p className="text-xs text-[rgba(245,239,227,0.55)]">Created {formatDate(previewContract.createdAt)}</p>
                {previewContract.expiresAt && <p className="text-xs text-[rgba(245,239,227,0.45)]">Expires {formatDate(previewContract.expiresAt)}</p>}
                {previewContract.signedAt && <p className="text-xs text-green-600 font-medium">Signed {formatDate(previewContract.signedAt)}</p>}
              </div>
            </div>

            {/* Body — rendered as document */}
            <div className="border border-white/10 rounded-lg overflow-hidden mb-5">
              <div className="bg-[#1C2333] border-b border-white/10 px-4 py-2">
                <p className="text-[10px] font-bold text-[rgba(245,239,227,0.40)] uppercase tracking-wide">Document Body</p>
              </div>
              <div className="bg-[#161B22] px-5 py-5 max-h-72 overflow-y-auto">
                {previewContract.body.split("\n").map((line: string, i: number) => {
                  if (line.startsWith("# ")) return <h1 key={i} className="text-lg font-extrabold text-[#F5EFE3] mt-4 mb-2 first:mt-0">{line.slice(2)}</h1>;
                  if (line.startsWith("## ")) return <h2 key={i} className="text-base font-bold text-[#F5EFE3] mt-3 mb-1.5">{line.slice(3)}</h2>;
                  if (line.startsWith("### ")) return <h3 key={i} className="text-sm font-bold text-[#F5EFE3] mt-2 mb-1">{line.slice(4)}</h3>;
                  if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="text-sm text-[rgba(245,239,227,0.75)] ml-4 list-disc leading-relaxed">{line.slice(2)}</li>;
                  if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="text-sm font-bold text-[#F5EFE3] my-1">{line.slice(2, -2)}</p>;
                  if (line.trim() === "") return <div key={i} className="h-2" />;
                  return <p key={i} className="text-sm text-[rgba(245,239,227,0.75)] leading-relaxed my-1">{line}</p>;
                })}
              </div>
            </div>

            {/* Signature block */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="border border-dashed border-white/15 rounded-lg p-4 text-center">
                <p className="text-[10px] text-[rgba(245,239,227,0.40)] uppercase tracking-wide mb-3">Client Signature</p>
                <div className="h-8 border-b border-white/15 mb-2" />
                <p className="text-xs text-[rgba(245,239,227,0.45)]">{previewContract.clientName}</p>
                {previewContract.signedAt && <p className="text-[10px] text-green-600 font-medium mt-1">Signed {formatDate(previewContract.signedAt)}</p>}
              </div>
              <div className="border border-dashed border-white/15 rounded-lg p-4 text-center">
                <p className="text-[10px] text-[rgba(245,239,227,0.40)] uppercase tracking-wide mb-3">Service Provider</p>
                <div className="h-8 border-b border-white/15 mb-2" />
                <p className="text-xs text-[rgba(245,239,227,0.45)]">TrueAxis HQ</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button className="flex-1 bg-[#D4922A] hover:bg-[#D4911A] text-white gap-2" onClick={() => { openEdit(previewContract); setPreviewContract(null); }}>
                <Edit2 className="w-4 h-4" /> Edit Document
              </Button>
              <Button variant="outline" className="flex-1 gap-2" onClick={() => setPreviewContract(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Smart Inbox Panel ───────────────────────────────────────────────────────
function SmartInboxPanel({ setActivePanel }: { setActivePanel: (p: ActivePanel) => void }) {
  const utils = trpc.useUtils();
  const { data: feed = [], isLoading } = trpc.inbox.list.useQuery({ limit: 50 }, { retry: 1 });
  const markRead = trpc.inbox.markRead.useMutation({ onSuccess: () => utils.inbox.list.invalidate() });
  const markAll = trpc.inbox.markAllRead.useMutation({ onSuccess: () => utils.inbox.list.invalidate() });

  const [filter, setFilter] = useState<"all" | "unread" | "messages" | "bookings" | "invoices">("all");

  const filtered = (feed as Array<{ id: string; type: string; title: string; body: string; link?: string; createdAt: Date; read: boolean; meta?: Record<string, any> }>).filter(item => {
    if (filter === "unread") return !item.read;
    if (filter === "messages") return item.type === "message";
    if (filter === "bookings") return item.type === "booking";
    if (filter === "invoices") return ["invoice", "invoice_paid", "invoice_overdue"].includes(item.type);
    return true;
  });

  const unreadCount = (feed as Array<{ read: boolean }>).filter(f => !f.read).length;

  const typeIcon = (type: string) => {
    if (type === "message") return <MessageSquare className="w-4 h-4 text-blue-500" />;
    if (type === "booking") return <Calendar className="w-4 h-4 text-[#D4922A]" />;
    if (type === "invoice_paid") return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (type === "invoice_overdue") return <AlertCircle className="w-4 h-4 text-red-500" />;
    if (type === "invoice") return <FileText className="w-4 h-4 text-[rgba(245,239,227,0.45)]" />;
    if (type === "success") return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (type === "warning") return <AlertCircle className="w-4 h-4 text-orange-500" />;
    return <Bell className="w-4 h-4 text-[rgba(245,239,227,0.40)]" />;
  };

  const typeColor = (type: string) => {
    if (type === "message") return "bg-blue-50 border-blue-500/20";
    if (type === "booking") return "bg-amber-500/10 border-amber-500/20";
    if (type === "invoice_paid") return "bg-green-500/10 border-green-100";
    if (type === "invoice_overdue") return "bg-red-500/10 border-red-100";
    if (type === "warning") return "bg-orange-50 border-orange-100";
    if (type === "success") return "bg-green-500/10 border-green-100";
    return "bg-[#1C2333] border-white/8";
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#F5EFE3]">Smart Inbox</h2>
          <p className="text-sm text-[rgba(245,239,227,0.45)] mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread item${unreadCount !== 1 ? "s" : ""}` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAll.mutate()} disabled={markAll.isPending}
            className="text-xs gap-1.5">
            <Check className="w-3.5 h-3.5" /> Mark all read
          </Button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {(["all", "unread", "messages", "bookings", "invoices"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${
              filter === f ? "bg-[#D4922A] text-white" : "bg-[#161B22] border border-white/10 text-[rgba(245,239,227,0.55)] hover:border-[#D4922A]"
            }`}>
            {f}{f === "unread" && unreadCount > 0 ? ` (${unreadCount})` : ""}
          </button>
        ))}
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-[#161B22] rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-xl bg-[#243040] flex items-center justify-center mx-auto mb-4">
            <Inbox className="w-8 h-8 text-[rgba(245,239,227,0.35)]" />
          </div>
          <p className="font-semibold text-[rgba(245,239,227,0.75)]">Nothing here</p>
          <p className="text-sm text-[rgba(245,239,227,0.40)] mt-1">Your activity feed will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <div key={item.id}
              className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer hover:shadow-sm ${
                item.read ? "bg-[#161B22] border-white/8" : typeColor(item.type)
              }`}
              onClick={() => {
                if (!item.read && item.meta?.notifId) markRead.mutate({ notifId: item.meta.notifId });
                if (item.link) setActivePanel(item.link.includes("panel=") ? (item.link.split("panel=")[1].split("&")[0] as ActivePanel) : "overview");
              }}
            >
              <div className="w-8 h-8 rounded-lg bg-[#161B22]/90 border border-white/8 flex items-center justify-center flex-shrink-0 mt-0.5">
                {typeIcon(item.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-semibold truncate ${item.read ? "text-[rgba(245,239,227,0.75)]" : "text-[#F5EFE3]"}` }>{item.title}</p>
                  {!item.read && <span className="w-2 h-2 rounded-full bg-[#D4922A] flex-shrink-0 mt-1" />}
                </div>
                <p className="text-xs text-[rgba(245,239,227,0.45)] mt-0.5 line-clamp-2">{item.body}</p>
                <p className="text-[10px] text-[rgba(245,239,227,0.40)] mt-1">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Testimonials Panel ────────────────────────────────────────────────────────
function TestimonialsPanel() {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "request">("pending");
  const [form, setForm] = useState({ clientName: "", clientEmail: "", serviceName: "" });
  const setTestiFormField = useFormFields(setForm);
  const setTestiClientName  = setTestiFormField("clientName");
  const setTestiClientEmail = setTestiFormField("clientEmail");
  const setTestiServiceName = setTestiFormField("serviceName");
  const [sending, setSending] = useState(false);

  const { data: list = [], isLoading } = trpc.testimonials.list.useQuery(undefined, { retry: 1 });
  const reviewMut = trpc.testimonials.review.useMutation({ onSuccess: () => { utils.testimonials.list.invalidate(); toast.success("Done!"); } });
  const requestMut = trpc.testimonials.request.useMutation({
    onSuccess: () => { toast.success("Request sent!"); setForm({ clientName: "", clientEmail: "", serviceName: "" }); setSending(false); },
    onError: (e) => { toast.error(e.message); setSending(false); },
  });

  const filtered = list.filter(t => {
    if (tab === "pending") return ["requested", "submitted"].includes(t.status);
    return t.status === tab;
  });

  const statusColors: Record<string, string> = {
    requested: "bg-blue-500/15 text-blue-400",
    submitted: "bg-amber-500/15 text-amber-400",
    approved: "bg-green-500/15 text-green-400",
    rejected: "bg-[#243040] text-[rgba(245,239,227,0.45)]",
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#F5EFE3]">Testimonials</h2>
          <p className="text-sm text-[rgba(245,239,227,0.45)] mt-0.5">Request, review, and publish client testimonials</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {(["pending", "approved", "rejected", "request"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all ${
              tab === t ? "bg-[#D4922A] text-white" : "bg-[#161B22] border border-white/10 text-[rgba(245,239,227,0.55)] hover:border-[#D4922A]"
            }`}>
            {t === "request" ? "+ New Request" : t}
            {t === "pending" && list.filter(x => ["requested","submitted"].includes(x.status)).length > 0 && (
              <span className="ml-1.5 bg-white/30 text-xs px-1.5 py-0.5 rounded-full">
                {list.filter(x => ["requested","submitted"].includes(x.status)).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "request" ? (
        <div className="bg-[#161B22] rounded-xl border border-white/8 p-6 space-y-4 max-w-lg">
          <h3 className="font-semibold text-[#F5EFE3]">Send Testimonial Request</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">Client Name *</label>
              <input value={form.clientName} onChange={e => setTestiClientName(e.target.value)}
                placeholder="Jane Smith" className="form-input-light" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">Client Email *</label>
              <input type="email" value={form.clientEmail} onChange={e => setTestiClientEmail(e.target.value)}
                placeholder="jane@example.com" className="form-input-light" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[rgba(245,239,227,0.55)] mb-1.5">Service Name</label>
              <input value={form.serviceName} onChange={e => setTestiServiceName(e.target.value)}
                placeholder="Brand Strategy Session" className="form-input-light" />
            </div>
          </div>
          <Button
            onClick={() => { setSending(true); requestMut.mutate({ ...form, origin: window.location.origin }); }}
            disabled={!form.clientName.trim() || !form.clientEmail.trim() || sending}
            className="w-full bg-[#D4922A] hover:bg-[#D4911A] text-white">
            {sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</> : "Send Request"}
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-[#161B22] rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ThumbsUp className="w-12 h-12 text-[rgba(245,239,227,0.25)] mx-auto mb-3" />
          <p className="text-[rgba(245,239,227,0.45)] font-medium">No {tab} testimonials yet</p>
          <p className="text-sm text-[rgba(245,239,227,0.40)] mt-1">Use the "+ New Request" tab to ask clients for reviews</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => (
            <div key={t.id} className="bg-[#161B22] rounded-xl border border-white/8 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-[#F5EFE3] text-sm">{t.clientName}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${statusColors[t.status] ?? "bg-[#243040] text-[rgba(245,239,227,0.45)]"}`}>{t.status}</span>
                  </div>
                  {t.rating && (
                    <div className="flex gap-0.5 mb-1.5">
                      {[1,2,3,4,5].map(s => <Star key={s} className={`w-3.5 h-3.5 ${s <= t.rating! ? "fill-[#D4922A] text-[#D4922A]" : "text-[rgba(245,239,227,0.25)]"}`} />)}
                    </div>
                  )}
                  {t.body && <p className="text-sm text-[rgba(245,239,227,0.55)] line-clamp-3">"{t.body}"</p>}
                  {!t.body && <p className="text-xs text-[rgba(245,239,227,0.40)] italic">Awaiting response…</p>}
                  <p className="text-[10px] text-[rgba(245,239,227,0.40)] mt-1.5">{new Date(t.createdAt).toLocaleDateString()}</p>
                </div>
                {t.status === "submitted" && (
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" onClick={() => reviewMut.mutate({ id: t.id, action: "approve" })} disabled={reviewMut.isPending}
                      className="bg-green-500/100 hover:bg-green-600 text-white text-xs px-3">Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => reviewMut.mutate({ id: t.id, action: "reject" })} disabled={reviewMut.isPending}
                      className="text-xs px-3">Reject</Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Mobile Quick-Stats Strip ─────────────────────────────────────────────────
function MobileQuickStats() {
  const { data: stats } = trpc.analytics.overview.useQuery(undefined, { retry: 1 });
  const { data: overdueList = [] } = trpc.invoices.list.useQuery({ status: "overdue" }, { retry: 1 });
  const { data: scheduledBookings = [] } = trpc.bookings.list.useQuery({ status: "scheduled" }, { retry: 1 });

  const totalRevenue = stats?.totalRevenue ?? 0;
  const activeClients = stats?.activeClients ?? 0;
  const todayStr = new Date().toISOString().split("T")[0];
  const todaySessions = (scheduledBookings as any[]).filter(b => b.date === todayStr).length;
  const overdueCount = overdueList.length;

  return (
    <div
      className="md:hidden shrink-0 flex items-center"
      style={{
        background: "rgba(22,27,34,0.98)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.25)",
      }}
    >
      {/* Revenue */}
      <div className="flex-1 flex flex-col items-center gap-0.5 py-2">
        <div className="flex items-center gap-1">
          <DollarSign className="w-3 h-3 text-[#D4922A]" />
          <span className="text-xs font-extrabold text-[#F5EFE3]">{totalRevenue >= 1000 ? `$${(totalRevenue/1000).toFixed(1)}k` : `$${Math.round(totalRevenue)}`}</span>
        </div>
        <span className="text-[9px] text-[rgba(245,239,227,0.40)] font-medium uppercase tracking-wide">Revenue</span>
      </div>
      <div className="w-px h-7 bg-white/8" />
      {/* Active Clients */}
      <div className="flex-1 flex flex-col items-center gap-0.5 py-2">
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3 text-[#6366F1]" />
          <span className="text-xs font-extrabold text-[#F5EFE3]">{activeClients}</span>
        </div>
        <span className="text-[9px] text-[rgba(245,239,227,0.40)] font-medium uppercase tracking-wide">Clients</span>
      </div>
      <div className="w-px h-7 bg-white/8" />
      {/* Today's Sessions */}
      <div className="flex-1 flex flex-col items-center gap-0.5 py-2">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3 text-[#F59E0B]" />
          <span className="text-xs font-extrabold text-[#F5EFE3]">{todaySessions}</span>
        </div>
        <span className="text-[9px] text-[rgba(245,239,227,0.40)] font-medium uppercase tracking-wide">Today</span>
      </div>
      <div className="w-px h-7 bg-white/8" />
      {/* Overdue */}
      <div className="flex-1 flex flex-col items-center gap-0.5 py-2">
        <div className="flex items-center gap-1">
          <AlertCircle className={`w-3 h-3 ${overdueCount > 0 ? "text-red-400" : "text-[rgba(245,239,227,0.35)]"}`} />
          <span className={`text-xs font-extrabold ${overdueCount > 0 ? "text-red-400" : "text-[#F5EFE3]"}`}>{overdueCount}</span>
        </div>
        <span className="text-[9px] text-[rgba(245,239,227,0.40)] font-medium uppercase tracking-wide">Overdue</span>
      </div>
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
    { icon: LayoutDashboard, label: "Dashboard",  panel: "overview"   as ActivePanel },
    { icon: Users,           label: "Clients",    panel: "clients"    as ActivePanel },
    { icon: Calendar,        label: "Schedule",   panel: "scheduling" as ActivePanel },
    { icon: FileText,        label: "Billing",    panel: "billing"    as ActivePanel },
  ];
  // All panels available in the full-feature sheet, grouped by category
  const sheetSections = [
    {
      label: "Work",
      items: [
        { icon: Mail,          label: "Outreach",     panel: "outreach"   as ActivePanel },
        { icon: FileSignature, label: "Deals",        panel: "deals"      as ActivePanel },
        { icon: BarChart3,     label: "Insights",     panel: "insights"   as ActivePanel, badge: "AI" },
        { icon: Bot,           label: "AI Assistant", panel: "ai"         as ActivePanel, badge: "AI" },
        { icon: ThumbsUp,      label: "Testimonials", panel: "testimonials" as ActivePanel },
      ],
    },
    {
      label: "Account",
      items: [
        { icon: Settings,      label: "Settings",     panel: "settings"   as ActivePanel },
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
        className={`absolute left-0 right-0 z-50 bg-[#1C2333] rounded-t-3xl shadow-2xl overflow-y-auto ${
          showSheet ? "block" : "hidden"
        }`}
        style={{ bottom: "100%", maxHeight: "70vh" }}
        role="dialog"
        aria-label="All features"
        aria-hidden={!showSheet}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-white/10" />
        </div>

        <div className="px-4 pb-6 pt-1 space-y-5">
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest px-1">All Features</p>

          {sheetSections.map((section) => (
            <div key={section.label}>
              <p className="text-[10px] font-semibold text-[#D4922A]/70 uppercase tracking-wider mb-2 px-1">{section.label}</p>
              <div className="grid grid-cols-4 gap-1.5">
                {section.items.map((item) => (
                  <button
                    key={item.panel}
                    onClick={() => handleSheetNav(item.panel)}
                    aria-label={item.label}
                    className={`relative flex flex-col items-center justify-center py-3.5 px-1 rounded-xl gap-1.5 transition-all active:scale-95 ${
                      active === item.panel
                        ? "bg-[#D4922A]/20 text-[#D4922A]"
                        : "bg-white/5 text-[rgba(245,239,227,0.35)] hover:bg-white/10 hover:text-white"
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
              onClick={() => { setActive("settings"); setShowSheet(false); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 text-[rgba(245,239,227,0.35)] hover:bg-white/10 hover:text-white transition-all text-xs font-medium"
            >
              <CreditCard className="w-4 h-4" />
              Billing
            </button>
            {(user as any)?.isOwner && (
              <button
                onClick={() => { navigate("/admin"); setShowSheet(false); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 text-[rgba(245,239,227,0.35)] hover:bg-white/10 hover:text-white transition-all text-xs font-medium"
              >
                <Star className="w-4 h-4" />
                Admin
              </button>
            )}
            <button
              onClick={() => { navigate("/"); setShowSheet(false); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 text-[rgba(245,239,227,0.35)] hover:bg-white/10 hover:text-white transition-all text-xs font-medium"
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
          background: "rgba(22,27,34,0.98)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 -2px 16px rgba(0,0,0,0.30)",
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
                style={{ color: isActive ? "#D4922A" : "#6B7280" }}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[#D4922A]" />
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
            style={{ color: isSheetPanelActive || showSheet ? "#D4922A" : "#6B7280" }}
          >
            {(isSheetPanelActive || showSheet) && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[#D4922A]" />
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
      const valid: ActivePanel[] = ["overview","clients","scheduling","invoices","followups","analytics","settings","ai","pulse","contracts","time","inbox","testimonials"];
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
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
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

  // Update document title based on active panel
  useEffect(() => {
    const PANEL_TITLES: Record<ActivePanel, string> = {
            overview: "Dashboard — TrueAxis HQ",
      clients: "Clients — TrueAxis HQ",
      scheduling: "Scheduling — TrueAxis HQ",
      invoices: "Invoices — TrueAxis HQ",
      followups: "Follow-Ups — TrueAxis HQ",
      analytics: "Analytics — TrueAxis HQ",
      settings: "Settings — TrueAxis HQ",
      ai: "AI Assistant — TrueAxis HQ",
      pulse: "Client Pulse — TrueAxis HQ",
      contracts: "Contracts — TrueAxis HQ",
      time: "Time Tracker — TrueAxis HQ",
      inbox: "Inbox — TrueAxis HQ",
      testimonials: "Testimonials — TrueAxis HQ",
      services: "Services — TrueAxis HQ",
      expenses: "Expenses & P&L — TrueAxis HQ",
      proposals: "Proposals — TrueAxis HQ",
      automations: "Automations — TrueAxis HQ",
      billing: "Billing — TrueAxis HQ",
      outreach: "Outreach — TrueAxis HQ",
      deals: "Deals — TrueAxis HQ",
      insights: "Insights — TrueAxis HQ",
    };
    document.title = PANEL_TITLES[active] ?? "Dashboard — TrueAxis HQ";
  }, [active]);

  // Global keyboard shortcuts: Cmd+K / Ctrl+K = search; Alt+1..9 = panel navigation
  useEffect(() => {
    const panels: ActivePanel[] = ["overview", "clients", "scheduling", "billing", "outreach", "deals", "insights", "settings", "ai"];
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const inInput = tag === "input" || tag === "textarea" || (e.target as HTMLElement)?.isContentEditable;
      // Cmd+K / Ctrl+K — open global search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setGlobalSearchOpen(v => !v);
        return;
      }
      // Alt+1..9 — panel navigation
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const idx = parseInt(e.key) - 1;
        if (idx >= 0 && idx < panels.length) {
          e.preventDefault();
          setActiveWithScroll(panels[idx]);
        }
        return;
      }
      // Single-key shortcuts when NOT in an input field
      if (!inInput && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === "/") { e.preventDefault(); setGlobalSearchOpen(true); return; }
        if (e.key === "n" || e.key === "N") { e.preventDefault(); setActiveWithScroll("billing"); toast.info("Billing — Invoices, Time & Services", { duration: 2000 }); return; }
        if (e.key === "c" || e.key === "C") { e.preventDefault(); setActiveWithScroll("clients"); toast.info("Navigated to Clients — press + to add", { duration: 2000 }); return; }
        if (e.key === "b" || e.key === "B") { e.preventDefault(); setActiveWithScroll("scheduling"); toast.info("Navigated to Scheduling — press + to book", { duration: 2000 }); return; }
        if (e.key === "o" || e.key === "O") { e.preventDefault(); setActiveWithScroll("outreach"); toast.info("Outreach — Follow-Ups, Inbox & Automations", { duration: 2000 }); return; }
        if (e.key === "d" || e.key === "D") { e.preventDefault(); setActiveWithScroll("deals"); toast.info("Deals — Contracts & Proposals", { duration: 2000 }); return; }
        if (e.key === "i" || e.key === "I") { e.preventDefault(); setActiveWithScroll("insights"); toast.info("Insights — Analytics, Pulse & Expenses", { duration: 2000 }); return; }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/");
  }, [loading, isAuthenticated, navigate]);

  // Handle Google Calendar OAuth callback params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gcal_connected") === "1") {
      toast.success("Google Calendar connected successfully!");
      setActiveWithScroll("settings");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("gcal_error")) {
      const errMsg = params.get("gcal_error");
      toast.error(`Google Calendar connection failed: ${errMsg?.replace(/_/g, " ")}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#0D1117] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-[#D4922A] animate-spin mx-auto mb-3" />
        <p className="text-sm text-[rgba(245,239,227,0.55)]">Loading your dashboard...</p>
      </div>
    </div>
  );

  const panelTitles: Record<ActivePanel, string> = {
    overview: "Dashboard", clients: "Clients", scheduling: "Scheduling",
    invoices: "Invoices", followups: "Follow-Ups", analytics: "Analytics",
    settings: "Settings", ai: "AI Assistant", pulse: "Client Pulse",
    contracts: "Contracts", time: "Time Tracking",
    inbox: "Smart Inbox", testimonials: "Testimonials",
    services: "Services", expenses: "Expenses & P&L", proposals: "Proposals", automations: "Automations",
    billing: "Billing", outreach: "Outreach", deals: "Deals", insights: "Insights",
  };
  const panelSubtitles: Record<ActivePanel, string> = {
    overview: "Your business at a glance",
    clients: "Manage relationships & contacts",
    scheduling: "Appointments & availability",
    invoices: "Billing, payments & recurring",
    followups: "Automated client outreach",
    analytics: "Revenue & performance insights",
    settings: "Profile, branding & integrations",
    ai: "Your AI-powered business assistant",
    pulse: "Client health & engagement scores",
    contracts: "Proposals, contracts & e-sign",
    time: "Billable hours & invoice generation",
    inbox: "Unified client communications",
    testimonials: "Reviews & social proof",
    services: "Your packages & pricing catalog",
    expenses: "Track costs & view profit/loss",
    proposals: "Send scoped proposals to clients",
    automations: "Trigger actions automatically",
    billing: "Invoices, time tracking, recurring & service catalog",
    outreach: "Follow-ups, inbox & automation workflows",
    deals: "Contracts & proposals in one place",
    insights: "Analytics, client pulse & expenses",
  };

  // useMemo ensures the panel JSX element is only recreated when `active` changes.
  // Without this, every Dashboard re-render (notification poll, search state, etc.)
  // returns a brand-new element reference, causing React to unmount+remount the
  // active panel and losing input focus mid-typing.
  const activePanel = useMemo(() => {
    switch (active) {
      case "overview": return <PanelErrorBoundary panelName="Overview"><OverviewPanel userName={user?.name || ""} setActivePanel={setActive} /></PanelErrorBoundary>;
      case "clients": return <PanelErrorBoundary panelName="Clients"><ClientsPanel /></PanelErrorBoundary>;
      case "scheduling": return <PanelErrorBoundary panelName="Scheduling"><SchedulingPanel /></PanelErrorBoundary>;
      case "invoices": return <PanelErrorBoundary panelName="Invoices"><InvoicesPanel /></PanelErrorBoundary>;
      case "followups": return <PanelErrorBoundary panelName="Follow-Ups"><FollowUpsPanel /></PanelErrorBoundary>;
      case "analytics": return <PanelErrorBoundary panelName="Analytics"><AnalyticsPanel /></PanelErrorBoundary>;
      case "settings": return <PanelErrorBoundary panelName="Settings"><SettingsPanel /></PanelErrorBoundary>;
      case "ai": return (
        <PanelErrorBoundary panelName="AI Assistant">
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-full gradient-amber flex items-center justify-center shadow-lg">
            <span className="text-3xl">✨</span>
          </div>
          <h2 className="text-xl font-bold text-[#F5EFE3]">AI Assistant</h2>
          <p className="text-[rgba(245,239,227,0.55)] text-sm max-w-xs">
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
            <p className="text-xs text-[#D4922A] font-medium">AI Assistant is open — look for the floating bubble ✨</p>
          )}
        </div>
        </PanelErrorBoundary>
      );
      case "pulse": return <PanelErrorBoundary panelName="Client Pulse"><ClientPulsePanel /></PanelErrorBoundary>;
      case "contracts": return <PanelErrorBoundary panelName="Contracts"><ContractsPanel /></PanelErrorBoundary>;
      case "time": return <PanelErrorBoundary panelName="Time Tracking"><TimeTrackingPanel onInvoiceGenerated={() => setActiveWithScroll("invoices")} /></PanelErrorBoundary>;

      case "inbox": return <PanelErrorBoundary panelName="Smart Inbox"><SmartInboxPanel setActivePanel={setActiveWithScroll} /></PanelErrorBoundary>;
      case "testimonials": return <PanelErrorBoundary panelName="Testimonials"><TestimonialsPanel /></PanelErrorBoundary>;
      case "services": return <PanelErrorBoundary panelName="Services"><Services /></PanelErrorBoundary>;
      case "expenses": return <PanelErrorBoundary panelName="Expenses & P&L"><Expenses /></PanelErrorBoundary>;
      case "proposals": return <PanelErrorBoundary panelName="Proposals"><Proposals /></PanelErrorBoundary>;
      case "automations": return <PanelErrorBoundary panelName="Automations"><Automations /></PanelErrorBoundary>;
      // ─── Consolidated panels ───────────────────────────────────────────────
      case "billing": return (
        <PanelErrorBoundary panelName="Billing">
          <BillingPanel
            invoicesPanel={<InvoicesPanel />}
            onInvoiceGenerated={() => setActiveWithScroll("billing")}
          />
        </PanelErrorBoundary>
      );
      case "outreach": return (
        <PanelErrorBoundary panelName="Outreach">
          <OutreachPanel
            followUpsPanel={<FollowUpsPanel />}
            inboxPanel={<SmartInboxPanel setActivePanel={setActiveWithScroll} />}
          />
        </PanelErrorBoundary>
      );
      case "deals": return (
        <PanelErrorBoundary panelName="Deals">
          <DealsPanel contractsPanel={<ContractsPanel />} />
        </PanelErrorBoundary>
      );
      case "insights": return (
        <PanelErrorBoundary panelName="Insights">
          <InsightsPanel analyticsPanel={<AnalyticsPanel />} />
        </PanelErrorBoundary>
      );
      default: return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, user?.name]);

  return (
    <div className="bg-[#0D1117] flex flex-col md:flex-row overflow-x-hidden w-full" style={{ height: '100dvh' }}>
      {/* Skip link */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded-xl focus:shadow-lg focus:text-[#D4922A] focus:font-semibold">
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
        <header className="sticky top-0 z-30 bg-[#161B22]/90 backdrop-blur-md border-b border-white/8 px-4 md:px-6 py-3 flex items-center justify-between">
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
              <span className="text-sm font-bold text-[#F5EFE3]">
                {panelTitles[active]}
              </span>
            </div>
            <div className="hidden md:block">
              <h1 className="text-base font-bold text-[#F5EFE3] leading-tight">{panelTitles[active]}</h1>
              <p className="text-xs text-[rgba(245,239,227,0.55)] leading-tight">{panelSubtitles[active]}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Home button */}
            <button
              onClick={() => navigate("/")}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-[rgba(245,239,227,0.55)] hover:bg-[#243040] hover:text-[#F5EFE3] transition-all"
              aria-label="Go to homepage"
              title="Homepage"
            >
              <Home className="w-4 h-4" aria-hidden="true" />
              <span>Home</span>
            </button>
            {/* Global Search Trigger — Cmd+K */}
            <button
              onClick={() => setGlobalSearchOpen(true)}
              className="hidden md:flex items-center gap-2.5 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all group"
              aria-label="Search everything (Cmd+K)"
              title="Search (Cmd+K)"
            >
              <Search className="w-3.5 h-3.5 text-[rgba(245,239,227,0.45)] group-hover:text-[rgba(245,239,227,0.7)] transition-colors" aria-hidden="true" />
              <span className="text-sm text-[rgba(245,239,227,0.40)] group-hover:text-[rgba(245,239,227,0.65)] transition-colors w-32 text-left">Search everything…</span>
              <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-white/15 text-[10px] text-[rgba(245,239,227,0.30)] font-mono">
                <span className="text-[11px]">&#8984;</span>K
              </kbd>
            </button>
            {/* Mobile search icon */}
            <button
              onClick={() => setGlobalSearchOpen(true)}
              className="md:hidden p-2 rounded-xl hover:bg-[#243040] transition-colors"
              aria-label="Search (Cmd+K)"
            >
              <Search className="w-4 h-4 text-[rgba(245,239,227,0.55)]" />
            </button>

            {/* Health Monitor */}
            <HealthMonitor />
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications && unreadCount > 0) markAllReadMutation.mutate(); }}
                className="relative p-2 rounded-xl hover:bg-[#243040] transition-colors"
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                aria-expanded={showNotifications}
              >
                <Bell className="w-4 h-4 text-[rgba(245,239,227,0.55)]" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500/100 rounded-full" aria-hidden="true" />
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-[#161B22] rounded-xl shadow-2xl border border-white/8 z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                    <p className="text-sm font-bold text-[#F5EFE3]">Notifications</p>
                    {(notifList?.length ?? 0) > 0 && (
                      <button onClick={() => markAllReadMutation.mutate()} className="text-xs text-[#D4922A] hover:underline font-medium">Mark all read</button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {!notifList || notifList.length === 0 ? (
                      <div className="py-8 text-center">
                        <Bell className="w-8 h-8 text-[rgba(245,239,227,0.25)] mx-auto mb-2" />
                        <p className="text-xs text-[rgba(245,239,227,0.55)]">No notifications yet</p>
                      </div>
                    ) : (
                      notifList.map(n => (
                        <div key={n.id} className={`flex items-start gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors ${!n.read ? 'bg-amber-500/8' : ''}`}>
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.type === 'success' ? 'bg-green-400' : n.type === 'error' ? 'bg-red-400' : 'bg-blue-400'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-[#F5EFE3] truncate">{n.title}</p>
                            <p className="text-xs text-[rgba(245,239,227,0.55)] mt-0.5 line-clamp-2">{n.body}</p>
                            <p className="text-[10px] text-[rgba(245,239,227,0.55)] mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                          </div>
                          <button onClick={() => dismissNotifMutation.mutate({ id: n.id })} className="p-2 rounded hover:bg-white/12 transition-colors flex-shrink-0" aria-label="Dismiss">
                            <X className="w-3 h-3 text-[rgba(245,239,227,0.55)]" />
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
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D4922A]/15 text-[#D4922A] border border-[#D4922A]/30 capitalize">
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

        {/* Panel Content — pb-[130px] ensures content clears MobileQuickStats (~40px) + MobileBottomNav (~62px) + buffer on mobile */}
        <div className="p-4 md:p-6 max-w-6xl mx-auto w-full overflow-x-hidden pb-[130px] md:pb-6">
          {activePanel}
        </div>
      </main>

      {/* Mobile Quick-Stats Strip — always visible above bottom nav */}
      <MobileQuickStats />
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

      {/* Global Search Modal — Cmd+K */}
      <GlobalSearch
        open={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
        onNavigate={(panel) => setActiveWithScroll(panel as ActivePanel)}
      />
    </div>
  );
}
 
