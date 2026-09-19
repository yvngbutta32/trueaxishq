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

type ActivePanel = "overview" | "executive" | "launch" | "clients" | "scheduling" | "jobs" | "team" | "dispatch" | "field" | "integrations" | "webhooks" | "invoices" | "followups" | "analytics" | "settings" | "ai" | "pulse" | "contracts" | "time" | "inbox" | "testimonials" | "services" | "expenses" | "proposals" | "automations" | "billing" | "outreach" | "deals" | "insights" | "photos" | "inventory" | "reports" | "import";

interface ConfirmState {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
}
const defaultConfirm: ConfirmState = { open: false, title: "", description: "", onConfirm: () => {} };
const LEGACY_PANEL_REDIRECTS: Partial<Record<ActivePanel, ActivePanel>> = {
  invoices: "billing",
  followups: "outreach",
  analytics: "insights",
  pulse: "insights",
  contracts: "deals",
  time: "billing",
  inbox: "outreach",
  testimonials: "clients",
  services: "billing",
  expenses: "insights",
  proposals: "deals",
  automations: "outreach",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatCurrency(n: number | string | null | undefined) {
  const val = parseFloat(String(n ?? 0));
  return `$${(isNaN(val) ? 0 : val).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
// Normalize booking date strings: ISO "2026-08-01" → "Aug 1, 2026", already-formatted strings pass through
function formatBookingDate(d: string): string {
  if (!d) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  return d;
}
// Normalize booking time strings: 24h "14:00" → "2:00 PM", 12h strings pass through
function formatBookingTime(t: string): string {
  if (!t) return "—";
  const m24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    let h = parseInt(m24[1], 10);
    const min = m24[2];
    const ampm = h >= 12 ? "PM" : "AM";
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${h}:${min} ${ampm}`;
  }
  return t;
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
  const titleId = useRef(`dashboard-modal-title-${Math.random().toString(36).slice(2)}`).current;
  // Keep a ref so the keydown handler always calls the latest onClose without
  // being listed as a dependency — this prevents the effect from re-running
  // (and stealing focus from inputs) every time the parent re-renders and
  // passes a new inline arrow function as onClose.
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !ref.current) return;
      const focusable = Array.from(ref.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter(element => !element.hasAttribute("hidden"));
      if (!focusable.length) {
        e.preventDefault();
        ref.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    // Focus the modal backdrop only on initial open, not on every re-render.
    // requestAnimationFrame defers until after paint so the modal is visible.
    const raf = requestAnimationFrame(() => { ref.current?.focus(); });
    return () => { document.removeEventListener("keydown", handleKey); cancelAnimationFrame(raf); };
   
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        tabIndex={-1}
        className={`relative bg-white rounded-xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[90vh] overflow-y-auto outline-none`}
      >
        <div className="flex items-center justify-between p-5 border-b border-[#DDDBD7]">
          <h2 id={titleId} className="font-bold text-[#1A1A1A] text-base">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#EEECEA] transition-colors" aria-label="Close dialog">
            <X className="w-4 h-4 text-[#6B6B6B]" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
// ─── Input Field ─────────────────────────────────────────────────────────────────────────────────
// Memoized to prevent re-renders when parent state changes unrelated to this field
const Field = memo(function Field({ label, value, onChange, placeholder, type = "text", required, textarea, rows = 3, autoComplete, enterKeyHint, maxLen }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean; textarea?: boolean; rows?: number;
  autoComplete?: string; enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
  maxLen?: number;
}) {
  const cls = "form-input-light";
  const taRef = useRef<HTMLTextAreaElement>(null);
  const controlId = useId();

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
      <label htmlFor={controlId} className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">{label}{required && " *"}</label>
      {textarea
        ? <textarea
            id={controlId}
            ref={taRef}
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            rows={rows}
            maxLength={maxLen}
            className={`${cls} resize-none overflow-hidden`}
            style={{ minHeight: `${(rows ?? 3) * 1.6}rem` }}
            enterKeyHint={enterKeyHint}
            autoComplete={autoComplete ?? "off"}
            autoCorrect="off"
            spellCheck={false}
          />
        : <input
            id={controlId}
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

export { Field, FREQUENCY_LABELS, FREQUENCY_COLORS, defaultConfirm, LEGACY_PANEL_REDIRECTS, getGreeting, formatCurrency, formatDate, formatBookingDate, formatBookingTime, Skeleton, Modal, useFormField, LineItemRow };
export type { ActivePanel, ConfirmState, LineItem };
