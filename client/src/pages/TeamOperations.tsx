import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle, BriefcaseBusiness, CheckCircle2, Loader2, Plus, UsersRound, UserPlus, X } from "lucide-react";
import { buildOperationsExceptions } from "@shared/operationsPlanning";

const TEAM_ROLES = ["coordinator", "manager", "specialist", "technician", "contractor"] as const;
const ASSIGNMENT_ROLES = ["lead", "support", "reviewer", "coordinator"] as const;
const ASSIGNMENT_STATUSES = ["assigned", "acknowledged", "declined", "completed"] as const;

const emptyMember = { name: "", email: "", phone: "", role: "specialist" as typeof TEAM_ROLES[number], weeklyCapacityHours: "40", color: "#D4922A" };
const emptyAssignment = { jobId: "", teamMemberId: "", assignmentRole: "support" as typeof ASSIGNMENT_ROLES[number], plannedHours: "", note: "" };

const titleCase = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, character => character.toUpperCase());
const hours = (minutes: number) => `${Math.round((minutes / 60) * 10) / 10}h`;
const utcMondayDateInput = (value = new Date()) => {
  const monday = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() - ((value.getUTCDay() + 6) % 7)));
  return monday.toISOString().slice(0, 10);
};

export default function TeamOperations() {
  const utils = trpc.useUtils();
  const [capacityWeekStart, setCapacityWeekStart] = useState(() => utcMondayDateInput());
  const capacityQueryInput = useMemo(() => ({ weekStart: `${capacityWeekStart}T00:00:00.000Z` }), [capacityWeekStart]);
  const { data: members = [], isLoading: membersLoading } = trpc.team.list.useQuery();
  const { data: capacity = [] } = trpc.team.capacity.useQuery(capacityQueryInput);
  const { data: assignments = [], isLoading: assignmentsLoading } = trpc.team.listAssignments.useQuery();
  const { data: staffAccess } = trpc.team.listStaffAccess.useQuery();
  const { data: jobs = [] } = trpc.jobs.list.useQuery();
  const { data: visits = [] } = trpc.dispatch.listVisits.useQuery();
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [memberForm, setMemberForm] = useState(emptyMember);
  const [assignmentForm, setAssignmentForm] = useState(emptyAssignment);

  const invalidate = () => {
    void utils.team.list.invalidate();
    void utils.team.capacity.invalidate();
    void utils.team.listAssignments.invalidate();
    void utils.jobs.get.invalidate();
  };
  const createMember = trpc.team.create.useMutation({
    onSuccess: () => { invalidate(); setMemberDialogOpen(false); setMemberForm(emptyMember); toast.success("Team member added to the operations roster."); },
    onError: error => toast.error(error.message),
  });
  const assignToJob = trpc.team.assignToJob.useMutation({
    onSuccess: () => { invalidate(); setAssignmentDialogOpen(false); setAssignmentForm(emptyAssignment); toast.success("Job assignment recorded."); },
    onError: error => toast.error(error.message),
  });
  const updateAssignment = trpc.team.updateAssignment.useMutation({ onSuccess: invalidate, onError: error => toast.error(error.message) });
  const removeAssignment = trpc.team.removeAssignment.useMutation({ onSuccess: () => { invalidate(); toast.success("Assignment removed."); }, onError: error => toast.error(error.message) });
  const updateMember = trpc.team.update.useMutation({ onSuccess: invalidate, onError: error => toast.error(error.message) });
  const createStaffInvite = trpc.team.createStaffInvite.useMutation({
    onSuccess: async (data) => {
      await navigator.clipboard?.writeText(data.accessUrl).catch(() => undefined);
      void utils.team.listStaffAccess.invalidate();
      toast.success("Private staff access link copied. Share it directly; no email was sent automatically.");
    },
    onError: error => toast.error(error.message),
  });

  const activeMembers = useMemo(() => members.filter(member => member.active), [members]);
  const activeJobs = useMemo(() => jobs.filter(job => !["completed", "cancelled"].includes(job.status)), [jobs]);
  const totalCapacity = useMemo(() => capacity.filter(member => member.active).reduce((sum, member) => sum + member.weeklyCapacityMinutes, 0), [capacity]);
  const totalPlanned = useMemo(() => capacity.filter(member => member.active).reduce((sum, member) => sum + member.plannedMinutes, 0), [capacity]);
  const operationsExceptions = useMemo(() => buildOperationsExceptions({
    capacity: capacity.map(member => ({ id: member.id, name: member.name, active: member.active, weeklyCapacityMinutes: member.weeklyCapacityMinutes, plannedMinutes: member.plannedMinutes })),
    jobs: jobs.map(job => ({ id: job.id, jobNumber: job.jobNumber, title: job.title, status: job.status })),
    assignments: assignments.map(assignment => ({ jobId: assignment.jobId, status: assignment.status })),
    visits: visits.map(visit => ({ id: visit.id, teamMemberId: visit.teamMemberId, teamMemberName: visit.teamMemberName, title: visit.title, scheduledStart: new Date(visit.scheduledStart), scheduledEnd: new Date(visit.scheduledEnd), status: visit.status, availabilityConflict: visit.availabilityConflict })),
  }), [assignments, capacity, jobs, visits]);

  const submitMember = () => {
    const weeklyCapacityHours = Number(memberForm.weeklyCapacityHours);
    if (!memberForm.name.trim()) return toast.error("Enter a team member name.");
    if (!Number.isFinite(weeklyCapacityHours) || weeklyCapacityHours < 1 || weeklyCapacityHours > 168) return toast.error("Enter a weekly capacity between 1 and 168 hours.");
    createMember.mutate({
      name: memberForm.name.trim(), email: memberForm.email.trim() || undefined, phone: memberForm.phone.trim() || undefined,
      role: memberForm.role, color: memberForm.color, weeklyCapacityMinutes: Math.round(weeklyCapacityHours * 60),
    });
  };

  const submitAssignment = () => {
    const jobId = Number(assignmentForm.jobId);
    const teamMemberId = Number(assignmentForm.teamMemberId);
    const plannedHours = assignmentForm.plannedHours.trim() ? Number(assignmentForm.plannedHours) : undefined;
    if (!jobId || !teamMemberId) return toast.error("Choose both a job and an active team member.");
    if (plannedHours !== undefined && (!Number.isFinite(plannedHours) || plannedHours < 0 || plannedHours > 168)) return toast.error("Planned time must be between 0 and 168 hours.");
    assignToJob.mutate({
      jobId, teamMemberId, assignmentRole: assignmentForm.assignmentRole,
      plannedMinutes: plannedHours === undefined ? undefined : Math.round(plannedHours * 60),
      note: assignmentForm.note.trim() || undefined,
    });
  };

  if (membersLoading) return <div className="h-[480px] rounded-2xl bg-slate-100 animate-pulse" />;

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4922A]">Operations</p>
        <h1 className="mt-1 text-2xl font-bold text-[#1A1A1A]">Team & Capacity</h1>
        <p className="mt-1 max-w-2xl text-sm text-[rgba(26,26,26,0.62)]">Plan the people behind the work, give every job a clear owner, and see capacity pressure before it becomes a client problem.</p>
      </div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setAssignmentDialogOpen(true)} disabled={!activeMembers.length || !activeJobs.length} className="border-[#D4922A]/40 text-[#8A5A0B]"><BriefcaseBusiness className="mr-2 h-4 w-4" /> Assign work</Button><Button onClick={() => setMemberDialogOpen(true)} className="bg-[#D4922A] text-white hover:bg-[#B87716]"><UserPlus className="mr-2 h-4 w-4" /> Add team member</Button></div>
    </header>

    <section className="grid gap-3 sm:grid-cols-3">
      <SummaryCard label="Active team" value={String(activeMembers.length)} detail="Owner-managed roster" />
      <SummaryCard label="Planned capacity" value={hours(totalPlanned)} detail={`${hours(Math.max(0, totalCapacity - totalPlanned))} remaining`} />
      <SummaryCard label="At risk" value={String(capacity.filter(member => member.active && member.overCapacity).length)} detail="Members over planned capacity" warn={capacity.some(member => member.active && member.overCapacity)} />
    </section>

    <section className={`rounded-2xl border p-5 ${operationsExceptions.length ? "border-amber-200 bg-amber-50/45" : "border-emerald-200 bg-emerald-50/45"}`}><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="flex items-center gap-2 font-bold text-[#1A1A1A]"><AlertTriangle className={`h-4 w-4 ${operationsExceptions.length ? "text-[#B87716]" : "text-emerald-600"}`} /> Operations exceptions</h2><p className="mt-1 text-xs text-[rgba(26,26,26,0.6)]">Owner-facing planning signals from the current roster, assignments, service schedule, and private availability overlaps. They do not change jobs or notify clients automatically.</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${operationsExceptions.length ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}>{operationsExceptions.length ? `${operationsExceptions.length} to review` : "No current exceptions"}</span></div>{operationsExceptions.length > 0 && <div className="mt-4 grid gap-2 lg:grid-cols-2">{operationsExceptions.map(exception => <article key={exception.key} className={`rounded-xl border p-3 ${exception.severity === "critical" ? "border-rose-200 bg-white" : "border-amber-200 bg-white"}`}><div className="flex gap-2"><AlertTriangle className={`mt-0.5 h-4 w-4 flex-shrink-0 ${exception.severity === "critical" ? "text-rose-600" : "text-[#B87716]"}`} /><div><h3 className="text-sm font-bold text-[#1A1A1A]">{exception.title}</h3><p className="mt-0.5 text-xs text-[rgba(26,26,26,0.6)]">{exception.detail}</p></div></div></article>)}</div>}</section>

    <section className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-bold text-[#1A1A1A]">Capacity board</h2><p className="mt-1 max-w-2xl text-xs text-[rgba(26,26,26,0.56)]">Planned assignment hours are compared to each owner-defined weekly capacity. Scheduled and private availability time are clipped to the selected UTC week. This is internal planning, not a payroll or time-clock record.</p></div><div className="flex items-end gap-3"><label className="block text-xs font-semibold text-[#1A1A1A]">Planning week (UTC)<input type="date" value={capacityWeekStart} onChange={event => setCapacityWeekStart(utcMondayDateInput(new Date(`${event.target.value}T00:00:00.000Z`)))} className="mt-1 block rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-2.5 py-1.5 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#D4922A]/35" /></label><UsersRound className="mb-1 h-5 w-5 text-[#D4922A]" /></div></div>
      {capacity.length === 0 ? <EmptyRoster onAdd={() => setMemberDialogOpen(true)} /> : <div className="mt-5 grid gap-3 xl:grid-cols-2">{capacity.map(member => {
        const percent = Math.min(100, Math.round(member.loadRatio * 100));
        return <article key={member.id} className={`rounded-xl border p-4 ${member.active ? "border-[rgba(26,26,26,0.1)]" : "border-slate-100 bg-slate-50 opacity-75"}`}>
          <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: member.color }}>{member.name.split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase()}</span><div className="min-w-0"><h3 className="truncate text-sm font-bold text-[#1A1A1A]">{member.name}</h3><p className="truncate text-xs text-[rgba(26,26,26,0.55)]">{titleCase(member.role)} · {member.active ? "Active" : "Inactive"}</p></div></div><button type="button" onClick={() => updateMember.mutate({ id: member.id, active: !member.active })} className="rounded-lg border border-[rgba(26,26,26,0.12)] px-2 py-1 text-xs font-semibold text-[#1A1A1A] hover:bg-[#F7F6F3]" aria-label={`${member.active ? "Archive" : "Reactivate"} ${member.name}`}>{member.active ? "Archive" : "Reactivate"}</button></div>
          <div className="mt-4 flex items-end justify-between gap-3"><div><p className={`text-lg font-bold ${member.overCapacity ? "text-rose-600" : "text-[#1A1A1A]"}`}>{hours(member.plannedMinutes)} <span className="text-xs font-medium text-[rgba(26,26,26,0.5)]">planned of {hours(member.weeklyCapacityMinutes)}</span></p><p className="mt-0.5 text-xs text-[rgba(26,26,26,0.55)]">{member.overCapacity ? `${hours(member.plannedMinutes - member.weeklyCapacityMinutes)} over assignment plan` : `${hours(member.remainingMinutes)} available in assignment plan`}</p><p className={`mt-2 text-xs ${member.scheduledOverCapacity ? "font-semibold text-rose-700" : "text-[rgba(26,26,26,0.6)]"}`}>{hours(member.scheduledMinutes)} scheduled in selected UTC week · {member.scheduledOverCapacity ? `${hours(member.scheduledMinutes - member.weeklyCapacityMinutes)} above defined capacity` : `${hours(member.scheduledRemainingMinutes)} remaining`}</p><p className="mt-1 text-xs text-[rgba(26,26,26,0.56)]">{hours(member.privateAvailabilityMinutes ?? 0)} blocked in private availability in selected UTC week · planning context only</p></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${member.overCapacity || member.scheduledOverCapacity ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{member.overCapacity || member.scheduledOverCapacity ? "Review load" : "On track"}</span></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${member.overCapacity ? "bg-rose-500" : "bg-[#D4922A]"}`} style={{ width: `${percent}%` }} /></div>
        </article>;
      })}</div>}
    </section>

    <section className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-[#1A1A1A]">Staff access</h2><p className="mt-1 max-w-2xl text-xs text-[rgba(26,26,26,0.56)]">Roster records remain private planning data until you create a private, seven-day access link for an active member with an email. Access is limited to that member’s assigned work; finance, private CRM fields, and dispatch notes remain unavailable.</p></div><span className="rounded-full bg-[#F7F6F3] px-2.5 py-1 text-xs font-bold text-[#1A1A1A]">{staffAccess?.memberships.filter(item => item.active).length ?? 0} active</span></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">{activeMembers.map(member => {
        const access = staffAccess?.memberships.find(item => item.teamMemberId === member.id && item.active);
        const pending = staffAccess?.invites.find(item => item.teamMemberId === member.id && !item.revoked && !item.acceptedAt && new Date(item.expiresAt) > new Date());
        return <article key={member.id} className="rounded-xl border border-[rgba(26,26,26,0.1)] p-3"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-[#1A1A1A]">{member.name}</h3><p className="mt-0.5 text-xs text-[rgba(26,26,26,0.56)]">{member.email || "Add an email to enable staff access"}</p></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${access ? "bg-emerald-50 text-emerald-700" : pending ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{access ? "Active" : pending ? "Link pending" : "No access"}</span></div><div className="mt-3 flex justify-end"><Button size="sm" variant="outline" disabled={!member.email || Boolean(access) || createStaffInvite.isPending} onClick={() => createStaffInvite.mutate({ teamMemberId: member.id, role: "field_member", origin: window.location.origin })} className="border-[#D4922A]/40 text-[#8A5A0B]">{pending ? "Replace access link" : "Create private link"}</Button></div></article>;
      })}</div>
      {!activeMembers.length && <p className="mt-4 rounded-xl bg-[#F7F6F3] p-4 text-sm text-[rgba(26,26,26,0.6)]">Add an active roster member with an email before creating staff access.</p>}
    </section>

    <section className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-[#1A1A1A]">Job assignments</h2><p className="mt-1 text-xs text-[rgba(26,26,26,0.56)]">Each assignment is owner-controlled and logged in the job timeline. Team roster entries do not grant account access.</p></div><Button size="sm" onClick={() => setAssignmentDialogOpen(true)} disabled={!activeMembers.length || !activeJobs.length} className="bg-[#1C2333] text-white hover:bg-[#2B3446]"><Plus className="mr-1 h-4 w-4" /> New assignment</Button></div>
      {assignmentsLoading ? <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin text-[#D4922A]" /> : assignments.length === 0 ? <div className="mt-4 rounded-xl bg-[#F7F6F3] p-6 text-center"><CheckCircle2 className="mx-auto h-6 w-6 text-[#D4922A]" /><p className="mt-2 text-sm font-semibold text-[#1A1A1A]">No assignments yet</p><p className="mt-1 text-xs text-[rgba(26,26,26,0.56)]">Assign an active team member to a current job to surface responsibility and planned capacity.</p></div> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b border-[rgba(26,26,26,0.1)] text-xs uppercase tracking-wide text-[rgba(26,26,26,0.48)]"><tr><th className="px-2 py-3">Job</th><th className="px-2 py-3">Owner</th><th className="px-2 py-3">Role</th><th className="px-2 py-3">Plan</th><th className="px-2 py-3">Status</th><th className="px-2 py-3"><span className="sr-only">Actions</span></th></tr></thead><tbody>{assignments.map(assignment => <tr key={assignment.id} className="border-b border-[rgba(26,26,26,0.06)] last:border-0"><td className="px-2 py-3"><p className="font-semibold text-[#1A1A1A]">{assignment.jobTitle}</p><p className="text-xs text-[rgba(26,26,26,0.48)]">{assignment.jobNumber}</p></td><td className="px-2 py-3"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: assignment.teamMemberColor }} />{assignment.teamMemberName}</span></td><td className="px-2 py-3 text-[rgba(26,26,26,0.68)]">{titleCase(assignment.assignmentRole)}</td><td className="px-2 py-3 text-[rgba(26,26,26,0.68)]">{assignment.plannedMinutes === null ? "Not set" : hours(assignment.plannedMinutes)}</td><td className="px-2 py-3"><select aria-label={`Set status for ${assignment.teamMemberName} on ${assignment.jobTitle}`} value={assignment.status} onChange={event => updateAssignment.mutate({ id: assignment.id, status: event.target.value as typeof ASSIGNMENT_STATUSES[number] })} className="rounded-lg border border-[rgba(26,26,26,0.14)] bg-white px-2 py-1 text-xs font-semibold text-[#1A1A1A]">{ASSIGNMENT_STATUSES.map(status => <option key={status} value={status}>{titleCase(status)}</option>)}</select></td><td className="px-2 py-3 text-right"><button type="button" onClick={() => removeAssignment.mutate({ id: assignment.id })} className="rounded-md p-2 text-rose-600 hover:bg-rose-50" aria-label={`Remove ${assignment.teamMemberName} from ${assignment.jobTitle}`}><X className="h-4 w-4" /></button></td></tr>)}</tbody></table></div>}
    </section>

    <Dialog open={memberDialogOpen} onOpenChange={open => { setMemberDialogOpen(open); if (!open) setMemberForm(emptyMember); }}><DialogContent className="max-w-lg bg-white"><DialogHeader><DialogTitle className="text-[#1A1A1A]">Add team member</DialogTitle></DialogHeader><div className="space-y-4 py-2"><Field label="Name" value={memberForm.name} onChange={value => setMemberForm(form => ({ ...form, name: value }))} placeholder="e.g. Morgan Lee" /><div className="grid gap-3 sm:grid-cols-2"><Field label="Email (optional)" value={memberForm.email} onChange={value => setMemberForm(form => ({ ...form, email: value }))} type="email" placeholder="morgan@example.com" /><Field label="Phone (optional)" value={memberForm.phone} onChange={value => setMemberForm(form => ({ ...form, phone: value }))} placeholder="555-555-5555" /></div><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold text-[#1A1A1A]">Operational role<select value={memberForm.role} onChange={event => setMemberForm(form => ({ ...form, role: event.target.value as typeof TEAM_ROLES[number] }))} className="mt-1.5 w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal">{TEAM_ROLES.map(role => <option key={role} value={role}>{titleCase(role)}</option>)}</select></label><Field label="Weekly capacity (hours)" value={memberForm.weeklyCapacityHours} onChange={value => setMemberForm(form => ({ ...form, weeklyCapacityHours: value }))} type="number" placeholder="40" /></div><label className="block text-sm font-semibold text-[#1A1A1A]">Roster color<input aria-label="Roster color" type="color" value={memberForm.color} onChange={event => setMemberForm(form => ({ ...form, color: event.target.value }))} className="mt-1.5 block h-10 w-full cursor-pointer rounded-lg border border-[rgba(26,26,26,0.16)] bg-white p-1" /></label><p className="rounded-lg bg-[#F7F6F3] p-3 text-xs text-[rgba(26,26,26,0.6)]">This creates an internal planning record only. It does not create a user login or grant workspace access.</p></div><DialogFooter><Button variant="outline" onClick={() => setMemberDialogOpen(false)}>Cancel</Button><Button onClick={submitMember} disabled={createMember.isPending} className="bg-[#D4922A] text-white hover:bg-[#B87716]">{createMember.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add to roster"}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={assignmentDialogOpen} onOpenChange={open => { setAssignmentDialogOpen(open); if (!open) setAssignmentForm(emptyAssignment); }}><DialogContent className="max-w-lg bg-white"><DialogHeader><DialogTitle className="text-[#1A1A1A]">Assign work</DialogTitle></DialogHeader><div className="space-y-4 py-2"><label className="block text-sm font-semibold text-[#1A1A1A]">Job<select value={assignmentForm.jobId} onChange={event => setAssignmentForm(form => ({ ...form, jobId: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal"><option value="">Choose a current job…</option>{activeJobs.map(job => <option key={job.id} value={job.id}>{job.jobNumber} · {job.title}</option>)}</select></label><label className="block text-sm font-semibold text-[#1A1A1A]">Team member<select value={assignmentForm.teamMemberId} onChange={event => setAssignmentForm(form => ({ ...form, teamMemberId: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal"><option value="">Choose an active member…</option>{activeMembers.map(member => <option key={member.id} value={member.id}>{member.name} · {titleCase(member.role)}</option>)}</select></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold text-[#1A1A1A]">Assignment role<select value={assignmentForm.assignmentRole} onChange={event => setAssignmentForm(form => ({ ...form, assignmentRole: event.target.value as typeof ASSIGNMENT_ROLES[number] }))} className="mt-1.5 w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal">{ASSIGNMENT_ROLES.map(role => <option key={role} value={role}>{titleCase(role)}</option>)}</select></label><Field label="Planned hours (optional)" value={assignmentForm.plannedHours} onChange={value => setAssignmentForm(form => ({ ...form, plannedHours: value }))} type="number" placeholder="8" /></div><Field label="Internal planning note (optional)" value={assignmentForm.note} onChange={value => setAssignmentForm(form => ({ ...form, note: value }))} placeholder="Scope, handoff, or dependency" /><p className="rounded-lg bg-[#F7F6F3] p-3 text-xs text-[rgba(26,26,26,0.6)]">The owner retains control. Assignment state is recorded internally and added to the job’s operational timeline.</p></div><DialogFooter><Button variant="outline" onClick={() => setAssignmentDialogOpen(false)}>Cancel</Button><Button onClick={submitAssignment} disabled={assignToJob.isPending} className="bg-[#D4922A] text-white hover:bg-[#B87716]">{assignToJob.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assign work"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function SummaryCard({ label, value, detail, warn = false }: { label: string; value: string; detail: string; warn?: boolean }) {
  return <div className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[rgba(26,26,26,0.48)]">{label}</p><p className={`mt-2 text-2xl font-bold ${warn ? "text-rose-600" : "text-[#1A1A1A]"}`}>{value}</p><p className="mt-1 text-xs text-[rgba(26,26,26,0.56)]">{detail}</p></div>;
}

function EmptyRoster({ onAdd }: { onAdd: () => void }) {
  return <div className="mt-5 rounded-xl bg-[#F7F6F3] px-5 py-10 text-center"><UsersRound className="mx-auto h-8 w-8 text-[#D4922A]" /><h3 className="mt-3 text-sm font-bold text-[#1A1A1A]">Build an operations roster</h3><p className="mx-auto mt-1 max-w-md text-xs text-[rgba(26,26,26,0.56)]">Add the people who coordinate, manage, review, or deliver the work. Capacity stays private to the owner’s workspace.</p><Button size="sm" onClick={onAdd} className="mt-4 bg-[#1C2333] text-white hover:bg-[#2B3446]"><Plus className="mr-1 h-4 w-4" /> Add team member</Button></div>;
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: "text" | "email" | "number" }) {
  return <label className="block text-sm font-semibold text-[#1A1A1A]">{label}<input type={type === "number" ? "text" : type} inputMode={type === "number" ? "decimal" : undefined} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#D4922A]/35" /></label>;
}
