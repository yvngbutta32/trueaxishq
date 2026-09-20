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


const ClientPulsePanel = lazy(() => import("./ClientPulse"));
const TimeTrackingPanel = lazy(() => import("./TimeTracking"));
const Services = lazy(() => import("./Services"));
const Expenses = lazy(() => import("./Expenses"));
const Proposals = lazy(() => import("./Proposals"));
const Automations = lazy(() => import("./Automations"));
const BillingPanel = lazy(() => import("./BillingPanel"));
const JobPhotosPanel = lazy(() => import("./JobPhotosPanel"));
const InventoryPanel = lazy(() => import("./dashboard/InventoryPanel"));
const SubcontractorsPanel = lazy(() => import("./dashboard/SubcontractorsPanel"));
const ReportsPanel = lazy(() => import("./dashboard/ReportsPanel"));
const ImportPanel = lazy(() => import("./dashboard/ImportPanel"));
const JobWorkspace = lazy(() => import("./JobWorkspace"));
const FieldMode = lazy(() => import("./FieldMode"));
const TeamOperations = lazy(() => import("./TeamOperations"));
const DispatchBoard = lazy(() => import("./DispatchBoard"));
const IntegrationHub = lazy(() => import("./IntegrationHub"));
const WorkflowWebhooks = lazy(() => import("./WorkflowWebhooks"));
const ExecutiveDashboard = lazy(() => import("./ExecutiveDashboard"));
const LaunchReadiness = lazy(() => import("./LaunchReadiness"));
const OutreachPanel = lazy(() => import("./OutreachPanel"));
const DealsPanel = lazy(() => import("./DealsPanel"));
const InsightsPanel = lazy(() => import("./InsightsPanel"));


import { Sidebar } from "./dashboard/Sidebar";
import { ChangelogModal } from "./dashboard/ChangelogModal";
import { OverviewPanel } from "./dashboard/OverviewPanel";
import { ClientsPanel } from "./dashboard/ClientsPanel";
import { SchedulingPanel } from "./dashboard/SchedulingPanel";
import { InvoicesPanel } from "./dashboard/InvoicesPanel";
import { FollowUpsPanel } from "./dashboard/FollowUpsPanel";
import { AnalyticsPanel } from "./dashboard/AnalyticsPanel";
import { SettingsPanel } from "./dashboard/SettingsPanel";
import { ContractsPanel } from "./dashboard/ContractsPanel";
import { SmartInboxPanel } from "./dashboard/SmartInboxPanel";
import { TestimonialsPanel } from "./dashboard/TestimonialsPanel";
import { MobileQuickStats, MobileBottomNav } from "./dashboard/MobileNav";
import { type ActivePanel, type ConfirmState, defaultConfirm, LEGACY_PANEL_REDIRECTS, Skeleton, Modal } from "./dashboard/shared";

