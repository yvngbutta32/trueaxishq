/* TrueAxis HQ — Changelog Modal
 * Shows "What's New" once per version on dashboard load
 */
import { useEffect, useState } from "react";
import { X, Sparkles, Clock, RefreshCw, FileSignature, Bell, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const CURRENT_VERSION = "1.4.0";
const STORAGE_KEY = `trueaxis_changelog_seen_${CURRENT_VERSION}`;

const CHANGELOG = [
  {
    icon: FileSignature,
    color: "#6366F1",
    title: "Contracts & Proposals",
    desc: "Create, send, and track contracts. Convert accepted proposals directly to invoices.",
  },
  {
    icon: Clock,
    color: "#E8A020",
    title: "Time Tracking",
    desc: "Live timer + manual entries. Track billable hours per client with automatic revenue calculation.",
  },
  {
    icon: RefreshCw,
    color: "#10B981",
    title: "Recurring Invoices",
    desc: "Set up automatic billing schedules — weekly, monthly, quarterly, or yearly.",
  },
  {
    icon: Bell,
    color: "#FF6B6B",
    title: "Live Notifications",
    desc: "In-app notification center with real-time alerts for invoices, bookings, and follow-ups.",
  },
  {
    icon: Shield,
    color: "#8B5CF6",
    title: "Client Portal",
    desc: "Share a secure portal link with clients so they can view invoices and pay online.",
  },
  {
    icon: Zap,
    color: "#E8A020",
    title: "Pay Now on Invoices",
    desc: "Clients can pay invoices instantly via Stripe Checkout — invoices auto-mark paid.",
  },
];

export function ChangelogModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      // Small delay so the dashboard loads first
      const timer = setTimeout(() => setOpen(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="What's New">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismiss} aria-hidden="true" />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-3xl px-6 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-[#E8A020]" />
              <span className="text-xs font-bold text-[#E8A020] uppercase tracking-wider">What's New</span>
            </div>
            <h2 className="text-xl font-bold text-[#1C1C1E]" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              TrueAxis HQ v{CURRENT_VERSION}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">Major update — 6 new features</p>
          </div>
          <button
            onClick={dismiss}
            className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors mt-1"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Feature list */}
        <div className="px-6 py-4 space-y-4">
          {CHANGELOG.map((item, i) => (
            <div key={i} className="flex gap-4">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: item.color + "15" }}
              >
                <item.icon className="w-5 h-5" style={{ color: item.color }} />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1C1C1E]">{item.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2">
          <Button
            onClick={dismiss}
            className="w-full gradient-amber text-white border-0 hover:opacity-90 rounded-xl"
          >
            Got it, let's go!
          </Button>
          <p className="text-xs text-gray-400 text-center mt-3">
            You can find the full changelog in Settings
          </p>
        </div>
      </div>
    </div>
  );
}
