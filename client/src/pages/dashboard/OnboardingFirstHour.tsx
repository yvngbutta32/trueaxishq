import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Clock, Loader2, Rocket, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { ActivePanel } from "./shared";

const DISMISS_KEY = "trueaxis-first-hour-hidden";

interface Props {
  /** Deep-links a step's panel. */
  setActivePanel: (panel: ActivePanel) => void;
}

/** The first-hour guarantee, made real: a guided checklist that walks a new
 *  owner from signup to their first invoice. Shown only on fresh accounts
 *  that aren't fully operational yet — once every step is done it retires. */
export default function OnboardingFirstHour({ setActivePanel }: Props) {
  const { data, isLoading, isFetching } = trpc.settings.firstHourProgress.useQuery(undefined, { retry: 1, refetchOnMount: "always" });
  const [userDismissed, setUserDismissed] = useState(true); // assume hidden until localStorage is read

  // Read dismissal in an effect, not render, to avoid SSR/localStorage ordering hazards.
  useEffect(() => {
    try { setUserDismissed(localStorage.getItem(DISMISS_KEY) === "1"); } catch { setUserDismissed(false); }
  }, []);

  const hideForSession = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* private mode: still dismiss for this visit */ }
    setUserDismissed(true);
  };

  if (isLoading) {
    return <div className="mx-auto mb-6 h-36 max-w-4xl animate-pulse rounded-2xl bg-slate-100" aria-hidden="true" />;
  }
  if (!data || !data.showChecklist || userDismissed) return null;

  return (
    <section className="mx-auto mb-6 max-w-4xl" aria-labelledby="first-hour-heading">
      <div className="rounded-2xl border border-[#D4922A]/25 bg-[#fffaf0] p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <Rocket className="mt-0.5 h-5 w-5 shrink-0 text-[#D4922A]" />
            <div>
              <h2 id="first-hour-heading" className="text-sm font-bold text-[#1A1A1A]">
                Be fully operational in {data.remainingMinutes} minutes
              </h2>
              <p className="mt-1 text-xs leading-5 text-[rgba(26,26,26,0.62)]">
                Six quick steps from signup to your first invoice — no consultants, no implementation calls. Progress saves as you go.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#D4922A]" aria-label="Updating progress" />}
            <button onClick={hideForSession} className="rounded-lg p-1.5 text-[#6B6B6B] hover:bg-[#F0EEE9]" aria-label="Hide the first-hour checklist (reappears on your next visit until complete)"> <X className="h-4 w-4" /> </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2" role="progressbar" aria-valuemin={0} aria-valuemax={data.totalSteps} aria-valuenow={data.doneCount} aria-label="First-hour setup progress">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#EDE9E1]">
            <div className="h-full rounded-full bg-[#D4922A] transition-all" style={{ width: `${(data.doneCount / data.totalSteps) * 100}%` }} />
          </div>
          <p className="text-xs font-bold text-[#1A1A1A]">{data.doneCount}/{data.totalSteps}</p>
        </div>

        <ol className="mt-4 grid gap-2 sm:grid-cols-2">
          {data.steps.map(step => (
            <li key={step.id} className={`flex items-center gap-3 rounded-xl border p-3 ${step.done ? "border-emerald-100 bg-emerald-50/45" : "border-[rgba(26,26,26,0.08)] bg-white"}`}>
              {step.done
                ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Done" />
                : <Circle className="h-4 w-4 shrink-0 text-[#D4922A]" aria-label="Not done yet" />}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#1A1A1A]">{step.label}</p>
                <p className="mt-0.5 text-[11px] leading-4 text-[rgba(26,26,26,0.58)]">{step.detail}</p>
              </div>
              {!step.done && (
                <button
                  onClick={() => setActivePanel(step.panel as ActivePanel)}
                  className="shrink-0 rounded-lg border border-[#D4922A]/40 px-2.5 py-1 text-[11px] font-bold text-[#8A5A0B] hover:bg-[#D4922A]/10"
                >
                  Do it <span aria-hidden="true">→</span><span className="sr-only">{step.label}</span>
                </button>
              )}
            </li>
          ))}
        </ol>

        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[rgba(26,26,26,0.55)]">
          <Clock className="h-3.5 w-3.5 text-[#D4922A]" />
          Estimated remaining work: {data.remainingMinutes} min — part of our operational-in-under-an-hour guarantee.
        </p>
      </div>
    </section>
  );
}
