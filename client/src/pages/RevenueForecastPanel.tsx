/**
 * RevenueForecastPanel — Revenue Goals & Forecasting
 * Lives inside InsightsPanel as the "Forecast" tab.
 * Features:
 *  - Monthly bar chart: actual vs projected vs goal
 *  - Annual goal setter
 *  - Monthly goal setters
 *  - YTD vs projected annual summary cards
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { Target, TrendingUp, DollarSign, Edit2, Check, X, Plus } from "lucide-react";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;
}

function pct(actual: number, goal: number) {
  if (!goal) return null;
  return Math.round((actual / goal) * 100);
}

export default function RevenueForecastPanel() {
  const utils = trpc.useUtils();
  const { data: forecast, isLoading } = trpc.goals.forecast.useQuery();
  const [editingGoal, setEditingGoal] = useState<{ type: "annual" | "monthly"; month?: number } | null>(null);
  const [goalInput, setGoalInput] = useState("");

  const upsertGoal = trpc.goals.upsert.useMutation({
    onSuccess: () => {
      utils.goals.forecast.invalidate();
      toast.success("Goal saved!");
      setEditingGoal(null);
      setGoalInput("");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteGoal = trpc.goals.delete.useMutation({
    onSuccess: () => {
      utils.goals.forecast.invalidate();
      toast.success("Goal removed.");
    },
    onError: (e) => toast.error(e.message),
  });

  function startEditGoal(type: "annual" | "monthly", month?: number, currentGoal?: number | null) {
    setEditingGoal({ type, month });
    setGoalInput(currentGoal != null ? String(currentGoal) : "");
  }

  function saveGoal() {
    const amount = parseFloat(goalInput);
    if (isNaN(amount) || amount < 0) { toast.error("Enter a valid dollar amount."); return; }
    if (!forecast) return;
    const isAnnual = editingGoal?.type === "annual";
    const existingId = isAnnual ? forecast.annualGoalId : forecast.forecast.find(f => f.month === editingGoal?.month)?.goalId;
    upsertGoal.mutate({
      id: existingId ?? undefined,
      year: forecast.year,
      month: isAnnual ? null : editingGoal?.month,
      targetAmount: amount,
      currency: "USD",
      label: isAnnual ? `Annual ${forecast.year}` : `${MONTH_LABELS[(editingGoal?.month ?? 1) - 1]} ${forecast.year}`,
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!forecast) return null;

  const { ytdRevenue, projectedAnnual, annualGoal, annualGoalId, currentMonth, year } = forecast;
  const ytdPct = annualGoal ? pct(ytdRevenue, annualGoal) : null;
  const projPct = annualGoal ? pct(projectedAnnual, annualGoal) : null;

  const chartData = forecast.forecast.map(m => ({
    name: MONTH_LABELS[m.month - 1],
    Actual: m.actual ?? undefined,
    Projected: m.actual == null ? (m.projected ?? undefined) : undefined,
    Goal: m.goal ?? undefined,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-[#1A1A1A]">Revenue Forecast</h2>
          <p className="text-sm text-[rgba(26,26,26,0.55)]">{year} — actual vs projected vs goals</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => startEditGoal("annual", undefined, annualGoal)}
        >
          <Target className="w-3.5 h-3.5" />
          {annualGoal ? "Edit Annual Goal" : "Set Annual Goal"}
        </Button>
      </div>

      {/* Annual goal edit inline */}
      {editingGoal?.type === "annual" && (
        <div className="bg-white border border-[#D4922A]/30 rounded-xl p-4 flex items-center gap-3">
          <Target className="w-4 h-4 text-[#D4922A] flex-shrink-0" />
          <span className="text-sm text-[rgba(26,26,26,0.7)] flex-shrink-0">Annual Revenue Goal ({year}):</span>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-[rgba(26,26,26,0.5)]">$</span>
            <input
              value={goalInput}
              onChange={e => setGoalInput(e.target.value)}
              type="number"
              min="0"
              step="100"
              placeholder="e.g. 100000"
              className="form-input-light flex-1 text-sm"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter") saveGoal(); if (e.key === "Escape") setEditingGoal(null); }}
            />
          </div>
          {annualGoalId && (
            <button onClick={() => { deleteGoal.mutate({ id: annualGoalId }); setEditingGoal(null); }} className="text-red-400 hover:text-red-300 p-1" title="Remove goal">
              <X className="w-4 h-4" />
            </button>
          )}
          <button onClick={saveGoal} disabled={upsertGoal.isPending} className="text-emerald-400 hover:text-emerald-300 p-1">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={() => setEditingGoal(null)} className="text-[rgba(26,26,26,0.4)] hover:text-[#1A1A1A] p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          icon={DollarSign}
          label="YTD Revenue"
          value={fmt(ytdRevenue)}
          sub={ytdPct != null ? `${ytdPct}% of annual goal` : `${currentMonth - 1} months completed`}
          color="#D4922A"
        />
        <SummaryCard
          icon={TrendingUp}
          label="Projected Annual"
          value={fmt(projectedAnnual)}
          sub={projPct != null ? `${projPct}% of annual goal` : "Based on avg monthly"}
          color="#6366F1"
        />
        <SummaryCard
          icon={Target}
          label="Annual Goal"
          value={annualGoal != null ? fmt(annualGoal) : "Not set"}
          sub={annualGoal ? `$${fmt(Math.max(0, annualGoal - ytdRevenue))} remaining` : "Click 'Set Annual Goal'"}
          color="#10B981"
          action={!annualGoal ? { label: "Set", onClick: () => startEditGoal("annual") } : undefined}
        />
        <SummaryCard
          icon={DollarSign}
          label="Avg / Month"
          value={fmt(forecast.avgMonthlyRevenue)}
          sub={`Based on ${currentMonth - 1} paid months`}
          color="#F59E0B"
        />
      </div>

      {/* Annual goal progress bar */}
      {annualGoal != null && annualGoal > 0 && (
        <div className="bg-white rounded-xl border border-[#DDDBD7] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[rgba(26,26,26,0.6)]">Annual Progress</span>
            <span className="text-xs font-bold text-[#D4922A]">{ytdPct ?? 0}%</span>
          </div>
          <div className="h-2.5 bg-[#EEECEA] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(ytdPct ?? 0, 100)}%`,
                background: (ytdPct ?? 0) >= 100 ? "#10B981" : (ytdPct ?? 0) >= 75 ? "#D4922A" : "#6366F1",
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-[rgba(26,26,26,0.60)]">
            <span>{fmt(ytdRevenue)} earned</span>
            <span>{fmt(annualGoal)} goal</span>
          </div>
        </div>
      )}

      {/* Monthly bar chart */}
      <div className="bg-white rounded-xl border border-[#DDDBD7] p-4">
        <h3 className="text-sm font-bold text-[rgba(26,26,26,0.7)] mb-4">Monthly Breakdown</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
            <XAxis dataKey="name" tick={{ fill: "rgba(26,26,26,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} tick={{ fill: "rgba(26,26,26,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} width={45} />
            <Tooltip
              contentStyle={{ background: "#FFFFFF", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#1A1A1A", fontWeight: 600 }}
              formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "rgba(26,26,26,0.5)" }} />
            <Bar dataKey="Actual" fill="#D4922A" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="Projected" fill="#6366F1" radius={[4, 4, 0, 0]} maxBarSize={32} opacity={0.7} />
            <Bar dataKey="Goal" fill="rgba(16,185,129,0.3)" radius={[4, 4, 0, 0]} maxBarSize={32} stroke="#10B981" strokeWidth={1} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly goals table */}
      <div className="bg-white rounded-xl border border-[#DDDBD7] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#DDDBD7]">
          <h3 className="text-sm font-bold text-[rgba(26,26,26,0.7)]">Monthly Goals</h3>
        </div>
        <div className="divide-y divide-white/5">
          {forecast.forecast.map(m => {
            const isEditing = editingGoal?.type === "monthly" && editingGoal.month === m.month;
            const isPast = m.month < currentMonth;
            const isCurrent = m.month === currentMonth;
            return (
              <div key={m.month} className={`flex items-center gap-3 px-4 py-2.5 ${isCurrent ? "bg-[#D4922A]/5" : ""}`}>
                <span className={`text-xs font-semibold w-8 flex-shrink-0 ${isCurrent ? "text-[#D4922A]" : "text-[rgba(26,26,26,0.5)]"}`}>
                  {MONTH_LABELS[m.month - 1]}
                  {isCurrent && <span className="ml-1 text-[9px] text-[#D4922A]">NOW</span>}
                </span>
                <div className="flex-1 grid grid-cols-3 gap-2 text-xs">
                  <span className={isPast || isCurrent ? "text-[#1A1A1A] font-semibold" : "text-[rgba(26,26,26,0.3)]"}>
                    {m.actual != null ? fmt(m.actual) : isPast ? "$0" : "—"}
                  </span>
                  <span className="text-[rgba(26,26,26,0.70)]">
                    {m.projected != null && m.actual == null ? fmt(m.projected) : "—"}
                  </span>
                  {isEditing ? (
                    <div className="flex items-center gap-1 col-span-1">
                      <input
                        value={goalInput}
                        onChange={e => setGoalInput(e.target.value)}
                        type="number"
                        min="0"
                        className="form-input-light text-xs py-0.5 px-2 w-20"
                        autoFocus
                        onKeyDown={e => { if (e.key === "Enter") saveGoal(); if (e.key === "Escape") setEditingGoal(null); }}
                      />
                      <button onClick={saveGoal} className="text-emerald-400 hover:text-emerald-300"><Check className="w-3 h-3" /></button>
                      <button onClick={() => setEditingGoal(null)} className="text-[rgba(26,26,26,0.4)] hover:text-[#1A1A1A]"><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className={m.goal != null ? "text-emerald-400 font-semibold" : "text-[rgba(26,26,26,0.55)]"}>
                        {m.goal != null ? fmt(m.goal) : "—"}
                      </span>
                      <button
                        onClick={() => startEditGoal("monthly", m.month, m.goal)}
                        className="text-[rgba(26,26,26,0.2)] hover:text-[#D4922A] transition-colors ml-1"
                        title="Set monthly goal"
                      >
                        {m.goal != null ? <Edit2 className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
                      </button>
                    </div>
                  )}
                </div>
                {m.goal != null && m.actual != null && (
                  <div className="w-16 flex-shrink-0">
                    <div className="h-1.5 bg-[#EEECEA] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(pct(m.actual, m.goal) ?? 0, 100)}%`,
                          background: (pct(m.actual, m.goal) ?? 0) >= 100 ? "#10B981" : "#D4922A",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="px-4 py-2 border-t border-[#DDDBD7] grid grid-cols-3 gap-2 text-[10px] text-[rgba(26,26,26,0.60)] ml-11">
          <span>Actual</span><span>Projected</span><span>Goal</span>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon, label, value, sub, color, action,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  color: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="bg-white rounded-xl border border-[#DDDBD7] p-3.5">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <span className="text-[10px] font-semibold text-[rgba(26,26,26,0.70)] uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-lg font-extrabold text-[#1A1A1A]">{value}</div>
      <div className="text-[10px] text-[rgba(26,26,26,0.4)] mt-0.5">{sub}</div>
      {action && (
        <button onClick={action.onClick} className="mt-2 text-[10px] font-semibold text-[#D4922A] hover:underline">
          {action.label} →
        </button>
      )}
    </div>
  );
}
