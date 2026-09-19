import { TRUEAXIS_LOGO_URL } from "@shared/const";
import { INCIDENT_TRACKING_BEGAN, STATUS_INCIDENTS } from "@shared/statusIncidents";
import { formatChangelogDate } from "@shared/productChangelog";
import { ArrowLeft, Activity, CheckCircle2, AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";

type HealthState =
  | { kind: "checking" }
  | { kind: "healthy"; responseMs: number; checkedAt: Date }
  | { kind: "degraded"; responseMs: number; checkedAt: Date }
  | { kind: "unreachable"; checkedAt: Date };

const REFRESH_MS = 60_000;

export default function Status() {
  const [, navigate] = useLocation();
  const [health, setHealth] = useState<HealthState>({ kind: "checking" });

  const probe = useCallback(async () => {
    const startedAt = performance.now();
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const responseMs = Math.round(performance.now() - startedAt);
      const body = await res.json();
      setHealth(
        res.ok && body?.status === "healthy"
          ? { kind: "healthy", responseMs, checkedAt: new Date() }
          : { kind: "degraded", responseMs, checkedAt: new Date() }
      );
    } catch {
      setHealth({ kind: "unreachable", checkedAt: new Date() });
    }
  }, []);

  useEffect(() => {
    probe();
    const interval = setInterval(probe, REFRESH_MS);
    return () => clearInterval(interval);
  }, [probe]);

  const banner =
    health.kind === "healthy"
      ? { label: "All systems operational", Icon: CheckCircle2, className: "bg-emerald-50 border-emerald-200 text-emerald-800" }
      : health.kind === "degraded"
        ? { label: "Degraded performance — database connection issue", Icon: AlertTriangle, className: "bg-amber-50 border-amber-200 text-amber-800" }
        : health.kind === "unreachable"
          ? { label: "This device cannot reach TrueAxis HQ right now", Icon: AlertTriangle, className: "bg-rose-50 border-rose-200 text-rose-800" }
          : { label: "Checking system status…", Icon: RefreshCw, className: "bg-[#F7F6F3] border-[#EFEEE9] text-[#6B6B6B]" };

  const components = [
    { name: "Web application", detail: "The app you're using right now", live: health.kind === "healthy" || health.kind === "degraded" },
    { name: "REST API", detail: "Public /api/v1 surface and in-app API", live: health.kind === "healthy" || health.kind === "degraded" },
    { name: "Database", detail: "Reported live by the health endpoint", live: health.kind === "healthy" },
  ];

  return (
    <div className="min-h-screen bg-[#FBFAF8]" style={{ color: "#1A1A1A" }}>
      <div className="container max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-[#6B6B6B] hover:text-[#1A1A1A]" aria-label="Back to home">
            <ArrowLeft className="w-4 h-4" /> <img src={TRUEAXIS_LOGO_URL} alt="TrueAxis HQ" className="h-7 w-auto object-contain" />
          </button>
          <button onClick={probe} className="flex items-center gap-1.5 text-xs text-[#6B6B6B] hover:text-[#1A1A1A]" aria-label="Refresh status now">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        <h1 className="text-2xl font-bold flex items-center gap-2"><Activity className="w-6 h-6 text-[#D4922A]" /> System Status</h1>
        <p className="mt-2 text-sm text-[#6B6B6B]">
          Live health, checked from your device every minute and on demand. We publish every incident here —
          including the ones that make us look bad — along with its root cause and fix.
        </p>

        {/* Announce only when the status LEVEL changes — not every poll tick. */}
        <p role="status" aria-live="polite" className="sr-only">{banner.label}</p>
        <div className={`mt-6 rounded-xl border p-4 flex items-center gap-3 ${banner.className}`}>
          <banner.Icon className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold">{banner.label}</p>
            {(health.kind === "healthy" || health.kind === "degraded") && (
              <p className="text-xs opacity-80 mt-0.5">
                Responded in {health.responseMs} ms · checked {health.checkedAt.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        <section aria-labelledby="components-heading" className="mt-8">
          <h2 id="components-heading" className="text-sm font-bold uppercase tracking-widest text-[#6B6B6B] mb-3">Components</h2>
          <div className="rounded-xl border border-[#EFEEE9] divide-y divide-[#EFEEE9] bg-white">
            {components.map(component => (
              <div key={component.name} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-semibold">{component.name}</p>
                  <p className="text-xs text-[#6B6B6B] mt-0.5">{component.detail}</p>
                </div>
                {component.live
                  ? <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Operational</span>
                  : <span className="text-xs font-semibold text-[#6B6B6B] flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Unavailable</span>}
              </div>
            ))}
          </div>
          <p className="text-xs text-[#8A8A8A] mt-2">
            Payments, email, and third-party integrations (Google Calendar, Stripe) run on their providers' infrastructure —
            their incidents are reported under each provider's own status page and are included here when they affect your TrueAxis workflows.
          </p>
        </section>

        <section aria-labelledby="incidents-heading" className="mt-8">
          <h2 id="incidents-heading" className="text-sm font-bold uppercase tracking-widest text-[#6B6B6B] mb-3">Incident history</h2>
          {STATUS_INCIDENTS.length === 0 ? (
            <div className="rounded-xl border border-[#EFEEE9] bg-white p-4">
              <p className="text-sm font-semibold">No published incidents</p>
              <p className="text-xs text-[#6B6B6B] mt-1">
                Incident tracking began {formatChangelogDate(INCIDENT_TRACKING_BEGAN)} — and nothing has taken TrueAxis HQ
                offline for users since. When that changes, this page shows the full record: what happened, why, and the fix.
              </p>
            </div>
          ) : (
            <ol className="space-y-3">
              {STATUS_INCIDENTS.map(incident => (
                <li key={incident.title} className="rounded-xl border border-[#EFEEE9] bg-white p-4">
                  <p className="text-sm font-semibold">{incident.title}</p>
                  <p className="text-xs text-[#8A8A8A] mt-0.5">{incident.began} → {incident.resolved} · {incident.components.join(", ")}</p>
                  <p className="text-sm text-[#4A4A4A] mt-2">{incident.summary}</p>
                  <p className="text-sm text-[#6B6B6B] mt-1"><strong>Fix:</strong> {incident.resolution}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="monitoring-heading" className="mt-8">
          <h2 id="monitoring-heading" className="text-sm font-bold uppercase tracking-widest text-[#6B6B6B] mb-3">How we monitor</h2>
          <div className="rounded-xl border border-[#EFEEE9] bg-white p-4 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-[#D4922A] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#4A4A4A]">
              The server exposes a public health endpoint that verifies the database connection on every check.
              This page queries it live from your browser, so you're seeing exactly what we see — no hand-maintained
              status labels. Automated background jobs (overdue detection, recurring invoices) run every 5 minutes
              and log their outcomes. For release-level changes, see the <button onClick={() => navigate("/changelog")} className="text-[#D4922A] hover:underline">changelog</button>.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
