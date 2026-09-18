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
    if (type === "invoice") return <FileText className="w-4 h-4 text-[#3D3D3D]" />;
    if (type === "success") return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (type === "warning") return <AlertCircle className="w-4 h-4 text-orange-500" />;
    return <Bell className="w-4 h-4 text-[#3D3D3D]" />;
  };

  const typeColor = (type: string) => {
    if (type === "message") return "bg-blue-50 border-blue-500/20";
    if (type === "booking") return "bg-amber-500/10 border-amber-500/20";
    if (type === "invoice_paid") return "bg-green-500/10 border-green-100";
    if (type === "invoice_overdue") return "bg-red-500/10 border-red-100";
    if (type === "warning") return "bg-orange-50 border-orange-100";
    if (type === "success") return "bg-green-500/10 border-green-100";
    return "bg-[#F7F6F3] border-[#DDDBD7]";
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#1A1A1A]">Smart Inbox</h2>
          <p className="text-sm text-[#3D3D3D] mt-0.5">
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
              filter === f ? "bg-[#D4922A] text-white" : "bg-white border border-[#DDDBD7] text-[#6B6B6B] hover:border-[#D4922A]"
            }`}>
            {f}{f === "unread" && unreadCount > 0 ? ` (${unreadCount})` : ""}
          </button>
        ))}
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-xl bg-[#EEECEA] flex items-center justify-center mx-auto mb-4">
            <Inbox className="w-8 h-8 text-[#6B6B6B]" />
          </div>
          <p className="font-semibold text-[#2A2A2A]">Nothing here</p>
          <p className="text-sm text-[#3D3D3D] mt-1">Your activity feed will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <div key={item.id}
              className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer hover:shadow-sm ${
                item.read ? "bg-white border-[#DDDBD7]" : typeColor(item.type)
              }`}
              onClick={() => {
                if (!item.read && item.meta?.notifId) markRead.mutate({ notifId: item.meta.notifId });
                if (item.link) setActivePanel(item.link.includes("panel=") ? (item.link.split("panel=")[1].split("&")[0] as ActivePanel) : "overview");
              }}
            >
              <div className="w-8 h-8 rounded-lg bg-white/90 border border-[#DDDBD7] flex items-center justify-center flex-shrink-0 mt-0.5">
                {typeIcon(item.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-semibold truncate ${item.read ? "text-[#2A2A2A]" : "text-[#1A1A1A]"}` }>{item.title}</p>
                  {!item.read && <span className="w-2 h-2 rounded-full bg-[#D4922A] flex-shrink-0 mt-1" />}
                </div>
                <p className="text-xs text-[#3D3D3D] mt-0.5 line-clamp-2">{item.body}</p>
                <p className="text-[10px] text-[#3D3D3D] mt-1">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


export { SmartInboxPanel };
