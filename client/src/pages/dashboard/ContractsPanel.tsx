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

// ─── Contracts & Proposals Panel ────────────────────────────────────────────
function ContractsPanel() {
  const utils = trpc.useUtils();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<"all" | "contract" | "proposal">("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(defaultConfirm);
  const [previewContract, setPreviewContract] = useState<any>(null);
  const emptyForm = { clientName: "", clientEmail: "", title: "", type: "contract" as "contract" | "proposal", body: "", proposalAmount: "", expiresAt: "" };

  const CONTRACT_TEMPLATES = [
    {
      label: "Web Design Contract",
      type: "contract" as const,
      title: "Freelance Web Design Contract",
      body: `# Freelance Web Design Contract

## Parties
This agreement is between **[Your Business Name]** ("Designer") and **[Client Name]** ("Client").

## Scope of Work
Designer agrees to provide the following services:
- Custom website design and development
- Up to [X] pages / screens
- Responsive design for desktop, tablet, and mobile
- [X] rounds of revisions

## Timeline
- Project start: [Start Date]
- First draft delivery: [Draft Date]
- Final delivery: [End Date]

## Payment
- Total project fee: $[Amount]
- 50% deposit due before work begins
- Remaining 50% due upon final delivery
- Late payments incur a 1.5% monthly fee

## Intellectual Property
All final deliverables become Client's property upon receipt of full payment. Designer retains the right to display the work in their portfolio.

## Revisions
This contract includes [X] rounds of revisions. Additional revisions are billed at $[Rate]/hour.

## Termination
Either party may terminate this agreement with 7 days written notice. Client is responsible for payment for all work completed to date.

## Limitation of Liability
Designer's total liability shall not exceed the total fees paid under this contract.

## Governing Law
This agreement is governed by the laws of [State/Country].`,
    },
    {
      label: "Coaching Contract",
      type: "contract" as const,
      title: "Coaching Services Agreement",
      body: `# Coaching Services Agreement

## Parties
This agreement is between **[Your Name / Business]** ("Coach") and **[Client Name]** ("Client").

## Services
Coach agrees to provide:
- [X] coaching sessions per month, each [Duration] minutes
- Session delivery via [Zoom / Phone / In-Person]
- Email support between sessions (response within 48 hours)

## Program Duration
This agreement covers a [X]-month engagement beginning [Start Date].

## Investment
- Monthly fee: $[Amount]
- Payment due on the [1st] of each month
- Full program paid in advance: $[Discounted Amount]

## Cancellation Policy
Sessions cancelled with less than 24 hours notice are forfeited. Coach will make reasonable efforts to reschedule.

## Confidentiality
Coach agrees to keep all client information strictly confidential.

## Results Disclaimer
Coaching results depend on client effort and commitment. Coach makes no guarantees of specific outcomes.

## Termination
Either party may terminate with 30 days written notice. No refunds for sessions already paid.

## Governing Law
This agreement is governed by the laws of [State/Country].`,
    },
    {
      label: "Consulting Proposal",
      type: "proposal" as const,
      title: "Consulting Services Proposal",
      body: `# Consulting Services Proposal

## Executive Summary
Thank you for the opportunity to submit this proposal. We are excited to partner with **[Client Company]** to [brief description of goal].

## Problem Statement
[Client Company] is currently facing [describe the challenge or opportunity]. This proposal outlines how we will address this effectively.

## Proposed Solution
We recommend the following approach:
- **Phase 1:** Discovery & Audit ([Duration])
- **Phase 2:** Strategy Development ([Duration])
- **Phase 3:** Implementation & Support ([Duration])

## Deliverables
- Comprehensive audit report
- Strategic roadmap with prioritized recommendations
- [X] implementation sessions
- Final summary report and next-steps guide

## Investment
| Phase | Description | Fee |
|-------|-------------|-----|
| Phase 1 | Discovery & Audit | $[Amount] |
| Phase 2 | Strategy | $[Amount] |
| Phase 3 | Implementation | $[Amount] |
| **Total** | | **$[Total]** |

## Timeline
Estimated project duration: [X] weeks from signed agreement.

## Why Us
- [X] years of experience in [field]
- Proven track record with [type of clients]
- [Key differentiator]

## Next Steps
To proceed, please sign and return this proposal. A 50% deposit will initiate the project.

This proposal is valid for 30 days from the date above.`,
    },
    {
      label: "Retainer Agreement",
      type: "contract" as const,
      title: "Monthly Retainer Agreement",
      body: `# Monthly Retainer Agreement

## Parties
This retainer agreement is between **[Your Business Name]** ("Service Provider") and **[Client Name]** ("Client").

## Retainer Services
Service Provider will make available up to **[X] hours per month** for the following services:
- [Service 1]
- [Service 2]
- [Service 3]

## Monthly Retainer Fee
- Fee: $[Amount] per month
- Invoiced on the 1st of each month
- Payment due within [X] days of invoice

## Unused Hours
Unused hours do not roll over to the following month.

## Additional Hours
Hours beyond the retainer are billed at $[Rate]/hour, invoiced separately.

## Term
This agreement begins [Start Date] and continues month-to-month until terminated.

## Termination
Either party may terminate with 30 days written notice. Client is responsible for fees through the notice period.

## Confidentiality
Both parties agree to keep proprietary information confidential.

## Governing Law
This agreement is governed by the laws of [State/Country].`,
    },
  ];
  const [form, setForm] = useState(emptyForm);
    const setContractFormField = useFormFields(setForm);
  const setContractTitle         = setContractFormField("title");
  const setContractClientEmail   = setContractFormField("clientEmail");
  const setContractProposalAmount = setContractFormField("proposalAmount");
  const setContractExpiresAt     = setContractFormField("expiresAt");
  const { data: list = [], isLoading } = trpc.contracts.list.useQuery({ type: filterType }, { retry: 1 });
  const { data: selected } = trpc.contracts.get.useQuery({ id: selectedId! }, { enabled: !!selectedId });
  const { data: clientList = [] } = trpc.clients.list.useQuery(undefined, { retry: 1 });

  const createMut = trpc.contracts.create.useMutation({ onSuccess: () => { utils.contracts.list.invalidate(); setShowForm(false); setForm(emptyForm); toast.success("Created!"); } });
  const updateMut = trpc.contracts.update.useMutation({ onSuccess: () => { utils.contracts.list.invalidate(); utils.contracts.get.invalidate(); setShowForm(false); setEditingId(null); toast.success("Saved!"); } });
  const deleteMut = trpc.contracts.delete.useMutation({ onSuccess: () => { utils.contracts.list.invalidate(); setSelectedId(null); toast.success("Deleted."); } });
  const convertMut = trpc.contracts.convertToInvoice.useMutation({ onSuccess: (data) => { utils.contracts.list.invalidate(); toast.success(`Converted to invoice #${data.invoiceId}!`); } });

  const statusColors: Record<string, string> = {
    draft: "bg-[#EEECEA] text-[#6B6B6B]",
    sent: "bg-blue-500/15 text-blue-400",
    signed: "bg-green-500/15 text-green-400",
    declined: "bg-red-500/15 text-red-400",
    expired: "bg-orange-500/15 text-orange-400",
  };

  function openEdit(c: typeof list[0]) {
    setForm({ clientName: c.clientName, clientEmail: c.clientEmail || "", title: c.title, type: c.type, body: c.body, proposalAmount: String(c.proposalAmount || ""), expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString().split("T")[0] : "" });
    setEditingId(c.id);
    setShowForm(true);
  }

  function handleSubmit() {
    if (!form.clientName.trim() || !form.title.trim() || !form.body.trim()) { toast.error("Client name, title, and body are required."); return; }
    if (editingId) {
      updateMut.mutate({ id: editingId, ...form });
    } else {
      createMut.mutate(form);
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <ConfirmDialog open={confirm.open} onOpenChange={(o) => { if (!o) setConfirm(defaultConfirm); }} title={confirm.title} description={confirm.description} onConfirm={() => { confirm.onConfirm(); setConfirm(defaultConfirm); }} />
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#1A1A1A]">Contracts & Proposals</h2>
          <p className="text-sm text-[#6B6B6B] mt-0.5">Create, send, and track contracts and proposals</p>
        </div>
        <Button onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(true); }} className="bg-[#D4922A] hover:bg-[#D4911A] text-white gap-2">
          <Plus className="w-4 h-4" /> New
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {(["all", "contract", "proposal"] as const).map(t => (
          <button key={t} onClick={() => setFilterType(t)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all capitalize ${ filterType === t ? "bg-[#D4922A] text-white" : "bg-[#F7F6F3] text-[#6B6B6B] border border-[#DDDBD7] hover:border-[#D4922A]" }`}>{t === "all" ? "All" : t + "s"}</button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#DDDBD7] p-12 text-center">
          <FileSignature className="w-10 h-10 text-[#3D3D3D] mx-auto mb-3" />
          <p className="font-semibold text-[#2A2A2A] mb-1">No {filterType === "all" ? "contracts or proposals" : filterType + "s"} yet</p>
          <p className="text-sm text-[#6B6B6B] mb-4">Create your first one to get started</p>
          <Button onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(true); }} size="sm" className="bg-[#D4922A] hover:bg-[#D4911A] text-white">Create {filterType === "proposal" ? "Proposal" : "Contract"}</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-[#DDDBD7] p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${ c.type === "proposal" ? "bg-violet-500/15 text-violet-400" : "bg-blue-500/15 text-blue-400" }`}>{c.type}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColors[c.status] || "bg-[#EEECEA] text-[#6B6B6B]"}`}>{c.status}</span>
                    {c.proposalAmount && <span className="text-xs font-semibold text-[#D4922A]">{formatCurrency(c.proposalAmount)}</span>}
                  </div>
                  <p className="font-semibold text-[#1A1A1A] truncate">{c.title}</p>
                  <p className="text-sm text-[#6B6B6B]">{c.clientName}{c.clientEmail ? ` · ${c.clientEmail}` : ""}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={e => { e.stopPropagation(); setPreviewContract(c); }} className="p-2 rounded-lg hover:bg-blue-50 transition-colors" aria-label="Preview" title="Preview"><Eye className="w-3.5 h-3.5 text-blue-500" /></button>
                  <button onClick={e => { e.stopPropagation(); openEdit(c); }} className="p-2 rounded-lg hover:bg-[#EEECEA] transition-colors" aria-label="Edit"><Edit2 className="w-3.5 h-3.5 text-[#6B6B6B]" /></button>
                  {c.type === "proposal" && c.status === "signed" && !c.linkedInvoiceId && (
                    <button onClick={e => { e.stopPropagation(); convertMut.mutate({ id: c.id }); }} className="p-2 rounded-lg hover:bg-green-500/10 transition-colors" aria-label="Convert to invoice" title="Convert to Invoice"><ArrowUpRight className="w-3.5 h-3.5 text-green-600" /></button>
                  )}
                  <button onClick={e => { e.stopPropagation(); setConfirm({ open: true, title: "Delete?", description: `Delete "${c.title}"? This cannot be undone.`, onConfirm: () => deleteMut.mutate({ id: c.id }) }); }} className="p-2 rounded-lg hover:bg-red-500/100/10 transition-colors" aria-label="Delete"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                </div>
              </div>
              {/* Expanded detail */}
              {selectedId === c.id && selected && (
                <div className="mt-4 pt-4 border-t border-[#DDDBD7]">
                  <div className="bg-[#F7F6F3] rounded-xl p-4 text-sm text-[#2A2A2A] whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">{selected.body}</div>
                  <div className="flex items-center gap-3 mt-3">
                    {c.status === "draft" && <button onClick={e => { e.stopPropagation(); updateMut.mutate({ id: c.id, status: "sent" }); }} className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"><Send className="w-3 h-3" /> Mark as Sent</button>}
                    {c.status === "sent" && <button onClick={e => { e.stopPropagation(); updateMut.mutate({ id: c.id, status: "signed" }); }} className="text-xs font-semibold text-green-600 hover:underline flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Mark as Signed</button>}
                    {c.status === "sent" && <button onClick={e => { e.stopPropagation(); updateMut.mutate({ id: c.id, status: "declined" }); }} className="text-xs font-semibold text-red-500 hover:underline">Mark as Declined</button>}
                    {c.expiresAt && <span className="text-xs text-[#6B6B6B] ml-auto">Expires {formatDate(c.expiresAt)}</span>}
                    {c.sentAt && <span className="text-xs text-[#6B6B6B]">Sent {formatDate(c.sentAt)}</span>}
                    {c.signedAt && <span className="text-xs text-green-600 font-medium">Signed {formatDate(c.signedAt)}</span>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={showForm} onClose={() => { setShowForm(false); setEditingId(null); }} title={editingId ? "Edit" : "New Contract / Proposal"} wide>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Type *</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as "contract" | "proposal" }))} className="form-input-light">
                <option value="contract">Contract</option>
                <option value="proposal">Proposal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Client *</label>
              <input list="contract-clients" value={form.clientName} onChange={e => { const c = clientList.find(c => c.name === e.target.value); setForm(p => ({ ...p, clientName: e.target.value, clientEmail: c?.email || p.clientEmail })); }} placeholder="Client name" className="form-input-light" />
              <datalist id="contract-clients">{clientList.map(c => <option key={c.id} value={c.name} />)}</datalist>
            </div>
          </div>
          <Field label="Title *" value={form.title} onChange={setContractTitle} placeholder="e.g. Freelance Web Design Contract" />
          <Field label="Client Email" value={form.clientEmail} onChange={setContractClientEmail} type="email" placeholder="client@example.com" />
          {form.type === "proposal" && <Field label="Proposal Amount ($)" value={form.proposalAmount} onChange={setContractProposalAmount} type="number" placeholder="1500" />}
          <Field label="Expiry Date" value={form.expiresAt} onChange={setContractExpiresAt} type="date" />
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#6B6B6B]">Body / Terms *</label>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#3D3D3D]">Start from template:</span>
                <select
                  className="text-xs border border-[#DDDBD7] rounded-lg px-2 py-1 bg-[#F7F6F3] text-[#2A2A2A] hover:border-[#D4922A] focus:outline-none focus:ring-1 focus:ring-[#D4922A]"
                  defaultValue=""
                  onChange={e => {
                    const tpl = CONTRACT_TEMPLATES.find(t => t.label === e.target.value);
                    if (tpl) {
                      setForm(p => ({ ...p, type: tpl.type, title: p.title || tpl.title, body: tpl.body }));
                      e.target.value = "";
                    }
                  }}
                >
                  <option value="">— Choose template —</option>
                  {CONTRACT_TEMPLATES.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} rows={10} maxLength={50000} placeholder="Enter the contract terms, scope of work, deliverables, payment terms..." className="form-input-light resize-y" />
            <p className="text-xs text-[#6B6B6B] mt-1">Markdown supported. Use **bold**, # headings, - bullet lists.</p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending} className="bg-[#D4922A] hover:bg-[#D4911A] text-white flex-1">
              {(createMut.isPending || updateMut.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? "Save Changes" : "Create"}
            </Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }} className="flex-1">Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Contract / Proposal Preview Modal */}
      <Modal open={!!previewContract} onClose={() => setPreviewContract(null)} title="Document Preview" wide>
        {previewContract && (
          <div className="font-sans">
            {/* Accent bar */}
            <div className="h-1 bg-[#D4922A] rounded-t-lg -mx-6 -mt-2 mb-5" />

            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide mr-2 ${
                  previewContract.type === "proposal" ? "bg-violet-500/15 text-violet-400" : "bg-blue-500/15 text-blue-400"
                }`}>{previewContract.type}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                  previewContract.status === "signed" ? "bg-green-500/15 text-green-400" :
                  previewContract.status === "sent" ? "bg-blue-500/15 text-blue-400" :
                  previewContract.status === "declined" ? "bg-red-500/15 text-red-400" :
                  "bg-[#EEECEA] text-[#6B6B6B]"
                }`}>{previewContract.status}</span>
                <h2 className="text-xl font-extrabold text-[#1A1A1A] mt-2 tracking-tight">{previewContract.title}</h2>
              </div>
              {previewContract.proposalAmount && (
                <div className="text-right">
                  <p className="text-[10px] text-[#3D3D3D] uppercase tracking-wide">Value</p>
                  <p className="text-xl font-extrabold text-[#D4922A]">{formatCurrency(previewContract.proposalAmount)}</p>
                </div>
              )}
            </div>

            {/* Parties */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-[#F7F6F3] border border-[#DDDBD7] rounded-lg p-3">
                <p className="text-[10px] font-bold text-[#3D3D3D] uppercase tracking-wide mb-1">Client</p>
                <p className="text-sm font-semibold text-[#1A1A1A]">{previewContract.clientName}</p>
                {previewContract.clientEmail && <p className="text-xs text-[#3D3D3D]">{previewContract.clientEmail}</p>}
              </div>
              <div className="bg-[#F7F6F3] border border-[#DDDBD7] rounded-lg p-3">
                <p className="text-[10px] font-bold text-[#3D3D3D] uppercase tracking-wide mb-1">Dates</p>
                <p className="text-xs text-[#6B6B6B]">Created {formatDate(previewContract.createdAt)}</p>
                {previewContract.expiresAt && <p className="text-xs text-[#3D3D3D]">Expires {formatDate(previewContract.expiresAt)}</p>}
                {previewContract.signedAt && <p className="text-xs text-green-600 font-medium">Signed {formatDate(previewContract.signedAt)}</p>}
              </div>
            </div>

            {/* Body — rendered as document */}
            <div className="border border-[#DDDBD7] rounded-lg overflow-hidden mb-5">
              <div className="bg-[#F7F6F3] border-b border-[#DDDBD7] px-4 py-2">
                <p className="text-[10px] font-bold text-[#3D3D3D] uppercase tracking-wide">Document Body</p>
              </div>
              <div className="bg-white px-5 py-5 max-h-72 overflow-y-auto">
                {previewContract.body.split("\n").map((line: string, i: number) => {
                  if (line.startsWith("# ")) return <h1 key={i} className="text-lg font-extrabold text-[#1A1A1A] mt-4 mb-2 first:mt-0">{line.slice(2)}</h1>;
                  if (line.startsWith("## ")) return <h2 key={i} className="text-base font-bold text-[#1A1A1A] mt-3 mb-1.5">{line.slice(3)}</h2>;
                  if (line.startsWith("### ")) return <h3 key={i} className="text-sm font-bold text-[#1A1A1A] mt-2 mb-1">{line.slice(4)}</h3>;
                  if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="text-sm text-[#2A2A2A] ml-4 list-disc leading-relaxed">{line.slice(2)}</li>;
                  if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="text-sm font-bold text-[#1A1A1A] my-1">{line.slice(2, -2)}</p>;
                  if (line.trim() === "") return <div key={i} className="h-2" />;
                  return <p key={i} className="text-sm text-[#2A2A2A] leading-relaxed my-1">{line}</p>;
                })}
              </div>
            </div>

            {/* Signature block */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="border border-dashed border-[#C8C5BF] rounded-lg p-4 text-center">
                <p className="text-[10px] text-[#3D3D3D] uppercase tracking-wide mb-3">Client Signature</p>
                <div className="h-8 border-b border-[#C8C5BF] mb-2" />
                <p className="text-xs text-[#3D3D3D]">{previewContract.clientName}</p>
                {previewContract.signedAt && <p className="text-[10px] text-green-600 font-medium mt-1">Signed {formatDate(previewContract.signedAt)}</p>}
              </div>
              <div className="border border-dashed border-[#C8C5BF] rounded-lg p-4 text-center">
                <p className="text-[10px] text-[#3D3D3D] uppercase tracking-wide mb-3">Service Provider</p>
                <div className="h-8 border-b border-[#C8C5BF] mb-2" />
                <p className="text-xs text-[#3D3D3D]">TrueAxis HQ</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button className="flex-1 bg-[#D4922A] hover:bg-[#D4911A] text-white gap-2" onClick={() => { openEdit(previewContract); setPreviewContract(null); }}>
                <Edit2 className="w-4 h-4" /> Edit Document
              </Button>
              <Button variant="outline" className="flex-1 gap-2" onClick={() => setPreviewContract(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}


export { ContractsPanel };
