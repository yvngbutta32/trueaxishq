import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MapView } from "@/components/Map";
import { toast } from "sonner";
import { AlertTriangle, ArrowDown, ArrowUp, CalendarOff, CalendarPlus, CarFront, CheckCircle2, Clock3, Loader2, MapPin, Route, X } from "lucide-react";

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
const defaultAvailabilityForm = () => {
  const start = startOfNextHour();
  const end = new Date(start.getTime() + 60 * 60_000);
  return { teamMemberId: "", start: toDateTimeLocal(start), end: toDateTimeLocal(end), reason: "" };
};
const defaultRecurringPlanForm = () => ({
  jobId: "", customerAssetId: "", name: "", serviceName: "", frequency: "monthly" as "weekly" | "monthly",
  weekday: "1", dayOfMonth: "1", startDate: new Date().toISOString().slice(0, 10), endDate: "", startTime: "09:00", durationMinutes: "60", planningNote: "",
});
const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, character => character.toUpperCase());
const hoursFromMinutes = (value: number) => Math.round(value / 6) / 10;
const dateTime = (value: Date | string) => new Date(value).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const localDateKey = (value: Date | string) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const planningDayLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const utcMondayStart = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return start.toISOString();
};

type VisitReassignmentEdit = {
  id: number;
  jobId: number;
  title: string;
  currentTeamMemberId: number | null;
  currentTeamMemberName: string | null;
  scheduledStart: Date;
  scheduledEnd: Date;
  teamMemberId: string;
  allowConflict: boolean;
};

