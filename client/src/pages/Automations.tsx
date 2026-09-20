import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Zap, Plus, Trash2, ToggleLeft, ToggleRight, Play, Clock,
  CheckCircle, XCircle, ChevronRight, AlertCircle, Pencil, History, Eye, ShieldCheck,
} from "lucide-react";

const TRIGGERS = [
  { value: "booking_confirmed", label: "Booking Confirmed", desc: "When a new booking is created" },
  { value: "invoice_sent", label: "Invoice Sent", desc: "When an invoice is marked as sent" },
  { value: "invoice_paid", label: "Invoice Paid", desc: "When an invoice is marked as paid" },
  { value: "invoice_overdue", label: "Invoice Overdue", desc: "When an invoice passes its due date" },
  { value: "client_added", label: "New Client Added", desc: "When a new client is created" },
  { value: "proposal_signed", label: "Proposal Signed", desc: "When a client signs a proposal" },
  // Note: contract_signed and follow_up_due are not yet supported by the backend engine
];

const ACTIONS = [
  { value: "send_email", label: "Send Email", desc: "Queue a client email action when configured delivery is available" },
  { value: "create_followup", label: "Create Follow-Up", desc: "Create a reviewable follow-up draft for the matching client" },
  { value: "notify_owner", label: "Notify Me", desc: "Send yourself an owner notification" },
] as const;

type TriggerType = "booking_confirmed" | "invoice_sent" | "invoice_overdue" | "client_added" | "proposal_signed" | "invoice_paid";
type ActionType = "send_email" | "create_followup" | "notify_owner";
type AutomationForm = {
  name: string;
  description: string;
  trigger: TriggerType;
  triggerDelayHours: number;
  actions: { type: ActionType; config: Record<string, string> }[];
  active: boolean;
};
const EMPTY_FORM: AutomationForm = { name: "", description: "", trigger: "booking_confirmed", triggerDelayHours: 0, actions: [{ type: "notify_owner", config: { message: "" } }], active: true };

const AUTOMATION_STARTERS: { title: string; description: string; draft: AutomationForm }[] = [
  {
    title: "Review new bookings",
    description: "Prepare an owner notification when a booking is processed.",
    draft: { name: "Review new booking", description: "Review a newly processed booking before any follow-up.", trigger: "booking_confirmed", triggerDelayHours: 0, actions: [{ type: "notify_owner", config: { title: "New booking to review", message: "A booking was processed. Review the details and choose the next step." } }], active: false },
  },
  {
    title: "Prepare invoice follow-up",
    description: "Draft a reviewable follow-up after an overdue invoice event.",
    draft: { name: "Prepare overdue invoice follow-up", description: "Create a reviewable draft for an overdue invoice event.", trigger: "invoice_overdue", triggerDelayHours: 168, actions: [{ type: "create_followup", config: { subject: "Following up on your invoice", message: "Hi, just following up on the outstanding invoice. Please let me know if you have any questions." } }], active: false },
  },
  {
    title: "Prepare client welcome",
    description: "Review a welcome email action before enabling configured delivery.",
    draft: { name: "Prepare client welcome", description: "Review a welcome email action for a new client.", trigger: "client_added", triggerDelayHours: 0, actions: [{ type: "send_email", config: { subject: "Welcome", message: "Thanks for connecting with us. We look forward to working with you." } }], active: false },
  },
];

