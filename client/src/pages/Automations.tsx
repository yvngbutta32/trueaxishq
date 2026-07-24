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
  CheckCircle, XCircle, ChevronRight, AlertCircle,
} from "lucide-react";

const TRIGGERS = [
  { value: "booking_confirmed", label: "Booking Confirmed", desc: "When a new booking is created" },
  { value: "invoice_sent", label: "Invoice Sent", desc: "When an invoice is marked as sent" },
  { value: "invoice_paid", label: "Invoice Paid", desc: "When an invoice is marked as paid" },
  { value: "invoice_overdue", label: "Invoice Overdue", desc: "When an invoice passes its due date" },
  { value: "client_added", label: "New Client Added", desc: "When a new client is created" },
  { value: "proposal_signed", label: "Proposal Signed", desc: "When a client signs a proposal" },
  { value: "contract_signed", label: "Contract Signed", desc: "When a contract is signed" },
  { value: "follow_up_due", label: "Follow-Up Due", desc: "When a follow-up is due today" },
];

const ACTIONS = [
  { value: "send_email", label: "Send Email", desc: "Send an automated email to the client" },
  { value: "create_followup", label: "Create Follow-Up", desc: "Auto-create a follow-up reminder" },
  { value: "send_invoice", label: "Send Invoice", desc: "Auto-generate an invoice from a booking" },
  { value: "notify_owner", label: "Notify Me", desc: "Send yourself a notification" },
  { value: "create_task", label: "Create Task", desc: "Add a task to your to-do list" },
] as const;

type TriggerType = "booking_confirmed" | "invoice_sent" | "invoice_overdue" | "client_added" | "proposal_signed" | "invoice_paid";
type ActionType = "send_email" | "create_followup" | "send_invoice" | "notify_owner" | "create_task";
type AutomationForm = {
  name: string;
  trigger: TriggerType;
  actions: { type: ActionType; config: Record<string, any> }[];
};
const EMPTY_FORM: AutomationForm = { name: "", trigger: "booking_confirmed" as TriggerType, actions: [{ type: "notify_owner" as ActionType, config: { message: "" } }] };

