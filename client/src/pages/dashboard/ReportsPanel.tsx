/* TrueAxis HQ — Custom Report Builder panel
 * Owners define a report once (dataset + metric + grouping + filters), preview it
 * live, save it, and export CSV. Included at no extra tier — every competitor
 * gates this behind a higher plan.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PanelTabs } from "@/components/PanelTabs";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { FileBarChart, Plus, Play, Pencil, Trash2, Download, Table2, Loader2 } from "lucide-react";
import { Field, Modal, formatCurrency, Skeleton } from "./shared";

type Dataset = "jobs" | "invoices" | "time_entries" | "expenses" | "proposals";
type Metric = "count" | "value" | "hours";
type GroupBy = "none" | "status" | "client" | "month" | "category";

interface ReportResult { keyLabel: string; metricLabel: string; rows: { key: string; value: number }[]; total: number }
interface SavedReport { id: number; name: string; dataset: Dataset; metric: string; groupBy: string; filters: string; updatedAt: Date | string }

const DATASET_LABELS: Record<Dataset, string> = { jobs: "Jobs", invoices: "Invoices", time_entries: "Time entries", expenses: "Expenses", proposals: "Proposals" };

const DATASET_OPTIONS: Record<Dataset, { metrics: Metric[]; groupBys: GroupBy[]; statuses?: string[]; hasClientFilter: boolean; hasCategoryFilter?: boolean; hasBillableFilter?: boolean }> = {
  jobs:        { metrics: ["count", "value"], groupBys: ["none", "status", "client", "month"], statuses: ["lead", "quoted", "approved", "scheduled", "in_progress", "awaiting_client", "completed", "cancelled"], hasClientFilter: true },
  invoices:    { metrics: ["count", "value"], groupBys: ["none", "status", "client", "month"], statuses: ["draft", "sent", "paid", "overdue"], hasClientFilter: true },
  time_entries:{ metrics: ["count", "hours"], groupBys: ["none", "status", "client", "month"], hasClientFilter: true, hasBillableFilter: true },
  expenses:    { metrics: ["count", "value"], groupBys: ["none", "category", "month"], hasClientFilter: false, hasCategoryFilter: true },
  proposals:   { metrics: ["count", "value"], groupBys: ["none", "status", "client", "month"], statuses: ["draft", "sent", "viewed", "signed", "declined"], hasClientFilter: true },
};

const METRIC_LABELS: Record<Metric, string> = { count: "Count", value: "Total value ($)", hours: "Hours" };
const GROUP_LABELS: Record<GroupBy, string> = { none: "No grouping (one total)", status: "Group by status", client: "Group by client", month: "Group by month", category: "Group by category" };

function downloadCsv(name: string, result: ReportResult) {
  const header = `${result.keyLabel},${result.metricLabel}`;
  const body = result.rows.map(row => `"${row.key.replace(/"/g, '""')}",${row.value}`).join("\n");
  const csv = `${header}\n${body}\nTOTAL,${result.total}\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function ResultView({ name, result, metric }: { name: string; result: ReportResult; metric: Metric }) {
  const format = (value: number) => metric === "count" || metric === "hours" ? String(Number.isInteger(value) ? value : value.toFixed(1)) : formatCurrency(value);
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-[#DDDBD7] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-[#1A1A1A]">{result.keyLabel} by {result.metricLabel.toLowerCase()}</p>
            <p className="text-xs text-[#6B6B6B]">{result.rows.length} group{result.rows.length === 1 ? "" : "s"} · Total: <span className="font-semibold text-[#1A1A1A]">{format(result.total)}</span></p>
          </div>
          <Button size="sm" variant="outline" className="border-[#DDDBD7]" onClick={() => downloadCsv(name, result)}><Download className="h-3.5 w-3.5 mr-1" /> Export CSV</Button>
        </div>
        {result.rows.length === 0 ? <p className="mt-4 text-sm text-[#6B6B6B]">No rows match these filters — loosen the date range or status filter and run again.</p> : (
          <>
            <div className="mt-4 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={result.rows} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                  <XAxis dataKey="key" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} interval={0} angle={result.rows.length > 4 ? -20 : 0} textAnchor={result.rows.length > 4 ? "end" : "middle"} height={result.rows.length > 4 ? 44 : 24} />
                  <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: "12px" }} formatter={(value: number) => [format(value), result.metricLabel]} />
                  <Bar dataKey="value" fill="#D4922A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 overflow-x-auto rounded-lg border border-[#EFEEE9]">
              <table className="w-full text-sm">
                <thead><tr className="bg-[#F7F6F3] text-left text-xs uppercase tracking-wide text-[#6B6B6B]"><th className="px-3 py-2">{result.keyLabel}</th><th className="px-3 py-2 text-right">{result.metricLabel}</th></tr></thead>
                <tbody className="divide-y divide-[#EFEEE9]">
                  {result.rows.map(row => <tr key={row.key}><td className="px-3 py-2 text-[#1A1A1A]">{row.key}</td><td className="px-3 py-2 text-right font-semibold text-[#1A1A1A]">{format(row.value)}</td></tr>)}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BuilderTab({ editing, onDone }: { editing: SavedReport | null; onDone: () => void }) {
  const utils = trpc.useUtils();
  const clients = trpc.clients.list.useQuery(undefined, { select: data => (data ?? []).map(c => ({ id: c.id, name: c.name })) });
  // The parent remounts this tab with a fresh key whenever the edit target
  // changes, so these initializers are the single seeding point.
  const storedFilters = useMemo(() => {
    try { return JSON.parse(editing?.filters ?? "{}") as { status?: string; clientId?: number; category?: string; billable?: boolean; dateFrom?: string; dateTo?: string }; }
    catch { return {} as { status?: string; clientId?: number; category?: string; billable?: boolean; dateFrom?: string; dateTo?: string }; }
  }, [editing]);
  const [dataset, setDataset] = useState<Dataset>(editing?.dataset ?? "jobs");
  const [metric, setMetric] = useState<Metric>((editing?.metric as Metric) ?? "count");
  const [groupBy, setGroupBy] = useState<GroupBy>((editing?.groupBy as GroupBy) ?? "none");
  const [status, setStatus] = useState(storedFilters.status ?? "");
  const [clientFilter, setClientFilter] = useState(storedFilters.clientId ? String(storedFilters.clientId) : "");
  const [category, setCategory] = useState(storedFilters.category ?? "");
  const [billable, setBillable] = useState(storedFilters.billable === undefined ? "" : String(storedFilters.billable));
  const [dateFrom, setDateFrom] = useState(storedFilters.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(storedFilters.dateTo ?? "");
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState(editing?.name ?? "");
  const [previewed, setPreviewed] = useState(false);

  const options = DATASET_OPTIONS[dataset];
  const filters = useMemo(() => ({
    status: status || undefined,
    clientId: clientFilter ? Number(clientFilter) : undefined,
    category: category || undefined,
    billable: billable === "" ? undefined : billable === "true",
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }), [status, clientFilter, category, billable, dateFrom, dateTo]);

  const preview = trpc.reports.preview.useQuery({ config: { dataset, metric, groupBy, filters } }, { enabled: previewed, retry: false });
  const createReport = trpc.reports.create.useMutation({ onSuccess: () => { utils.reports.list.invalidate(); setSaveOpen(false); setSaveName(""); toast.success("Report saved — run it any time from My Reports"); onDone(); }, onError: e => toast.error(e.message) });
  const updateReport = trpc.reports.update.useMutation({ onSuccess: () => { utils.reports.list.invalidate(); setSaveOpen(false); toast.success("Report updated"); onDone(); }, onError: e => toast.error(e.message) });

  const runPreview = () => { setPreviewed(true); preview.refetch(); };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-[#DDDBD7] p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium text-[#1A1A1A]">Data
            <select value={dataset} onChange={event => { setDataset(event.target.value as Dataset); setMetric(DATASET_OPTIONS[event.target.value as Dataset].metrics[0]); setGroupBy("none"); setPreviewed(false); }} className="mt-1.5 w-full form-input-light">
              {(Object.keys(DATASET_LABELS) as Dataset[]).map(key => <option key={key} value={key}>{DATASET_LABELS[key]}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-[#1A1A1A]">Measure
            <select value={metric} onChange={event => { setMetric(event.target.value as Metric); setPreviewed(false); }} className="mt-1.5 w-full form-input-light">
              {options.metrics.map(key => <option key={key} value={key}>{METRIC_LABELS[key]}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-[#1A1A1A]">Grouping
            <select value={groupBy} onChange={event => { setGroupBy(event.target.value as GroupBy); setPreviewed(false); }} className="mt-1.5 w-full form-input-light">
              {options.groupBys.map(key => <option key={key} value={key}>{GROUP_LABELS[key]}</option>)}
            </select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {options.statuses && (
            <label className="block text-sm font-medium text-[#1A1A1A]">Status filter
              <select value={status} onChange={event => { setStatus(event.target.value); setPreviewed(false); }} className="mt-1.5 w-full form-input-light">
                <option value="">Any status</option>
                {options.statuses.map(value => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}
              </select>
            </label>
          )}
          {options.hasClientFilter && (
            <label className="block text-sm font-medium text-[#1A1A1A]">Client filter
              <select value={clientFilter} onChange={event => { setClientFilter(event.target.value); setPreviewed(false); }} className="mt-1.5 w-full form-input-light">
                <option value="">All clients</option>
                {(clients.data ?? []).map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </label>
          )}
          {options.hasCategoryFilter && (
            <Field label="Category filter (optional)" value={category} onChange={v => { setCategory(v); setPreviewed(false); }} placeholder="e.g. materials" maxLen={64} />
          )}
          {options.hasBillableFilter && (
            <label className="block text-sm font-medium text-[#1A1A1A]">Billable
              <select value={billable} onChange={event => { setBillable(event.target.value); setPreviewed(false); }} className="mt-1.5 w-full form-input-light">
                <option value="">All entries</option>
                <option value="true">Billable only</option>
                <option value="false">Non-billable only</option>
              </select>
            </label>
          )}
          <Field label="From (optional)" value={dateFrom} onChange={v => { setDateFrom(v); setPreviewed(false); }} type="date" />
          <Field label="To (optional)" value={dateTo} onChange={v => { setDateTo(v); setPreviewed(false); }} type="date" />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[#EFEEE9] pt-4">
          <Button onClick={runPreview} disabled={preview.isFetching} className="bg-[#D4922A] hover:bg-[#C07F1D] text-white">{preview.isFetching ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />} Run preview</Button>
          {previewed && !preview.isFetching && !preview.error && preview.data && (
            <Button variant="outline" className="border-[#DDDBD7]" onClick={() => { setSaveName(editing?.name ?? `${DATASET_LABELS[dataset]} — ${METRIC_LABELS[metric]}`); setSaveOpen(true); }}><Plus className="h-4 w-4 mr-1" /> {editing ? "Update saved report" : "Save this report"}</Button>
          )}
          {preview.error && <p className="text-sm text-red-600">{preview.error.message}</p>}
        </div>
      </div>

      {preview.isFetching ? <div className="bg-white rounded-xl border border-[#DDDBD7] p-5"><Skeleton className="h-40" /></div>
        : previewed && preview.data && <ResultView name={editing?.name ?? DATASET_LABELS[dataset]} result={preview.data} metric={metric} />}

      <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title={editing ? "Update saved report" : "Save this report"}>
        <div className="space-y-3">
          <Field label="Report name" value={saveName} onChange={setSaveName} placeholder="e.g. Monthly invoiced by client" required maxLen={120} />
          <p className="text-xs text-[#6B6B6B]">Saved reports always run against live data — open one any time to see the latest numbers, then export to CSV.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button disabled={!saveName.trim() || createReport.isPending || updateReport.isPending} onClick={() => {
              const config = { dataset, metric, groupBy, filters };
              if (editing) updateReport.mutate({ id: editing.id, name: saveName.trim(), config });
              else createReport.mutate({ name: saveName.trim(), config });
            }} className="bg-[#D4922A] hover:bg-[#C07F1D] text-white">{editing ? "Update report" : "Save report"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function MyReportsTab({ onEdit }: { onEdit: (report: SavedReport) => void }) {
  const utils = trpc.useUtils();
  const reports = trpc.reports.list.useQuery();
  const [runningId, setRunningId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SavedReport | null>(null);
  const run = trpc.reports.run.useQuery({ id: runningId ?? 0 }, { enabled: runningId !== null, retry: false });
  const deleteReport = trpc.reports.delete.useMutation({ onSuccess: () => { utils.reports.list.invalidate(); setPendingDelete(null); toast.success("Report deleted"); }, onError: e => toast.error(e.message) });

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-[#DDDBD7] divide-y divide-[#EFEEE9]">
        {reports.isLoading ? <div className="p-5"><Skeleton className="h-12" /></div>
          : reports.data?.length === 0 ? <p className="p-6 text-sm text-[#6B6B6B] text-center">No saved reports yet. Build one in the Builder tab — pick your data, measure, and filters, preview it, then save.</p>
          : reports.data!.map(report => (
            <div key={report.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1 basis-48">
                <p className="font-semibold text-[#1A1A1A]">{report.name}</p>
                <p className="mt-0.5 text-xs text-[#6B6B6B]">{DATASET_LABELS[report.dataset]} · {METRIC_LABELS[report.metric as Metric] ?? report.metric} · {GROUP_LABELS[report.groupBy as GroupBy] ?? report.groupBy}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant="outline" className="border-[#DDDBD7]" disabled={runningId === report.id && (run.isFetching || !!run.data)} onClick={() => setRunningId(report.id)}><Play className="h-3.5 w-3.5 mr-1" /> Run</Button>
                <Button size="sm" variant="outline" className="border-[#DDDBD7]" onClick={() => onEdit(report)}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
                <Button size="sm" variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => setPendingDelete(report)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
      </div>

      {runningId !== null && (run.isFetching ? <div className="bg-white rounded-xl border border-[#DDDBD7] p-5"><Skeleton className="h-40" /></div>
        : run.error ? <p className="text-sm text-red-600">{run.error.message}</p>
          : run.data && <ResultView name={run.data.name} result={run.data} metric={run.data.metric as Metric} />)}

      <ConfirmDialog open={pendingDelete !== null} title="Delete this report?" description={`Delete "${pendingDelete?.name}"? Your underlying data is untouched — only the saved report definition is removed.`} confirmLabel="Delete report" variant="destructive" onOpenChange={open => { if (!open) setPendingDelete(null); }} onConfirm={() => pendingDelete && deleteReport.mutate({ id: pendingDelete.id })} />
    </div>
  );
}

export default function ReportsPanel() {
  const [editing, setEditing] = useState<SavedReport | null>(null);
  // Editing a saved report jumps straight to the Builder tab seeded with it;
  // remounting PanelTabs is the single switch point, so tab state never desyncs.
  const [tabSeq, setTabSeq] = useState(0);
  const tabs = useMemo(() => [
    { id: "builder", label: "Builder", icon: FileBarChart, content: <BuilderTab key={editing?.id ?? "new"} editing={editing} onDone={() => { setEditing(null); setTabSeq(seq => seq + 1); }} /> },
    { id: "saved", label: "My Reports", icon: Table2, content: <MyReportsTab onEdit={report => { setEditing(report); setTabSeq(seq => seq + 1); }} /> },
  ], [editing]);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-[#1A1A1A]">Custom Reports</h2>
        <p className="text-sm text-[#6B6B6B]">Build the exact view you need — dataset, measure, grouping, filters — then save it forever and export CSV. Included in every plan.</p>
      </div>
      <PanelTabs key={tabSeq} defaultTab="builder" tabs={tabs} />
    </div>
  );
}
