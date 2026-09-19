import { TRUEAXIS_LOGO_URL } from "@shared/const";
import { CHANGELOG, formatChangelogDate } from "@shared/productChangelog";
import { ArrowLeft, History } from "lucide-react";
import { useLocation } from "wouter";

const TAG_COLORS: Record<string, string> = {
  Platform: "bg-[#1C2333] text-white",
  "Field Ops": "bg-[#D4922A]/15 text-[#8A5A0B]",
  Money: "bg-emerald-100 text-emerald-800",
  Clients: "bg-blue-100 text-blue-800",
  Integrations: "bg-violet-100 text-violet-800",
  Security: "bg-rose-100 text-rose-800",
  Reporting: "bg-slate-100 text-slate-700",
};

export default function Changelog() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-[#FBFAF8]" style={{ color: "#1A1A1A" }}>
      <div className="container max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-[#6B6B6B] hover:text-[#1A1A1A]" aria-label="Back to home">
            <ArrowLeft className="w-4 h-4" /> <img src={TRUEAXIS_LOGO_URL} alt="TrueAxis HQ" className="h-7 w-auto object-contain" />
          </button>
          <button onClick={() => navigate("/status")} className="text-xs text-[#6B6B6B] hover:text-[#1A1A1A]">System status →</button>
        </div>

        <h1 className="text-2xl font-bold flex items-center gap-2"><History className="w-6 h-6 text-[#D4922A]" /> Changelog</h1>
        <p className="mt-2 text-sm text-[#6B6B6B]">
          Every meaningful change we ship to TrueAxis HQ, newest first — written the day it reaches the main branch.
          No marketing gloss: if a feature is marked live here, it's live in the product.
        </p>

        <ol className="mt-6 space-y-4">
          {CHANGELOG.map(entry => (
            <li key={`${entry.date}-${entry.title}`} className="rounded-xl border border-[#EFEEE9] bg-white p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm font-bold">{entry.title}</p>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TAG_COLORS[entry.tag] ?? "bg-slate-100 text-slate-700"}`}>{entry.tag}</span>
              </div>
              <p className="text-xs text-[#8A8A8A] mt-1">
                {formatChangelogDate(entry.date)}{entry.commit && <> · <code className="font-mono">{entry.commit}</code></>}
              </p>
              <p className="text-sm text-[#4A4A4A] mt-2 leading-6">{entry.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
