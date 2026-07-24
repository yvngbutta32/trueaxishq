import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Receipt, Plus, Pencil, Trash2, TrendingUp, TrendingDown, DollarSign,
  PieChart, ArrowUpRight, ArrowDownRight, CheckCircle, Calendar,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";

const EXPENSE_CATEGORIES = [
  "software", "hardware", "marketing", "travel", "meals", "office",
  "education", "subscriptions", "contractors", "taxes", "insurance", "other",
];

type ExpenseForm = {
  amount: string; category: string; description: string; vendor: string; date: string; taxDeductible: boolean;
};
const EMPTY_FORM: ExpenseForm = { amount: "", category: "other", description: "", vendor: "", date: new Date().toISOString().slice(0, 10), taxDeductible: true };

export default function Expenses() {
  const utils = trpc.useUtils();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | undefined>(undefined);
  const [catFilter, setCatFilter] = useState<string | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<ExpenseForm>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [view, setView] = useState<"list" | "pnl">("pnl");

  const { data: expenseList = [], isLoading: loadingList } = trpc.expenses.list.useQuery({ year, month, category: catFilter });
  const { data: pnl, isLoading: loadingPnl } = trpc.expenses.pnl.useQuery({ year, month });

  const createMut = trpc.expenses.create.useMutation({
    onSuccess: () => { utils.expenses.list.invalidate(); utils.expenses.pnl.invalidate(); toast.success("Expense added"); setOpen(false); setForm(EMPTY_FORM); },
    onError: e => toast.error(e.message),
  });
  const updateMut = trpc.expenses.update.useMutation({
    onSuccess: () => { utils.expenses.list.invalidate(); utils.expenses.pnl.invalidate(); toast.success("Expense updated"); setOpen(false); setEditing(null); },
    onError: e => toast.error(e.message),
  });
  const deleteMut = trpc.expenses.delete.useMutation({
    onSuccess: () => { utils.expenses.list.invalidate(); utils.expenses.pnl.invalidate(); toast.success("Expense deleted"); },
    onError: e => toast.error(e.message),
  });

  function openCreate() { setEditing(null); setForm(EMPTY_FORM); setOpen(true); }
  function openEdit(e: typeof expenseList[0]) {
    setEditing(e.id);
    setForm({ amount: String(parseFloat(String(e.amount))), category: e.category, description: e.description, vendor: e.vendor ?? "", date: e.date, taxDeductible: e.taxDeductible });
    setOpen(true);
  }
  function handleSubmit() {
    const amount = parseFloat(form.amount);
    if (!form.description.trim()) return toast.error("Description is required");
    if (isNaN(amount) || amount <= 0) return toast.error("Enter a valid amount");
    if (!form.date) return toast.error("Date is required");
    const payload = { amount, category: form.category, description: form.description, vendor: form.vendor || undefined, date: form.date, taxDeductible: form.taxDeductible };
    if (editing !== null) updateMut.mutate({ id: editing, ...payload });
    else createMut.mutate(payload);
  }

  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const years = [now.getFullYear(), now.getFullYear()-1, now.getFullYear()-2];

  const categoryData = useMemo(() => {
    if (!pnl) return [];
    return Object.entries(pnl.byCategory).map(([name, value]) => ({ name, value: Math.round(value as number) })).sort((a,b) => b.value - a.value);
  }, [pnl]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[rgba(245,239,227,0.95)]">Expenses & P&L</h1>
          <p className="text-sm text-[rgba(245,239,227,0.55)] mt-0.5">Track spending, see your real profit, and stay tax-ready</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[rgba(255,255,255,0.05)] rounded-lg p-0.5">
            {(["pnl","list"] as const).map(v => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === v ? "bg-[rgba(255,255,255,0.1)] text-[rgba(245,239,227,0.9)]" : "text-[rgba(245,239,227,0.5)] hover:text-[rgba(245,239,227,0.7)]"}`}>
                {v === "pnl" ? "P&L Report" : "Expense List"}
              </button>
            ))}
          </div>
          <Button onClick={openCreate} className="bg-[#FF6B6B] hover:bg-[#e85f5f] text-white font-semibold gap-2">
            <Plus className="w-4 h-4" /> Add Expense
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="bg-[rgba(255,255,255,0.05)] border border-[rgba(245,239,227,0.1)] rounded-lg px-3 py-1.5 text-sm text-[rgba(245,239,227,0.8)]">
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month ?? ""} onChange={e => setMonth(e.target.value ? Number(e.target.value) : undefined)} className="bg-[rgba(255,255,255,0.05)] border border-[rgba(245,239,227,0.1)] rounded-lg px-3 py-1.5 text-sm text-[rgba(245,239,227,0.8)]">
          <option value="">All Months</option>
          {months.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        {view === "list" && (
          <select value={catFilter ?? ""} onChange={e => setCatFilter(e.target.value || undefined)} className="bg-[rgba(255,255,255,0.05)] border border-[rgba(245,239,227,0.1)] rounded-lg px-3 py-1.5 text-sm text-[rgba(245,239,227,0.8)]">
            <option value="">All Categories</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
          </select>
        )}
      </div>

      {view === "pnl" ? (
        loadingPnl ? <div className="h-64 rounded-xl bg-[rgba(255,255,255,0.04)] animate-pulse" /> : pnl ? (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Revenue", value: `$${pnl.totalRevenue.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0})}`, icon: TrendingUp, color: "#00C9A7", sub: "Paid invoices" },
                { label: "Total Expenses", value: `$${pnl.totalExpenses.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0})}`, icon: TrendingDown, color: "#FF6B6B", sub: `${expenseList.length} entries` },
                { label: "Net Profit", value: `$${pnl.netProfit.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0})}`, icon: pnl.netProfit >= 0 ? ArrowUpRight : ArrowDownRight, color: pnl.netProfit >= 0 ? "#34D399" : "#FF6B6B", sub: `${pnl.profitMargin}% margin` },
                { label: "Tax Deductible", value: `$${pnl.taxDeductibleExpenses.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0})}`, icon: CheckCircle, color: "#F59E0B", sub: "Deductible expenses" },
              ].map(kpi => (
                <div key={kpi.label} className="bg-[rgba(255,255,255,0.04)] border border-[rgba(245,239,227,0.08)] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${kpi.color}20` }}>
                      <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                    </div>
                    <span className="text-xs text-[rgba(245,239,227,0.5)]">{kpi.label}</span>
                  </div>
                  <p className="text-xl font-bold text-[rgba(245,239,227,0.95)]">{kpi.value}</p>
                  <p className="text-xs text-[rgba(245,239,227,0.4)] mt-0.5">{kpi.sub}</p>
                </div>
              ))}
            </div>

            {/* Monthly Chart */}
            {pnl.monthly.length > 0 && (
              <div className="bg-[rgba(255,255,255,0.04)] border border-[rgba(245,239,227,0.08)] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-[rgba(245,239,227,0.7)] mb-4">Revenue vs Expenses (Last 12 Months)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={pnl.monthly} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="month" tick={{ fill: "rgba(245,239,227,0.4)", fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                    <YAxis tick={{ fill: "rgba(245,239,227,0.4)", fontSize: 11 }} tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                    <Tooltip contentStyle={{ background: "#1C1C1E", border: "1px solid rgba(245,239,227,0.1)", borderRadius: 8, color: "rgba(245,239,227,0.9)" }} formatter={(v: any) => [`$${Number(v).toLocaleString()}`, ""]} />
                    <Legend wrapperStyle={{ color: "rgba(245,239,227,0.5)", fontSize: 12 }} />
                    <Bar dataKey="revenue" name="Revenue" fill="#00C9A7" radius={[4,4,0,0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="#FF6B6B" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* By Category */}
            {categoryData.length > 0 && (
              <div className="bg-[rgba(255,255,255,0.04)] border border-[rgba(245,239,227,0.08)] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-[rgba(245,239,227,0.7)] mb-4">Expenses by Category</h3>
                <div className="space-y-2">
                  {categoryData.map(cat => {
                    const pct = pnl.totalExpenses > 0 ? (cat.value / pnl.totalExpenses) * 100 : 0;
                    return (
                      <div key={cat.name} className="flex items-center gap-3">
                        <span className="text-xs text-[rgba(245,239,227,0.6)] w-24 capitalize truncate">{cat.name}</span>
                        <div className="flex-1 h-2 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
                          <div className="h-full bg-[#FF6B6B] rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-[rgba(245,239,227,0.7)] w-16 text-right">${cat.value.toLocaleString()}</span>
                        <span className="text-xs text-[rgba(245,239,227,0.4)] w-10 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : null
      ) : (
        /* Expense List */
        <div className="space-y-2">
          {loadingList ? (
            [1,2,3,4].map(i => <div key={i} className="h-16 rounded-xl bg-[rgba(255,255,255,0.04)] animate-pulse" />)
          ) : expenseList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[rgba(255,107,107,0.12)] flex items-center justify-center mb-4">
                <Receipt className="w-7 h-7 text-[#FF6B6B]" />
              </div>
              <h3 className="text-base font-semibold text-[rgba(245,239,227,0.8)] mb-2">No expenses recorded</h3>
              <p className="text-sm text-[rgba(245,239,227,0.45)] mb-5">Start tracking your business expenses to see your real profit.</p>
              <Button onClick={openCreate} className="bg-[#FF6B6B] hover:bg-[#e85f5f] text-white font-semibold gap-2"><Plus className="w-4 h-4" />Add First Expense</Button>
            </div>
          ) : expenseList.map(e => (
            <div key={e.id} className="group flex items-center gap-4 bg-[rgba(255,255,255,0.04)] border border-[rgba(245,239,227,0.07)] rounded-xl px-4 py-3 hover:border-[rgba(255,107,107,0.25)] transition-all">
              <div className="w-9 h-9 rounded-lg bg-[rgba(255,107,107,0.12)] flex items-center justify-center flex-shrink-0">
                <Receipt className="w-4 h-4 text-[#FF6B6B]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[rgba(245,239,227,0.9)] text-sm truncate">{e.description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-xs border-[rgba(245,239,227,0.12)] text-[rgba(245,239,227,0.45)] capitalize py-0">{e.category}</Badge>
                  {e.vendor && <span className="text-xs text-[rgba(245,239,227,0.4)]">{e.vendor}</span>}
                  <span className="text-xs text-[rgba(245,239,227,0.35)] flex items-center gap-1"><Calendar className="w-3 h-3" />{e.date}</span>
                  {e.taxDeductible && <span className="text-xs text-[#F59E0B]">Tax deductible</span>}
                </div>
              </div>
              <span className="font-bold text-[#FF6B6B] text-base">${parseFloat(String(e.amount)).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.08)] text-[rgba(245,239,227,0.5)] hover:text-[rgba(245,239,227,0.9)] transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => setDeleteConfirm(e.id)} className="p-1.5 rounded-lg hover:bg-[rgba(255,80,80,0.12)] text-[rgba(245,239,227,0.5)] hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setEditing(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="bg-[#1C1C1E] border-[rgba(245,239,227,0.1)] text-[rgba(245,239,227,0.95)] max-w-md">
          <DialogHeader><DialogTitle>{editing !== null ? "Edit Expense" : "Add Expense"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[rgba(245,239,227,0.6)] mb-1.5 block">Amount (USD) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(245,239,227,0.4)] text-sm">$</span>
                  <Input value={form.amount} onChange={e => setForm(p => ({...p, amount: e.target.value}))} placeholder="0.00" className="pl-7 bg-[rgba(255,255,255,0.05)] border-[rgba(245,239,227,0.12)] text-[rgba(245,239,227,0.9)]" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[rgba(245,239,227,0.6)] mb-1.5 block">Date *</label>
                <Input type="date" value={form.date} onChange={e => setForm(p => ({...p, date: e.target.value}))} className="bg-[rgba(255,255,255,0.05)] border-[rgba(245,239,227,0.12)] text-[rgba(245,239,227,0.9)]" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-[rgba(245,239,227,0.6)] mb-1.5 block">Description *</label>
              <Input value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} placeholder="e.g. Adobe Creative Cloud subscription" className="bg-[rgba(255,255,255,0.05)] border-[rgba(245,239,227,0.12)] text-[rgba(245,239,227,0.9)]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[rgba(245,239,227,0.6)] mb-1.5 block">Vendor</label>
                <Input value={form.vendor} onChange={e => setForm(p => ({...p, vendor: e.target.value}))} placeholder="e.g. Adobe" className="bg-[rgba(255,255,255,0.05)] border-[rgba(245,239,227,0.12)] text-[rgba(245,239,227,0.9)]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[rgba(245,239,227,0.6)] mb-1.5 block">Category</label>
                <select value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))} className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(245,239,227,0.12)] rounded-md px-3 py-2 text-sm text-[rgba(245,239,227,0.9)]">
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c} className="capitalize bg-[#1C1C1E]">{c}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.taxDeductible} onChange={e => setForm(p => ({...p, taxDeductible: e.target.checked}))} className="w-4 h-4 rounded" />
              <span className="text-sm text-[rgba(245,239,227,0.7)]">Tax deductible</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} className="text-[rgba(245,239,227,0.6)]">Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending} className="bg-[#FF6B6B] hover:bg-[#e85f5f] text-white font-semibold">
              {editing !== null ? "Save Changes" : "Add Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteConfirm !== null} onOpenChange={v => !v && setDeleteConfirm(null)}>
        <DialogContent className="bg-[#1C1C1E] border-[rgba(245,239,227,0.1)] text-[rgba(245,239,227,0.95)] max-w-sm">
          <DialogHeader><DialogTitle>Delete Expense?</DialogTitle></DialogHeader>
          <p className="text-sm text-[rgba(245,239,227,0.6)]">This will permanently remove this expense record.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)} className="text-[rgba(245,239,227,0.6)]">Cancel</Button>
            <Button variant="destructive" onClick={() => { if (deleteConfirm !== null) { deleteMut.mutate({ id: deleteConfirm }); setDeleteConfirm(null); } }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
