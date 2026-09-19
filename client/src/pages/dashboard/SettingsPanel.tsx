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
  ChevronRight, LogOut, X, Edit2, Trash2, Send, BookOpen,
  Download, Phone, AlertCircle, RefreshCw, User, ShieldCheck, Monitor,
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
    onSuccess: (data) => { if (data.url) { toast.info("Redirecting to checkout…"); window.open(data.url, "_blank", "noopener"); } },
    onError: (e) => toast.error("Checkout error: " + e.message),
  });
  const portalMutation = trpc.billing.createPortal.useMutation({
    onSuccess: (data) => { if (data.url) { toast.info("Opening billing portal…"); window.open(data.url, "_blank", "noopener"); } },
    onError: (e) => toast.error("Portal error: " + e.message),
  });

  const currentPlan = subscriptionQuery.data?.planId ?? "free";
  const currentStatus = subscriptionQuery.data?.status ?? "free";
  const hasActiveSubscription = currentStatus === "active";
  const plans = plansQuery.data ?? [];

  return (
    <div className="bg-white rounded-xl border border-[#DDDBD7] p-6 space-y-5">
      <h3 className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-[#D4922A]" />Billing &amp; Subscription
      </h3>

      {/* Current plan status */}
      <div className="flex items-center justify-between p-3 bg-[#F7F6F3] border border-[#DDDBD7] rounded-xl">
        <div className="flex items-center gap-3">
          {(() => {
            const Icon = BILLING_PLAN_ICONS[currentPlan] ?? Zap;
            const color = BILLING_PLAN_COLORS[currentPlan] ?? "bg-gray-400";
            return <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}><Icon className="w-4 h-4 text-white" /></div>;
          })()}
          <div>
            <p className="text-sm font-semibold text-[#1A1A1A] capitalize">
              {currentPlan === "free" ? "Free Plan" : `${currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} Plan`}
            </p>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mt-0.5 ${
              currentStatus === "active" ? "bg-green-500/15 text-green-400" :
              currentStatus === "past_due" ? "bg-yellow-500/15 text-yellow-400" :
              currentStatus === "cancelled" ? "bg-red-500/15 text-red-400" :
              "bg-[#EEECEA] text-[#6B6B6B]"
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
                : "bg-[#F7F6F3] text-[#6B6B6B] border-[#DDDBD7] hover:border-[#C8C5BF]"
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
                  "border-[#DDDBD7] bg-[#F7F6F3] hover:border-[#DDDBD7]"
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
                <p className="text-sm font-extrabold text-[#1A1A1A] mb-0.5">{plan.name}</p>
                <p className="text-[11px] text-[#3D3D3D] mb-3 leading-snug">{plan.description}</p>
                <div className="mb-3">
                  <span className="text-xl font-extrabold text-[#1A1A1A]">${price}</span>
                  <span className="text-xs text-[#3D3D3D]">/mo</span>
                  {billingInterval === "annual" && <p className="text-[10px] text-green-600 font-semibold">Billed annually</p>}
                </div>
                <ul className="space-y-1.5 mb-4 flex-1">
                  {plan.features.slice(0, 4).map((feature: string) => (
                    <li key={feature} className="flex items-start gap-1.5 text-[11px] text-[#6B6B6B]">
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
                      plan.highlighted ? "gradient-amber text-white border-0" : "bg-gray-200 text-[#2A2A2A] border-0 hover:bg-gray-300"
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
    <div className="bg-white rounded-xl border border-[#DDDBD7] p-6 space-y-4">
      <h3 className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2">
        <Settings className="w-4 h-4 text-[#D4922A]" />Change Password
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Current Password</label>
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] hover:text-[#6B6B6B]"
              aria-label={showPasswords ? "Hide passwords" : "Show passwords"}
            >
              {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">New Password</label>
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
          <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Confirm New Password</label>
          <input
            type={showPasswords ? "text" : "password"}
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            autoComplete="new-password"
            className={`form-input-light ${
              confirmPassword && confirmPassword !== newPassword ? "border-red-300" : "border-[#DDDBD7]"
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

// ─── Two-Factor Authentication Section ─────────────────────────────────────────
function TwoFactorSection() {
  const utils = trpc.useUtils();
  const { data: status } = trpc.twoFactor.status.useQuery(undefined, { retry: 1 });
  const enabled = status?.enabled === true;

  const [step, setStep] = useState<"idle" | "setup" | "confirm" | "backup">("idle");
  const [setup, setSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState("");

  const setupStart = trpc.twoFactor.setupStart.useMutation({
    onSuccess: (data) => { setSetup({ secret: data.secret, qrDataUrl: data.qrDataUrl }); setStep("setup"); },
    onError: (e) => toast.error(e.message || "Could not start two-factor setup."),
  });
  const setupConfirm = trpc.twoFactor.setupConfirm.useMutation({
    onSuccess: (data) => {
      setBackupCodes(data.backupCodes);
      setStep("backup");
      void utils.twoFactor.status.invalidate();
      toast.success("Two-factor authentication enabled.");
    },
    onError: (e) => toast.error(e.message || "Could not verify the code."),
  });
  const disable = trpc.twoFactor.disable.useMutation({
    onSuccess: () => {
      setDisablePassword("");
      setStep("idle");
      setSetup(null); setBackupCodes(null); setConfirmCode("");
      void utils.twoFactor.status.invalidate();
      toast.success("Two-factor authentication disabled.");
    },
    onError: (e) => toast.error(e.message || "Could not disable two-factor authentication."),
  });

  function downloadBackupCodes() {
    if (!backupCodes) return;
    const blob = new Blob([`TrueAxis HQ two-factor backup codes\n\n${backupCodes.join("\n")}\n\nEach code works once. Store them somewhere safe (not on this device).\n`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "trueaxis-2fa-backup-codes.txt"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bg-white rounded-xl border border-[#DDDBD7] p-6 space-y-4">
      <h3 className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-[#D4922A]" />Two-Factor Authentication
        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${enabled ? "bg-emerald-100 text-emerald-700" : "bg-[#F2F0EC] text-[#6B6B6B]"}`}>
          {enabled ? "Enabled" : "Off"}
        </span>
      </h3>
      <p className="text-xs text-[#6B6B6B]">
        Require a 6-digit code from your authenticator app (Google Authenticator, Authy, 1Password) at sign-in. Even if your password leaks, nobody can get in without your phone.
      </p>

      {step === "idle" && !enabled && (
        <Button size="sm" className="gradient-amber text-white border-0 hover:opacity-90" onClick={() => setupStart.mutate()} disabled={setupStart.isPending}>
          {setupStart.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShieldCheck className="w-4 h-4" />Enable two-factor</>}
        </Button>
      )}

      {step === "setup" && setup && (
        <div className="space-y-4 rounded-xl bg-[#F7F6F3] border border-[#DDDBD7] p-4">
          <p className="text-xs text-[#6B6B6B]">1. Scan this QR code with your authenticator app…</p>
          <div className="flex justify-center"><img src={setup.qrDataUrl} alt="Two-factor QR code" width={200} height={200} className="rounded-lg border border-[#DDDBD7] bg-white" /></div>
          <p className="text-xs text-[#6B6B6B]">…or enter this key manually: <code className="block mt-1 font-mono text-[11px] bg-white border border-[#DDDBD7] rounded px-2 py-1 break-all">{setup.secret}</code></p>
          <p className="text-xs text-[#6B6B6B]">2. Enter the 6-digit code the app shows to finish:</p>
          <div className="flex items-center gap-2">
            <input
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              className="w-32 rounded-lg border border-[#DDDBD7] px-3 py-2 text-sm text-center tracking-[0.3em] bg-white"
              aria-label="Six-digit authenticator code"
            />
            <Button size="sm" className="gradient-amber text-white border-0 hover:opacity-90" onClick={() => setupConfirm.mutate({ code: confirmCode })} disabled={setupConfirm.isPending || confirmCode.length !== 6}>
              {setupConfirm.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & enable"}
            </Button>
            <Button size="sm" variant="outline" className="border-[#DDDBD7] text-[#6B6B6B]" onClick={() => { setStep("idle"); setSetup(null); setConfirmCode(""); }}>Cancel</Button>
          </div>
        </div>
      )}

      {step === "backup" && backupCodes && (
        <div className="space-y-4 rounded-xl bg-[#F7F6F3] border border-[#DDDBD7] p-4">
          <p className="text-xs font-semibold text-[#8A5A0B]">Save your backup codes now — they're shown only once.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {backupCodes.map(code => (
              <code key={code} className="font-mono text-xs bg-white border border-[#DDDBD7] rounded px-2 py-1.5 text-center">{code}</code>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="border-[#DDDBD7] text-[#6B6B6B]" onClick={downloadBackupCodes}><Download className="w-3.5 h-3.5" />Download</Button>
            <Button size="sm" variant="outline" className="border-[#DDDBD7] text-[#6B6B6B]" onClick={() => setStep("idle")}>Done — I saved them</Button>
          </div>
        </div>
      )}

      {enabled && step === "idle" && (
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
            placeholder="Password to disable"
            autoComplete="current-password"
            className="w-56 rounded-lg border border-[#DDDBD7] px-3 py-2 text-sm bg-white"
            aria-label="Password to disable two-factor"
          />
          <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => disable.mutate({ password: disablePassword })} disabled={disable.isPending || !disablePassword}>
            {disable.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Disable 2FA"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Active Sessions Section ───────────────────────────────────────────────────
function SessionsSection() {
  const utils = trpc.useUtils();
  const { data: sessions, isLoading } = trpc.sessions.list.useQuery(undefined, { retry: 1 });
  const revokeOthers = trpc.sessions.revokeOthers.useMutation({
    onSuccess: (data) => {
      void utils.sessions.list.invalidate();
      toast.success(data.revoked === 0 ? "No other devices were signed in." : `Signed out ${data.revoked} other device${data.revoked !== 1 ? "s" : ""}.`);
    },
    onError: (e) => toast.error(e.message || "Could not revoke sessions."),
  });

  const iconFor = (t: string) => t === "mobile" || t === "tablet" ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />;

  return (
    <div className="bg-white rounded-xl border border-[#DDDBD7] p-6 space-y-4">
      <h3 className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2">
        <Monitor className="w-4 h-4 text-[#D4922A]" />Active Sessions
      </h3>
      <p className="text-xs text-[#6B6B6B]">
        Devices currently signed in to your account. Revoking signs them out immediately — useful if you lost a phone or used a shared computer.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-[#6B6B6B]"><Loader2 className="w-3.5 h-3.5 animate-spin" />Loading sessions…</div>
      ) : !sessions?.length ? (
        <p className="text-xs text-[#6B6B6B]">No active sessions found.</p>
      ) : (
        <>
          <ul className="divide-y divide-[#EDEBE7] border border-[#DDDBD7] rounded-xl overflow-hidden">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[#6B6B6B] shrink-0">{iconFor(session.deviceType)}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#1A1A1A] truncate">
                      {session.browser} on {session.os}
                      {session.isCurrent && (
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">This device</span>
                      )}
                    </p>
                    <p className="text-[11px] text-[#6B6B6B] truncate">
                      {session.deviceType === "mobile" || session.deviceType === "tablet" ? session.deviceType : "desktop"}
                      {" · IP "}{session.ip ?? "unknown"}
                      {" · since "}{new Date(session.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {sessions.length > 1 && (
            <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => revokeOthers.mutate()} disabled={revokeOthers.isPending}>
              {revokeOthers.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign out all other devices"}
            </Button>
          )}
        </>
      )}
    </div>
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
    <div className="bg-white rounded-xl border border-[#DDDBD7] p-6 space-y-4">
      <h3 className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2"><Zap className="w-4 h-4 text-[#D4922A]" />API Keys</h3>
      <p className="text-xs text-[#6B6B6B]">Use API keys to integrate TrueAxis HQ with Zapier, Make, or your own tools.</p>
      {createdKey && (
        <div className="bg-green-500/10 border border-green-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-green-700 mb-1">Your new API key (copy it now — it won't be shown again):</p>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono bg-[#F7F6F3] px-2 py-1 rounded border border-[#DDDBD7] flex-1 truncate text-[#1A1A1A]">{createdKey}</code>
            <button onClick={() => { navigator.clipboard.writeText(createdKey); toast.success("Copied!"); }} className="p-2 rounded hover:bg-green-500/20 text-green-600" aria-label="Copy API key"><Copy className="w-3.5 h-3.5" /></button>
          </div>
          <button onClick={() => setCreatedKey(null)} className="text-xs text-green-600 hover:underline mt-1">Dismiss</button>
        </div>
      )}
      {isLoading ? <Skeleton className="h-10" /> : keys && keys.length > 0 ? (
        <div className="space-y-2">
          {keys.map(k => (
            <div key={k.id} className="flex items-center justify-between p-3 bg-[#F7F6F3] rounded-xl">
              <div>
                <p className="text-sm font-semibold text-[#1A1A1A]">{k.name}</p>
                <p className="text-xs text-[#6B6B6B] font-mono">{k.keyPrefix}... · Created {new Date(k.createdAt).toLocaleDateString()}{k.lastUsedAt ? ` · Last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : " · Never used"}</p>
              </div>
              <button onClick={() => revokeKey.mutate({ id: k.id })} className="text-xs text-red-500 hover:underline font-medium" disabled={revokeKey.isPending}>Revoke</button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#6B6B6B]">No API keys yet.</p>
      )}
      <div className="flex gap-2">
        <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Key name (e.g. Zapier)" className="form-input-light flex-1" autoComplete="off" enterKeyHint="done" onKeyDown={e => e.key === 'Enter' && newKeyName.trim() && createKey.mutate({ name: newKeyName.trim() })} />
        <Button size="sm" className="gradient-amber text-white border-0 hover:opacity-90" onClick={() => newKeyName.trim() && createKey.mutate({ name: newKeyName.trim() })} disabled={createKey.isPending || !newKeyName.trim()}>
          {createKey.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Generate"}
        </Button>
      </div>
      <ApiReference />
    </div>
  );
}

// ─── REST API reference (item 13: public API + Zapier) ──────────────────────
const API_ENDPOINTS = [
  { method: "GET", path: "/api/v1/me", description: "Verify a key and its scope." },
  { method: "GET", path: "/api/v1/clients?search=&limit=&offset=", description: "List clients (max limit 200)." },
  { method: "POST", path: "/api/v1/clients", description: "Create a client: { name, email?, phone?, service? }." },
  { method: "GET", path: "/api/v1/jobs?status=&limit=&offset=", description: "List jobs, optionally filtered by status." },
  { method: "GET", path: "/api/v1/jobs/:id", description: "Fetch a single job." },
  { method: "PATCH", path: "/api/v1/jobs/:id", description: "Update a job: { status?, title?, targetDate? }." },
  { method: "GET", path: "/api/v1/invoices?status=&limit=&offset=", description: "List invoices." },
  { method: "POST", path: "/api/v1/invoices", description: "Create a draft invoice: { clientName, amount, clientEmail?, service?, dueDate? }." },
  { method: "GET", path: "/api/v1/proposals?status=&limit=&offset=", description: "List proposals." },
];

function ApiReference() {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-[#EFEEE9] pt-4 space-y-3">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left" aria-expanded={open}>
        <span className="text-xs font-bold text-[#1A1A1A] flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5 text-[#D4922A]" />REST API reference {open ? "—" : "+"}</span>
      </button>
      {open && (
        <>
          <p className="text-xs text-[#6B6B6B]">Send <code className="font-mono bg-[#F7F6F3] px-1 rounded">Authorization: Bearer sk_live_…</code> with every request. Success returns <code className="font-mono bg-[#F7F6F3] px-1 rounded">{'{ data }'}</code>; errors return <code className="font-mono bg-[#F7F6F3] px-1 rounded">{'{ error: { code, message } }'}</code>. Rate limit: 600 requests/minute per key (X-RateLimit headers included).</p>
          <div className="rounded-lg border border-[#EFEEE9] divide-y divide-[#EFEEE9]">
            {API_ENDPOINTS.map(endpoint => (
              <div key={`${endpoint.method} ${endpoint.path}`} className="p-2.5">
                <p className="text-xs font-mono"><span className={endpoint.method === "GET" ? "text-emerald-700" : endpoint.method === "POST" ? "text-[#D4922A]" : "text-blue-700"}>{endpoint.method}</span> <span className="text-[#1A1A1A]">{endpoint.path}</span></p>
                <p className="text-[11px] text-[#6B6B6B] mt-0.5">{endpoint.description}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#6B6B6B] rounded-lg bg-[#F7F6F3] p-2.5"><strong className="text-[#1A1A1A]">Connect Zapier or Make:</strong> create a key above, then use it in a "Webhooks by Zapier" step (or Make's HTTP module) with the Bearer header. Example: PATCH <code className="font-mono">/api/v1/jobs/:id</code> to move a job along your pipeline whenever a trigger fires.</p>
        </>
      )}
    </div>
  );
}

// ─── Audit Log Section ────────────────────────────────────────────────────────
function AuditLogSection() {
  const { data: logs, isLoading } = trpc.auditLog.list.useQuery({ limit: 20, offset: 0 }, { retry: 1 });
  return (
    <div className="bg-white rounded-xl border border-[#DDDBD7] p-6 space-y-4">
      <h3 className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2"><Activity className="w-4 h-4 text-[#D4922A]" />Activity Log</h3>
      <p className="text-xs text-[#6B6B6B]">A record of your recent account activity.</p>
      {isLoading ? <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div> : !logs || logs.length === 0 ? (
        <p className="text-xs text-[#6B6B6B]">No activity recorded yet.</p>
      ) : (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {logs.map(log => (
            <div key={log.id} className="flex items-start gap-3 py-2 border-b border-[#EEECEA] last:border-0">
              <div className="w-1.5 h-1.5 rounded-full bg-[#D4922A] mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#1A1A1A]">{log.action.replace(/\./g, ' › ')}</p>
                {log.details && <p className="text-xs text-[#6B6B6B] truncate">{log.details}</p>}
              </div>
              <p className="text-xs text-[#6B6B6B] shrink-0">{new Date(log.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsPanel() {
  const [feedConfirm, setFeedConfirm] = useState<"rotate" | "revoke" | null>(null);
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { data: settings, isLoading } = trpc.settings.get.useQuery(undefined, { retry: 1 });
  const { data: calendarFeedStatus } = trpc.calendarFeed.status.useQuery();
  const [issuedCalendarFeedUrl, setIssuedCalendarFeedUrl] = useState<string | null>(null);
  const createCalendarFeed = trpc.calendarFeed.create.useMutation({
    onSuccess: ({ feedUrl }) => {
      setIssuedCalendarFeedUrl(feedUrl);
      void utils.calendarFeed.status.invalidate();
      toast.success("Private calendar feed created. Copy the URL now.");
    },
    onError: (error) => toast.error(error.message),
  });
  const rotateCalendarFeed = trpc.calendarFeed.rotate.useMutation({
    onSuccess: ({ feedUrl }) => {
      setIssuedCalendarFeedUrl(feedUrl);
      void utils.calendarFeed.status.invalidate();
      toast.success("Private calendar feed rotated. The previous URL no longer works.");
    },
    onError: (error) => toast.error(error.message),
  });
  const revokeCalendarFeed = trpc.calendarFeed.revoke.useMutation({
    onSuccess: () => {
      setIssuedCalendarFeedUrl(null);
      void utils.calendarFeed.status.invalidate();
      toast.success("Private calendar feed revoked.");
    },
    onError: (error) => toast.error(error.message),
  });
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
  const [bookingPage, setBookingPage] = useState({
    bookingUsername: "",
    bookingBio: "",
    bookingServices: ["Coaching Session", "Strategy Call", "Consultation"].map(name => ({ name, durationMinutes: 60, active: true, priceGuidance: null, depositAmountCents: null })) as PublicBookingService[],
    bookingAvailability: { weekdays: [...DEFAULT_PUBLIC_BOOKING_SCHEDULE.weekdays], timeSlots: [...DEFAULT_PUBLIC_BOOKING_SCHEDULE.timeSlots], bufferMinutes: DEFAULT_PUBLIC_BOOKING_SCHEDULE.bufferMinutes },
  });
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
      setBookingPage({
        bookingUsername: settings.bookingUsername || "",
        bookingBio: settings.bookingBio || "",
        bookingServices: getPublishedBookingServiceCatalog(JSON.stringify(settings.bookingServices || ["Coaching Session", "Strategy Call", "Consultation"])),
        bookingAvailability: settings.bookingAvailability || { weekdays: [...DEFAULT_PUBLIC_BOOKING_SCHEDULE.weekdays], timeSlots: [...DEFAULT_PUBLIC_BOOKING_SCHEDULE.timeSlots], bufferMinutes: DEFAULT_PUBLIC_BOOKING_SCHEDULE.bufferMinutes },
      });
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
        <h2 className="text-xl font-extrabold text-[#1A1A1A]">Settings</h2>
        <p className="text-sm text-[#6B6B6B]">Manage your profile, business info, and preferences</p>
      </div>

      {/* Profile */}
      <div className="bg-white rounded-xl border border-[#DDDBD7] p-6 space-y-4">
        <h3 className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2"><User className="w-4 h-4 text-[#D4922A]" />Profile</h3>

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
            <p className="text-sm font-semibold text-[#1A1A1A] mb-0.5">Profile Photo</p>
            <p className="text-xs text-[#6B6B6B] mb-2">JPEG, PNG, WebP or GIF · Max 5 MB</p>
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
                  <span className="text-[#6B6B6B]">·</span>
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
      <div className="bg-white rounded-xl border border-[#DDDBD7] p-6 space-y-4">
        <h3 className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2"><Building className="w-4 h-4 text-[#D4922A]" />Business Info</h3>
        <Field label="Business Name" value={business.businessName} onChange={setBusinessName} placeholder="My Coaching Studio" autoComplete="organization" enterKeyHint="next" />
        <Field label="Business Phone" value={business.businessPhone} onChange={setBusinessPhone} placeholder="+1 (555) 000-0000" type="tel" autoComplete="tel" enterKeyHint="next" />
        <Field label="Business Address" value={business.businessAddress} onChange={setBusinessAddress} placeholder="123 Main St, New York, NY 10001" autoComplete="street-address" enterKeyHint="next" />
        <Field label="Website" value={business.businessWebsite} onChange={setBusinessWebsite} placeholder="https://yourwebsite.com" type="url" autoComplete="url" enterKeyHint="done" />
        <Button className="gradient-amber text-white border-0 hover:opacity-90 gap-2" onClick={() => updateBusiness.mutate(business)} disabled={updateBusiness.isPending}>
          {updateBusiness.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Save Business Info</>}
        </Button>
      </div>

      {/* Booking Page */}
      <div className="bg-white rounded-xl border border-[#DDDBD7] p-6 space-y-4">
        <h3 className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2"><Globe className="w-4 h-4 text-[#D4922A]" />Booking Page</h3>
        <div>
          <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Your Booking URL</label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm text-[#6B6B6B] flex-shrink-0 truncate max-w-full">{window.location.origin}/book/</span>
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
              <div className="flex items-center gap-2 bg-[#F7F6F3] rounded-xl px-3 py-2 border border-[#DDDBD7] min-w-0">
                <span className="text-xs text-[#6B6B6B] flex-1 truncate font-mono min-w-0">{bookingUrl}</span>
                <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="text-[#6B6B6B] hover:text-[#D4922A] transition-colors flex-shrink-0" title="Preview booking page">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <CopyBookingLinkButton url={bookingUrl} />
            </div>
          )}
        </div>
        <Field label="Booking Page Bio" value={bookingPage.bookingBio} onChange={setBookingBio} placeholder="Book a session with me..." textarea rows={2} enterKeyHint="done" />
        <div>
          <label className="block text-xs font-semibold text-[#6B6B6B] mb-2">Services Offered</label>
          <div className="space-y-2 mb-3">
            {bookingPage.bookingServices.map((s, i) => (
              <div key={i} className="flex items-center gap-2 bg-[#F7F6F3] rounded-xl px-3 py-2">
                <span className={`text-sm flex-1 ${s.active ? "" : "text-[#8A8882] line-through"}`}>{s.name}</span>
                <select value={s.durationMinutes} onChange={e => setBookingPage(p => ({ ...p, bookingServices: p.bookingServices.map((service, j) => j === i ? { ...service, durationMinutes: Number(e.target.value) } : service) }))} className="form-input-light w-24 text-xs" aria-label={`${s.name} duration`}>
                  {[30, 45, 60, 90, 120, 180, 240].map(minutes => <option key={minutes} value={minutes}>{minutes} min</option>)}
                </select>
                <input value={s.priceGuidance ?? ""} onChange={e => setBookingPage(p => ({ ...p, bookingServices: p.bookingServices.map((service, j) => j === i ? { ...service, priceGuidance: e.target.value.trim() || null } : service) }))} className="form-input-light w-28 text-xs" placeholder="Price note" maxLength={120} aria-label={`${s.name} price guidance`} />
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={s.depositAmountCents ? s.depositAmountCents / 100 : ""}
                  onChange={e => {
                    const dollars = Number(e.target.value);
                    const cents = Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : null;
                    setBookingPage(p => ({ ...p, bookingServices: p.bookingServices.map((service, j) => j === i ? { ...service, depositAmountCents: cents && cents >= 50 ? cents : null } : service) }));
                  }}
                  className="form-input-light w-24 text-xs"
                  placeholder="Deposit $"
                  aria-label={`${s.name} booking deposit in dollars`}
                />
                <button type="button" onClick={() => setBookingPage(p => ({ ...p, bookingServices: p.bookingServices.map((service, j) => j === i ? { ...service, active: !service.active } : service) }))} className="text-xs font-semibold text-[#D4922A]" aria-pressed={s.active}>{s.active ? "Live" : "Hidden"}</button>
                <button onClick={() => setBookingPage(p => ({ ...p, bookingServices: p.bookingServices.filter((_, j) => j !== i) }))} className="text-[#6B6B6B] hover:text-red-500 transition-colors" aria-label={`Remove ${s.name}`}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mb-2">
            <input value={newService} onChange={e => setNewService(e.target.value)} placeholder="Type a custom service..." className="form-input-light" autoComplete="off" enterKeyHint="done" onKeyDown={e => { if (e.key === "Enter" && newService.trim()) { setBookingPage(p => ({ ...p, bookingServices: [...p.bookingServices, { name: newService.trim(), durationMinutes: 60, active: true, priceGuidance: null, depositAmountCents: null }] })); setNewService(""); } }} />
            <Button size="sm" variant="outline" onClick={() => { if (newService.trim()) { setBookingPage(p => ({ ...p, bookingServices: [...p.bookingServices, { name: newService.trim(), durationMinutes: 60, active: true, priceGuidance: null, depositAmountCents: null }] })); setNewService(""); } }}>
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
            <div className="flex flex-wrap gap-1.5 p-3 bg-[#F7F6F3] rounded-xl border border-[#DDDBD7] max-h-48 overflow-y-auto">
              {PRESET_SERVICES.filter(s => !bookingPage.bookingServices.some(service => service.name === s)).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setBookingPage(p => ({ ...p, bookingServices: [...p.bookingServices, { name: s, durationMinutes: 60, active: true, priceGuidance: null, depositAmountCents: null }] }))}
                  className="text-xs bg-white border border-[#DDDBD7] hover:border-[#D4922A] hover:text-[#D4922A] text-[#6B6B6B] rounded-full px-2.5 py-1 transition-colors"
                >
                  + {s}
                </button>
              ))}
              {PRESET_SERVICES.filter(s => !bookingPage.bookingServices.some(service => service.name === s)).length === 0 && (
                <p className="text-xs text-[#6B6B6B]">All preset services added!</p>
              )}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-[#DDDBD7] bg-[#F7F6F3] p-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#6B6B6B] mb-1">Published booking availability</label>
            <p className="text-xs text-[#6B6B6B]">Choose the weekdays and half-hour times shown on your public booking page. At least one day and one time must remain selected. This is not calendar synchronization or time-zone conversion.</p>
          </div>
          <fieldset>
            <legend className="text-xs font-semibold text-[#6B6B6B] mb-2">Available days</legend>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Published booking days">
              {[
                { id: 1, label: "Mon" }, { id: 2, label: "Tue" }, { id: 3, label: "Wed" }, { id: 4, label: "Thu" }, { id: 5, label: "Fri" }, { id: 6, label: "Sat" }, { id: 0, label: "Sun" },
              ].map(day => {
                const selected = bookingPage.bookingAvailability.weekdays.includes(day.id);
                return <button
                  key={day.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setBookingPage(p => {
                    const current = p.bookingAvailability.weekdays;
                    const weekdays = selected ? (current.length === 1 ? current : current.filter(value => value !== day.id)) : [...current, day.id].sort((a, b) => a - b);
                    return { ...p, bookingAvailability: { ...p.bookingAvailability, weekdays } };
                  })}
                  className={`min-h-[36px] rounded-lg border px-3 text-xs font-semibold transition-colors ${selected ? "border-[#D4922A] bg-[#D4922A]/15 text-[#8A5A0B]" : "border-[#C8C5BF] bg-white text-[#6B6B6B] hover:border-[#D4922A]/60"}`}
                >{day.label}</button>;
              })}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-xs font-semibold text-[#6B6B6B] mb-2">Available times</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="group" aria-label="Published booking times">
              {PUBLIC_BOOKING_TIME_SLOTS.map(time => {
                const selected = bookingPage.bookingAvailability.timeSlots.includes(time);
                return <button
                  key={time}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setBookingPage(p => {
                    const current = p.bookingAvailability.timeSlots;
                    const timeSlots = selected ? (current.length === 1 ? current : current.filter(value => value !== time)) : PUBLIC_BOOKING_TIME_SLOTS.filter(value => current.includes(value) || value === time);
                    return { ...p, bookingAvailability: { ...p.bookingAvailability, timeSlots } };
                  })}
                  className={`min-h-[36px] rounded-lg border px-2 text-xs font-semibold transition-colors ${selected ? "border-[#D4922A] bg-[#D4922A]/15 text-[#8A5A0B]" : "border-[#C8C5BF] bg-white text-[#6B6B6B] hover:border-[#D4922A]/60"}`}
                >{time}</button>;
              })}
            </div>
          </fieldset>
          <div className="flex items-center justify-between gap-3 border-t border-[#DDDBD7] pt-4">
            <div>
              <p className="text-sm font-semibold text-[#1A1A1A]">Appointment buffer</p>
              <p className="text-xs text-[#6B6B6B]">Reserve time after appointments when checking public availability.</p>
            </div>
            <select value={bookingPage.bookingAvailability.bufferMinutes} onChange={e => setBookingPage(p => ({ ...p, bookingAvailability: { ...p.bookingAvailability, bufferMinutes: Number(e.target.value) } }))} className="form-input-light w-28 text-sm" aria-label="Appointment buffer">
              {[0, 15, 30, 45, 60, 90, 120].map(minutes => <option key={minutes} value={minutes}>{minutes === 0 ? "No buffer" : `${minutes} min`}</option>)}
            </select>
          </div>
        </div>
        <Button className="gradient-amber text-white border-0 hover:opacity-90 gap-2" onClick={() => updateBookingPage.mutate(bookingPage)} disabled={updateBookingPage.isPending}>
          {updateBookingPage.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Save Booking Page</>}
        </Button>
      </div>

      {/* iCal Feed */}
      <div className="space-y-3 p-5 bg-white rounded-xl border border-[#DDDBD7]">
        <h3 className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2"><Calendar className="w-4 h-4 text-[#D4922A]" />Calendar Sync (iCal)</h3>
        <p className="text-xs text-[#6B6B6B]">Create a private, revocable subscription URL for Google Calendar, Apple Calendar, or Outlook. It contains service-level schedule details only, so treat it like a password.</p>
        {issuedCalendarFeedUrl ? (
          <div className="flex items-center gap-2 bg-[#F7F6F3] rounded-xl px-3 py-2 border border-[#DDDBD7] min-w-0">
            <span className="text-xs text-[#6B6B6B] flex-1 truncate font-mono min-w-0">{issuedCalendarFeedUrl}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(issuedCalendarFeedUrl).then(() => toast.success("Private iCal URL copied.")).catch(() => toast.info("Copy the private feed URL shown above."));
              }}
              className="text-[#6B6B6B] hover:text-[#D4922A] transition-colors flex-shrink-0 p-2 rounded hover:bg-[#D4922A]/10"
              title="Copy private iCal feed URL"
              aria-label="Copy private iCal feed URL"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <a href={issuedCalendarFeedUrl} download className="text-[#6B6B6B] hover:text-[#D4922A] transition-colors flex-shrink-0 p-2 rounded hover:bg-[#D4922A]/10" title="Download .ics file" aria-label="Download private iCal file">
              <Download className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : (
          <p className="text-xs text-[#6B6B6B]">{calendarFeedStatus?.active ? "An active private feed exists. Rotate it to receive a replacement URL; the existing secret is not shown again." : "No active private feed exists yet."}</p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {!calendarFeedStatus?.active ? (
            <Button type="button" size="sm" className="gradient-amber text-white border-0" onClick={() => createCalendarFeed.mutate({ origin: window.location.origin })} disabled={createCalendarFeed.isPending}>
              {createCalendarFeed.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Calendar className="mr-1 h-3.5 w-3.5" />}Create private feed
            </Button>
          ) : (
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => setFeedConfirm("rotate")} disabled={rotateCalendarFeed.isPending}>
                {rotateCalendarFeed.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}Rotate URL
              </Button>
              <Button type="button" size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => setFeedConfirm("revoke")} disabled={revokeCalendarFeed.isPending}>
                {revokeCalendarFeed.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}Revoke feed
              </Button>
            </>
          )}
        </div>
        {issuedCalendarFeedUrl && (
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <a
              href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(issuedCalendarFeedUrl.replace(/^https?:/, "webcal:"))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-500/15 text-blue-400 text-xs font-semibold transition-colors border border-blue-500/20"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 3h-3V1.5h-1.5V3h-6V1.5H7.5V3h-3C3.675 3 3 3.675 3 4.5v15C3 20.325 3.675 21 4.5 21h15c.825 0 1.5-.675 1.5-1.5v-15c0-.825-.675-1.5-1.5-1.5zm0 16.5h-15V9h15v10.5zM7.5 4.5V6H9V4.5h6V6h1.5V4.5h1.5V7.5h-12V4.5h1.5z"/></svg>
              Add to Google Calendar
            </a>
            <a
              href={issuedCalendarFeedUrl.replace(/^https?:/, "webcal:")}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F7F6F3] hover:bg-[#EEECEA] text-[#6B6B6B] text-xs font-semibold transition-colors border border-[#DDDBD7]"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>
              Subscribe (Apple / Outlook)
            </a>
          </div>
        )}
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-xl border border-[#DDDBD7] p-6 space-y-4">
        <h3 className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2"><Bell className="w-4 h-4 text-[#D4922A]" />Notifications</h3>
        {[
          { key: "notifyNewBooking" as const, label: "New Booking", desc: "Get notified when a client books a session" },
          { key: "notifyInvoicePaid" as const, label: "Invoice Paid", desc: "Get notified when an invoice is marked as paid" },
          { key: "notifyNewLead" as const, label: "New Lead", desc: "Get notified when someone joins the waitlist" },
        ].map(n => (
          <div key={n.key} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1A1A1A]">{n.label}</p>
              <p className="text-xs text-[#6B6B6B]">{n.desc}</p>
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
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${notifications[n.key] ? "translate-x-5" : "translate-x-0"}`}
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

      {/* Two-Factor Authentication */}
      <TwoFactorSection />

      {/* Active Sessions */}
      <SessionsSection />

      {/* Billing & Subscription — inline */}
      <BillingSection />

      {/* API Keys */}
      <ApiKeysSection />

      {/* Audit Log */}
      <AuditLogSection />

      {/* Integrations */}
      <IntegrationsSection />

      <ConfirmDialog
        open={feedConfirm !== null}
        onOpenChange={(open) => { if (!open) setFeedConfirm(null); }}
        title={feedConfirm === "rotate" ? "Rotate feed URL?" : "Revoke this feed?"}
        description={feedConfirm === "rotate" ? "Rotating invalidates the previous subscription URL." : "Revoking stops every app using this subscription URL."}
        confirmLabel={feedConfirm === "rotate" ? "Rotate URL" : "Revoke feed"}
        onConfirm={() => { const action = feedConfirm; setFeedConfirm(null); if (action === "rotate") rotateCalendarFeed.mutate({ origin: window.location.origin }); else if (action === "revoke") revokeCalendarFeed.mutate(); }}
      />
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
  const calendarSetupRequired = !calStatus?.connected && calAuthData?.status === "setup_required";
  const disconnectCal = trpc.googleCal.disconnect.useMutation({
    onSuccess: () => { utils.googleCal.status.invalidate(); toast.success("Google Calendar disconnected."); },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const [connectionResult, setConnectionResult] = useState<ConnectionTestResult | null>(null);
  const testConnections = trpc.system.testConnections.useMutation({
    onSuccess: (result) => {
      setConnectionResult(result);
      const smtpOk = !result.smtp.configured || result.smtp.verified;
      const stripeOk = !result.stripe.configured || result.stripe.verified;
      if (smtpOk && stripeOk) toast.success("Connection test complete — all configured providers are live.");
      else toast.error("Connection test found problems. See details below.");
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const { data: monthlyStatus, isLoading: monthlyStatusLoading } = trpc.reportSettings.status.useQuery();
  const monthlyEnabled = monthlyStatus?.enabled ?? false;
  const toggleMonthly = trpc.reportSettings.toggle.useMutation({
    onSuccess: (result) => {
      utils.reportSettings.status.setData(undefined, { enabled: result.enabled });
      toast.success("Preferences saved!");
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  return (
    <div className="bg-white rounded-xl border border-[#DDDBD7] p-6 space-y-5">
      <h3 className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2">
        <Zap className="w-4 h-4 text-[#D4922A]" />Integrations & Automation
      </h3>

      {/* Google Calendar */}
      <div className="flex items-center justify-between gap-4 py-3 border-b border-[#DDDBD7]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1A1A1A]">Google Calendar</p>
            <p className="text-xs text-[#6B6B6B]">
              {calStatus?.connected
                ? calStatus.syncEnabled
                  ? "Connected · Google Calendar synchronization is enabled"
                  : "Connected · Google Calendar synchronization is paused"
                : calendarSetupRequired
                  ? "Owner setup is required before Google authorization can begin."
                  : "Connect booking events to your Google Calendar"}
            </p>
          </div>
        </div>
        {calStatus?.connected ? (
          <Button size="sm" variant="outline" className="border-red-200 text-red-500 hover:bg-red-500/100/10" onClick={() => disconnectCal.mutate()} disabled={disconnectCal.isPending}>
            {disconnectCal.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Disconnect"}
          </Button>
        ) : (
          <Button size="sm" className="gradient-amber text-white border-0 hover:opacity-90" onClick={() => { if (calAuthData?.url) window.open(calAuthData.url, "_blank", "noopener"); }} disabled={!calAuthData?.url} title={calendarSetupRequired ? "Google Calendar setup is required before authorization." : undefined}>
            {calendarSetupRequired ? "Setup required" : "Connect"}
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
            <p className="text-sm font-semibold text-[#1A1A1A]">Monthly Business Report</p>
            <p className="text-xs text-[#6B6B6B]">When enabled, this prepares a report on the 1st. It is marked sent only after configured SMTP acceptance.</p>
          </div>
        </div>
        <button
          onClick={() => toggleMonthly.mutate({ enabled: !monthlyEnabled })}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4922A] ${
            monthlyEnabled ? "bg-[#D4922A]" : "bg-gray-200"
          }`}
          role="switch"
          aria-checked={monthlyEnabled}
          aria-label="Toggle monthly business report email"
          type="button"
          disabled={monthlyStatusLoading || toggleMonthly.isPending}
        >
          <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            monthlyEnabled ? "translate-x-5" : "translate-x-0"
          }`} />
        </button>
      </div>

      {/* Live provider connection test (SMTP + Stripe) */}
      <div className="pt-3 border-t border-[#DDDBD7] space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Webhook className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1A1A1A]">Email &amp; Payments check</p>
              <p className="text-xs text-[#6B6B6B]">Runs a live SMTP handshake and Stripe account ping so you can validate credentials in one click.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {connectionResult?.smtp.verified === true && connectionResult.smtp.testEmailSent !== true && (
              <Button size="sm" variant="outline" onClick={() => testConnections.mutate({ sendTestEmail: true })} disabled={testConnections.isPending}>
                Send test email
              </Button>
            )}
            <Button size="sm" onClick={() => testConnections.mutate({ sendTestEmail: false })} disabled={testConnections.isPending}>
              {testConnections.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Run connection test"}
            </Button>
          </div>
        </div>
        {connectionResult && (
          <div className="rounded-xl border border-[#DDDBD7] bg-[#F7F6F3] p-4 space-y-2" aria-live="polite">
            <p className="text-xs font-bold uppercase tracking-wide text-[#6B6B6B]">Last check results</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <ConnectionCheckCard label="Email (SMTP)" entry={connectionResult.smtp} />
              <ConnectionCheckCard label="Payments (Stripe)" entry={connectionResult.stripe} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ConnectionCheckCardEntry {
  configured: boolean;
  verified: boolean;
  latencyMs?: number | null;
  errorKind?: string | null;
  errorDetail?: string | null;
  issues?: string[];
  testEmailSent?: boolean;
}

interface ConnectionTestResult {
  smtp: ConnectionCheckCardEntry & { issues: string[]; testEmailSent: boolean };
  stripe: ConnectionCheckCardEntry;
}

const CONNECTION_ERROR_HINTS: Record<string, string> = {
  auth: "Credentials rejected — double-check the username and password/app key.",
  connectivity: "Could not reach the server — check the host and port.",
  tls: "TLS negotiation failed — verify the port (587 vs 465) and certificates.",
  timeout: "No response in time — the provider may be down or blocking this server.",
  unknown: "The provider rejected the request.",
};

function ConnectionCheckCard({ label, entry }: { label: string; entry: ConnectionCheckCardEntry }) {
  const status = !entry.configured
    ? { text: "Not configured", tone: "text-[#6B6B6B] bg-[#EEECEA]" }
    : entry.verified
      ? { text: "Live", tone: "text-green-600 bg-green-500/10" }
      : { text: "Failed", tone: "text-red-500 bg-red-500/10" };
  return (
    <div className="rounded-lg bg-white border border-[#DDDBD7] p-3">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-semibold text-[#1A1A1A]">{label}</p>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${status.tone}`}>{status.text}</span>
      </div>
      {entry.configured && (
        <p className="text-[11px] text-[#6B6B6B]">
          {entry.verified
            ? `Authenticated${entry.latencyMs != null ? ` in ${entry.latencyMs}ms` : ""}${entry.testEmailSent ? " · test email sent to your inbox" : ""}`
            : CONNECTION_ERROR_HINTS[entry.errorKind ?? "unknown"] ?? CONNECTION_ERROR_HINTS.unknown}
        </p>
      )}
      {!entry.configured && entry.issues && entry.issues.length > 0 && (
        <p className="text-[11px] text-[#6B6B6B]">Add {entry.issues.length > 1 ? "the missing settings" : "the missing setting"} to enable live delivery.</p>
      )}
      {entry.verified !== true && entry.errorDetail && (
        <p className="text-[11px] text-[#6B6B6B] mt-1 break-words">{entry.errorDetail}</p>
      )}
    </div>
  );
}


export { SettingsPanel };
