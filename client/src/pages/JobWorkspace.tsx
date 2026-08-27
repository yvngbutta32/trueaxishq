import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { getJobMarginSignal, normalizeMarginThreshold } from "@shared/jobMarginSignals";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  BriefcaseBusiness, Plus, CheckCircle2, Circle, Clock3, CalendarDays,
  DollarSign, Camera, Link2, MessageSquare, Target, Loader2, ArrowRight,
  ClipboardCheck, AlertTriangle, Receipt, Timer, X, Download, BarChart3,
} from "lucide-react";

const JOB_STATUSES = ["lead", "quoted", "approved", "scheduled", "in_progress", "awaiting_client", "completed", "cancelled"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const statusLabel = (status: string) => status.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
const money = (value: number | string | null | undefined) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value ?? 0));
const dateLabel = (value: string | Date | null | undefined) => value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Not set";

const statusStyle: Record<string, string> = {
  lead: "bg-slate-100 text-slate-700", quoted: "bg-violet-50 text-violet-700", approved: "bg-blue-50 text-blue-700",
  scheduled: "bg-amber-50 text-amber-700", in_progress: "bg-indigo-50 text-indigo-700", awaiting_client: "bg-orange-50 text-orange-700",
  completed: "bg-emerald-50 text-emerald-700", cancelled: "bg-rose-50 text-rose-700",
};

type CreateForm = { clientId: string; bookingId: string; templateId: string; title: string; description: string; status: typeof JOB_STATUSES[number]; priority: typeof PRIORITIES[number]; targetDate: string; budgetAmount: string };
const emptyForm: CreateForm = { clientId: "", bookingId: "", templateId: "", title: "", description: "", status: "lead", priority: "normal", targetDate: "", budgetAmount: "" };
type JobExpenseForm = { amount: string; category: string; description: string; vendor: string; date: string };
const newExpenseForm = (): JobExpenseForm => ({ amount: "", category: "materials", description: "", vendor: "", date: new Date().toISOString().slice(0, 10) });
type CustomerAssetForm = { name: string; assetTag: string; functionalLocation: string };
const newCustomerAssetForm = (): CustomerAssetForm => ({ name: "", assetTag: "", functionalLocation: "" });
type InspectionField = { id: string; label: string; required: boolean };
type InspectionAnswer = { fieldId: string; value: string };
const parseInspectionFields = (serialized: string): InspectionField[] => {
  try {
    const parsed = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((field): field is InspectionField => Boolean(field && typeof field.id === "string" && typeof field.label === "string" && typeof field.required === "boolean"));
  } catch {
    return [];
  }
};
const parseInspectionAnswers = (serialized: string): InspectionAnswer[] => {
  try {
    const parsed = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((answer): answer is InspectionAnswer => Boolean(answer && typeof answer.fieldId === "string" && typeof answer.value === "string"));
  } catch {
    return [];
  }
};
const COST_REPORT_STATUSES = ["all", ...JOB_STATUSES] as const;

