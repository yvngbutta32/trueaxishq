import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { trpc } from "@/lib/trpc";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getFieldModeConnectivityMessage, isRetryableFieldError, loadFieldModeDraft, randomRequestId, saveFieldModeDraft } from "@shared/fieldModeRecovery";
import { getPhotoBlobStore } from "@/lib/photoStore";
import type { PendingPhotoPayload } from "@/hooks/useOfflineQueue";
import { chooseFieldModeUpdateTemplate, fieldModeUpdateTemplates } from "@shared/fieldModeClientUpdates";
import { Camera, CheckCircle2, Circle, Clock3, CloudOff, Loader2, Play, Send, Square, Timer, Upload } from "lucide-react";

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
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [completeConfirm, setCompleteConfirm] = useState(false);
  const confirmPhotoReplay = trpc.photos.confirmUpload.useMutation({ onError: () => { /* surfaced by queue retry accounting */ } });
  const attachPhotoReplay = trpc.jobs.attachPhoto.useMutation({ onError: () => { /* surfaced by queue retry accounting */ } });
  // Checklist toggles, client updates, and photos survive dead zones: they
  // queue durably and replay on reconnect. Timer and status writes stay
  // online-only by design because start/stop timestamps must stay billing-accurate.
  const replayPhoto = useCallback(async (payload: PendingPhotoPayload) => {
    const store = getPhotoBlobStore();
    const blob = await store.get(payload.blobKey);
    if (!blob) throw new Error("The offline photo is no longer on this device.");
    const body = new FormData();
    body.append("file", blob.file);
    body.append("photoType", "wip");
    const response = await fetch("/api/photos/upload", { method: "POST", body, credentials: "include" });
    const upload = await response.json() as { photoUrl?: string; photoKey?: string; error?: string };
    if (!response.ok || !upload.photoUrl || !upload.photoKey) throw new Error(upload.error || "Photo upload failed.");
    const photo = await confirmPhotoReplay.mutateAsync({ photoUrl: upload.photoUrl, photoKey: upload.photoKey, photoType: "wip", clientId: payload.clientId, bookingId: payload.bookingId, caption: payload.caption });
    await attachPhotoReplay.mutateAsync({ jobId: payload.jobId, photoId: photo.id });
    await store.delete(payload.blobKey);
  }, [attachPhotoReplay, confirmPhotoReplay]);
  const { queueOperation, pendingCount, pendingByKind, syncing } = useOfflineQueue(isOnline, replayPhoto);
  const [captureBusy, setCaptureBusy] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const captureInFlight = useRef(false);
  const { data: runningEntry } = trpc.time.runningEntry.useQuery();
  const detail = trpc.jobs.get.useQuery({ id: jobId ?? 0 }, { enabled: jobId !== null });

  useEffect(() => {
    if (!jobId && jobs[0]) setJobId(jobs[0].id);
  }, [jobId, jobs]);

  useEffect(() => {
    const markOnline = () => setIsOnline(true);
    const markOffline = () => setIsOnline(false);
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    return () => { window.removeEventListener("online", markOnline); window.removeEventListener("offline", markOffline); };
  }, []);

  useEffect(() => {
    if (!jobId) return;
    setNote(loadFieldModeDraft(jobId));
  }, [jobId]);

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
  const updateJobStatus = trpc.jobs.update.useMutation({
    onSuccess: () => {
      void utils.jobs.get.invalidate({ id: jobId ?? 0 });
      void utils.jobs.list.invalidate();
      toast.success("Job status updated. Client communication remains under your control.");
    },
    onError: error => toast.error(error.message),
  });
  const postUpdate = trpc.jobs.addUpdate.useMutation({
    onSuccess: () => {
      setNote("");
      if (jobId) saveFieldModeDraft(jobId, "");
      utils.jobs.get.invalidate({ id: jobId ?? 0 });
      toast.success("Client update posted");
    },
    onError: error => toast.error(isRetryableFieldError(error) ? "Update not sent. Your draft is saved on this device; retry when connected." : error.message),
  });
  const confirmPhoto = trpc.photos.confirmUpload.useMutation({ onError: error => toast.error(error.message) });
  const attachPhoto = trpc.jobs.attachPhoto.useMutation({ onSuccess: () => { utils.jobs.get.invalidate({ id: jobId ?? 0 }); toast.success("Proof added to job"); }, onError: error => toast.error(error.message) });
  const isUploading = confirmPhoto.isPending || attachPhoto.isPending || captureBusy;

  const completion = useMemo(() => {
    const tasks = detail.data?.tasks ?? [];
    return tasks.length ? Math.round(tasks.filter(task => task.status === "done").length / tasks.length * 100) : 0;
  }, [detail.data?.tasks]);

  const persistDraft = (value: string) => {
    setNote(value);
    if (!jobId) return;
    try {
      saveFieldModeDraft(jobId, value);
    } catch { /* an unavailable device store must not block field work */ }
  };

  const applyClientUpdateTemplate = (templateId: string) => {
    const template = chooseFieldModeUpdateTemplate(templateId);
    if (template) persistDraft(template);
  };

  const queuePhotoOffline = async (file: File) => {
    if (!activeJob || captureInFlight.current) return;
    captureInFlight.current = true;
    try {
      const store = getPhotoBlobStore();
      const blobKey = randomRequestId("photo");
      await store.put(blobKey, file);
      const payload: PendingPhotoPayload = { jobId: activeJob.id, clientId: activeJob.clientId, bookingId: activeJob.bookingId ?? undefined, caption: "Field progress photo", blobKey };
      queueOperation("photos.captureProof", payload, "photo");
    } catch {
      toast.error("Could not save the photo on this device. Try again in a moment.");
    } finally {
      captureInFlight.current = false;
    }
  };

  const captureProof = async (file?: File) => {
    if (!file || !activeJob || !detail.data || captureInFlight.current) return;
    if (!file.type.startsWith("image/")) { toast.error("Choose an image file."); return; }
    if (file.size > 16 * 1024 * 1024) { toast.error("Photo must be 16 MB or smaller."); return; }
    if (!isOnline || !navigator.onLine) { await queuePhotoOffline(file); return; }
    captureInFlight.current = true;
    setCaptureBusy(true);
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
      if (isRetryableFieldError(error)) {
        // Connection dropped mid-upload: park the photo durably instead of
        // losing it — the queue retries automatically on reconnect.
        await queuePhotoOffline(file);
      } else toast.error(error instanceof Error ? error.message : "Photo upload failed.");
    } finally {
      captureInFlight.current = false;
      setCaptureBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  const offlineMessage = getFieldModeConnectivityMessage(isOnline);
  const pendingSummary = [
    pendingByKind.updates > 0 ? `${pendingByKind.updates} ${pendingByKind.updates === 1 ? "update" : "updates"}` : null,
    pendingByKind.photos > 0 ? `${pendingByKind.photos} ${pendingByKind.photos === 1 ? "photo" : "photos"}` : null,
  ].filter(Boolean).join(" and ");

  if (isLoading) return <div className="space-y-4"><div className="h-12 w-48 animate-pulse rounded-xl bg-slate-100" /><div className="h-96 animate-pulse rounded-2xl bg-slate-100" /></div>;
  if (!jobs.length) return <div className="rounded-2xl border border-dashed border-[#D4922A]/40 bg-[#fffaf0] p-8 text-center"><Timer className="mx-auto h-9 w-9 text-[#D4922A]" /><h2 className="mt-3 text-lg font-bold text-[#1A1A1A]">Field Mode needs a job</h2><p className="mt-1 text-sm text-[rgba(26,26,26,0.62)]">Create a Job Workspace first, then return here to track work and capture proof in the field.</p></div>;

  return <div className="mx-auto max-w-3xl space-y-5 pb-8">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#D4922A]">Mobile operations</p><h1 className="mt-1 text-2xl font-bold text-[#1A1A1A]">Field Mode</h1><p className="mt-1 text-sm text-[rgba(26,26,26,0.62)]">One-handed job updates, proof, and time capture.</p></div><select aria-label="Choose active job" value={jobId ?? ""} onChange={event => setJobId(Number(event.target.value))} className="rounded-xl border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-semibold text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#D4922A]/35">{jobs.map(job => <option key={job.id} value={job.id}>{job.jobNumber} · {job.title}</option>)}</select></header>

    {(offlineMessage || pendingCount > 0 || syncing) && <section role="status" className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><p>{offlineMessage}{pendingCount > 0 ? <span className="mt-1 block font-semibold">{syncing ? `Syncing ${pendingSummary}…` : `${pendingSummary} queued and will sync automatically.`}</span> : null}</p></section>}

    {activeJob && detail.data ? <>
      <section className="rounded-2xl bg-[#1C2333] p-5 text-white shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold tracking-wide text-[#f5c36d]">{activeJob.jobNumber}</p><h2 className="mt-1 text-xl font-bold">{activeJob.title}</h2><p className="mt-1 text-sm text-white/70">{detail.data.client?.name ?? "Client"} · {completion}% checklist complete</p></div><span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold capitalize">{activeJob.status.replaceAll("_", " ")}</span></div>
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3"><p className="mr-auto text-xs text-white/75">Update the internal job stage deliberately. This does not send a client notification.</p>{["lead", "quoted", "approved", "scheduled"].includes(activeJob.status) && <Button type="button" size="sm" onClick={() => updateJobStatus.mutate({ id: activeJob.id, status: "in_progress" })} disabled={!isOnline || updateJobStatus.isPending} className="min-h-10 bg-[#D4922A] text-white hover:bg-[#b87814]">{updateJobStatus.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />} Start on-site work</Button>}{activeJob.status === "in_progress" && <Button type="button" size="sm" variant="outline" onClick={() => { setCompleteConfirm(true); }} disabled={!isOnline || updateJobStatus.isPending} className="min-h-10 border-white/30 bg-white/10 text-white hover:bg-white/20">{updateJobStatus.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />} Mark complete</Button>}</div>
        <div className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-white/8 p-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-white/65">{runningEntry ? "Live timer" : "Ready to start"}</p><p className="mt-1 font-mono text-3xl font-bold tabular-nums">{formatElapsed(elapsed)}</p></div>{runningEntry ? <Button onClick={() => stopTimer.mutate({ id: runningEntry.id })} disabled={!isOnline || stopTimer.isPending} className="min-h-12 bg-red-500 px-5 text-white hover:bg-red-600">{stopTimer.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Square className="mr-2 h-4 w-4" />} Stop</Button> : <Button onClick={() => startTimer.mutate({ jobId: activeJob.id, clientId: activeJob.clientId, clientName: detail.data.client?.name ?? undefined, description: `Field work: ${activeJob.title}`, billable: true })} disabled={!isOnline || startTimer.isPending} className="min-h-12 bg-[#D4922A] px-5 text-white hover:bg-[#b87814]">{startTimer.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="mr-2 h-4 w-4" />} Start</Button>}</div></section>

      <section className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5"><div className="flex items-center justify-between"><div><h3 className="font-bold text-[#1A1A1A]">Today’s checklist</h3><p className="text-xs text-[rgba(26,26,26,0.62)]">Tap to complete as you work.</p></div><CheckCircle2 className="h-5 w-5 text-[#D4922A]" /></div><div className="mt-4 space-y-2">{detail.data.tasks.length ? detail.data.tasks.map(task => <button key={task.id} type="button" disabled={updateTask.isPending} onClick={() => isOnline ? updateTask.mutate({ id: task.id, status: task.status === "done" ? "todo" : "done" }) : queueOperation("jobs.updateTask", { id: task.id, status: task.status === "done" ? "todo" : "done" })} className="flex w-full items-center gap-3 rounded-xl border border-[rgba(26,26,26,0.08)] p-3 text-left hover:bg-[#fffaf0] focus:outline-none focus:ring-2 focus:ring-[#D4922A]/35 disabled:cursor-not-allowed disabled:opacity-60"><span className="text-[#D4922A]">{task.status === "done" ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}</span><span className={`text-sm font-medium ${task.status === "done" ? "text-[rgba(26,26,26,0.62)] line-through" : "text-[#1A1A1A]"}`}>{task.title}</span></button>) : <p className="rounded-xl bg-[#F7F6F3] p-4 text-sm text-[rgba(26,26,26,0.62)]">No checklist items yet.</p>}</div></div>
        <div className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5"><div><h3 className="font-bold text-[#1A1A1A]">Capture proof</h3><p className="text-xs text-[rgba(26,26,26,0.62)]">Take a progress photo and attach it to this job. Offline photos are saved on this device and upload automatically when your connection returns.</p></div><input aria-label="Take a field progress photo" ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={event => void captureProof(event.target.files?.[0])} /><input aria-label="Upload a field progress photo" ref={uploadRef} type="file" accept="image/*" className="sr-only" onChange={event => void captureProof(event.target.files?.[0])} /><Button type="button" onClick={() => cameraRef.current?.click()} disabled={isUploading} className="mt-5 min-h-14 w-full bg-[#D4922A] text-white hover:bg-[#b87814]">{isUploading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Camera className="mr-2 h-5 w-5" />} Take photo</Button><Button type="button" variant="outline" onClick={() => uploadRef.current?.click()} disabled={isUploading} className="mt-2 min-h-11 w-full border-[#D4922A]/35 text-[#8a5a0b]"><Upload className="mr-2 h-4 w-4" /> Upload from device</Button><p className="mt-3 text-[11px] leading-relaxed text-[rgba(26,26,26,0.62)]">Image files only, up to 16 MB. Photos appear in the job timeline and Client Portal.</p></div></section>

      <section className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5"><div className="flex items-center justify-between"><div><h3 className="font-bold text-[#1A1A1A]">Send a client update</h3><p className="text-xs text-[rgba(26,26,26,0.62)]">Choose a starting point, review it, then post it to the client portal.</p></div><Clock3 className="h-5 w-5 text-[#D4922A]" /></div><div className="mt-4 flex flex-wrap gap-2" aria-label="Client update templates">{fieldModeUpdateTemplates.map(template => <Button key={template.id} type="button" variant="outline" onClick={() => applyClientUpdateTemplate(template.id)} className="min-h-10 border-[#D4922A]/35 text-xs font-semibold text-[#8a5a0b] hover:bg-[#fffaf0]">{template.label}</Button>)}</div><textarea value={note} onChange={event => persistDraft(event.target.value)} maxLength={5000} rows={3} placeholder="Work completed, arrival details, or next step…" className="mt-4 w-full resize-none rounded-xl border border-[rgba(26,26,26,0.14)] bg-white p-3 text-sm text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#D4922A]/35" /><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[rgba(26,26,26,0.62)]">{note.trim() ? "Draft saved on this device and recovered automatically, even after a restart." : ""}</p><div className="flex gap-2"><Button type="button" variant="outline" disabled={!note.trim()} onClick={() => { persistDraft(""); toast.success("Draft removed from this device. No client update was posted."); }} className="min-h-11 border-slate-300 text-slate-700 hover:bg-slate-50">Clear draft</Button><Button disabled={!note.trim() || (isOnline && postUpdate.isPending)} onClick={() => { if (!isOnline) { queueOperation("jobs.addUpdate", { jobId: activeJob.id, message: note.trim(), visibleToClient: true, clientRequestId: randomRequestId("update") }); persistDraft(""); setNote(""); } else postUpdate.mutate({ jobId: activeJob.id, message: note.trim(), visibleToClient: true, clientRequestId: randomRequestId("update") }); }} className="min-h-11 bg-[#1C2333] text-white hover:bg-[#2B3446]">{postUpdate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Post update</Button></div></div><p className="mt-2 text-[11px] leading-relaxed text-[rgba(26,26,26,0.56)]">Drafts are saved on this device and survive restarts. Posting remains a separate intentional client-portal action.</p></section>
    </> : <div className="rounded-2xl bg-white p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#D4922A]" /> <p className="mt-3 text-sm text-[rgba(26,26,26,0.62)]">Loading field workspace…</p></div>}
      <ConfirmDialog
        open={completeConfirm}
        onOpenChange={setCompleteConfirm}
        title="Mark this job complete?"
        description="You can still send a separate client update afterward."
        confirmLabel="Mark complete"
        onConfirm={() => { setCompleteConfirm(false); updateJobStatus.mutate({ id: activeJob!.id, status: "completed" }); }}
      />
  </div>;
}
