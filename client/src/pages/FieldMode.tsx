import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Camera, CheckCircle2, Circle, Clock3, Loader2, Play, Send, Square, Timer, Upload } from "lucide-react";

const formatElapsed = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
};

export default function FieldMode() {
  const utils = trpc.useUtils();
  const { data: jobs = [], isLoading } = trpc.jobs.list.useQuery();
  const [jobId, setJobId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const cameraRef = useRef<HTMLInputElement>(null);
  const { data: runningEntry } = trpc.time.runningEntry.useQuery();
  const detail = trpc.jobs.get.useQuery({ id: jobId ?? 0 }, { enabled: jobId !== null });

  useEffect(() => {
    if (!jobId && jobs[0]) setJobId(jobs[0].id);
  }, [jobId, jobs]);

  useEffect(() => {
    if (!runningEntry) { setElapsed(0); return; }
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - new Date(runningEntry.startedAt).getTime()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [runningEntry?.id]);

  const activeJob = detail.data?.job;
  const startTimer = trpc.time.start.useMutation({
    onSuccess: () => { utils.time.runningEntry.invalidate(); utils.time.list.invalidate(); toast.success("Field timer started"); },
    onError: error => toast.error(error.message),
  });
  const stopTimer = trpc.time.stop.useMutation({
    onSuccess: () => { utils.time.runningEntry.invalidate(); utils.time.list.invalidate(); utils.jobs.get.invalidate({ id: jobId ?? 0 }); toast.success("Time saved to this job"); },
    onError: error => toast.error(error.message),
  });
  const updateTask = trpc.jobs.updateTask.useMutation({ onSuccess: () => utils.jobs.get.invalidate({ id: jobId ?? 0 }), onError: error => toast.error(error.message) });
  const postUpdate = trpc.jobs.addUpdate.useMutation({
    onSuccess: () => { setNote(""); utils.jobs.get.invalidate({ id: jobId ?? 0 }); toast.success("Client update posted"); },
    onError: error => toast.error(error.message),
  });
  const confirmPhoto = trpc.photos.confirmUpload.useMutation({ onError: error => toast.error(error.message) });
  const attachPhoto = trpc.jobs.attachPhoto.useMutation({ onSuccess: () => { utils.jobs.get.invalidate({ id: jobId ?? 0 }); toast.success("Proof added to job"); }, onError: error => toast.error(error.message) });
  const isUploading = confirmPhoto.isPending || attachPhoto.isPending;

  const completion = useMemo(() => {
    const tasks = detail.data?.tasks ?? [];
    return tasks.length ? Math.round(tasks.filter(task => task.status === "done").length / tasks.length * 100) : 0;
  }, [detail.data?.tasks]);

  const captureProof = async (file?: File) => {
    if (!file || !activeJob || !detail.data) return;
    if (!file.type.startsWith("image/")) { toast.error("Choose an image file."); return; }
    if (file.size > 16 * 1024 * 1024) { toast.error("Photo must be 16 MB or smaller."); return; }
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("photoType", "wip");
      const response = await fetch("/api/photos/upload", { method: "POST", body, credentials: "include" });
      const upload = await response.json() as { photoUrl?: string; photoKey?: string; error?: string };
      if (!response.ok || !upload.photoUrl || !upload.photoKey) throw new Error(upload.error || "Photo upload failed.");
      const photo = await confirmPhoto.mutateAsync({ photoUrl: upload.photoUrl, photoKey: upload.photoKey, photoType: "wip", clientId: activeJob.clientId, bookingId: activeJob.bookingId ?? undefined, caption: "Field progress photo" });
      await attachPhoto.mutateAsync({ jobId: activeJob.id, photoId: photo.id });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Photo upload failed.");
    } finally {
      if (cameraRef.current) cameraRef.current.value = "";
    }
  };

  if (isLoading) return <div className="space-y-4"><div className="h-12 w-48 animate-pulse rounded-xl bg-slate-100" /><div className="h-96 animate-pulse rounded-2xl bg-slate-100" /></div>;
  if (!jobs.length) return <div className="rounded-2xl border border-dashed border-[#D4922A]/40 bg-[#fffaf0] p-8 text-center"><Timer className="mx-auto h-9 w-9 text-[#D4922A]" /><h2 className="mt-3 text-lg font-bold text-[#1A1A1A]">Field Mode needs a job</h2><p className="mt-1 text-sm text-[rgba(26,26,26,0.58)]">Create a Job Workspace first, then return here to track work and capture proof in the field.</p></div>;

  return <div className="mx-auto max-w-3xl space-y-5 pb-8">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#D4922A]">Mobile operations</p><h1 className="mt-1 text-2xl font-bold text-[#1A1A1A]">Field Mode</h1><p className="mt-1 text-sm text-[rgba(26,26,26,0.58)]">One-handed job updates, proof, and time capture.</p></div><select aria-label="Choose active job" value={jobId ?? ""} onChange={event => setJobId(Number(event.target.value))} className="rounded-xl border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-semibold text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#D4922A]/35">{jobs.map(job => <option key={job.id} value={job.id}>{job.jobNumber} · {job.title}</option>)}</select></header>

    {activeJob && detail.data ? <>
      <section className="rounded-2xl bg-[#1C2333] p-5 text-white shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold tracking-wide text-[#f5c36d]">{activeJob.jobNumber}</p><h2 className="mt-1 text-xl font-bold">{activeJob.title}</h2><p className="mt-1 text-sm text-white/65">{detail.data.client?.name ?? "Client"} · {completion}% checklist complete</p></div><span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold capitalize">{activeJob.status.replaceAll("_", " ")}</span></div>
        <div className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-white/8 p-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-white/55">{runningEntry ? "Live timer" : "Ready to start"}</p><p className="mt-1 font-mono text-3xl font-bold tabular-nums">{formatElapsed(elapsed)}</p></div>{runningEntry ? <Button onClick={() => stopTimer.mutate({ id: runningEntry.id })} disabled={stopTimer.isPending} className="min-h-12 bg-red-500 px-5 text-white hover:bg-red-600">{stopTimer.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Square className="mr-2 h-4 w-4" />} Stop</Button> : <Button onClick={() => startTimer.mutate({ jobId: activeJob.id, clientId: activeJob.clientId, clientName: detail.data.client?.name ?? undefined, description: `Field work: ${activeJob.title}`, billable: true })} disabled={startTimer.isPending} className="min-h-12 bg-[#D4922A] px-5 text-white hover:bg-[#b87814]">{startTimer.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="mr-2 h-4 w-4" />} Start</Button>}</div></section>

      <section className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5"><div className="flex items-center justify-between"><div><h3 className="font-bold text-[#1A1A1A]">Today’s checklist</h3><p className="text-xs text-[rgba(26,26,26,0.52)]">Tap to complete as you work.</p></div><CheckCircle2 className="h-5 w-5 text-[#D4922A]" /></div><div className="mt-4 space-y-2">{detail.data.tasks.length ? detail.data.tasks.map(task => <button key={task.id} type="button" onClick={() => updateTask.mutate({ id: task.id, status: task.status === "done" ? "todo" : "done" })} className="flex w-full items-center gap-3 rounded-xl border border-[rgba(26,26,26,0.08)] p-3 text-left hover:bg-[#fffaf0] focus:outline-none focus:ring-2 focus:ring-[#D4922A]/35"><span className="text-[#D4922A]">{task.status === "done" ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}</span><span className={`text-sm font-medium ${task.status === "done" ? "text-[rgba(26,26,26,0.45)] line-through" : "text-[#1A1A1A]"}`}>{task.title}</span></button>) : <p className="rounded-xl bg-[#F7F6F3] p-4 text-sm text-[rgba(26,26,26,0.55)]">No checklist items yet.</p>}</div></div>
        <div className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5"><div><h3 className="font-bold text-[#1A1A1A]">Capture proof</h3><p className="text-xs text-[rgba(26,26,26,0.52)]">Take a progress photo and attach it to this job.</p></div><input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={event => void captureProof(event.target.files?.[0])} /><Button type="button" onClick={() => cameraRef.current?.click()} disabled={isUploading} className="mt-5 min-h-14 w-full bg-[#D4922A] text-white hover:bg-[#b87814]">{isUploading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Camera className="mr-2 h-5 w-5" />} Take or add photo</Button><Button type="button" variant="outline" onClick={() => cameraRef.current?.click()} disabled={isUploading} className="mt-2 min-h-11 w-full border-[#D4922A]/35 text-[#8a5a0b]"><Upload className="mr-2 h-4 w-4" /> Upload from device</Button><p className="mt-3 text-[11px] leading-relaxed text-[rgba(26,26,26,0.47)]">Image files only, up to 16 MB. Photos appear in the job timeline and Client Portal.</p></div></section>

      <section className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5"><div className="flex items-center justify-between"><div><h3 className="font-bold text-[#1A1A1A]">Send a client update</h3><p className="text-xs text-[rgba(26,26,26,0.52)]">Keep progress visible without switching apps.</p></div><Clock3 className="h-5 w-5 text-[#D4922A]" /></div><textarea value={note} onChange={event => setNote(event.target.value)} maxLength={5000} rows={3} placeholder="Work completed, arrival details, or next step…" className="mt-4 w-full resize-none rounded-xl border border-[rgba(26,26,26,0.14)] bg-white p-3 text-sm text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#D4922A]/35" /><div className="mt-3 flex justify-end"><Button disabled={!note.trim() || postUpdate.isPending} onClick={() => postUpdate.mutate({ jobId: activeJob.id, message: note.trim(), visibleToClient: true })} className="min-h-11 bg-[#1C2333] text-white hover:bg-[#2B3446]">{postUpdate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Post update</Button></div></section>
    </> : <div className="rounded-2xl bg-white p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#D4922A]" /> <p className="mt-3 text-sm text-[rgba(26,26,26,0.55)]">Loading field workspace…</p></div>}
  </div>;
}
