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

import { type ActivePanel, type ConfirmState, type LineItem, Field, FREQUENCY_LABELS, FREQUENCY_COLORS, defaultConfirm, LEGACY_PANEL_REDIRECTS, getGreeting, formatCurrency, formatDate, formatBookingDate, formatBookingTime, Skeleton, Modal, useFormField, LineItemRow } from "./shared";

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
        <h2 className="text-xl font-extrabold text-[#1A1A1A]">Analytics</h2>
        <p className="text-sm text-[#6B6B6B]">Your business performance at a glance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-[#DDDBD7]">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white mb-3" style={{ backgroundColor: s.color }}>
              <s.icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-extrabold text-[#1A1A1A]">{s.value}</p>
            <p className="text-xs text-[#6B6B6B] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 border border-[#DDDBD7]">
          <h3 className="font-bold text-[#1A1A1A] text-sm mb-4">Revenue Trend</h3>
          {analytics?.monthlyRevenue?.some(d => d.revenue > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={analytics.monthlyRevenue}>
                <defs>
                  <linearGradient id="amberGrad3" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4922A" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#D4922A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: "12px" }} formatter={(v: number) => [formatCurrency(v), "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#D4922A" strokeWidth={2.5} fill="url(#amberGrad3)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-[#6B6B6B]">
              <DollarSign className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm text-center">Revenue data will appear once you create and mark invoices as paid.</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 border border-[#DDDBD7]">
          <h3 className="font-bold text-[#1A1A1A] text-sm mb-4">Client Breakdown</h3>
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
                    <span className="text-sm text-[#6B6B6B] truncate">{d.name}</span>
                    <span className="text-sm font-bold text-[#1A1A1A] ml-auto pl-2 flex-shrink-0">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-36 flex flex-col items-center justify-center text-[#6B6B6B]">
              <Users className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Add clients to see breakdown.</p>
            </div>
          )}
        </div>

        {topServices.length > 0 && (
          <div className="bg-white rounded-xl p-5 border border-[#DDDBD7] lg:col-span-2">
            <h3 className="font-bold text-[#1A1A1A] text-sm mb-4">Top Services by Revenue</h3>
            <div className="space-y-3">
              {topServices.slice(0, 5).map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-[#6B6B6B] w-4">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-[#1A1A1A]">{s.name}</span>
                      <span className="text-sm font-bold text-[#D4922A]">{formatCurrency(s.revenue)}</span>
                    </div>
                    <div className="h-1.5 bg-[#EEECEA] rounded-full overflow-hidden">
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
          <div className="bg-white rounded-xl p-5 border border-[#DDDBD7] lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[#1A1A1A] text-sm">Revenue Forecast (90-Day)</h3>
              <div className="flex items-center gap-4 text-xs text-[#6B6B6B]">
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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
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
          <div className="bg-white rounded-xl p-5 border border-[#DDDBD7]">
            <h3 className="font-bold text-[#1A1A1A] text-sm mb-4">Top Clients by LTV</h3>
            <div className="space-y-3">
              {analytics.clientLTV.slice(0, 6).map((c, i) => (
                <div key={c.clientId} className="flex items-center gap-3">
                  <span className="text-xs text-[#6B6B6B] w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-[#1A1A1A] truncate">{c.name}</span>
                      <span className="text-sm font-bold text-[#D4922A] ml-2 flex-shrink-0">{formatCurrency(c.ltv)}</span>
                    </div>
                    <div className="h-1.5 bg-[#EEECEA] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min((c.ltv / analytics.clientLTV[0].ltv) * 100, 100)}%`, background: i === 0 ? "#D4922A" : "#6366F1" }} />
                    </div>
                    <p className="text-[10px] text-[#6B6B6B] mt-0.5">{c.invoiceCount} invoice{c.invoiceCount !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Referral Sources */}
        {analytics?.referralSources && analytics.referralSources.length > 0 && (
          <div className="bg-white rounded-xl p-5 border border-[#DDDBD7]">
            <h3 className="font-bold text-[#1A1A1A] text-sm mb-4">Lead Sources</h3>
            <div className="space-y-3">
              {analytics.referralSources.slice(0, 6).map((s, i) => {
                const total = analytics.referralSources.reduce((sum: number, r) => sum + r.count, 0);
                const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                const colors = ["#D4922A", "#6366F1", "#5A9A7A", "#FF6B6B", "#F59E0B", "#8B5CF6"];
                return (
                  <div key={s.source} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: colors[i % colors.length] }} />
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-[#1A1A1A] capitalize">{s.source.replace(/_/g, " ")}</span>
                        <span className="text-xs font-bold text-[#6B6B6B]">{s.count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-[#EEECEA] rounded-full overflow-hidden">
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


export { AnalyticsPanel };
