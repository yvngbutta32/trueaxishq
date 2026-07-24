/* TrueAxis HQ — Onboarding Checklist
 * Progress is driven by real DB data via trpc.onboarding.status
 * Dismiss state is kept in localStorage (intentional — it's a UI preference, not business data)
 */
import { useState } from "react";
import { CheckCircle, Circle, ChevronDown, ChevronUp, X, Loader2 } from "lucide-react";
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
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(DISMISS_KEY));

  const { data: status, isLoading } = useOnboardingStatus();

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
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
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none hover:bg-white/3 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
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
          <button
            onClick={e => { e.stopPropagation(); dismiss(); }}
            className="p-1 rounded-lg hover:bg-white/8 transition-colors"
            aria-label="Dismiss checklist"
          >
            <X className="w-3.5 h-3.5 text-[rgba(26,26,26,0.65)]" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {!collapsed && (
        <div className="px-5 pb-1">
          <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: allDone ? "#10B981" : "#D4922A" }}
            />
          </div>
        </div>
      )}

      {/* Steps */}
      {!collapsed && (
        <div className="px-5 pb-4 pt-3 space-y-2">
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
