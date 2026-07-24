/* TrueAxis HQ — Pricing Page
 * Design: "Dark Amber Retro-Modern" — Charcoal #161B22, Amber #D4922A, Cream #F5F0E8
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { CheckCircle, Zap, ArrowLeft, Star, Shield, Sparkles, Brain, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

const plans = [
  {
    name: "Starter",
    price: { monthly: 49, annual: 39 },
    description: "Perfect for freelancers just getting started.",
    accentColor: "rgba(26,26,26,0.30)",
    features: [
      "Up to 20 active clients",
      "AI client intake forms",
      "Smart scheduling (basic)",
      "Automated invoicing",
      "Email follow-ups (5/month)",
      "Analytics dashboard",
      "1 booking page",
      "Email support",
    ],
    notIncluded: ["Client Pulse AI™", "Unlimited follow-ups", "Priority support"],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    name: "Pro",
    price: { monthly: 99, annual: 79 },
    description: "For growing service businesses ready to scale.",
    accentColor: "#D4922A",
    features: [
      "Unlimited active clients",
      "AI client intake + lead scoring",
      "Smart scheduling (advanced)",
      "Automated invoicing + reminders",
      "Unlimited AI follow-ups",
      "Full analytics + insights",
      "Custom booking page + branding",
      "Client Pulse AI™",
      "Priority support",
      "API access",
    ],
    notIncluded: [],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Agency",
    price: { monthly: 199, annual: 159 },
    description: "For coaches and consultants managing a team.",
    accentColor: "#7A9A8A",
    features: [
      "Everything in Pro",
      "Up to 10 sub-accounts",
      "White-label booking pages",
      "Team management dashboard",
      "Shared client database",
      "Custom AI training",
      "Dedicated account manager",
      "SLA support",
      "Custom integrations",
      "Revenue sharing tools",
    ],
    notIncluded: [],
    cta: "Contact Sales",
    popular: false,
  },
];

const faqs = [
  { q: "Is there a free trial?", a: "Yes — all plans come with a 14-day free trial. No credit card required to start." },
  { q: "Can I switch plans later?", a: "Absolutely. You can upgrade or downgrade at any time. Changes take effect on your next billing cycle." },
  { q: "What payment methods do you accept?", a: "We accept all major credit cards (Visa, Mastercard, Amex) and ACH bank transfers for annual plans." },
  { q: "Do you offer refunds?", a: "Yes. If you're not satisfied within the first 30 days, we'll refund your payment — no questions asked." },
  { q: "What happens to my data if I cancel?", a: "Your data is yours. We export everything in CSV/PDF format upon request and delete it within 30 days of cancellation." },
  { q: "What is Client Pulse AI™?", a: "Client Pulse AI is our proprietary relationship intelligence engine. It scores every client 0–100 in real time, flags churn risk and upsell opportunities, and drafts re-engagement emails automatically. It's exclusive to Pro and Agency plans." },
];

const comparisonRows = [
  { feature: "Active Clients", starter: "20", pro: "Unlimited", agency: "Unlimited" },
  { feature: "Booking Pages", starter: "1", pro: "Custom branded", agency: "White-label" },
  { feature: "AI Follow-Ups", starter: "5/month", pro: "Unlimited", agency: "Unlimited" },
  { feature: "Invoicing", starter: "✓", pro: "✓ + reminders", agency: "✓ + reminders" },
  { feature: "Analytics", starter: "Basic", pro: "Full + insights", agency: "Full + insights" },
  { feature: "Client Pulse AI™", starter: "—", pro: "✓", agency: "✓" },
  { feature: "API Access", starter: "—", pro: "✓", agency: "✓" },
  { feature: "Sub-accounts", starter: "—", pro: "—", agency: "Up to 10" },
  { feature: "White-label", starter: "—", pro: "—", agency: "✓" },
  { feature: "Support", starter: "Email", pro: "Priority", agency: "Dedicated SLA" },
];

export default function Pricing() {
  const [, navigate] = useLocation();
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { isAuthenticated } = useAuth();
  useEffect(() => { document.title = "Pricing — TrueAxis HQ"; }, []);

  return (
    <div style={{ background: "#F7F6F3", minHeight: "100vh", color: "#1A1A1A" }}>
      {/* Nav */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-4"
        style={{ background: "rgba(247,246,243,0.97)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(221,219,215,0.80)" }}
        aria-label="Pricing navigation"
      >
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm font-medium animated-underline"
          style={{ color: "rgba(26,26,26,0.85)", background: "rgba(26,26,26,0.05)", border: "1px solid rgba(26,26,26,0.12)", borderRadius: "0.5rem", padding: "0.35rem 0.75rem", cursor: "pointer", minHeight: "auto", minWidth: "auto" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", minHeight: "auto", minWidth: "auto" }} aria-label="Go to homepage">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/logo-r1_d9d437c8.png"
            alt="TrueAxis HQ"
            className="h-8 w-auto object-contain"
          />
        </button>
        <button onClick={() => isAuthenticated ? navigate("/dashboard") : navigate("/register")} className="btn-amber" style={{ padding: "0.4rem 1rem", fontSize: "0.8125rem" }}>
          Start Free Trial
        </button>
      </nav>

      {/* Header */}
      <section className="py-10 sm:py-14 text-center px-4 relative overflow-hidden">
        <div className="absolute inset-0 retro-grid opacity-30 pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 60% at 50% 40%, rgba(232,160,32,0.07) 0%, transparent 70%)" }} />
        <div className="relative z-10">
          <div className="pill-retro mb-5 inline-flex">
            <Sparkles className="w-3 h-3" />
            Simple, Transparent Pricing
          </div>
          <h1 style={{ fontWeight: 800, fontSize: "clamp(2rem, 4.5vw, 3.25rem)", letterSpacing: "-0.03em", color: "#1A1A1A", lineHeight: 1.1 }}>
            Invest in your business.
            <br />
            <span style={{ color: "#D4922A" }}>Get 10× back.</span>
          </h1>
          <p className="mt-4 mb-10 max-w-xl mx-auto" style={{ color: "rgba(26,26,26,0.75)", fontSize: "1.0625rem" }}>
            Every plan includes a 14-day free trial. No credit card required. Cancel anytime.
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-4" role="group" aria-label="Billing period">
            <span className="text-sm font-medium" style={{ color: !annual ? "#1A1A1A" : "rgba(26,26,26,0.45)" }}>Monthly</span>
            <button
              onClick={() => setAnnual(!annual)}
              role="switch"
              aria-checked={annual}
              className="relative w-12 h-6 rounded-full transition-colors focus:outline-none"
              style={{ background: annual ? "#D4922A" : "rgba(26,26,26,0.12)", border: "1px solid rgba(26,26,26,0.12)" }}
            >
              <div className="absolute top-0.5 w-5 h-5 rounded-full shadow transition-transform" style={{ background: "#FFFFFF", transform: annual ? "translateX(1.5rem)" : "translateX(0.125rem)" }} />
            </button>
            <span className="text-sm font-medium flex items-center gap-2" style={{ color: annual ? "#1A1A1A" : "rgba(26,26,26,0.45)" }}>
              Annual
              <span className="tag tag-amber" style={{ fontSize: "0.65rem" }}>Save 20%</span>
            </span>
          </div>
        </div>
      </section>

      {/* Urgency Banner */}
      <div className="py-2.5 text-center text-xs font-semibold" style={{ background: "rgba(232,160,32,0.12)", borderTop: "1px solid rgba(232,160,32,0.20)", borderBottom: "1px solid rgba(232,160,32,0.20)", color: "#D4922A" }}>
        <span className="inline-flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D4922A] animate-pulse" />
          Early-bird pricing ends soon — lock in your rate before the next price increase
          <span className="w-1.5 h-1.5 rounded-full bg-[#D4922A] animate-pulse" />
        </span>
      </div>

      {/* Plans */}
      <section className="pb-20 px-4">
        <div className="container">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className="relative rounded-xl p-6 flex flex-col"
                style={{
                  background: plan.popular ? "rgba(232,160,32,0.04)" : "#FFFFFF",
                  border: plan.popular ? "1px solid rgba(232,160,32,0.30)" : "1px solid rgba(221,219,215,0.90)",
                  boxShadow: plan.popular ? "0 0 40px rgba(232,160,32,0.08)" : "none",
                  transform: plan.popular ? "scale(1.02)" : "scale(1)",
                }}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <div className="tag tag-amber px-4 py-1 flex items-center gap-1.5" style={{ fontSize: "0.7rem" }}>
                      <Star className="w-3 h-3 fill-current" />
                      Most Popular
                    </div>
                  </div>
                )}

                <div className="mb-5">
                  <div className="w-10 h-10 rounded flex items-center justify-center mb-3" style={{ background: `${plan.accentColor}18`, border: `1px solid ${plan.accentColor}30` }}>
                    {plan.name === "Pro" ? <Brain className="w-5 h-5" style={{ color: plan.accentColor }} /> : <Zap className="w-5 h-5" style={{ color: plan.accentColor }} />}
                  </div>
                  <h3 style={{ fontWeight: 700, fontSize: "1.25rem", color: "#1A1A1A" }}>{plan.name}</h3>
                  <p className="text-sm mt-1" style={{ color: "rgba(26,26,26,0.65)" }}>{plan.description}</p>
                </div>

                <div className="mb-6">
                  <div className="flex items-end gap-1">
                    <span style={{ fontWeight: 800, fontSize: "2.5rem", color: "#1A1A1A", lineHeight: 1 }}>
                      ${annual ? plan.price.annual : plan.price.monthly}
                    </span>
                    <span className="mb-1 text-sm" style={{ color: "rgba(26,26,26,0.65)" }}>/mo</span>
                  </div>
                  {annual && (
                    <p className="text-xs mt-1" style={{ color: "#D4922A" }}>
                      Billed annually — save ${(plan.price.monthly - plan.price.annual) * 12}/yr
                    </p>
                  )}
                </div>

                <button
                  onClick={() => {
                    if (plan.name === "Agency") {
                      toast.info("Contact sales@trueaxishq.com for Agency pricing");
                    } else if (isAuthenticated) {
                      navigate("/dashboard");
                    } else {
                      navigate("/register");
                    }
                  }}
                  className={plan.popular ? "btn-amber w-full mb-6" : "btn-ghost w-full mb-6"}
                  style={{ fontSize: "0.875rem" }}
                >
                  {plan.cta}
                </button>

                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: plan.popular ? "#D4922A" : "#7A9A8A" }} />
                      <span style={{ color: "rgba(26,26,26,0.65)" }}>{feature}</span>
                    </li>
                  ))}
                  {plan.notIncluded.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm opacity-50">
                      <X className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "rgba(26,26,26,0.50)" }} />
                      <span style={{ color: "rgba(26,26,26,0.55)", textDecoration: "line-through" }}>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-20" style={{ background: "#F2F0EC" }}>
        <div className="container max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="section-label mb-3">Full Comparison</div>
            <h2 style={{ fontWeight: 800, fontSize: "clamp(1.6rem, 3vw, 2.25rem)", color: "#1A1A1A", letterSpacing: "-0.025em" }}>
              What's included in each plan
            </h2>
          </div>

          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(232,160,32,0.10)" }}>
            <div className="overflow-x-auto">
            {/* Header */}
            <div className="grid grid-cols-4 min-w-[480px] px-5 py-3" style={{ background: "#EEECEA", borderBottom: "1px solid rgba(232,160,32,0.10)" }}>
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(26,26,26,0.55)" }}>Feature</div>
              {["Starter", "Pro", "Agency"].map((p, i) => (
                <div key={p} className="text-center">
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: i === 1 ? "#D4922A" : "rgba(26,26,26,0.70)" }}>{p}</span>
                </div>
              ))}
            </div>

            {/* Rows */}
            {comparisonRows.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-4 min-w-[480px] px-5 py-3"
                style={{ background: i % 2 === 0 ? "#FFFFFF" : "#F7F6F3", borderBottom: i < comparisonRows.length - 1 ? "1px solid rgba(221,219,215,0.60)" : "none" }}
              >
                <div className="text-sm" style={{ color: "rgba(26,26,26,0.85)" }}>{row.feature}</div>
                {[row.starter, row.pro, row.agency].map((val, j) => (
                  <div key={j} className="text-center text-sm" style={{ color: val === "—" ? "rgba(26,26,26,0.35)" : j === 1 ? "#D4922A" : "rgba(26,26,26,0.80)" }}>
                    {val === "✓" ? <CheckCircle className="w-4 h-4 mx-auto" style={{ color: j === 1 ? "#D4922A" : "#7A9A8A" }} /> : val}
                  </div>
                ))}
              </div>
            ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="py-12" style={{ background: "#F7F6F3", borderTop: "1px solid rgba(232,160,32,0.08)", borderBottom: "1px solid rgba(232,160,32,0.08)" }}>
        <div className="container">
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm">
            {[
              { icon: Shield, text: "SOC 2 Type II Certified" },
              { icon: CheckCircle, text: "GDPR Compliant" },
              { icon: Star, text: "4.9/5 on G2 (320+ reviews)" },
              { icon: Zap, text: "99.9% Uptime SLA" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2" style={{ color: "rgba(26,26,26,0.75)" }}>
                <Icon className="w-4 h-4" style={{ color: "#D4922A" }} />
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Money-Back Guarantee */}
      <section className="py-12 px-4" style={{ background: "#F7F6F3" }}>
        <div className="container max-w-2xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center gap-6 p-7 rounded-xl" style={{ background: "rgba(232,160,32,0.05)", border: "1px solid rgba(232,160,32,0.18)" }}>
            <div className="flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(232,160,32,0.12)", border: "2px solid rgba(232,160,32,0.30)" }}>
              <Shield className="w-8 h-8" style={{ color: "#D4922A" }} />
            </div>
            <div className="text-center sm:text-left">
              <h3 style={{ fontWeight: 700, fontSize: "1.125rem", color: "#1A1A1A" }}>30-Day Money-Back Guarantee</h3>
              <p className="mt-1 text-sm" style={{ color: "rgba(26,26,26,0.75)" }}>Try TrueAxis HQ risk-free for 30 days. If you’re not completely satisfied, we’ll refund every cent — no questions asked, no hoops to jump through.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4" style={{ background: "#F2F0EC" }}>
        <div className="container max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <div className="section-label mb-3">FAQ</div>
            <h2 style={{ fontWeight: 800, fontSize: "clamp(1.6rem, 3vw, 2.25rem)", color: "#1A1A1A", letterSpacing: "-0.025em" }}>
              Common questions
            </h2>
          </div>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(221,219,215,0.80)" }}>
                <button
                  className="w-full text-left px-5 py-4 flex items-center justify-between text-sm font-semibold"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ background: openFaq === i ? "rgba(232,160,32,0.04)" : "#FFFFFF", color: "#1A1A1A", border: "none", minHeight: "auto" }}
                >
                  {faq.q}
                  <span className="text-lg transition-transform" style={{ color: "#D4922A", transform: openFaq === i ? "rotate(45deg)" : "none", display: "inline-block" }}>+</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm leading-relaxed" style={{ background: "rgba(232,160,32,0.02)", borderTop: "1px solid rgba(232,160,32,0.08)", color: "rgba(26,26,26,0.80)" }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pt-20 pb-16 page-bottom text-center relative overflow-hidden" style={{ background: "#F7F6F3" }}>
        <div className="absolute inset-0 retro-grid opacity-25 pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 50% 70% at 50% 50%, rgba(232,160,32,0.06) 0%, transparent 70%)" }} />
        <div className="container relative z-10">
          <h2 style={{ fontWeight: 800, fontSize: "clamp(1.6rem, 3vw, 2.25rem)", color: "#1A1A1A", letterSpacing: "-0.025em" }}>
            Start your free trial today.
          </h2>
          <p className="mt-3 mb-8" style={{ color: "rgba(26,26,26,0.75)" }}>14 days free. No credit card. Cancel anytime.</p>
          <button onClick={() => navigate("/dashboard")} className="btn-amber" style={{ padding: "0.75rem 2.5rem", fontSize: "1rem" }}>
            Get Started Free
            <Zap className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
