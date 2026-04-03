/* TrueAxis HQ — Recurring Invoices Panel
 * Set up automatic invoice schedules — weekly, bi-weekly, monthly, quarterly, yearly
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, Plus, Trash2, Loader2, ToggleLeft, ToggleRight, Calendar } from "lucide-react";

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 Weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

const FREQUENCY_COLORS: Record<string, string> = {
  weekly: "#6366F1",
  biweekly: "#E8A020",
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
        : 0.083; // yearly
      return sum + amt * multiplier;
    }, 0) ?? 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1C1C1E]" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Recurring Invoices</h2>
          <p className="text-sm text-gray-500 mt-0.5">Automate your regular billing — invoices are generated automatically</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="gradient-amber text-white border-0 hover:opacity-90 gap-2"
        >
          <Plus className="w-4 h-4" />New Schedule
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-2xl font-bold text-[#1C1C1E]">{activeCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Active Schedules</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-2xl font-bold text-[#1C1C1E]">{formatCurrency(monthlyRevenue)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Est. Monthly Revenue</p>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-sm text-[#1C1C1E] mb-4">New Recurring Schedule</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Client *</label>
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
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Client Name *</label>
              <input
                value={form.clientName}
                onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))}
                placeholder="Client or company name"
                className="form-input-light"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Client Email</label>
              <input
                type="email"
                value={form.clientEmail}
                onChange={e => setForm(p => ({ ...p, clientEmail: e.target.value }))}
                placeholder="client@example.com"
                className="form-input-light"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Amount ($) *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="e.g. 500"
                className="form-input-light"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Frequency *</label>
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
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">First Due Date *</label>
              <input
                type="date"
                value={form.nextDueAt}
                onChange={e => setForm(p => ({ ...p, nextDueAt: e.target.value }))}
                className="form-input-light"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description</label>
              <input
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="e.g. Monthly retainer — web maintenance"
                className="form-input-light"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              onClick={handleSubmit}
              disabled={create.isPending}
              className="gradient-amber text-white border-0 hover:opacity-90 gap-2"
            >
              {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Schedule
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Schedules List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-sm text-[#1C1C1E]">Active Schedules</h3>
        </div>
        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 text-[#E8A020] animate-spin mx-auto" />
          </div>
        ) : !schedules || schedules.length === 0 ? (
          <div className="p-10 text-center">
            <RefreshCw className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-500">No recurring schedules yet</p>
            <p className="text-xs text-gray-400 mt-1">Create a schedule and invoices will be generated automatically</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {schedules.map((s: any) => {
              const color = FREQUENCY_COLORS[s.frequency] || "#6366F1";
              return (
                <div key={s.id} className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors ${!s.active ? "opacity-50" : ""}`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + "15" }}>
                    <RefreshCw className="w-4 h-4" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[#1C1C1E] truncate">{s.clientName}</p>
                      <span className="px-2 py-0.5 text-xs rounded-full font-semibold" style={{ background: color + "15", color }}>
                        {FREQUENCY_LABELS[s.frequency]}
                      </span>
                      {!s.active && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500 font-semibold">Paused</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {s.description || "No description"} · Next: {new Date(s.nextDueAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-[#1C1C1E]">{formatCurrency(s.amount)}</p>
                    <p className="text-xs text-gray-400">{s.currency}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggle.mutate({ id: s.id, active: !s.active })}
                      disabled={toggle.isPending}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
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
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
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
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
        <Calendar className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Automatic Invoice Generation</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Invoices are generated automatically at midnight on each due date. You'll receive a notification when a new invoice is created. Clients with email addresses on file will be notified automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
