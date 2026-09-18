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

// ─── Mobile Quick-Stats Strip ─────────────────────────────────────────────────
function MobileQuickStats() {
  const { data: stats } = trpc.analytics.overview.useQuery(undefined, { retry: 1 });
  const { data: overdueList = [] } = trpc.invoices.list.useQuery({ status: "overdue" }, { retry: 1 });
  const { data: scheduledBookings = [] } = trpc.bookings.list.useQuery({ status: "scheduled" }, { retry: 1 });

  const totalRevenue = stats?.totalRevenue ?? 0;
  const activeClients = stats?.activeClients ?? 0;
  const todayStr = new Date().toISOString().split("T")[0];
  const todayHuman = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const todaySessions = (scheduledBookings as any[]).filter(b => b.date === todayStr || b.date === todayHuman).length;
  const overdueCount = overdueList.length;

  return (
    <div
      className="md:hidden shrink-0 flex items-center"
      style={{
        background: "rgba(22,27,34,0.98)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderTop: "1px solid #DDDBD7",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.25)",
      }}
    >
      {/* Revenue */}
      <div className="flex-1 flex flex-col items-center gap-0.5 py-2">
        <div className="flex items-center gap-1">
          <DollarSign className="w-3 h-3 text-[#D4922A]" />
          <span className="text-xs font-extrabold text-white">{totalRevenue >= 1000 ? `$${(totalRevenue/1000).toFixed(1)}k` : `$${Math.round(totalRevenue)}`}</span>
        </div>
        <span className="text-[9px] text-white/55 font-medium uppercase tracking-wide">Revenue</span>
      </div>
      <div className="w-px h-7 bg-white/20" />
      {/* Active Clients */}
      <div className="flex-1 flex flex-col items-center gap-0.5 py-2">
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3 text-[#818CF8]" />
          <span className="text-xs font-extrabold text-white">{activeClients}</span>
        </div>
        <span className="text-[9px] text-white/55 font-medium uppercase tracking-wide">Clients</span>
      </div>
      <div className="w-px h-7 bg-white/20" />
      {/* Today's Sessions */}
      <div className="flex-1 flex flex-col items-center gap-0.5 py-2">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3 text-[#F59E0B]" />
          <span className="text-xs font-extrabold text-white">{todaySessions}</span>
        </div>
        <span className="text-[9px] text-white/55 font-medium uppercase tracking-wide">Today</span>
      </div>
      <div className="w-px h-7 bg-white/20" />
      {/* Overdue */}
      <div className="flex-1 flex flex-col items-center gap-0.5 py-2">
        <div className="flex items-center gap-1">
          <AlertCircle className={`w-3 h-3 ${overdueCount > 0 ? "text-red-400" : "text-white/40"}`} />
          <span className={`text-xs font-extrabold ${overdueCount > 0 ? "text-red-400" : "text-white"}`}>{overdueCount}</span>
        </div>
        <span className="text-[9px] text-white/55 font-medium uppercase tracking-wide">Overdue</span>
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
        { icon: FileSignature, label: "Jobs",         panel: "jobs"       as ActivePanel },
        { icon: UsersRound,    label: "Team",         panel: "team"       as ActivePanel },
        { icon: MapPin,        label: "Dispatch",     panel: "dispatch"   as ActivePanel },
        { icon: Calendar,      label: "Field Mode",   panel: "field"      as ActivePanel },
        { icon: PlugZap,       label: "Integrations", panel: "integrations" as ActivePanel },
        { icon: Webhook,       label: "Webhooks",     panel: "webhooks"   as ActivePanel },
        { icon: FileText,      label: "Job Photos",   panel: "photos"     as ActivePanel },
        { icon: BarChart3,     label: "Executive",    panel: "executive"  as ActivePanel },
        { icon: Mail,          label: "Outreach",     panel: "outreach"   as ActivePanel },
        { icon: FileSignature, label: "Deals",        panel: "deals"      as ActivePanel },
        { icon: BarChart3,     label: "Insights",     panel: "insights"   as ActivePanel },
        { icon: Bot,           label: "Automations",  panel: "automations" as ActivePanel },
        { icon: Bot,           label: "AI Assistant", panel: "ai"         as ActivePanel, badge: "AI" },
      ],
    },
    {
      label: "Account",
      items: [
        { icon: Settings,      label: "Launch",       panel: "launch"     as ActivePanel },
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
        className={`absolute left-0 right-0 z-50 bg-[#1B2D4F] rounded-t-3xl shadow-2xl overflow-y-auto ${
          showSheet ? "block" : "hidden"
        }`}
        style={{ bottom: "100%", maxHeight: "70vh" }}
        role="dialog"
        aria-label="All features"
        aria-hidden={!showSheet}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-white/30" />
        </div>

        <div className="px-4 pb-6 pt-1 space-y-5">
          <p className="text-xs font-bold text-white/80 uppercase tracking-widest px-1">All Features</p>

          {sheetSections.map((section) => (
            <div key={section.label}>
              <p className="text-[10px] font-semibold text-[#D4922A] uppercase tracking-wider mb-2 px-1">{section.label}</p>
              <div className="grid grid-cols-4 gap-1.5">
                {section.items.map((item) => (
                  <button
                    key={item.panel}
                    onClick={() => handleSheetNav(item.panel)}
                    aria-label={item.label}
                    className={`relative flex flex-col items-center justify-center py-3.5 px-1 rounded-xl gap-1.5 transition-all active:scale-95 ${
                      active === item.panel
                        ? "bg-[#D4922A]/20 text-[#D4922A]"
                        : "bg-white/8 text-white/65 hover:bg-white/15 hover:text-white"
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
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/8 text-white/65 hover:bg-white/15 hover:text-white transition-all text-xs font-medium"
            >
              <CreditCard className="w-4 h-4" />
              Billing
            </button>
            {(user as { isOwner?: boolean } | null)?.isOwner && (
              <button
                onClick={() => { navigate("/admin"); setShowSheet(false); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/8 text-white/65 hover:bg-white/15 hover:text-white transition-all text-xs font-medium"
              >
                <Star className="w-4 h-4" />
                Admin
              </button>
            )}
            <button
              onClick={() => { navigate("/"); setShowSheet(false); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/8 text-white/65 hover:bg-white/15 hover:text-white transition-all text-xs font-medium"
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
          background: "rgba(27,45,79,0.98)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderTop: "1px solid #DDDBD7",
          boxShadow: "0 -2px 16px rgba(0,0,0,0.25)",
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

export { MobileQuickStats, MobileBottomNav };
