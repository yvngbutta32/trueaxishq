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
  Package, Receipt, Smartphone, Rocket, UsersRound, MapPin, PlugZap, Webhook, BookOpen
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
  PieChart, Pie, Cell
} from "recharts";

import { type ActivePanel, type ConfirmState, type LineItem, Field, FREQUENCY_LABELS, FREQUENCY_COLORS, defaultConfirm, LEGACY_PANEL_REDIRECTS, getGreeting, formatCurrency, formatDate, formatBookingDate, formatBookingTime, Skeleton, Modal, useFormField, LineItemRow } from "./shared";

// ─── Invoices Panel ───────────────────────────────────────────────────────────
function InvoicesPanel() {
  const utils = trpc.useUtils();

  // ── Top-level tab: invoices vs recurring ──────────────────────────────────
  const [invTab, setInvTab] = useState<"invoices" | "recurring">("invoices");

  // ── Recurring state ───────────────────────────────────────────────────────
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const defaultRecurringForm = {
    clientId: "",
    clientName: "",
    clientEmail: "",
    description: "",
    amount: "",
    currency: "USD",
    frequency: "monthly" as "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly",
    nextDueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  };
  const [recurringForm, setRecurringForm] = useState(defaultRecurringForm);
  const setRecurringFormField = useFormFields(setRecurringForm);
  const setRecurClientName  = setRecurringFormField("clientName");
  const setRecurClientEmail = setRecurringFormField("clientEmail");
  const setRecurAmount      = setRecurringFormField("amount");
  const setRecurFrequency   = setRecurringFormField("frequency");
  const setRecurNextDueAt   = setRecurringFormField("nextDueAt");
  const setRecurDescription = setRecurringFormField("description");
  const { data: schedules, isLoading: schedulesLoading } = trpc.recurring.list.useQuery(undefined, { retry: 1 });
  const createSchedule = trpc.recurring.create.useMutation({
    onSuccess: () => {
      utils.recurring.list.invalidate();
      toast.success("Recurring schedule created!");
      setShowRecurringForm(false);
      setRecurringForm(defaultRecurringForm);
    },
    onError: (e) => toast.error(e.message),
  });
  const toggleSchedule = trpc.recurring.toggle.useMutation({
    onSuccess: () => utils.recurring.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const deleteScheduleM = trpc.recurring.delete.useMutation({
    onSuccess: () => { utils.recurring.list.invalidate(); toast.success("Schedule deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const activeSchedules = useMemo(() => (schedules ?? []).filter(schedule => schedule.active), [schedules]);
  const activeScheduleCount = activeSchedules.length;
  const estMonthlyRevenue = useMemo(() => activeSchedules.reduce((sum, schedule) => {
    const amount = Number.parseFloat(String(schedule.amount));
    const multiplier = schedule.frequency === "weekly" ? 4.33 : schedule.frequency === "biweekly" ? 2.17 : schedule.frequency === "monthly" ? 1 : schedule.frequency === "quarterly" ? 0.33 : 0.083;
    return sum + (Number.isFinite(amount) ? amount : 0) * multiplier;
  }, 0), [activeSchedules]);

  // ── Invoice state ─────────────────────────────────────────────────────────
  const [showAdd, setShowAdd] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<any>(null);
  const [form, setForm] = useState({ clientName: "", clientEmail: "", service: "", amount: "", dueDate: "", notes: "", status: "draft" as "draft" | "sent" });
  const setInvFormField = useFormFields(setForm);
  // Pre-called stable setters — NEVER call setInvFormField("x") inline in JSX
  // because that creates a new function reference every render, bypassing React.memo
  const setInvClientName  = setInvFormField("clientName");
  const setInvClientEmail = setInvFormField("clientEmail");
  const setInvService     = setInvFormField("service");
  const setInvAmount      = setInvFormField("amount");
  const setInvDueDate     = setInvFormField("dueDate");
  const setInvNotes       = setInvFormField("notes");
  const setInvStatus      = setInvFormField("status");
  const [lineItems, setLineItems] = useState<{ description: string; qty: number; unitPrice: number }[]>([]);
  const [useLineItems, setUseLineItems] = useState(false);
  const lineItemsTotal = lineItems.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  // Edit invoice state
  const [editInvoice, setEditInvoice] = useState<any>(null);
  const [editForm, setEditForm] = useState({ clientName: "", clientEmail: "", service: "", amount: "", dueDate: "", notes: "", status: "draft" as "draft" | "sent" | "paid" | "overdue" });
  const setEditFormField = useFormFields(setEditForm);
  // Pre-called stable setters for edit form
  const setEditClientName  = setEditFormField("clientName");
  const setEditClientEmail = setEditFormField("clientEmail");
  const setEditService     = setEditFormField("service");
  const setEditAmount      = setEditFormField("amount");
  const setEditDueDate     = setEditFormField("dueDate");
  const setEditNotes       = setEditFormField("notes");
  const setEditStatus      = setEditFormField("status");
  const [editLineItems, setEditLineItems] = useState<{ description: string; qty: number; unitPrice: number }[]>([]);
  const [editUseLineItems, setEditUseLineItems] = useState(false);
  const editLineItemsTotal = editLineItems.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  // Stable callbacks for create line items — prevent re-renders of sibling rows
  const handleLineDesc  = useCallback((idx: number, v: string) => setLineItems(p => p.map((it, i) => i === idx ? { ...it, description: v } : it)), []);
  const handleLineQty   = useCallback((idx: number, v: string) => setLineItems(p => p.map((it, i) => i === idx ? { ...it, qty: parseFloat(v) || 1 } : it)), []);
  const handleLinePrice = useCallback((idx: number, v: string) => setLineItems(p => p.map((it, i) => i === idx ? { ...it, unitPrice: parseFloat(v) || 0 } : it)), []);
  const handleLineRemove = useCallback((idx: number) => setLineItems(p => p.filter((_, i) => i !== idx)), []);
  // Stable callbacks for edit line items
  const handleEditLineDesc  = useCallback((idx: number, v: string) => setEditLineItems(p => p.map((it, i) => i === idx ? { ...it, description: v } : it)), []);
  const handleEditLineQty   = useCallback((idx: number, v: string) => setEditLineItems(p => p.map((it, i) => i === idx ? { ...it, qty: parseFloat(v) || 1 } : it)), []);
  const handleEditLinePrice = useCallback((idx: number, v: string) => setEditLineItems(p => p.map((it, i) => i === idx ? { ...it, unitPrice: parseFloat(v) || 0 } : it)), []);
  const handleEditLineRemove = useCallback((idx: number) => setEditLineItems(p => p.filter((_, i) => i !== idx)), []);
  function openEditInvoice(inv: { id: number; invoiceNumber: string; clientName: string; clientEmail?: string | null; service?: string | null; amount: string; status: string; dueDate?: string | null; notes?: string | null; lineItems?: string | null; [key: string]: unknown }) {
    const items = inv.lineItems ? (typeof inv.lineItems === "string" ? JSON.parse(inv.lineItems) : inv.lineItems) : [];
    const hasItems = Array.isArray(items) && items.length > 0;
    setEditForm({ clientName: inv.clientName || "", clientEmail: inv.clientEmail || "", service: inv.service || "", amount: String(inv.amount || ""), dueDate: inv.dueDate ? inv.dueDate.slice(0, 10) : "", notes: inv.notes || "", status: (inv.status as "draft" | "sent" | "paid" | "overdue") || "draft" });
    setEditLineItems(hasItems ? items : []);
    setEditUseLineItems(hasItems);
    setEditInvoice(inv);
  }
  const [invConfirm, setInvConfirm] = useState<ConfirmState>(defaultConfirm);
  const [invFilter, setInvFilter] = useState<"all" | "unpaid" | "paid" | "overdue">("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);

  // Stripe redirects after Checkout, but only the verified webhook may change
  // an invoice's paid state. Refresh the display so the webhook-confirmed value
  // appears promptly without trusting a client-controlled return URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment_returned") === "1") {
      void utils.invoices.list.invalidate();
      void utils.invoices.stats.invalidate();
      toast.success("Payment received. Refreshing the webhook-confirmed invoice status…");
      // Clean the non-authoritative return marker so it cannot replay on refresh.
      const cleanUrl = window.location.pathname + "?panel=invoices";
      window.history.replaceState({}, "", cleanUrl);
    }
  }, [utils.invoices.list, utils.invoices.stats]);

  function toggleSelect(id: number) {
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function toggleSelectAll() {
    if (selectedIds.size === filteredInvoices.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredInvoices.map(i => i.id)));
  }
  // bulkMarkPaid, bulkDelete, bulkRemind are handled via individual mutations below

  const { data: invoiceList, isLoading } = trpc.invoices.list.useQuery({ status: "all" });

  const filteredInvoices = (invoiceList || []).filter(inv => {
    if (invFilter === "all") return true;
    if (invFilter === "unpaid") return inv.status === "draft" || inv.status === "sent";
    return inv.status === invFilter;
  });

  // ── Accounting export (QuickBooks-format invoices, payments, monthly summary) ─
  const [showAccountingExport, setShowAccountingExport] = useState(false);
  const [accountingFrom, setAccountingFrom] = useState("");
  const [accountingTo, setAccountingTo] = useState("");
  const accountingExport = trpc.invoices.accountingExport.useQuery(
    { from: accountingFrom || undefined, to: accountingTo || undefined },
    { enabled: false },
  );

  async function downloadAccountingFile(kind: "quickBooksInvoicesCsv" | "paymentsCsv" | "monthlySummaryCsv", label: string) {
    const result = await accountingExport.refetch();
    if (!result.data) { toast.error("Accounting export could not be prepared."); return; }
    if (result.data.summary.invoiceCount === 0) { toast.info("No invoices in that date range."); return; }
    const blob = new Blob([`\ufeff${result.data[kind]}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const baseName = result.data.fileName.replace(/\.csv$/, "");
    const suffix = kind === "quickBooksInvoicesCsv" ? "quickbooks-invoices" : kind === "paymentsCsv" ? "payments" : "monthly-summary";
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${baseName}-${suffix}.csv`; anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`${label} downloaded.`);
  }

  function exportInvoicesCSV() {
    if (!invoiceList || invoiceList.length === 0) { toast.info("No invoices to export."); return; }
    const headers = ["Invoice #", "Client", "Email", "Service", "Amount", "Due Date", "Status", "Notes"];
    const rows = invoiceList.map(inv => [
      inv.invoiceNumber, inv.clientName, inv.clientEmail || "",
      inv.service || "", inv.amount, inv.dueDate || "", inv.status, (inv.notes || "").replace(/,/g, ";")
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `invoices-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Invoices exported!");
  }
  const { data: invoiceStats } = trpc.invoices.stats.useQuery(undefined, { retry: 1 });
  const { data: clientList } = trpc.clients.list.useQuery({ search: "", status: "all" });

  const createInvoice = trpc.invoices.create.useMutation({
    onSuccess: () => { utils.invoices.list.invalidate(); utils.invoices.stats.invalidate(); toast.success("Invoice created!"); setShowAdd(false); setForm({ clientName: "", clientEmail: "", service: "", amount: "", dueDate: "", notes: "", status: "draft" }); setLineItems([]); setUseLineItems(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateInvoice = trpc.invoices.update.useMutation({
    onSuccess: () => { utils.invoices.list.invalidate(); utils.invoices.stats.invalidate(); toast.success("Invoice updated!"); setEditInvoice(null); },
    onError: (e) => toast.error(e.message),
  });
  const markPaid = trpc.invoices.markPaid.useMutation({
    onSuccess: () => { utils.invoices.list.invalidate(); utils.invoices.stats.invalidate(); toast.success("Invoice marked as paid!"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteInvoice = trpc.invoices.delete.useMutation({
    onSuccess: () => { utils.invoices.list.invalidate(); utils.invoices.stats.invalidate(); toast.success("Invoice deleted."); },
    onError: (e) => toast.error(e.message),
  });
  const sendReminder = trpc.invoices.sendReminder.useMutation({
    onSuccess: (data) => { utils.followUps.list.invalidate(); data.emailSent ? toast.success("Reminder email was accepted by configured SMTP and saved to Follow-Ups.") : toast.info(`Reminder draft saved to Follow-Ups: "${data.subject}". No configured SMTP acceptance was recorded.`); },
    onError: (e) => toast.error(e.message),
  });
  const payNow = trpc.invoices.payNow.useMutation({
    onSuccess: (data) => { window.open(data.url, "_blank", "noopener"); toast.success("Opening secure payment page..."); },
    onError: (e) => toast.error(e.message),
  });
  const duplicateInvoice = trpc.invoices.duplicate.useMutation({
    onSuccess: (data) => { utils.invoices.list.invalidate(); utils.invoices.stats.invalidate(); toast.success(`Invoice duplicated as ${data.invoiceNumber} (draft).`); },
    onError: (e) => toast.error(e.message),
  });
  const sendReceipt = trpc.invoices.sendReceipt.useMutation({
    onSuccess: (data) => data.emailSent ? toast.success("Receipt email was accepted by configured SMTP.") : toast.info("Receipt remains available. No configured SMTP acceptance was recorded."),
    onError: (e) => toast.error(e.message),
  });
  const generatePayLink = trpc.invoices.generatePayLink.useMutation({
    onSuccess: (data) => {
      const payUrl = `${window.location.origin}/pay/${data.token}`;
      navigator.clipboard.writeText(payUrl)
        .then(() => toast.success("Direct pay link copied! Client can pay without logging in."))
        .catch(() => toast.info(`Pay link: ${payUrl}`));
    },
    onError: (e) => toast.error(e.message),
  });
  const categorizeInvoice = trpc.ai.categorizeInvoice.useMutation({
    onSuccess: (data) => {
      const tagStr = data.tags.length > 0 ? ` [${data.tags.join(", ")}]` : "";
      setForm(p => ({ ...p, notes: p.notes ? `${p.notes}\nCategory: ${data.category}${tagStr}` : `Category: ${data.category}${tagStr}` }));
      toast.success(`Categorized as: ${data.category} (${Math.round(data.confidence * 100)}% confidence)`);
    },
    onError: () => toast.error("AI categorization unavailable."),
  });

  const statusColor: Record<string, string> = {
    draft: "bg-[#EEECEA] text-[#6B6B6B]",
    sent: "bg-blue-50 text-blue-600",
    paid: "bg-green-500/10 text-green-600",
    overdue: "bg-red-500/10 text-red-500",
  };

  return (
    <div className="space-y-5">
      {/* Panel header with top-level tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#1A1A1A]">Invoices</h2>
          <p className="text-sm text-[#6B6B6B]">
            {invTab === "invoices" ? `${invoiceList?.length || 0} total invoices` : `${schedules?.length || 0} schedules · ${formatCurrency(estMonthlyRevenue)}/mo est.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {invTab === "invoices" ? (
            <>
              <Button size="sm" variant="outline" className="gap-1.5 text-[#6B6B6B] border-[#DDDBD7]" onClick={exportInvoicesCSV} title="Export all invoices as CSV">
                <Download className="w-3.5 h-3.5" />Export CSV
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-[#8A5A0B] border-[#D4922A]/40 hover:bg-[#D4922A]/10" onClick={() => setShowAccountingExport(true)} title="Accountant-ready export: QuickBooks invoices, payments, monthly summary">
                <BookOpen className="w-3.5 h-3.5" />Accounting export
              </Button>
              <Button size="sm" className="gradient-amber text-white border-0 hover:opacity-90 gap-1.5" onClick={() => setShowAdd(true)}>
                <Plus className="w-3.5 h-3.5" />New Invoice
              </Button>
            </>
          ) : (
            <Button size="sm" className="gradient-amber text-white border-0 hover:opacity-90 gap-1.5" onClick={() => setShowRecurringForm(v => !v)}>
              <Plus className="w-3.5 h-3.5" />{showRecurringForm ? "Cancel" : "New Schedule"}
            </Button>
          )}
        </div>
      </div>

      {/* Top-level tab switcher */}
      <div className="flex gap-1 p-1 bg-[#EEECEA] rounded-xl overflow-x-auto">
        <button
          onClick={() => setInvTab("invoices")}
          className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            invTab === "invoices" ? "bg-[#D4922A]/20 text-[#D4922A] shadow-sm" : "text-[#6B6B6B] hover:text-[#2A2A2A]"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />Invoices
        </button>
        <button
          onClick={() => setInvTab("recurring")}
          className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            invTab === "recurring" ? "bg-[#D4922A]/20 text-[#D4922A] shadow-sm" : "text-[#6B6B6B] hover:text-[#2A2A2A]"
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />Recurring
          {activeScheduleCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-green-500/15 text-green-400 rounded-full">{activeScheduleCount}</span>
          )}
        </button>
      </div>

      {/* ── Recurring tab content ── */}
      {invTab === "recurring" && (
        <div className="space-y-5">
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-[#DDDBD7]">
              <p className="text-2xl font-bold text-[#1A1A1A]">{activeScheduleCount}</p>
              <p className="text-xs text-[#3D3D3D] mt-0.5">Active Schedules</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-[#DDDBD7]">
              <p className="text-2xl font-bold text-[#1A1A1A]">{formatCurrency(estMonthlyRevenue)}</p>
              <p className="text-xs text-[#3D3D3D] mt-0.5">Est. Monthly Revenue</p>
            </div>
          </div>

          {/* Create form */}
          {showRecurringForm && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-[#DDDBD7]">
              <h3 className="font-bold text-sm text-[#1A1A1A] mb-4">New Recurring Schedule</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Client</label>
                  <select
                    value={recurringForm.clientId}
                    onChange={e => {
                      const c = clientList?.find((c) => String(c.id) === e.target.value);
                      setRecurringForm(p => ({ ...p, clientId: e.target.value, clientName: c?.name || p.clientName, clientEmail: (c as any)?.email || p.clientEmail }));
                    }}
                    className="form-input-light"
                  >
                    <option value="">Select client or type below</option>
                    {clientList?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <Field label="Client Name" required value={recurringForm.clientName} onChange={setRecurClientName} placeholder="Client or company name" autoComplete="organization" enterKeyHint="next" />
                <Field label="Client Email" value={recurringForm.clientEmail} onChange={setRecurClientEmail} placeholder="client@example.com" type="email" autoComplete="email" enterKeyHint="next" />
                <Field label="Amount ($)" required value={recurringForm.amount} onChange={setRecurAmount} placeholder="e.g. 500" type="number" enterKeyHint="next" />
                <div>
                  <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Frequency *</label>
                  <select value={recurringForm.frequency} onChange={e => setRecurFrequency(e.target.value)} className="form-input-light">
                    {Object.entries(FREQUENCY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">First Due Date *</label>
                  <input type="date" value={recurringForm.nextDueAt} onChange={e => setRecurNextDueAt(e.target.value)} className="form-input-light" />
                </div>
                <div className="sm:col-span-2">
                  <Field label="Description" value={recurringForm.description} onChange={setRecurDescription} placeholder="e.g. Monthly retainer — web maintenance" enterKeyHint="done" />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={() => {
                    if (!recurringForm.clientName.trim()) { toast.error("Client name is required"); return; }
                    if (!recurringForm.amount || parseFloat(recurringForm.amount) <= 0) { toast.error("Amount must be greater than 0"); return; }
                    if (!recurringForm.nextDueAt) { toast.error("Next due date is required"); return; }
                    const client = clientList?.find((c) => String(c.id) === recurringForm.clientId);
                    createSchedule.mutate({
                      clientId: client?.id,
                      clientName: recurringForm.clientName.trim(),
                      clientEmail: recurringForm.clientEmail.trim() || undefined,
                      description: recurringForm.description.trim() || undefined,
                      amount: recurringForm.amount,
                      currency: recurringForm.currency,
                      frequency: recurringForm.frequency,
                      nextDueAt: new Date(recurringForm.nextDueAt + "T12:00:00").toISOString(),
                    });
                  }}
                  disabled={createSchedule.isPending}
                  className="gradient-amber text-white border-0 hover:opacity-90 gap-2"
                >
                  {createSchedule.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create Schedule
                </Button>
                <Button variant="outline" onClick={() => setShowRecurringForm(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Schedules list */}
          <div className="bg-white rounded-xl shadow-sm border border-[#DDDBD7] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#DDDBD7]">
              <h3 className="font-bold text-sm text-[#1A1A1A]">All Schedules</h3>
            </div>
            {schedulesLoading ? (
              <div className="p-8 text-center"><Loader2 className="w-6 h-6 text-[#D4922A] animate-spin mx-auto" /></div>
            ) : !schedules || schedules.length === 0 ? (
              <div className="p-10 text-center">
                <RefreshCw className="w-10 h-10 text-[#6B6B6B] mx-auto mb-3" />
                <p className="text-sm font-semibold text-[#3D3D3D]">No recurring schedules yet</p>
                <p className="text-xs text-[#3D3D3D] mt-1">Click "New Schedule" to set up automatic billing</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {schedules.map((s) => {
                  const color = FREQUENCY_COLORS[s.frequency] || "#6366F1";
                  return (
                    <div key={s.id} className={`flex items-center gap-4 px-5 py-4 hover:bg-[#F7F6F3] transition-colors ${!s.active ? "opacity-50" : ""}`}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + "15" }}>
                        <RefreshCw className="w-4 h-4" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-[#1A1A1A] truncate">{s.clientName}</p>
                          <span className="px-2 py-0.5 text-xs rounded-full font-semibold" style={{ background: color + "15", color }}>
                            {FREQUENCY_LABELS[s.frequency]}
                          </span>
                          {!s.active && <span className="px-2 py-0.5 text-xs rounded-full bg-[#EEECEA] text-[#3D3D3D] font-semibold">Paused</span>}
                        </div>
                        <p className="text-xs text-[#3D3D3D] mt-0.5">
                          {s.description || "No description"} · Next: {new Date(s.nextDueAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-[#1A1A1A]">{formatCurrency(s.amount)}</p>
                        <p className="text-xs text-[#3D3D3D]">{s.currency}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleSchedule.mutate({ id: s.id, active: !s.active })}
                          disabled={toggleSchedule.isPending}
                          className="p-2 rounded-lg hover:bg-[#EEECEA] text-[#3D3D3D] hover:text-[#6B6B6B] transition-colors"
                          title={s.active ? "Pause schedule" : "Resume schedule"}
                        >
                          {s.active ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                        <button
                          onClick={() => deleteScheduleM.mutate({ id: s.id })}
                          disabled={deleteScheduleM.isPending}
                          className="p-2 rounded-lg hover:bg-red-500/100/10 text-[#6B6B6B] hover:text-red-400 transition-colors"
                          aria-label="Delete schedule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Info box */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
            <Calendar className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Automatic Invoice Generation</p>
              <p className="text-xs text-amber-400 mt-0.5">Invoices are generated automatically at midnight on each due date. You’ll receive a notification when a new invoice is created. Clients with email addresses on file will be notified automatically.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Invoices tab content ── */}
      {invTab === "invoices" && (
      <>
      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-[#EEECEA] rounded-xl overflow-x-auto">
        {(["all", "unpaid", "paid", "overdue"] as const).map(f => (
          <button key={f} onClick={() => setInvFilter(f)} className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
            invFilter === f ? "bg-[#D4922A]/20 text-[#D4922A] shadow-sm" : "text-[#6B6B6B] hover:text-[#2A2A2A]"
          }`}>{f}</button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Paid", value: formatCurrency(invoiceStats?.totalRevenue || 0), color: "#D4922A", bg: "bg-[#D4922A]/10" },
          { label: "Outstanding", value: formatCurrency(invoiceStats?.outstanding || 0), color: "#6366F1", bg: "bg-indigo-50" },
          { label: "Overdue", value: String(invoiceStats?.overdue || 0), color: "#FF6B6B", bg: "bg-red-500/10" },
          { label: "Total Invoices", value: String(invoiceStats?.total || 0), color: "#F59E0B", bg: "bg-yellow-50" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3 sm:p-4`}>
            <p className="text-[11px] sm:text-xs font-semibold mb-1" style={{ color: s.color }}>{s.label}</p>
            <p className="text-lg sm:text-xl font-extrabold text-[#1A1A1A] leading-tight">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Bulk action toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 p-3 bg-[#F7F6F3] text-white rounded-xl">
          <span className="text-xs font-semibold flex-1">{selectedIds.size} selected</span>
          <button
            onClick={() => {
              const unpaidIds = Array.from(selectedIds).filter(id => filteredInvoices.find(i => i.id === id && i.status !== "paid"));
              if (unpaidIds.length === 0) { toast.info("All selected invoices are already paid."); return; }
              Promise.all(unpaidIds.map(id => markPaid.mutateAsync({ id })))
                .then(() => { utils.invoices.list.invalidate(); utils.invoices.stats.invalidate(); setSelectedIds(new Set()); toast.success(`${unpaidIds.length} invoice${unpaidIds.length > 1 ? "s" : ""} marked as paid!`); })
                .catch(e => toast.error(e.message));
            }}
            className="text-xs bg-[#D4922A] hover:bg-[#d4911c] text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
            disabled={bulkPending}
          >Mark Paid</button>
          <button
            onClick={() => {
              const withEmail = Array.from(selectedIds).filter(id => filteredInvoices.find(i => i.id === id && i.clientEmail && i.status !== "paid"));
              if (withEmail.length === 0) { toast.info("No unpaid invoices with client email selected."); return; }
              Promise.all(withEmail.map(id => sendReminder.mutateAsync({ id })))
                .then(() => { setSelectedIds(new Set()); toast.success(`Reminders sent for ${withEmail.length} invoice${withEmail.length > 1 ? "s" : ""}.`); })
                .catch(e => toast.error(e.message));
            }}
            className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
            disabled={bulkPending}
          >Send Reminder</button>
          <button
            onClick={() => setInvConfirm({ open: true, title: "Delete Selected", description: `Delete ${selectedIds.size} invoice${selectedIds.size > 1 ? "s" : ""}? This cannot be undone.`, onConfirm: () => {
              Promise.all(Array.from(selectedIds).map(id => deleteInvoice.mutateAsync({ id })))
                .then(() => { utils.invoices.list.invalidate(); utils.invoices.stats.invalidate(); setSelectedIds(new Set()); toast.success("Selected invoices deleted."); })
                .catch(e => toast.error(e.message));
            }})}
            className="text-xs bg-red-500/100 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
            disabled={bulkPending}
          >Delete</button>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-[#3D3D3D] hover:text-[#1A1A1A] px-2 py-1.5 transition-colors">✕ Clear</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#DDDBD7] overflow-hidden">
        <div className="hidden sm:grid grid-cols-5 gap-4 px-5 py-3 bg-[#F7F6F3] text-xs font-semibold text-[#6B6B6B] uppercase tracking-wide">
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" className="rounded w-3.5 h-3.5 accent-[#D4922A] cursor-pointer" checked={filteredInvoices.length > 0 && selectedIds.size === filteredInvoices.length} onChange={toggleSelectAll} title="Select all" />
            <span>Client / Service</span>
          </div>
          <span>Amount</span>
          <span>Due Date</span>
          <span>Status</span>
        </div>
        {isLoading ? (
          <div className="space-y-px">{[...Array(3)].map((_, i) => <div key={i} className="px-5 py-4 border-t border-[#EEECEA]"><Skeleton className="h-10" /></div>)}</div>
        ) : !invoiceList || invoiceList.length === 0 ? (
          <div className="text-center py-16 text-[#6B6B6B]">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium text-[#6B6B6B]">No invoices yet</p>
            <p className="text-xs mt-1">Create your first invoice to start tracking payments.</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-12 text-[#6B6B6B]">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium text-[#6B6B6B]">No {invFilter !== "all" ? invFilter : ""} invoices</p>
          </div>
        ) : filteredInvoices.map(inv => (
          <div key={inv.id} className={`flex flex-col sm:grid sm:grid-cols-5 gap-2 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 border-t border-[#EEECEA] hover:bg-[#F7F6F3] transition-colors ${selectedIds.has(inv.id) ? "bg-[#D4922A]/5" : ""}`}>
            <div className="sm:col-span-2 flex items-start gap-2">
              <input type="checkbox" className="mt-1 rounded w-3.5 h-3.5 accent-[#D4922A] cursor-pointer flex-shrink-0" checked={selectedIds.has(inv.id)} onChange={() => toggleSelect(inv.id)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#1A1A1A] truncate">{inv.clientName}</p>
                <p className="text-xs text-[#6B6B6B] truncate">{inv.invoiceNumber} · {inv.service || "General Service"}</p>
                {/* Mobile-only inline amount + due date */}
                <div className="flex items-center gap-3 mt-1 sm:hidden">
                  <span className="text-xs font-bold text-[#1A1A1A]">{formatCurrency(inv.amount)}</span>
                  {inv.dueDate && <span className="text-xs text-[#6B6B6B]">Due {inv.dueDate}</span>}
                </div>
              </div>
            </div>
            <p className="hidden sm:block text-sm font-bold text-[#1A1A1A]">{formatCurrency(inv.amount)}</p>
            <p className="hidden sm:block text-sm text-[#6B6B6B]">{inv.dueDate || "—"}</p>
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <Badge className={`text-xs border-0 flex-shrink-0 ${statusColor[inv.status] || "bg-[#EEECEA] text-[#6B6B6B]"}`}>{inv.status}</Badge>
              {inv.status !== "paid" && (
                <button onClick={() => markPaid.mutate({ id: inv.id })} className="text-xs text-[#D4922A] hover:underline font-medium" disabled={markPaid.isPending}>
                  Mark Paid
                </button>
              )}
              {inv.status === "paid" && inv.clientEmail && (
                <button
                  onClick={() => sendReceipt.mutate({ id: inv.id })}
                  className="text-xs text-green-600 hover:underline font-medium flex items-center gap-1"
                  disabled={sendReceipt.isPending}
                  title="Email receipt to client"
                >
                  <Mail className="w-3 h-3" />{sendReceipt.isPending ? "..." : "Receipt"}
                </button>
              )}
              {(inv.status === "sent" || inv.status === "overdue") && (
                <>
                  <button
                    onClick={() => payNow.mutate({ id: inv.id, origin: window.location.origin })}
                    className="text-xs text-green-600 hover:underline font-medium flex items-center gap-1"
                    disabled={payNow.isPending}
                    title="Send client to Stripe checkout to pay this invoice"
                  >
                    <CreditCard className="w-3 h-3" />{payNow.isPending ? "..." : "Pay Now"}
                  </button>
                  <button
                    onClick={() => sendReminder.mutate({ id: inv.id })}
                    className="text-xs text-[#FF6B6B] hover:underline font-medium flex items-center gap-1"
                    disabled={sendReminder.isPending}
                    title="Send payment reminder to client"
                  >
                    <Bell className="w-3 h-3" />Remind
                  </button>
                </>
              )}
              <button onClick={() => setPreviewInvoice(inv)} className="p-2 rounded hover:bg-[#EEECEA] text-[#6B6B6B] hover:text-[#6B6B6B] transition-colors" aria-label="Preview invoice" title="Preview invoice">
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => openEditInvoice(inv)} className="p-2 rounded hover:bg-indigo-50 text-[#3D3D3D] hover:text-indigo-600 transition-colors" aria-label="Edit invoice" title="Edit invoice">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { const link = `${window.location.origin}/portal?invoice=${inv.id}`; navigator.clipboard.writeText(link).then(() => toast.success("Invoice link copied!")).catch(() => toast.info(`Invoice link: ${link}`)); }} className="p-2 rounded hover:bg-blue-50 text-[#3D3D3D] hover:text-blue-500 transition-colors" aria-label="Copy invoice link" title="Copy shareable invoice link">
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              {(inv.status === "sent" || inv.status === "overdue" || inv.status === "draft") && (
                <button
                  onClick={() => generatePayLink.mutate({ id: inv.id })}
                  className="p-2 rounded hover:bg-green-500/10 text-[#3D3D3D] hover:text-green-500 transition-colors"
                  aria-label="Generate direct pay link"
                  title="Generate a direct pay link — client pays without logging in"
                  disabled={generatePayLink.isPending}
                >
                  <Link className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => duplicateInvoice.mutate({ id: inv.id })} className="p-2 rounded hover:bg-[#D4922A]/10 text-[#3D3D3D] hover:text-[#D4922A] transition-colors" aria-label="Duplicate invoice" title="Duplicate invoice" disabled={duplicateInvoice.isPending}>
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setInvConfirm({ open: true, title: "Delete Invoice?", description: "Delete this invoice? This cannot be undone.", onConfirm: () => deleteInvoice.mutate({ id: inv.id }) })} className="p-2 rounded hover:bg-red-500/100/10 text-[#3D3D3D] hover:text-red-500 transition-colors" aria-label="Delete invoice">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Invoice Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Create Invoice">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Select Client</label>
            <select onChange={e => { const pid = parseInt(e.target.value, 10); const c = !isNaN(pid) ? clientList?.find(c => c.id === pid) : undefined; if (c) setForm(p => ({ ...p, clientName: c.name, clientEmail: c.email || "" })); }} className="form-input-light">
              <option value="">— Or enter manually below —</option>
              {clientList?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Field label="Client Name" value={form.clientName} onChange={setInvClientName} placeholder="Jane Smith" required autoComplete="name" enterKeyHint="next" />
          <Field label="Client Email" value={form.clientEmail} onChange={setInvClientEmail} placeholder="jane@example.com" type="email" autoComplete="email" enterKeyHint="next" />
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#6B6B6B]">Service Description</label>
              {form.service && (
                <Button size="sm" variant="outline" className="h-5 text-[10px] px-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={() => categorizeInvoice.mutate({ service: form.service, notes: form.notes, amount: parseFloat(form.amount) || 0 })} disabled={categorizeInvoice.isPending}>
                  {categorizeInvoice.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <><Sparkles className="w-2.5 h-2.5 mr-1" />AI Categorize</>}
                </Button>
              )}
            </div>
            <input value={form.service} onChange={e => setInvService(e.target.value)} placeholder="3-month coaching program, web design..." className="form-input-light" autoComplete="off" autoCorrect="off" autoCapitalize="sentences" spellCheck={false} enterKeyHint="next" />
          </div>
          {/* Line Items Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={useLineItems}
              aria-label="Use itemized line items"
              onClick={() => setUseLineItems(p => !p)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${useLineItems ? 'bg-[#D4922A]' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${useLineItems ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-xs font-semibold text-[#6B6B6B]">Itemized line items</span>
          </div>

          {useLineItems ? (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#6B6B6B]">Line Items</label>
              {lineItems.map((item, idx) => (
                <LineItemRow
                  key={idx}
                  item={item}
                  idx={idx}
                  onChangeDesc={handleLineDesc}
                  onChangeQty={handleLineQty}
                  onChangePrice={handleLinePrice}
                  onRemove={handleLineRemove}
                />
              ))}
              <button
                type="button"
                onClick={() => setLineItems(p => [...p, { description: "", qty: 1, unitPrice: 0 }])}
                className="text-xs text-[#D4922A] hover:underline font-semibold"
              >+ Add line item</button>
              {lineItems.length > 0 && (
                <div className="text-right text-sm font-bold text-[#1A1A1A] pt-1">
                  Total: {formatCurrency(lineItemsTotal)}
                </div>
              )}
            </div>
          ) : (
            <Field label="Amount ($) *" value={form.amount} onChange={setInvAmount} placeholder="500.00" type="number" required autoComplete="off" enterKeyHint="next" />
          )}
          <Field label="Due Date" value={form.dueDate} onChange={setInvDueDate} type="date" autoComplete="off" />
          <Field label="Notes" value={form.notes} onChange={setInvNotes} placeholder="Payment terms, bank details..." textarea enterKeyHint="done" />
          <div>
            <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Send as</label>
            <select value={form.status} onChange={e => setInvStatus(e.target.value)} className="form-input-light">
              <option value="draft">Save as Draft</option>
              <option value="sent">Mark as Sent</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="flex-1 gradient-amber text-white border-0 hover:opacity-90" onClick={() => createInvoice.mutate(useLineItems ? { ...form, amount: undefined, lineItems: lineItems.filter(i => i.description.trim()) } : { ...form, amount: parseFloat(form.amount) || 0 })} disabled={createInvoice.isPending || (useLineItems && lineItems.length === 0)}>
              {createInvoice.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Invoice"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Invoice Modal */}
      <Modal open={!!editInvoice} onClose={() => setEditInvoice(null)} title={`Edit Invoice ${editInvoice?.invoiceNumber || ""}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Select Client</label>
            <select onChange={e => { const pid = parseInt(e.target.value, 10); const c = !isNaN(pid) ? clientList?.find(c => c.id === pid) : undefined; if (c) setEditForm(p => ({ ...p, clientName: c.name, clientEmail: c.email || "" })); }} className="form-input-light">
              <option value="">— Or enter manually below —</option>
              {clientList?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Field label="Client Name" value={editForm.clientName} onChange={setEditClientName} placeholder="Jane Smith" required />
          <Field label="Client Email" value={editForm.clientEmail} onChange={setEditClientEmail} placeholder="jane@example.com" type="email" />
          <Field label="Service Description" value={editForm.service} onChange={setEditService} placeholder="3-month coaching program..." />
          {/* Line Items Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={editUseLineItems}
              aria-label="Use itemized line items"
              onClick={() => setEditUseLineItems(p => !p)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${editUseLineItems ? 'bg-[#D4922A]' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${editUseLineItems ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-xs font-semibold text-[#6B6B6B]">Itemized line items</span>
          </div>
          {editUseLineItems ? (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#6B6B6B]">Line Items</label>
              {editLineItems.map((item, idx) => (
                <LineItemRow
                  key={idx}
                  item={item}
                  idx={idx}
                  onChangeDesc={handleEditLineDesc}
                  onChangeQty={handleEditLineQty}
                  onChangePrice={handleEditLinePrice}
                  onRemove={handleEditLineRemove}
                />
              ))}
              <button type="button" onClick={() => setEditLineItems(p => [...p, { description: "", qty: 1, unitPrice: 0 }])} className="text-xs text-[#D4922A] hover:underline font-semibold">+ Add line item</button>
              {editLineItems.length > 0 && (
                <div className="text-right text-sm font-bold text-[#1A1A1A] pt-1">Total: {formatCurrency(editLineItemsTotal)}</div>
              )}
            </div>
          ) : (
            <Field label="Amount ($) *" value={editForm.amount} onChange={setEditAmount} placeholder="500.00" type="number" required />
          )}
          <Field label="Due Date" value={editForm.dueDate} onChange={setEditDueDate} type="date" />
          <Field label="Notes" value={editForm.notes} onChange={setEditNotes} placeholder="Payment terms, bank details..." textarea />
          <div>
            <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Status</label>
            <select value={editForm.status} onChange={e => setEditStatus(e.target.value)} className="form-input-light">
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditInvoice(null)}>Cancel</Button>
            <Button
              className="flex-1 gradient-amber text-white border-0 hover:opacity-90"
              onClick={() => updateInvoice.mutate(editUseLineItems
                ? { id: editInvoice.id, ...editForm, amount: undefined, lineItems: editLineItems.filter(i => i.description.trim()) }
                : { id: editInvoice.id, ...editForm, amount: parseFloat(editForm.amount) || 0 }
              )}
              disabled={updateInvoice.isPending || (editUseLineItems && editLineItems.length === 0)}
            >
              {updateInvoice.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invoice Preview Modal */}
      <Modal open={!!previewInvoice} onClose={() => setPreviewInvoice(null)} title="Invoice Preview" wide>
        {previewInvoice && (
          <div className="font-sans">
            {/* Accent bar */}
            <div className="h-1 bg-[#D4922A] rounded-t-lg -mx-6 -mt-2 mb-5" />

            {/* Header: INVOICE label + meta */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[11px] font-bold tracking-widest text-[#3D3D3D] uppercase mb-1">Invoice</p>
                <p className="text-3xl font-extrabold text-[#D4922A] tracking-tight">
                  {previewInvoice.invoiceNumber || `#${previewInvoice.id}`}
                </p>
              </div>
              <div className="text-right space-y-1">
                <div className="flex items-center justify-end gap-2">
                  <span className="text-[11px] text-[#3D3D3D] uppercase tracking-wide">Status</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                    previewInvoice.status === "paid" ? "bg-green-500/15 text-green-400" :
                    previewInvoice.status === "overdue" ? "bg-red-500/15 text-red-400" :
                    "bg-amber-500/15 text-amber-400"
                  }`}>{previewInvoice.status}</span>
                </div>
                <p className="text-xs text-[#3D3D3D]">Issued {formatDate(previewInvoice.createdAt)}</p>
                {previewInvoice.dueDate && (
                  <p className="text-xs text-[#3D3D3D]">Due {formatDate(previewInvoice.dueDate)}</p>
                )}
              </div>
            </div>

            {/* Bill To */}
            <div className="mb-4">
              <p className="text-[10px] font-bold tracking-widest text-[#3D3D3D] uppercase mb-1">Bill To</p>
              <p className="text-sm font-semibold text-[#1A1A1A]">{previewInvoice.clientName}</p>
              {previewInvoice.clientEmail && <p className="text-xs text-[#3D3D3D]">{previewInvoice.clientEmail}</p>}
            </div>

            {/* Line items table */}
            {(() => {
              let parsedItems: { description: string; qty: number; unitPrice: number }[] = [];
              try { if (previewInvoice.lineItems) parsedItems = JSON.parse(previewInvoice.lineItems); } catch {}
              const hasItems = parsedItems.length > 0;
              return (
                <div className="overflow-x-auto mb-4">
                <div className="border border-[#DDDBD7] rounded-lg overflow-hidden min-w-[280px]">
                  <div className="grid grid-cols-[1fr_60px_90px] bg-[#F7F6F3] border-b border-[#DDDBD7]">
                    <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-[#3D3D3D] uppercase">Description</div>
                    <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-[#3D3D3D] uppercase text-center">Qty</div>
                    <div className="px-4 py-2 text-[10px] font-bold tracking-widest text-[#3D3D3D] uppercase text-right">Amount</div>
                  </div>
                  {hasItems ? parsedItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_60px_90px] bg-white border-b border-[#DDDBD7] last:border-0">
                      <div className="px-4 py-2.5"><p className="text-sm font-medium text-[#1A1A1A]">{item.description}</p></div>
                      <div className="px-4 py-2.5 text-sm text-[#6B6B6B] text-center">{item.qty}</div>
                      <div className="px-4 py-2.5 text-sm font-semibold text-[#1A1A1A] text-right">{formatCurrency(item.qty * item.unitPrice)}</div>
                    </div>
                  )) : (
                    <div className="grid grid-cols-[1fr_60px_90px] bg-[#F7F6F3]">
                      <div className="px-4 py-3">
                        <p className="text-sm font-medium text-[#1A1A1A]">{previewInvoice.service || "Professional Services"}</p>
                        <p className="text-xs text-[#3D3D3D] mt-0.5">{previewInvoice.clientName}</p>
                      </div>
                      <div className="px-4 py-3 text-sm text-[#6B6B6B] text-center">1</div>
                      <div className="px-4 py-3 text-sm font-bold text-[#1A1A1A] text-right">{formatCurrency(previewInvoice.amount)}</div>
                    </div>
                  )}
                  <div className="grid grid-cols-[1fr_auto] bg-amber-500/10 border-t border-[#DDDBD7]">
                    <div className="px-4 py-3 text-xs font-bold text-[#3D3D3D] uppercase tracking-wide">Total Due</div>
                    <div className="px-4 py-3 text-xl font-extrabold text-[#D4922A] text-right">{formatCurrency(previewInvoice.amount)}</div>
                  </div>
                </div>
                </div>
              );
            })()}

            {/* Notes */}
            {previewInvoice.notes && (
              <div className="bg-[#F7F6F3] border border-[#DDDBD7] rounded-lg p-3 mb-4">
                <p className="text-[10px] font-bold tracking-widest text-[#3D3D3D] uppercase mb-1">Notes</p>
                <p className="text-sm text-[#6B6B6B] leading-relaxed">{previewInvoice.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <a
                href={`/api/invoices/${previewInvoice.id}/pdf`}
                download
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-[#D4922A] text-white hover:bg-[#D4911A] transition-colors"
              >
                <Download className="w-4 h-4" /> Download PDF
              </a>
              {previewInvoice.status !== "paid" && (
                <Button variant="outline" className="flex-1 gap-2" onClick={() => { markPaid.mutate({ id: previewInvoice.id }); setPreviewInvoice(null); }}>
                  <CheckCircle className="w-4 h-4 text-green-500" /> Mark Paid
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
      </>
      )} {/* end invTab === "invoices" */}

      <ConfirmDialog
        open={invConfirm.open}
        onOpenChange={(open) => !open && setInvConfirm(defaultConfirm)}
        title={invConfirm.title}
        description={invConfirm.description}
        onConfirm={() => { invConfirm.onConfirm(); setInvConfirm(defaultConfirm); }}
        confirmLabel="Delete"
        variant="destructive"
      />


  {/* Accounting export modal */}
  <Modal
    open={showAccountingExport}
    onClose={() => setShowAccountingExport(false)}
    title="Accounting export"  >
    <div className="space-y-4">
      <p className="text-sm text-[#6B6B6B]">
        Date-ranged exports in the formats bookkeepers use: QuickBooks Online invoice import columns, a payments-received ledger, and a monthly accrual vs. cash summary for tax prep. Leave dates blank to include everything.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-[#6B6B6B]">From
          <input type="date" value={accountingFrom} onChange={(e) => setAccountingFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-[#DDDBD7] px-3 py-2 text-sm text-[#1A1A1A] bg-white" />
        </label>
        <label className="block text-xs font-semibold text-[#6B6B6B]">To
          <input type="date" value={accountingTo} onChange={(e) => setAccountingTo(e.target.value)} className="mt-1 w-full rounded-lg border border-[#DDDBD7] px-3 py-2 text-sm text-[#1A1A1A] bg-white" />
        </label>
      </div>
      {accountingExport.data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" aria-live="polite">
          <div className="rounded-xl bg-[#F7F6F3] border border-[#DDDBD7] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#6B6B6B]">Invoices</p>
            <p className="text-lg font-bold text-[#1A1A1A]">{accountingExport.data.summary.invoiceCount}</p>
          </div>
          <div className="rounded-xl bg-[#F7F6F3] border border-[#DDDBD7] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#6B6B6B]">Invoiced</p>
            <p className="text-lg font-bold text-[#1A1A1A]">{formatCurrency(accountingExport.data.summary.invoicedTotal)}</p>
          </div>
          <div className="rounded-xl bg-[#F7F6F3] border border-[#DDDBD7] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#6B6B6B]">Paid</p>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(accountingExport.data.summary.paidTotal)}</p>
          </div>
          <div className="rounded-xl bg-[#F7F6F3] border border-[#DDDBD7] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#6B6B6B]">Outstanding</p>
            <p className="text-lg font-bold text-[#D4922A]">{formatCurrency(accountingExport.data.summary.outstandingTotal)}</p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button size="sm" className="gradient-amber text-white border-0 hover:opacity-90" onClick={() => void downloadAccountingFile("quickBooksInvoicesCsv", "QuickBooks invoices CSV")} disabled={accountingExport.isFetching}>
          {accountingExport.isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Download invoices (QuickBooks format)"}
        </Button>
        <Button size="sm" variant="outline" className="border-[#DDDBD7] text-[#6B6B6B]" onClick={() => void downloadAccountingFile("paymentsCsv", "Payments ledger")} disabled={accountingExport.isFetching}>Payments ledger</Button>
        <Button size="sm" variant="outline" className="border-[#DDDBD7] text-[#6B6B6B]" onClick={() => void downloadAccountingFile("monthlySummaryCsv", "Monthly summary")} disabled={accountingExport.isFetching}>Monthly summary</Button>
      </div>
    </div>
  </Modal>
    </div>
  );
}

export { InvoicesPanel };
