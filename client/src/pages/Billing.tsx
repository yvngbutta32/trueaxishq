import { TRUEAXIS_LOGO_URL } from "@shared/const";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  CreditCard, Zap, Crown, Building2, CheckCircle,
  ExternalLink, Loader2, ArrowRight, Shield, Star, ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";

const PLAN_ICONS: Record<string, React.ElementType> = {
  starter: Zap,
  pro: Star,
  agency: Crown,
};

const PLAN_COLORS: Record<string, string> = {
  starter: "bg-blue-500",
  pro: "bg-[#D4922A]",
  agency: "bg-purple-600",
};

export default function Billing() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  useEffect(() => { document.title = "Billing — TrueAxis HQ"; }, []);

  const subscriptionQuery = trpc.billing.getSubscription.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const plansQuery = trpc.billing.getPlans.useQuery();

  const checkoutMutation = trpc.billing.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        toast.info("Redirecting to checkout…");
        window.open(data.url, "_blank");
      }
    },
    onError: (e) => toast.error("Checkout error: " + e.message),
  });

  const portalMutation = trpc.billing.createPortal.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        toast.info("Opening billing portal…");
        window.open(data.url, "_blank");
      }
    },
    onError: (e) => toast.error("Portal error: " + e.message),
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Loading billing">
        <Loader2 className="w-8 h-8 text-[#D4922A] animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F0EC]">
        <div className="text-center max-w-sm">
          <Shield className="w-12 h-12 text-[rgba(26,26,26,0.40)] mx-auto mb-4" aria-hidden="true" />
          <h1 className="text-xl font-bold text-[#1A1A1A] mb-2">Sign in to manage billing</h1>
          <Button className="gradient-amber text-white border-0 mt-4" onClick={() => window.location.href = "/login"}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  const currentPlan = subscriptionQuery.data?.planId ?? "free";
  const currentStatus = subscriptionQuery.data?.status ?? "free";
  const hasActiveSubscription = currentStatus === "active";
  const plans = plansQuery.data ?? [];

  return (
    <div className="min-h-screen bg-[#F2F0EC] text-[#1A1A1A]">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <nav className="border-b border-[#DDDBD7] px-4 sm:px-6 py-4 flex items-center justify-between">
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-[#D4922A] hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#D4922A] rounded px-2 py-1">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Dashboard</span>
        </button>
        <div className="flex items-center">
          <img
            src={TRUEAXIS_LOGO_URL}
            alt="TrueAxis HQ"
            className="h-8 w-auto object-contain"
          />
        </div>
      </nav>

      <main id="main-content" className="max-w-4xl mx-auto px-4 pt-10 pb-12 page-bottom">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-[#1A1A1A] mb-1">
            Billing & Subscription
          </h1>
          <p className="text-[rgba(26,26,26,0.55)] text-sm">Manage your plan, upgrade, or access your billing history.</p>
        </div>

        {/* Current Plan Card */}
        <section aria-label="Current subscription" className="bg-white rounded-xl border border-[#DDDBD7] shadow-sm p-6 mb-8">
          <h2 className="text-base font-bold text-[#1A1A1A] mb-4">Current Plan</h2>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              {(() => {
                const Icon = PLAN_ICONS[currentPlan] ?? Zap;
                const color = PLAN_COLORS[currentPlan] ?? "bg-gray-400";
                return (
                  <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`} aria-hidden="true">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                );
              })()}
              <div>
                <p className="text-lg font-extrabold text-[#1A1A1A] capitalize">
                  {currentPlan === "free" ? "Free Plan" : `${currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} Plan`}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    currentStatus === "active" ? "bg-green-100 text-green-800" :
                    currentStatus === "past_due" ? "bg-yellow-100 text-yellow-800" :
                    currentStatus === "cancelled" ? "bg-red-100 text-red-800" :
                    "bg-[#EEECEA] text-[rgba(26,26,26,0.65)]"
                  }`} role="status">
                    {currentStatus === "active" && <CheckCircle className="w-3 h-3" aria-hidden="true" />}
                    {currentStatus === "active" ? "Active" :
                     currentStatus === "past_due" ? "Payment Due" :
                     currentStatus === "cancelled" ? "Cancelled" : "Free"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              {hasActiveSubscription && (
                <Button
                  variant="outline"
                  className="gap-2 bg-transparent border-[#DDDBD7] text-[#1A1A1A] hover:bg-[#EEECEA] hover:text-[#1A1A1A] hover:border-[#C8C5BF]"
                  onClick={() => portalMutation.mutate({ origin: window.location.origin })}
                  disabled={portalMutation.isPending}
                  aria-label="Open Stripe billing portal to manage subscription"
                >
                  {portalMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <CreditCard className="w-4 h-4" aria-hidden="true" />
                  )}
                  Manage Billing
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Interval Toggle */}
        <div className="flex items-center justify-center mb-6">
          <div className="bg-white border border-[#DDDBD7] rounded-xl p-1 flex" role="group" aria-label="Billing interval">
            {(["monthly", "annual"] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setBillingCycle(opt)}
                aria-pressed={billingCycle === opt}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all min-h-[40px] ${
                  billingCycle === opt
                    ? "gradient-amber text-white shadow-sm"
                    : "text-[rgba(26,26,26,0.50)] hover:text-[#1A1A1A]"
                }`}
              >
                {opt === "monthly" ? "Monthly" : "Annual"}
                {opt === "annual" && (
                  <span className="ml-2 text-xs bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded-full font-bold">
                    Save 20%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Plans Grid */}
        <section aria-label="Available subscription plans">
          <div className="grid md:grid-cols-3 gap-5">
            {plansQuery.isLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="skeleton h-80 rounded-xl" aria-hidden="true" />
              ))
            ) : (
              plans.map((plan) => {
                const isCurrent = plan.id === currentPlan;
                const price = billingCycle === "annual"
                  ? Math.round((plan.annualPrice / 100) * 0.8)
                  : plan.monthlyPrice / 100;
                const Icon = PLAN_ICONS[plan.id] ?? Zap;
                const color = PLAN_COLORS[plan.id] ?? "bg-gray-400";

                return (
                  <article
                    key={plan.id}
                    className={`bg-white rounded-xl border-2 p-6 flex flex-col transition-all ${
                      plan.highlighted
                        ? "border-[#D4922A] shadow-lg shadow-[#D4922A]/10"
                        : isCurrent
                        ? "border-blue-400/60"
                        : "border-[#DDDBD7] hover:border-[#C8C5BF]"
                    }`}
                    aria-label={`${plan.name} plan — $${price} per ${billingCycle === "annual" ? "month (billed annually)" : "month"}`}
                  >
                    {plan.highlighted && (
                      <div className="text-xs font-bold text-[#007A65] bg-[#D4922A]/10 border border-[#D4922A]/20 rounded-full px-3 py-1 text-center mb-4 -mt-1" role="note">
                        Most Popular
                      </div>
                    )}
                    {isCurrent && !plan.highlighted && (
                      <div className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-center mb-4 -mt-1" role="note">
                        Current Plan
                      </div>
                    )}

                    <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center mb-4`} aria-hidden="true">
                      <Icon className="w-5 h-5 text-white" />
                    </div>

                    <h3 className="text-lg font-extrabold text-[#1A1A1A] mb-1">
                      {plan.name}
                    </h3>
                    <p className="text-xs text-[rgba(26,26,26,0.55)] mb-4">{plan.description}</p>

                    <div className="mb-5">
                      <span className="text-3xl font-extrabold text-[#1A1A1A]">${price}</span>
                      <span className="text-sm text-[rgba(26,26,26,0.55)]">/mo</span>
                      {billingCycle === "annual" && (
                        <p className="text-xs text-green-600 font-semibold mt-0.5">Billed annually</p>
                      )}
                    </div>

                    <ul className="space-y-2 mb-6 flex-1" aria-label={`${plan.name} features`}>
                      {plan.features.map((feature: string) => (
                        <li key={feature} className="flex items-start gap-2 text-sm text-[rgba(26,26,26,0.75)]">
                          <CheckCircle className="w-4 h-4 text-[#D4922A] flex-shrink-0 mt-0.5" aria-hidden="true" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {isCurrent ? (
                      <Button
                        variant="outline"
                        className="w-full bg-transparent border-[#DDDBD7] text-[rgba(26,26,26,0.40)] cursor-not-allowed hover:bg-transparent hover:text-[rgba(26,26,26,0.40)] hover:border-[#DDDBD7]"
                        disabled
                        aria-label={`You are currently on the ${plan.name} plan`}
                      >
                        Current Plan
                      </Button>
                    ) : (
                      <Button
                        className={`w-full gap-2 ${plan.highlighted ? "gradient-amber text-white border-0" : "bg-[#EEECEA] border-[#DDDBD7] text-[#1A1A1A] hover:bg-[#E5E3DF] hover:text-[#1A1A1A] hover:border-[#C8C5BF]"}`}
                        variant={plan.highlighted ? "default" : "outline"}
                        onClick={() => {
                          if (!isAuthenticated) {
                            window.location.href = "/login";
                            return;
                          }
                          checkoutMutation.mutate({
                            planId: plan.id as "starter" | "pro" | "agency",
                            interval: billingCycle,
                            origin: window.location.origin,
                          });
                        }}
                        disabled={checkoutMutation.isPending}
                        aria-label={`Subscribe to ${plan.name} plan for $${price}/month`}
                      >
                        {checkoutMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <>
                            {isCurrent ? "Current Plan" : "Get Started"}
                            <ArrowRight className="w-4 h-4" aria-hidden="true" />
                          </>
                        )}
                      </Button>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>

        {/* Test mode notice */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-yellow-800">Test Mode Active</p>
            <p className="text-xs text-yellow-700 mt-0.5">
              Use card <code className="bg-yellow-100 px-1 rounded font-mono">4242 4242 4242 4242</code> with any future expiry and CVC to test payments. No real charges will be made.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
