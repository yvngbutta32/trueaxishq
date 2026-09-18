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

// ─── Clients Panel ────────────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { id: "inquiry" as const, label: "Inquiry", color: "#6B7280", bg: "rgba(107,114,128,0.15)", desc: "New leads" },
  { id: "proposal_sent" as const, label: "Proposal Sent", color: "#D4922A", bg: "rgba(212,146,42,0.15)", desc: "Awaiting decision" },
  { id: "active" as const, label: "Active", color: "#00C9A7", bg: "rgba(0,201,167,0.15)", desc: "Current clients" },
  { id: "completed" as const, label: "Completed", color: "#3B82F6", bg: "rgba(59,130,246,0.15)", desc: "Finished projects" },
  { id: "lost" as const, label: "Lost", color: "#EF4444", bg: "rgba(239,68,68,0.15)", desc: "Didn't convert" },
];
type PipelineStageId = "inquiry" | "proposal_sent" | "active" | "completed" | "lost";

function ClientsPanel() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "prospect">("all");
  const [viewMode, setViewMode] = useState<"list" | "pipeline">("list");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", service: "", status: "active" as "active" | "inactive" | "prospect", notes: "", defaultRate: "" });
  const setClientFormField = useFormFields(setForm);
  const [clientConfirm, setClientConfirm] = useState<ConfirmState>(defaultConfirm);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState<Array<{ name: string; email: string; phone: string; service: string; status: string }>>([]);
  const [newCustomField, setNewCustomField] = useState({ label: "", fieldKey: "", fieldType: "text" as "text" | "select", options: "" });

  // Read search from header quick-search on mount
  useEffect(() => {
    const stored = sessionStorage.getItem("dashboardSearch");
    if (stored) {
      setSearch(stored);
      setDebouncedSearch(stored);
      sessionStorage.removeItem("dashboardSearch");
    }
  }, []);

  // Debounce search to prevent excessive API calls
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: clientList, isLoading } = trpc.clients.list.useQuery({ search: debouncedSearch, status: statusFilter });
  const { data: selectedClient } = trpc.clients.get.useQuery({ id: selectedId! }, { enabled: !!selectedId });
  const { data: clientCustomFields } = trpc.clients.listCustomFields.useQuery();
  const { data: selectedClientCustomValues } = trpc.clients.getCustomFieldValues.useQuery({ clientId: selectedId! }, { enabled: !!selectedId });
  const setClientCustomValue = trpc.clients.setCustomFieldValue.useMutation({
    onSuccess: () => { if (selectedId) utils.clients.getCustomFieldValues.invalidate({ clientId: selectedId }); },
    onError: error => toast.error(error.message),
  });
  const createClientCustomField = trpc.clients.createCustomField.useMutation({
    onSuccess: () => { utils.clients.listCustomFields.invalidate(); setNewCustomField({ label: "", fieldKey: "", fieldType: "text", options: "" }); toast.success("Private client field added."); },
    onError: error => toast.error(error.message),
  });
  const { data: pulseData } = trpc.pulse.getAll.useQuery(undefined, { retry: 1 });
  const { data: pipelineData, isLoading: pipelineLoading } = trpc.clients.listByStage.useQuery(undefined, { enabled: viewMode === "pipeline" });
  const updateStage = trpc.clients.updateStage.useMutation({
    onSuccess: () => { utils.clients.listByStage.invalidate(); toast.success("Stage updated!"); },
    onError: (e) => toast.error(e.message),
  });
  const pulseMap = new Map((pulseData ?? []).map(d => [d.client.id, d.pulse]));

  const createClient = trpc.clients.create.useMutation({
    onSuccess: () => { utils.clients.list.invalidate(); toast.success("Client added successfully!"); setShowAdd(false); setForm({ name: "", email: "", phone: "", service: "", status: "active", notes: "", defaultRate: "" }); },
    onError: (e) => toast.error(e.message),
  });
  const deleteClient = trpc.clients.delete.useMutation({
    onSuccess: () => { utils.clients.list.invalidate(); toast.success("Client removed."); },
    onError: (e) => toast.error(e.message),
  });
  const updateClient = trpc.clients.update.useMutation({
    onSuccess: () => { utils.clients.list.invalidate(); utils.clients.get.invalidate({ id: selectedId! }); toast.success("Client updated!"); },
    onError: (e) => toast.error(e.message),
  });
  const importCsv = trpc.clients.importCsv.useMutation({
    onSuccess: (data) => { utils.clients.list.invalidate(); toast.success(`Imported ${data.imported} clients${data.skipped ? `, skipped ${data.skipped}` : ""}.`); setShowCsvImport(false); setCsvText(""); setCsvPreview([]); },
    onError: (e) => toast.error(e.message),
  });
  const clientCsvExport = trpc.clients.exportCsv.useQuery(undefined, { enabled: false });

  async function exportClientsCSV() {
    const result = await clientCsvExport.refetch();
    if (!result.data) { toast.error("Client export could not be prepared."); return; }
    const blob = new Blob([`\ufeff${result.data.csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = result.data.fileName; anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Client CSV downloaded.");
  }



  // Detect delimiter: tab, semicolon, or comma
  const detectDelimiter = (firstLine: string): string => {
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    if (tabCount >= semiCount && tabCount >= commaCount) return "\t";
    if (semiCount > commaCount) return ";";
    return ",";
  };

  // RFC 4180-compliant CSV field parser (handles quoted fields with commas/newlines)
  const parseCSVLine = (line: string, delim: string): string[] => {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === delim && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const parseCsv = (text: string) => {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return;
    const delim = detectDelimiter(lines[0]);
    const rawHeaders = parseCSVLine(lines[0], delim).map(h => h.toLowerCase().replace(/["'\s_-]/g, ""));

    // Column detection — broad aliases covering:
    // HoneyBook, Dubsado, 17hats, Calendly, Acuity, Square, Stripe, Mailchimp,
    // ActiveCampaign, Pipedrive, Salesforce, Zoho, Airtable, Google Contacts,
    // Outlook Contacts, Notion, and generic CRM exports
    const findCol = (aliases: string[]): number =>
      rawHeaders.findIndex(h => aliases.some(a => h.includes(a)));

    const fullNameIdx  = findCol(["fullname","clientname","contactname","displayname","name"]);
    const firstNameIdx = findCol(["firstname","givenname","first"]);
    const lastNameIdx  = findCol(["lastname","surname","familyname","last"]);
    const emailIdx     = findCol(["email","emailaddress","mail","e-mail"]);
    const phoneIdx     = findCol(["phone","mobile","cell","tel","phonenumber","mobilephone","cellphone","contactphone"]);
    const serviceIdx   = findCol(["service","services","niche","type","category","product","package","plan","tier","offering","jobtype","appointmenttype","sessiontype"]);
    const statusIdx    = findCol(["status","clientstatus","leadstatus","stage","state","relationship","tag","label"]);
    const companyIdx   = findCol(["company","business","organization","org","employer","account"]);
    const notesIdx     = findCol(["notes","note","memo","description","comment","comments","bio","details"]);

    const hasHeaders = fullNameIdx >= 0 || firstNameIdx >= 0 || emailIdx >= 0;
    const dataLines = hasHeaders ? lines.slice(1) : lines;

    const normalizeStatus = (s: string): "active" | "inactive" | "prospect" => {
      const v = s.toLowerCase().trim();
      if (["inactive","churned","lost","closed","archived","unsubscribed","cancelled","canceled"].some(x => v.includes(x))) return "inactive";
      if (["prospect","lead","potential","trial","new","pending","inquiry","interested","warm","cold","qualified"].some(x => v.includes(x))) return "prospect";
      return "active";
    };

    const rows = dataLines.slice(0, 500).map(line => {
      const cols = parseCSVLine(line, delim);
      const get = (idx: number) => (idx >= 0 ? cols[idx] || "" : "").trim();

      // Build full name: prefer fullName column, fallback to first+last
      let name = "";
      if (fullNameIdx >= 0) {
        name = get(fullNameIdx);
      } else if (firstNameIdx >= 0 || lastNameIdx >= 0) {
        name = [get(firstNameIdx), get(lastNameIdx)].filter(Boolean).join(" ");
      } else {
        name = get(0);
      }

      // Append company to service if no service column but company exists
      let service = get(serviceIdx);
      if (!service && companyIdx >= 0) service = get(companyIdx);

      // Build notes from notes column
      const notes = get(notesIdx);

      const rawStatus = statusIdx >= 0 ? get(statusIdx) : "";
      const status = rawStatus ? normalizeStatus(rawStatus) : "active";

      return {
        name,
        email: get(emailIdx) || (emailIdx < 0 ? get(1) : ""),
        phone: get(phoneIdx),
        service,
        status,
        notes,
      };
    }).filter(r => r.name.trim());
    setCsvPreview(rows);
  };

  const { data: clientDocs, refetch: refetchDocs } = trpc.documents.list.useQuery(
    { clientId: selectedId! },
    { enabled: !!selectedId }
  );
  const saveDoc = trpc.documents.save.useMutation({
    onSuccess: () => { refetchDocs(); toast.success("Document uploaded!"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteDoc = trpc.documents.delete.useMutation({
    onSuccess: () => { refetchDocs(); toast.success("Document removed."); },
    onError: (e) => toast.error(e.message),
  });
  const setDocumentVisibility = trpc.documents.setClientVisibility.useMutation({
    onSuccess: (result) => { refetchDocs(); toast.success(result.clientVisible ? "Document shared in the client portal." : "Document removed from the client portal."); },
    onError: (e) => toast.error(e.message),
  });
  const [docUploading, setDocUploading] = useState(false);

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("File must be under 20 MB."); return; }
    setDocUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/document", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Upload failed"); }
      const data = await res.json();
      await saveDoc.mutateAsync({ clientId: selectedId, fileName: data.fileName, fileKey: data.fileKey, fileUrl: data.fileUrl, mimeType: data.mimeType, sizeBytes: data.sizeBytes });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setDocUploading(false);
      e.target.value = "";
    }
  };

  // Tags & Messages
  const [profileTab, setProfileTab] = useState<"info" | "tags" | "messages">("info");
  const { data: clientTagsData = [] } = trpc.tags.listForClient.useQuery({ clientId: selectedId! }, { enabled: !!selectedId });
  const [newTag, setNewTag] = useState("");
  const addTag = trpc.tags.add.useMutation({ onSuccess: () => utils.tags.listForClient.invalidate({ clientId: selectedId! }) });
  const removeTag = trpc.tags.remove.useMutation({ onSuccess: () => utils.tags.listForClient.invalidate({ clientId: selectedId! }) });
  const { data: messages = [] } = trpc.portalMsg.list.useQuery({ clientId: selectedId! }, { enabled: !!selectedId && profileTab === "messages" });
  const [msgText, setMsgText] = useState("");
  const sendReply = trpc.portalMsg.reply.useMutation({ onSuccess: () => { utils.portalMsg.list.invalidate({ clientId: selectedId! }); setMsgText(""); } });

  const getPortalToken = trpc.portal.getToken.useMutation({
    onSuccess: (data) => {
      navigator.clipboard.writeText(data.url)
        .then(() => toast.success("Portal link copied to clipboard!"))
        .catch(() => toast.info(`Portal link: ${data.url}`));
    },
    onError: (e) => toast.error(e.message),
  });
  const { data: portalStatus } = trpc.portal.status.useQuery(
    { clientId: selectedId! },
    { enabled: Boolean(selectedId) }
  );
  const revokePortalToken = trpc.portal.revokeToken.useMutation({
    onSuccess: () => {
      utils.portal.status.invalidate({ clientId: selectedId! });
      toast.success("Client portal link revoked.");
    },
    onError: (error) => toast.error(error.message),
  });

  // Stable field setters — prevents Field memo from being bypassed on every render
  const setFormName        = useFormField(setForm, "name");
  const setFormEmail       = useFormField(setForm, "email");
  const setFormPhone       = useFormField(setForm, "phone");
  const setFormService     = useFormField(setForm, "service");
  const setFormNotes       = useFormField(setForm, "notes");
  const setFormDefaultRate = useFormField(setForm, "defaultRate");

  const handleCreate = () => {
    if (!form.name.trim()) { toast.error("Client name is required."); return; }
    createClient.mutate(form);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#1A1A1A]">Clients</h2>
          <p className="text-sm text-[#6B6B6B]">{clientList?.length || 0} clients in your roster</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex rounded-lg border border-[#DDDBD7] overflow-hidden">
            <button onClick={() => setViewMode("list")} className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "list" ? "bg-[#D4922A] text-white" : "bg-transparent text-[#6B6B6B] hover:bg-white/5"}`}>List</button>
            <button onClick={() => setViewMode("pipeline")} className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "pipeline" ? "bg-[#D4922A] text-white" : "bg-transparent text-[#6B6B6B] hover:bg-white/5"}`}>Pipeline</button>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={exportClientsCSV} title="Export clients as CSV">
            <Download className="w-3.5 h-3.5" />Export CSV
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowCsvImport(true)}>
            <Upload className="w-3.5 h-3.5" />Import CSV
          </Button>
          <Button size="sm" className="gradient-amber text-white border-0 hover:opacity-90 gap-1.5" onClick={() => setShowAdd(true)}>
            <Plus className="w-3.5 h-3.5" />Add Client
          </Button>
        </div>
      </div>

      {/* Pipeline Kanban View */}
      {viewMode === "pipeline" && (
        <div className="space-y-3">
          {pipelineLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {PIPELINE_STAGES.map(s => <div key={s.id} className="bg-white rounded-xl border border-[#DDDBD7] p-3 min-h-[200px]"><Skeleton className="h-6 w-24 mb-3" />{[0,1].map(i => <Skeleton key={i} className="h-16 mb-2" />)}</div>)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {PIPELINE_STAGES.map(stage => {
                const stageClients = (pipelineData as Record<string, Array<{id:number;name:string;email:string|null;service:string|null;status:string}>>)?.[stage.id] ?? [];
                return (
                  <div key={stage.id} className="bg-white rounded-xl border border-[#DDDBD7] p-3 min-h-[200px] flex flex-col gap-2">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <div className="text-xs font-bold" style={{ color: stage.color }}>{stage.label}</div>
                        <div className="text-[10px] text-[#3D3D3D]">{stage.desc}</div>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: stage.bg, color: stage.color }}>{stageClients.length}</span>
                    </div>
                    {stageClients.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-[10px] text-[#6B6B6B] text-center">No clients</div>
                    ) : stageClients.map(c => (
                      <div key={c.id} className="bg-[#F7F6F3] rounded-lg p-2.5 border border-[#EEECEA] hover:border-[#C8C5BF] transition-all cursor-pointer group" onClick={() => setSelectedId(c.id)}>
                        <div className="text-xs font-semibold text-[#1A1A1A] truncate">{c.name}</div>
                        {c.service && <div className="text-[10px] text-[#3D3D3D] truncate mt-0.5">{c.service}</div>}
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {PIPELINE_STAGES.filter(s => s.id !== stage.id).map(s => (
                            <button key={s.id} onClick={e => { e.stopPropagation(); updateStage.mutate({ id: c.id, pipelineStage: s.id as PipelineStageId }); }} className="text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: s.bg, color: s.color }} title={`Move to ${s.label}`}>→ {s.label}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-[#6B6B6B] text-center">Hover a client card to see stage move buttons</p>
        </div>
      )}
      {/* Filters */}
      {viewMode === "list" && <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients by name, email, or service..."
            className="form-input-light pl-9"
            aria-label="Search clients"
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
          className="form-input-light"
          aria-label="Filter by status"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="prospect">Prospect</option>
                    <option value="inactive">Inactive</option>
        </select>
      </div>}
      {/* Table */}
      {viewMode === "list" && <div className="bg-white rounded-xl border border-[#DDDBD7] overflow-hidden">
        <div className="hidden sm:grid grid-cols-4 gap-4 px-5 py-3 bg-[#F7F6F3] text-xs font-semibold text-[#6B6B6B] uppercase tracking-wide">
          <span className="col-span-2">Client</span>
          <span>Service</span>
          <span>Status</span>
        </div>
        {isLoading ? (
          <div className="space-y-px">
            {[...Array(4)].map((_, i) => <div key={i} className="px-5 py-4 border-t border-[#EEECEA]"><Skeleton className="h-10" /></div>)}
          </div>
        ) : !clientList || clientList.length === 0 ? (
          <div className="text-center py-16 text-[#6B6B6B]">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium text-[#6B6B6B]">No clients found</p>
            <p className="text-xs mt-1">{search ? "Try adjusting your search." : "Add your first client to get started."}</p>
          </div>
        ) : clientList.map(c => (
          <div
            key={c.id}
            className="flex sm:grid sm:grid-cols-4 gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 border-t border-[#EEECEA] hover:bg-[#F7F6F3] transition-colors items-center cursor-pointer"
            onClick={() => setSelectedId(c.id)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === "Enter" && setSelectedId(c.id)}
            aria-label={`View ${c.name}'s profile`}
          >
            <div className="col-span-2 flex items-center gap-3 min-w-0 flex-1 sm:flex-none">
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full gradient-amber flex items-center justify-center text-white text-xs font-bold">
                  {c.avatarInitials || c.name.slice(0, 2).toUpperCase()}
                </div>
                {(() => {
                  const p = pulseMap.get(c.id);
                  if (!p) return null;
                  const score = p.healthScore;
                  const isGood = score >= 70;
                  const isMid = score >= 40;
                  const bg = isGood ? "#22c55e" : isMid ? "#f59e0b" : "#ef4444";
                  const label = isGood ? "Healthy" : isMid ? "Needs attention" : "At risk";
                  return (
                    <span
                      title={`Client Pulse: ${score}/100 — ${label}`}
                      className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] px-0.5 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-extrabold text-white leading-none"
                      style={{ backgroundColor: bg }}
                    >
                      {score}
                    </span>
                  );
                })()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1A1A1A] truncate">{c.name}</p>
                <p className="text-xs text-[#6B6B6B] truncate">
                  {c.email || "No email"}
                  {c.lastActivity && (
                    <span className="ml-2 text-[#3D3D3D]">· last seen {new Date(c.lastActivity).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  )}
                </p>
              </div>
            </div>
            <p className="hidden sm:block text-sm text-[#6B6B6B] truncate">{c.service || "—"}</p>
            <div className="flex items-center justify-between ml-auto sm:ml-0 flex-shrink-0 gap-2">
              <Badge className={`text-xs border-0 ${c.status === "active" ? "bg-green-500/10 text-green-600" : c.status === "prospect" ? "bg-yellow-50 text-yellow-600" : "bg-[#EEECEA] text-[#6B6B6B]"}`}>
                {c.status}
              </Badge>
              <button
                onClick={e => { e.stopPropagation(); setClientConfirm({ open: true, title: "Remove Client?", description: `Remove ${c.name} from your clients? This cannot be undone.`, onConfirm: () => deleteClient.mutate({ id: c.id }) }); }}
                className="p-2 rounded-lg hover:bg-red-500/100/10 text-[#3D3D3D] hover:text-red-500 transition-colors"
                aria-label={`Delete ${c.name}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
                ))}
      </div>}
      {/* Add Client Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add New Client">
        <div className="space-y-4">
          <Field label="Full Name" value={form.name} onChange={setFormName} placeholder="Jane Smith" required autoComplete="name" enterKeyHint="next" />
          <Field label="Email Address" value={form.email} onChange={setFormEmail} placeholder="jane@example.com" type="email" autoComplete="email" enterKeyHint="next" />
          <Field label="Phone Number" value={form.phone} onChange={setFormPhone} placeholder="+1 (555) 000-0000" type="tel" autoComplete="tel" enterKeyHint="next" />
          <Field label="Service / Niche" value={form.service} onChange={setFormService} placeholder="Business Coaching, Web Design..." autoComplete="off" enterKeyHint="next" />
          <Field label="Default Hourly Rate ($)" value={form.defaultRate} onChange={setFormDefaultRate} placeholder="0.00" type="number" autoComplete="off" enterKeyHint="next" />
          <div>
            <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as typeof form.status }))} className="form-input-light">
              <option value="active">Active</option>
              <option value="prospect">Prospect / Lead</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <Field label="Notes" value={form.notes} onChange={setFormNotes} placeholder="Any important notes about this client..." textarea rows={3} />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="flex-1 gradient-amber text-white border-0 hover:opacity-90" onClick={handleCreate} disabled={createClient.isPending}>
              {createClient.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Client"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Client Profile Modal */}
      <Modal open={!!selectedId} onClose={() => { setSelectedId(null); setProfileTab("info"); }} title="Client Profile" wide>
        {selectedClient && (
          <div className="space-y-4">
            {/* Profile Tab Bar */}
            <div className="flex gap-1 bg-[#EEECEA] rounded-xl p-1">
              {(["info", "tags", "messages"] as const).map(t => (
                <button key={t} onClick={() => setProfileTab(t)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    profileTab === t ? "bg-[#D4922A]/20 text-[#D4922A] shadow-sm" : "text-[#3D3D3D] hover:text-[#2A2A2A]"
                  }`}>
                  {t === "messages" ? "Messages" : t === "tags" ? "Tags" : "Info"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl gradient-amber flex items-center justify-center text-white text-lg font-bold">
                {selectedClient.avatarInitials || selectedClient.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1A1A1A]">{selectedClient.name}</h3>
                <p className="text-sm text-[#6B6B6B]">{selectedClient.service || "General Client"}</p>
                <Badge className={`text-xs border-0 mt-1 ${selectedClient.status === "active" ? "bg-green-500/10 text-green-600" : selectedClient.status === "prospect" ? "bg-yellow-50 text-yellow-600" : "bg-[#EEECEA] text-[#6B6B6B]"}`}>
                  {selectedClient.status}
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Mail, label: "Email", value: selectedClient.email || "Not provided" },
                { icon: Phone, label: "Phone", value: selectedClient.phone || "Not provided" },
                { icon: DollarSign, label: "Default Rate", value: selectedClient.defaultRate ? `$${parseFloat(selectedClient.defaultRate).toFixed(2)}/hr` : "Not set" },
                { icon: Calendar, label: "Added", value: formatDate(selectedClient.createdAt) },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-[#F7F6F3] rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-3.5 h-3.5 text-[#6B6B6B]" />
                    <p className="text-xs text-[#6B6B6B]">{label}</p>
                  </div>
                  <p className="text-sm font-semibold text-[#1A1A1A] truncate">{value}</p>
                </div>
              ))}
            </div>
            {profileTab === "tags" && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input value={newTag} onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && newTag.trim()) { addTag.mutate({ clientId: selectedClient.id, tag: newTag.trim() }); setNewTag(""); } }}
                    placeholder="Add tag (e.g. VIP, Referral, Hot Lead)" className="form-input-light flex-1 text-sm" />
                  <Button size="sm" onClick={() => { if (newTag.trim()) { addTag.mutate({ clientId: selectedClient.id, tag: newTag.trim() }); setNewTag(""); } }}
                    disabled={!newTag.trim() || addTag.isPending} className="gradient-amber text-white border-0">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {clientTagsData.length === 0 && <p className="text-xs text-[#3D3D3D]">No tags yet. Add your first tag above.</p>}
                  {clientTagsData.map(t => (
                    <span key={t.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4922A]/10 text-[#D4922A] text-xs font-semibold">
                      {t.tag}
                      <button onClick={() => removeTag.mutate({ clientId: selectedClient.id, tag: t.tag })} className="hover:text-red-500 transition-colors" aria-label={`Remove ${t.tag}`}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {profileTab === "messages" && (
              <div className="space-y-3">
                <div className="max-h-64 overflow-y-auto space-y-2 bg-[#F7F6F3] rounded-xl p-3">
                  {messages.length === 0 && <p className="text-xs text-[#3D3D3D] text-center py-4">No messages yet. Clients can message you from their portal.</p>}
                  {(messages as Array<{ id: number; senderRole: string; body: string; createdAt: Date }>).map(m => (
                    <div key={m.id} className={`flex ${ m.senderRole === "owner" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                        m.senderRole === "owner" ? "bg-[#D4922A] text-white" : "bg-white border border-[#DDDBD7] text-[#1A1A1A]"
                      }`}>
                        <p>{m.body}</p>
                        <p className={`text-[10px] mt-1 ${ m.senderRole === "owner" ? "text-white/70" : "text-[#3D3D3D]"}`}>{new Date(m.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={msgText} onChange={e => setMsgText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && msgText.trim()) { sendReply.mutate({ clientId: selectedClient.id, body: msgText }); } }}
                    placeholder="Reply to client..." className="form-input-light flex-1 text-sm" />
                  <Button size="sm" onClick={() => { if (msgText.trim()) sendReply.mutate({ clientId: selectedClient.id, body: msgText }); }}
                    disabled={!msgText.trim() || sendReply.isPending} className="gradient-amber text-white border-0">
                    Send
                  </Button>
                </div>
              </div>
            )}
            {profileTab === "info" && selectedClient.notes && (
              <div className="bg-[#F7F6F3] rounded-xl p-4">
                <p className="text-xs font-semibold text-[#6B6B6B] mb-1">Notes</p>
                <p className="text-sm text-[#2A2A2A] whitespace-pre-wrap">{selectedClient.notes}</p>
              </div>
            )}
            {profileTab === "info" && (
              <div className="bg-[#F7F6F3] rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-[#6B6B6B]">Private client fields</p>
                  <p className="text-xs text-[#8A8A8A] mt-1">Owner-only profile details. These fields are never shown in the client portal.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input value={newCustomField.label} onChange={e => setNewCustomField(current => ({ ...current, label: e.target.value }))} placeholder="Field label" className="form-input-light text-sm" maxLength={80} />
                  <input value={newCustomField.fieldKey} onChange={e => setNewCustomField(current => ({ ...current, fieldKey: e.target.value }))} placeholder="field_key" className="form-input-light text-sm" maxLength={80} />
                  <select value={newCustomField.fieldType} onChange={e => setNewCustomField(current => ({ ...current, fieldType: e.target.value as "text" | "select" }))} className="form-input-light text-sm"><option value="text">Text</option><option value="select">Select</option></select>
                  {newCustomField.fieldType === "select" && <input value={newCustomField.options} onChange={e => setNewCustomField(current => ({ ...current, options: e.target.value }))} placeholder="Options, separated by commas" className="form-input-light text-sm" maxLength={500} />}
                </div>
                <Button size="sm" variant="outline" disabled={!newCustomField.label.trim() || !newCustomField.fieldKey.trim() || (newCustomField.fieldType === "select" && !newCustomField.options.trim()) || createClientCustomField.isPending} onClick={() => createClientCustomField.mutate({ label: newCustomField.label.trim(), fieldKey: newCustomField.fieldKey.trim(), fieldType: newCustomField.fieldType, options: newCustomField.fieldType === "select" ? newCustomField.options.split(",").map(option => option.trim()).filter(Boolean) : [] })}>Add private field</Button>
              </div>
            )}
            {profileTab === "info" && !!clientCustomFields?.length && (
              <div className="bg-[#F7F6F3] rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-[#6B6B6B]">Private custom fields</p>
                {clientCustomFields.filter(field => field.active).map(field => {
                  const value = selectedClientCustomValues?.find(item => item.fieldId === field.id)?.value ?? "";
                  const options = field.fieldType === "select" ? (JSON.parse(field.options || "[]") as string[]) : [];
                  return <label key={field.id} className="block text-xs font-medium text-[#4A4A4A]">{field.label}
                    {field.fieldType === "select" ? <select value={value} onChange={e => setClientCustomValue.mutate({ clientId: selectedClient.id, fieldId: field.id, value: e.target.value || null })} className="form-input-light mt-1 w-full text-sm"><option value="">Not set</option>{options.map(option => <option key={option} value={option}>{option}</option>)}</select> : <input defaultValue={value} onBlur={e => { if (e.target.value !== value) setClientCustomValue.mutate({ clientId: selectedClient.id, fieldId: field.id, value: e.target.value.trim() || null }); }} className="form-input-light mt-1 w-full text-sm" maxLength={2000} />}
                  </label>;
                })}
              </div>
            )}
            {/* Document Storage & Actions - only show on Info tab */}
            {profileTab === "info" && (
              <>
                <div className="bg-[#F7F6F3] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-[#6B6B6B]">Documents ({clientDocs?.length || 0})</p>
                    <label className={`text-xs font-semibold cursor-pointer px-3 py-1.5 rounded-lg transition-colors ${docUploading ? 'opacity-50 pointer-events-none' : 'bg-[#D4922A]/10 text-[#D4922A] hover:bg-[#D4922A]/20'}`}>
                      {docUploading ? 'Uploading...' : '+ Upload'}
                      <input type="file" className="sr-only" onChange={handleDocUpload} disabled={docUploading} accept="*/*" />
                    </label>
                  </div>
                  {!clientDocs || clientDocs.length === 0 ? (
                    <p className="text-xs text-[#6B6B6B] text-center py-3">No documents yet. Upload contracts, briefs, or any files.</p>
                  ) : (
                    <div className="space-y-2">
                      {clientDocs.map(doc => (
                        <div key={doc.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-[#DDDBD7]">
                          <FileText className="w-3.5 h-3.5 text-[#D4922A] flex-shrink-0" />
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-xs font-medium text-[#1A1A1A] truncate hover:underline">{doc.fileName}</a>
                          {doc.sizeBytes && <span className="text-[10px] text-[#6B6B6B] flex-shrink-0">{(doc.sizeBytes / 1024).toFixed(0)} KB</span>}
                          <button type="button" onClick={() => setDocumentVisibility.mutate({ id: doc.id, clientVisible: !doc.clientVisible })} disabled={setDocumentVisibility.isPending} className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors disabled:opacity-60 ${doc.clientVisible ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`} aria-label={`${doc.clientVisible ? "Remove" : "Share"} ${doc.fileName} ${doc.clientVisible ? "from" : "in"} client portal`}>{doc.clientVisible ? "Shared" : "Private"}</button>
                          <button onClick={() => deleteDoc.mutate({ id: doc.id })} className="p-2 rounded hover:bg-red-500/100/10 text-[#3D3D3D] hover:text-red-500 transition-colors flex-shrink-0" aria-label="Delete document">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-3 flex-wrap">
                  <Button
                    className="flex-1 gradient-amber text-white border-0 hover:opacity-90 gap-2"
                    onClick={() => { updateClient.mutate({ id: selectedClient.id, status: "active" }); }}
                    disabled={updateClient.isPending}
                  >
                    <CheckCircle className="w-4 h-4" />Mark Active
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 border-blue-200 text-blue-600 hover:bg-blue-50"
                    onClick={() => getPortalToken.mutate({ clientId: selectedClient.id, origin: window.location.origin })}
                    disabled={getPortalToken.isPending}
                  >
                    <ExternalLink className="w-4 h-4" />{getPortalToken.isPending ? "Generating..." : "Share Portal"}
                  </Button>
                  {portalStatus?.active && (
                    <Button
                      variant="outline"
                      className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50"
                      onClick={() => setClientConfirm({
                        open: true,
                        title: "Revoke client portal link?",
                        description: "The current client portal URL will stop working immediately. You can create and share a new link at any time.",
                        onConfirm: () => revokePortalToken.mutate({ clientId: selectedClient.id }),
                      })}
                      disabled={revokePortalToken.isPending}
                    >
                      <Link2 className="w-4 h-4" />{revokePortalToken.isPending ? "Revoking..." : "Revoke Portal"}
                    </Button>
                  )}
                  <Button variant="outline" className="gap-2 border-red-200 text-red-500 hover:bg-red-500/100/10" onClick={() => setClientConfirm({ open: true, title: "Remove Client?", description: `Remove ${selectedClient.name}? This cannot be undone.`, onConfirm: () => { deleteClient.mutate({ id: selectedClient.id }); setSelectedId(null); } })}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={clientConfirm.open}
        onOpenChange={(open) => !open && setClientConfirm(defaultConfirm)}
        title={clientConfirm.title}
        description={clientConfirm.description}
        onConfirm={() => { clientConfirm.onConfirm(); setClientConfirm(defaultConfirm); }}
        confirmLabel="Remove"
        variant="destructive"
      />

      {/* CSV Import Modal */}
      <Modal open={showCsvImport} onClose={() => { setShowCsvImport(false); setCsvText(""); setCsvPreview([]); }} title="Import Clients from CSV">
        <div className="space-y-4">
          {/* Info + Download Template */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 flex items-start justify-between gap-3">
            <div>
              <strong>Expected columns:</strong> name, email, phone, service, status (active/inactive/prospect). First row can be a header row — works with exports from HoneyBook, Dubsado, 17hats, Notion, and most CRMs.
            </div>
            <button
              onClick={() => {
                const template = "name,email,phone,service,status\nJane Smith,jane@example.com,+15550001234,Coaching,active\nJohn Doe,john@example.com,,Web Design,active";
                const blob = new Blob([template], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = "clients-import-template.csv"; a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex-shrink-0 text-blue-700 underline underline-offset-2 font-semibold hover:text-blue-900 whitespace-nowrap"
            >
              Download Template
            </button>
          </div>

          {/* File upload */}
          <div>
            <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Upload a CSV file</label>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-[#DDDBD7] rounded-xl p-4 cursor-pointer hover:border-[#D4922A]/60 hover:bg-amber-500/5 transition-colors">
              <Upload className="w-4 h-4 text-[#3D3D3D]" />
              <span className="text-xs text-[#6B6B6B]">Click to choose a .csv file, or drag and drop</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = ev => {
                    const text = ev.target?.result as string;
                    setCsvText(text);
                    parseCsv(text);
                  };
                  reader.readAsText(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          {/* Or paste manually */}
          <div>
            <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Or paste CSV content directly</label>
            <textarea
              value={csvText}
              onChange={e => { setCsvText(e.target.value); parseCsv(e.target.value); }}
              placeholder={`name,email,phone,service\nJane Smith,jane@example.com,+1555000,Coaching\nJohn Doe,john@example.com,,Web Design`}
              rows={5}
              maxLength={50000}
              className="form-input-light resize-none font-mono text-xs"
            />
          </div>
          {csvPreview.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#6B6B6B] mb-2">{csvPreview.length} client{csvPreview.length > 1 ? "s" : ""} detected — preview (first 5):</p>
              <div className="border border-[#DDDBD7] rounded-xl overflow-hidden">
                {csvPreview.slice(0, 5).map((row, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 border-t border-[#EEECEA] first:border-t-0 text-xs">
                    <div className="w-6 h-6 rounded-full gradient-amber flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                      {row.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#1A1A1A] truncate">{row.name}</p>
                      <p className="text-[#6B6B6B] truncate">{row.email || "No email"}</p>
                    </div>
                    <span className="text-[#6B6B6B]">{row.service || "—"}</span>
                  </div>
                ))}
                {csvPreview.length > 5 && <div className="px-3 py-2 text-xs text-[#6B6B6B] border-t border-[#EEECEA]">+{csvPreview.length - 5} more...</div>}
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => { setShowCsvImport(false); setCsvText(""); setCsvPreview([]); }}>Cancel</Button>
            <Button
              className="flex-1 gradient-amber text-white border-0 hover:opacity-90"
              onClick={() => importCsv.mutate({ rows: csvPreview.map(r => ({ name: r.name, email: r.email || undefined, phone: r.phone || undefined, service: r.service || undefined, status: (r.status as any) || "active" })) })}
              disabled={csvPreview.length === 0 || importCsv.isPending}
            >
              {importCsv.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : `Import ${csvPreview.length} Client${csvPreview.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


export { ClientsPanel };
