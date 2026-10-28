import { useCallback, useEffect, useState } from "react";
import { useParams } from "wouter";
import { AlertCircle, CheckCircle2, ClipboardList, Loader2, MapPin, Phone, Send, Tag, Wrench } from "lucide-react";

/**
 * Public QR asset check-in page — token-gated, no login, no app.
 *
 * Privacy design (pinned by server/assetQr.test.ts):
 * - Reads ONLY GET /api/asset/:token and posts service requests to the same URL.
 * - The page receives only: business name + phone, asset name/tag/location,
 *   completed-service count, and the last service date. Never the asset's
 *   private notes, the client's name, or any contact details.
 * - Unknown, deactivated, or malformed labels are honest 404s.
 */

type AssetScanData = {
  businessName?: string | null;
  businessPhone?: string | null;
  assetName: string;
  assetTag?: string | null;
  functionalLocation?: string | null;
  servicesCompleted: number;
  lastServiceAt?: string | null;
};

export default function AssetScanPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<AssetScanData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    try {
      const res = await fetch(`/api/asset/${token}`, { headers: { Accept: "application/json" } });
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

  const submit = useCallback(async () => {
    setSending(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/asset/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_service", name, phone, message }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setFormError(json?.error?.message ?? "Something went wrong. Try again.");
        if (res.status === 404) setError("not_found");
        return;
      }
      setSent(true);
    } catch {
      setFormError("No connection. Try again.");
    } finally {
      setSending(false);
    }
  }, [token, name, phone, message]);

  const formatDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : null;

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-8">
      <div className="mx-auto max-w-lg space-y-4">
        {loading && !data ? (
          <div className="rounded-lg border border-[color-mix(in oklab, var(--foreground) 8%, transparent)] bg-white p-10 text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#D4922A]" />
            <p className="mt-3 text-sm text-[color-mix(in oklab, var(--foreground) 60%, transparent)]">Opening asset details…</p>
          </div>
        ) : error === "not_found" ? (
          <div className="rounded-lg border border-[color-mix(in oklab, var(--foreground) 8%, transparent)] bg-white p-10 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-[color-mix(in oklab, var(--foreground) 30%, transparent)]" />
            <h1 className="mt-3 text-lg font-bold text-[var(--foreground)]">This asset label is no longer active</h1>
            <p className="mt-2 text-sm text-[color-mix(in oklab, var(--foreground) 60%, transparent)]">The label may have been replaced or the equipment retired. Call the business directly if you need service.</p>
          </div>
        ) : error === "unavailable" && !data ? (
          <div className="rounded-lg border border-[color-mix(in oklab, var(--foreground) 8%, transparent)] bg-white p-10 text-center">
            <p className="text-sm text-[color-mix(in oklab, var(--foreground) 60%, transparent)]">This page is temporarily unavailable. Refresh to try again.</p>
          </div>
        ) : data ? (
          <>
            <header className="rounded-lg bg-[#1C2333] p-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#e1c07e]">{data.businessName ?? "Equipment label"}</p>
              <h1 className="mt-1.5 text-2xl font-bold">{data.assetName}</h1>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/80">
                {data.assetTag && <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1"><Tag className="h-3 w-3" />{data.assetTag}</span>}
                {data.functionalLocation && <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1"><MapPin className="h-3 w-3" />{data.functionalLocation}</span>}
              </div>
            </header>

            <section className="rounded-lg border border-[color-mix(in oklab, var(--foreground) 8%, transparent)] bg-white p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]"><ClipboardList className="h-4 w-4 text-[#D4922A]" />Service history</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-[var(--background)] px-3 py-2.5">
                  <p className="text-xs text-[color-mix(in oklab, var(--foreground) 55%, transparent)]">Services completed</p>
                  <p className="mt-0.5 text-lg font-bold text-[var(--foreground)]">{data.servicesCompleted}</p>
                </div>
                <div className="rounded-lg bg-[var(--background)] px-3 py-2.5">
                  <p className="text-xs text-[color-mix(in oklab, var(--foreground) 55%, transparent)]">Last service</p>
                  <p className="mt-0.5 text-sm font-semibold text-[var(--foreground)]">{formatDate(data.lastServiceAt) ?? "No records yet"}</p>
                </div>
              </div>
              {data.businessPhone && (
                <p className="mt-3 flex items-center gap-2 text-sm text-[color-mix(in oklab, var(--foreground) 65%, transparent)]"><Phone className="h-4 w-4" />{data.businessPhone}</p>
              )}
            </section>

            {sent ? (
              <section className="rounded-lg border border-[#D4922A]/25 bg-[#D4922A]/5 p-6 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-700" />
                <h2 className="mt-2 text-lg font-bold text-[var(--foreground)]">Request received</h2>
                <p className="mt-1.5 text-sm text-[color-mix(in oklab, var(--foreground) 65%, transparent)]">{data.businessName ?? "The business"} will reach out to you about this {data.assetName}. Keep your phone nearby.</p>
              </section>
            ) : (
              <section className="rounded-lg border border-[color-mix(in oklab, var(--foreground) 8%, transparent)] bg-white p-5">
                <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]"><Wrench className="h-4 w-4 text-[#D4922A]" />Request service for this {data.assetName}</h2>
                <p className="mt-1 text-xs text-[color-mix(in oklab, var(--foreground) 55%, transparent)]">Your request goes straight to {data.businessName ?? "the business"} with this equipment already identified.</p>
                <form className="mt-3 space-y-2.5" onSubmit={e => { e.preventDefault(); if (!sending) void submit(); }}>
                  <label htmlFor="asset-req-name" className="block text-xs font-semibold text-[var(--foreground)]">Your name
                    <input id="asset-req-name" required value={name} onChange={e => setName(e.target.value.trim().slice(0, 255))} className="mt-1 block w-full rounded-lg border border-[color-mix(in oklab, var(--foreground) 16%, transparent)] bg-white px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-[#D4922A]/35" />
                  </label>
                  <label htmlFor="asset-req-phone" className="block text-xs font-semibold text-[var(--foreground)]">Phone number
                    <input id="asset-req-phone" required inputMode="tel" value={phone} onChange={e => setPhone(e.target.value.trim().slice(0, 32))} placeholder="(555) 123-4567" className="mt-1 block w-full rounded-lg border border-[color-mix(in oklab, var(--foreground) 16%, transparent)] bg-white px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-[#D4922A]/35" />
                  </label>
                  <label htmlFor="asset-req-msg" className="block text-xs font-semibold text-[var(--foreground)]">What do you need?
                    <textarea id="asset-req-msg" required rows={3} value={message} onChange={e => setMessage(e.target.value.slice(0, 2000))} placeholder="e.g. The unit is making a loud noise and won't start." className="mt-1 block w-full rounded-lg border border-[color-mix(in oklab, var(--foreground) 16%, transparent)] bg-white px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-[#D4922A]/35" />
                  </label>
                  {formError && <p className="text-xs font-medium text-rose-700">{formError}</p>}
                  <button type="submit" disabled={sending} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#D4922A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#8a5e10] disabled:opacity-60">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {sending ? "Sending…" : "Send service request"}
                  </button>
                </form>
              </section>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
