/* TrueAxis HQ — Time Tracking Panel
 * Track billable hours per client/project with start/stop timer and manual entry
 */
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Clock, Play, Square, Plus, Trash2, DollarSign,
  Loader2, Timer, TrendingUp
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

export default function TimeTrackingPanel() {
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

  const handleStartTimer = () => {
    const client = clients?.find(c => String(c.id) === timerClientId);
    startTimer.mutate({
      description: timerDesc || undefined,
      clientId: client?.id,
      clientName: client?.name || timerClientName || undefined,
      hourlyRate: timerRate || undefined,
      billable: true,
    });
  };

  const handleStopTimer = () => {
    if (!runningEntry) return;
    stopTimer.mutate({ id: runningEntry.id });
  };

  const handleAddManual = () => {
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
  };

  const totalHours = summary ? (summary.totalMinutes / 60).toFixed(1) : "0.0";
  const totalBillable = summary?.totalBillable ?? 0;
  const avgRate = summary?.avgRate ?? null;
  const todayCount = summary?.todayCount ?? 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#0D1117]" style={{  }}>Time Tracking</h2>
          <p className="text-sm text-gray-500 mt-0.5">Track billable hours and manage your time</p>
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
          <div key={c.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: c.color + "15" }}>
                <c.icon className="w-4 h-4" style={{ color: c.color }} />
              </div>
            </div>
            <p className="text-xl font-bold text-[#0D1117]">{c.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Live Timer */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-bold text-sm text-[#0D1117] mb-4 flex items-center gap-2">
          <Timer className="w-4 h-4 text-[#D4922A]" />
          Live Timer
          {runningEntry && (
            <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-semibold animate-pulse">
              Running
            </span>
          )}
        </h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="text-4xl font-mono font-bold text-[#0D1117] tabular-nums min-w-[148px]">
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
                      setTimerClientId(e.target.value);
                      const c = clients?.find(c => String(c.id) === e.target.value);
                      setTimerClientName(c?.name || "");
                    }}
                    className="form-input-light flex-1"
                  >
                    <option value="">No client</option>
                    {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                <p className="text-sm font-semibold text-[#0D1117]">{runningEntry.description || "Timer running…"}</p>
                {runningEntry.clientName && <p className="text-xs text-gray-400">{runningEntry.clientName}</p>}
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
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-sm text-[#0D1117] mb-4">Add Manual Entry</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Client</label>
              <select
                value={form.clientId}
                onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))}
                className="form-input-light"
              >
                <option value="">No client</option>
                {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                className="form-input-light"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Duration (hours) *</label>
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
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Hourly Rate ($)</label>
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
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description</label>
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
              <label htmlFor="billable" className="text-sm text-gray-700 cursor-pointer">Billable</label>
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#0D1117]">Recent Entries</h3>
          {(entries?.length ?? 0) > 0 && (
            <span className="text-xs text-gray-400">{entries!.length} entries</span>
          )}
        </div>
        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 text-[#D4922A] animate-spin mx-auto" />
          </div>
        ) : !entries || entries.length === 0 ? (
          <div className="p-10 text-center">
            <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-500">No time entries yet</p>
            <p className="text-xs text-gray-400 mt-1">Start the timer or add a manual entry above</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {entries.map((entry: any) => {
              const mins = entry.durationMinutes ?? 0;
              const hours = (mins / 60).toFixed(2);
              const billable = entry.billable && entry.hourlyRate
                ? (mins / 60) * parseFloat(String(entry.hourlyRate))
                : null;
              const isRunning = !entry.endedAt;
              return (
                <div key={entry.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isRunning ? "bg-green-100" : "bg-[#6366F1]/10"}`}>
                    {isRunning
                      ? <Play className="w-4 h-4 text-green-600" />
                      : <Clock className="w-4 h-4 text-[#6366F1]" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0D1117] truncate">
                      {entry.description || "Untitled session"}
                      {isRunning && <span className="ml-2 text-xs text-green-600 font-medium">● Running</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {entry.clientName || "No client"} · {new Date(entry.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-[#0D1117]">{isRunning ? "Running" : hours + "h"}</p>
                    {billable !== null && !isRunning && (
                      <p className="text-xs text-green-600 font-medium">{formatCurrency(billable)}</p>
                    )}
                  </div>
                  {!isRunning && (
                    <button
                      onClick={() => deleteEntry.mutate({ id: entry.id })}
                      disabled={deleteEntry.isPending}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
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
    </div>
  );
}
