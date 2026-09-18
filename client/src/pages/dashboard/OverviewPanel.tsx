import { TRUEAXIS_LOGO_URL } from "@shared/const";
import { DEFAULT_PUBLIC_BOOKING_SCHEDULE, getPublishedBookingServiceCatalog, PUBLIC_BOOKING_TIME_SLOTS, type PublicBookingService } from "@shared/publicBookingRules";
/* TrueAxis HQ — Full Dashboard (DB-backed)
 * All panels connected to real tRPC/database procedures
 * Design: "Kinetic Warmth" — Dark sidebar (#1C2333), Teal (#D4922A), Coral (#FF6B6B)
 */

import { useState, useEffect, useRef, useLayoutEffect, useCallback, memo, useMemo, useId, lazy, Suspense } from "react";
import { useFormFields } from "@/hooks/useFormFields";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { ActionCards } from "@/components/ActionCards";
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
import { PanelTabs } from "@/components/PanelTabs";
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
  Package, Receipt, Smartphone, Rocket, UsersRound, MapPin, PlugZap, Webhook
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
  PieChart, Pie, Cell
} from "recharts";

import { ChangelogModal } from "./ChangelogModal";
import { type ActivePanel, type ConfirmState, type LineItem, Field, FREQUENCY_LABELS, FREQUENCY_COLORS, defaultConfirm, LEGACY_PANEL_REDIRECTS, getGreeting, formatCurrency, formatDate, formatBookingDate, formatBookingTime, Skeleton, Modal, useFormField, LineItemRow } from "./shared";

