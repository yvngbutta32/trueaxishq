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
    rejected: "bg-[#EEECEA] text-[#3D3D3D]",
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#1A1A1A]">Testimonials</h2>
          <p className="text-sm text-[#3D3D3D] mt-0.5">Request, review, and publish client testimonials</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {(["pending", "approved", "rejected", "request"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all ${
              tab === t ? "bg-[#D4922A] text-white" : "bg-white border border-[#DDDBD7] text-[#6B6B6B] hover:border-[#D4922A]"
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
        <div className="bg-white rounded-xl border border-[#DDDBD7] p-6 space-y-4 max-w-lg">
          <h3 className="font-semibold text-[#1A1A1A]">Send Testimonial Request</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Client Name *</label>
              <input value={form.clientName} onChange={e => setTestiClientName(e.target.value)}
                placeholder="Jane Smith" className="form-input-light" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Client Email *</label>
              <input type="email" maxLength={320} value={form.clientEmail} onChange={e => setTestiClientEmail(e.target.value)}
                placeholder="jane@example.com" className="form-input-light" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Service Name</label>
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
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ThumbsUp className="w-12 h-12 text-[#6B6B6B] mx-auto mb-3" />
          <p className="text-[#3D3D3D] font-medium">No {tab} testimonials yet</p>
          <p className="text-sm text-[#3D3D3D] mt-1">Use the "+ New Request" tab to ask clients for reviews</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-[#DDDBD7] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-[#1A1A1A] text-sm">{t.clientName}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${statusColors[t.status] ?? "bg-[#EEECEA] text-[#3D3D3D]"}`}>{t.status}</span>
                  </div>
                  {t.rating && (
                    <div className="flex gap-0.5 mb-1.5">
                      {[1,2,3,4,5].map(s => <Star key={s} className={`w-3.5 h-3.5 ${s <= t.rating! ? "fill-[#D4922A] text-[#D4922A]" : "text-[#6B6B6B]"}`} />)}
                    </div>
                  )}
                  {t.body && <p className="text-sm text-[#6B6B6B] line-clamp-3">"{t.body}"</p>}
                  {!t.body && <p className="text-xs text-[#3D3D3D] italic">Awaiting response…</p>}
                  <p className="text-[10px] text-[#3D3D3D] mt-1.5">{new Date(t.createdAt).toLocaleDateString()}</p>
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


export { TestimonialsPanel };
