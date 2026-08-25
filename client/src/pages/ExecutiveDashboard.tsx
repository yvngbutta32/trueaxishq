import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Bot, CalendarDays, CheckCircle2, CircleDollarSign, Clock3, Loader2, Users } from "lucide-react";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);
const dateLabel = (value: string | Date | null | undefined) => value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No target date";

export default function ExecutiveDashboard() {
  const { data: analytics, isLoading: analyticsLoading } = trpc.analytics.overview.useQuery();
  const { data: jobs = [], isLoading: jobsLoading } = trpc.jobs.list.useQuery();
  const { data: automationLogs = [], isLoading: logsLoading } = trpc.automations.logs.useQuery({ limit: 50 });

  const operating = useMemo(() => {
    const active = jobs.filter(job => !["completed", "cancelled"].includes(job.status));
    const awaitingClient = active.filter(job => job.status === "awaiting_client");
    const overdueOrSoon = active.filter(job => {
      if (!job.targetDate) return false;
      const target = new Date(job.targetDate).getTime();
      const inThreeDays = Date.now() + 3 * 24 * 60 * 60 * 1000;
      return target <= inThreeDays;
    });
    const outcomes = automationLogs.map(log => String(log.status || "").toLowerCase());
    const failures = outcomes.filter(status => status === "failed" || status === "error").length;
    const successes = outcomes.filter(status => status === "success" || status === "sent" || status === "completed").length;
    return { active, awaitingClient, overdueOrSoon, failures, successes };
  }, [jobs, automationLogs]);

  if (analyticsLoading || jobsLoading || logsLoading) return <div className="space-y-5"><div className="h-10 w-72 animate-pulse rounded-xl bg-slate-100" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-100" />)}</div></div>;

  const metrics = [
    { label: "Cash collected", value: money(analytics?.totalRevenue ?? 0), detail: "Paid invoices", icon: CircleDollarSign, tone: "text-emerald-700 bg-emerald-50" },
    { label: "Receivables", value: money(analytics?.outstanding ?? 0), detail: "Sent invoices awaiting payment", icon: Clock3, tone: "text-amber-700 bg-amber-50" },
    { label: "Capacity", value: String(analytics?.upcomingSessions ?? 0), detail: "Upcoming appointments", icon: CalendarDays, tone: "text-blue-700 bg-blue-50" },
    { label: "Active work", value: String(operating.active.length), detail: `${operating.awaitingClient.length} awaiting client`, icon: Users, tone: "text-violet-700 bg-violet-50" },
  ];

  return <div className="space-y-6">
    <header><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#D4922A]">Business control room</p><h1 className="mt-1 text-2xl font-bold text-[#1A1A1A]">Executive Operating Dashboard</h1><p className="mt-1 text-sm text-[rgba(26,26,26,0.58)]">Live signals for cash, capacity, client decisions, and operational follow-through.</p></header>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(metric => <div key={metric.label} className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${metric.tone}`}><metric.icon className="h-5 w-5" /></div><p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[rgba(26,26,26,0.48)]">{metric.label}</p><p className="mt-1 text-2xl font-bold text-[#1A1A1A]">{metric.value}</p><p className="mt-1 text-xs text-[rgba(26,26,26,0.55)]">{metric.detail}</p></div>)}</section>
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]"><div className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold text-[#1A1A1A]">Priority queue</h2><p className="mt-1 text-xs text-[rgba(26,26,26,0.52)]">Jobs that need an owner decision in the next three days.</p></div><AlertTriangle className={`h-5 w-5 ${operating.overdueOrSoon.length ? "text-amber-600" : "text-emerald-600"}`} /></div><div className="mt-4 space-y-2">{operating.overdueOrSoon.length ? operating.overdueOrSoon.map(job => <div key={job.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/45 p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#1A1A1A]">{job.title}</p><p className="mt-0.5 text-xs text-[rgba(26,26,26,0.55)]">{job.clientName} · target {dateLabel(job.targetDate)}</p></div><span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold capitalize text-amber-700">{job.status.replaceAll("_", " ")}</span></div>) : <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="mr-2 inline h-4 w-4" />No jobs are due in the next three days.</div>}</div></div>
      <div className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold text-[#1A1A1A]">Automation health</h2><p className="mt-1 text-xs text-[rgba(26,26,26,0.52)]">Latest 50 automation outcomes.</p></div><Bot className="h-5 w-5 text-[#D4922A]" /></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-semibold text-emerald-700">Successful runs</p><p className="mt-1 text-2xl font-bold text-emerald-900">{operating.successes}</p></div><div className={`rounded-xl p-3 ${operating.failures ? "bg-rose-50" : "bg-slate-50"}`}><p className={`text-xs font-semibold ${operating.failures ? "text-rose-700" : "text-slate-600"}`}>Needs attention</p><p className={`mt-1 text-2xl font-bold ${operating.failures ? "text-rose-900" : "text-slate-900"}`}>{operating.failures}</p></div></div><div className="mt-4 rounded-xl bg-[#F7F6F3] p-3 text-xs text-[rgba(26,26,26,0.62)]"><Bot className="mr-1.5 inline h-3.5 w-3.5 text-[#D4922A]" />Open Automation Center to inspect each run, update rules, or address failures.</div></div></section>
    <section className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold text-[#1A1A1A]">Client decision queue</h2><p className="mt-1 text-xs text-[rgba(26,26,26,0.52)]">Keep client-held work visible so it does not stall.</p></div><CircleDollarSign className="h-5 w-5 text-[#D4922A]" /></div><div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{operating.awaitingClient.length ? operating.awaitingClient.map(job => <div key={job.id} className="rounded-xl border border-orange-100 bg-orange-50/45 p-4"><p className="text-sm font-semibold text-[#1A1A1A]">{job.title}</p><p className="mt-1 text-xs text-[rgba(26,26,26,0.55)]">{job.clientName}</p><p className="mt-3 text-xs font-semibold text-orange-700">Awaiting client response</p></div>) : <div className="rounded-xl bg-[#F7F6F3] p-4 text-sm text-[rgba(26,26,26,0.58)]">No jobs are currently awaiting a client decision.</div>}</div></section>
  </div>;
}