// ─── Overview Panel ───────────────────────────────────────────────────────────
function OverviewPanel({ userName, setActivePanel }: { userName: string; setActivePanel: (p: ActivePanel) => void }) {
  const { data: analytics, isLoading } = trpc.analytics.overview.useQuery(undefined, { retry: 2 });
  const { data: recentClients } = trpc.clients.list.useQuery({ search: "", status: "all" });
  const { data: recentBookings } = trpc.bookings.list.useQuery({ status: "scheduled" });
  const { data: overdueInvoices } = trpc.invoices.list.useQuery({ status: "overdue" }, { retry: 1 });
  const { data: pulseData } = trpc.pulse.getAll.useQuery(undefined, { retry: 1 });
  const { data: pnlData } = trpc.expenses.pnl.useQuery({}, { retry: 1 });
  const todayStr = new Date().toISOString().split("T")[0];
  const todayHuman = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  // Handle both ISO format ("2026-07-24") from manual bookings and human-readable ("Jul 24, 2026") from public bookings
  const todayBookings = (recentBookings || []).filter(b => b.date === todayStr || b.date === todayHuman);

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
        <h1 className="text-2xl font-extrabold text-[#1A1A1A]">
          {getGreeting()}, {userName || "there"} 👋
        </h1>
        <p className="text-sm text-[#6B6B6B] mt-1">Here's what's happening with your business today.</p>
      </div>
      <OnboardingChecklist onNavigate={(panel) => setActivePanel(panel as ActivePanel)} />
      <ActionCards onNavigate={(panel) => setActivePanel(panel as ActivePanel)} />

      {/* ⚠️ Overdue Invoice Alert Banner */}
      {overdueInvoices && overdueInvoices.length > 0 && (
        <button
          onClick={() => setActivePanel("billing")}
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
            <p className="text-xs text-[#3D3D3D] mt-0.5">
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
            <p className="text-xs text-[#3D3D3D] mt-0.5 truncate">
              {todayBookings.map(b => `${b.clientName} at ${formatBookingTime(b.time)}`).join(" · ")}
            </p>
          </div>
          <button onClick={() => setActivePanel("scheduling")} className="text-xs text-[#D4922A] font-semibold hover:underline flex-shrink-0">View</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 sm:p-5 border border-[#DDDBD7] card-lift group transition-all duration-200 hover:border-[#C8C5BF]" style={{ '--card-glow': s.color } as React.CSSProperties}>
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white stat-icon-pop" style={{ backgroundColor: s.color }}>
                <s.icon className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#3D3D3D]" aria-hidden="true" />
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-[#1A1A1A] leading-tight">{s.value}</p>
            <p className="text-[11px] sm:text-xs text-[#6B6B6B] mt-0.5 leading-snug">{s.label}</p>
            <p className="text-[11px] sm:text-xs font-medium mt-1" style={{ color: s.color }}>{s.change}</p>
          </div>
        ))}
      </div>

      {/* P&L Summary Card */}
      {pnlData && (
        <button
          onClick={() => setActivePanel("insights")}
          className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-[#DDDBD7] bg-white hover:border-[#D4922A]/40 hover:bg-[#D4922A]/5 transition-all text-left group card-lift"
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
              <span className="text-xs text-[#3D3D3D]">this period</span>
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-xs text-[#6B6B6B]">Revenue: <span className="text-[#D4922A] font-semibold">{formatCurrency(pnlData.totalRevenue)}</span></span>
              <span className="text-xs text-[#6B6B6B]">·</span>
              <span className="text-xs text-[#6B6B6B]">Expenses: <span className="text-red-400 font-semibold">{formatCurrency(pnlData.totalExpenses)}</span></span>
              <span className="text-xs text-[#6B6B6B]">·</span>
              <span className="text-xs text-[#6B6B6B]">Margin: <span className="font-semibold" style={{ color: pnlData.netProfit >= 0 ? '#22c55e' : '#FF6B6B' }}>{pnlData.profitMargin}%</span></span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[#6B6B6B] group-hover:text-[#D4922A] transition-colors flex-shrink-0" />
        </button>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {([
          { icon: Plus,         label: "Add Client",     color: "#6366F1", panel: "clients",    shortcut: "C" },
          { icon: Calendar,     label: "New Booking",    color: "#F59E0B", panel: "scheduling", shortcut: "B" },
          { icon: FileText,     label: "New Invoice",    color: "#D4922A", panel: "billing",    shortcut: "N" },
          { icon: Mail,         label: "Outreach",       color: "#5A9A7A", panel: "outreach",   shortcut: "O" },
          { icon: FileSignature,label: "New Proposal",   color: "#8B5CF6", panel: "deals",      shortcut: "D" },
          { icon: Shield,       label: "New Contract",   color: "#EC4899", panel: "deals",      shortcut: null },
          { icon: Receipt,      label: "Log Expense",    color: "#EF4444", panel: "insights",   shortcut: null },
          { icon: Clock,        label: "Start Timer",    color: "#14B8A6", panel: "billing",    shortcut: null },
        ] as { icon: React.ElementType; label: string; color: string; panel: ActivePanel; shortcut: string | null }[]).map(({ icon: Icon, label, color, panel, shortcut }) => (
          <button
            key={label}
            onClick={() => setActivePanel(panel)}
            className="bg-white rounded-xl p-2.5 sm:p-3 border border-[#DDDBD7] card-lift flex flex-col items-center gap-1.5 text-center transition-all group relative"
            style={{ '--card-glow': color } as React.CSSProperties}
          >
            {shortcut && (
              <kbd className="absolute top-1.5 right-1.5 px-1 py-0.5 rounded border border-white/12 text-[8px] text-[#3D3D3D] font-mono leading-none hidden sm:block">{shortcut}</kbd>
            )}
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white stat-icon-pop" style={{ backgroundColor: color }}>
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            </div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-[#1A1A1A] leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 border border-[#DDDBD7]">
          <h3 className="font-bold text-[#1A1A1A] text-sm mb-4">Revenue (Last 6 Months)</h3>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4922A" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#D4922A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: "12px" }} formatter={(v: number) => [formatCurrency(v), "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#D4922A" strokeWidth={2.5} fill="url(#amberGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-[#6B6B6B]">
              <Activity className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">Revenue data will appear once you create paid invoices.</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 border border-[#DDDBD7]">
          <h3 className="font-bold text-[#1A1A1A] text-sm mb-4">Client Growth</h3>
          {clientGrowthData.some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={clientGrowthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: "12px" }} />
                <Bar dataKey="count" fill="#D4922A" radius={[6, 6, 0, 0]} name="New Clients" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-[#6B6B6B]">
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
          <div className="bg-white rounded-xl border border-[#DDDBD7] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-[#D4922A]" />
                <h3 className="font-bold text-sm text-[#1A1A1A]">Client Pulse</h3>
                <span className="text-xs bg-[#D4922A]/10 text-[#D4922A] font-semibold px-2 py-0.5 rounded-full">AI</span>
              </div>
              <button onClick={() => setActivePanel("pulse")} className="text-xs text-[#D4922A] hover:underline font-medium flex items-center gap-1">
                View All <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-[#F7F6F3] rounded-xl">
                <p className="text-2xl font-extrabold" style={{ color: avgScore !== null ? (avgScore >= 70 ? "#D4922A" : avgScore >= 40 ? "#F59E0B" : "#FF6B6B") : "#9CA3AF" }}>{avgScore ?? "—"}</p>
                <p className="text-xs text-[#6B6B6B] mt-0.5">Avg Health</p>
              </div>
              <div className="text-center p-3 bg-red-500/10 rounded-xl">
                <p className="text-2xl font-extrabold text-[#FF6B6B]">{churnRisk}</p>
                <p className="text-xs text-[#6B6B6B] mt-0.5">Churn Risk</p>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-xl">
                <p className="text-2xl font-extrabold text-yellow-600">{goingSilent}</p>
                <p className="text-xs text-[#6B6B6B] mt-0.5">Going Silent</p>
              </div>
              <div className="text-center p-3 bg-[#D4922A]/10 rounded-xl">
                <p className="text-2xl font-extrabold text-[#D4922A]">{upsellReady}</p>
                <p className="text-xs text-[#6B6B6B] mt-0.5">Upsell Ready</p>
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
        <div className="bg-white rounded-xl border border-[#DDDBD7] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#EEECEA]">
            <h3 className="font-bold text-sm text-[#1A1A1A]">Recent Clients</h3>
            <span className="text-xs text-[#D4922A] font-medium">{recentClients?.length || 0} total</span>
          </div>
          {!recentClients || recentClients.length === 0 ? (
            <div className="py-10 text-center text-[#6B6B6B]">
              <Users className="w-7 h-7 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No clients yet. Add your first client!</p>
            </div>
          ) : recentClients.slice(0, 5).map(c => (
            <div key={c.id} className="flex items-center gap-3 px-5 py-3 border-t border-[#EEECEA] hover:bg-[#F7F6F3] transition-colors">
              <div className="w-8 h-8 rounded-full gradient-amber flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {c.avatarInitials || c.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1A1A1A] truncate">{c.name}</p>
                <p className="text-xs text-[#6B6B6B] truncate">{c.service || "General Client"}</p>
              </div>
              <Badge className={`text-xs border-0 ${c.status === "active" ? "bg-green-500/10 text-green-600" : c.status === "prospect" ? "bg-yellow-50 text-yellow-600" : "bg-[#EEECEA] text-[#6B6B6B]"}`}>
                {c.status}
              </Badge>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-[#DDDBD7] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#EEECEA]">
            <h3 className="font-bold text-sm text-[#1A1A1A]">Upcoming Sessions</h3>
            <span className="text-xs text-[#D4922A] font-medium">{recentBookings?.length || 0} scheduled</span>
          </div>
          {!recentBookings || recentBookings.length === 0 ? (
            <div className="py-10 text-center text-[#6B6B6B]">
              <Calendar className="w-7 h-7 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No upcoming sessions. Create a booking!</p>
            </div>
          ) : recentBookings.slice(0, 5).map(b => (
            <div key={b.id} className="flex items-center gap-3 px-5 py-3 border-t border-[#EEECEA] hover:bg-[#F7F6F3] transition-colors">
              <div className="w-8 h-8 rounded-xl bg-[#D4922A]/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-[#D4922A]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1A1A1A] truncate">{b.clientName}</p>
                <p className="text-xs text-[#6B6B6B]">{formatBookingDate(b.date)} at {formatBookingTime(b.time)}</p>
              </div>
              <span className="text-xs text-[#6B6B6B]">{b.duration}m</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


export { OverviewPanel };
