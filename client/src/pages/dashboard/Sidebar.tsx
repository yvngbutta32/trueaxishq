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
  Package, Receipt, Smartphone, Rocket, UsersRound, MapPin, PlugZap, Webhook,
  FileBarChart
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
  PieChart, Pie, Cell
} from "recharts";

import { type ActivePanel, type ConfirmState, type LineItem, defaultConfirm, LEGACY_PANEL_REDIRECTS, getGreeting, formatCurrency, formatDate, formatBookingDate, formatBookingTime, Skeleton, Modal, useFormField, LineItemRow } from "./shared";

// ─── Sidebar ─────────────────────────────────────────────────────────────────
const navGroups: { label: string; items: { icon: React.ElementType; label: string; panel: ActivePanel; badge?: string }[] }[] = [
  {
    label: "Run Business",
    items: [
      { icon: LayoutDashboard, label: "Dashboard",  panel: "overview"   },
      { icon: Activity,        label: "Operations", panel: "executive"  },
      { icon: Rocket,          label: "Launch",     panel: "launch"     },
    ],
  },
  {
    label: "Clients & Jobs",
    items: [
      { icon: Users,           label: "Clients",    panel: "clients"    },
      { icon: Calendar,        label: "Scheduling", panel: "scheduling" },
      { icon: Package,         label: "Jobs",       panel: "jobs"       },
      { icon: Camera,          label: "Job Photos", panel: "photos"     },
      { icon: UsersRound,      label: "Team",       panel: "team"       },
      { icon: MapPin,          label: "Dispatch",   panel: "dispatch"   },
      { icon: Smartphone,      label: "Field Mode", panel: "field"      },
    ],
  },
  {
    label: "Money",
    items: [
      { icon: FileText,        label: "Billing",    panel: "billing"    },
      { icon: Package,         label: "Inventory",  panel: "inventory" },
      { icon: FileBarChart,     label: "Reports",    panel: "reports"   },
    ],
  },
  {
    label: "Growth",
    items: [
      { icon: Mail,            label: "Outreach",   panel: "outreach"   },
      { icon: FileSignature,   label: "Deals",      panel: "deals"      },
      { icon: BarChart3,       label: "Insights",   panel: "insights"   },
    ],
  },
  {
    label: "System",
    items: [
      { icon: PlugZap,         label: "Integrations", panel: "integrations" },
      { icon: Webhook,         label: "Webhooks",    panel: "webhooks"   },
      { icon: Settings,        label: "Settings",   panel: "settings"   },
      { icon: Bot,             label: "AI Assistant", panel: "ai"       },
    ],
  },
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
      className={`fixed left-0 top-0 h-full bg-[#1B2D4F] border-r border-[#243A5E] flex flex-col transition-all duration-300 z-40 shadow-lg ${collapsed ? "w-16" : "w-60"}`}
      aria-label="Main navigation"
    >
      {/* Logo — click navigates to dashboard */}
      <div className="flex items-center justify-center px-3 py-4 border-b border-[#243A5E]">
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
                src={TRUEAXIS_LOGO_URL}
                alt="TrueAxis HQ — Dashboard"
                className="w-full h-full object-cover object-left"
              />
            </div>
          ) : (
            <img
              src={TRUEAXIS_LOGO_URL}
              alt="TrueAxis HQ — Dashboard"
              className="h-9 w-auto object-contain"
            />
          )}
        </button>
      </div>

      {/* Nav — scrollable, footer stays pinned */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto min-h-0 scroll-smooth sidebar-scrollbar" aria-label="Dashboard sections">
        {navGroups.map((group) => (
          <div key={group.label} role="group" aria-label={group.label}>
            {!collapsed ? (
              <p className="px-3 pt-4 pb-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white/35">{group.label}</p>
            ) : (
              <div className="my-2 mx-3 border-t border-white/10" aria-hidden="true" />
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <button
                  key={item.panel}
                  onClick={() => setActive(item.panel)}
                  aria-current={active === item.panel ? "page" : undefined}
                  aria-label={item.label}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative ${
                    active === item.panel
                      ? "bg-[#D4922A]/20 text-white border-l-2 border-[#D4922A] pl-[10px] font-semibold"
                      : "text-white/65 hover:bg-white/10 hover:text-white border-l-2 border-transparent pl-[10px]"
                  }`}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && item.badge && active !== item.panel && (
                    <span className="ml-auto text-[9px] font-bold bg-[#D4922A]/25 text-[#E8A020] px-1.5 py-0.5 rounded-full">{item.badge}</span>
                  )}
                  {!collapsed && active === item.panel && <ChevronRight className="w-3 h-3 ml-auto" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-[#243A5E] space-y-1">

        {(user as { isOwner?: boolean } | null)?.isOwner && (
          <button onClick={() => navigate("/admin")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/65 hover:bg-white/10 hover:text-white transition-all" aria-label="Admin panel">
            <Star className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Admin Panel</span>}
          </button>
        )}
        {/* Keyboard shortcuts hint */}
        {!collapsed && (
          <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Shortcuts</p>
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
                  <span className="text-[10px] text-white/60">{label}</span>
                  <div className="flex items-center gap-0.5">
                    {keys.map(k => (
                      <kbd key={k} className="px-1 py-0.5 rounded border border-white/20 bg-white/10 text-[9px] text-white/70 font-mono leading-none">{k}</kbd>
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
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/50 hover:bg-white/10 hover:text-white transition-all"
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


export { Sidebar };
