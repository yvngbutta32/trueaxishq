import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  FileText, Plus, Send, Trash2, Eye, CheckCircle, Clock, XCircle,
  DollarSign, Pencil, ArrowRight, Copy, ExternalLink, Sparkles, Loader2, Layers,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "rgba(26,26,26,0.3)",
  sent: "#3B82F6",
  viewed: "#F59E0B",
  signed: "#34D399",
  declined: "#FF6B6B",
};
const STATUS_ICONS: Record<string, any> = {
  draft: Clock, sent: Send, viewed: Eye, signed: CheckCircle, declined: XCircle,
};

type LineItem = { id: string; name: string; description: string; qty: number; unitPrice: number; total: number };
type PackageOption = { id: string; name: string; description: string; lineItems: LineItem[] };
type ProposalForm = {
  clientName: string; clientEmail: string; title: string; scope: string;
  lineItems: LineItem[]; packageOptions: PackageOption[]; taxRate: string; currency: string; validUntil: string; notes: string;
};

const newLineItem = (): LineItem => ({ id: crypto.randomUUID(), name: "", description: "", qty: 1, unitPrice: 0, total: 0 });
const newPackageOption = (name = ""): PackageOption => ({ id: crypto.randomUUID(), name, description: "", lineItems: [newLineItem()] });
const EMPTY_FORM: ProposalForm = {
  clientName: "", clientEmail: "", title: "", scope: "", lineItems: [newLineItem()], packageOptions: [],
  taxRate: "0", currency: "USD", validUntil: "", notes: "",
};