export default function JobWorkspace() {
  const utils = trpc.useUtils();
  const { data: jobs = [], isLoading } = trpc.jobs.list.useQuery();
  const { data: clients = [] } = trpc.clients.list.useQuery();
  const { data: bookings = [] } = trpc.bookings.list.useQuery({ status: "all" });
  const { data: checklistTemplates = [] } = trpc.jobs.listChecklistTemplates.useQuery();
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(emptyForm);
  const [taskTitle, setTaskTitle] = useState("");
  const [updateMessage, setUpdateMessage] = useState("");
  const [visibleToClient, setVisibleToClient] = useState(true);
  const [approvalTitle, setApprovalTitle] = useState("");
  const [approvalDescription, setApprovalDescription] = useState("");
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [expenseForm, setExpenseForm] = useState<JobExpenseForm>(newExpenseForm);
  const [customerAssetForm, setCustomerAssetForm] = useState<CustomerAssetForm>(newCustomerAssetForm);
  const [inspectionTemplateName, setInspectionTemplateName] = useState("");
  const [inspectionTemplateFields, setInspectionTemplateFields] = useState("");
  const [inspectionRevisionSourceId, setInspectionRevisionSourceId] = useState<number | null>(null);
  const [inspectionRevisionName, setInspectionRevisionName] = useState("");
  const [inspectionRevisionFields, setInspectionRevisionFields] = useState<InspectionField[]>([]);
  const [inspectionResponseTemplateId, setInspectionResponseTemplateId] = useState("");
  const [inspectionResponseValues, setInspectionResponseValues] = useState<Record<string, string>>({});
  const [costReportOpen, setCostReportOpen] = useState(false);
  const [costReportStatus, setCostReportStatus] = useState<(typeof COST_REPORT_STATUSES)[number]>("all");
  const [marginThresholdInput, setMarginThresholdInput] = useState("30");

  useEffect(() => {
    if (!selectedJobId && jobs[0]) setSelectedJobId(jobs[0].id);
    if (selectedJobId && !jobs.some(job => job.id === selectedJobId)) setSelectedJobId(jobs[0]?.id ?? null);
  }, [jobs, selectedJobId]);

  const selectedJob = trpc.jobs.get.useQuery({ id: selectedJobId ?? 0 }, { enabled: selectedJobId !== null });
  const costReportInput = { status: costReportStatus === "all" ? undefined : costReportStatus };
  const costReport = trpc.jobs.costReport.useQuery(costReportInput, { enabled: costReportOpen });
  const exportCostReport = trpc.jobs.exportCostReport.useQuery(costReportInput, { enabled: false });
  const marginThreshold = useMemo(() => normalizeMarginThreshold(marginThresholdInput), [marginThresholdInput]);
  const costReportSignals = useMemo(() => (costReport.data ?? []).map(row => ({
    jobNumber: row.jobNumber,
    signal: getJobMarginSignal({ revenue: row.revenue, profit: row.profit, marginPercent: row.marginPercent }, marginThreshold),
  })).filter(item => item.signal !== null), [costReport.data, marginThreshold]);
  const candidatePhotos = trpc.photos.list.useQuery(
    { clientId: selectedJob.data?.job.clientId ?? 0 },
    { enabled: Boolean(photoPickerOpen && selectedJob.data?.job.clientId) },
  );
  const customerAssets = trpc.customerAssets.list.useQuery(
    { clientId: selectedJob.data?.job.clientId ?? 0 },
    { enabled: Boolean(selectedJob.data?.job.clientId) },
  );
  const inspectionTemplates = trpc.assetInspectionTemplates.list.useQuery();
  const inspectionResponses = trpc.assetInspectionResponses.listForJob.useQuery(
    { jobId: selectedJobId ?? 0 },
    { enabled: selectedJobId !== null },
  );

  const invalidateJobs = () => {
    utils.jobs.list.invalidate();
    if (selectedJobId) utils.jobs.get.invalidate({ id: selectedJobId });
    utils.expenses.list.invalidate();
  };
  const invalidateTemplates = () => utils.jobs.listChecklistTemplates.invalidate();
  const createMutation = trpc.jobs.create.useMutation({
    onSuccess: (result) => { invalidateJobs(); setSelectedJobId(result.id); setCreateOpen(false); setCreateForm(emptyForm); toast.success(`Created ${result.jobNumber}`); },
    onError: error => toast.error(error.message),
  });
  const updateMutation = trpc.jobs.update.useMutation({ onSuccess: () => { invalidateJobs(); toast.success("Job updated"); }, onError: error => toast.error(error.message) });
  const createCustomerAsset = trpc.customerAssets.create.useMutation({ onSuccess: () => { customerAssets.refetch(); setCustomerAssetForm(newCustomerAssetForm); toast.success("Private customer asset added"); }, onError: error => toast.error(error.message) });
  const setCustomerAsset = trpc.jobs.setCustomerAsset.useMutation({ onSuccess: () => { invalidateJobs(); toast.success("Private asset context updated"); }, onError: error => toast.error(error.message) });
  const setCustomerAssetActive = trpc.customerAssets.setActive.useMutation({ onSuccess: () => { customerAssets.refetch(); invalidateJobs(); toast.success("Private asset lifecycle updated"); }, onError: error => toast.error(error.message) });
  const createInspectionTemplate = trpc.assetInspectionTemplates.create.useMutation({ onSuccess: () => { inspectionTemplates.refetch(); setInspectionTemplateName(""); setInspectionTemplateFields(""); toast.success("Private inspection template added"); }, onError: error => toast.error(error.message) });
  const reviseInspectionTemplate = trpc.assetInspectionTemplates.revise.useMutation({ onSuccess: (result) => { inspectionTemplates.refetch(); setInspectionRevisionSourceId(null); setInspectionRevisionName(""); setInspectionRevisionFields([]); toast.success(`Private template revised to v${result.version}`); }, onError: error => toast.error(error.message) });
  const createInspectionResponse = trpc.assetInspectionResponses.create.useMutation({ onSuccess: () => { inspectionResponses.refetch(); setInspectionResponseTemplateId(""); setInspectionResponseValues({}); toast.success("Private inspection response saved"); }, onError: error => toast.error(error.message) });
  const addTask = trpc.jobs.addTask.useMutation({ onSuccess: () => { invalidateJobs(); setTaskTitle(""); }, onError: error => toast.error(error.message) });
  const updateTask = trpc.jobs.updateTask.useMutation({ onSuccess: invalidateJobs, onError: error => toast.error(error.message) });
  const addUpdate = trpc.jobs.addUpdate.useMutation({ onSuccess: () => { invalidateJobs(); setUpdateMessage(""); toast.success(visibleToClient ? "Client update posted" : "Internal note saved"); }, onError: error => toast.error(error.message) });
  const attachPhoto = trpc.jobs.attachPhoto.useMutation({ onSuccess: () => { invalidateJobs(); candidatePhotos.refetch(); toast.success("Photo added to this job"); }, onError: error => toast.error(error.message) });
  const createApproval = trpc.jobs.createApprovalRequest.useMutation({ onSuccess: () => { invalidateJobs(); setApprovalTitle(""); setApprovalDescription(""); toast.success("Client approval request added"); }, onError: error => toast.error(error.message) });
  const deleteApproval = trpc.jobs.deleteApprovalRequest.useMutation({ onSuccess: () => { invalidateJobs(); toast.success("Approval request removed"); }, onError: error => toast.error(error.message) });
  const createChecklistTemplate = trpc.jobs.createChecklistTemplateFromJob.useMutation({ onSuccess: (result) => { invalidateTemplates(); setSaveTemplateOpen(false); setTemplateName(""); toast.success(`Saved ${result.itemCount} checklist item${result.itemCount === 1 ? "" : "s"} as a template.`); }, onError: error => toast.error(error.message) });
  const addJobExpense = trpc.expenses.create.useMutation({ onSuccess: () => { invalidateJobs(); setExpenseForm(newExpenseForm()); toast.success("Private job cost added"); }, onError: error => toast.error(error.message) });
  const removeJobExpense = trpc.expenses.delete.useMutation({ onSuccess: () => { invalidateJobs(); toast.success("Private job cost removed"); }, onError: error => toast.error(error.message) });

  const detail = selectedJob.data;
  const linkedInspectionAsset = useMemo(() => customerAssets.data?.find(asset => asset.id === detail?.job.customerAssetId), [customerAssets.data, detail?.job.customerAssetId]);
  const activeInspectionTemplates = useMemo(() => (inspectionTemplates.data ?? []).filter(template => template.active), [inspectionTemplates.data]);
  const selectedInspectionTemplate = useMemo(() => activeInspectionTemplates.find(template => template.id === Number(inspectionResponseTemplateId)), [activeInspectionTemplates, inspectionResponseTemplateId]);
  const selectedInspectionFields = useMemo(() => selectedInspectionTemplate ? parseInspectionFields(selectedInspectionTemplate.fields) : [], [selectedInspectionTemplate]);
  const completion = useMemo(() => {
    if (!detail?.tasks.length) return 0;
    return Math.round((detail.tasks.filter(task => task.status === "done").length / detail.tasks.length) * 100);
  }, [detail?.tasks]);

  const handleCreate = () => {
    const clientId = Number(createForm.clientId);
    if (!clientId || !createForm.title.trim()) return toast.error("Choose a client and name the job.");
    const budget = createForm.budgetAmount.trim() ? Number(createForm.budgetAmount) : undefined;
    if (budget !== undefined && (!Number.isFinite(budget) || budget < 0)) return toast.error("Enter a valid budget.");
    createMutation.mutate({
      clientId, title: createForm.title, description: createForm.description || undefined, status: createForm.status,
      priority: createForm.priority, targetDate: createForm.targetDate || undefined, budgetAmount: budget,
      bookingId: createForm.bookingId ? Number(createForm.bookingId) : undefined,
      templateId: createForm.templateId ? Number(createForm.templateId) : undefined,
    });
  };

  const handleAddJobExpense = () => {
    if (!detail) return;
    const amount = Number(expenseForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter a valid cost amount.");
    if (!expenseForm.description.trim()) return toast.error("Describe the cost before saving.");
    addJobExpense.mutate({
      jobId: detail.job.id,
      amount,
      category: expenseForm.category.trim() || "other",
      description: expenseForm.description.trim(),
      vendor: expenseForm.vendor.trim() || undefined,
      date: expenseForm.date,
      taxDeductible: true,
    });
  };

  const handleCreateInspectionResponse = () => {
    if (!detail || !linkedInspectionAsset || !selectedInspectionTemplate || !selectedInspectionFields.length) {
      return toast.error("Link an eligible asset and choose a valid active template first.");
    }
    const missingRequired = selectedInspectionFields.find(field => field.required && !inspectionResponseValues[field.id]?.trim());
    if (missingRequired) return toast.error(`Add a response for ${missingRequired.label}.`);
    createInspectionResponse.mutate({
      jobId: detail.job.id,
      customerAssetId: linkedInspectionAsset.id,
      templateId: selectedInspectionTemplate.id,
      responses: selectedInspectionFields.map(field => ({ fieldId: field.id, value: inspectionResponseValues[field.id] ?? "" })),
    });
  };

  const openInspectionRevision = (template: { id: number; name: string; fields: string }) => {
    const fields = parseInspectionFields(template.fields);
    if (!fields.length) return toast.error("This template has invalid saved questions and cannot be revised.");
    setInspectionRevisionSourceId(template.id);
    setInspectionRevisionName(template.name);
    setInspectionRevisionFields(fields);
  };

  const handleReviseInspectionTemplate = () => {
    if (!inspectionRevisionSourceId || !inspectionRevisionName.trim()) return toast.error("Name the revised template before saving.");
    if (!inspectionRevisionFields.length || inspectionRevisionFields.some(field => !field.label.trim())) return toast.error("Keep at least one clearly named question.");
    if (new Set(inspectionRevisionFields.map(field => field.id)).size !== inspectionRevisionFields.length) return toast.error("Each inspection question needs a unique field ID.");
    reviseInspectionTemplate.mutate({
      id: inspectionRevisionSourceId,
      name: inspectionRevisionName.trim(),
      fields: inspectionRevisionFields.map(field => ({ ...field, label: field.label.trim() })),
    });
  };

  const downloadCostReport = async () => {
    const result = await exportCostReport.refetch();
    if (!result.data) return toast.error("The job-cost report could not be prepared.");
    const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.data.fileName;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Private job-cost CSV downloaded");
  };

  if (isLoading) return <div className="space-y-4"><div className="h-10 w-56 bg-slate-100 rounded-lg animate-pulse" /><div className="h-[460px] bg-slate-100 rounded-2xl animate-pulse" /></div>;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] uppercase text-[#D4922A]">Operations</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1A1A1A]">Job Workspace</h1>
          <p className="mt-1 text-sm text-[rgba(26,26,26,0.58)]">Run every client job from approved work to proof, payment, and completion.</p>
        </div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setCostReportOpen(true)} className="gap-2 border-emerald-200 text-emerald-800 hover:bg-emerald-50"><BarChart3 className="w-4 h-4" /> Cost report</Button><Button onClick={() => setCreateOpen(true)} className="bg-[#D4922A] hover:bg-[#B87716] text-white gap-2"><Plus className="w-4 h-4" /> New Job</Button></div>
      </header>

      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D4922A]/45 bg-[#D4922A]/5 px-6 py-16 text-center">
          <BriefcaseBusiness className="mx-auto h-12 w-12 text-[#D4922A]" />
          <h2 className="mt-4 text-lg font-bold text-[#1A1A1A]">Start with a real piece of work</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[rgba(26,26,26,0.62)]">Create a job to keep the client, appointment, checklist, proof photos, costs, invoice, and updates together.</p>
          <Button onClick={() => setCreateOpen(true)} className="mt-5 bg-[#D4922A] hover:bg-[#B87716] text-white"><Plus className="mr-2 h-4 w-4" /> Create your first job</Button>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-3 h-fit xl:sticky xl:top-4">
            <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-[rgba(26,26,26,0.45)]">Active work · {jobs.length}</div>
            <div className="max-h-[600px] space-y-1 overflow-y-auto pr-1">
              {jobs.map(job => <button key={job.id} onClick={() => setSelectedJobId(job.id)} className={`w-full rounded-xl p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4922A] ${selectedJobId === job.id ? "bg-[#1C2333] text-white shadow-sm" : "hover:bg-[#F7F6F3] text-[#1A1A1A]"}`}>
                <div className="flex items-start justify-between gap-2"><span className={`text-[10px] font-bold tracking-wide ${selectedJobId === job.id ? "text-white/65" : "text-[rgba(26,26,26,0.43)]"}`}>{job.jobNumber}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${selectedJobId === job.id ? "bg-white/15 text-white" : statusStyle[job.status] ?? "bg-slate-100 text-slate-600"}`}>{statusLabel(job.status)}</span></div>
                <p className="mt-1 truncate text-sm font-semibold">{job.title}</p><p className={`mt-0.5 truncate text-xs ${selectedJobId === job.id ? "text-white/65" : "text-[rgba(26,26,26,0.55)]"}`}>{job.clientName}</p>
                {job.targetDate && <p className={`mt-2 flex items-center gap-1 text-[11px] ${selectedJobId === job.id ? "text-white/65" : "text-[rgba(26,26,26,0.45)]"}`}><CalendarDays className="h-3 w-3" /> {dateLabel(job.targetDate)}</p>}
              </button>)}
            </div>
          </aside>

          {detail ? <section className="min-w-0 space-y-5">
            <div className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0"><p className="text-xs font-bold tracking-wide text-[#D4922A]">{detail.job.jobNumber}</p><h2 className="mt-1 text-2xl font-bold text-[#1A1A1A]">{detail.job.title}</h2><p className="mt-2 text-sm text-[rgba(26,26,26,0.6)]">{detail.job.description || "No scope note added yet."}</p><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{detail.client?.name ?? "Client"}</span>{detail.booking && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Appointment {detail.booking.date} · {detail.booking.time}</span>}{detail.invoice && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Invoice {detail.invoice.invoiceNumber}</span>}</div></div>
                <div className="grid grid-cols-2 gap-2 sm:flex lg:w-60 lg:flex-col"><label className="text-xs font-semibold text-[rgba(26,26,26,0.55)]">Status<select value={detail.job.status} onChange={event => updateMutation.mutate({ id: detail.job.id, status: event.target.value as typeof JOB_STATUSES[number] })} className="mt-1 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-2 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#D4922A]/35">{JOB_STATUSES.map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label><label className="text-xs font-semibold text-[rgba(26,26,26,0.55)]">Priority<select value={detail.job.priority} onChange={event => updateMutation.mutate({ id: detail.job.id, priority: event.target.value as typeof PRIORITIES[number] })} className="mt-1 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-2 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#D4922A]/35">{PRIORITIES.map(priority => <option key={priority} value={priority}>{statusLabel(priority)}</option>)}</select></label></div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Metric icon={<Target className="h-4 w-4" />} label="Checklist" value={`${completion}%`} detail={`${detail.tasks.filter(task => task.status === "done").length}/${detail.tasks.length || 0} completed`} />
                <Metric icon={<DollarSign className="h-4 w-4" />} label="Revenue" value={money(detail.financials.revenue)} detail={detail.invoice?.status ?? "Budget estimate"} />
                <Metric icon={<Receipt className="h-4 w-4" />} label="Tracked costs" value={money(detail.financials.totalCost)} detail={`${money(detail.financials.expenseCost)} expenses · ${money(detail.financials.laborCost)} time`} />
                <Metric icon={<DollarSign className="h-4 w-4" />} label="Projected profit" value={money(detail.financials.profit)} detail={detail.financials.marginPercent === null ? "Set revenue to calculate margin" : `${detail.financials.marginPercent}% margin`} accent={detail.financials.profit < 0 ? "text-rose-600" : "text-emerald-600"} />
              </div>
            </div>

            <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
              <section className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5">
                <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold text-[#1A1A1A]">Checklist</h3><p className="text-xs text-[rgba(26,26,26,0.52)] mt-1">Keep the next operational step visible.</p></div><div className="flex items-center gap-2">{detail.tasks.length > 0 && <Button size="sm" variant="outline" onClick={() => setSaveTemplateOpen(true)} className="border-violet-200 text-violet-800 hover:bg-violet-50">Save as template</Button>}<ClipboardCheck className="h-5 w-5 text-[#D4922A]" /></div></div>
                <div className="mt-4 space-y-2">{detail.tasks.length === 0 ? <p className="rounded-lg bg-[#F7F6F3] p-4 text-sm text-[rgba(26,26,26,0.55)]">Add the first commitment for this job.</p> : detail.tasks.map(task => <div key={task.id} className="flex items-center gap-3 rounded-xl border border-[rgba(26,26,26,0.08)] p-3"><button aria-label={`Mark ${task.title} ${task.status === "done" ? "not done" : "done"}`} onClick={() => updateTask.mutate({ id: task.id, status: task.status === "done" ? "todo" : "done" })} className="flex-shrink-0 text-[#D4922A]">{task.status === "done" ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}</button><div className="min-w-0 flex-1"><p className={`text-sm font-medium ${task.status === "done" ? "text-[rgba(26,26,26,0.45)] line-through" : "text-[#1A1A1A]"}`}>{task.title}</p>{task.dueDate && <p className="mt-0.5 text-xs text-[rgba(26,26,26,0.45)]">Due {dateLabel(task.dueDate)}</p>}</div><select aria-label={`Set ${task.title} status`} value={task.status} onChange={event => updateTask.mutate({ id: task.id, status: event.target.value as "todo" | "in_progress" | "done" })} className="rounded-md border border-[rgba(26,26,26,0.13)] bg-white px-2 py-1 text-xs text-[#1A1A1A]"><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select></div>)}</div>
                <div className="mt-3 flex gap-2"><input value={taskTitle} onChange={event => setTaskTitle(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && taskTitle.trim()) addTask.mutate({ jobId: detail.job.id, title: taskTitle.trim() }); }} maxLength={255} placeholder="Add a checklist item" className="min-w-0 flex-1 rounded-lg border border-[rgba(26,26,26,0.14)] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#D4922A]/35" /><Button size="sm" onClick={() => taskTitle.trim() && addTask.mutate({ jobId: detail.job.id, title: taskTitle.trim() })} disabled={!taskTitle.trim() || addTask.isPending} className="bg-[#1C2333] hover:bg-[#2B3446] text-white"><Plus className="h-4 w-4" /></Button></div>
              </section>

              <section className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5">
                <div className="flex items-center justify-between"><div><h3 className="font-bold text-[#1A1A1A]">Proof of work</h3><p className="text-xs text-[rgba(26,26,26,0.52)] mt-1">Estimate, in-progress, and finished evidence.</p></div><Button size="sm" variant="outline" onClick={() => setPhotoPickerOpen(true)} className="gap-1 border-[#D4922A]/40 text-[#9A610A]"><Link2 className="h-3.5 w-3.5" /> Link photo</Button></div>
                {detail.photos.length === 0 ? <div className="mt-4 rounded-xl bg-[#F7F6F3] p-5 text-center"><Camera className="mx-auto h-6 w-6 text-[#D4922A]" /><p className="mt-2 text-sm font-medium text-[#1A1A1A]">No proof attached yet</p><p className="mt-1 text-xs text-[rgba(26,26,26,0.55)]">Use Job Photos to upload work, then attach it here.</p></div> : <div className="mt-4 grid grid-cols-3 gap-2">{detail.photos.slice(0, 6).map(photo => <button key={photo.id} type="button" onClick={() => setLightboxUrl(photo.photoUrl)} className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4922A]"><img src={photo.photoUrl} alt={photo.caption || `${photo.photoType} proof`} className="h-full w-full object-cover transition-transform group-hover:scale-105" /><span className="absolute inset-x-1 bottom-1 truncate rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white">{photo.photoType}</span></button>)}</div>}
              </section>
            </div>

            <section className="rounded-2xl border border-sky-200 bg-sky-50/50 p-5">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-sky-950">Customer assets <span className="font-normal text-sky-800/75">· private</span></h3><p className="mt-1 text-xs text-sky-900/75">Owner-only equipment context for this client. Asset details and locations do not appear in the client portal.</p></div><BriefcaseBusiness className="h-5 w-5 shrink-0 text-sky-700" /></div>
              {customerAssets.isLoading ? <div className="mt-4 flex items-center gap-2 text-sm text-sky-900/70"><Loader2 className="h-4 w-4 animate-spin" /> Loading private assets…</div> : customerAssets.data?.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{customerAssets.data.map(asset => <div key={asset.id} className="rounded-xl border border-sky-100 bg-white px-4 py-3"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold text-[#1A1A1A]">{asset.name}</p>{!asset.active && <p className="mt-1 text-xs font-semibold text-amber-700">Inactive — unavailable for new job links</p>}</div><Button type="button" variant="ghost" size="sm" onClick={() => setCustomerAssetActive.mutate({ id: asset.id, active: !asset.active })} disabled={setCustomerAssetActive.isPending} className="h-8 text-xs text-sky-800 hover:bg-sky-100">{asset.active ? "Deactivate" : "Reactivate"}</Button></div>{asset.assetTag && <p className="mt-1 text-xs text-[rgba(26,26,26,0.62)]">Tag: {asset.assetTag}</p>}{asset.functionalLocation && <p className="mt-1 text-xs text-[rgba(26,26,26,0.62)]">Location: {asset.functionalLocation}</p>}</div>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-sky-200 bg-white/70 px-4 py-3 text-sm text-sky-950/70">No private assets are recorded for this client yet.</p>}
              <label className="mt-4 block text-xs font-semibold text-sky-950">Linked to this job<select aria-label="Link a private customer asset to this job" value={detail.job.customerAssetId ?? ""} onChange={event => setCustomerAsset.mutate({ jobId: detail.job.id, customerAssetId: event.target.value ? Number(event.target.value) : null })} disabled={customerAssets.isLoading || setCustomerAsset.isPending} className="mt-1 block w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-sky-300"><option value="">No asset linked</option>{customerAssets.data?.filter(asset => asset.active).map(asset => <option key={asset.id} value={asset.id}>{asset.name}{asset.assetTag ? ` · ${asset.assetTag}` : ""}</option>)}</select></label>
              <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_auto]"><label className="text-xs font-semibold text-sky-950">Asset name<input value={customerAssetForm.name} onChange={event => setCustomerAssetForm(form => ({ ...form, name: event.target.value }))} maxLength={255} placeholder="e.g. HVAC unit" className="mt-1 block w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-sky-300" /></label><label className="text-xs font-semibold text-sky-950">Tag <span className="font-normal">(optional)</span><input value={customerAssetForm.assetTag} onChange={event => setCustomerAssetForm(form => ({ ...form, assetTag: event.target.value }))} maxLength={128} placeholder="Serial or tag" className="mt-1 block w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-sky-300" /></label><label className="text-xs font-semibold text-sky-950">Location <span className="font-normal">(optional)</span><input value={customerAssetForm.functionalLocation} onChange={event => setCustomerAssetForm(form => ({ ...form, functionalLocation: event.target.value }))} maxLength={255} placeholder="e.g. Roof access" className="mt-1 block w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-sky-300" /></label><Button onClick={() => detail && customerAssetForm.name.trim() && createCustomerAsset.mutate({ clientId: detail.job.clientId, name: customerAssetForm.name.trim(), assetTag: customerAssetForm.assetTag.trim() || undefined, functionalLocation: customerAssetForm.functionalLocation.trim() || undefined })} disabled={!detail || !customerAssetForm.name.trim() || createCustomerAsset.isPending} className="self-end bg-sky-700 text-white hover:bg-sky-800">{createCustomerAsset.isPending ? "Adding…" : "Add asset"}</Button></div>
            </section>

            <section className="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-5">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-cyan-950">Inspection templates <span className="font-normal text-cyan-800/75">· private foundation</span></h3><p className="mt-1 text-xs text-cyan-900/75">Create reusable owner-only question prompts. Templates and revisions never appear in the client portal.</p></div><ClipboardCheck className="h-5 w-5 shrink-0 text-cyan-700" /></div>
              {inspectionTemplates.data?.length ? <div className="mt-4 flex flex-wrap gap-2">{inspectionTemplates.data.map(template => <span key={template.id} className={`rounded-full px-3 py-1 text-xs font-semibold ${template.active ? "bg-white text-cyan-900 ring-1 ring-cyan-200" : "bg-slate-100 text-slate-600 line-through"}`}>{template.name} · v{template.version}</span>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-cyan-200 bg-white/70 px-4 py-3 text-sm text-cyan-950/70">No private inspection templates are recorded yet.</p>}
              <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)_auto]"><label className="text-xs font-semibold text-cyan-950">Template name<input value={inspectionTemplateName} onChange={event => setInspectionTemplateName(event.target.value)} maxLength={255} placeholder="e.g. Start-up check" className="mt-1 block w-full rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-cyan-300" /></label><label className="text-xs font-semibold text-cyan-950">Questions <span className="font-normal">(one per line)</span><textarea value={inspectionTemplateFields} onChange={event => setInspectionTemplateFields(event.target.value)} maxLength={4000} rows={2} placeholder={"Power on\nCheck visible condition"} className="mt-1 block w-full rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-cyan-300" /></label><Button onClick={() => { const fields = inspectionTemplateFields.split("\n").map(label => label.trim()).filter(Boolean).map((label, index) => ({ id: `field-${index + 1}`, label, required: false })); if (!inspectionTemplateName.trim() || !fields.length) return toast.error("Add a template name and at least one question."); createInspectionTemplate.mutate({ name: inspectionTemplateName.trim(), fields }); }} disabled={createInspectionTemplate.isPending} className="self-end bg-cyan-700 text-white hover:bg-cyan-800">{createInspectionTemplate.isPending ? "Adding…" : "Add template"}</Button></div>
              {activeInspectionTemplates.length > 0 && <div className="mt-4 rounded-xl border border-cyan-200 bg-white/80 p-4"><p className="text-sm font-semibold text-cyan-950">Revise a private template</p><p className="mt-1 text-xs leading-relaxed text-cyan-900/75">Revising creates a new active version and retires its current version. Saved job responses keep their own field snapshots. Attachments, client sharing, and offline use are not included.</p><div className="mt-3 flex flex-wrap gap-2">{activeInspectionTemplates.map(template => <Button key={template.id} type="button" variant="outline" onClick={() => openInspectionRevision(template)} disabled={reviseInspectionTemplate.isPending} className="border-cyan-200 bg-white text-cyan-900 hover:bg-cyan-100">Revise {template.name} · v{template.version}</Button>)}</div></div>}
              {inspectionRevisionSourceId && <div className="mt-4 rounded-xl border border-cyan-300 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-sm font-bold text-cyan-950">Create the next private template version</h4><p className="mt-1 text-xs text-cyan-900/75">Edit the draft below. Existing question IDs are retained when a question remains; new questions receive new private IDs.</p></div><Button type="button" variant="ghost" onClick={() => { setInspectionRevisionSourceId(null); setInspectionRevisionName(""); setInspectionRevisionFields([]); }} disabled={reviseInspectionTemplate.isPending} className="text-cyan-900 hover:bg-cyan-50">Cancel</Button></div><label className="mt-4 block text-xs font-semibold text-cyan-950">Template name<input value={inspectionRevisionName} onChange={event => setInspectionRevisionName(event.target.value)} maxLength={255} className="mt-1 block w-full rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-cyan-300" /></label><div className="mt-4 space-y-3">{inspectionRevisionFields.map((field, index) => <div key={field.id} className="rounded-lg border border-cyan-100 bg-cyan-50/40 p-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="min-w-0 flex-1 text-xs font-semibold text-cyan-950">Question {index + 1}<input value={field.label} onChange={event => setInspectionRevisionFields(fields => fields.map(current => current.id === field.id ? { ...current, label: event.target.value } : current))} maxLength={255} className="mt-1 block w-full rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-cyan-300" /></label><label className="flex items-center gap-2 text-xs font-semibold text-cyan-950"><input type="checkbox" checked={field.required} onChange={event => setInspectionRevisionFields(fields => fields.map(current => current.id === field.id ? { ...current, required: event.target.checked } : current))} className="h-4 w-4 rounded border-cyan-300 text-cyan-700 focus:ring-cyan-300" /> Required</label><Button type="button" variant="outline" onClick={() => setInspectionRevisionFields(fields => fields.filter(current => current.id !== field.id))} disabled={inspectionRevisionFields.length === 1 || reviseInspectionTemplate.isPending} aria-label={`Remove question ${index + 1}`} className="border-rose-200 bg-white text-rose-700 hover:bg-rose-50">Remove</Button></div></div>)}</div><div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => setInspectionRevisionFields(fields => [...fields, { id: `field-${crypto.randomUUID()}`, label: "", required: false }])} disabled={inspectionRevisionFields.length >= 50 || reviseInspectionTemplate.isPending} className="border-cyan-200 bg-white text-cyan-900 hover:bg-cyan-50"><Plus className="mr-1.5 h-4 w-4" /> Add question</Button><Button type="button" onClick={handleReviseInspectionTemplate} disabled={reviseInspectionTemplate.isPending} className="bg-cyan-700 text-white hover:bg-cyan-800">{reviseInspectionTemplate.isPending ? "Creating…" : "Create next version"}</Button></div></div>}
            </section>

            <section className="rounded-2xl border border-teal-200 bg-teal-50/50 p-5">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-teal-950">Job inspection responses <span className="font-normal text-teal-800/75">· private</span></h3><p className="mt-1 text-xs text-teal-900/75">Record internal answers for the asset linked to this job. Saved responses stay owner-only and never appear in the client portal.</p></div><ClipboardCheck className="h-5 w-5 shrink-0 text-teal-700" /></div>
              {!linkedInspectionAsset ? <p className="mt-4 rounded-xl border border-dashed border-teal-200 bg-white/70 px-4 py-3 text-sm text-teal-950/75">Link a private customer asset to this job before recording an inspection response.</p> : <div className="mt-4 rounded-xl border border-teal-100 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-teal-800">Linked asset</p><p className="mt-1 text-sm font-semibold text-[#1A1A1A]">{linkedInspectionAsset.name}{linkedInspectionAsset.assetTag ? ` · ${linkedInspectionAsset.assetTag}` : ""}</p>{!linkedInspectionAsset.active && <p className="mt-1 text-xs text-amber-700">This retained job link is inactive for new job links.</p>}<label className="mt-4 block text-xs font-semibold text-teal-950">Active inspection template<select aria-label="Choose an active private inspection template" value={inspectionResponseTemplateId} onChange={event => { setInspectionResponseTemplateId(event.target.value); setInspectionResponseValues({}); }} disabled={inspectionTemplates.isLoading || createInspectionResponse.isPending} className="mt-1 block w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-teal-300"><option value="">Choose a template</option>{activeInspectionTemplates.map(template => <option key={template.id} value={template.id}>{template.name} · v{template.version}</option>)}</select></label>{inspectionTemplates.isError ? <p className="mt-3 text-sm text-rose-700">Private templates could not be loaded. Try again before saving.</p> : activeInspectionTemplates.length === 0 ? <p className="mt-3 text-sm text-teal-950/75">Create an active private inspection template above before recording a response.</p> : selectedInspectionTemplate && (selectedInspectionFields.length === 0 ? <p className="mt-3 text-sm text-rose-700">This template has invalid saved fields and cannot be used for a response.</p> : <div className="mt-4 space-y-3">{selectedInspectionFields.map(field => <label key={field.id} className="block text-sm font-semibold text-teal-950">{field.label}{field.required && <span className="ml-1 text-rose-700">(required)</span>}<textarea value={inspectionResponseValues[field.id] ?? ""} onChange={event => setInspectionResponseValues(values => ({ ...values, [field.id]: event.target.value }))} maxLength={4000} rows={2} placeholder="Record an internal inspection response" className="mt-1 block w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-teal-300" /></label>)}<Button type="button" onClick={handleCreateInspectionResponse} disabled={createInspectionResponse.isPending} className="bg-teal-700 text-white hover:bg-teal-800">{createInspectionResponse.isPending ? "Saving…" : "Save private response"}</Button></div>)}</div>}
              <div className="mt-4"><h4 className="text-sm font-semibold text-teal-950">Saved internal response history</h4>{inspectionResponses.isLoading ? <div className="mt-3 flex items-center gap-2 text-sm text-teal-900/70"><Loader2 className="h-4 w-4 animate-spin" /> Loading private responses…</div> : inspectionResponses.isError ? <p className="mt-3 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-700">Private inspection responses could not be loaded for this job.</p> : inspectionResponses.data?.length ? <div className="mt-3 space-y-2">{inspectionResponses.data.map(response => { const fields = parseInspectionFields(response.templateFields); const answers = new Map(parseInspectionAnswers(response.responses).map(answer => [answer.fieldId, answer.value])); return <div key={response.id} className="rounded-xl border border-teal-100 bg-white px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-[#1A1A1A]">Private template response · v{response.templateVersion}</p><p className="text-xs text-[rgba(26,26,26,0.55)]">Saved {dateLabel(response.updatedAt)}</p></div><div className="mt-2 space-y-1">{fields.map(field => <p key={field.id} className="text-xs text-[rgba(26,26,26,0.68)]"><span className="font-semibold text-[#1A1A1A]">{field.label}:</span> {answers.get(field.id) || "No response"}</p>)}</div></div>; })}</div> : <p className="mt-3 rounded-xl border border-dashed border-teal-200 bg-white/70 px-4 py-3 text-sm text-teal-950/70">No private inspection responses have been saved for this job.</p>}</div>
            </section>

            <section className="rounded-2xl border border-emerald-200 bg-emerald-50/45 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div><h3 className="font-bold text-emerald-950">Job costing <span className="font-normal text-emerald-800/75">· private</span></h3><p className="mt-1 text-xs text-emerald-900/80">Track costs that belong to this job. This is owner-only and does not appear in the client portal, invoices, or proof timeline.</p></div>
                <Receipt className="h-5 w-5 shrink-0 text-emerald-700" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <CostSummary label="Receipt-marked proof" value={detail.financials.receiptCost} />
                <CostSummary label="Logged time" value={detail.financials.laborCost} />
                <CostSummary label="Tracked expenses" value={detail.financials.expenseCost} />
                <CostSummary label="Total tracked cost" value={detail.financials.totalCost} emphasized />
              </div>
              <div className="mt-5 rounded-xl border border-emerald-200 bg-white p-4">
                <h4 className="text-sm font-semibold text-[#1A1A1A]">Add a private cost</h4>
                <p className="mt-1 text-xs text-[rgba(26,26,26,0.58)]">Record each cost once. Receipt-marked proof is already counted separately above.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-[110px_150px_minmax(0,1fr)_minmax(0,0.75fr)_130px_auto]">
                  <label className="text-xs font-semibold text-[rgba(26,26,26,0.64)]">Amount<input inputMode="decimal" value={expenseForm.amount} onChange={event => setExpenseForm(form => ({ ...form, amount: event.target.value }))} placeholder="$0.00" className="mt-1 block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-emerald-300" /></label>
                  <label className="text-xs font-semibold text-[rgba(26,26,26,0.64)]">Category<select value={expenseForm.category} onChange={event => setExpenseForm(form => ({ ...form, category: event.target.value }))} className="mt-1 block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-emerald-300"><option value="materials">Materials</option><option value="permit">Permit</option><option value="rental">Rental</option><option value="travel">Travel</option><option value="other">Other</option></select></label>
                  <label className="text-xs font-semibold text-[rgba(26,26,26,0.64)]">Description<input value={expenseForm.description} onChange={event => setExpenseForm(form => ({ ...form, description: event.target.value }))} maxLength={512} placeholder="e.g. Replacement valve" className="mt-1 block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-emerald-300" /></label>
                  <label className="text-xs font-semibold text-[rgba(26,26,26,0.64)]">Vendor <span className="font-normal">(optional)</span><input value={expenseForm.vendor} onChange={event => setExpenseForm(form => ({ ...form, vendor: event.target.value }))} maxLength={255} placeholder="Supplier" className="mt-1 block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-emerald-300" /></label>
                  <label className="text-xs font-semibold text-[rgba(26,26,26,0.64)]">Date<input type="date" value={expenseForm.date} onChange={event => setExpenseForm(form => ({ ...form, date: event.target.value }))} className="mt-1 block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-emerald-300" /></label>
                  <Button onClick={handleAddJobExpense} disabled={addJobExpense.isPending} className="self-end bg-emerald-700 text-white hover:bg-emerald-800">{addJobExpense.isPending ? "Adding…" : "Add cost"}</Button>
                </div>
              </div>
              <div className="mt-4 space-y-2">{detail.expenses.length === 0 ? <p className="rounded-xl border border-dashed border-emerald-200 bg-white/70 px-4 py-3 text-sm text-emerald-950/70">No private operating expenses are attributed to this job yet.</p> : detail.expenses.map(expense => <div key={expense.id} className="flex flex-col gap-2 rounded-xl border border-emerald-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-[#1A1A1A]">{expense.description}</p><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">{expense.category}</span></div><p className="mt-1 text-xs text-[rgba(26,26,26,0.56)]">{expense.date}{expense.vendor ? ` · ${expense.vendor}` : ""}</p></div><div className="flex items-center gap-3"><p className="text-sm font-bold text-emerald-800">{money(expense.amount)}</p><Button variant="outline" size="sm" onClick={() => removeJobExpense.mutate({ id: expense.id })} disabled={removeJobExpense.isPending} className="border-emerald-200 text-emerald-800 hover:bg-emerald-50">Remove</Button></div></div>)}</div>
            </section>

            <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-bold text-violet-950">Client approvals</h3><p className="mt-1 text-xs text-violet-900/75">Ask the client to approve a defined deliverable or request changes from their portal.</p></div><ClipboardCheck className="h-5 w-5 text-violet-700" /></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto]"><label className="text-xs font-semibold text-violet-950">Deliverable<input value={approvalTitle} onChange={event => setApprovalTitle(event.target.value)} maxLength={255} placeholder="e.g. Final design direction" className="mt-1.5 block w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-violet-300" /></label><label className="text-xs font-semibold text-violet-950">Context <span className="font-normal">(optional)</span><input value={approvalDescription} onChange={event => setApprovalDescription(event.target.value)} maxLength={5000} placeholder="What should the client review?" className="mt-1.5 block w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-violet-300" /></label><Button onClick={() => approvalTitle.trim() && createApproval.mutate({ jobId: detail.job.id, title: approvalTitle.trim(), description: approvalDescription.trim() || undefined })} disabled={!approvalTitle.trim() || createApproval.isPending} className="self-end bg-violet-700 text-white hover:bg-violet-800">Request review</Button></div>
              {detail.approvals.length > 0 && <div className="mt-4 space-y-2">{detail.approvals.map(approval => <div key={approval.id} className="rounded-xl border border-violet-100 bg-white p-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><p className="text-sm font-semibold text-[#1A1A1A]">{approval.title}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${approval.status === "approved" ? "bg-emerald-50 text-emerald-700" : approval.status === "changes_requested" ? "bg-amber-50 text-amber-700" : "bg-violet-50 text-violet-700"}`}>{approval.status === "changes_requested" ? "Changes requested" : statusLabel(approval.status)}</span></div>{approval.description && <p className="mt-1 text-xs text-[rgba(26,26,26,0.62)]">{approval.description}</p>}{approval.clientResponse && <p className="mt-2 rounded-md bg-[#F7F6F3] px-2.5 py-2 text-xs text-[#1A1A1A]"><span className="font-semibold">Client note:</span> {approval.clientResponse}</p>}</div><Button variant="outline" size="sm" onClick={() => deleteApproval.mutate({ id: approval.id })} disabled={deleteApproval.isPending} className="border-violet-200 text-violet-800 hover:bg-violet-50">Remove</Button></div></div>)}</div>}
            </section>

            <section className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold text-[#1A1A1A]">Job timeline</h3><p className="text-xs text-[rgba(26,26,26,0.52)] mt-1">A clear operational history. Client-visible updates can appear in the client portal.</p></div><MessageSquare className="h-5 w-5 text-[#D4922A]" /></div>
              <div className="mt-4 rounded-xl border border-[rgba(26,26,26,0.1)] p-3"><textarea value={updateMessage} onChange={event => setUpdateMessage(event.target.value)} maxLength={5000} placeholder="Post a progress update, approval request, or internal note…" rows={3} className="w-full resize-none bg-transparent text-sm text-[#1A1A1A] outline-none placeholder:text-[rgba(26,26,26,0.42)]" /><div className="mt-2 flex flex-col gap-2 border-t border-[rgba(26,26,26,0.08)] pt-2 sm:flex-row sm:items-center sm:justify-between"><label className="flex items-center gap-2 text-xs text-[rgba(26,26,26,0.62)]"><input type="checkbox" checked={visibleToClient} onChange={event => setVisibleToClient(event.target.checked)} className="h-4 w-4 accent-[#D4922A]" /> Visible to client</label><Button size="sm" onClick={() => updateMessage.trim() && addUpdate.mutate({ jobId: detail.job.id, message: updateMessage.trim(), visibleToClient })} disabled={!updateMessage.trim() || addUpdate.isPending} className="bg-[#1C2333] hover:bg-[#2B3446] text-white">Post update <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button></div></div>
              <div className="mt-5 space-y-4">{detail.activities.length === 0 ? <p className="text-sm text-[rgba(26,26,26,0.55)]">The job timeline starts when work begins.</p> : detail.activities.map(activity => <div key={activity.id} className="flex gap-3"><div className={`mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${activity.actor === "client" ? "bg-blue-50 text-blue-600" : activity.eventType === "internal_note" ? "bg-slate-100 text-slate-600" : "bg-[#D4922A]/10 text-[#9A610A]"}`}>{activity.actor === "client" ? <MessageSquare className="h-3.5 w-3.5" /> : activity.eventType.includes("task") ? <ClipboardCheck className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}</div><div className="min-w-0"><p className="text-sm text-[#1A1A1A]">{activity.message}</p><p className="mt-1 text-xs text-[rgba(26,26,26,0.45)]">{activity.actor} · {activity.createdAt ? new Date(activity.createdAt).toLocaleString() : ""}</p></div></div>)}</div>
            </section>
          </section> : <div className="rounded-2xl bg-white p-8 text-center text-sm text-[rgba(26,26,26,0.55)]"><Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-[#D4922A]" />Loading job workspace…</div>}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open) setCreateForm(emptyForm); }}>
        <DialogContent className="max-w-lg bg-white"><DialogHeader><DialogTitle className="flex items-center gap-2 text-[#1A1A1A]"><BriefcaseBusiness className="h-5 w-5 text-[#D4922A]" /> Create a job</DialogTitle></DialogHeader>
          <label className="mt-3 block text-sm font-semibold text-[#1A1A1A]">Checklist template <span className="font-normal text-[rgba(26,26,26,0.48)]">(optional)</span><select value={createForm.templateId} onChange={event => setCreateForm(form => ({ ...form, templateId: event.target.value }))} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A]"><option value="">Start with an empty checklist</option>{checklistTemplates.map(template => <option key={template.id} value={template.id}>{template.name} · {template.items.length} item{template.items.length === 1 ? "" : "s"}</option>)}</select></label>
          <div className="space-y-4 py-2"><label className="block text-sm font-semibold text-[#1A1A1A]">Client<select value={createForm.clientId} onChange={event => setCreateForm(form => ({ ...form, clientId: event.target.value, bookingId: "" }))} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A]"><option value="">Choose a client…</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}{client.email ? ` · ${client.email}` : ""}</option>)}</select></label><label className="block text-sm font-semibold text-[#1A1A1A]">Link appointment <span className="font-normal text-[rgba(26,26,26,0.48)]">(optional)</span><select value={createForm.bookingId} onChange={event => setCreateForm(form => ({ ...form, bookingId: event.target.value }))} disabled={!createForm.clientId} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] disabled:cursor-not-allowed disabled:bg-slate-50"><option value="">No appointment linked</option>{bookings.filter(booking => String(booking.clientId ?? "") === createForm.clientId).map(booking => <option key={booking.id} value={booking.id}>{booking.service || "Appointment"} · {booking.date} at {booking.time}</option>)}</select></label><label className="block text-sm font-semibold text-[#1A1A1A]">Job title<input value={createForm.title} onChange={event => setCreateForm(form => ({ ...form, title: event.target.value }))} maxLength={255} placeholder="e.g. Kitchen renovation" className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A]" /></label><label className="block text-sm font-semibold text-[#1A1A1A]">Scope note<textarea value={createForm.description} onChange={event => setCreateForm(form => ({ ...form, description: event.target.value }))} maxLength={5000} rows={3} placeholder="What will success look like?" className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A]" /></label><div className="grid grid-cols-2 gap-3"><label className="block text-sm font-semibold text-[#1A1A1A]">Status<select value={createForm.status} onChange={event => setCreateForm(form => ({ ...form, status: event.target.value as CreateForm["status"] }))} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A]">{JOB_STATUSES.map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label><label className="block text-sm font-semibold text-[#1A1A1A]">Priority<select value={createForm.priority} onChange={event => setCreateForm(form => ({ ...form, priority: event.target.value as CreateForm["priority"] }))} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A]">{PRIORITIES.map(priority => <option key={priority} value={priority}>{statusLabel(priority)}</option>)}</select></label></div><div className="grid grid-cols-2 gap-3"><label className="block text-sm font-semibold text-[#1A1A1A]">Target date<input type="date" value={createForm.targetDate} onChange={event => setCreateForm(form => ({ ...form, targetDate: event.target.value }))} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A]" /></label><label className="block text-sm font-semibold text-[#1A1A1A]">Budget<input inputMode="decimal" value={createForm.budgetAmount} onChange={event => setCreateForm(form => ({ ...form, budgetAmount: event.target.value }))} placeholder="$0.00" className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A]" /></label></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={handleCreate} disabled={createMutation.isPending} className="bg-[#D4922A] hover:bg-[#B87716] text-white">{createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : "Create job"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={costReportOpen} onOpenChange={setCostReportOpen}><DialogContent className="max-w-6xl bg-white"><DialogHeader><DialogTitle className="flex items-center gap-2 text-[#1A1A1A]"><BarChart3 className="h-5 w-5 text-emerald-700" /> Private job-cost report</DialogTitle></DialogHeader><div className="flex flex-col gap-3 border-y border-[rgba(26,26,26,0.08)] py-3 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-2xl text-sm text-[rgba(26,26,26,0.62)]">Compare tracked costs across your owned jobs. Revenue is a planning basis from a linked invoice or job budget; it is not accounting reconciliation.</p><div className="flex gap-2"><select aria-label="Filter job-cost report by status" value={costReportStatus} onChange={event => setCostReportStatus(event.target.value as typeof costReportStatus)} className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-[#1A1A1A]"><option value="all">All statuses</option>{JOB_STATUSES.map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select><Button onClick={downloadCostReport} disabled={exportCostReport.isFetching} className="gap-2 bg-emerald-700 text-white hover:bg-emerald-800"><Download className="h-4 w-4" />{exportCostReport.isFetching ? "Preparing…" : "CSV"}</Button></div></div><div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-amber-950">Local margin review signals</p><p className="mt-0.5 text-xs text-amber-950/70">Signals flag negative, below-threshold, or missing-revenue-basis rows in this report only. They do not send notifications or client updates.</p></div><label className="flex items-center gap-2 text-sm font-semibold text-amber-950">Threshold<input aria-label="Margin signal threshold percent" inputMode="decimal" value={marginThresholdInput} onChange={event => setMarginThresholdInput(event.target.value)} onBlur={() => setMarginThresholdInput(String(marginThreshold))} className="w-20 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-right text-[#1A1A1A] outline-none focus:ring-2 focus:ring-amber-300" />%</label></div>{costReportSignals.length > 0 && <p className="mt-3 text-xs font-medium text-amber-950"><span className="rounded-full bg-amber-200 px-2 py-1">{costReportSignals.length} review signal{costReportSignals.length === 1 ? "" : "s"}</span></p>}</div>{costReport.isLoading ? <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-700" /><p className="mt-3 text-sm text-[rgba(26,26,26,0.58)]">Building the private report…</p></div> : costReport.data?.length === 0 ? <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/45 px-6 py-12 text-center"><Receipt className="mx-auto h-8 w-8 text-emerald-700" /><h3 className="mt-3 text-sm font-semibold text-emerald-950">No jobs match this report</h3><p className="mx-auto mt-1 max-w-md text-sm text-emerald-950/70">Create a job or adjust the status filter to begin comparing owner-only cost inputs.</p></div> : <div className="mt-4 max-h-[54vh] overflow-auto"><table className="min-w-[1080px] w-full text-left text-sm"><thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-[rgba(26,26,26,0.48)]"><tr className="border-b border-[rgba(26,26,26,0.1)]"><th className="px-3 py-3">Job</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Revenue basis</th><th className="px-3 py-3 text-right">Tracked cost</th><th className="px-3 py-3 text-right">Projected profit</th><th className="px-3 py-3 text-right">Margin</th><th className="px-3 py-3">Review signal</th></tr></thead><tbody>{costReport.data?.map(row => { const signal = getJobMarginSignal({ revenue: row.revenue, profit: row.profit, marginPercent: row.marginPercent }, marginThreshold); return <tr key={row.jobNumber} className="border-b border-[rgba(26,26,26,0.07)] last:border-0"><td className="px-3 py-3"><p className="font-semibold text-[#1A1A1A]">{row.title}</p><p className="mt-0.5 text-xs text-[rgba(26,26,26,0.53)]">{row.jobNumber} · {row.clientName}</p></td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusStyle[row.status] ?? "bg-slate-100 text-slate-600"}`}>{statusLabel(row.status)}</span></td><td className="px-3 py-3 text-right"><p className="font-medium text-[#1A1A1A]">{money(row.revenue)}</p><p className="mt-0.5 text-xs text-[rgba(26,26,26,0.48)]">{row.revenueSource}</p></td><td className="px-3 py-3 text-right font-medium text-[#1A1A1A]">{money(row.totalCost)}</td><td className={`px-3 py-3 text-right font-bold ${row.profit < 0 ? "text-rose-600" : "text-emerald-700"}`}>{money(row.profit)}</td><td className="px-3 py-3 text-right font-semibold text-[#1A1A1A]">{row.marginPercent === null ? "—" : `${row.marginPercent}%`}</td><td className="px-3 py-3">{signal ? <div><p className={`text-xs font-semibold ${signal.kind === "negative_margin" ? "text-rose-700" : "text-amber-800"}`}>{signal.label}</p><p className="mt-0.5 max-w-[210px] text-[11px] leading-4 text-[rgba(26,26,26,0.56)]">{signal.detail}</p></div> : <span className="text-xs text-emerald-700">No local signal</span>}</td></tr>; })}</tbody></table></div>}<DialogFooter><Button variant="outline" onClick={() => setCostReportOpen(false)}>Close</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={photoPickerOpen} onOpenChange={setPhotoPickerOpen}><DialogContent className="max-w-xl bg-white"><DialogHeader><DialogTitle className="text-[#1A1A1A]">Attach client proof</DialogTitle></DialogHeader><p className="text-sm text-[rgba(26,26,26,0.58)]">Choose an existing photo for this client. Upload new images from Job Photos, then return here to link them.</p><div className="grid max-h-[52vh] grid-cols-3 gap-3 overflow-y-auto py-3">{candidatePhotos.isLoading ? <Loader2 className="col-span-3 mx-auto h-6 w-6 animate-spin text-[#D4922A]" /> : candidatePhotos.data?.filter(photo => !photo.jobId).map(photo => <button key={photo.id} onClick={() => attachPhoto.mutate({ jobId: detail?.job.id ?? 0, photoId: photo.id })} disabled={attachPhoto.isPending} className="group relative aspect-square overflow-hidden rounded-lg border border-[rgba(26,26,26,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4922A]"><img src={photo.photoUrl} alt={photo.caption || photo.photoType} className="h-full w-full object-cover" /><span className="absolute inset-x-1 bottom-1 rounded bg-black/65 px-1 py-0.5 text-[9px] uppercase text-white">{photo.photoType}</span></button>) || <p className="col-span-3 py-8 text-center text-sm text-[rgba(26,26,26,0.55)]">No unlinked client photos found.</p>}</div><DialogFooter><Button variant="outline" onClick={() => setPhotoPickerOpen(false)}>Close</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={saveTemplateOpen} onOpenChange={open => { setSaveTemplateOpen(open); if (!open) setTemplateName(""); }}><DialogContent className="max-w-md bg-white"><DialogHeader><DialogTitle className="flex items-center gap-2 text-[#1A1A1A]"><ClipboardCheck className="h-5 w-5 text-violet-700" /> Save checklist template</DialogTitle></DialogHeader><p className="text-sm text-[rgba(26,26,26,0.62)]">This saves the active job’s task titles as a reusable private template. Client, schedule, notes, proof, and completed states are not copied.</p><label className="mt-2 block text-sm font-semibold text-[#1A1A1A]">Template name<input value={templateName} onChange={event => setTemplateName(event.target.value)} maxLength={255} placeholder={detail?.job.title ? `${detail.job.title} checklist` : "e.g. New project checklist"} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A]" /></label><DialogFooter><Button variant="outline" onClick={() => setSaveTemplateOpen(false)}>Cancel</Button><Button onClick={() => detail && templateName.trim() && createChecklistTemplate.mutate({ jobId: detail.job.id, name: templateName.trim() })} disabled={!detail || !templateName.trim() || createChecklistTemplate.isPending} className="bg-violet-700 text-white hover:bg-violet-800">{createChecklistTemplate.isPending ? "Saving…" : "Save template"}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={Boolean(lightboxUrl)} onOpenChange={open => !open && setLightboxUrl(null)}><DialogContent className="max-w-4xl bg-black p-2"><button aria-label="Close photo" onClick={() => setLightboxUrl(null)} className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 text-black"><X className="h-4 w-4" /></button>{lightboxUrl && <img src={lightboxUrl} alt="Job proof" className="max-h-[80vh] w-full rounded object-contain" />}</DialogContent></Dialog>
    </div>
  );
}

function Metric({ icon, label, value, detail, accent }: { icon: React.ReactNode; label: string; value: string; detail: string; accent?: string }) {
  return <div className="rounded-xl bg-[#F7F6F3] p-3"><div className="flex items-center gap-1.5 text-xs font-semibold text-[rgba(26,26,26,0.53)]">{icon}{label}</div><p className={`mt-2 text-lg font-bold text-[#1A1A1A] ${accent ?? ""}`}>{value}</p><p className="mt-0.5 truncate text-[11px] text-[rgba(26,26,26,0.45)]">{detail}</p></div>;
}

function CostSummary({ label, value, emphasized = false }: { label: string; value: number | string; emphasized?: boolean }) {
  return <div className={`rounded-xl border p-3 ${emphasized ? "border-emerald-300 bg-emerald-100/65" : "border-emerald-100 bg-white"}`}><p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-950/65">{label}</p><p className="mt-1 text-lg font-bold text-emerald-950">{money(value)}</p></div>;
}
