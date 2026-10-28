import { TRUEAXIS_LOGO_URL } from "@shared/const";
import { COMPARE_AS_OF, COMPARE_BEHIND, COMPARE_ROWS, type CompetitorKey } from "@shared/compareData";
import { formatChangelogDate } from "@shared/productChangelog";
import { ArrowLeft, CheckCircle2, ExternalLink, Scale, ShieldAlert } from "lucide-react";
import { useLocation } from "wouter";

const COMPETITOR_NAMES: Record<CompetitorKey, string> = {
  jobber: "Jobber",
  housecallPro: "Housecall Pro",
  serviceTitan: "ServiceTitan",
};

const CARD = "rounded-xl border border-[#EFEEE9] bg-white p-5";

function SourceLink({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-[#8a5e10] hover:underline mt-1"
    >
      <ExternalLink className="w-3 h-3" /> {label}
    </a>
  );
}

export default function Compare() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-[#FBFAF8]" style={{ color: "var(--foreground)" }}>
      <div className="container max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]" aria-label="Back to home">
            <ArrowLeft className="w-4 h-4" /> <img src={TRUEAXIS_LOGO_URL} alt="TrueAxis HQ" className="h-7 w-auto object-contain" />
          </button>
          <button onClick={() => navigate("/security")} className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]">Security →</button>
        </div>

        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Scale className="w-6 h-6 text-[#D4922A]" /> Compare
        </h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          An honest look at how TrueAxis HQ stacks up against the field-service apps companies switch between.
          Every competitor statement cites its public source — from research dated {formatChangelogDate(COMPARE_AS_OF)}.
          Prices and plans change; verify before you buy. And because a one-sided comparison is an ad, the last section
          lists what they do better than us today.
        </p>

        <div className="mt-6 space-y-6">
          {COMPARE_ROWS.map(row => (
            <section key={row.feature} className={CARD}>
              <h2 className="text-sm font-bold">{row.feature}</h2>

              <div className="mt-3 rounded-lg border border-[#D4922A]/30 bg-[#D4922A]/5 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8a5e10] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> TrueAxis HQ
                </p>
                <p className="text-sm text-[#4A4A4A] mt-1 leading-6">{row.us}</p>
                <p className="text-[11px] text-[#8A8A8A] mt-1">
                  Verified by our test suite: {row.usEvidence.join(", ")}
                </p>
              </div>

              <div className="mt-3 space-y-3">
                {(Object.entries(row.competitors) as [CompetitorKey, (typeof row.competitors)[CompetitorKey]][]).map(([key, claim]) =>
                  claim ? (
                    <div key={key}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8A8A8A]">{COMPETITOR_NAMES[key]}</p>
                      <p className="text-sm text-[#4A4A4A] leading-6">{claim.summary}</p>
                      <SourceLink url={claim.sourceUrl} label={claim.sourceLabel} />
                    </div>
                  ) : null,
                )}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-8 rounded-xl border border-[#C0392B]/25 bg-[#C0392B]/5 p-5">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#C0392B]" /> Where they're ahead of us
          </h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            No product wins every row. These are the gaps we haven't closed — stated plainly.
          </p>
          <ul className="mt-4 space-y-4">
            {COMPARE_BEHIND.map(b => (
              <li key={b.area}>
                <p className="text-sm font-bold">{b.area}</p>
                <p className="text-sm text-[#4A4A4A] leading-6 mt-1">{b.honest}</p>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-8 text-xs text-[var(--muted-foreground)]">
          Sources for all competitor statements live in our published research notes, and every claim on this page is
          verified against them by an automated test. See the{" "}
          <button onClick={() => navigate("/changelog")} className="underline">changelog</button> for what we ship.
        </p>
      </div>
    </div>
  );
}
