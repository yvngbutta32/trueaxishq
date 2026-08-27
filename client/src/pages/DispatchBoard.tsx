import { useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MapView } from "@/components/Map";
import { toast } from "sonner";
import { AlertTriangle, CalendarPlus, CarFront, CheckCircle2, Clock3, Loader2, MapPin, Route, X } from "lucide-react";

const VISIT_STATUSES = ["scheduled", "en_route", "in_progress", "completed", "cancelled"] as const;

const toDateTimeLocal = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};
const startOfNextHour = () => {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  return date;
};
const defaultVisitForm = () => {
  const start = startOfNextHour();
  const end = new Date(start.getTime() + 60 * 60_000);
  return { assignmentId: "", title: "", start: toDateTimeLocal(start), end: toDateTimeLocal(end), siteLabel: "", dispatchNote: "", clientVisible: false, clientUpdate: "", allowConflict: false };
};
const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, character => character.toUpperCase());
const dateTime = (value: Date | string) => new Date(value).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function DispatchBoard() {
  const utils = trpc.useUtils();
  const { data: visits = [], isLoading } = trpc.dispatch.listVisits.useQuery();
  const { data: assignments = [] } = trpc.team.listAssignments.useQuery();
  const { data: capacity = [] } = trpc.team.capacity.useQuery();
  const { data: recurringPlans = [] } = trpc.recurringServicePlans.list.useQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(defaultVisitForm);
  const [mapResult, setMapResult] = useState<{ resolved: number; unresolved: number } | null>(null);
  const [routeState, setRouteState] = useState<"idle" | "loading" | "ready" | "unavailable" | "error">("idle");
  const dispatchMapRef = useRef<google.maps.Map | null>(null);
  const routeRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const resolvedStopsRef = useRef<google.maps.LatLng[]>([]);

  const dispatchableAssignments = useMemo(() => assignments.filter(assignment => ["assigned", "acknowledged"].includes(assignment.status) && !["completed", "cancelled"].includes(assignment.jobStatus)), [assignments]);
  const activeVisits = useMemo(() => visits.filter(visit => !["completed", "cancelled"].includes(visit.status)), [visits]);
  const mappableVisits = useMemo(() => activeVisits.filter(visit => Boolean(visit.siteLabel?.trim())).sort((left, right) => new Date(left.scheduledStart).getTime() - new Date(right.scheduledStart).getTime()).slice(0, 12), [activeVisits]);
  const selectedAssignment = useMemo(() => assignments.find(assignment => String(assignment.id) === form.assignmentId), [assignments, form.assignmentId]);
  const selectedCapacity = useMemo(() => selectedAssignment ? capacity.find(member => member.id === selectedAssignment.teamMemberId) : undefined, [capacity, selectedAssignment]);
  const groupedVisits = useMemo(() => visits.reduce<Record<string, typeof visits>>((groups, visit) => {
    const key = new Date(visit.scheduledStart).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    (groups[key] ??= []).push(visit);
    return groups;
  }, {}), [visits]);

  const invalidate = () => { void utils.dispatch.listVisits.invalidate(); void utils.jobs.get.invalidate(); void utils.recurringServicePlans.list.invalidate(); };
  const createVisit = trpc.dispatch.createVisit.useMutation({
    onSuccess: result => { invalidate(); setCreateOpen(false); setForm(defaultVisitForm()); toast.success(result.conflictAcknowledged ? "Visit scheduled with the acknowledged overlap." : "Service visit scheduled."); },
    onError: error => {
      if (error.data?.code === "CONFLICT") toast.error("This time overlaps an active visit. Select the exception acknowledgement only if this is intentional.");
      else toast.error(error.message);
    },
  });
  const updateVisit = trpc.dispatch.updateVisit.useMutation({ onSuccess: invalidate, onError: error => toast.error(error.message) });
  const cancelVisit = trpc.dispatch.cancelVisit.useMutation({ onSuccess: () => { invalidate(); toast.success("Service visit cancelled."); }, onError: error => toast.error(error.message) });
  const generateRecurringVisit = trpc.recurringServicePlans.generateNextVisit.useMutation({ onSuccess: result => { invalidate(); toast.success(result.created ? "Next recurring visit generated for owner dispatch." : "This recurring visit already exists."); }, onError: error => toast.error(error.message) });

  const previewRoute = () => {
    const map = dispatchMapRef.current;
    const stops = resolvedStopsRef.current;
    if (!map || !window.google?.maps || stops.length < 2) { setRouteState("unavailable"); return; }
    setRouteState("loading");
    const renderer = routeRendererRef.current ?? new window.google.maps.DirectionsRenderer({ map, suppressMarkers: true, preserveViewport: true });
    renderer.setMap(map);
    routeRendererRef.current = renderer;
    new window.google.maps.DirectionsService().route({
      origin: stops[0], destination: stops[stops.length - 1],
      waypoints: stops.slice(1, -1).map(location => ({ location, stopover: true })),
      optimizeWaypoints: false, travelMode: window.google.maps.TravelMode.DRIVING,
    }, (result, status) => {
      if (status === "OK" && result) { renderer.setDirections(result); setRouteState("ready"); }
      else setRouteState("error");
    });
  };

  const clearRoute = () => {
    routeRendererRef.current?.setMap(null);
    routeRendererRef.current = null;
    setRouteState("idle");
  };

  const submitVisit = () => {
    if (!selectedAssignment) return toast.error("Choose an active job assignment.");
    const scheduledStart = new Date(form.start);
    const scheduledEnd = new Date(form.end);
    if (!form.title.trim()) return toast.error("Name the service visit.");
    if (Number.isNaN(scheduledStart.getTime()) || Number.isNaN(scheduledEnd.getTime()) || scheduledEnd <= scheduledStart) return toast.error("Choose a valid visit window.");
    createVisit.mutate({
      jobId: selectedAssignment.jobId,
      teamMemberId: selectedAssignment.teamMemberId,
      title: form.title.trim(),
      scheduledStart,
      scheduledEnd,
      siteLabel: form.siteLabel.trim() || undefined,
      dispatchNote: form.dispatchNote.trim() || undefined,
      clientVisible: form.clientVisible,
      clientUpdate: form.clientVisible ? form.clientUpdate.trim() || undefined : undefined,
      allowConflict: form.allowConflict,
    });
  };

  if (isLoading) return <div className="h-[480px] rounded-2xl bg-slate-100 animate-pulse" />;

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4922A]">Operations</p><h1 className="mt-1 text-2xl font-bold text-[#1A1A1A]">Dispatch Board</h1><p className="mt-1 max-w-2xl text-sm text-[rgba(26,26,26,0.62)]">Turn job ownership into clear service visits, controlled handoffs, and client-ready progress without hidden schedule conflicts.</p></div><Button onClick={() => setCreateOpen(true)} disabled={!dispatchableAssignments.length} className="bg-[#D4922A] text-white hover:bg-[#B87716]"><CalendarPlus className="mr-2 h-4 w-4" /> Schedule visit</Button></header>

    <section className="grid gap-3 sm:grid-cols-3"><Metric label="Active visits" value={String(activeVisits.length)} detail="Scheduled, en route, or in progress" /><Metric label="Ready assignments" value={String(dispatchableAssignments.length)} detail="Job owners available for scheduling" /><Metric label="Operating boundary" value="Manual" detail="No GPS, routing, or automated ETA claims" /></section>

    <section className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-[#1A1A1A]">Recurring service plans</h2><p className="mt-1 max-w-2xl text-xs text-[rgba(26,26,26,0.6)]">Owner-only planning. Generate the next internal visit when ready, then use dispatch to select a team member. Plans do not bill, notify clients, or assume staff availability.</p></div><span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700">Private planning</span></div>{recurringPlans.length === 0 ? <p className="mt-4 rounded-xl bg-[#F7F6F3] p-4 text-xs text-[rgba(26,26,26,0.6)]">No recurring plans yet. Create plans from the owner recurring-service workflow; generated visits remain unassigned until you dispatch them.</p> : <div className="mt-4 space-y-2">{recurringPlans.map(plan => <article key={plan.id} className="flex flex-col gap-3 rounded-xl border border-[rgba(26,26,26,0.1)] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-[#1A1A1A]">{plan.name}</p><p className="mt-1 text-xs text-[rgba(26,26,26,0.6)]">{plan.jobNumber} · {plan.serviceName} · {label(plan.frequency)} · Next: {plan.nextVisitAt ? dateTime(plan.nextVisitAt) : "No further visit"}</p></div><Button size="sm" variant="outline" disabled={!plan.active || !plan.nextVisitAt || generateRecurringVisit.isPending} onClick={() => generateRecurringVisit.mutate({ id: plan.id })}>Generate unassigned visit</Button></article>)}</div>}</section>

    <section className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-[#1A1A1A]">Service timeline</h2><p className="mt-1 text-xs text-[rgba(26,26,26,0.56)]">“En route” is a deliberate internal status. Owners can explicitly share a curated visit window and update; the board never exposes staffing, live location, routing, or ETA data.</p></div><Route className="h-5 w-5 text-[#D4922A]" /></div>{visits.length === 0 ? <div className="mt-5 rounded-xl bg-[#F7F6F3] px-5 py-10 text-center"><CarFront className="mx-auto h-8 w-8 text-[#D4922A]" /><h3 className="mt-3 text-sm font-bold text-[#1A1A1A]">No service visits scheduled</h3><p className="mx-auto mt-1 max-w-md text-xs text-[rgba(26,26,26,0.56)]">Create a job assignment first, then schedule a service visit for the person responsible for the work.</p>{dispatchableAssignments.length > 0 && <Button size="sm" onClick={() => setCreateOpen(true)} className="mt-4 bg-[#1C2333] text-white hover:bg-[#2B3446]"><CalendarPlus className="mr-1 h-4 w-4" /> Schedule first visit</Button>}</div> : <div className="mt-5 space-y-6">{Object.entries(groupedVisits).map(([day, dayVisits]) => <div key={day}><h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[rgba(26,26,26,0.48)]">{day}</h3><div className="space-y-2">{dayVisits.map(visit => <article key={visit.id} className="rounded-xl border border-[rgba(26,26,26,0.1)] p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="truncate text-sm font-bold text-[#1A1A1A]">{visit.title}</h4><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${visit.status === "completed" ? "bg-emerald-50 text-emerald-700" : visit.status === "cancelled" ? "bg-slate-100 text-slate-600" : visit.status === "in_progress" ? "bg-indigo-50 text-indigo-700" : visit.status === "en_route" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>{label(visit.status)}</span>{visit.clientVisible && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700">Client visible</span>}</div><p className="mt-1 text-xs text-[rgba(26,26,26,0.6)]">{visit.jobNumber} · {visit.jobTitle} · {visit.clientName}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[rgba(26,26,26,0.56)]"><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{dateTime(visit.scheduledStart)} – {new Date(visit.scheduledEnd).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>{visit.teamMemberName && <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: visit.teamMemberColor ?? "#D4922A" }} />{visit.teamMemberName}</span>}{visit.siteLabel && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{visit.siteLabel}</span>}</div>{visit.clientVisible && visit.clientUpdate && <p className="mt-2 rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-900">Client update: {visit.clientUpdate}</p>}{visit.dispatchNote && <p className="mt-2 rounded-lg bg-[#F7F6F3] px-3 py-2 text-xs text-[rgba(26,26,26,0.62)]">Internal note: {visit.dispatchNote}</p>}</div><div className="flex shrink-0 flex-wrap items-center gap-2"><button type="button" onClick={() => updateVisit.mutate({ id: visit.id, clientVisible: !visit.clientVisible })} className="rounded-lg border border-teal-200 px-2 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50" aria-label={`${visit.clientVisible ? "Hide" : "Share"} ${visit.title} in the client portal`}>{visit.clientVisible ? "Hide from client" : "Share with client"}</button><select aria-label={`Set status for ${visit.title}`} value={visit.status} onChange={event => updateVisit.mutate({ id: visit.id, status: event.target.value as typeof VISIT_STATUSES[number] })} className="rounded-lg border border-[rgba(26,26,26,0.14)] bg-white px-2 py-2 text-xs font-semibold text-[#1A1A1A]">{VISIT_STATUSES.map(status => <option key={status} value={status}>{label(status)}</option>)}</select>{visit.status !== "cancelled" && <button type="button" onClick={() => cancelVisit.mutate({ id: visit.id })} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50" aria-label={`Cancel ${visit.title}`}><X className="h-4 w-4" /></button>}</div></div></article>)}</div></div>)}</div>}</section>

    <section className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-[#1A1A1A]">Private site preview</h2><p className="mt-1 max-w-2xl text-xs text-[rgba(26,26,26,0.6)]">Preview up to 12 active visit site labels for owner planning. Locations are never added to the client portal. You can preview the scheduled stop order, but it is not optimized routing, live traffic, staff tracking, or a client-facing ETA.</p></div><MapPin className="h-5 w-5 text-[#D4922A]" /></div>{mappableVisits.length === 0 ? <p className="mt-4 rounded-xl bg-[#F7F6F3] p-4 text-sm text-[rgba(26,26,26,0.62)]">Add a site label to an active service visit to preview its location privately.</p> : <><div className="mt-4 overflow-hidden rounded-xl border border-[rgba(26,26,26,0.1)]"><MapView initialZoom={10} className="h-[320px]" onMapReady={map => { if (!window.google?.maps) return; dispatchMapRef.current = map; resolvedStopsRef.current = []; setMapResult(null); setRouteState("idle"); const geocoder = new window.google.maps.Geocoder(); const bounds = new window.google.maps.LatLngBounds(); let resolved = 0; let unresolved = 0; mappableVisits.forEach(visit => { const siteLabel = visit.siteLabel?.trim(); if (!siteLabel) return; geocoder.geocode({ address: siteLabel }, (results, status) => { if (status === "OK" && results?.[0]) { const position = results[0].geometry.location; resolvedStopsRef.current.push(position); new window.google!.maps.marker.AdvancedMarkerElement({ map, position, title: visit.title }); bounds.extend(position); resolved += 1; if (resolved === 1) map.setCenter(position); else map.fitBounds(bounds, 48); } else unresolved += 1; if (resolved + unresolved === mappableVisits.length) setMapResult({ resolved, unresolved }); }); }); }} /></div><div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p role="status" className="text-xs text-[rgba(26,26,26,0.62)]">{mapResult ? mapResult.resolved ? `${mapResult.resolved} private site ${mapResult.resolved === 1 ? "location was" : "locations were"} resolved.${mapResult.unresolved ? ` ${mapResult.unresolved} label${mapResult.unresolved === 1 ? " could" : "s could"} not be resolved.` : ""}` : "No site labels could be resolved for a route preview." : "Resolving private site labels…"}</p><div className="flex shrink-0 gap-2"><Button type="button" size="sm" variant="outline" onClick={previewRoute} disabled={!mapResult || mapResult.resolved < 2 || routeState === "loading"} className="border-[#D4922A]/40 text-[#8A5A0B]">{routeState === "loading" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Route className="mr-1 h-3.5 w-3.5" />} Preview stop order</Button>{routeState === "ready" && <Button type="button" size="sm" variant="outline" onClick={clearRoute} className="border-slate-300 text-slate-700">Clear route</Button>}</div></div>{routeState === "unavailable" && <p role="status" className="mt-2 text-xs text-amber-800">At least two resolved private site labels are needed before a route can be previewed.</p>}{routeState === "error" && <p role="status" className="mt-2 text-xs text-rose-700">The route preview could not be created. Review the site labels and try again; no client data or status was changed.</p>}</>}</section>

    <Dialog open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open) setForm(defaultVisitForm()); }}><DialogContent className="max-w-lg bg-white"><DialogHeader><DialogTitle className="text-[#1A1A1A]">Schedule service visit</DialogTitle></DialogHeader><div className="space-y-4 py-2"><label className="block text-sm font-semibold text-[#1A1A1A]">Job assignment<select value={form.assignmentId} onChange={event => { const assignment = assignments.find(item => String(item.id) === event.target.value); setForm(current => ({ ...current, assignmentId: event.target.value, title: current.title || (assignment ? `${assignment.jobTitle} service visit` : "") })); }} className="mt-1.5 w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal"><option value="">Choose a job owner…</option>{dispatchableAssignments.map(assignment => <option key={assignment.id} value={assignment.id}>{assignment.jobNumber} · {assignment.jobTitle} — {assignment.teamMemberName}</option>)}</select></label>{selectedCapacity && <div className={`rounded-lg border p-3 text-xs ${selectedCapacity.overCapacity ? "border-rose-200 bg-rose-50 text-rose-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}><strong>{selectedCapacity.name}'s planned capacity:</strong> {Math.round(selectedCapacity.plannedMinutes / 6) / 10}h of {Math.round(selectedCapacity.weeklyCapacityMinutes / 6) / 10}h this week. {selectedCapacity.overCapacity ? "This owner is already over planned capacity; use another assignment or confirm the exception intentionally." : `${Math.round(selectedCapacity.remainingMinutes / 6) / 10}h remains in the current weekly plan.`}<span className="mt-1 block text-[11px] opacity-80">This is a private planning signal from owner-defined assignment capacity; it is not GPS, availability, payroll, or a client-visible promise.</span></div>}<Field label="Visit title" value={form.title} onChange={value => setForm(current => ({ ...current, title: value }))} placeholder="e.g. Onsite installation" /><div className="grid gap-3 sm:grid-cols-2"><DateField label="Start" value={form.start} onChange={value => setForm(current => ({ ...current, start: value }))} /><DateField label="End" value={form.end} onChange={value => setForm(current => ({ ...current, end: value }))} /></div><Field label="Site label (optional)" value={form.siteLabel} onChange={value => setForm(current => ({ ...current, siteLabel: value }))} placeholder="e.g. Client office" /><Field label="Internal dispatch note (optional)" value={form.dispatchNote} onChange={value => setForm(current => ({ ...current, dispatchNote: value }))} placeholder="Access, scope, or handoff details" /><label className="flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50 p-3 text-xs text-teal-950"><input type="checkbox" checked={form.clientVisible} onChange={event => setForm(current => ({ ...current, clientVisible: event.target.checked }))} className="mt-0.5 h-4 w-4 accent-[#007A68]" /><span><strong>Share this visit in the client portal.</strong> Only the title, scheduled window, site label, selected status, and client-safe update will be visible. Staff assignment and internal dispatch notes stay private.</span></label>{form.clientVisible && <Field label="Client-safe update (optional)" value={form.clientUpdate} onChange={value => setForm(current => ({ ...current, clientUpdate: value }))} placeholder="e.g. We will arrive during this visit window." />}<label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><input type="checkbox" checked={form.allowConflict} onChange={event => setForm(current => ({ ...current, allowConflict: event.target.checked }))} className="mt-0.5 h-4 w-4 accent-[#D4922A]" /><span><strong>Allow an intentional overlap.</strong> Leave this unchecked for normal scheduling. Check it only when you knowingly schedule a team member in overlapping service windows.</span></label><p className="flex gap-2 rounded-lg bg-[#F7F6F3] p-3 text-xs text-[rgba(26,26,26,0.62)]"><AlertTriangle className="h-4 w-4 flex-shrink-0 text-[#D4922A]" />Client visibility is explicit, never automatic. This board does not use GPS, optimize routes, or expose staff assignment details in the portal.</p></div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={submitVisit} disabled={createVisit.isPending} className="bg-[#D4922A] text-white hover:bg-[#B87716]">{createVisit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Schedule visit"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[rgba(26,26,26,0.48)]">{label}</p><p className="mt-2 text-2xl font-bold text-[#1A1A1A]">{value}</p><p className="mt-1 text-xs text-[rgba(26,26,26,0.56)]">{detail}</p></div>; }
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) { return <label className="block text-sm font-semibold text-[#1A1A1A]">{label}<input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#D4922A]/35" /></label>; }
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm font-semibold text-[#1A1A1A]">{label}<input type="datetime-local" value={value} onChange={event => onChange(event.target.value)} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A]" /></label>; }
