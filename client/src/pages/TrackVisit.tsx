import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { CarFront, CheckCircle2, Clock3, Loader2, MapPin, ShieldCheck } from "lucide-react";

/**
 * Public "on my way" tracking page — token-gated, no login.
 *
 * Privacy design (pinned by server/trackUiContract.test.ts):
 * - Reads ONLY GET /api/track/:token, which serves position + visit window +
 *   business name. No client, technician, address, or note data exists on this
 *   page because none of it is ever sent.
 * - Map is a keyless OpenStreetMap embed — no API keys, no third-party tracking.
 * - The page polls only while the visit is en route; it stops the moment the
 *   visit arrives or the link is revoked, matching the server's auto-revoke.
 */

type TrackData = {
  status: string;
  jobTitle?: string;
  visitWindow?: { start: string; end: string };
  businessName?: string | null;
  position?: { lat: number; lng: number; accuracyMeters: number | null; at: string | null } | null;
};

const REFRESH_MS = 20_000;

export default function TrackVisit() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<TrackData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
  }, []);

  const fetchOnce = useCallback(async () => {
    try {
      const res = await fetch(`/api/track/${token}`, { headers: { Accept: "application/json" } });
      if (res.status === 404) { setError("not_found"); stopPolling(); return; }
      if (!res.ok) { setError("unavailable"); return; }
      const json = await res.json();
      setData(json.data ?? null);
      setError(null);
      // Self-revoke mirrors the server: stop refreshing once the visit is no longer en route.
      if (json.data && json.data.status && json.data.status !== "en_route") stopPolling();
    } catch {
      setError("unavailable");
    } finally {
      setLoading(false);
    }
  }, [token, stopPolling]);

  useEffect(() => {
    if (!token) return;
    void fetchOnce();
    timer.current = setInterval(() => void fetchOnce(), REFRESH_MS);
    return () => stopPolling();
  }, [token, fetchOnce, stopPolling]);

  const arrived = data && data.status && !["en_route", "scheduled"].includes(data.status);
  const enRoute = data?.status === "en_route";
  const position = data?.position ?? null;
  const window_ = data?.visitWindow;
  const lastUpdate = position?.at ? new Date(position.at) : null;

  const mapSrc = position
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${position.lng - 0.012}%2C${position.lat - 0.008}%2C${position.lng + 0.012}%2C${position.lat + 0.008}&layer=mapnik&marker=${position.lat}%2C${position.lng}`
    : null;

  return (
    <main className="min-h-screen bg-[#F7F6F3] px-4 py-8">
      <div className="mx-auto max-w-lg space-y-4">
        {loading && !data ? (
          <div className="rounded-2xl border border-[rgba(26,26,26,0.08)] bg-white p-10 text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#D4922A]" />
            <p className="mt-3 text-sm text-[rgba(26,26,26,0.6)]">Checking this tracking link…</p>
          </div>
        ) : error === "not_found" ? (
          <div className="rounded-2xl border border-[rgba(26,26,26,0.08)] bg-white p-10 text-center">
            <MapPin className="mx-auto h-8 w-8 text-[rgba(26,26,26,0.3)]" />
            <h1 className="mt-3 text-lg font-bold text-[#1A1A1A]">This link is no longer active</h1>
            <p className="mt-2 text-sm text-[rgba(26,26,26,0.6)]">Tracking links expire automatically shortly after they are shared, and end as soon as the visit arrives. Ask the business for a fresh link if you still need one.</p>
          </div>
        ) : error === "unavailable" && !data ? (
          <div className="rounded-2xl border border-[rgba(26,26,26,0.08)] bg-white p-10 text-center">
            <p className="text-sm text-[rgba(26,26,26,0.6)]">Tracking is temporarily unavailable. This page will keep retrying.</p>
          </div>
        ) : data ? (
          <>
            <header className="rounded-2xl bg-[#1C2333] p-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F5C842]">{data.businessName ? "On the way to you" : "Visit tracking"}</p>
              <h1 className="mt-1.5 text-2xl font-bold">{data.businessName ?? data.jobTitle ?? "Service visit"}</h1>
              {data.jobTitle && data.businessName && <p className="mt-1 text-sm text-white/75">{data.jobTitle}</p>}
              {window_ && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90">
                  <Clock3 className="h-3.5 w-3.5" />
                  {new Date(window_.start).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })} – {new Date(window_.end).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </p>
              )}
            </header>

            {arrived ? (
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center" role="status">
                <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
                <h2 className="mt-2 text-lg font-bold text-emerald-900">They have arrived</h2>
                <p className="mt-1 text-sm text-emerald-800">This tracking link has ended. The map and position updates are no longer available.</p>
              </section>
            ) : enRoute ? (
              <>
                <section className="rounded-2xl border border-[rgba(26,26,26,0.08)] bg-white p-5">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" /><span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" /></span>
                    <h2 className="text-sm font-bold text-[#1A1A1A]">En route to you now</h2>
                  </div>
                  {position ? (
                    <>
                      <p className="mt-2 text-xs text-[rgba(26,26,26,0.6)]">Last position {lastUpdate ? `at ${lastUpdate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "recently"}{position.accuracyMeters != null ? ` (±${Math.round(position.accuracyMeters)} m)` : ""}. Updates automatically.</p>
                      <div className="mt-3 overflow-hidden rounded-xl border border-[rgba(26,26,26,0.1)]">
                        <iframe title="Live position map" src={mapSrc ?? ""} className="h-64 w-full" loading="lazy" referrerPolicy="no-referrer" />
                      </div>
                      <p className="mt-2 text-[10px] text-[rgba(26,26,26,0.42)]">Map © OpenStreetMap contributors</p>
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-[rgba(26,26,26,0.6)]">The position will appear here as soon as the vehicle reports it. This page updates automatically.</p>
                  )}
                </section>
                <p className="flex items-start gap-2 px-1 text-xs text-[rgba(26,26,26,0.52)]">
                  <CarFront className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#D4922A]" />
                  This link shows only this visit's progress. It was shared with you directly by the business, expires on its own, and shows no address or contact details.
                </p>
              </>
            ) : (
              <section className="rounded-2xl border border-[rgba(26,26,26,0.08)] bg-white p-6 text-center">
                <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#D4922A]" />
                <p className="mt-3 text-sm text-[rgba(26,26,26,0.6)]">Waiting for the visit to start. This page updates automatically.</p>
              </section>
            )}
          </>
        ) : null}

        <p className="flex items-center justify-center gap-1.5 pt-2 text-[10px] text-[rgba(26,26,26,0.4)]">
          <ShieldCheck className="h-3.5 w-3.5" /> Consent-based sharing — powered by TrueAxis
        </p>
      </div>
    </main>
  );
}
