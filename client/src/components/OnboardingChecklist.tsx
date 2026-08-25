/* TrueAxis HQ — Onboarding Checklist
 * Progress is driven by real DB data via trpc.onboarding.status
 * Dismiss state is kept in localStorage (intentional — it's a UI preference, not business data)
 */
import { useState } from "react";
import { CheckCircle, Circle, ChevronDown, ChevronUp, X, Loader2, Rocket } from "lucide-react";
import { trpc } from "@/lib/trpc";

const DISMISS_KEY = "trueaxis_onboarding_dismissed_v2";

interface Step {
  id: keyof ReturnType<typeof useOnboardingStatus>["data"] extends undefined ? never : keyof NonNullable<ReturnType<typeof useOnboardingStatus>["data"]>;
  label: string;
  desc: string;
  panel?: string;
}

function useOnboardingStatus() {
  return trpc.onboarding.status.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

const STEPS: { id: string; label: string; desc: string; panel?: string }[] = [
  { id: "profile",   label: "Complete your profile",        desc: "Add your business name in Settings",                                    panel: "settings"   },
  { id: "client",    label: "Add your first client",         desc: "Go to Clients and add a client to get started",                         panel: "clients"    },
  { id: "invoice",   label: "Send your first invoice",       desc: "Create and send an invoice from the Billing panel",                     panel: "billing"    },
  { id: "booking",   label: "Set up your booking page",      desc: "Set a booking username in Settings so clients can schedule with you",   panel: "settings"   },
  { id: "followup",  label: "Create a follow-up sequence",   desc: "Set up automated follow-up messages in Outreach",                       panel: "outreach"   },
  { id: "recurring", label: "Set up a recurring invoice",    desc: "Automate your regular billing in the Billing panel",                    panel: "billing"    },
];

interface Props {
  onNavigate: (panel: string) => void;
}

export function OnboardingChecklist({ onNavigate }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return !!localStorage.getItem(DISMISS_KEY); } catch { return false; }
  });

  const { data: status, isLoading } = useOnboardingStatus();
  const { data: kits = [] } = trpc.onboarding.fastStartKits.useQuery();
  const applyKit = trpc.onboarding.applyFastStartKit.useMutation({
    onSuccess: result => {
      void status;
      window.dispatchEvent(new CustomEvent("trueaxis-fast-start-kit-applied"));
    },
  });

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    setDismissed(true);
  };

  if (dismissed) return null;

  const completed = new Set(
    status
      ? STEPS.filter(s => (status as Record<string, boolean>)[s.id]).map(s => s.id)
      : []
  );

  const doneCount = completed.size;
  const total = STEPS.length;
  const pct = Math.round((doneCount / total) * 100);
  const allDone = doneCount === total;

  return (
    <div className="bg-white rounded-xl border border-[#DDDBD7] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg text-left hover:bg-[#F7F6F3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4922A] focus-visible:ring-offset-2"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          aria-controls="onboarding-checklist-content"
        >
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9">
            {isLoading ? (
              <Loader2 className="w-9 h-9 text-[#D4922A] animate-spin" />
            ) : (
              <>
                <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth="3.2" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke={allDone ? "#10B981" : "#D4922A"} strokeWidth="3.2"
                    strokeDasharray={`${pct} ${100 - pct}`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#1A1A1A]">
                  {doneCount}/{total}
                </span>
              </>
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-[#1A1A1A]">
              {allDone ? "Setup complete! 🎉" : "Getting started"}
            </p>
            <p className="text-xs text-[rgba(26,26,26,0.65)]">
              {isLoading
                ? "Checking your progress…"
                : allDone
                  ? "You're all set — explore all features"
                  : `${total - doneCount} step${total - doneCount === 1 ? "" : "s"} remaining`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {collapsed
            ? <ChevronDown className="w-4 h-4 text-[rgba(26,26,26,0.65)]" />
            : <ChevronUp className="w-4 h-4 text-[rgba(26,26,26,0.65)]" />
          }
        </div>
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="ml-2 p-1 rounded-lg hover:bg-[#EEECEA] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4922A]"
          aria-label="Dismiss checklist"
        >
          <X className="w-3.5 h-3.5 text-[rgba(26,26,26,0.65)]" />
        </button>
      </div>

      {/* Progress bar */}
      {!collapsed && (
        <div className="px-5 pb-1">
          <div className="h-1.5 bg-[#EEECEA] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: allDone ? "#10B981" : "#D4922A" }}
            />
          </div>
        </div>
      )}

      {/* Steps */}
      {!collapsed && (
        <div id="onboarding-checklist-content" className="px-5 pb-4 pt-3 space-y-2">
          <div className="mb-4 rounded-xl border border-[#D4922A]/25 bg-[#fffaf0] p-3">
            <div className="flex items-start gap-2"><Rocket className="mt-0.5 h-4 w-4 shrink-0 text-[#D4922A]" /><div><p className="text-xs font-bold text-[#1A1A1A]">Start with a workflow kit</p><p className="mt-0.5 text-xs text-[rgba(26,26,26,0.62)]">Add editable starter services for the way you work. Prices stay at $0 until you set them.</p></div></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {kits.map(kit => <button key={kit.id} type="button" onClick={() => applyKit.mutate({ kitId: kit.id as "consultant" | "creative" | "agency" | "field_service" })} disabled={applyKit.isPending} className="rounded-lg border border-[rgba(26,26,26,0.12)] bg-white p-2.5 text-left transition-colors hover:border-[#D4922A]/45 hover:bg-[#fffdf8] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4922A]"><span className="block text-xs font-semibold text-[#1A1A1A]">{kit.name}</span><span className="mt-0.5 block text-[11px] leading-snug text-[rgba(26,26,26,0.55)]">{kit.description}</span></button>)}
            </div>
            {applyKit.isSuccess && <p className="mt-2 text-xs font-semibold text-emerald-700">Added {applyKit.data.added} starter service{applyKit.data.added === 1 ? "" : "s"}. Review pricing in Services before publishing.</p>}
            {applyKit.isError && <p className="mt-2 text-xs font-semibold text-red-700">{applyKit.error.message || "The kit could not be applied. Please try again."}</p>}
          </div>
          {STEPS.map(step => {
            const done = completed.has(step.id);
            return (
              <div key={step.id} className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  {done
                    ? <CheckCircle className="w-5 h-5 text-green-400" />
                    : <Circle className="w-5 h-5 text-[rgba(26,26,26,0.55)]" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${done ? "line-through text-[rgba(26,26,26,0.60)]" : "text-[#1A1A1A]"}`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-[rgba(26,26,26,0.65)] mt-0.5">{step.desc}</p>
                </div>
                {step.panel && !done && (
                  <button
                    onClick={() => onNavigate(step.panel!)}
                    className="text-xs text-[#D4922A] font-semibold hover:underline flex-shrink-0 mt-0.5"
                  >
                    Go →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
