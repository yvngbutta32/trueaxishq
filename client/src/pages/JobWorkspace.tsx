import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  BriefcaseBusiness, Plus, CheckCircle2, Circle, Clock3, CalendarDays,
  DollarSign, Camera, Link2, MessageSquare, Target, Loader2, ArrowRight,
  ClipboardCheck, AlertTriangle, Receipt, Timer, X,
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

type CreateForm = { clientId: string; bookingId: string; title: string; description: string; status: typeof JOB_STATUSES[number]; priority: typeof PRIORITIES[number]; targetDate: string; budgetAmount: string };
const emptyForm: CreateForm = { clientId: "", bookingId: "", title: "", description: "", status: "lead", priority: "normal", targetDate: "", budgetAmount: "" };

export default function JobWorkspace() {
  const utils = trpc.useUtils();
  const { data: jobs = [], isLoading } = trpc.jobs.list.useQuery();
  const { data: clients = [] } = trpc.clients.list.useQuery();
  const { data: bookings = [] } = trpc.bookings.list.useQuery({ status: "all" });
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(emptyForm);
  const [taskTitle, setTaskTitle] = useState("");
  const [updateMessage, setUpdateMessage] = useState("");
  const [visibleToClient, setVisibleToClient] = useState(true);
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedJobId && jobs[0]) setSelectedJobId(jobs[0].id);
    if (selectedJobId && !jobs.some(job => job.id === selectedJobId)) setSelectedJobId(jobs[0]?.id ?? null);
  }, [jobs, selectedJobId]);

  const selectedJob = trpc.jobs.get.useQuery({ id: selectedJobId ?? 0 }, { enabled: selectedJobId !== null });
  const candidatePhotos = trpc.photos.list.useQuery(
    { clientId: selectedJob.data?.job.clientId ?? 0 },
    { enabled: Boolean(photoPickerOpen && selectedJob.data?.job.clientId) },
  );

  const invalidateJobs = () => {
    utils.jobs.list.invalidate();
    if (selectedJobId) utils.jobs.get.invalidate({ id: selectedJobId });
  };
  const createMutation = trpc.jobs.create.useMutation({
    onSuccess: (result) => { invalidateJobs(); setSelectedJobId(result.id); setCreateOpen(false); setCreateForm(emptyForm); toast.success(`Created ${result.jobNumber}`); },
    onError: error => toast.error(error.message),
  });
  const updateMutation = trpc.jobs.update.useMutation({ onSuccess: () => { invalidateJobs(); toast.success("Job updated"); }, onError: error => toast.error(error.message) });
  const addTask = trpc.jobs.addTask.useMutation({ onSuccess: () => { invalidateJobs(); setTaskTitle(""); }, onError: error => toast.error(error.message) });
  const updateTask = trpc.jobs.updateTask.useMutation({ onSuccess: invalidateJobs, onError: error => toast.error(error.message) });
  const addUpdate = trpc.jobs.addUpdate.useMutation({ onSuccess: () => { invalidateJobs(); setUpdateMessage(""); toast.success(visibleToClient ? "Client update posted" : "Internal note saved"); }, onError: error => toast.error(error.message) });
  const attachPhoto = trpc.jobs.attachPhoto.useMutation({ onSuccess: () => { invalidateJobs(); candidatePhotos.refetch(); toast.success("Photo added to this job"); }, onError: error => toast.error(error.message) });

  const detail = selectedJob.data;
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
    });
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
        <Button onClick={() => setCreateOpen(true)} className="bg-[#D4922A] hover:bg-[#B87716] text-white gap-2"><Plus className="w-4 h-4" /> New Job</Button>
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
                <Metric icon={<Receipt className="h-4 w-4" />} label="Job costs" value={money(detail.financials.totalCost)} detail={`${money(detail.financials.receiptCost)} receipts · ${money(detail.financials.laborCost)} time`} />
                <Metric icon={<DollarSign className="h-4 w-4" />} label="Projected profit" value={money(detail.financials.profit)} detail={detail.financials.profit >= 0 ? "On track" : "Needs attention"} accent={detail.financials.profit < 0 ? "text-rose-600" : "text-emerald-600"} />
              </div>
            </div>

            <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
              <section className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5">
                <div className="flex items-center justify-between"><div><h3 className="font-bold text-[#1A1A1A]">Checklist</h3><p className="text-xs text-[rgba(26,26,26,0.52)] mt-1">Keep the next operational step visible.</p></div><ClipboardCheck className="h-5 w-5 text-[#D4922A]" /></div>
                <div className="mt-4 space-y-2">{detail.tasks.length === 0 ? <p className="rounded-lg bg-[#F7F6F3] p-4 text-sm text-[rgba(26,26,26,0.55)]">Add the first commitment for this job.</p> : detail.tasks.map(task => <div key={task.id} className="flex items-center gap-3 rounded-xl border border-[rgba(26,26,26,0.08)] p-3"><button aria-label={`Mark ${task.title} ${task.status === "done" ? "not done" : "done"}`} onClick={() => updateTask.mutate({ id: task.id, status: task.status === "done" ? "todo" : "done" })} className="flex-shrink-0 text-[#D4922A]">{task.status === "done" ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}</button><div className="min-w-0 flex-1"><p className={`text-sm font-medium ${task.status === "done" ? "text-[rgba(26,26,26,0.45)] line-through" : "text-[#1A1A1A]"}`}>{task.title}</p>{task.dueDate && <p className="mt-0.5 text-xs text-[rgba(26,26,26,0.45)]">Due {dateLabel(task.dueDate)}</p>}</div><select aria-label={`Set ${task.title} status`} value={task.status} onChange={event => updateTask.mutate({ id: task.id, status: event.target.value as "todo" | "in_progress" | "done" })} className="rounded-md border border-[rgba(26,26,26,0.13)] bg-white px-2 py-1 text-xs text-[#1A1A1A]"><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select></div>)}</div>
                <div className="mt-3 flex gap-2"><input value={taskTitle} onChange={event => setTaskTitle(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && taskTitle.trim()) addTask.mutate({ jobId: detail.job.id, title: taskTitle.trim() }); }} maxLength={255} placeholder="Add a checklist item" className="min-w-0 flex-1 rounded-lg border border-[rgba(26,26,26,0.14)] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#D4922A]/35" /><Button size="sm" onClick={() => taskTitle.trim() && addTask.mutate({ jobId: detail.job.id, title: taskTitle.trim() })} disabled={!taskTitle.trim() || addTask.isPending} className="bg-[#1C2333] hover:bg-[#2B3446] text-white"><Plus className="h-4 w-4" /></Button></div>
              </section>

              <section className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5">
                <div className="flex items-center justify-between"><div><h3 className="font-bold text-[#1A1A1A]">Proof of work</h3><p className="text-xs text-[rgba(26,26,26,0.52)] mt-1">Estimate, in-progress, and finished evidence.</p></div><Button size="sm" variant="outline" onClick={() => setPhotoPickerOpen(true)} className="gap-1 border-[#D4922A]/40 text-[#9A610A]"><Link2 className="h-3.5 w-3.5" /> Link photo</Button></div>
                {detail.photos.length === 0 ? <div className="mt-4 rounded-xl bg-[#F7F6F3] p-5 text-center"><Camera className="mx-auto h-6 w-6 text-[#D4922A]" /><p className="mt-2 text-sm font-medium text-[#1A1A1A]">No proof attached yet</p><p className="mt-1 text-xs text-[rgba(26,26,26,0.55)]">Use Job Photos to upload work, then attach it here.</p></div> : <div className="mt-4 grid grid-cols-3 gap-2">{detail.photos.slice(0, 6).map(photo => <button key={photo.id} type="button" onClick={() => setLightboxUrl(photo.photoUrl)} className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4922A]"><img src={photo.photoUrl} alt={photo.caption || `${photo.photoType} proof`} className="h-full w-full object-cover transition-transform group-hover:scale-105" /><span className="absolute inset-x-1 bottom-1 truncate rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white">{photo.photoType}</span></button>)}</div>}
              </section>
            </div>

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
          <div className="space-y-4 py-2"><label className="block text-sm font-semibold text-[#1A1A1A]">Client<select value={createForm.clientId} onChange={event => setCreateForm(form => ({ ...form, clientId: event.target.value, bookingId: "" }))} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A]"><option value="">Choose a client…</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}{client.email ? ` · ${client.email}` : ""}</option>)}</select></label><label className="block text-sm font-semibold text-[#1A1A1A]">Link appointment <span className="font-normal text-[rgba(26,26,26,0.48)]">(optional)</span><select value={createForm.bookingId} onChange={event => setCreateForm(form => ({ ...form, bookingId: event.target.value }))} disabled={!createForm.clientId} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] disabled:cursor-not-allowed disabled:bg-slate-50"><option value="">No appointment linked</option>{bookings.filter(booking => String(booking.clientId ?? "") === createForm.clientId).map(booking => <option key={booking.id} value={booking.id}>{booking.service || "Appointment"} · {booking.date} at {booking.time}</option>)}</select></label><label className="block text-sm font-semibold text-[#1A1A1A]">Job title<input value={createForm.title} onChange={event => setCreateForm(form => ({ ...form, title: event.target.value }))} maxLength={255} placeholder="e.g. Kitchen renovation" className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A]" /></label><label className="block text-sm font-semibold text-[#1A1A1A]">Scope note<textarea value={createForm.description} onChange={event => setCreateForm(form => ({ ...form, description: event.target.value }))} maxLength={5000} rows={3} placeholder="What will success look like?" className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A]" /></label><div className="grid grid-cols-2 gap-3"><label className="block text-sm font-semibold text-[#1A1A1A]">Status<select value={createForm.status} onChange={event => setCreateForm(form => ({ ...form, status: event.target.value as CreateForm["status"] }))} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A]">{JOB_STATUSES.map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label><label className="block text-sm font-semibold text-[#1A1A1A]">Priority<select value={createForm.priority} onChange={event => setCreateForm(form => ({ ...form, priority: event.target.value as CreateForm["priority"] }))} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A]">{PRIORITIES.map(priority => <option key={priority} value={priority}>{statusLabel(priority)}</option>)}</select></label></div><div className="grid grid-cols-2 gap-3"><label className="block text-sm font-semibold text-[#1A1A1A]">Target date<input type="date" value={createForm.targetDate} onChange={event => setCreateForm(form => ({ ...form, targetDate: event.target.value }))} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A]" /></label><label className="block text-sm font-semibold text-[#1A1A1A]">Budget<input inputMode="decimal" value={createForm.budgetAmount} onChange={event => setCreateForm(form => ({ ...form, budgetAmount: event.target.value }))} placeholder="$0.00" className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A]" /></label></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={handleCreate} disabled={createMutation.isPending} className="bg-[#D4922A] hover:bg-[#B87716] text-white">{createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : "Create job"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={photoPickerOpen} onOpenChange={setPhotoPickerOpen}><DialogContent className="max-w-xl bg-white"><DialogHeader><DialogTitle className="text-[#1A1A1A]">Attach client proof</DialogTitle></DialogHeader><p className="text-sm text-[rgba(26,26,26,0.58)]">Choose an existing photo for this client. Upload new images from Job Photos, then return here to link them.</p><div className="grid max-h-[52vh] grid-cols-3 gap-3 overflow-y-auto py-3">{candidatePhotos.isLoading ? <Loader2 className="col-span-3 mx-auto h-6 w-6 animate-spin text-[#D4922A]" /> : candidatePhotos.data?.filter(photo => !photo.jobId).map(photo => <button key={photo.id} onClick={() => attachPhoto.mutate({ jobId: detail?.job.id ?? 0, photoId: photo.id })} disabled={attachPhoto.isPending} className="group relative aspect-square overflow-hidden rounded-lg border border-[rgba(26,26,26,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4922A]"><img src={photo.photoUrl} alt={photo.caption || photo.photoType} className="h-full w-full object-cover" /><span className="absolute inset-x-1 bottom-1 rounded bg-black/65 px-1 py-0.5 text-[9px] uppercase text-white">{photo.photoType}</span></button>) || <p className="col-span-3 py-8 text-center text-sm text-[rgba(26,26,26,0.55)]">No unlinked client photos found.</p>}</div><DialogFooter><Button variant="outline" onClick={() => setPhotoPickerOpen(false)}>Close</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={Boolean(lightboxUrl)} onOpenChange={open => !open && setLightboxUrl(null)}><DialogContent className="max-w-4xl bg-black p-2"><button aria-label="Close photo" onClick={() => setLightboxUrl(null)} className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 text-black"><X className="h-4 w-4" /></button>{lightboxUrl && <img src={lightboxUrl} alt="Job proof" className="max-h-[80vh] w-full rounded object-contain" />}</DialogContent></Dialog>
    </div>
  );
}

function Metric({ icon, label, value, detail, accent }: { icon: React.ReactNode; label: string; value: string; detail: string; accent?: string }) {
  return <div className="rounded-xl bg-[#F7F6F3] p-3"><div className="flex items-center gap-1.5 text-xs font-semibold text-[rgba(26,26,26,0.53)]">{icon}{label}</div><p className={`mt-2 text-lg font-bold text-[#1A1A1A] ${accent ?? ""}`}>{value}</p><p className="mt-0.5 truncate text-[11px] text-[rgba(26,26,26,0.45)]">{detail}</p></div>;
}
