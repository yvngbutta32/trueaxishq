import { trpc } from "@/lib/trpc";
import { Lock } from "lucide-react";

// Reflects the SERVER-enforced plan gate. This is UX only - every gated
// router procedure re-checks entitlements server-side (FORBIDDEN on mismatch).
export function useEntitlements() {
  const q = trpc.billing.myEntitlements.useQuery();
  return { planId: q.data?.planId ?? "free", features: q.data?.features, loading: q.isLoading };
}

export function FeatureLock({ feature, label, children }: { feature: string; label: string; children: React.ReactNode }) {
  const { features, loading } = useEntitlements();
  if (loading) return null;
  const allowed = features ? (features as Record<string, boolean>)[feature] : false;
  if (allowed) return <>{children}</>;
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white px-6 py-12 text-center">
      <Lock className="h-8 w-8 text-[#D4922A]" />
      <h3 className="mt-3 text-sm font-bold text-[#1A1A1A]">{label} is a Pro-plan feature</h3>
      <p className="mt-1 max-w-md text-xs leading-5 text-[rgba(26,26,26,0.56)]">
        Upgrade in Settings &rarr; Billing to unlock it. Your current plan keeps every core tool - this layer is the advanced operating tier.
      </p>
      <a href="/pricing" className="mt-4 rounded-lg bg-[#D4922A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B87716]">View plans</a>
    </div>
  );
}