export default function Automations() {
  const utils = trpc.useUtils();
  const { data: automations = [], isLoading } = trpc.automations.list.useQuery();
  const createMut = trpc.automations.create.useMutation({
    onSuccess: () => { utils.automations.list.invalidate(); toast.success("Automation created"); setOpen(false); setForm(EMPTY_FORM); },
    onError: e => toast.error(e.message),
  });
  const toggleMut = trpc.automations.update.useMutation({
    onSuccess: () => utils.automations.list.invalidate(),
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = trpc.automations.delete.useMutation({
    onSuccess: () => { utils.automations.list.invalidate(); toast.success("Automation deleted"); },
    onError: e => toast.error(e.message),
  });
  const testMut = trpc.automations.run.useMutation({
    onSuccess: (d: { actionsExecuted: number }) => toast.success(`Test ran: ${d.actionsExecuted} action(s) executed`),
    onError: (e: any) => toast.error(e.message),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AutomationForm>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  function addAction() {
    setForm(p => ({ ...p, actions: [...p.actions, { type: "notify_owner" as ActionType, config: { message: "" } }] }));
  }

  function removeAction(idx: number) {
    setForm(p => ({ ...p, actions: p.actions.filter((_, i) => i !== idx) }));
  }
  function updateAction(idx: number, field: "type" | "config", value: any) {
    setForm(p => ({
      ...p,
      actions: p.actions.map((a, i) => i === idx ? { ...a, [field]: value } : a),
    }));
  }

  function handleSubmit() {
    if (!form.name.trim()) return toast.error("Automation name is required");
    if (!form.trigger) return toast.error("Select a trigger");
    if (form.actions.length === 0) return toast.error("Add at least one action");
    createMut.mutate({ name: form.name, trigger: form.trigger, actions: form.actions });
  }

  const activeCount = automations.filter(a => a.active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[rgba(245,239,227,0.95)]">Workflow Automation</h1>
          <p className="text-sm text-[rgba(245,239,227,0.55)] mt-0.5">Set triggers and actions that run automatically — so you never miss a follow-up or invoice</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setOpen(true); }} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold gap-2">
          <Plus className="w-4 h-4" /> New Automation
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Automations", value: automations.length, color: "#8B5CF6" },
          { label: "Active", value: activeCount, color: "#34D399" },
          { label: "Paused", value: automations.length - activeCount, color: "rgba(245,239,227,0.4)" },
        ].map(s => (
          <div key={s.label} className="bg-[rgba(255,255,255,0.04)] border border-[rgba(245,239,227,0.08)] rounded-xl p-4 text-center">
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-[rgba(245,239,227,0.45)] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* How it works */}
      {automations.length === 0 && !isLoading && (
        <div className="bg-[rgba(139,92,246,0.08)] border border-[rgba(139,92,246,0.2)] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#A78BFA] mb-3 flex items-center gap-2"><Zap className="w-4 h-4" /> How Automations Work</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { step: "1", title: "Choose a Trigger", desc: "Something happens in your business (booking, payment, etc.)" },
              { step: "2", title: "Define Actions", desc: "What should happen automatically (email, follow-up, notification)" },
              { step: "3", title: "Runs Automatically", desc: "The workflow fires every time the trigger condition is met" },
            ].map(s => (
              <div key={s.step} className="space-y-1">
                <div className="w-8 h-8 rounded-full bg-[rgba(139,92,246,0.2)] text-[#A78BFA] font-bold text-sm flex items-center justify-center mx-auto">{s.step}</div>
                <p className="text-xs font-semibold text-[rgba(245,239,227,0.8)]">{s.title}</p>
                <p className="text-xs text-[rgba(245,239,227,0.45)]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-[rgba(255,255,255,0.04)] animate-pulse" />)}</div>
      ) : automations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[rgba(139,92,246,0.12)] flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-[#8B5CF6]" />
          </div>
          <h3 className="text-lg font-semibold text-[rgba(245,239,227,0.85)] mb-2">No automations yet</h3>
          <p className="text-sm text-[rgba(245,239,227,0.45)] mb-6 max-w-sm">Create your first automation to save hours every week on repetitive tasks.</p>
          <Button onClick={() => { setForm(EMPTY_FORM); setOpen(true); }} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold gap-2">
            <Plus className="w-4 h-4" /> Create First Automation
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map(a => {
            const triggerDef = TRIGGERS.find(t => t.value === a.trigger);
            const actions = JSON.parse(a.actions || "[]") as { type: string }[];
            return (
              <div key={a.id} className={`group flex items-center gap-4 border rounded-xl px-5 py-4 transition-all ${a.active ? "bg-[rgba(255,255,255,0.04)] border-[rgba(245,239,227,0.07)] hover:border-[rgba(139,92,246,0.3)]" : "bg-[rgba(255,255,255,0.02)] border-[rgba(245,239,227,0.04)] opacity-60"}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${a.active ? "bg-[rgba(139,92,246,0.15)]" : "bg-[rgba(255,255,255,0.05)]"}`}>
                  <Zap className={`w-5 h-5 ${a.active ? "text-[#8B5CF6]" : "text-[rgba(245,239,227,0.3)]"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[rgba(245,239,227,0.9)] truncate">{a.name}</h3>
                    <Badge variant="outline" className={`text-xs flex-shrink-0 ${a.active ? "border-[rgba(52,211,153,0.3)] text-[#34D399]" : "border-[rgba(245,239,227,0.12)] text-[rgba(245,239,227,0.4)]"}`}>
                      {a.active ? "Active" : "Paused"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[rgba(245,239,227,0.45)]">
                    <span className="text-[#A78BFA]">{triggerDef?.label ?? a.trigger}</span>
                    <ChevronRight className="w-3 h-3" />
                    <span>{actions.map(ac => ACTIONS.find(x => x.value === ac.type)?.label ?? ac.type).join(", ")}</span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => testMut.mutate({ id: a.id })} title="Test run" className="p-2 rounded-lg hover:bg-[rgba(139,92,246,0.15)] text-[rgba(245,239,227,0.5)] hover:text-[#A78BFA] transition-colors"><Play className="w-4 h-4" /></button>
                  <button onClick={() => toggleMut.mutate({ id: a.id, active: !a.active })} title={a.active ? "Pause" : "Activate"} className="p-2 rounded-lg hover:bg-[rgba(255,255,255,0.08)] text-[rgba(245,239,227,0.5)] hover:text-[rgba(245,239,227,0.9)] transition-colors">
                    {a.active ? <ToggleRight className="w-4 h-4 text-[#34D399]" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setDeleteConfirm(a.id)} title="Delete" className="p-2 rounded-lg hover:bg-[rgba(255,80,80,0.12)] text-[rgba(245,239,227,0.5)] hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setForm(EMPTY_FORM); }}>
        <DialogContent className="bg-[#1C1C1E] border-[rgba(245,239,227,0.1)] text-[rgba(245,239,227,0.95)] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Zap className="w-5 h-5 text-[#8B5CF6]" /> New Automation</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2">
            <div>
              <label className="text-xs font-semibold text-[rgba(245,239,227,0.6)] mb-1.5 block">Automation Name *</label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Welcome New Clients" className="bg-[rgba(255,255,255,0.05)] border-[rgba(245,239,227,0.12)] text-[rgba(245,239,227,0.9)]" />
            </div>

            {/* Trigger */}
            <div>
              <label className="text-xs font-semibold text-[rgba(245,239,227,0.6)] mb-2 block">When this happens (Trigger)</label>
              <div className="grid grid-cols-1 gap-2">
                {TRIGGERS.map(t => (
                  <button key={t.value} onClick={() =>         setForm(p => ({ ...p, trigger: t.value as TriggerType }))}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${form.trigger === t.value ? "border-[#8B5CF6] bg-[rgba(139,92,246,0.1)]" : "border-[rgba(245,239,227,0.08)] hover:border-[rgba(245,239,227,0.2)] bg-[rgba(255,255,255,0.03)]"}`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 ${form.trigger === t.value ? "border-[#8B5CF6] bg-[#8B5CF6]" : "border-[rgba(245,239,227,0.3)]"}`} />
                    <div>
                      <p className="text-sm font-medium text-[rgba(245,239,227,0.9)]">{t.label}</p>
                      <p className="text-xs text-[rgba(245,239,227,0.45)]">{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-[rgba(245,239,227,0.6)]">Do this (Actions)</label>
                <button onClick={addAction} className="text-xs text-[#8B5CF6] hover:text-[#A78BFA] flex items-center gap-1 transition-colors"><Plus className="w-3 h-3" /> Add Action</button>
              </div>
              <div className="space-y-3">
                {form.actions.map((action, idx) => (
                  <div key={idx} className="bg-[rgba(255,255,255,0.04)] border border-[rgba(245,239,227,0.08)] rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <select value={action.type} onChange={e => updateAction(idx, "type", e.target.value as ActionType)} className="flex-1 bg-[rgba(255,255,255,0.05)] border border-[rgba(245,239,227,0.12)] rounded-md px-2 py-1.5 text-sm text-[rgba(245,239,227,0.9)]">
                        {ACTIONS.map(a => <option key={a.value} value={a.value} className="bg-[#1C1C1E]">{a.label}</option>)}
                      </select>
                      {form.actions.length > 1 && (
                        <button onClick={() => removeAction(idx)} className="p-1.5 rounded hover:bg-[rgba(255,80,80,0.12)] text-[rgba(245,239,227,0.4)] hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                    {(action.type === "send_email" || action.type === "notify_owner") && (
                      <Input value={action.config.message ?? ""} onChange={e => updateAction(idx, "config", { ...action.config, message: e.target.value })} placeholder={action.type === "send_email" ? "Email message to client..." : "Notification message..."} className="bg-[rgba(255,255,255,0.05)] border-[rgba(245,239,227,0.12)] text-[rgba(245,239,227,0.9)] text-sm" />
                    )}
                    {action.type === "create_followup" && (
                      <Input value={action.config.daysAfter ?? "1"} onChange={e => updateAction(idx, "config", { ...action.config, daysAfter: e.target.value })} placeholder="Days after trigger" type="number" min="0" className="bg-[rgba(255,255,255,0.05)] border-[rgba(245,239,227,0.12)] text-[rgba(245,239,227,0.9)] text-sm" />
                    )}
                    {action.type === "create_task" && (
                      <Input value={action.config.title ?? ""} onChange={e => updateAction(idx, "config", { ...action.config, title: e.target.value })} placeholder="Task title (e.g. Send welcome kit)" className="bg-[rgba(255,255,255,0.05)] border-[rgba(245,239,227,0.12)] text-[rgba(245,239,227,0.9)] text-sm" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} className="text-[rgba(245,239,227,0.6)]">Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold">
              Create Automation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteConfirm !== null} onOpenChange={v => !v && setDeleteConfirm(null)}>
        <DialogContent className="bg-[#1C1C1E] border-[rgba(245,239,227,0.1)] text-[rgba(245,239,227,0.95)] max-w-sm">
          <DialogHeader><DialogTitle>Delete Automation?</DialogTitle></DialogHeader>
          <p className="text-sm text-[rgba(245,239,227,0.6)]">This automation will stop running immediately.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)} className="text-[rgba(245,239,227,0.6)]">Cancel</Button>
            <Button variant="destructive" onClick={() => { if (deleteConfirm !== null) { deleteMut.mutate({ id: deleteConfirm }); setDeleteConfirm(null); } }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
