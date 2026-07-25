/* SkillBridge AI — Recurring Invoices Panel
 * Set up automatic invoice schedules — weekly, bi-weekly, monthly, quarterly, yearly
 * Dark-themed to match the dashboard design system.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, Plus, Trash2, Loader2, ToggleLeft, ToggleRight, Calendar, DollarSign, Info } from "lucide-react";

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

function formatCurrency(n: string | number) {
  return `$${parseFloat(String(n)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function RecurringInvoicesPanel() {
  const utils = trpc.useUtils();
  const { data: schedules, isLoading } = trpc.recurring.list.useQuery();
  const { data: clients } = trpc.clients.list.useQuery();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    clientId: "",
    clientName: "",
    clientEmail: "",
    description: "",
    amount: "",
    currency: "USD",
    frequency: "monthly" as "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly",
    nextDueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  });

  const create = trpc.recurring.create.useMutation({
    onSuccess: () => {
      utils.recurring.list.invalidate();
      toast.success("Recurring invoice schedule created!");
      setShowForm(false);
      setForm({
        clientId: "", clientName: "", clientEmail: "", description: "",
        amount: "", currency: "USD", frequency: "monthly",
        nextDueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      });
    },
    onError: (e) => toast.error(e.message),
  });

  const toggle = trpc.recurring.toggle.useMutation({
    onSuccess: () => { utils.recurring.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const remove = trpc.recurring.delete.useMutation({
    onSuccess: () => { utils.recurring.list.invalidate(); toast.success("Schedule deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!form.clientName.trim()) { toast.error("Client name is required"); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error("Amount must be greater than 0"); return; }
    if (!form.nextDueAt) { toast.error("Next due date is required"); return; }

    const client = clients?.find(c => String(c.id) === form.clientId);
    create.mutate({
      clientId: client?.id,
      clientName: form.clientName.trim(),
      clientEmail: form.clientEmail.trim() || undefined,
      description: form.description.trim() || undefined,
      amount: form.amount,
      currency: form.currency,
      frequency: form.frequency,
      nextDueAt: new Date(form.nextDueAt + "T12:00:00").toISOString(),
    });
  };

  const activeCount = schedules?.filter(s => s.active).length ?? 0;
  const monthlyRevenue = schedules
    ?.filter(s => s.active)
    .reduce((sum, s) => {
      const amt = parseFloat(String(s.amount));
      const multiplier = s.frequency === "weekly" ? 4.33
        : s.frequency === "biweekly" ? 2.17
        : s.frequency === "monthly" ? 1
        : s.frequency === "quarterly" ? 0.33
        : 0.083;
      return sum + amt * multiplier;
    }, 0) ?? 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#1A1A1A]">Recurring Invoices</h2>
          <p className="text-sm text-[rgba(26,26,26,0.55)] mt-0.5">Automate your billing — invoices are generated automatically on each due date</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="gradient-amber text-white border-0 hover:opacity-90 gap-2 flex-shrink-0"
        >
          <Plus className="w-4 h-4" />New Schedule
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 border border-[#DDDBD7] card-lift">
          <div className="w-9 h-9 rounded-xl bg-[#D4922A]/15 flex items-center justify-center mb-3">
            <RefreshCw className="w-4 h-4 text-[#D4922A]" />
          </div>
          <p className="text-2xl font-extrabold text-[#1A1A1A]">{activeCount}</p>
          <p className="text-xs text-[rgba(26,26,26,0.55)] mt-0.5">Active Schedules</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#DDDBD7] card-lift">
          <div className="w-9 h-9 rounded-xl bg-[#10B981]/15 flex items-center justify-center mb-3">
            <DollarSign className="w-4 h-4 text-[#10B981]" />
          </div>
          <p className="text-2xl font-extrabold text-[#1A1A1A]">{formatCurrency(monthlyRevenue)}</p>
          <p className="text-xs text-[rgba(26,26,26,0.55)] mt-0.5">Est. Monthly Revenue</p>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-xl p-5 border border-[#DDDBD7]">
          <h3 className="font-bold text-sm text-[#1A1A1A] mb-4">New Recurring Schedule</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[rgba(26,26,26,0.60)] mb-1.5 uppercase tracking-wide">Client</label>
              <select
                value={form.clientId}
                onChange={e => {
                  const c = clients?.find(c => String(c.id) === e.target.value);
                  setForm(p => ({
                    ...p,
                    clientId: e.target.value,
                    clientName: c?.name || p.clientName,
                    clientEmail: (c as any)?.email || p.clientEmail,
                  }));
                }}
                className="form-input-light"
              >
                <option value="">Select client or type below</option>
                {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[rgba(26,26,26,0.60)] mb-1.5 uppercase tracking-wide">Client Name *</label>
              <input
                value={form.clientName}
                onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))}
                placeholder="Client or company name"
                className="form-input-light"
                enterKeyHint="next"
                autoComplete="organization"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[rgba(26,26,26,0.60)] mb-1.5 uppercase tracking-wide">Client Email</label>
              <input
                type="email"
                inputMode="email"
                value={form.clientEmail}
                onChange={e => setForm(p => ({ ...p, clientEmail: e.target.value }))}
                placeholder="client@example.com"
                className="form-input-light"
                enterKeyHint="next"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[rgba(26,26,26,0.60)] mb-1.5 uppercase tracking-wide">Amount ($) *</label>
              <input
                type="text"
                inputMode="decimal"
                enterKeyHint="next"
                value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="e.g. 500"
                className="form-input-light"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[rgba(26,26,26,0.60)] mb-1.5 uppercase tracking-wide">Frequency *</label>
              <select
                value={form.frequency}
                onChange={e => setForm(p => ({ ...p, frequency: e.target.value as any }))}
                className="form-input-light"
              >
                {Object.entries(FREQUENCY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[rgba(26,26,26,0.60)] mb-1.5 uppercase tracking-wide">First Due Date *</label>
              <input
                type="date"
                value={form.nextDueAt}
                onChange={e => setForm(p => ({ ...p, nextDueAt: e.target.value }))}
                className="form-input-light"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[rgba(26,26,26,0.60)] mb-1.5 uppercase tracking-wide">Description</label>
              <input
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="e.g. Monthly retainer — web maintenance"
                className="form-input-light"
                enterKeyHint="done"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <Button
              onClick={handleSubmit}
              disabled={create.isPending}
              className="gradient-amber text-white border-0 hover:opacity-90 gap-2"
            >
              {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Schedule
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} className="border-white/15 text-[rgba(26,26,26,0.65)] hover:text-[#1A1A1A]">Cancel</Button>
          </div>
        </div>
      )}

      {/* Schedules List */}
      <div className="bg-white rounded-xl border border-[#DDDBD7] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#1A1A1A]">All Schedules</h3>
          <span className="text-xs text-[rgba(26,26,26,0.45)]">{schedules?.length ?? 0} total</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 text-[#D4922A] animate-spin mx-auto" />
          </div>
        ) : !schedules || schedules.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#D4922A]/10 flex items-center justify-center mx-auto mb-3">
              <RefreshCw className="w-5 h-5 text-[#D4922A] opacity-50" />
            </div>
            <p className="text-sm font-semibold text-[rgba(26,26,26,0.65)]">No recurring schedules yet</p>
            <p className="text-xs text-[rgba(26,26,26,0.40)] mt-1">Create a schedule and invoices will be generated automatically</p>
            <Button
              onClick={() => setShowForm(true)}
              size="sm"
              className="mt-4 gradient-amber text-white border-0 hover:opacity-90 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />Create First Schedule
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {schedules.map((s) => {
              const color = FREQUENCY_COLORS[s.frequency] || "#6366F1";
              return (
                <div key={s.id} className={`flex items-center gap-4 px-5 py-4 hover:bg-[#F7F6F3] transition-colors ${!s.active ? "opacity-50" : ""}`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + "18" }}>
                    <RefreshCw className="w-4 h-4" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[#1A1A1A] truncate">{s.clientName}</p>
                      <span className="px-2 py-0.5 text-xs rounded-full font-semibold" style={{ background: color + "18", color }}>
                        {FREQUENCY_LABELS[s.frequency]}
                      </span>
                      {!s.active && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-[#EEECEA] text-[rgba(26,26,26,0.45)] font-semibold">Paused</span>
                      )}
                    </div>
                    <p className="text-xs text-[rgba(26,26,26,0.45)] mt-0.5">
                      {s.description || "No description"} · Next: {new Date(s.nextDueAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-[#1A1A1A]">{formatCurrency(s.amount)}</p>
                    <p className="text-xs text-[rgba(26,26,26,0.40)]">{s.currency}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggle.mutate({ id: s.id, active: !s.active })}
                      disabled={toggle.isPending}
                      className="p-1.5 rounded-lg hover:bg-[#EEECEA] text-[rgba(26,26,26,0.40)] hover:text-[#1A1A1A] transition-colors"
                      title={s.active ? "Pause schedule" : "Resume schedule"}
                    >
                      {s.active
                        ? <ToggleRight className="w-5 h-5 text-green-500" />
                        : <ToggleLeft className="w-5 h-5" />
                      }
                    </button>
                    <button
                      onClick={() => remove.mutate({ id: s.id })}
                      disabled={remove.isPending}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-[rgba(26,26,26,0.30)] hover:text-red-400 transition-colors"
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
      <div className="bg-[#D4922A]/8 border border-[#D4922A]/20 rounded-xl p-4 flex gap-3">
        <Info className="w-4 h-4 text-[#D4922A] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-[#1A1A1A]">Automatic Invoice Generation</p>
          <p className="text-xs text-[rgba(26,26,26,0.60)] mt-0.5">
            Invoices are generated automatically at midnight on each due date. You'll receive a notification when a new invoice is created. Clients with email addresses on file will be notified automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
