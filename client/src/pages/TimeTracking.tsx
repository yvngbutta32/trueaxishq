/**
 * TimeTracking.tsx
 * Track billable hours per client/project with start/stop timer and manual entry.
 * Supports single-entry invoicing and bulk consolidated invoice from multiple entries.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Clock, Play, Square, Plus, Trash2, DollarSign,
  Loader2, Timer, TrendingUp, FileText, CheckCircle2, ListChecks,
} from "lucide-react";

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatCurrency(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface Props {
  /** Called after a successful invoice generation so the parent can switch to the Invoices panel */
  onInvoiceGenerated?: (invoiceId: number) => void;
}

export default function TimeTrackingPanel({ onInvoiceGenerated }: Props) {
  const utils = trpc.useUtils();

  const { data: entries, isLoading } = trpc.time.list.useQuery();
  const { data: clients } = trpc.clients.list.useQuery();
  const { data: summary } = trpc.time.summary.useQuery();
  const { data: runningEntry } = trpc.time.runningEntry.useQuery();

  // Timer state — driven by server runningEntry
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    clientId: "",
    description: "",
    durationHours: "",
    hourlyRate: "",
    date: new Date().toISOString().split("T")[0],
    billable: true,
  });

  // Timer description/client for starting a new timer
  const [timerDesc, setTimerDesc] = useState("");
  const [timerClientId, setTimerClientId] = useState("");
  const [timerClientName, setTimerClientName] = useState("");
  const [timerRate, setTimerRate] = useState("");

  // Single-entry invoicing loading state
  const [invoicingId, setInvoicingId] = useState<number | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkInvoicing, setBulkInvoicing] = useState(false);

  // Keep elapsed in sync with running entry
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (runningEntry) {
      const update = () => {
        setElapsed(Math.floor((Date.now() - new Date(runningEntry.startedAt).getTime()) / 1000));
      };
      update();
      intervalRef.current = setInterval(update, 1000);
    } else {
      setElapsed(0);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [runningEntry?.id]);

  const startTimer = trpc.time.start.useMutation({
    onSuccess: () => {
      utils.time.runningEntry.invalidate();
      utils.time.list.invalidate();
      toast.success("Timer started!");
    },
    onError: (e) => toast.error(e.message),
  });

  const stopTimer = trpc.time.stop.useMutation({
    onSuccess: () => {
      utils.time.runningEntry.invalidate();
      utils.time.list.invalidate();
      utils.time.summary.invalidate();
      toast.success("Time entry saved!");
      setTimerDesc("");
      setTimerClientId("");
      setTimerClientName("");
      setTimerRate("");
    },
    onError: (e) => toast.error(e.message),
  });

  const addManual = trpc.time.addManual.useMutation({
    onSuccess: () => {
      utils.time.list.invalidate();
      utils.time.summary.invalidate();
      toast.success("Time entry added!");
      setShowForm(false);
      setForm({ clientId: "", description: "", durationHours: "", hourlyRate: "", date: new Date().toISOString().split("T")[0], billable: true });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteEntry = trpc.time.delete.useMutation({
    onSuccess: () => {
      utils.time.list.invalidate();
      utils.time.summary.invalidate();
      toast.success("Entry deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const generateInvoice = trpc.time.generateInvoice.useMutation({
    onSuccess: (data) => {
      utils.time.list.invalidate();
      utils.invoices.list.invalidate();
      setInvoicingId(null);
      toast.success(`Invoice ${data.invoiceNumber} created — ${formatCurrency(data.amount)}`, {
        description: "Switching to Invoices panel…",
        duration: 4000,
      });
      setTimeout(() => { onInvoiceGenerated?.(data.invoiceId); }, 600);
    },
    onError: (e) => {
      setInvoicingId(null);
      toast.error(e.message);
    },
  });

  const bulkGenerateInvoice = trpc.time.bulkGenerateInvoice.useMutation({
    onSuccess: (data) => {
      utils.time.list.invalidate();
      utils.invoices.list.invalidate();
      setBulkInvoicing(false);
      setSelectedIds(new Set());
      toast.success(`Invoice ${data.invoiceNumber} created — ${formatCurrency(data.amount)}`, {
        description: `Consolidated ${data.entryCount} time entr${data.entryCount === 1 ? "y" : "ies"}. Switching to Invoices…`,
        duration: 5000,
      });
      setTimeout(() => { onInvoiceGenerated?.(data.invoiceId); }, 800);
    },
    onError: (e) => {
      setBulkInvoicing(false);
      toast.error(e.message);
    },
  });

  const handleStartTimer = useCallback(() => {
    const client = clients?.find(c => String(c.id) === timerClientId);
    startTimer.mutate({
      description: timerDesc || undefined,
      clientId: client?.id,
      clientName: client?.name || timerClientName || undefined,
      hourlyRate: timerRate || undefined,
      billable: true,
    });
  }, [clients, timerClientId, timerDesc, timerClientName, timerRate, startTimer]);

  const handleStopTimer = useCallback(() => {
    if (!runningEntry) return;
    stopTimer.mutate({ id: runningEntry.id });
  }, [runningEntry, stopTimer]);

  const handleAddManual = useCallback(() => {
    const hours = parseFloat(form.durationHours);
    if (!form.durationHours || isNaN(hours) || hours <= 0) {
      toast.error("Please enter a valid duration greater than 0");
      return;
    }
    const client = clients?.find(c => String(c.id) === form.clientId);
    addManual.mutate({
      clientId: client?.id,
      clientName: client?.name || undefined,
      description: form.description || undefined,
      durationMinutes: Math.round(hours * 60),
      hourlyRate: form.hourlyRate || undefined,
      billable: form.billable,
      date: form.date,
    });
  }, [form, clients, addManual]);

  const handleGenerateInvoice = useCallback((entryId: number) => {
    setInvoicingId(entryId);
    generateInvoice.mutate({ id: entryId });
  }, [generateInvoice]);

  const handleBulkInvoice = useCallback(() => {
    if (selectedIds.size === 0) return;
    setBulkInvoicing(true);
    bulkGenerateInvoice.mutate({ ids: Array.from(selectedIds) });
  }, [selectedIds, bulkGenerateInvoice]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const totalHours = summary ? (summary.totalMinutes / 60).toFixed(1) : "0.0";
  const totalBillable = summary?.totalBillable ?? 0;
  const avgRate = summary?.avgRate ?? null;
  const todayCount = summary?.todayCount ?? 0;

  // Entries eligible for bulk invoicing
  const bulkEligible = (entries ?? []).filter((e) =>
    e.endedAt && e.billable && parseFloat(String(e.hourlyRate ?? "0")) > 0 && !e.invoiced
  );

  // Compute total for selected entries
  const selectedTotal = Array.from(selectedIds).reduce((sum, id) => {
    const e = (entries ?? []).find((x) => x.id === id);
    if (!e) return sum;
    const hours = (e.durationMinutes ?? 0) / 60;
    const rate = e.hourlyRate ? parseFloat(String(e.hourlyRate)) : 0;
    return sum + hours * rate;
  }, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1A1A1A]">Time Tracking</h2>
          <p className="text-sm text-[rgba(26,26,26,0.50)] mt-0.5">Track billable hours and generate invoices instantly</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="gradient-amber text-white border-0 hover:opacity-90 gap-2"
        >
          <Plus className="w-4 h-4" />Manual Entry
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Hours", value: totalHours + "h", icon: Clock, color: "#6366F1" },
          { label: "Billable Amount", value: formatCurrency(totalBillable), icon: DollarSign, color: "#D4922A" },
          { label: "Sessions Today", value: String(todayCount), icon: Timer, color: "#10B981" },
          { label: "Avg Rate/hr", value: avgRate !== null ? formatCurrency(avgRate) : "—", icon: TrendingUp, color: "#FF6B6B" },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl p-4 shadow-sm border border-[#DDDBD7]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: c.color + "15" }}>
                <c.icon className="w-4 h-4" style={{ color: c.color }} />
              </div>
            </div>
            <p className="text-xl font-bold text-[#1A1A1A]">{c.value}</p>
            <p className="text-xs text-[rgba(26,26,26,0.50)] mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Live Timer */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-[#DDDBD7]">
        <h3 className="font-bold text-sm text-[#1A1A1A] mb-4 flex items-center gap-2">
          <Timer className="w-4 h-4 text-[#D4922A]" />
          Live Timer
          {runningEntry && (
            <span className="ml-2 px-2 py-0.5 bg-green-500/15 text-green-400 text-xs rounded-full font-semibold animate-pulse">
              Running
            </span>
          )}
        </h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="text-4xl font-mono font-bold text-[#1A1A1A] tabular-nums min-w-[148px]">
            {formatDuration(elapsed)}
          </div>
          <div className="flex-1 space-y-2 w-full">
            {!runningEntry ? (
              <>
                <input
                  value={timerDesc}
                  onChange={e => setTimerDesc(e.target.value)}
                  placeholder="What are you working on?"
                  className="form-input-light w-full"
                  enterKeyHint="next"
                  autoComplete="off"
                />
                <div className="flex gap-2">
                  <select
                    value={timerClientId}
                    onChange={e => {
                      const cid = e.target.value;
                      const c = clients?.find(cl => String(cl.id) === cid);
                      setTimerClientId(cid);
                      setTimerClientName(c?.name || "");
                      if (!timerRate && c?.defaultRate) setTimerRate(String(parseFloat(c.defaultRate)));
                    }}
                    className="form-input-light flex-1"
                  >
                    <option value="">No client</option>
                    {clients?.map(c => <option key={c.id} value={c.id}>{c.name}{c.defaultRate ? ` — $${parseFloat(c.defaultRate).toFixed(0)}/hr` : ""}</option>)}
                  </select>
                  <input
                    value={timerRate}
                    onChange={e => setTimerRate(e.target.value)}
                    placeholder="$/hr"
                    type="text"
                    inputMode="decimal"
                    enterKeyHint="done"
                    autoComplete="off"
                    className="form-input-light w-24"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#1A1A1A]">{runningEntry.description || "Timer running…"}</p>
                {runningEntry.clientName && <p className="text-xs text-[rgba(26,26,26,0.40)]">{runningEntry.clientName}</p>}
              </div>
            )}
          </div>
          <div>
            {!runningEntry ? (
              <Button
                onClick={handleStartTimer}
                disabled={startTimer.isPending}
                className="bg-green-500 hover:bg-green-600 text-white border-0 gap-2 min-w-[100px]"
              >
                {startTimer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Start
              </Button>
            ) : (
              <Button
                onClick={handleStopTimer}
                disabled={stopTimer.isPending}
                className="bg-red-500 hover:bg-red-600 text-white border-0 gap-2 min-w-[120px]"
              >
                {stopTimer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                Stop & Save
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Manual Entry Form */}
      {showForm && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-[#DDDBD7]">
          <h3 className="font-bold text-sm text-[#1A1A1A] mb-4">Add Manual Entry</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[rgba(26,26,26,0.60)] mb-1.5">Client</label>
              <select
                value={form.clientId}
                onChange={e => {
                  const cid = e.target.value;
                  const c = clients?.find(cl => String(cl.id) === cid);
                  setForm(p => ({
                    ...p,
                    clientId: cid,
                    hourlyRate: p.hourlyRate || (c?.defaultRate ? String(parseFloat(c.defaultRate)) : ""),
                  }));
                }}
                className="form-input-light"
              >
                <option value="">No client</option>
                {clients?.map(c => <option key={c.id} value={c.id}>{c.name}{c.defaultRate ? ` — $${parseFloat(c.defaultRate).toFixed(0)}/hr` : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[rgba(26,26,26,0.60)] mb-1.5">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                className="form-input-light"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[rgba(26,26,26,0.60)] mb-1.5">Duration (hours) *</label>
              <input
                type="text"
                inputMode="decimal"
                enterKeyHint="next"
                value={form.durationHours}
                onChange={e => setForm(p => ({ ...p, durationHours: e.target.value }))}
                placeholder="e.g. 1.5"
                className="form-input-light"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[rgba(26,26,26,0.60)] mb-1.5">Hourly Rate ($)</label>
              <input
                type="text"
                inputMode="decimal"
                enterKeyHint="next"
                value={form.hourlyRate}
                onChange={e => setForm(p => ({ ...p, hourlyRate: e.target.value }))}
                placeholder="e.g. 75"
                className="form-input-light"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[rgba(26,26,26,0.60)] mb-1.5">Description</label>
              <input
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="What did you work on?"
                className="form-input-light"
                enterKeyHint="done"
                autoComplete="off"
              />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="billable"
                checked={form.billable}
                onChange={e => setForm(p => ({ ...p, billable: e.target.checked }))}
                className="w-4 h-4 accent-[#D4922A]"
              />
              <label htmlFor="billable" className="text-sm text-[rgba(26,26,26,0.70)] cursor-pointer">Billable</label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              onClick={handleAddManual}
              disabled={addManual.isPending}
              className="gradient-amber text-white border-0 hover:opacity-90 gap-2"
            >
              {addManual.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Save Entry
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Entries List */}
      <div className="bg-white rounded-xl shadow-sm border border-[#DDDBD7] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#DDDBD7] flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-sm text-[#1A1A1A]">Recent Entries</h3>
            {(entries?.length ?? 0) > 0 && (
              <span className="text-xs text-[rgba(26,26,26,0.40)]">{entries!.length} entries</span>
            )}
          </div>
          {/* Bulk action bar */}
          {bulkEligible.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {selectedIds.size > 0 ? (
                <>
                  <span className="text-xs text-[rgba(26,26,26,0.60)]">
                    {selectedIds.size} selected · {formatCurrency(selectedTotal)}
                  </span>
                  <Button
                    size="sm"
                    onClick={handleBulkInvoice}
                    disabled={bulkInvoicing}
                    className="gradient-amber text-white border-0 hover:opacity-90 gap-1.5 h-7 text-xs"
                  >
                    {bulkInvoicing ? <Loader2 className="w-3 h-3 animate-spin" /> : <ListChecks className="w-3 h-3" />}
                    Invoice {selectedIds.size} {selectedIds.size === 1 ? "Entry" : "Entries"}
                  </Button>
                  <button
                    onClick={clearSelection}
                    className="text-xs text-[rgba(26,26,26,0.40)] hover:text-[rgba(26,26,26,0.70)] transition-colors"
                  >
                    Clear
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setSelectedIds(new Set(bulkEligible.map((e) => e.id)))}
                  className="text-xs text-[#D4922A] hover:text-[#D4922A]/80 transition-colors flex items-center gap-1"
                >
                  <ListChecks className="w-3.5 h-3.5" />
                  Select all billable
                </button>
              )}
            </div>
          )}
        </div>
        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 text-[#D4922A] animate-spin mx-auto" />
          </div>
        ) : !entries || entries.length === 0 ? (
          <div className="p-10 text-center">
            <Clock className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-sm font-semibold text-[rgba(26,26,26,0.50)]">No time entries yet</p>
            <p className="text-xs text-[rgba(26,26,26,0.40)] mt-1">Start the timer or add a manual entry above</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {entries.map((entry) => {
              const mins = entry.durationMinutes ?? 0;
              const hours = (mins / 60).toFixed(2);
              const rate = entry.hourlyRate ? parseFloat(String(entry.hourlyRate)) : 0;
              const billableAmount = entry.billable && rate > 0 ? (mins / 60) * rate : null;
              const isRunning = !entry.endedAt;
              const canInvoice = !isRunning && entry.billable && rate > 0 && !entry.invoiced;
              const isThisInvoicing = invoicingId === entry.id;
              const isSelected = selectedIds.has(entry.id);

              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${
                    isSelected ? "bg-[#D4922A]/8 border-l-2 border-[#D4922A]" :
                    entry.invoiced ? "bg-green-500/5" : "hover:bg-white/3"
                  }`}
                >
                  {/* Checkbox for bulk selection */}
                  {canInvoice ? (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(entry.id)}
                      className="w-4 h-4 accent-[#D4922A] flex-shrink-0 cursor-pointer"
                      aria-label={`Select entry ${entry.description || "Untitled"}`}
                    />
                  ) : (
                    <div className="w-4 flex-shrink-0" />
                  )}

                  {/* Status icon */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    entry.invoiced ? "bg-green-500/15" : isRunning ? "bg-green-500/15" : "bg-[#6366F1]/10"
                  }`}>
                    {entry.invoiced
                      ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                      : isRunning
                        ? <Play className="w-4 h-4 text-green-400" />
                        : <Clock className="w-4 h-4 text-[#6366F1]" />
                    }
                  </div>

                  {/* Description + client */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[#1A1A1A] truncate">
                        {entry.description || "Untitled session"}
                        {isRunning && <span className="ml-2 text-xs text-green-400 font-medium">● Running</span>}
                      </p>
                      {entry.invoiced && (
                        <span className="px-1.5 py-0.5 bg-green-500/15 text-green-400 text-[10px] font-semibold rounded-full uppercase tracking-wide flex-shrink-0">
                          Invoiced
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[rgba(26,26,26,0.40)] mt-0.5">
                      {entry.clientName || "No client"} · {new Date(entry.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {rate > 0 && !isRunning && <span className="ml-1 text-[rgba(26,26,26,0.30)]">· ${rate}/hr</span>}
                    </p>
                  </div>

                  {/* Duration + billable amount */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-[#1A1A1A]">{isRunning ? "Running" : hours + "h"}</p>
                    {billableAmount !== null && !isRunning && (
                      <p className="text-xs text-green-400 font-medium">{formatCurrency(billableAmount)}</p>
                    )}
                  </div>

                  {/* Generate Invoice button — only for completed, billable, un-invoiced entries with a rate */}
                  {canInvoice && (
                    <button
                      onClick={() => handleGenerateInvoice(entry.id)}
                      disabled={isThisInvoicing || generateInvoice.isPending || bulkInvoicing}
                      title="Generate invoice from this entry"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#D4922A]/10 hover:bg-[#D4922A]/20 text-[#D4922A] text-xs font-semibold transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      {isThisInvoicing
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <FileText className="w-3.5 h-3.5" />
                      }
                      <span className="hidden sm:inline">Invoice</span>
                    </button>
                  )}

                  {/* Delete button */}
                  {!isRunning && (
                    <button
                      onClick={() => deleteEntry.mutate({ id: entry.id })}
                      disabled={deleteEntry.isPending}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors"
                      aria-label="Delete entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invoice generation hint */}
      {bulkEligible.length > 0 && selectedIds.size === 0 && (
        <p className="text-xs text-[rgba(26,26,26,0.40)] text-center pb-2">
          Click <span className="font-semibold text-[#D4922A]">Invoice</span> on a single entry, or select multiple entries to create a consolidated invoice.
        </p>
      )}
    </div>
  );
}
