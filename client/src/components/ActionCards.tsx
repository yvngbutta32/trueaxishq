import { AlertTriangle, CalendarClock, DollarSign, FileSignature, Send, UserCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";

export type ActionCardTarget = "billing" | "proposals" | "jobs" | "scheduling";

type ServerActionCard = {
  id: string;
  priority: number;
  title: string;
  detail: string;
  count: number;
  target: ActionCardTarget;
};

const CARD_ICONS: Record<string, typeof DollarSign> = {
  overdue_invoices: DollarSign,
  quotes_expiring: AlertTriangle,
  awaiting_signature: FileSignature,
  jobs_awaiting_client: UserCheck,
  pending_approvals: UserCheck,
  draft_invoices: Send,
  todays_bookings: CalendarClock,
};

const CARD_STYLES: Record<string, string> = {
  quotes_expiring: "border-amber-300/60 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-500/5",
  overdue_invoices: "border-red-300/60 bg-red-50/40 dark:border-red-500/30 dark:bg-red-500/5",
};

/**
 * "Today's priorities" strip: owner-facing next-best-actions computed from live
 * data (overdue invoices, quotes awaiting signature or expiring soon, jobs
 * waiting on the client, draft invoices, today's schedule). One click jumps to
 * the owning panel.
 */
export function ActionCards({ onNavigate }: { onNavigate: (panel: ActionCardTarget) => void }) {
  const { data, isLoading } = trpc.dashboard.actionCards.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  if (isLoading || !data?.cards?.length) return null;

  return (
    <section aria-label="Today's priorities" className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B]">Today's priorities</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {data.cards.map((card: ServerActionCard) => {
          const Icon = CARD_ICONS[card.id] ?? DollarSign;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onNavigate(card.target)}
              className={`group flex items-start gap-3 rounded-xl border p-3 text-left transition hover:border-[#D4922A]/60 hover:shadow-sm ${CARD_STYLES[card.id] ?? "border-[#DDDBD7] bg-white/60 dark:bg-transparent"}`}
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#D4922A]/10">
                <Icon className="h-4 w-4 text-[#D4922A]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[#1A1A1A]">{card.title}</span>
                <span className="mt-0.5 block truncate text-xs text-[#6B6B6B]">{card.detail}</span>
              </span>
              <span className="mt-1 text-sm font-bold text-[#D4922A] opacity-60 transition group-hover:opacity-100">→</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
