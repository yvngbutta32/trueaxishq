import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { CheckCircle2, ClipboardList, Loader2, LogOut, MapPin, Navigation, ShieldCheck } from "lucide-react";

export default function StaffWorkspace() {
  const [, navigate] = useLocation();
  const { user, loading, logout } = useAuth();
  const { data: workspaces = [], isLoading: workspacesLoading } = trpc.staffAccess.workspaces.useQuery(undefined, { enabled: Boolean(user) });
  const [ownerUserId, setOwnerUserId] = useState<number | null>(null);
  useEffect(() => { if (!loading && !user) navigate("/login"); }, [loading, user, navigate]);
  useEffect(() => { if (!ownerUserId && workspaces[0]) setOwnerUserId(workspaces[0].ownerUserId); }, [ownerUserId, workspaces]);
  const work = trpc.staffAccess.assignments.useQuery({ ownerUserId: ownerUserId ?? 0 }, { enabled: ownerUserId !== null });
  const utils = trpc.useUtils();
  const updateStatus = trpc.staffAccess.updateAssignmentStatus.useMutation({ onSuccess: () => { void utils.staffAccess.assignments.invalidate(); toast.success("Assignment status updated."); }, onError: error => toast.error(error.message) });
  const reportPosition = trpc.staffAccess.reportVisitPosition.useMutation({ onError: error => toast.error(error.message) });
  const [sharingVisitIds, setSharingVisitIds] = useState<Set<number>>(new Set());
  const watchersRef = useRef<Map<number, number>>(new Map());
  const lastPingRef = useRef<Map<number, number>>(new Map());
  const stopSharing = useCallback((visitId: number, notify = true) => {
    const w = watchersRef.current.get(visitId);
    if (w != null && navigator.geolocation) navigator.geolocation.clearWatch(w);
    watchersRef.current.delete(visitId);
    lastPingRef.current.delete(visitId);
    setSharingVisitIds(prev => { const next = new Set(prev); next.delete(visitId); return next; });
    if (notify) toast.message("Live position sharing stopped for this visit.");
  }, []);
  const startSharing = useCallback((visitId: number) => {
    if (!navigator.geolocation) { toast.error("This device does not support location sharing."); return; }
    const watchId = navigator.geolocation.watchPosition(
      pos => {
        const now = Date.now();
        const last = lastPingRef.current.get(visitId) ?? 0;
        if (now - last < 45_000) return; // throttle: at most one report per 45s
        lastPingRef.current.set(visitId, now);
        reportPosition.mutate({ ownerUserId: ownerUserId!, visitId, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) });
      },
      () => toast.error("Unable to read this device's location. Check the browser permission."),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    watchersRef.current.set(visitId, watchId);
    setSharingVisitIds(prev => new Set(prev).add(visitId));
    toast.success("Sharing your live position for this visit. It stops when you turn it off or the visit arrives.");
  }, [ownerUserId, reportPosition]);
  useEffect(() => () => { watchersRef.current.forEach(w => navigator.geolocation?.clearWatch(w)); watchersRef.current.clear(); }, []);
  const activeWorkspace = useMemo(() => workspaces.find(item => item.ownerUserId === ownerUserId), [ownerUserId, workspaces]);
  const handleSignOut = async () => {
    try {
      await logout();
      toast.success("Signed out.");
      navigate("/login");
    } catch {
      toast.error("Unable to sign out. Please try again.");
    }
  };
  if (loading || workspacesLoading) return <div className="min-h-screen grid place-items-center bg-[#F7F6F3]"><Loader2 className="h-7 w-7 animate-spin text-[#D4922A]" /></div>;
  if (!user) return null;
  if (!workspaces.length) return <main className="min-h-screen grid place-items-center bg-[#F7F6F3] p-4"><section className="max-w-md rounded-2xl bg-white p-7 text-center shadow-sm"><h1 className="text-xl font-bold text-[#1A1A1A]">No active staff workspace</h1><p className="mt-2 text-sm text-[rgba(26,26,26,0.62)]">Ask the workspace owner for a current private staff access link.</p></section></main>;
  return <main className="min-h-screen bg-[#F7F6F3] px-4 py-7"><section className="mx-auto max-w-4xl"><header className="flex flex-col gap-3 rounded-2xl bg-[#1C2333] p-6 text-white sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F5C842]">Assigned work</p><h1 className="mt-1 text-2xl font-bold">Field workspace</h1><p className="mt-2 max-w-xl text-sm text-white/75">Review only work assigned to you. Client records, finance, private CRM, and internal dispatch notes are intentionally excluded.</p></div><div className="flex flex-wrap items-center gap-2">{workspaces.length > 1 && <select value={ownerUserId ?? ""} onChange={event => setOwnerUserId(Number(event.target.value))} className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white"><option value="">Choose workspace</option>{workspaces.map(item => <option className="text-[#1A1A1A]" key={item.ownerUserId} value={item.ownerUserId}>{item.ownerName}</option>)}</select>}<button type="button" onClick={() => void handleSignOut()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/30 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C842] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1C2333] disabled:cursor-wait disabled:opacity-60"><LogOut className="h-4 w-4" />Sign out</button></div></header><div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><section className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5"><h2 className="flex items-center gap-2 font-bold text-[#1A1A1A]"><ClipboardList className="h-4 w-4 text-[#D4922A]" /> My assignments</h2><p className="mt-1 text-xs text-[rgba(26,26,26,0.56)]">{activeWorkspace?.teamMemberName} · {activeWorkspace?.role.replaceAll("_", " ")}</p>{work.isLoading ? <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin text-[#D4922A]" /> : !work.data?.assignments.length ? <p className="mt-5 rounded-xl bg-[#F7F6F3] p-4 text-sm text-[rgba(26,26,26,0.6)]">No assignments are currently available.</p> : <div className="mt-4 space-y-3">{work.data.assignments.map(assignment => <article key={assignment.id} className="rounded-xl border border-[rgba(26,26,26,0.1)] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold text-[#D4922A]">{assignment.jobNumber}</p><h3 className="text-sm font-bold text-[#1A1A1A]">{assignment.jobTitle}</h3><p className="mt-1 text-xs text-[rgba(26,26,26,0.56)]">{assignment.assignmentRole} · {assignment.plannedMinutes ? `${Math.round(assignment.plannedMinutes / 60 * 10) / 10}h planned` : "Planned time not set"}</p>{assignment.note && <p className="mt-2 rounded-lg bg-[#F7F6F3] p-2 text-xs text-[rgba(26,26,26,0.64)]">Owner note: {assignment.note}</p>}</div><div className="flex gap-2">{assignment.status === "assigned" && <><Action label="Acknowledge" onClick={() => updateStatus.mutate({ ownerUserId: ownerUserId!, assignmentId: assignment.id, status: "acknowledged" })} /><Action label="Decline" tone="outline" onClick={() => updateStatus.mutate({ ownerUserId: ownerUserId!, assignmentId: assignment.id, status: "declined" })} /></>}{assignment.status === "acknowledged" && <Action label="Mark complete" onClick={() => updateStatus.mutate({ ownerUserId: ownerUserId!, assignmentId: assignment.id, status: "completed" })} />}{["declined", "completed"].includes(assignment.status) && <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{assignment.status}</span>}</div></div></article>)}</div>}</section><section className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5"><h2 className="flex items-center gap-2 font-bold text-[#1A1A1A]"><MapPin className="h-4 w-4 text-[#D4922A]" /> My service visits</h2>{work.isLoading ? <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin text-[#D4922A]" /> : !work.data?.visits.length ? <p className="mt-5 text-sm text-[rgba(26,26,26,0.6)]">No service visits are currently assigned.</p> : <div className="mt-4 space-y-3">{work.data.visits.map(visit => <article key={visit.id} className="rounded-xl bg-[#F7F6F3] p-3"><p className="text-xs font-semibold text-[#D4922A]">{new Date(visit.scheduledStart).toLocaleString()}</p><h3 className="mt-1 text-sm font-bold text-[#1A1A1A]">{visit.title}</h3><p className="text-xs text-[rgba(26,26,26,0.58)]">{visit.jobNumber} · {visit.jobTitle}</p>{visit.siteLabel && <p className="mt-2 text-xs text-[rgba(26,26,26,0.65)]">Site: {visit.siteLabel}</p>}{visit.status === "en_route" && visit.trackingActive && (
  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
    <p className="text-xs font-semibold text-amber-900">The owner started a live “on my way” link for this visit.</p>
    <p className="mt-1 text-[11px] leading-4 text-amber-800/80">Sharing is optional and consent-based: your device position goes only to this visit’s tracking link, never to your client record or history. It stops when you turn it off or the visit arrives.</p>
    {sharingVisitIds.has(visit.id) ? (
      <button type="button" onClick={() => stopSharing(visit.id)} className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700">Stop sharing my position</button>
    ) : (
      <button type="button" onClick={() => startSharing(visit.id)} className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[#1C2333] px-3 py-2 text-xs font-bold text-white hover:bg-[#2B3446]"><Navigation className="h-3.5 w-3.5" />Share my live position</button>
    )}
  </div>
)}</article>)}</div>}<p className="mt-5 flex gap-2 text-xs text-[rgba(26,26,26,0.52)]"><ShieldCheck className="h-4 w-4 flex-shrink-0 text-emerald-600" />No client-contact, financial, or private dispatch access. Your position is shared only when you opt in, and only to a visit link the owner explicitly started.</p></section></div></section></main>;
}
function Action({ label, onClick, tone = "solid" }: { label: string; onClick: () => void; tone?: "solid" | "outline" }) { return <button type="button" onClick={onClick} className={`rounded-lg px-3 py-2 text-xs font-bold ${tone === "solid" ? "bg-[#D4922A] text-white" : "border border-[rgba(26,26,26,0.16)] text-[#1A1A1A]"}`}>{label}</button>; }
