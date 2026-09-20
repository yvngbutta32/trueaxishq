import { useCallback, useEffect, useState } from "react";
import { useParams } from "wouter";
import { AlertCircle, Briefcase, CalendarDays, CheckCircle2, ClipboardList, Loader2, Phone, ShieldCheck, XCircle } from "lucide-react";

/**
 * Public zero-install subcontractor job page — token-gated, no login, no app.
 *
 * Privacy design (pinned by server/subContract.test.ts):
 * - Reads ONLY GET /api/sub/:token and posts actions to the same URL.
 * - The page receives only what the owner chose to share: job number, title,
 *   status, schedule, the scope note the owner wrote (which is where site
 *   details live, by owner choice), and the client contact only when the
 *   owner explicitly allowed it.
 * - No client email, budget, internal notes, or other subcontractors are ever
 *   sent to this page, and expired/revoked links are honest 404s.
 */

type SubJobData = {
  status: "invited" | "accepted" | "declined" | "completed";
  businessName?: string | null;
  jobNumber?: string;
  jobTitle?: string;
  jobStatus?: string;
  schedule?: { startDate: string | null; targetDate: string | null };
  scopeNote?: string | null;
  clientContact?: { name: string; phone: string | null } | null;
  expiresAt?: string;
};

export default function SubJobPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SubJobData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [noteSent, setNoteSent] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    try {
      const res = await fetch(`/api/sub/${token}`, { headers: { Accept: "application/json" } });
      if (res.status === 404) { setError("not_found"); return; }
      if (!res.ok) { setError("unavailable"); return; }
      const json = await res.json();
      setData(json.data ?? null);
      setError(null);
    } catch {
      setError("unavailable");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { if (token) void fetchOnce(); }, [token, fetchOnce]);

  const act = useCallback(async (action: "accept" | "decline" | "complete" | "note", withNote?: string) => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/sub/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: withNote }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setActionError(json?.error?.message ?? "Something went wrong. Try again.");
        if (res.status === 404) setError("not_found");
        return;
      }
      if (action === "note") { setNoteSent(true); setNote(""); setTimeout(() => setNoteSent(false), 4000); }
      await fetchOnce();
    } catch {
      setActionError("No connection. Try again.");
    } finally {
      setBusy(false);
    }
  }, [token, fetchOnce]);

  const formatDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : null;

  return (
    <main className="min-h-screen bg-[#F7F6F3] px-4 py-8">
      <div className="mx-auto max-w-lg space-y-4">
        {loading && !data ? (
          <div className="rounded-2xl border border-[rgba(26,26,26,0.08)] bg-white p-10 text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#D4922A]" />
            <p className="mt-3 text-sm text-[rgba(26,26,26,0.6)]">Opening your job link…</p>
          </div>
        ) : error === "not_found" ? (
          <div className="rounded-2xl border border-[rgba(26,26,26,0.08)] bg-white p-10 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-[rgba(26,26,26,0.3)]" />
            <h1 className="mt-3 text-lg font-bold text-[#1A1A1A]">This job link is no longer active</h1>
            <p className="mt-2 text-sm text-[rgba(26,26,26,0.6)]">Job links expire after 14 days and end when revoked or completed. Ask the business for a fresh link if you still need one.</p>
          </div>
        ) : error === "unavailable" && !data ? (
          <div className="rounded-2xl border border-[rgba(26,26,26,0.08)] bg-white p-10 text-center">
            <p className="text-sm text-[rgba(26,26,26,0.6)]">This page is temporarily unavailable. Refresh to try again.</p>
          </div>
        ) : data ? (
          <>
            <header className="rounded-2xl bg-[#1C2333] p-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F5C842]">{data.businessName ? `${data.businessName} · Subcontract` : "Subcontract job"}</p>
              <h1 className="mt-1.5 text-2xl font-bold">{data.jobTitle ?? "Job invitation"}</h1>
              {data.jobNumber && <p className="mt-1 text-sm text-white/75">Job #{data.jobNumber}</p>}
              {data.jobStatus && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90">
                  <Briefcase className="h-3.5 w-3.5" />
                  Job status: {data.jobStatus.replaceAll("_", " ")}
                </p>
              )}
            </header>

            {(data.schedule?.startDate || data.schedule?.targetDate) && (
              <section className="rounded-2xl border border-[rgba(26,26,26,0.08)] bg-white p-5">
                <h2 className="flex items-center gap-2 text-sm font-bold text-[#1A1A1A]"><CalendarDays className="h-4 w-4 text-[#D4922A]" /> Schedule</h2>
                <p className="mt-2 text-sm text-[rgba(26,26,26,0.75)]">
                  {formatDate(data.schedule?.startDate) && <>Starts {formatDate(data.schedule?.startDate)}</>}
                  {formatDate(data.schedule?.startDate) && formatDate(data.schedule?.targetDate) ? " · " : ""}
                  {formatDate(data.schedule?.targetDate) && <>Target {formatDate(data.schedule?.targetDate)}</>}
                </p>
              </section>
            )}

            {data.scopeNote && (
              <section className="rounded-2xl border border-[rgba(26,26,26,0.08)] bg-white p-5">
                <h2 className="flex items-center gap-2 text-sm font-bold text-[#1A1A1A]"><ClipboardList className="h-4 w-4 text-[#D4922A]" /> Scope & site details</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[rgba(26,26,26,0.75)]">{data.scopeNote}</p>
              </section>
            )}

            {data.clientContact && (
              <section className="rounded-2xl border border-[rgba(26,26,26,0.08)] bg-white p-5">
                <h2 className="flex items-center gap-2 text-sm font-bold text-[#1A1A1A]"><Phone className="h-4 w-4 text-[#D4922A]" /> On-site contact</h2>
                <p className="mt-2 text-sm text-[rgba(26,26,26,0.75)]">{data.clientContact.name}</p>
                {data.clientContact.phone && (
                  <a href={`tel:${data.clientContact.phone}`} className="mt-1 inline-block text-sm font-semibold text-[#D4922A] underline-offset-2 hover:underline">{data.clientContact.phone}</a>
                )}
              </section>
            )}

            {data.status === "invited" ? (
              <section className="rounded-2xl border border-[rgba(26,26,26,0.08)] bg-white p-5">
                <h2 className="text-sm font-bold text-[#1A1A1A]">Can you take this job?</h2>
                <p className="mt-1 text-xs text-[rgba(26,26,26,0.6)]">Responding sends your answer straight to the business — no app or account needed.</p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button onClick={() => void act("accept")} disabled={busy} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#D4922A] px-4 text-sm font-bold text-white transition hover:bg-[#b87a20] disabled:opacity-60">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Accept job
                  </button>
                  <button onClick={() => void act("decline", note || undefined)} disabled={busy} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[rgba(26,26,26,0.18)] bg-white px-4 text-sm font-bold text-[rgba(26,26,26,0.75)] transition hover:bg-[rgba(26,26,26,0.04)] disabled:opacity-60">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Decline
                  </button>
                </div>
              </section>
            ) : data.status === "accepted" ? (
              <>
                <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5" role="status">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-emerald-900"><CheckCircle2 className="h-4 w-4" /> You accepted this job</h2>
                  <p className="mt-1 text-xs text-emerald-800">The business can see your acceptance. Keep this link — it's your job page.</p>
                </section>
                <section className="rounded-2xl border border-[rgba(26,26,26,0.08)] bg-white p-5">
                  <label htmlFor="sub-note" className="text-sm font-bold text-[#1A1A1A]">Send a note to the business</label>
                  <textarea id="sub-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} disabled={busy}
                    className="mt-2 w-full rounded-xl border border-[rgba(26,26,26,0.15)] bg-white p-3 text-sm text-[#1A1A1A] outline-none focus:border-[#D4922A] focus:ring-2 focus:ring-[#D4922A]/25"
                    placeholder="e.g. Material arriving Thursday, need gate code" />
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <button onClick={() => void act("note", note)} disabled={busy || !note.trim()} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[rgba(26,26,26,0.18)] bg-white px-4 text-sm font-bold text-[rgba(26,26,26,0.75)] transition hover:bg-[rgba(26,26,26,0.04)] disabled:opacity-50">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Send note
                    </button>
                    <button onClick={() => void act("complete", note || undefined)} disabled={busy} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Work is done
                    </button>
                  </div>
                  {noteSent && <p className="mt-2 text-xs font-semibold text-emerald-700">Note sent.</p>}
                </section>
              </>
            ) : data.status === "completed" ? (
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center" role="status">
                <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
                <h2 className="mt-2 text-lg font-bold text-emerald-900">Work reported complete</h2>
                <p className="mt-1 text-sm text-emerald-800">The business has been notified. This link is now a record of the job.</p>
              </section>
            ) : (
              <section className="rounded-2xl border border-[rgba(26,26,26,0.08)] bg-white p-6 text-center" role="status">
                <XCircle className="mx-auto h-9 w-9 text-[rgba(26,26,26,0.3)]" />
                <h2 className="mt-2 text-lg font-bold text-[#1A1A1A]">You declined this job</h2>
                <p className="mt-1 text-sm text-[rgba(26,26,26,0.6)]">The business was notified. Ask them for a fresh link if you change your mind.</p>
              </section>
            )}

            {actionError && (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-red-600" role="alert"><AlertCircle className="h-3.5 w-3.5" /> {actionError}</p>
            )}
          </>
        ) : null}

        <p className="flex items-center justify-center gap-1.5 pt-2 text-[10px] text-[rgba(26,26,26,0.4)]">
          <ShieldCheck className="h-3.5 w-3.5" /> No account needed — powered by TrueAxis
        </p>
      </div>
    </main>
  );
}
