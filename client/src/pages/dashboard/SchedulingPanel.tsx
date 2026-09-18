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

// ─── Scheduling Panel ─────────────────────────────────────────────────────────
function SchedulingPanel() {
  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ clientName: "", clientEmail: "", service: "", date: "", time: "", duration: 60, notes: "" });
  const setSchedFormField = useFormFields(setForm);
  const setSchedClientName  = setSchedFormField("clientName");
  const setSchedClientEmail = setSchedFormField("clientEmail");
  const setSchedService     = setSchedFormField("service");
  const setSchedDate        = setSchedFormField("date");
  const setSchedTime        = setSchedFormField("time");
  const setSchedNotes       = setSchedFormField("notes");
  const [schedConfirm, setSchedConfirm] = useState<ConfirmState>(defaultConfirm);
  const [smartSuggestions, setSmartSuggestions] = useState<{ date: string; time: string; reason: string }[]>([]);

  const smartSchedule = trpc.ai.smartSchedule.useMutation({
    onSuccess: (data) => {
      setSmartSuggestions(data.suggestions);
      if (data.suggestions.length > 0) toast.success("AI found 3 optimal time slots!");
      else toast.info("No suggestions available. Please enter a date manually.");
    },
    onError: () => toast.error("AI scheduling unavailable. Please set a date manually."),
  });

  const { data: bookingList, isLoading } = trpc.bookings.list.useQuery({ status: "all" });
  const { data: clientList } = trpc.clients.list.useQuery({ search: "", status: "all" });

  const createBooking = trpc.bookings.create.useMutation({
    onSuccess: () => { utils.bookings.list.invalidate(); toast.success("Booking confirmed!"); setShowAdd(false); setForm({ clientName: "", clientEmail: "", service: "", date: "", time: "", duration: 60, notes: "" }); },
    onError: (e) => toast.error(e.message),
  });
  const updateStatus = trpc.bookings.updateStatus.useMutation({
    onSuccess: () => { utils.bookings.list.invalidate(); toast.success("Status updated."); },
    onError: (e) => toast.error(e.message),
  });
  const deleteBooking = trpc.bookings.delete.useMutation({
    onSuccess: () => { utils.bookings.list.invalidate(); toast.success("Booking removed."); },
    onError: (e) => toast.error(e.message),
  });

  const statusColor: Record<string, string> = {
    scheduled: "bg-green-500/10 text-green-600",
    completed: "bg-blue-50 text-blue-600",
    cancelled: "bg-red-500/10 text-red-500",
    no_show: "bg-[#EEECEA] text-[#6B6B6B]",
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#1A1A1A]">Scheduling</h2>
          <p className="text-sm text-[#6B6B6B]">{bookingList?.filter(b => b.status === "scheduled").length || 0} upcoming sessions</p>
        </div>
        <Button size="sm" className="gradient-amber text-white border-0 hover:opacity-90 gap-1.5" onClick={() => setShowAdd(true)}>
          <Plus className="w-3.5 h-3.5" />New Booking
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-[#DDDBD7] overflow-hidden">
        <div className="hidden sm:grid grid-cols-5 gap-4 px-5 py-3 bg-[#F7F6F3] text-xs font-semibold text-[#6B6B6B] uppercase tracking-wide">
          <span className="col-span-2">Client / Service</span>
          <span>Date & Time</span>
          <span>Duration</span>
          <span>Status</span>
        </div>
        {isLoading ? (
          <div className="space-y-px">{[...Array(3)].map((_, i) => <div key={i} className="px-5 py-4 border-t border-[#EEECEA]"><Skeleton className="h-10" /></div>)}</div>
        ) : !bookingList || bookingList.length === 0 ? (
          <div className="text-center py-16 text-[#6B6B6B]">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium text-[#6B6B6B]">No bookings yet</p>
            <p className="text-xs mt-1">Create your first booking or share your booking page with clients.</p>
          </div>
        ) : bookingList.map(b => (
          <div key={b.id} className="flex flex-col sm:grid sm:grid-cols-5 gap-2 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 border-t border-[#EEECEA] hover:bg-[#F7F6F3] transition-colors">
            <div className="sm:col-span-2">
              <p className="text-sm font-semibold text-[#1A1A1A]">{b.clientName}</p>
              <p className="text-xs text-[#6B6B6B]">{b.service || "General Session"}</p>
              {b.depositStatus ? (
                <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${b.depositStatus === "paid" ? "bg-green-500/10 text-green-600" : "bg-amber-100 text-amber-700"}`}>
                  {b.depositStatus === "paid" ? "Deposit paid" : "Deposit due"}
                  {b.depositAmountCents ? ` $${(b.depositAmountCents / 100).toFixed(b.depositAmountCents % 100 === 0 ? 0 : 2)}` : ""}
                </span>
              ) : null}
              {/* Mobile-only: show date/time inline */}
              <div className="flex items-center gap-2 mt-0.5 sm:hidden">
                <span className="text-xs text-[#6B6B6B]">{formatBookingDate(b.date)} · {formatBookingTime(b.time)}</span>
                <span className="text-xs text-[#6B6B6B]">{b.duration}m</span>
              </div>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-[#1A1A1A]">{formatBookingDate(b.date)}</p>
              <p className="text-xs text-[#6B6B6B]">{formatBookingTime(b.time)}</p>
            </div>
            <p className="hidden sm:block text-sm text-[#6B6B6B]">{b.duration} min</p>
            <div className="flex items-center justify-between">
              <select
                value={b.status}
                onChange={e => updateStatus.mutate({ id: b.id, status: e.target.value as any })}
                className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${statusColor[b.status] || "bg-[#EEECEA] text-[#6B6B6B]"}`}
                aria-label="Update booking status"
              >
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
              </select>
              <button onClick={() => setSchedConfirm({ open: true, title: "Remove Booking?", description: "Remove this booking? This cannot be undone.", onConfirm: () => deleteBooking.mutate({ id: b.id }) })} className="p-2 rounded-lg hover:bg-red-500/100/10 text-[#3D3D3D] hover:text-red-500 transition-colors ml-2" aria-label="Delete booking">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Booking">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Select Existing Client</label>
            <select
              onChange={e => {
                const parsed = parseInt(e.target.value, 10); const c = !isNaN(parsed) ? clientList?.find(c => c.id === parsed) : undefined;
                if (c) setForm(p => ({ ...p, clientName: c.name, clientEmail: c.email || "", service: c.service || "" }));
              }}
              className="form-input-light"
            >
              <option value="">— Or enter manually below —</option>
              {clientList?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Field label="Client Name" value={form.clientName} onChange={setSchedClientName} placeholder="Jane Smith" required autoComplete="name" enterKeyHint="next" />
          <Field label="Client Email" value={form.clientEmail} onChange={setSchedClientEmail} placeholder="jane@example.com" type="email" autoComplete="email" enterKeyHint="next" />
          <Field label="Service" value={form.service} onChange={setSchedService} placeholder="Strategy Session, Coaching Call..." autoComplete="off" enterKeyHint="next" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date *" value={form.date} onChange={setSchedDate} placeholder="2026-03-20" type="date" required />
            <Field label="Time *" value={form.time} onChange={setSchedTime} placeholder="14:00" type="time" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Duration (minutes)</label>
            <select value={form.duration} onChange={e => setForm(p => ({ ...p, duration: parseInt(e.target.value, 10) || 60 }))} className="form-input-light">
              {[15, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} minutes</option>)}
            </select>
          </div>
          <Field label="Notes" value={form.notes} onChange={setSchedNotes} placeholder="Session goals, preparation notes..." textarea />

          {/* AI Smart Schedule */}
          <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />AI Time Suggestions</p>
              <Button size="sm" variant="outline" className="h-6 text-xs px-2 border-amber-500/30 text-amber-400 hover:bg-amber-100" onClick={() => smartSchedule.mutate({ clientName: form.clientName || "client", service: form.service, notes: form.notes })} disabled={smartSchedule.isPending}>
                {smartSchedule.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Suggest Times"}
              </Button>
            </div>
            {smartSuggestions.length > 0 ? (
              <div className="space-y-1.5">
                {smartSuggestions.map((s, i) => (
                  <button key={i} onClick={() => { setForm(p => ({ ...p, date: s.date, time: s.time })); setSmartSuggestions([]); toast.success("Time slot applied!"); }} className="w-full text-left px-3 py-2 rounded-lg bg-white border border-amber-500/20 hover:border-amber-300 transition-colors">
                    <span className="text-xs font-semibold text-[#1A1A1A]">{s.date} at {s.time}</span>
                    <span className="text-xs text-[#6B6B6B] ml-2">{s.reason}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-amber-600 opacity-70">Click "Suggest Times" to get AI-recommended slots based on your schedule.</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="flex-1 gradient-amber text-white border-0 hover:opacity-90" onClick={() => createBooking.mutate(form)} disabled={createBooking.isPending}>
              {createBooking.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Booking"}
            </Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={schedConfirm.open}
        onOpenChange={(open) => !open && setSchedConfirm(defaultConfirm)}
        title={schedConfirm.title}
        description={schedConfirm.description}
        onConfirm={() => { schedConfirm.onConfirm(); setSchedConfirm(defaultConfirm); }}
        confirmLabel="Remove"
        variant="destructive"
      />
    </div>
  );
}

// ─── Frequency helpers (shared by InvoicesPanel) ────────────────────────────


export { SchedulingPanel };
