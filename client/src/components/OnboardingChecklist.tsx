/* TrueAxis HQ — Onboarding Checklist
 * Shown in the Overview panel until all steps are completed
 * Progress is tracked in localStorage
 */
import { useState, useEffect } from "react";
import { CheckCircle, Circle, ChevronDown, ChevronUp, X } from "lucide-react";

const STORAGE_KEY = "trueaxis_onboarding_v1";
const DISMISS_KEY = "trueaxis_onboarding_dismissed";

interface Step {
  id: string;
  label: string;
  desc: string;
  panel?: string;
}

const STEPS: Step[] = [
  { id: "profile", label: "Complete your profile", desc: "Add your name, business name, and contact info in Settings", panel: "settings" },
  { id: "client", label: "Add your first client", desc: "Go to Clients and add a client to get started", panel: "clients" },
  { id: "invoice", label: "Send your first invoice", desc: "Create and send an invoice to a client", panel: "invoices" },
  { id: "booking", label: "Set up your booking page", desc: "Configure your booking link in Settings so clients can schedule time with you", panel: "settings" },
  { id: "followup", label: "Create a follow-up sequence", desc: "Set up automated follow-up messages for your clients", panel: "followups" },
  { id: "recurring", label: "Set up a recurring invoice", desc: "Automate your regular billing with a recurring schedule", panel: "recurring" },
];

interface Props {
  onNavigate: (panel: string) => void;
}

export function OnboardingChecklist({ onNavigate }: Props) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setCompleted(new Set(JSON.parse(saved)));
    const dis = localStorage.getItem(DISMISS_KEY);
    if (dis) setDismissed(true);
  }, []);

  const toggle = (id: string) => {
    setCompleted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  if (dismissed) return null;

  const doneCount = completed.size;
  const total = STEPS.length;
  const pct = Math.round((doneCount / total) * 100);
  const allDone = doneCount === total;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9">
            <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F3F4F6" strokeWidth="3.2" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke={allDone ? "#10B981" : "#D4922A"} strokeWidth="3.2"
                strokeDasharray={`${pct} ${100 - pct}`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#0D1117]">
              {doneCount}/{total}
            </span>
          </div>
          <div>
            <p className="text-sm font-bold text-[#0D1117]">
              {allDone ? "Setup complete! 🎉" : "Getting started"}
            </p>
            <p className="text-xs text-gray-400">
              {allDone ? "You're all set — explore all features" : `${total - doneCount} steps remaining`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {collapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
          <button
            onClick={e => { e.stopPropagation(); dismiss(); }}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Dismiss checklist"
          >
            <X className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {!collapsed && (
        <div className="px-5 pb-1">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
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
                <button
                  onClick={() => toggle(step.id)}
                  className="mt-0.5 flex-shrink-0 transition-transform hover:scale-110"
                  aria-label={done ? `Mark ${step.label} incomplete` : `Mark ${step.label} complete`}
                >
                  {done
                    ? <CheckCircle className="w-5 h-5 text-green-500" />
                    : <Circle className="w-5 h-5 text-gray-300" />
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${done ? "line-through text-gray-400" : "text-[#0D1117]"}`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{step.desc}</p>
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