export default function DispatchBoard() {
  const utils = trpc.useUtils();
  const { data: visits = [], isLoading } = trpc.dispatch.listVisits.useQuery();
  const { data: assignments = [] } = trpc.team.listAssignments.useQuery();
  const { data: availabilityBlocks = [], isLoading: availabilityLoading } = trpc.dispatch.listAvailabilityBlocks.useQuery();
  const { data: recurringPlans = [] } = trpc.recurringServicePlans.list.useQuery();
  const { data: planJobs = [] } = trpc.jobs.list.useQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [recurringPlanOpen, setRecurringPlanOpen] = useState(false);
  const [form, setForm] = useState(defaultVisitForm);
  const [reassignmentEdit, setReassignmentEdit] = useState<VisitReassignmentEdit | null>(null);
  const candidateCapacityInput = useMemo(() => {
    const weekStart = utcMondayStart(form.start);
    return weekStart ? { weekStart } : undefined;
  }, [form.start]);
  const { data: capacity = [] } = trpc.team.capacity.useQuery(candidateCapacityInput);
  const reassignmentCapacityInput = useMemo(() => {
    const weekStart = reassignmentEdit ? utcMondayStart(reassignmentEdit.scheduledStart.toISOString()) : undefined;
    return weekStart ? { weekStart } : undefined;
  }, [reassignmentEdit]);
  const { data: reassignmentCapacity = [] } = trpc.team.capacity.useQuery(reassignmentCapacityInput, { enabled: Boolean(reassignmentEdit) });
  const [availabilityForm, setAvailabilityForm] = useState(defaultAvailabilityForm);
  const [recurringPlanForm, setRecurringPlanForm] = useState(defaultRecurringPlanForm);
  const [recurringPlanAssetEdit, setRecurringPlanAssetEdit] = useState({ planId: "", customerAssetId: "" });
  const [recurringPlanDateEdit, setRecurringPlanDateEdit] = useState({ planId: "", nextVisitDate: "" });
  const [availabilityEditForm, setAvailabilityEditForm] = useState<{ id: number; memberName: string; start: string; end: string; reason: string } | null>(null);
  const [mapResult, setMapResult] = useState<{ resolved: number; unresolved: number } | null>(null);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [routeState, setRouteState] = useState<"idle" | "loading" | "ready" | "unavailable" | "error">("idle");
  const [routeSuggestionState, setRouteSuggestionState] = useState<"idle" | "loading" | "suggested" | "unavailable" | "error">("idle");
  const [routeOrder, setRouteOrder] = useState<number[]>([]);
  const [routePlanningDay, setRoutePlanningDay] = useState("");
  const dispatchMapRef = useRef<google.maps.Map | null>(null);
  const routeRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const resolvedStopsRef = useRef(new Map<number, google.maps.LatLng>());

  const dispatchableAssignments = useMemo(() => assignments.filter(assignment => ["assigned", "acknowledged"].includes(assignment.status) && !["completed", "cancelled"].includes(assignment.jobStatus)), [assignments]);
  const activeVisits = useMemo(() => visits.filter(visit => !["completed", "cancelled"].includes(visit.status)), [visits]);
  const mappableVisitsByDay = useMemo(() => activeVisits.filter(visit => Boolean(visit.siteLabel?.trim())).sort((left, right) => new Date(left.scheduledStart).getTime() - new Date(right.scheduledStart).getTime()), [activeVisits]);
  const routePlanningDays = useMemo(() => Array.from(new Set(mappableVisitsByDay.map(visit => localDateKey(visit.scheduledStart)))), [mappableVisitsByDay]);
  useEffect(() => {
    setRoutePlanningDay(current => routePlanningDays.includes(current) ? current : (routePlanningDays[0] ?? ""));
  }, [routePlanningDays]);
  const mappableVisits = useMemo(() => mappableVisitsByDay.filter(visit => localDateKey(visit.scheduledStart) === routePlanningDay).slice(0, 12), [mappableVisitsByDay, routePlanningDay]);
  useEffect(() => {
    const activeStopIds = mappableVisits.map(visit => visit.id);
    setRouteOrder(current => {
      const preserved = current.filter(id => activeStopIds.includes(id));
      const next = [...preserved, ...activeStopIds.filter(id => !preserved.includes(id))];
      return next.length === current.length && next.every((id, index) => id === current[index]) ? current : next;
    });
  }, [mappableVisits]);
  const orderedMappableVisits = useMemo(() => {
    const byId = new Map(mappableVisits.map(visit => [visit.id, visit]));
    const ordered = routeOrder.map(id => byId.get(id)).filter((visit): visit is typeof mappableVisits[number] => Boolean(visit));
    return ordered.length ? ordered : mappableVisits;
  }, [mappableVisits, routeOrder]);
  const selectedAssignment = useMemo(() => assignments.find(assignment => String(assignment.id) === form.assignmentId), [assignments, form.assignmentId]);
  const selectedCapacity = useMemo(() => selectedAssignment ? capacity.find(member => member.id === selectedAssignment.teamMemberId) : undefined, [capacity, selectedAssignment]);
  const reassignmentCandidates = useMemo(() => reassignmentEdit ? assignments.filter(assignment => assignment.jobId === reassignmentEdit.jobId && ["assigned", "acknowledged"].includes(assignment.status) && !["completed", "cancelled"].includes(assignment.jobStatus)) : [], [assignments, reassignmentEdit]);
  const selectedReassignment = useMemo(() => reassignmentCandidates.find(assignment => String(assignment.teamMemberId) === reassignmentEdit?.teamMemberId), [reassignmentCandidates, reassignmentEdit?.teamMemberId]);
  const selectedReassignmentCapacity = useMemo(() => selectedReassignment ? reassignmentCapacity.find(member => member.id === selectedReassignment.teamMemberId) : undefined, [reassignmentCapacity, selectedReassignment]);
  const candidateDurationMinutes = useMemo(() => {
    const start = new Date(form.start).getTime();
    const end = new Date(form.end).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? Math.round((end - start) / 60_000) : 0;
  }, [form.end, form.start]);
  const candidateCapacityWeekLabel = useMemo(() => {
    const weekStart = candidateCapacityInput?.weekStart;
    return weekStart ? new Date(weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "a valid UTC week";
  }, [candidateCapacityInput]);
  const selectedPlanJob = useMemo(() => planJobs.find(job => String(job.id) === recurringPlanForm.jobId), [planJobs, recurringPlanForm.jobId]);
  const selectedPlanForAssetEdit = useMemo(() => recurringPlans.find(plan => String(plan.id) === recurringPlanAssetEdit.planId), [recurringPlans, recurringPlanAssetEdit.planId]);
  const selectedPlanForDateEdit = useMemo(() => recurringPlans.find(plan => String(plan.id) === recurringPlanDateEdit.planId), [recurringPlans, recurringPlanDateEdit.planId]);
  const selectedPlanAssetEditJob = useMemo(() => planJobs.find(job => job.id === selectedPlanForAssetEdit?.jobId), [planJobs, selectedPlanForAssetEdit]);
  const { data: planAssets = [], isFetching: planAssetsLoading } = trpc.customerAssets.list.useQuery(
    { clientId: selectedPlanJob?.clientId ?? 1 },
    { enabled: Boolean(selectedPlanJob) },
  );
  const { data: editablePlanAssets = [], isFetching: editablePlanAssetsLoading } = trpc.customerAssets.list.useQuery(
    { clientId: selectedPlanAssetEditJob?.clientId ?? 1 },
    { enabled: Boolean(selectedPlanAssetEditJob) },
  );
  const groupedVisits = useMemo(() => visits.reduce<Record<string, typeof visits>>((groups, visit) => {
    const key = new Date(visit.scheduledStart).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    (groups[key] ??= []).push(visit);
    return groups;
  }, {}), [visits]);

  const invalidate = () => { void utils.dispatch.listVisits.invalidate(); void utils.dispatch.listAvailabilityBlocks.invalidate(); void utils.jobs.get.invalidate(); void utils.recurringServicePlans.list.invalidate(); void utils.team.capacity.invalidate(); };
  const createVisit = trpc.dispatch.createVisit.useMutation({
    onSuccess: result => { invalidate(); setCreateOpen(false); setForm(defaultVisitForm()); toast.success(result.conflictAcknowledged ? "Visit scheduled with the acknowledged overlap." : "Service visit scheduled."); },
    onError: error => {
      if (error.data?.code === "CONFLICT") toast.error("This time overlaps an active visit. Select the exception acknowledgement only if this is intentional.");
      else toast.error(error.message);
    },
  });
  const updateVisit = trpc.dispatch.updateVisit.useMutation({ onSuccess: invalidate, onError: error => toast.error(error.message) });
  const reassignVisit = trpc.dispatch.updateVisit.useMutation({
    onSuccess: () => { invalidate(); setReassignmentEdit(null); toast.success("Private service visit assignment updated."); },
    onError: error => {
      if (error.data?.code === "CONFLICT") toast.error("The selected member has a conflicting private visit or availability block. Confirm the exception only if it is intentional.");
      else toast.error(error.message);
    },
  });
  const cancelVisit = trpc.dispatch.cancelVisit.useMutation({ onSuccess: () => { invalidate(); toast.success("Service visit cancelled."); }, onError: error => toast.error(error.message) });
  const createAvailabilityBlock = trpc.dispatch.createAvailabilityBlock.useMutation({ onSuccess: () => { invalidate(); setAvailabilityOpen(false); setAvailabilityForm(defaultAvailabilityForm()); toast.success("Private availability block added."); }, onError: error => toast.error(error.message) });
  const updateAvailabilityBlock = trpc.dispatch.updateAvailabilityBlock.useMutation({ onSuccess: () => { invalidate(); setAvailabilityEditForm(null); toast.success("Private availability block updated."); }, onError: error => toast.error(error.message) });
  const deleteAvailabilityBlock = trpc.dispatch.deleteAvailabilityBlock.useMutation({ onSuccess: () => { invalidate(); toast.success("Private availability block removed."); }, onError: error => toast.error(error.message) });
  const generateRecurringVisit = trpc.recurringServicePlans.generateNextVisit.useMutation({ onSuccess: result => { invalidate(); toast.success(result.created ? "Next recurring visit generated for owner dispatch." : "This recurring visit already exists."); }, onError: error => toast.error(error.message) });
  const createRecurringPlan = trpc.recurringServicePlans.create.useMutation({ onSuccess: () => { invalidate(); setRecurringPlanOpen(false); setRecurringPlanForm(defaultRecurringPlanForm()); toast.success("Private recurring service plan created."); }, onError: error => toast.error(error.message) });
  const setRecurringPlanActive = trpc.recurringServicePlans.setActive.useMutation({ onSuccess: result => { invalidate(); toast.success(result.active ? "Private recurring plan resumed." : "Private recurring plan paused."); }, onError: error => toast.error(error.message) });
  const setRecurringPlanCustomerAsset = trpc.recurringServicePlans.setCustomerAsset.useMutation({ onSuccess: () => { invalidate(); setRecurringPlanAssetEdit({ planId: "", customerAssetId: "" }); toast.success("Private recurring plan asset context updated."); }, onError: error => toast.error(error.message) });
  const setRecurringPlanNextVisit = trpc.recurringServicePlans.setNextVisitDate.useMutation({ onSuccess: () => { invalidate(); setRecurringPlanDateEdit({ planId: "", nextVisitDate: "" }); toast.success("Private next visit date updated."); }, onError: error => toast.error(error.message) });

  const previewRoute = () => {
    const map = dispatchMapRef.current;
    const stops = orderedMappableVisits.map(visit => resolvedStopsRef.current.get(visit.id)).filter((stop): stop is google.maps.LatLng => Boolean(stop));
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

  const suggestRouteOrder = () => {
    const map = dispatchMapRef.current;
    const resolvedVisits = orderedMappableVisits.filter(visit => resolvedStopsRef.current.has(visit.id));
    if (!map || !window.google?.maps || resolvedVisits.length < 3 || resolvedVisits.length !== orderedMappableVisits.length) {
      setRouteSuggestionState("unavailable");
      return;
    }
    setRouteSuggestionState("loading");
    new window.google.maps.DirectionsService().route({
      origin: resolvedStopsRef.current.get(resolvedVisits[0].id)!,
      destination: resolvedStopsRef.current.get(resolvedVisits[resolvedVisits.length - 1].id)!,
      waypoints: resolvedVisits.slice(1, -1).map(visit => ({ location: resolvedStopsRef.current.get(visit.id)!, stopover: true })),
      optimizeWaypoints: true,
      travelMode: window.google.maps.TravelMode.DRIVING,
    }, (result, status) => {
      const waypointOrder = result?.routes[0]?.waypoint_order ?? [];
      const intermediateVisits = resolvedVisits.slice(1, -1);
      const validOrder = waypointOrder.length === intermediateVisits.length && new Set(waypointOrder).size === waypointOrder.length && waypointOrder.every(index => Number.isInteger(index) && index >= 0 && index < intermediateVisits.length);
      if (status !== "OK" || !validOrder) { setRouteSuggestionState("error"); return; }
      setRouteOrder([resolvedVisits[0].id, ...waypointOrder.map(index => intermediateVisits[index].id), resolvedVisits[resolvedVisits.length - 1].id]);
      clearRoute();
      setRouteSuggestionState("suggested");
      toast.success("Private map suggestion applied. Review the stop order before use.");
    });
  };

  const moveRouteStop = (id: number, direction: -1 | 1) => {
    setRouteOrder(current => {
      const index = current.indexOf(id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
    clearRoute();
    setRouteSuggestionState("idle");
  };

  const resetRouteOrder = () => {
    setRouteOrder(mappableVisits.map(visit => visit.id));
    clearRoute();
    setRouteSuggestionState("idle");
    toast.success("Private stop order restored to the scheduled sequence.");
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

  const submitReassignment = () => {
    if (!reassignmentEdit || !selectedReassignment) return toast.error("Choose an active job assignment.");
    if (selectedReassignment.teamMemberId === reassignmentEdit.currentTeamMemberId) return toast.error("Choose a different assigned team member.");
    reassignVisit.mutate({ id: reassignmentEdit.id, teamMemberId: selectedReassignment.teamMemberId, allowConflict: reassignmentEdit.allowConflict });
  };

  const submitAvailabilityBlock = () => {
    const teamMemberId = Number(availabilityForm.teamMemberId);
    const startsAt = new Date(availabilityForm.start);
    const endsAt = new Date(availabilityForm.end);
    if (!teamMemberId) return toast.error("Choose a team member.");
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) return toast.error("Choose a valid private availability window.");
    createAvailabilityBlock.mutate({ teamMemberId, startsAt, endsAt, reason: availabilityForm.reason.trim() || undefined });
  };

  const submitAvailabilityEdit = () => {
    if (!availabilityEditForm) return;
    const startsAt = new Date(availabilityEditForm.start);
    const endsAt = new Date(availabilityEditForm.end);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) return toast.error("Choose a valid private availability window.");
    updateAvailabilityBlock.mutate({ id: availabilityEditForm.id, startsAt, endsAt, reason: availabilityEditForm.reason.trim() || undefined });
  };

  const submitRecurringPlan = () => {
    const durationMinutes = Number(recurringPlanForm.durationMinutes);
    const weekday = Number(recurringPlanForm.weekday);
    const dayOfMonth = Number(recurringPlanForm.dayOfMonth);
    if (!selectedPlanJob) return toast.error("Choose an owned job for this private plan.");
    if (!recurringPlanForm.name.trim() || !recurringPlanForm.serviceName.trim()) return toast.error("Add a plan name and service name.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(recurringPlanForm.startDate)) return toast.error("Choose a valid start date.");
    if (recurringPlanForm.endDate && recurringPlanForm.endDate < recurringPlanForm.startDate) return toast.error("The end date must be after the start date.");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(recurringPlanForm.startTime)) return toast.error("Choose a valid UTC start time.");
    if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) return toast.error("Duration must be between 15 and 480 minutes.");
    if (recurringPlanForm.frequency === "weekly" && (!Number.isInteger(weekday) || weekday < 0 || weekday > 6)) return toast.error("Choose a weekday for a weekly plan.");
    if (recurringPlanForm.frequency === "monthly" && (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28)) return toast.error("Choose a day of the month between 1 and 28.");
    createRecurringPlan.mutate({
      jobId: selectedPlanJob.id,
      customerAssetId: recurringPlanForm.customerAssetId ? Number(recurringPlanForm.customerAssetId) : undefined,
      name: recurringPlanForm.name.trim(), serviceName: recurringPlanForm.serviceName.trim(), frequency: recurringPlanForm.frequency,
      weekday: recurringPlanForm.frequency === "weekly" ? weekday : null,
      dayOfMonth: recurringPlanForm.frequency === "monthly" ? dayOfMonth : null,
      startDate: recurringPlanForm.startDate, endDate: recurringPlanForm.endDate || null, startTime: recurringPlanForm.startTime, durationMinutes,
      planningNote: recurringPlanForm.planningNote.trim() || undefined,
    });
  };

  if (isLoading) return <div className="h-[480px] rounded-2xl bg-slate-100 animate-pulse" />;

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4922A]">Operations</p><h1 className="mt-1 text-2xl font-bold text-[#1A1A1A]">Dispatch Board</h1><p className="mt-1 max-w-2xl text-sm text-[rgba(26,26,26,0.62)]">Turn job ownership into clear service visits, controlled handoffs, and client-ready progress without hidden schedule conflicts.</p></div><Button onClick={() => setCreateOpen(true)} disabled={!dispatchableAssignments.length} className="bg-[#D4922A] text-white hover:bg-[#B87716]"><CalendarPlus className="mr-2 h-4 w-4" /> Schedule visit</Button></header>

    <section className="grid gap-3 sm:grid-cols-3"><Metric label="Active visits" value={String(activeVisits.length)} detail="Scheduled, en route, or in progress" /><Metric label="Ready assignments" value={String(dispatchableAssignments.length)} detail="Job owners available for scheduling" /><Metric label="Operating boundary" value="Manual" detail="No GPS, routing, or automated ETA claims" /></section>

    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><CalendarOff className="h-5 w-5 text-indigo-700" /><h2 className="font-bold text-indigo-950">Private staff availability</h2></div><p className="mt-1 max-w-2xl text-xs leading-relaxed text-indigo-900/75">Owner-managed scheduling blocks help identify service-visit overlaps. They are private planning aids, not attendance, payroll, GPS, route, client-portal, or automatic reassignment data.</p></div><Button type="button" size="sm" onClick={() => setAvailabilityOpen(true)} className="bg-indigo-700 text-white hover:bg-indigo-800"><CalendarOff className="mr-1.5 h-4 w-4" /> Add private block</Button></div>{availabilityLoading ? <div className="mt-4 flex items-center gap-2 text-sm text-indigo-900/70"><Loader2 className="h-4 w-4 animate-spin" /> Loading private availability…</div> : availabilityBlocks.length ? <div className="mt-4 space-y-2">{availabilityBlocks.slice(0, 12).map(block => <article key={block.id} className="flex flex-col gap-3 rounded-xl border border-indigo-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-sm font-semibold text-[#1A1A1A]"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: block.teamMemberColor ?? "#4F46E5" }} />{block.teamMemberName}</p><p className="mt-1 text-xs text-[rgba(26,26,26,0.62)]">{dateTime(block.startsAt)} – {new Date(block.endsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}{block.reason ? ` · ${block.reason}` : ""}</p></div><div className="flex shrink-0 gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setAvailabilityEditForm({ id: block.id, memberName: block.teamMemberName, start: toDateTimeLocal(new Date(block.startsAt)), end: toDateTimeLocal(new Date(block.endsAt)), reason: block.reason ?? "" })} disabled={updateAvailabilityBlock.isPending} className="border-indigo-200 bg-white text-indigo-800 hover:bg-indigo-50">Edit</Button><Button type="button" size="sm" variant="outline" onClick={() => deleteAvailabilityBlock.mutate({ id: block.id })} disabled={deleteAvailabilityBlock.isPending} className="border-indigo-200 bg-white text-indigo-800 hover:bg-indigo-50">Remove</Button></div></article>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-indigo-200 bg-white/70 px-4 py-3 text-sm text-indigo-950/75">No private availability blocks recorded. Add an exception when a team member cannot take a scheduled visit.</p>}</section>

    <section className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-bold text-[#1A1A1A]">Recurring service plans</h2><p className="mt-1 max-w-2xl text-xs text-[rgba(26,26,26,0.6)]">Owner-only planning. Generate the next internal visit when ready, then use dispatch to select a team member. Plans do not bill, notify clients, or assume staff availability.</p></div><div className="flex shrink-0 items-center gap-2"><span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700">Private planning</span><Button type="button" size="sm" onClick={() => setRecurringPlanOpen(true)} disabled={!planJobs.length} className="bg-indigo-700 text-white hover:bg-indigo-800"><CalendarPlus className="mr-1.5 h-4 w-4" /> Add plan</Button></div></div>{recurringPlans.length === 0 ? <p className="mt-4 rounded-xl bg-[#F7F6F3] p-4 text-xs text-[rgba(26,26,26,0.6)]">No recurring plans yet. Add a private plan for an owned job; generated visits remain unassigned until you dispatch them.</p> : <div className="mt-4 space-y-2">{recurringPlans.map(plan => <article key={plan.id} className="flex flex-col gap-3 rounded-xl border border-[rgba(26,26,26,0.1)] p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-[#1A1A1A]">{plan.name}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${plan.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{plan.active ? "Active" : "Paused"}</span></div><p className="mt-1 text-xs text-[rgba(26,26,26,0.6)]">{plan.jobNumber} · {plan.serviceName} · {label(plan.frequency)} · {plan.startTime} UTC · Next: {plan.nextVisitAt ? dateTime(plan.nextVisitAt) : "No further visit"}</p>{plan.customerAssetName && <p className="mt-1 text-xs font-medium text-indigo-800">Private asset context: {plan.customerAssetName}{plan.customerAssetTag ? ` · ${plan.customerAssetTag}` : ""}</p>}{plan.customerAssetId && plan.customerAssetActive === false && <p className="mt-1 text-xs font-medium text-amber-800">Linked asset is inactive. Reactivate it before generating a future visit.</p>}{!plan.active && <p className="mt-1 text-xs text-slate-600">Paused plans retain history and do not generate a new visit.</p>}</div><div className="flex shrink-0 flex-wrap gap-2"><Button size="sm" variant="outline" disabled={!plan.active || !plan.nextVisitAt || plan.customerAssetActive === false || generateRecurringVisit.isPending} onClick={() => generateRecurringVisit.mutate({ id: plan.id })}>Generate unassigned visit</Button><Button type="button" size="sm" variant="outline" disabled={setRecurringPlanActive.isPending} onClick={() => setRecurringPlanActive.mutate({ id: plan.id, active: !plan.active })} className="border-indigo-200 text-indigo-800 hover:bg-indigo-50">{plan.active ? "Pause plan" : "Resume plan"}</Button></div></article>)}</div>}</section>

    <section className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-[#1A1A1A]">Service timeline</h2><p className="mt-1 text-xs text-[rgba(26,26,26,0.56)]">“En route” is a deliberate internal status. Owners can explicitly share a curated visit window and update; the board never exposes staffing, live location, routing, or ETA data.</p></div><Route className="h-5 w-5 text-[#D4922A]" /></div>{visits.length === 0 ? <div className="mt-5 rounded-xl bg-[#F7F6F3] px-5 py-10 text-center"><CarFront className="mx-auto h-8 w-8 text-[#D4922A]" /><h3 className="mt-3 text-sm font-bold text-[#1A1A1A]">No service visits scheduled</h3><p className="mx-auto mt-1 max-w-md text-xs text-[rgba(26,26,26,0.56)]">Create a job assignment first, then schedule a service visit for the person responsible for the work.</p>{dispatchableAssignments.length > 0 && <Button size="sm" onClick={() => setCreateOpen(true)} className="mt-4 bg-[#1C2333] text-white hover:bg-[#2B3446]"><CalendarPlus className="mr-1 h-4 w-4" /> Schedule first visit</Button>}</div> : <div className="mt-5 space-y-6">{Object.entries(groupedVisits).map(([day, dayVisits]) => <div key={day}><h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[rgba(26,26,26,0.48)]">{day}</h3><div className="space-y-2">{dayVisits.map(visit => <article key={visit.id} className="rounded-xl border border-[rgba(26,26,26,0.1)] p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="truncate text-sm font-bold text-[#1A1A1A]">{visit.title}</h4><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${visit.status === "completed" ? "bg-emerald-50 text-emerald-700" : visit.status === "cancelled" ? "bg-slate-100 text-slate-600" : visit.status === "in_progress" ? "bg-indigo-50 text-indigo-700" : visit.status === "en_route" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>{label(visit.status)}</span>{visit.availabilityConflict && <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700"><AlertTriangle className="h-3 w-3" />Private availability overlap</span>}{visit.clientVisible && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700">Client visible</span>}</div><p className="mt-1 text-xs text-[rgba(26,26,26,0.6)]">{visit.jobNumber} · {visit.jobTitle} · {visit.clientName}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[rgba(26,26,26,0.56)]"><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{dateTime(visit.scheduledStart)} – {new Date(visit.scheduledEnd).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>{visit.teamMemberName && <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: visit.teamMemberColor ?? "#D4922A" }} />{visit.teamMemberName}</span>}{visit.siteLabel && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{visit.siteLabel}</span>}</div>{visit.availabilityConflict && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">Private availability overlap. This has no client-facing effect; revise the plan or explicitly acknowledge the scheduling exception.</p>}{visit.clientVisible && visit.clientUpdate && <p className="mt-2 rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-900">Client update: {visit.clientUpdate}</p>}{visit.dispatchNote && <p className="mt-2 rounded-lg bg-[#F7F6F3] px-3 py-2 text-xs text-[rgba(26,26,26,0.62)]">Internal note: {visit.dispatchNote}</p>}</div><div className="flex shrink-0 flex-wrap items-center gap-2"><button type="button" onClick={() => updateVisit.mutate({ id: visit.id, clientVisible: !visit.clientVisible })} className="rounded-lg border border-teal-200 px-2 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50" aria-label={`${visit.clientVisible ? "Hide" : "Share"} ${visit.title} in the client portal`}>{visit.clientVisible ? "Hide from client" : "Share with client"}</button><select aria-label={`Set status for ${visit.title}`} value={visit.status} onChange={event => updateVisit.mutate({ id: visit.id, status: event.target.value as typeof VISIT_STATUSES[number] })} className="rounded-lg border border-[rgba(26,26,26,0.14)] bg-white px-2 py-2 text-xs font-semibold text-[#1A1A1A]">{VISIT_STATUSES.map(status => <option key={status} value={status}>{label(status)}</option>)}</select>{visit.status !== "cancelled" && <button type="button" onClick={() => cancelVisit.mutate({ id: visit.id })} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50" aria-label={`Cancel ${visit.title}`}><X className="h-4 w-4" /></button>}</div></div></article>)}</div></div>)}</div>}</section>

    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-indigo-950">Correct recurring plan asset context</h2><p className="mt-1 max-w-2xl text-xs leading-relaxed text-indigo-900/75">Replace or remove a plan’s private asset context without changing its job, schedule, or generated-visit history. Only active assets for the plan job’s client can be selected.</p></div><Button type="button" size="sm" variant="outline" onClick={() => setRecurringPlanAssetEdit({ planId: recurringPlans[0] ? String(recurringPlans[0].id) : "", customerAssetId: recurringPlans[0]?.customerAssetId ? String(recurringPlans[0].customerAssetId) : "" })} disabled={!recurringPlans.length} className="border-indigo-200 bg-white text-indigo-800 hover:bg-indigo-50">Correct plan asset</Button></div></section>

    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-indigo-950">Correct next private visit date</h2><p className="mt-1 max-w-2xl text-xs leading-relaxed text-indigo-900/75">Choose a future date that already matches the plan’s weekly or monthly schedule. The stored UTC time, plan job, asset context, and generated visits remain unchanged.</p></div><Button type="button" size="sm" variant="outline" onClick={() => { const plan = recurringPlans[0]; setRecurringPlanDateEdit(plan ? { planId: String(plan.id), nextVisitDate: plan.nextVisitAt ? new Date(plan.nextVisitAt).toISOString().slice(0, 10) : "" } : { planId: "", nextVisitDate: "" }); }} disabled={!recurringPlans.length} className="border-indigo-200 bg-white text-indigo-800 hover:bg-indigo-50">Correct next date</Button></div></section>

    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5"><div><h2 className="font-bold text-indigo-950">Correct visit assignment</h2><p className="mt-1 max-w-2xl text-xs leading-relaxed text-indigo-900/75">Move an active private service visit to another active member already assigned to the same job. This correction does not notify, dispatch, reschedule, or change client-facing fields automatically.</p></div>{activeVisits.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-indigo-200 bg-white/70 px-4 py-3 text-sm text-indigo-950/75">There are no active service visits available for reassignment.</p> : <div className="mt-4 space-y-3"><label className="block max-w-xl text-sm font-semibold text-[#1A1A1A]">Service visit to correct<select value={reassignmentEdit?.id ?? ""} onChange={event => { const visit = activeVisits.find(item => item.id === Number(event.target.value)); setReassignmentEdit(visit ? { id: visit.id, jobId: visit.jobId, title: visit.title, currentTeamMemberId: visit.teamMemberId, currentTeamMemberName: visit.teamMemberName, scheduledStart: new Date(visit.scheduledStart), scheduledEnd: new Date(visit.scheduledEnd), teamMemberId: "", allowConflict: false } : null); }} className="mt-1.5 block w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-indigo-300"><option value="">Choose an active private visit…</option>{activeVisits.map(visit => <option key={visit.id} value={visit.id}>{visit.title} · {dateTime(visit.scheduledStart)} · {visit.teamMemberName ?? "Unassigned"}</option>)}</select></label>{reassignmentEdit && <div className="max-w-xl space-y-3 rounded-xl border border-indigo-200 bg-white p-4"><p className="text-xs text-[rgba(26,26,26,0.68)]"><span className="font-semibold text-[#1A1A1A]">Current assignment:</span> {reassignmentEdit.currentTeamMemberName ?? "Unassigned"} · {dateTime(reassignmentEdit.scheduledStart)} – {new Date(reassignmentEdit.scheduledEnd).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p><label className="block text-sm font-semibold text-[#1A1A1A]">Replacement job assignment<select value={reassignmentEdit.teamMemberId} onChange={event => setReassignmentEdit(current => current ? { ...current, teamMemberId: event.target.value, allowConflict: false } : current)} className="mt-1.5 block w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-indigo-300"><option value="">Choose an active assigned member…</option>{reassignmentCandidates.filter(assignment => assignment.teamMemberId !== reassignmentEdit.currentTeamMemberId).map(assignment => <option key={assignment.id} value={assignment.teamMemberId}>{assignment.teamMemberName} · {assignment.assignmentRole}</option>)}</select></label>{selectedReassignmentCapacity && <p className={`rounded-lg border p-3 text-xs leading-relaxed ${selectedReassignmentCapacity.overCapacity || selectedReassignmentCapacity.scheduledOverCapacity ? "border-rose-200 bg-rose-50 text-rose-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}><span className="font-semibold">Private candidate-week context:</span> {hoursFromMinutes(selectedReassignmentCapacity.scheduledMinutes)}h already scheduled; this visit adds {hoursFromMinutes(Math.round((reassignmentEdit.scheduledEnd.getTime() - reassignmentEdit.scheduledStart.getTime()) / 60_000))}h if saved. {selectedReassignmentCapacity.overCapacity || selectedReassignmentCapacity.scheduledOverCapacity ? "Review the load and confirm any intentional overlap." : "This is planning context only."}</p>}<label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><input type="checkbox" checked={reassignmentEdit.allowConflict} onChange={event => setReassignmentEdit(current => current ? { ...current, allowConflict: event.target.checked } : current)} className="mt-0.5 h-4 w-4 accent-[#D4922A]" /><span><strong>Allow an intentional overlap.</strong> Keep this unchecked unless you knowingly accept a conflicting private visit or availability block for the replacement member.</span></label><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => setReassignmentEdit(null)}>Cancel correction</Button><Button type="button" onClick={submitReassignment} disabled={!selectedReassignment || reassignVisit.isPending} className="bg-indigo-700 text-white hover:bg-indigo-800">{reassignVisit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save private reassignment"}</Button></div></div>}</div>}</section>

    <section className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold text-[#1A1A1A]">Private site preview</h2>
          <p className="mt-1 max-w-2xl text-xs text-[rgba(26,26,26,0.6)]">Arrange up to 12 active site labels for this browser session, then preview that deliberate stop sequence. Locations are never added to the client portal. This is not optimized routing, live traffic, staff tracking, or a client-facing ETA.</p>
        </div>
        <MapPin className="h-5 w-5 text-[#D4922A]" />
      </div>
      {mappableVisits.length === 0 ? <p className="mt-4 rounded-xl bg-[#F7F6F3] p-4 text-sm text-[rgba(26,26,26,0.62)]">Add a site label to an active service visit to preview its location privately.</p> : <>
        <label className="mt-4 block max-w-xs text-sm font-semibold text-[#1A1A1A]">Planning day
          <select value={routePlanningDay} onChange={event => { setRoutePlanningDay(event.target.value); clearRoute(); }} className="mt-1.5 block w-full rounded-lg border border-[#D4922A]/35 bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#D4922A]/35" aria-label="Select private route planning day">
            {routePlanningDays.map(day => <option key={day} value={day}>{planningDayLabel(day)}</option>)}
          </select>
          <span className="mt-1 block text-xs font-normal text-[rgba(26,26,26,0.62)]">The selected day, stop order, and site labels stay in this browser session.</span>
        </label>
        <div className="mt-4 rounded-xl border border-[#D4922A]/25 bg-[#FFF9EE] p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-bold text-[#1A1A1A]">Private stop order</h3><p className="mt-0.5 text-xs text-[rgba(26,26,26,0.62)]">Use the arrow controls to arrange this browser-only sequence. It does not change visit timing, assignments, client updates, or stored records.</p></div><span className="self-start rounded-full bg-white px-2 py-1 text-[10px] font-bold text-[#8A5A0B]">Session only</span></div>
          <ol className="mt-3 space-y-2" aria-label="Private route stop order">
            {orderedMappableVisits.map((visit, index) => <li key={visit.id} className="flex items-center gap-3 rounded-lg border border-[#D4922A]/20 bg-white px-3 py-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#D4922A] text-xs font-bold text-white">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#1A1A1A]">{visit.title}</p><p className="truncate text-xs text-[rgba(26,26,26,0.58)]">{visit.siteLabel}</p></div><div className="flex shrink-0 gap-1"><Button type="button" size="icon" variant="outline" onClick={() => moveRouteStop(visit.id, -1)} disabled={index === 0} aria-label={`Move ${visit.title} earlier in the private stop order`} className="h-8 w-8 border-[#D4922A]/30 text-[#8A5A0B]"><ArrowUp className="h-3.5 w-3.5" /></Button><Button type="button" size="icon" variant="outline" onClick={() => moveRouteStop(visit.id, 1)} disabled={index === orderedMappableVisits.length - 1} aria-label={`Move ${visit.title} later in the private stop order`} className="h-8 w-8 border-[#D4922A]/30 text-[#8A5A0B]"><ArrowDown className="h-3.5 w-3.5" /></Button></div></li>)}
          </ol>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-[rgba(26,26,26,0.1)]"><MapView initialZoom={10} className="h-[320px]" onMapLoadError={() => { setMapUnavailable(true); setMapResult(null); clearRoute(); }} onMapReady={map => { if (!window.google?.maps) return; setMapUnavailable(false); dispatchMapRef.current = map; resolvedStopsRef.current = new Map(); setMapResult(null); setRouteState("idle"); const geocoder = new window.google.maps.Geocoder(); const bounds = new window.google.maps.LatLngBounds(); let resolved = 0; let unresolved = 0; orderedMappableVisits.forEach(visit => { const siteLabel = visit.siteLabel?.trim(); if (!siteLabel) return; geocoder.geocode({ address: siteLabel }, (results, status) => { if (status === "OK" && results?.[0]) { const position = results[0].geometry.location; resolvedStopsRef.current.set(visit.id, position); new window.google!.maps.marker.AdvancedMarkerElement({ map, position, title: visit.title }); bounds.extend(position); resolved += 1; if (resolved === 1) map.setCenter(position); else map.fitBounds(bounds, 48); } else unresolved += 1; if (resolved + unresolved === orderedMappableVisits.length) setMapResult({ resolved, unresolved }); }); }); }} /></div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p role="status" className="text-xs text-[rgba(26,26,26,0.62)]">{mapUnavailable ? "Map provider unavailable. Dispatch scheduling and private visit data remain unchanged." : mapResult ? mapResult.resolved ? `${mapResult.resolved} private site ${mapResult.resolved === 1 ? "location was" : "locations were"} resolved.${mapResult.unresolved ? ` ${mapResult.unresolved} label${mapResult.unresolved === 1 ? " could" : "s could"} not be resolved.` : ""}` : "No site labels could be resolved for a route preview." : "Resolving private site labels…"}</p><div className="flex shrink-0 flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={resetRouteOrder} className="border-slate-300 text-slate-700">Use scheduled order</Button><Button type="button" size="sm" variant="outline" onClick={suggestRouteOrder} disabled={mapUnavailable || !mapResult || mapResult.resolved < 3 || mapResult.unresolved > 0 || routeSuggestionState === "loading"} className="border-teal-300 text-teal-800 hover:bg-teal-50">{routeSuggestionState === "loading" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Route className="mr-1 h-3.5 w-3.5" />} Suggest private order</Button><Button type="button" size="sm" variant="outline" onClick={previewRoute} disabled={mapUnavailable || !mapResult || mapResult.resolved < 2 || routeState === "loading"} className="border-[#D4922A]/40 text-[#8A5A0B]">{routeState === "loading" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Route className="mr-1 h-3.5 w-3.5" />} Preview stop order</Button>{routeState === "ready" && <Button type="button" size="sm" variant="outline" onClick={clearRoute} className="border-slate-300 text-slate-700">Clear route</Button>}</div></div>
        {routeSuggestionState === "suggested" && <p role="status" className="mt-2 rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-950">A private map order suggestion was applied to this session. Review or adjust the arrows before using it; it does not dispatch work or change any stored visit.</p>}{routeSuggestionState === "unavailable" && <p role="status" className="mt-2 text-xs text-amber-800">Resolve every displayed private site label and keep at least three stops before requesting an order suggestion.</p>}{routeSuggestionState === "error" && <p role="status" className="mt-2 text-xs text-rose-700">A private map order suggestion could not be created. Your current manual order is unchanged; review the site labels and try again.</p>}
        {routeState === "unavailable" && <p role="status" className="mt-2 text-xs text-amber-800">At least two resolved private site labels are needed before a route can be previewed.</p>}{routeState === "error" && <p role="status" className="mt-2 text-xs text-rose-700">The route preview could not be created. Review the site labels and try again; no client data or status was changed.</p>}
      </>}</section>

    <Dialog open={availabilityOpen} onOpenChange={open => { setAvailabilityOpen(open); if (!open) setAvailabilityForm(defaultAvailabilityForm()); }}><DialogContent className="max-w-lg bg-white"><DialogHeader><DialogTitle className="text-[#1A1A1A]">Add private availability block</DialogTitle></DialogHeader><div className="space-y-4 py-2"><p className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs leading-relaxed text-indigo-950">This owner-only scheduling exception can flag an overlapping service visit. It does not change attendance, payroll, routes, client updates, or staff availability outside this workspace.</p><label className="block text-sm font-semibold text-[#1A1A1A]">Team member<select value={availabilityForm.teamMemberId} onChange={event => setAvailabilityForm(current => ({ ...current, teamMemberId: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal"><option value="">Choose an active team member…</option>{capacity.filter(member => member.active).map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><div className="grid gap-3 sm:grid-cols-2"><DateField label="Start" value={availabilityForm.start} onChange={value => setAvailabilityForm(current => ({ ...current, start: value }))} /><DateField label="End" value={availabilityForm.end} onChange={value => setAvailabilityForm(current => ({ ...current, end: value }))} /></div><label className="block text-sm font-semibold text-[#1A1A1A]">Private reason <span className="font-normal text-[rgba(26,26,26,0.6)]">(optional)</span><textarea value={availabilityForm.reason} onChange={event => setAvailabilityForm(current => ({ ...current, reason: event.target.value }))} maxLength={500} rows={3} placeholder="e.g. Time off or training" className="mt-1.5 block w-full resize-y rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-indigo-300" /></label></div><DialogFooter><Button type="button" variant="outline" onClick={() => setAvailabilityOpen(false)}>Cancel</Button><Button type="button" onClick={submitAvailabilityBlock} disabled={createAvailabilityBlock.isPending} className="bg-indigo-700 text-white hover:bg-indigo-800">{createAvailabilityBlock.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save private block"}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={Boolean(availabilityEditForm)} onOpenChange={open => { if (!open) setAvailabilityEditForm(null); }}><DialogContent className="max-w-lg bg-white"><DialogHeader><DialogTitle className="text-[#1A1A1A]">Edit private availability block</DialogTitle></DialogHeader>{availabilityEditForm && <div className="space-y-4 py-2"><p className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs leading-relaxed text-indigo-950">Correct the private timing or reason for {availabilityEditForm.memberName}. The team member remains unchanged, and overlapping service visits recalculate from the corrected window.</p><div className="grid gap-3 sm:grid-cols-2"><DateField label="Start" value={availabilityEditForm.start} onChange={value => setAvailabilityEditForm(current => current ? { ...current, start: value } : current)} /><DateField label="End" value={availabilityEditForm.end} onChange={value => setAvailabilityEditForm(current => current ? { ...current, end: value } : current)} /></div><label className="block text-sm font-semibold text-[#1A1A1A]">Private reason <span className="font-normal text-[rgba(26,26,26,0.6)]">(optional)</span><textarea value={availabilityEditForm.reason} onChange={event => setAvailabilityEditForm(current => current ? { ...current, reason: event.target.value } : current)} maxLength={500} rows={3} className="mt-1.5 block w-full resize-y rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-indigo-300" /></label></div>}<DialogFooter><Button type="button" variant="outline" onClick={() => setAvailabilityEditForm(null)}>Cancel</Button><Button type="button" onClick={submitAvailabilityEdit} disabled={updateAvailabilityBlock.isPending} className="bg-indigo-700 text-white hover:bg-indigo-800">{updateAvailabilityBlock.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save correction"}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={recurringPlanOpen} onOpenChange={open => { setRecurringPlanOpen(open); if (!open) setRecurringPlanForm(defaultRecurringPlanForm()); }}><DialogContent className="max-w-lg bg-white"><DialogHeader><DialogTitle className="text-[#1A1A1A]">Add private recurring service plan</DialogTitle></DialogHeader><div className="space-y-4 py-2"><p className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs leading-relaxed text-indigo-950">This owner-only plan can generate an internal service visit when you choose. Asset context is private; this is not automated maintenance, booking, billing, notifications, or client sharing.</p><label className="block text-sm font-semibold text-[#1A1A1A]">Owned job<select value={recurringPlanForm.jobId} onChange={event => setRecurringPlanForm(current => ({ ...current, jobId: event.target.value, customerAssetId: "" }))} className="mt-1.5 w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal"><option value="">Choose a job…</option>{planJobs.filter(job => !["completed", "cancelled"].includes(job.status)).map(job => <option key={job.id} value={job.id}>{job.jobNumber} · {job.title} — {job.clientName}</option>)}</select></label><label className="block text-sm font-semibold text-[#1A1A1A]">Private customer asset <span className="font-normal text-[rgba(26,26,26,0.6)]">(optional)</span><select value={recurringPlanForm.customerAssetId} disabled={!selectedPlanJob || planAssetsLoading} onChange={event => setRecurringPlanForm(current => ({ ...current, customerAssetId: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal disabled:bg-slate-50"><option value="">{!selectedPlanJob ? "Choose a job first…" : planAssetsLoading ? "Loading private assets…" : "No asset selected"}</option>{planAssets.filter(asset => asset.active).map(asset => <option key={asset.id} value={asset.id}>{asset.name}{asset.assetTag ? ` · ${asset.assetTag}` : ""}</option>)}</select><span className="mt-1 block text-xs font-normal text-[rgba(26,26,26,0.6)]">Only active assets belonging to this job’s client are available.</span></label><div className="grid gap-3 sm:grid-cols-2"><Field label="Plan name" value={recurringPlanForm.name} onChange={value => setRecurringPlanForm(current => ({ ...current, name: value }))} placeholder="e.g. Monthly inspection" /><Field label="Service name" value={recurringPlanForm.serviceName} onChange={value => setRecurringPlanForm(current => ({ ...current, serviceName: value }))} placeholder="e.g. Equipment check" /></div><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold text-[#1A1A1A]">Frequency<select value={recurringPlanForm.frequency} onChange={event => setRecurringPlanForm(current => ({ ...current, frequency: event.target.value as "weekly" | "monthly" }))} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal"><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>{recurringPlanForm.frequency === "weekly" ? <label className="block text-sm font-semibold text-[#1A1A1A]">Weekday<select value={recurringPlanForm.weekday} onChange={event => setRecurringPlanForm(current => ({ ...current, weekday: event.target.value }))} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal">{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label> : <label className="block text-sm font-semibold text-[#1A1A1A]">Day of month<input type="number" min="1" max="28" value={recurringPlanForm.dayOfMonth} onChange={event => setRecurringPlanForm(current => ({ ...current, dayOfMonth: event.target.value }))} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal" /></label>}</div><div className="grid gap-3 sm:grid-cols-3"><label className="block text-sm font-semibold text-[#1A1A1A]">Start date<input type="date" value={recurringPlanForm.startDate} onChange={event => setRecurringPlanForm(current => ({ ...current, startDate: event.target.value }))} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal" /></label><label className="block text-sm font-semibold text-[#1A1A1A]">Start time (UTC)<input type="time" value={recurringPlanForm.startTime} onChange={event => setRecurringPlanForm(current => ({ ...current, startTime: event.target.value }))} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal" /></label><label className="block text-sm font-semibold text-[#1A1A1A]">End date <span className="font-normal text-[rgba(26,26,26,0.6)]">(optional)</span><input type="date" value={recurringPlanForm.endDate} onChange={event => setRecurringPlanForm(current => ({ ...current, endDate: event.target.value }))} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal" /></label></div><p className="text-xs text-[rgba(26,26,26,0.6)]">Times are saved in UTC and shown in your local time in the resulting service-visit timeline.</p><label className="block text-sm font-semibold text-[#1A1A1A]">Visit duration (minutes)<input type="number" min="15" max="480" step="15" value={recurringPlanForm.durationMinutes} onChange={event => setRecurringPlanForm(current => ({ ...current, durationMinutes: event.target.value }))} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal" /></label><label className="block text-sm font-semibold text-[#1A1A1A]">Private planning note <span className="font-normal text-[rgba(26,26,26,0.6)]">(optional)</span><textarea value={recurringPlanForm.planningNote} onChange={event => setRecurringPlanForm(current => ({ ...current, planningNote: event.target.value }))} maxLength={1000} rows={3} placeholder="Internal preparation details" className="mt-1.5 block w-full resize-y rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal" /></label></div><DialogFooter><Button type="button" variant="outline" onClick={() => setRecurringPlanOpen(false)}>Cancel</Button><Button type="button" onClick={submitRecurringPlan} disabled={createRecurringPlan.isPending || !planJobs.length} className="bg-indigo-700 text-white hover:bg-indigo-800">{createRecurringPlan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save private plan"}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={Boolean(recurringPlanAssetEdit.planId)} onOpenChange={open => { if (!open) setRecurringPlanAssetEdit({ planId: "", customerAssetId: "" }); }}><DialogContent className="max-w-lg bg-white"><DialogHeader><DialogTitle className="text-[#1A1A1A]">Correct private recurring plan asset</DialogTitle></DialogHeader><div className="space-y-4 py-2"><p className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs leading-relaxed text-indigo-950">This changes only the private asset context. The plan job, recurrence, time, active state, and existing generated visits remain unchanged.</p><label className="block text-sm font-semibold text-[#1A1A1A]">Recurring plan<select value={recurringPlanAssetEdit.planId} onChange={event => { const plan = recurringPlans.find(item => String(item.id) === event.target.value); setRecurringPlanAssetEdit({ planId: event.target.value, customerAssetId: plan?.customerAssetId ? String(plan.customerAssetId) : "" }); }} className="mt-1.5 w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal">{recurringPlans.map(plan => <option key={plan.id} value={plan.id}>{plan.name} · {plan.jobNumber}</option>)}</select></label><label className="block text-sm font-semibold text-[#1A1A1A]">Private asset context<select value={recurringPlanAssetEdit.customerAssetId} disabled={!selectedPlanAssetEditJob || editablePlanAssetsLoading} onChange={event => setRecurringPlanAssetEdit(current => ({ ...current, customerAssetId: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal disabled:bg-slate-50"><option value="">Remove private asset context</option>{editablePlanAssets.filter(asset => asset.active).map(asset => <option key={asset.id} value={asset.id}>{asset.name}{asset.assetTag ? ` · ${asset.assetTag}` : ""}</option>)}</select><span className="mt-1 block text-xs font-normal text-[rgba(26,26,26,0.6)]">Only active private assets for this plan job’s client are available.</span></label></div><DialogFooter><Button type="button" variant="outline" onClick={() => setRecurringPlanAssetEdit({ planId: "", customerAssetId: "" })}>Cancel</Button><Button type="button" disabled={!selectedPlanForAssetEdit || setRecurringPlanCustomerAsset.isPending} onClick={() => selectedPlanForAssetEdit && setRecurringPlanCustomerAsset.mutate({ id: selectedPlanForAssetEdit.id, customerAssetId: recurringPlanAssetEdit.customerAssetId ? Number(recurringPlanAssetEdit.customerAssetId) : null })} className="bg-indigo-700 text-white hover:bg-indigo-800">{setRecurringPlanCustomerAsset.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save asset context"}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={Boolean(recurringPlanDateEdit.planId)} onOpenChange={open => { if (!open) setRecurringPlanDateEdit({ planId: "", nextVisitDate: "" }); }}><DialogContent className="max-w-lg bg-white"><DialogHeader><DialogTitle className="text-[#1A1A1A]">Correct next private visit date</DialogTitle></DialogHeader><div className="space-y-4 py-2"><p className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs leading-relaxed text-indigo-950">Choose the next eligible future occurrence for this private plan. The date must already match the stored recurrence and date range; its UTC time, job, asset context, and generated visits cannot be changed here.</p><label className="block text-sm font-semibold text-[#1A1A1A]">Recurring plan<select value={recurringPlanDateEdit.planId} onChange={event => { const plan = recurringPlans.find(item => String(item.id) === event.target.value); setRecurringPlanDateEdit({ planId: event.target.value, nextVisitDate: plan?.nextVisitAt ? new Date(plan.nextVisitAt).toISOString().slice(0, 10) : "" }); }} className="mt-1.5 w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal">{recurringPlans.map(plan => <option key={plan.id} value={plan.id}>{plan.name} · {plan.jobNumber}</option>)}</select></label>{selectedPlanForDateEdit && <p className="rounded-lg bg-[#F7F6F3] px-3 py-2 text-xs text-[rgba(26,26,26,0.68)]">{selectedPlanForDateEdit.frequency === "weekly" ? "Weekly" : "Monthly"} plan · {selectedPlanForDateEdit.startTime} UTC · Current next visit: {selectedPlanForDateEdit.nextVisitAt ? dateTime(selectedPlanForDateEdit.nextVisitAt) : "No further visit"}</p>}<label className="block text-sm font-semibold text-[#1A1A1A]">Next eligible date<input type="date" value={recurringPlanDateEdit.nextVisitDate} onChange={event => setRecurringPlanDateEdit(current => ({ ...current, nextVisitDate: event.target.value }))} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A]" /></label></div><DialogFooter><Button type="button" variant="outline" onClick={() => setRecurringPlanDateEdit({ planId: "", nextVisitDate: "" })}>Cancel</Button><Button type="button" disabled={!selectedPlanForDateEdit || !recurringPlanDateEdit.nextVisitDate || setRecurringPlanNextVisit.isPending} onClick={() => selectedPlanForDateEdit && setRecurringPlanNextVisit.mutate({ id: selectedPlanForDateEdit.id, nextVisitDate: recurringPlanDateEdit.nextVisitDate })} className="bg-indigo-700 text-white hover:bg-indigo-800">{setRecurringPlanNextVisit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save next date"}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open) setForm(defaultVisitForm()); }}><DialogContent className="max-w-lg bg-white"><DialogHeader><DialogTitle className="text-[#1A1A1A]">Schedule service visit</DialogTitle></DialogHeader><div className="space-y-4 py-2"><label className="block text-sm font-semibold text-[#1A1A1A]">Job assignment<select value={form.assignmentId} onChange={event => { const assignment = assignments.find(item => String(item.id) === event.target.value); setForm(current => ({ ...current, assignmentId: event.target.value, title: current.title || (assignment ? `${assignment.jobTitle} service visit` : "") })); }} className="mt-1.5 w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal"><option value="">Choose a job owner…</option>{dispatchableAssignments.map(assignment => <option key={assignment.id} value={assignment.id}>{assignment.jobNumber} · {assignment.jobTitle} — {assignment.teamMemberName}</option>)}</select></label>{selectedCapacity && <div className={`rounded-lg border p-3 text-xs ${selectedCapacity.overCapacity || selectedCapacity.scheduledOverCapacity ? "border-rose-200 bg-rose-50 text-rose-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}><p><strong>{selectedCapacity.name}'s assignment plan:</strong> {hoursFromMinutes(selectedCapacity.plannedMinutes)}h of {hoursFromMinutes(selectedCapacity.weeklyCapacityMinutes)}h defined weekly capacity.</p><p className="mt-1 leading-relaxed"><span className="font-semibold">Candidate visit week (UTC):</span> {candidateCapacityWeekLabel}. <span className="font-semibold">Existing scheduled time:</span> {hoursFromMinutes(selectedCapacity.scheduledMinutes)}h. <span className="font-semibold">Candidate duration:</span> {hoursFromMinutes(candidateDurationMinutes)}h. <span className="font-semibold">Projected scheduled time if saved:</span> {hoursFromMinutes(selectedCapacity.scheduledMinutes + candidateDurationMinutes)}h.</p><p className="mt-1">{selectedCapacity.overCapacity || selectedCapacity.scheduledOverCapacity ? "Review the load and confirm any exception intentionally." : `${hoursFromMinutes(selectedCapacity.scheduledRemainingMinutes)}h remains against the defined weekly capacity before this candidate visit.`}</p><span className="mt-1 block text-[11px] opacity-80">These are private owner-planning signals; they are not GPS, staff availability, attendance, payroll, or client-visible promises. This context does not assign, reschedule, dispatch, notify, or change records automatically.</span></div>}<Field label="Visit title" value={form.title} onChange={value => setForm(current => ({ ...current, title: value }))} placeholder="e.g. Onsite installation" /><div className="grid gap-3 sm:grid-cols-2"><DateField label="Start" value={form.start} onChange={value => setForm(current => ({ ...current, start: value }))} /><DateField label="End" value={form.end} onChange={value => setForm(current => ({ ...current, end: value }))} /></div><Field label="Site label (optional)" value={form.siteLabel} onChange={value => setForm(current => ({ ...current, siteLabel: value }))} placeholder="e.g. Client office" /><Field label="Internal dispatch note (optional)" value={form.dispatchNote} onChange={value => setForm(current => ({ ...current, dispatchNote: value }))} placeholder="Access, scope, or handoff details" /><label className="flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50 p-3 text-xs text-teal-950"><input type="checkbox" checked={form.clientVisible} onChange={event => setForm(current => ({ ...current, clientVisible: event.target.checked }))} className="mt-0.5 h-4 w-4 accent-[#007A68]" /><span><strong>Share this visit in the client portal.</strong> Only the title, scheduled window, site label, selected status, and client-safe update will be visible. Staff assignment and internal dispatch notes stay private.</span></label>{form.clientVisible && <Field label="Client-safe update (optional)" value={form.clientUpdate} onChange={value => setForm(current => ({ ...current, clientUpdate: value }))} placeholder="e.g. We will arrive during this visit window." />}<label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><input type="checkbox" checked={form.allowConflict} onChange={event => setForm(current => ({ ...current, allowConflict: event.target.checked }))} className="mt-0.5 h-4 w-4 accent-[#D4922A]" /><span><strong>Allow an intentional overlap.</strong> Leave this unchecked for normal scheduling. Check it only when you knowingly schedule a team member in overlapping service windows.</span></label><p className="flex gap-2 rounded-lg bg-[#F7F6F3] p-3 text-xs text-[rgba(26,26,26,0.62)]"><AlertTriangle className="h-4 w-4 flex-shrink-0 text-[#D4922A]" />Client visibility is explicit, never automatic. This board does not use GPS, optimize routes, or expose staff assignment details in the portal.</p></div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={submitVisit} disabled={createVisit.isPending} className="bg-[#D4922A] text-white hover:bg-[#B87716]">{createVisit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Schedule visit"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[rgba(26,26,26,0.48)]">{label}</p><p className="mt-2 text-2xl font-bold text-[#1A1A1A]">{value}</p><p className="mt-1 text-xs text-[rgba(26,26,26,0.56)]">{detail}</p></div>; }
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) { return <label className="block text-sm font-semibold text-[#1A1A1A]">{label}<input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#D4922A]/35" /></label>; }
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm font-semibold text-[#1A1A1A]">{label}<input type="datetime-local" value={value} onChange={event => onChange(event.target.value)} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A]" /></label>; }
