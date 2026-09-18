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
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-[#DDDBD7]">
        <div className="flex items-center justify-between p-5 border-b border-[#EEECEA]">
          <div>
            <h2 className="font-extrabold text-[#1A1A1A] text-base">What's New in v{CHANGELOG_VERSION} 🎉</h2>
            <p className="text-xs text-[#6B6B6B] mt-0.5">TrueAxis HQ — Latest Updates</p>
          </div>
          <button onClick={dismiss} className="p-2 rounded-lg hover:bg-[#F0EEE9] transition-colors" aria-label="Close">
            <X className="w-4 h-4 text-[#6B6B6B]" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {([
            { emoji: "🔔", title: "Notification center", desc: "Review available app notifications from the bell menu." },
            { emoji: "⏱", title: "Time Tracking", desc: "Start/stop timer, log billable hours, and see summary stats per client." },
            { emoji: "🔁", title: "Recurring Invoices", desc: "Configure weekly, monthly, or custom invoice plans and review related records in Billing." },
            { emoji: "📄", title: "Contracts & Proposals", desc: "Write and manage proposals and invoices in one workspace." },
            { emoji: "🌐", title: "Client Portal", desc: "Clients can view owner-curated invoices and booking information through a token-scoped link." },
            { emoji: "📅", title: "iCal Export", desc: "Export a subscription calendar feed for compatible calendar apps." },
            { emoji: "💳", title: "Payment links", desc: "Create payment links for eligible invoices. Provider checkout and signed webhook handling require separate validation." },
            { emoji: "🤖", title: "Automation readiness", desc: "Configured rule drafts and maintenance routines are available for review; delivery and managed scheduling require separate validation." },
          ] as { emoji: string; title: string; desc: string }[]).map(item => (
            <div key={item.title} className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0">{item.emoji}</span>
              <div>
                <p className="text-sm font-bold text-[#1A1A1A]">{item.title}</p>
                <p className="text-xs text-[#6B6B6B] mt-0.5">{item.desc}</p>
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


export { ChangelogModal };