export default function Proposals() {
  const utils = trpc.useUtils();
  const { data: proposalList = [], isLoading } = trpc.proposals.list.useQuery();
  const createMut = trpc.proposals.create.useMutation({
    onSuccess: () => { utils.proposals.list.invalidate(); toast.success("Proposal created"); setOpen(false); setForm(EMPTY_FORM); },
    onError: e => toast.error(e.message),
  });
  const deleteMut = trpc.proposals.delete.useMutation({
    onSuccess: () => { utils.proposals.list.invalidate(); toast.success("Proposal deleted"); },
    onError: e => toast.error(e.message),
  });
  const sendMut = trpc.proposals.send.useMutation({
    onSuccess: (data) => {
      utils.proposals.list.invalidate();
      toast.success("Proposal sent!");
      if (data.link) { navigator.clipboard.writeText(data.link).catch(() => {}); toast.info("Link copied to clipboard"); }
    },
    onError: e => toast.error(e.message),
  });
  const convertMut = trpc.proposals.convertToInvoice.useMutation({
    onSuccess: (data) => { utils.proposals.list.invalidate(); toast.success(`Invoice ${data.invoiceNumber} created`); },
    onError: e => toast.error(e.message),
  });
  const aiGenerateMut = trpc.ai.generateProposal.useMutation({
    onSuccess: (data) => {
      const d = data.draft;
      const scopeParts: string[] = [];
      if (d.executiveSummary) scopeParts.push(d.executiveSummary);
      if (d.scopeOfWork?.length) scopeParts.push("\n\nScope of Work:\n" + d.scopeOfWork.map((s: string) => `• ${s}`).join("\n"));
      if (d.timeline) scopeParts.push(`\n\nTimeline: ${d.timeline}`);
      if (d.deliverables?.length) scopeParts.push("\n\nDeliverables:\n" + d.deliverables.map((s: string) => `• ${s}`).join("\n"));

      const lineItems: LineItem[] = (d.lineItems ?? []).map((li: { name?: string; description?: string; qty?: number; unitPrice?: number }) => ({
        id: crypto.randomUUID(),
        name: li.name ?? "",
        description: li.description ?? "",
        qty: li.qty ?? 1,
        unitPrice: li.unitPrice ?? 0,
        total: (li.qty ?? 1) * (li.unitPrice ?? 0),
      }));

      const validUntilDate = new Date();
      validUntilDate.setDate(validUntilDate.getDate() + (d.validDays ?? 30));
      const validUntil = validUntilDate.toISOString().split("T")[0];

      setForm(prev => ({
        ...prev,
        title: d.title ?? prev.title,
        scope: scopeParts.join(""),
        lineItems: lineItems.length > 0 ? lineItems : prev.lineItems,
        taxRate: String(d.taxRate ?? prev.taxRate),
        notes: d.terms ?? prev.notes,
        validUntil,
      }));

      setAiOpen(false);
      setAiBrief("");
      toast.success("Proposal draft generated — review and adjust before sending");
    },
    onError: e => toast.error(`AI generation failed: ${e.message}`),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProposalForm>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);

  // AI Writer state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiBrief, setAiBrief] = useState("");

  const { data: previewProposal } = trpc.proposals.get.useQuery({ id: previewId! }, { enabled: previewId !== null });

  const subtotal = form.lineItems.reduce((s, li) => s + li.total, 0);
  const taxAmt = subtotal * (parseFloat(form.taxRate || "0") / 100);
  const total = subtotal + taxAmt;

  function updateLineItem(id: string, field: keyof LineItem, value: string | number) {
    setForm(p => ({
      ...p,
      lineItems: p.lineItems.map(li => {
        if (li.id !== id) return li;
        const updated = { ...li, [field]: value };
        if (field === "qty" || field === "unitPrice") updated.total = updated.qty * updated.unitPrice;
        return updated;
      }),
    }));
  }

  function updatePackageLineItem(packageId: string, itemId: string, field: keyof LineItem, value: string | number) {
    setForm(p => ({ ...p, packageOptions: p.packageOptions.map(option => option.id !== packageId ? option : {
      ...option,
      lineItems: option.lineItems.map(item => {
        if (item.id !== itemId) return item;
        const updated = { ...item, [field]: value };
        if (field === "qty" || field === "unitPrice") updated.total = updated.qty * updated.unitPrice;
        return updated;
      }),
    }) }));
  }

  function handleSubmit() {
    if (!form.clientName.trim()) return toast.error("Client name is required");
    if (!form.title.trim()) return toast.error("Proposal title is required");
    if (!form.packageOptions.length && form.lineItems.some(li => !li.name.trim())) return toast.error("All line items need a name");
    if (form.packageOptions.length && (form.packageOptions.length < 2 || form.packageOptions.some(option => !option.name.trim() || option.lineItems.some(item => !item.name.trim())))) return toast.error("Add a name and at least one named item to each package.");
    createMut.mutate({
      clientName: form.clientName, clientEmail: form.clientEmail || undefined,
      title: form.title, scope: form.scope || undefined,
      lineItems: form.packageOptions.length ? [] : form.lineItems,
      packageOptions: form.packageOptions.length ? form.packageOptions : undefined,
      taxRate: parseFloat(form.taxRate || "0"),
      currency: form.currency, validUntil: form.validUntil || undefined, notes: form.notes || undefined,
    });
  }

  function handleAiGenerate() {
    if (aiBrief.trim().length < 10) return toast.error("Please describe the project in at least 10 characters");
    aiGenerateMut.mutate({
      brief: aiBrief.trim(),
      clientName: form.clientName || undefined,
      currency: form.currency,
    });
  }

  function openNewProposal() {
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  const stats = {
    total: proposalList.length,
    draft: proposalList.filter(p => p.status === "draft").length,
    signed: proposalList.filter(p => p.status === "signed").length,
    totalValue: proposalList.filter(p => p.status === "signed").reduce((s, p) => s + (parseFloat(String(p.total)) || 0), 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[rgba(26,26,26,0.95)]">Proposals</h1>
          <p className="text-sm text-[rgba(26,26,26,0.55)] mt-0.5">Send professional proposals — clients sign online and you convert to invoice in one click</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => { setForm(EMPTY_FORM); setAiOpen(true); setOpen(true); }}
            variant="outline"
            className="border-[rgba(212,146,42,0.4)] text-[#D4922A] hover:bg-[rgba(212,146,42,0.1)] hover:border-[#D4922A] font-semibold gap-2"
          >
            <Sparkles className="w-4 h-4" /> Generate with AI
          </Button>
          <Button onClick={openNewProposal} className="bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold gap-2">
            <Plus className="w-4 h-4" /> New Proposal
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total, color: "#3B82F6" },
          { label: "Drafts", value: stats.draft, color: "rgba(26,26,26,0.4)" },
          { label: "Signed", value: stats.signed, color: "#34D399" },
          { label: "Signed Value", value: `$${stats.totalValue.toLocaleString(undefined,{maximumFractionDigits:0})}`, color: "#00C9A7" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-[rgba(26,26,26,0.08)] rounded-xl p-4 text-center">
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-[rgba(26,26,26,0.45)] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-white animate-pulse" />)}</div>
      ) : proposalList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[rgba(59,130,246,0.12)] flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-[#3B82F6]" />
          </div>
          <h3 className="text-lg font-semibold text-[rgba(26,26,26,0.85)] mb-2">No proposals yet</h3>
          <p className="text-sm text-[rgba(26,26,26,0.45)] mb-6 max-w-sm">Create a proposal with your scope, line items, and pricing. Send it to clients for electronic signature.</p>
          <div className="flex gap-3">
            <Button
              onClick={() => { setForm(EMPTY_FORM); setAiOpen(true); setOpen(true); }}
              variant="outline"
              className="border-[rgba(212,146,42,0.4)] text-[#D4922A] hover:bg-[rgba(212,146,42,0.1)] font-semibold gap-2"
            >
              <Sparkles className="w-4 h-4" /> Generate with AI
            </Button>
            <Button onClick={openNewProposal} className="bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold gap-2">
              <Plus className="w-4 h-4" /> Create First Proposal
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {proposalList.map(p => {
            const StatusIcon = STATUS_ICONS[p.status] ?? Clock;
            const statusColor = STATUS_COLORS[p.status] ?? "rgba(26,26,26,0.4)";
            return (
              <div key={p.id} className="group flex items-center gap-4 bg-white border border-[rgba(26,26,26,0.07)] rounded-xl px-5 py-4 hover:border-[rgba(59,130,246,0.3)] transition-all">
                <div className="w-10 h-10 rounded-xl bg-[rgba(59,130,246,0.1)] flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-[#3B82F6]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[rgba(26,26,26,0.9)] truncate">{p.title}</h3>
                    <Badge variant="outline" className="text-xs capitalize flex items-center gap-1 flex-shrink-0" style={{ borderColor: `${statusColor}40`, color: statusColor }}>
                      <StatusIcon className="w-3 h-3" />{p.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-[rgba(26,26,26,0.45)] mt-0.5">{p.clientName}{p.clientEmail ? ` · ${p.clientEmail}` : ""} · Created {new Date(p.createdAt).toLocaleDateString()}</p>
                  {p.status === "declined" && p.declineReason && <p className="mt-2 rounded-lg border border-rose-100 bg-rose-50 px-2.5 py-2 text-xs leading-5 text-rose-900"><span className="font-semibold">Client note:</span> {p.declineReason}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-[rgba(26,26,26,0.9)]">${(parseFloat(String(p.total)) || 0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
                  {p.validUntil && <p className="text-xs text-[rgba(26,26,26,0.4)]">Valid until {p.validUntil}</p>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" aria-label={`Preview proposal ${p.title}`} onClick={() => setPreviewId(p.id)} title="Preview" className="p-2 rounded-lg hover:bg-white text-[rgba(26,26,26,0.5)] hover:text-[rgba(26,26,26,0.9)] transition-colors"><Eye className="w-4 h-4" /></button>
                  {p.status === "draft" && (
                    <button type="button" aria-label={`Send proposal ${p.title}`} onClick={() => sendMut.mutate({ id: p.id, origin: window.location.origin })} title="Send" className="p-2 rounded-lg hover:bg-[rgba(59,130,246,0.15)] text-[rgba(26,26,26,0.5)] hover:text-[#3B82F6] transition-colors"><Send className="w-4 h-4" /></button>
                  )}
                  {p.status === "signed" && !p.linkedInvoiceId && (
                    <button type="button" aria-label={`Convert proposal ${p.title} to invoice`} onClick={() => convertMut.mutate({ id: p.id })} title="Convert to Invoice" className="p-2 rounded-lg hover:bg-[rgba(0,201,167,0.15)] text-[rgba(26,26,26,0.5)] hover:text-[#00C9A7] transition-colors"><ArrowRight className="w-4 h-4" /></button>
                  )}
                  {p.token && (
                    <button type="button" aria-label={`Copy secure link for proposal ${p.title}`} onClick={() => { const url = `${window.location.origin}/proposal/${p.token}`; navigator.clipboard.writeText(url); toast.success("Link copied"); }} title="Copy link" className="p-2 rounded-lg hover:bg-white text-[rgba(26,26,26,0.5)] hover:text-[rgba(26,26,26,0.9)] transition-colors"><Copy className="w-4 h-4" /></button>
                  )}
                  <button type="button" aria-label={`Delete proposal ${p.title}`} onClick={() => setDeleteConfirm(p.id)} title="Delete" className="p-2 rounded-lg hover:bg-[rgba(255,80,80,0.12)] text-[rgba(26,26,26,0.5)] hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Writer Modal (shown before Create Dialog) */}
      <Dialog open={aiOpen} onOpenChange={v => { setAiOpen(v); if (!v && !open) setAiBrief(""); }}>
        <DialogContent className="bg-white border-[rgba(212,146,42,0.25)] text-[rgba(26,26,26,0.95)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#D4922A]" />
              <span>AI Proposal Writer</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-[rgba(212,146,42,0.08)] border border-[rgba(212,146,42,0.2)] rounded-xl p-4">
              <p className="text-xs text-[rgba(26,26,26,0.6)] leading-relaxed">
                Describe the project and the AI will generate a complete proposal — title, scope of work, timeline, deliverables, line items, and payment terms. You can review and adjust everything before sending.
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5 block">Project Brief *</label>
              <Textarea
                value={aiBrief}
                onChange={e => setAiBrief(e.target.value)}
                placeholder="e.g. Build a 5-page website for a local bakery. Includes homepage, about, menu, gallery, and contact form. Need responsive design, SEO optimization, and a CMS so they can update content themselves. Budget around $3,500."
                rows={6}
                className="bg-[rgba(255,255,255,0.05)] border-[rgba(26,26,26,0.12)] text-[rgba(26,26,26,0.9)] resize-none focus:border-[rgba(212,146,42,0.5)]"
              />
              <p className="text-xs text-[rgba(26,26,26,0.35)] mt-1">{aiBrief.length} / 2000 characters</p>
            </div>
            {form.clientName && (
              <p className="text-xs text-[rgba(26,26,26,0.5)]">
                Generating for client: <span className="text-[rgba(26,26,26,0.8)] font-medium">{form.clientName}</span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setAiOpen(false); setOpen(false); }} className="text-[rgba(26,26,26,0.6)]">Cancel</Button>
            <Button
              onClick={handleAiGenerate}
              disabled={aiGenerateMut.isPending || aiBrief.trim().length < 10}
              className="bg-[#D4922A] hover:bg-[#B8791F] text-white font-semibold gap-2 min-w-[140px]"
            >
              {aiGenerateMut.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Generate Draft</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setForm(EMPTY_FORM); setAiOpen(false); setAiBrief(""); } }}>
        <DialogContent className="bg-white border-[rgba(26,26,26,0.1)] text-[rgba(26,26,26,0.95)] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>New Proposal</DialogTitle>
              <button
                onClick={() => setAiOpen(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#D4922A] hover:text-[#F0A830] bg-[rgba(212,146,42,0.1)] hover:bg-[rgba(212,146,42,0.18)] border border-[rgba(212,146,42,0.25)] rounded-lg px-3 py-1.5 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" /> Generate with AI
              </button>
            </div>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5 block">Client Name *</label>
                <Input value={form.clientName} onChange={e => setForm(p => ({...p, clientName: e.target.value}))} placeholder="Jane Smith" className="bg-[rgba(255,255,255,0.05)] border-[rgba(26,26,26,0.12)] text-[rgba(26,26,26,0.9)]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5 block">Client Email</label>
                <Input value={form.clientEmail} onChange={e => setForm(p => ({...p, clientEmail: e.target.value}))} placeholder="jane@example.com" type="email" className="bg-[rgba(255,255,255,0.05)] border-[rgba(26,26,26,0.12)] text-[rgba(26,26,26,0.9)]" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5 block">Proposal Title *</label>
              <Input value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} placeholder="e.g. Brand Strategy Package — Q3 2025" className="bg-[rgba(255,255,255,0.05)] border-[rgba(26,26,26,0.12)] text-[rgba(26,26,26,0.9)]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5 block">Scope of Work</label>
              <Textarea value={form.scope} onChange={e => setForm(p => ({...p, scope: e.target.value}))} placeholder="Describe what's included, deliverables, timeline..." rows={4} className="bg-[rgba(255,255,255,0.05)] border-[rgba(26,26,26,0.12)] text-[rgba(26,26,26,0.9)] resize-none" />
            </div>

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-[rgba(26,26,26,0.6)]">Line Items</label>
                <button onClick={() => setForm(p => ({...p, lineItems: [...p.lineItems, newLineItem()]}))} className="text-xs text-[#3B82F6] hover:text-[#60A5FA] flex items-center gap-1 transition-colors">
                  <Plus className="w-3 h-3" /> Add Line
                </button>
              </div>
              <div className="space-y-2">
                {form.lineItems.map((li) => (
                  <div key={li.id} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <Input value={li.name} onChange={e => updateLineItem(li.id, "name", e.target.value)} placeholder="Item name" className="bg-[rgba(255,255,255,0.05)] border-[rgba(26,26,26,0.12)] text-[rgba(26,26,26,0.9)] text-sm" />
                    </div>
                    <div className="col-span-2">
                      <Input value={li.qty} onChange={e => updateLineItem(li.id, "qty", parseFloat(e.target.value) || 0)} type="number" min="0" placeholder="Qty" className="bg-[rgba(255,255,255,0.05)] border-[rgba(26,26,26,0.12)] text-[rgba(26,26,26,0.9)] text-sm" />
                    </div>
                    <div className="col-span-3">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[rgba(26,26,26,0.4)] text-xs">$</span>
                        <Input value={li.unitPrice} onChange={e => updateLineItem(li.id, "unitPrice", parseFloat(e.target.value) || 0)} type="number" min="0" placeholder="Price" className="pl-5 bg-[rgba(255,255,255,0.05)] border-[rgba(26,26,26,0.12)] text-[rgba(26,26,26,0.9)] text-sm" />
                      </div>
                    </div>
                    <div className="col-span-1 text-right text-sm font-semibold text-[rgba(26,26,26,0.7)]">${li.total.toFixed(0)}</div>
                    <div className="col-span-1 flex justify-end">
                      {form.lineItems.length > 1 && (
                        <button onClick={() => setForm(p => ({...p, lineItems: p.lineItems.filter(l => l.id !== li.id)}))} className="p-1 rounded hover:bg-[rgba(255,80,80,0.12)] text-[rgba(26,26,26,0.3)] hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {/* Totals */}
              <div className="mt-3 pt-3 border-t border-[rgba(26,26,26,0.08)] space-y-1">
                <div className="flex justify-between text-sm text-[rgba(26,26,26,0.6)]">
                  <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-[rgba(26,26,26,0.6)]">
                  <div className="flex items-center gap-2">
                    <span>Tax</span>
                    <div className="relative">
                      <Input value={form.taxRate} onChange={e => setForm(p => ({...p, taxRate: e.target.value}))} type="number" min="0" max="100" className="w-16 h-6 text-xs bg-[rgba(255,255,255,0.05)] border-[rgba(26,26,26,0.12)] text-[rgba(26,26,26,0.9)] px-2" />
                    </div>
                    <span>%</span>
                  </div>
                  <span>${taxAmt.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-[rgba(26,26,26,0.95)] text-base pt-1">
                  <span>Total</span><span className="text-[#00C9A7]">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <section className="rounded-xl border border-violet-200 bg-violet-50/55 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2"><Layers className="h-4 w-4 text-violet-700" /><h3 className="text-sm font-semibold text-violet-950">Client-selectable packages</h3></div>
                  <p className="mt-1 text-xs leading-5 text-violet-900/75">Offer two or three alternatives. The client chooses one on the secure proposal link before signing. This does not request payment or create a job.</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => setForm(p => ({ ...p, packageOptions: p.packageOptions.length ? [] : [newPackageOption("Option 1"), newPackageOption("Option 2")] }))} className="border-violet-200 text-violet-800 hover:bg-violet-100">{form.packageOptions.length ? "Use single price" : "Offer options"}</Button>
              </div>
              {form.packageOptions.length > 0 && <div className="mt-4 space-y-3">
                {form.packageOptions.map((option, optionIndex) => {
                  const optionSubtotal = option.lineItems.reduce((sum, item) => sum + item.total, 0);
                  const optionTotal = optionSubtotal * (1 + parseFloat(form.taxRate || "0") / 100);
                  return <div key={option.id} className="rounded-xl border border-violet-100 bg-white p-3">
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <Input value={option.name} onChange={event => setForm(p => ({ ...p, packageOptions: p.packageOptions.map(item => item.id === option.id ? { ...item, name: event.target.value } : item) }))} placeholder={`Option ${optionIndex + 1} name`} className="border-violet-200 text-[#1A1A1A]" />
                      <div className="flex items-center gap-2"><span className="text-sm font-semibold text-violet-950">${optionTotal.toFixed(2)}</span>{form.packageOptions.length > 2 && <button type="button" aria-label={`Remove ${option.name || `option ${optionIndex + 1}`}`} onClick={() => setForm(p => ({ ...p, packageOptions: p.packageOptions.filter(item => item.id !== option.id) }))} className="rounded p-1 text-violet-500 hover:bg-violet-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}</div>
                    </div>
                    <Input value={option.description} onChange={event => setForm(p => ({ ...p, packageOptions: p.packageOptions.map(item => item.id === option.id ? { ...item, description: event.target.value } : item) }))} placeholder="What makes this option distinct? (optional)" className="mt-2 border-violet-100 text-sm text-[#1A1A1A]" />
                    {option.lineItems.map(item => <div key={item.id} className="mt-2 grid grid-cols-[minmax(0,1fr)_72px_96px_auto] items-center gap-2"><Input value={item.name} onChange={event => updatePackageLineItem(option.id, item.id, "name", event.target.value)} placeholder="Included item" className="border-violet-100 text-sm text-[#1A1A1A]" /><Input type="number" min="0" value={item.qty} onChange={event => updatePackageLineItem(option.id, item.id, "qty", Number(event.target.value) || 0)} className="border-violet-100 text-sm text-[#1A1A1A]" /><Input type="number" min="0" value={item.unitPrice} onChange={event => updatePackageLineItem(option.id, item.id, "unitPrice", Number(event.target.value) || 0)} className="border-violet-100 text-sm text-[#1A1A1A]" /><span className="text-right text-xs font-semibold text-violet-900">${item.total.toFixed(2)}</span></div>)}
                    <button type="button" onClick={() => setForm(p => ({ ...p, packageOptions: p.packageOptions.map(item => item.id === option.id ? { ...item, lineItems: [...item.lineItems, newLineItem()] } : item) }))} className="mt-2 text-xs font-semibold text-violet-700 hover:text-violet-900">+ Add package item</button>
                  </div>;
                })}
                {form.packageOptions.length < 3 && <button type="button" onClick={() => setForm(p => ({ ...p, packageOptions: [...p.packageOptions, newPackageOption(`Option ${p.packageOptions.length + 1}`)] }))} className="text-xs font-semibold text-violet-700 hover:text-violet-900">+ Add another option</button>}
              </div>}
            </section>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5 block">Valid Until</label>
                <Input type="date" value={form.validUntil} onChange={e => setForm(p => ({...p, validUntil: e.target.value}))} className="bg-[rgba(255,255,255,0.05)] border-[rgba(26,26,26,0.12)] text-[rgba(26,26,26,0.9)]" />
                <p className="mt-1 text-[11px] leading-4 text-[rgba(26,26,26,0.45)]">Optional. When set, the secure proposal link is available through the end of this UTC date.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5 block">Currency</label>
                <select value={form.currency} onChange={e => setForm(p => ({...p, currency: e.target.value}))} className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(26,26,26,0.12)] rounded-md px-3 py-2 text-sm text-[rgba(26,26,26,0.9)]">
                  {["USD","EUR","GBP","CAD","AUD"].map(c => <option key={c} value={c} className="bg-white">{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5 block">Notes / Payment Terms</label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} placeholder="Payment terms, additional notes..." rows={2} className="bg-[rgba(255,255,255,0.05)] border-[rgba(26,26,26,0.12)] text-[rgba(26,26,26,0.9)] resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} className="text-[rgba(26,26,26,0.6)]">Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending} className="bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold">
              {createMut.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating…</> : "Create Proposal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewId !== null} onOpenChange={v => !v && setPreviewId(null)}>
        <DialogContent className="bg-white border-[rgba(26,26,26,0.1)] text-[rgba(26,26,26,0.95)] max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Proposal Preview</DialogTitle></DialogHeader>
          {previewProposal && (
            <div className="space-y-4 py-2">
              <div>
                <h2 className="text-xl font-bold text-[rgba(26,26,26,0.95)]">{previewProposal.title}</h2>
                <p className="text-sm text-[rgba(26,26,26,0.5)] mt-1">For {previewProposal.clientName}{previewProposal.clientEmail ? ` · ${previewProposal.clientEmail}` : ""}</p>
              </div>
              {previewProposal.scope && (
                <div className="bg-white rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-[rgba(26,26,26,0.5)] uppercase mb-2">Scope of Work</h3>
                  <p className="text-sm text-[rgba(26,26,26,0.8)] whitespace-pre-wrap">{previewProposal.scope}</p>
                </div>
              )}
              <div>
                <h3 className="text-xs font-semibold text-[rgba(26,26,26,0.5)] uppercase mb-2">Line Items</h3>
                <div className="space-y-1">
                  {JSON.parse(previewProposal.lineItems || "[]").map((li: LineItem) => (
                    <div key={li.id} className="flex justify-between text-sm py-1 border-b border-[rgba(26,26,26,0.06)]">
                      <span className="text-[rgba(26,26,26,0.8)]">{li.name} {li.qty > 1 ? `× ${li.qty}` : ""}</span>
                      <span className="text-[rgba(26,26,26,0.7)]">${li.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-bold text-[rgba(26,26,26,0.95)] mt-2 pt-2">
                  <span>Total</span><span className="text-[#00C9A7]">${parseFloat(String(previewProposal.total)).toFixed(2)}</span>
                </div>
              </div>
              {previewProposal.token && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { const url = `${window.location.origin}/proposal/${previewProposal.token}`; navigator.clipboard.writeText(url); toast.success("Link copied"); }} className="gap-2 bg-white hover:bg-[rgba(255,255,255,0.12)] text-[rgba(26,26,26,0.8)]">
                    <Copy className="w-3.5 h-3.5" /> Copy Link
                  </Button>
                  <Button size="sm" onClick={() => window.open(`/proposal/${previewProposal.token}`, "_blank")} className="gap-2 bg-white hover:bg-[rgba(255,255,255,0.12)] text-[rgba(26,26,26,0.8)]">
                    <ExternalLink className="w-3.5 h-3.5" /> Open
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteConfirm !== null} onOpenChange={v => !v && setDeleteConfirm(null)}>
        <DialogContent className="bg-white border-[rgba(26,26,26,0.1)] text-[rgba(26,26,26,0.95)] max-w-sm">
          <DialogHeader><DialogTitle>Delete Proposal?</DialogTitle></DialogHeader>
          <p className="text-sm text-[rgba(26,26,26,0.6)]">This will permanently delete the proposal and its signing link.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)} className="text-[rgba(26,26,26,0.6)]">Cancel</Button>
            <Button variant="destructive" onClick={() => { if (deleteConfirm !== null) { deleteMut.mutate({ id: deleteConfirm }); setDeleteConfirm(null); } }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