export default function Automations() {
  const utils = trpc.useUtils();
  const { data: automations = [], isLoading } = trpc.automations.list.useQuery();
  const createMut = trpc.automations.create.useMutation({
    onSuccess: () => { utils.automations.list.invalidate(); toast.success("Automation created"); setOpen(false); setForm(EMPTY_FORM); },
    onError: e => toast.error(e.message),
  });
  const updateDetailsMut = trpc.automations.update.useMutation({
    onSuccess: () => { utils.automations.list.invalidate(); toast.success("Automation updated"); setOpen(false); setEditingId(null); setForm(EMPTY_FORM); },
    onError: e => toast.error(e.message),
  });
  const toggleMut = trpc.automations.update.useMutation({
    onSuccess: () => utils.automations.list.invalidate(),
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const deleteMut = trpc.automations.delete.useMutation({
    onSuccess: () => { utils.automations.list.invalidate(); toast.success("Automation deleted"); },
    onError: e => toast.error(e.message),
  });
  const seedMut = trpc.automations.seedTemplates.useMutation({
    onSuccess: (d: { seeded: number; message: string }) => { utils.automations.list.invalidate(); toast.success(`${d.message} — ready to activate!`); },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const testMut = trpc.automations.run.useMutation({
    onSuccess: (d: { actionsExecuted: number; skipped: string[] }) => {
      utils.automations.logs.invalidate();
      if (d.actionsExecuted > 0) toast.success(`Test ran: ${d.actionsExecuted} notification action(s) executed`);
      else toast.message(d.skipped[0] || "This automation will run when a matching event is due.");
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AutomationForm>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [logAutomationId, setLogAutomationId] = useState<number | null>(null);
  const [previewAutomationId, setPreviewAutomationId] = useState<number | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const { data: logs = [], isLoading: logsLoading } = trpc.automations.logs.useQuery(
    { automationId: logAutomationId ?? undefined, limit: 20 },
    { enabled: logAutomationId !== null },
  );
  const { data: preview, isLoading: previewLoading } = trpc.automations.preview.useQuery(
    { id: previewAutomationId ?? 0 },
    { enabled: previewAutomationId !== null },
  );

  function addAction() {
    setForm(p => ({ ...p, actions: [...p.actions, { type: "notify_owner" as ActionType, config: { message: "" } }] }));
  }

  function removeAction(idx: number) {
    setForm(p => ({ ...p, actions: p.actions.filter((_, i) => i !== idx) }));
  }
  function updateAction(idx: number, field: "type" | "config", value: ActionType | Record<string, string>) {
    setForm(p => ({
      ...p,
      actions: p.actions.map((a, i) => i === idx ? { ...a, [field]: value } : a),
    }));
  }

  function handleSubmit() {
    if (!form.name.trim()) return toast.error("Automation name is required");
    if (!form.trigger) return toast.error("Select a trigger");
    if (form.actions.length === 0) return toast.error("Add at least one action");
    const payload = {
      name: form.name,
      description: form.description || undefined,
      trigger: form.trigger,
      triggerDelayHours: form.triggerDelayHours,
      actions: form.actions,
      active: form.active,
    };
    if (editingId !== null) updateDetailsMut.mutate({ id: editingId, ...payload });
    else createMut.mutate(payload);
  }

  function openEdit(automation: typeof automations[number]) { setStep(1);
    let parsedActions: AutomationForm["actions"] = [];
    try {
      const parsed: unknown = JSON.parse(automation.actions || "[]");
      if (Array.isArray(parsed)) {
        parsedActions = parsed
          .filter((action): action is { type: ActionType; config?: unknown } => Boolean(action) && typeof action === "object" && "type" in action && ACTIONS.some(({ value }) => value === (action as { type?: string }).type))
          .map((action) => ({
            type: action.type,
            config: action.config && typeof action.config === "object"
              ? Object.fromEntries(Object.entries(action.config).filter(([, value]) => typeof value === "string"))
              : {},
          }));
      }
    } catch { /* Invalid persisted actions are reset to a safe editable default. */ }
    setEditingId(automation.id);
    setForm({
      name: automation.name,
      description: automation.description ?? "",
      trigger: automation.trigger as TriggerType,
      triggerDelayHours: automation.triggerDelayHours ?? 0,
      actions: parsedActions.length ? parsedActions : [{ type: "notify_owner", config: { message: "" } }],
      active: automation.active,
    });
    setOpen(true);
  }

  const activeCount = automations.filter(a => a.active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[rgba(26,26,26,0.95)]">Workflow Automation</h1>
          <p className="text-sm text-[rgba(26,26,26,0.55)] mt-0.5">Configure triggers and actions, review readiness, and inspect recorded outcomes.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => seedMut.mutate()} disabled={seedMut.isPending} variant="outline" className="border-[rgba(139,92,246,0.3)] text-[#A78BFA] hover:bg-[rgba(139,92,246,0.1)] gap-2">
            {seedMut.isPending ? <span className="w-4 h-4 border-2 border-[#A78BFA]/40 border-t-[#A78BFA] rounded-full animate-spin" /> : <Zap className="w-4 h-4" />} Load Templates
          </Button>
          <Button onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setStep(1); setOpen(true); }} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold gap-2">
            <Plus className="w-4 h-4" /> New Automation
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: "Total Automations", value: automations.length, color: "#8B5CF6" },
          { label: "Active", value: activeCount, color: "#34D399" },
          { label: "Paused", value: automations.length - activeCount, color: "rgba(26,26,26,0.4)" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-[rgba(26,26,26,0.08)] rounded-xl p-3 sm:p-4 text-center">
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-[rgba(26,26,26,0.45)] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* How it works */}
      {automations.length === 0 && !isLoading && (
        <div className="bg-[rgba(139,92,246,0.08)] border border-[rgba(139,92,246,0.2)] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#A78BFA] mb-3 flex items-center gap-2"><Zap className="w-4 h-4" /> How Automations Work</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            {[
              { step: "1", title: "Choose a Trigger", desc: "Something happens in your business (booking, payment, etc.)" },
              { step: "2", title: "Define Actions", desc: "What should happen automatically (email, follow-up, notification)" },
              { step: "3", title: "Review Outcomes", desc: "Matching events are processed when the configured rule and dependencies are available" },
            ].map(s => (
              <div key={s.step} className="space-y-1">
                <div className="w-8 h-8 rounded-full bg-[rgba(139,92,246,0.2)] text-[#A78BFA] font-bold text-sm flex items-center justify-center mx-auto">{s.step}</div>
                <p className="text-xs font-semibold text-[rgba(26,26,26,0.8)]">{s.title}</p>
                <p className="text-xs text-[rgba(26,26,26,0.45)]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && (
        <section className="rounded-xl border border-[rgba(139,92,246,0.2)] bg-[rgba(139,92,246,0.05)] p-5" aria-labelledby="automation-starters-heading">
          <h2 id="automation-starters-heading" className="text-sm font-semibold text-[#6D28D9]">Start with a reviewable workflow</h2>
          <p className="mt-1 text-xs text-[rgba(26,26,26,0.6)]">Choose a starting point, review every field, then save it as a paused draft. Nothing sends or activates from this chooser.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {AUTOMATION_STARTERS.map((starter) => (
              <div key={starter.title} className="rounded-lg border border-[rgba(139,92,246,0.16)] bg-white p-4">
                <h3 className="text-sm font-semibold text-[rgba(26,26,26,0.9)]">{starter.title}</h3>
                <p className="mt-1 min-h-10 text-xs leading-5 text-[rgba(26,26,26,0.58)]">{starter.description}</p>
                <Button size="sm" variant="outline" className="mt-3 border-[rgba(139,92,246,0.32)] text-[#6D28D9] hover:bg-[rgba(139,92,246,0.1)]" onClick={() => { setEditingId(null); setForm(starter.draft); setStep(1); setOpen(true); toast.message("Starter loaded as a paused draft. Review it before saving."); }}>
                  Use starter
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-white animate-pulse" />)}</div>
      ) : automations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[rgba(139,92,246,0.12)] flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-[#8B5CF6]" />
          </div>
          <h3 className="text-lg font-semibold text-[rgba(26,26,26,0.85)] mb-2">No automations yet</h3>
          <p className="text-sm text-[rgba(26,26,26,0.45)] mb-6 max-w-sm">Load 3 ready-made templates or build your own from scratch.</p>
          <ol className="mx-auto mb-6 grid max-w-md gap-1.5 text-left text-xs text-[rgba(26,26,26,0.6)]">
            <li className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-[rgba(139,92,246,0.15)] text-[#6D28D9] text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>Load a starter template — nothing activates on its own</li>
            <li className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-[rgba(139,92,246,0.15)] text-[#6D28D9] text-[10px] font-bold flex items-center justify-center flex-shrink-0">2</span>Review the trigger, timing, and message in plain English</li>
            <li className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-[rgba(139,92,246,0.15)] text-[#6D28D9] text-[10px] font-bold flex items-center justify-center flex-shrink-0">3</span>Test it, then flip it on when it looks right</li>
          </ol>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={() => seedMut.mutate()} disabled={seedMut.isPending} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold gap-2">
              {seedMut.isPending ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Zap className="w-4 h-4" />} Load Starter Templates
            </Button>
            <Button onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setStep(1); setOpen(true); }} variant="outline" className="border-[rgba(139,92,246,0.3)] text-[#A78BFA] hover:bg-[rgba(139,92,246,0.1)] gap-2">
              <Plus className="w-4 h-4" /> Build from Scratch
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map(a => {
            const triggerDef = TRIGGERS.find(t => t.value === a.trigger);
            let actions: { type: string }[] = [];
            try {
              const parsed: unknown = JSON.parse(a.actions || "[]");
              actions = Array.isArray(parsed) ? parsed.filter((action): action is { type: string } => Boolean(action) && typeof action === "object" && "type" in action && typeof action.type === "string") : [];
            } catch {
              actions = [];
            }
            return (
              <div key={a.id} className={`group flex items-center gap-4 border rounded-xl px-5 py-4 transition-all ${a.active ? "bg-white border-[rgba(26,26,26,0.07)] hover:border-[rgba(139,92,246,0.3)]" : "bg-[rgba(255,255,255,0.02)] border-[rgba(26,26,26,0.04)] opacity-60"}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${a.active ? "bg-[rgba(139,92,246,0.15)]" : "bg-[rgba(255,255,255,0.05)]"}`}>
                  <Zap className={`w-5 h-5 ${a.active ? "text-[#8B5CF6]" : "text-[rgba(26,26,26,0.3)]"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[rgba(26,26,26,0.9)] truncate">{a.name}</h3>
                    <Badge variant="outline" className={`text-xs flex-shrink-0 ${a.active ? "border-[rgba(52,211,153,0.3)] text-[#34D399]" : "border-[rgba(26,26,26,0.12)] text-[rgba(26,26,26,0.4)]"}`}>
                      {a.active ? "Active" : "Paused"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[rgba(26,26,26,0.45)]">
                    <span className="text-[#A78BFA]">{triggerDef?.label ?? a.trigger}</span>
                    <ChevronRight className="w-3 h-3" />
                    <span>{actions.length ? actions.map(ac => ACTIONS.find(x => x.value === ac.type)?.label ?? ac.type).join(", ") : "No valid actions configured"}</span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                  <button aria-label={`Edit ${a.name}`} onClick={() => openEdit(a)} title="Edit automation" className="p-2 rounded-lg hover:bg-[rgba(139,92,246,0.15)] text-[rgba(26,26,26,0.5)] hover:text-[#8B5CF6] transition-colors"><Pencil className="w-4 h-4" /></button>
                  <button aria-label={`Preview ${a.name}`} onClick={() => setPreviewAutomationId(a.id)} title="Preview without running" className="p-2 rounded-lg hover:bg-[rgba(139,92,246,0.15)] text-[rgba(26,26,26,0.5)] hover:text-[#8B5CF6] transition-colors"><Eye className="w-4 h-4" /></button>
                  <button aria-label={`View history for ${a.name}`} onClick={() => setLogAutomationId(logAutomationId === a.id ? null : a.id)} title="View run history" className={`p-2 rounded-lg transition-colors ${logAutomationId === a.id ? "bg-[rgba(139,92,246,0.15)] text-[#8B5CF6]" : "hover:bg-[rgba(139,92,246,0.15)] text-[rgba(26,26,26,0.5)] hover:text-[#8B5CF6]"}`}><History className="w-4 h-4" /></button>
                  <button aria-label={`Send test notification for ${a.name}`} onClick={() => testMut.mutate({ id: a.id })} title="Send owner-notification test" className="p-2 rounded-lg hover:bg-[rgba(139,92,246,0.15)] text-[rgba(26,26,26,0.5)] hover:text-[#A78BFA] transition-colors"><Play className="w-4 h-4" /></button>
                  <button aria-label={`${a.active ? "Pause" : "Activate"} ${a.name}`} onClick={() => toggleMut.mutate({ id: a.id, active: !a.active })} title={a.active ? "Pause" : "Activate"} className="p-2 rounded-lg hover:bg-white text-[rgba(26,26,26,0.5)] hover:text-[rgba(26,26,26,0.9)] transition-colors">
                    {a.active ? <ToggleRight className="w-4 h-4 text-[#34D399]" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button aria-label={`Delete ${a.name}`} onClick={() => setDeleteConfirm(a.id)} title="Delete" className="p-2 rounded-lg hover:bg-[rgba(255,80,80,0.12)] text-[rgba(26,26,26,0.5)] hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {logAutomationId !== null && (
        <section className="rounded-xl border border-[rgba(26,26,26,0.08)] bg-white overflow-hidden" aria-label="Automation run history">
          <div className="flex items-center justify-between gap-4 p-4 border-b border-[rgba(26,26,26,0.08)]">
            <div>
              <h2 className="font-semibold text-[rgba(26,26,26,0.9)]">Run History</h2>
              <p className="text-xs text-[rgba(26,26,26,0.5)] mt-0.5">Recent executions, delivery outcomes, and recovery notes.</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setLogAutomationId(null)}>Close</Button>
          </div>
          {logsLoading ? (
            <div className="p-5 text-sm text-[rgba(26,26,26,0.5)]">Loading execution history…</div>
          ) : logs.length === 0 ? (
            <div className="p-5 text-sm text-[rgba(26,26,26,0.5)]">No runs yet. This rule will appear here when a matching event is processed.</div>
          ) : (
            <div className="divide-y divide-[rgba(26,26,26,0.06)]">
              {logs.map((log) => {
                const succeeded = log.status === "success";
                return (
                  <div key={log.id} className="p-4 flex gap-3">
                    {succeeded ? <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" /> : log.status === "failed" ? <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" /> : <Clock className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[rgba(26,26,26,0.85)] capitalize">{log.status} · {log.actionsExecuted} action{log.actionsExecuted === 1 ? "" : "s"} executed</p>
                      <p className="text-xs text-[rgba(26,26,26,0.5)] mt-0.5">{log.createdAt ? new Date(log.createdAt).toLocaleString() : "Time unavailable"} · Trigger: {log.trigger}</p>
                      {log.errorMessage && <p className="text-xs text-[rgba(26,26,26,0.65)] mt-2 break-words">{log.errorMessage}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <Dialog open={previewAutomationId !== null} onOpenChange={open => { if (!open) setPreviewAutomationId(null); }}>
        <DialogContent className="bg-white border-[rgba(26,26,26,0.1)] text-[rgba(26,26,26,0.95)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="w-5 h-5 text-[#8B5CF6]" /> Automation Preview</DialogTitle>
          </DialogHeader>
          {previewLoading ? (
            <div className="py-8 text-sm text-[rgba(26,26,26,0.55)]">Preparing a safe preview…</div>
          ) : preview ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-[rgba(139,92,246,0.2)] bg-[rgba(139,92,246,0.07)] p-3 text-sm text-[rgba(26,26,26,0.7)]">
                <div className="flex items-center gap-2 font-medium text-[#6D28D9]"><ShieldCheck className="w-4 h-4" /> Preview only — nothing will be sent or changed.</div>
                <p className="mt-1 text-xs">This review does not create drafts, send emails, write logs, or update run counts.</p>
              </div>
              <div className="rounded-lg border border-[rgba(26,26,26,0.08)] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[rgba(26,26,26,0.45)]">When</p>
                <p className="mt-1 text-sm font-medium">When {preview.triggerLabel}, run {preview.timingLabel.toLowerCase()}.</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[rgba(26,26,26,0.45)]">Expected actions</p>
                {preview.actions.map((action, index) => (
                  <div key={`${action.label}-${index}`} className="rounded-lg border border-[rgba(26,26,26,0.08)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{index + 1}. {action.label}</p>
                        <p className="mt-0.5 text-xs text-[rgba(26,26,26,0.55)]">To: {action.destination}</p>
                        <p className="mt-1 text-xs text-[rgba(26,26,26,0.65)]">{action.detail}</p>
                      </div>
                      <Badge variant="outline" className={action.state === "ready" ? "border-emerald-200 text-emerald-700" : "border-amber-200 text-amber-700"}>{action.state === "ready" ? "Ready" : "Needs attention"}</Badge>
                    </div>
                    {action.reason && <p className="mt-2 text-xs text-amber-700">{action.reason}</p>}
                  </div>
                ))}
              </div>
              {!preview.ready && preview.issues.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Resolve the highlighted items before activating this rule.</div>
              )}
            </div>
          ) : null}
          <DialogFooter><Button variant="outline" onClick={() => setPreviewAutomationId(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setForm(EMPTY_FORM); setEditingId(null); setStep(1); } }}>
        <DialogContent className="bg-white border-[rgba(26,26,26,0.1)] text-[rgba(26,26,26,0.95)] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Zap className="w-5 h-5 text-[#8B5CF6]" /> {editingId !== null ? "Edit Automation" : "New Automation"}</DialogTitle></DialogHeader>
          {/* Guided 3-step builder: one decision per screen, with a visible progress path. */}
          <div className="flex items-center justify-between px-1 pb-1" aria-label={`Builder step ${step} of 3`}>
            {[
              { n: 1, label: "Trigger" },
              { n: 2, label: "Action" },
              { n: 3, label: "Review" },
            ].map((sdef, i) => (
              <div key={sdef.label} className="flex flex-1 items-center last:flex-none">
                <div className="flex items-center gap-1.5">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${step === sdef.n ? "bg-[#8B5CF6] text-white" : step > sdef.n ? "bg-emerald-100 text-emerald-700" : "bg-[rgba(26,26,26,0.06)] text-[rgba(26,26,26,0.4)]"}`}>
                    {step > sdef.n ? <CheckCircle className="h-4 w-4" /> : sdef.n}
                  </div>
                  <span className={`text-xs font-semibold ${step === sdef.n ? "text-[rgba(26,26,26,0.9)]" : "text-[rgba(26,26,26,0.45)]"}`}>{sdef.label}</span>
                </div>
                {i < 2 && <div className={`mx-1.5 h-px flex-1 sm:mx-3 ${step > sdef.n ? "bg-emerald-200" : "bg-[rgba(26,26,26,0.08)]"}`} />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-5 py-2">
              <p className="text-xs text-[rgba(26,26,26,0.5)]">Pick the event that starts this workflow. Not sure? "Booking Confirmed" and "Invoice Overdue" are the most common starting points.</p>
              <div>
                <label className="text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-2 block">When this happens (Trigger)</label>
                <div className="grid grid-cols-1 gap-2">
                  {TRIGGERS.map(t => (
                    <button key={t.value} onClick={() => setForm(p2 => ({ ...p2, trigger: t.value as TriggerType }))}
                      className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${form.trigger === t.value ? "border-[#8B5CF6] bg-[rgba(139,92,246,0.1)]" : "border-[rgba(26,26,26,0.08)] hover:border-[rgba(26,26,26,0.2)] bg-[rgba(255,255,255,0.03)]"}`}>
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 ${form.trigger === t.value ? "border-[#8B5CF6] bg-[#8B5CF6]" : "border-[rgba(26,26,26,0.3)]"}`} />
                      <div>
                        <p className="text-sm font-medium text-[rgba(26,26,26,0.9)]">{t.label}</p>
                        <p className="text-xs text-[rgba(26,26,26,0.45)]">{t.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5 block">Wait before running</label>
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} max={720} value={form.triggerDelayHours} onChange={e2 => setForm(p2 => ({ ...p2, triggerDelayHours: Math.min(720, Math.max(0, Number(e2.target.value) || 0)) }))} className="w-28 bg-[rgba(255,255,255,0.05)] border-[rgba(26,26,26,0.12)] text-[rgba(26,26,26,0.9)]" />
                  <span className="text-sm text-[rgba(26,26,26,0.55)]">hours after the trigger</span>
                </div>
                <p className="text-xs text-[rgba(26,26,26,0.45)] mt-1">Use this for a timed follow-up. Review run history for recorded processing outcomes; provider delivery requires its own configured evidence.</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3 py-2">
              <p className="text-xs text-[rgba(26,26,26,0.5)]">Choose what happens automatically. Actions run in the order shown — stack as many as you need.</p>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[rgba(26,26,26,0.6)]">Do this (Actions)</label>
                <button onClick={addAction} className="text-xs text-[#8B5CF6] hover:text-[#A78BFA] flex items-center gap-1 transition-colors"><Plus className="w-3 h-3" /> Add Action</button>
              </div>
              <div className="space-y-3">
                {form.actions.map((action, idx) => (
                  <div key={idx} className="bg-white border border-[rgba(26,26,26,0.08)] rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[rgba(139,92,246,0.12)] text-[#6D28D9] text-[10px] font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                      <select value={action.type} onChange={e2 => updateAction(idx, "type", e2.target.value as ActionType)} className="flex-1 bg-[rgba(255,255,255,0.05)] border border-[rgba(26,26,26,0.12)] rounded-md px-2 py-1.5 text-sm text-[rgba(26,26,26,0.9)]">
                        {ACTIONS.map(a => <option key={a.value} value={a.value} className="bg-white">{a.label}</option>)}
                      </select>
                      {form.actions.length > 1 && (
                        <button onClick={() => removeAction(idx)} aria-label={`Remove action ${idx + 1}`} className="p-1.5 rounded hover:bg-[rgba(255,80,80,0.12)] text-[rgba(26,26,26,0.4)] hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                    {(action.type === "send_email" || action.type === "create_followup") && (
                      <>
                        <Input value={action.config.subject ?? ""} onChange={e2 => updateAction(idx, "config", { ...action.config, subject: e2.target.value })} placeholder="Subject (e.g. A quick follow-up)" className="bg-[rgba(255,255,255,0.05)] border-[rgba(26,26,26,0.12)] text-[rgba(26,26,26,0.9)] text-sm" />
                        <textarea value={action.config.message ?? ""} onChange={e2 => updateAction(idx, "config", { ...action.config, message: e2.target.value })} placeholder={action.type === "send_email" ? "Message to the matching client..." : "Draft follow-up message..."} maxLength={4000} rows={3} className="w-full rounded-md border border-[rgba(26,26,26,0.12)] bg-white px-3 py-2 text-sm text-[rgba(26,26,26,0.9)] outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/20" />
                      </>
                    )}
                    {action.type === "notify_owner" && (
                      <>
                        <Input value={action.config.title ?? ""} onChange={e2 => updateAction(idx, "config", { ...action.config, title: e2.target.value })} placeholder="Notification title" className="bg-[rgba(255,255,255,0.05)] border-[rgba(26,26,26,0.12)] text-[rgba(26,26,26,0.9)] text-sm" />
                        <textarea value={action.config.message ?? ""} onChange={e2 => updateAction(idx, "config", { ...action.config, message: e2.target.value })} placeholder="Notification message..." maxLength={4000} rows={3} className="w-full rounded-md border border-[rgba(26,26,26,0.12)] bg-white px-3 py-2 text-sm text-[rgba(26,26,26,0.9)] outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/20" />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5 py-2">
              <p className="text-xs text-[rgba(26,26,26,0.5)]">Last step — name it and confirm it reads the way you expect.</p>
              <div>
                <label className="text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5 block">Automation Name *</label>
                <Input value={form.name} onChange={e2 => setForm(p2 => ({ ...p2, name: e2.target.value }))} placeholder="e.g. Welcome New Clients" className="bg-[rgba(255,255,255,0.05)] border-[rgba(26,26,26,0.12)] text-[rgba(26,26,26,0.9)]" />
                {!form.name.trim() && <p className="text-xs text-amber-600 mt-1">Give it a name so you can find it later.</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-[rgba(26,26,26,0.6)] mb-1.5 block">Internal Description</label>
                <Input value={form.description} onChange={e2 => setForm(p2 => ({ ...p2, description: e2.target.value }))} placeholder="What this rule protects or accomplishes" maxLength={500} className="bg-[rgba(255,255,255,0.05)] border-[rgba(26,26,26,0.12)] text-[rgba(26,26,26,0.9)]" />
              </div>
              <div className="rounded-lg border border-[rgba(139,92,246,0.2)] bg-[rgba(139,92,246,0.07)] p-3" aria-label="Plain-English summary">
                <p className="text-xs font-semibold text-[#6D28D9] flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> In plain English</p>
                <p className="mt-1 text-sm text-[rgba(26,26,26,0.8)]">
                  When <strong>{TRIGGERS.find(t => t.value === form.trigger)?.label ?? form.trigger}</strong>
                  {form.triggerDelayHours > 0 ? <> (after {form.triggerDelayHours} hour{form.triggerDelayHours === 1 ? "" : "s"})</> : null},
                  automatically {" "}
                  {form.actions.map((ac, i) => (
                    <span key={i}>{i > 0 ? " and " : ""}<strong>{ACTIONS.find(x => x.value === ac.type)?.label.toLowerCase() ?? ac.type}</strong></span>
                  ))}.
                </p>
                <p className="mt-1.5 text-xs text-[rgba(26,26,26,0.5)]">You can test it with a preview before anything activates.</p>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col gap-2 border-t border-[rgba(26,26,26,0.06)] sm:flex-row sm:items-center">
            <Button variant="ghost" onClick={() => setOpen(false)} className="text-[rgba(26,26,26,0.6)] sm:order-first">Cancel</Button>
            <div className="flex w-full gap-2 sm:w-auto sm:ml-auto">
              {step > 1 && <Button variant="outline" onClick={() => setStep(cur => (cur - 1) as 1 | 2 | 3)} className="flex-1 sm:flex-none">Back</Button>}
              {step < 3 && <Button onClick={() => setStep(cur => (cur + 1) as 1 | 2 | 3)} className="flex-1 sm:flex-none bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold">Next: {step === 1 ? "Action" : "Review"}</Button>}
              {step === 3 && (
                <Button onClick={handleSubmit} disabled={createMut.isPending || updateDetailsMut.isPending || !form.name.trim()} className="flex-1 sm:flex-none bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold">
                  {editingId !== null ? "Save Changes" : form.active ? "Create Automation" : "Save Paused Draft"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteConfirm !== null} onOpenChange={v => !v && setDeleteConfirm(null)}>
        <DialogContent className="bg-white border-[rgba(26,26,26,0.1)] text-[rgba(26,26,26,0.95)] max-w-sm">
          <DialogHeader><DialogTitle>Delete Automation?</DialogTitle></DialogHeader>
          <p className="text-sm text-[rgba(26,26,26,0.6)]">This automation will stop running immediately.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)} className="text-[rgba(26,26,26,0.6)]">Cancel</Button>
            <Button variant="destructive" onClick={() => { if (deleteConfirm !== null) { deleteMut.mutate({ id: deleteConfirm }); setDeleteConfirm(null); } }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