export default function Dashboard() {
  // Read ?panel= from URL on first render for deep-linking (e.g. /dashboard?panel=invoices)
  const [active, setActive] = useState<ActivePanel>(() => {
    if (typeof window !== "undefined") {
      const param = new URLSearchParams(window.location.search).get("panel");
      const valid: ActivePanel[] = ["overview","clients","scheduling","jobs","team","dispatch","integrations","webhooks","billing","outreach","deals","insights","settings","ai","photos","inventory","reports","import","subs",
        // Legacy sub-panel deep links — will auto-redirect to parent
        "invoices","followups","analytics","pulse","contracts","time","inbox","testimonials","services","expenses","proposals","automations"];
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
    // AI panel is now embedded — no need to show floating widget when navigating there
    requestAnimationFrame(() => {
      mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  // Preserve legacy deep links without scheduling a state update during render.
  useEffect(() => {
    const targetPanel = LEGACY_PANEL_REDIRECTS[active];
    if (targetPanel) setActiveWithScroll(targetPanel);
  // setActiveWithScroll intentionally performs a scroll after the state transition.
   
  }, [active]);

  // Update document title based on active panel
  useEffect(() => {
    const PANEL_TITLES: Record<ActivePanel, string> = {
            overview: "Dashboard — TrueAxis HQ",
      executive: "Operations — TrueAxis HQ",
      launch: "Launch Readiness — TrueAxis HQ",
      clients: "Clients — TrueAxis HQ",
      scheduling: "Scheduling — TrueAxis HQ",
      jobs: "Job Workspace — TrueAxis HQ",
      team: "Team & Capacity — TrueAxis HQ",
      dispatch: "Dispatch Board — TrueAxis HQ",
      field: "Field Mode — TrueAxis HQ",
      integrations: "Integration Hub — TrueAxis HQ",
      webhooks: "Workflow Webhooks — TrueAxis HQ",
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
      photos: "Job Photos — TrueAxis HQ",
      inventory: "Inventory — TrueAxis HQ",
      subs: "Subcontractors — TrueAxis HQ",
      reports: "Custom Reports — TrueAxis HQ",
      import: "Import Data — TrueAxis HQ",
    };
    document.title = PANEL_TITLES[active] ?? "Dashboard — TrueAxis HQ";
  }, [active]);

  // Global keyboard shortcuts: Cmd+K / Ctrl+K = search; Alt+1..9 = panel navigation
  useEffect(() => {
    const panels: ActivePanel[] = ["overview", "clients", "scheduling", "billing", "outreach", "deals", "insights", "import", "settings", "ai"];
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
        const idx = parseInt(e.key, 10) - 1;
        if (isNaN(idx) || idx < 0) return;
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

  // Panel metadata — defined before any early returns to satisfy Rules of Hooks
  const panelTitles: Record<ActivePanel, string> = {
    overview: "Dashboard", executive: "Operations", launch: "Launch Readiness", clients: "Clients", scheduling: "Scheduling", jobs: "Job Workspace", team: "Team & Capacity", dispatch: "Dispatch Board", field: "Field Mode", integrations: "Integration Hub", webhooks: "Workflow Webhooks",
    invoices: "Invoices", followups: "Follow-Ups", analytics: "Analytics",
    settings: "Settings", ai: "AI Assistant", pulse: "Client Pulse",
    contracts: "Contracts", time: "Time Tracking",
    inbox: "Smart Inbox", testimonials: "Testimonials",
    services: "Services", expenses: "Expenses & P&L", proposals: "Proposals", automations: "Automations",
    billing: "Billing", outreach: "Outreach", deals: "Deals", insights: "Insights", photos: "Job Photos", inventory: "Inventory", reports: "Custom Reports", import: "Import Data", subs: "Subcontractors",
  };
  const panelSubtitles: Record<ActivePanel, string> = {
    overview: "Your business at a glance",
    executive: "Cash, capacity, client decisions, and automation health",
    launch: "Complete each operational signal before sharing with clients",
    clients: "Manage relationships & contacts",
    scheduling: "Appointments & availability",
    jobs: "Run each job from approved work to proof and profit",
    team: "Capacity planning and accountable job ownership",
    dispatch: "Schedule service visits and coordinate the next field handoff",
    field: "Mobile-first time, proof, and client updates",
    integrations: "Provider readiness and truthful connection status",
    webhooks: "Signed event delivery to your approved operational endpoints",
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
    photos: "Upload & manage job photos, receipts & estimates",
    inventory: "Truck-level stock, purchase orders, and audit trail",
    reports: "Build, save, and export any view of your data",
    import: "Bring your data over from another system in one guided afternoon",
    subs: "Zero-install subcontractor invites: private job links, no accounts required",
  };
  // useMemo ensures the panel JSX element is only recreated when `active` changes.
  // Without this, every Dashboard re-render (notification poll, search state, etc.)
  // returns a brand-new element reference, causing React to unmount+remount the
  // active panel and losing input focus mid-typing.
  const activePanel = useMemo(() => {
    switch (active) {
      case "overview": return <PanelErrorBoundary panelName="Overview"><OverviewPanel userName={user?.name || ""} setActivePanel={setActive} /></PanelErrorBoundary>;
      case "clients": return (
        <PanelErrorBoundary panelName="Clients">
          <PanelTabs
            defaultTab="clients"
            tabs={[
              { id: "clients",      label: "Clients",      icon: Users,    content: <ClientsPanel /> },
              { id: "testimonials", label: "Testimonials", icon: ThumbsUp, content: <TestimonialsPanel /> },
            ]}
          />
        </PanelErrorBoundary>
      );
      case "scheduling": return <PanelErrorBoundary panelName="Scheduling"><SchedulingPanel /></PanelErrorBoundary>;
      case "executive": return <PanelErrorBoundary panelName="Executive Operating Dashboard"><ExecutiveDashboard /></PanelErrorBoundary>;
      case "launch": return <PanelErrorBoundary panelName="Launch Readiness"><LaunchReadiness onNavigate={setActiveWithScroll} /></PanelErrorBoundary>;
      case "jobs": return <PanelErrorBoundary panelName="Job Workspace"><JobWorkspace /></PanelErrorBoundary>;
      case "team": return <PanelErrorBoundary panelName="Team Operations"><TeamOperations /></PanelErrorBoundary>;
      case "dispatch": return <PanelErrorBoundary panelName="Dispatch Board"><DispatchBoard /></PanelErrorBoundary>;
      case "field": return <PanelErrorBoundary panelName="Field Mode"><FieldMode /></PanelErrorBoundary>;
      case "integrations": return <PanelErrorBoundary panelName="Integration Hub"><IntegrationHub onOpenSettings={() => setActiveWithScroll("settings")} /></PanelErrorBoundary>;
      case "webhooks": return <PanelErrorBoundary panelName="Workflow Webhooks"><WorkflowWebhooks /></PanelErrorBoundary>;
      // Legacy deep links redirect through the effect above.
      case "invoices":
      case "followups":
      case "analytics":
      case "pulse":
      case "contracts":
      case "time":
      case "inbox":
      case "testimonials":
      case "services":
      case "expenses":
      case "proposals":
      case "automations": return null;
      case "settings": return <PanelErrorBoundary panelName="Settings"><SettingsPanel /></PanelErrorBoundary>;
      // ─── AI Assistant — full embedded chat panel ───────────────────────────
      case "ai": return (
        <PanelErrorBoundary panelName="AI Assistant">
          <div className="h-[calc(100vh-12rem)] min-h-[500px]">
            <AIAssistant
              visible={true}
              panelMode={true}
              onClose={() => {}}
              onNavigateToPanel={(panel) => setActiveWithScroll(panel as ActivePanel)}
              context={{ activePanel: "ai" }}
            />
          </div>
        </PanelErrorBoundary>
      );
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
      case "photos": return (
        <PanelErrorBoundary panelName="Job Photos">
          <JobPhotosPanel />
        </PanelErrorBoundary>
      );
      case "subs": return <PanelErrorBoundary panelName="Subcontractors"><SubcontractorsPanel /></PanelErrorBoundary>;
      case "inventory": return (
        <PanelErrorBoundary panelName="Inventory">
          <InventoryPanel />
        </PanelErrorBoundary>
      );
      case "import": return (
        <PanelErrorBoundary panelName="Import Data">
          <ImportPanel />
        </PanelErrorBoundary>
      );
      case "reports": return (
        <PanelErrorBoundary panelName="Custom Reports">
          <ReportsPanel />
        </PanelErrorBoundary>
      );
      default: return null;
    }
   
  }, [active, user?.name]);

  // Loading state — placed AFTER all hooks to satisfy Rules of Hooks
  if (loading) return (
    <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-[#D4922A] animate-spin mx-auto mb-3" />
        <p className="text-sm text-[#6B6B6B]">Loading your dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="bg-[#F7F6F3] flex flex-col md:flex-row overflow-x-hidden w-full" style={{ height: '100dvh' }}>
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
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#DDDBD7] px-4 md:px-6 py-3 flex items-center justify-between">
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
                  src={TRUEAXIS_LOGO_URL}
                  alt="TrueAxis HQ — Dashboard"
                  className="h-7 w-auto object-contain"
                />
              </button>
              <span className="text-sm font-bold text-[#1A1A1A]">
                {panelTitles[active]}
              </span>
            </div>
            <div className="hidden md:block">
              <h1 className="text-base font-bold text-[#1A1A1A] leading-tight">{panelTitles[active]}</h1>
              <p className="text-xs text-[#3D3D3D] leading-tight">{panelSubtitles[active]}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Home button */}
            <button
              onClick={() => navigate("/")}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-[#6B6B6B] hover:bg-[#EEECEA] hover:text-[#1A1A1A] transition-all"
              aria-label="Go to homepage"
              title="Homepage"
            >
              <Home className="w-4 h-4" aria-hidden="true" />
              <span>Home</span>
            </button>
            {/* Global Search Trigger — Cmd+K */}
            <button
              onClick={() => setGlobalSearchOpen(true)}
              className="hidden md:flex items-center gap-2.5 px-3 py-2 rounded-xl border border-[#DDDBD7] bg-white hover:bg-[#F7F6F3] hover:border-[#C8C5BF] transition-all group"
              aria-label="Search everything (Cmd+K)"
              title="Search (Cmd+K)"
            >
              <Search className="w-3.5 h-3.5 text-[#6B6B6B] group-hover:text-[#1A1A1A] transition-colors" aria-hidden="true" />
              <span className="text-sm text-[#6B6B6B] group-hover:text-[#1A1A1A] transition-colors w-32 text-left">Search everything…</span>
              <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-[#C8C5BF] text-[10px] text-[#6B6B6B] font-mono">
                <span className="text-[11px]">&#8984;</span>K
              </kbd>
            </button>
            {/* Mobile search icon */}
            <button
              onClick={() => setGlobalSearchOpen(true)}
              className="md:hidden p-2 rounded-xl hover:bg-[#EEECEA] transition-colors"
              aria-label="Search (Cmd+K)"
            >
              <Search className="w-4 h-4 text-[#6B6B6B]" />
            </button>

            {/* Health Monitor */}
            <HealthMonitor />
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications && unreadCount > 0) markAllReadMutation.mutate(); }}
                className="relative p-2 rounded-xl hover:bg-[#EEECEA] transition-colors"
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                aria-expanded={showNotifications}
              >
                <Bell className="w-4 h-4 text-[#6B6B6B]" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500/100 rounded-full" aria-hidden="true" />
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-2xl border border-[#DDDBD7] z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#DDDBD7]">
                    <p className="text-sm font-bold text-[#1A1A1A]">Notifications</p>
                    {(notifList?.length ?? 0) > 0 && (
                      <button onClick={() => markAllReadMutation.mutate()} className="text-xs text-[#D4922A] hover:underline font-medium">Mark all read</button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {!notifList || notifList.length === 0 ? (
                      <div className="py-8 text-center">
                        <Bell className="w-8 h-8 text-[#6B6B6B] mx-auto mb-2" />
                        <p className="text-xs text-[#6B6B6B]">No notifications yet</p>
                      </div>
                    ) : (
                      notifList.map(n => (
                        <div key={n.id} className={`flex items-start gap-3 px-4 py-3 border-b border-[#EEECEA] hover:bg-[#F7F6F3] transition-colors ${!n.read ? 'bg-amber-50' : ''}`}>
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.type === 'success' ? 'bg-green-400' : n.type === 'error' ? 'bg-red-400' : 'bg-blue-400'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-[#1A1A1A] truncate">{n.title}</p>
                            <p className="text-xs text-[#6B6B6B] mt-0.5 line-clamp-2">{n.body}</p>
                            <p className="text-[10px] text-[#6B6B6B] mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                          </div>
                          <button onClick={() => dismissNotifMutation.mutate({ id: n.id })} className="p-2 rounded hover:bg-white/12 transition-colors flex-shrink-0" aria-label="Dismiss">
                            <X className="w-3 h-3 text-[#6B6B6B]" />
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
            <button
              type="button"
              className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4922A] focus-visible:ring-offset-2"
              aria-label={`Logged in as ${user?.name || "User"}`}
              onClick={() => setActiveWithScroll("settings")}
              title="Go to Settings"
            >
              {(user as { avatarUrl?: string } | null)?.avatarUrl ? (
                <img src={(user as { avatarUrl?: string }).avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full gradient-amber flex items-center justify-center text-white text-xs font-bold">
                  {user?.name?.slice(0, 2).toUpperCase() || "U"}
                </div>
              )}
            </button>
          </div>
        </header>

        {/* Panel Content — pb-[130px] ensures content clears MobileQuickStats (~40px) + MobileBottomNav (~62px) + buffer on mobile */}
        <div className="p-4 md:p-6 max-w-6xl mx-auto w-full overflow-x-hidden pb-[130px] md:pb-6">
          <Suspense fallback={<div className="flex min-h-48 items-center justify-center text-sm text-[#6B6B6B]"><Loader2 className="mr-2 h-5 w-5 animate-spin text-[#D4922A]" />Loading workspace…</div>}>
            {activePanel}
          </Suspense>
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
 
