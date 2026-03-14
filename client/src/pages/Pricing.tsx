/* SkillBridge AI — Pricing Page
 * Design: "Kinetic Warmth" — Teal #00C9A7, Coral #FF6B6B, Charcoal #1C1C1E
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle, Zap, ArrowLeft, Star, Shield, Sparkles } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: { monthly: 49, annual: 39 },
    description: "Perfect for freelancers just getting started.",
    color: "#6B7280",
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
    cta: "Start Free Trial",
    popular: false,
  },
  {
    name: "Pro",
    price: { monthly: 99, annual: 79 },
    description: "For growing service businesses ready to scale.",
    color: "#00C9A7",
    features: [
      "Unlimited active clients",
      "AI client intake + lead scoring",
      "Smart scheduling (advanced)",
      "Automated invoicing + reminders",
      "Unlimited AI follow-ups",
      "Full analytics + insights",
      "Custom booking page + branding",
      "SMS notifications",
      "Priority support",
      "API access",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Agency",
    price: { monthly: 199, annual: 159 },
    description: "For coaches and consultants managing a team.",
    color: "#FF6B6B",
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
];

export default function Pricing() {
  const [, navigate] = useLocation();
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center justify-between" aria-label="Pricing page navigation">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[#00C9A7] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to Home
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg gradient-teal flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-[#1C1C1E] text-sm" style={{ fontFamily: 'Sora, sans-serif' }}>
            SkillBridge <span className="text-teal">AI</span>
          </span>
        </div>
        <Button size="sm" className="gradient-teal text-white border-0 hover:opacity-90" onClick={() => navigate("/dashboard")}>
          Start Free Trial
        </Button>
      </nav>

      {/* Header */}
      <section className="py-12 sm:py-20 text-center px-4">
        <div className="pill-badge bg-[#00C9A7]/10 text-[#00C9A7] border border-[#00C9A7]/20 mb-5 mx-auto w-fit">
          <Sparkles className="w-3 h-3" />
          Simple, Transparent Pricing
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1C1C1E] mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>
          Invest in your business.<br />
          <span className="text-[#00C9A7]">Get 10x back.</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto mb-8">
          Every plan includes a 14-day free trial. No credit card required. Cancel anytime.
        </p>

        {/* Toggle */}
        <div className="flex items-center justify-center gap-3" role="group" aria-label="Billing period">
          <span id="billing-monthly" className={`text-sm font-medium ${!annual ? "text-[#1C1C1E]" : "text-gray-400"}`}>Monthly</span>
          <button
            onClick={() => setAnnual(!annual)}
            role="switch"
            aria-checked={annual}
            aria-labelledby="billing-monthly billing-annual"
            className={`relative w-12 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#00C9A7] focus:ring-offset-2 ${annual ? "bg-[#00C9A7]" : "bg-gray-200"}`}
          >
            <span className="sr-only">{annual ? "Switch to monthly billing" : "Switch to annual billing"}</span>
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${annual ? "translate-x-6" : "translate-x-0.5"}`} aria-hidden="true" />
          </button>
          <span id="billing-annual" className={`text-sm font-medium ${annual ? "text-[#1C1C1E]" : "text-gray-400"}`}>
            Annual
            <span className="ml-1.5 text-xs font-bold text-[#00C9A7] bg-[#00C9A7]/10 px-2 py-0.5 rounded-full" aria-label="Save 20 percent">Save 20%</span>
          </span>
        </div>
      </section>

      {/* Plans */}
      <section className="pb-20">
        <div className="container">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-white rounded-2xl p-6 border-2 transition-all ${
                  plan.popular
                    ? "border-[#00C9A7] shadow-xl shadow-[#00C9A7]/10 scale-105"
                    : "border-gray-100 card-lift"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <div className="pill-badge gradient-teal text-white text-xs px-4 py-1">
                      <Star className="w-3 h-3 fill-white" />
                      Most Popular
                    </div>
                  </div>
                )}

                <div className="mb-5">
                  <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center text-white" style={{ backgroundColor: plan.color }}>
                    <Zap className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: 'Sora, sans-serif' }}>{plan.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                </div>

                <div className="mb-6">
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: 'Sora, sans-serif' }}>
                      ${annual ? plan.price.annual : plan.price.monthly}
                    </span>
                    <span className="text-gray-400 text-sm mb-1">/month</span>
                  </div>
                  {annual && (
                    <p className="text-xs text-[#00C9A7] font-medium mt-1">
                      Billed annually — save ${(plan.price.monthly - plan.price.annual) * 12}/year
                    </p>
                  )}
                </div>

                <Button
                  className={`w-full mb-6 ${plan.popular ? "gradient-teal text-white border-0 hover:opacity-90" : "border-gray-200 text-[#1C1C1E] hover:bg-gray-50 bg-transparent"}`}
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => {
                    if (plan.name === "Agency") {
                      toast.info("Contact sales@skillbridge.ai for Agency pricing");
                    } else {
                      navigate("/dashboard");
                    }
                  }}
                >
                  {plan.cta}
                </Button>

                <ul className="space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: plan.color }} />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="py-12 bg-white border-y border-gray-100">
        <div className="container">
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-gray-500">
            {[
              { icon: Shield, text: "SOC 2 Type II Certified" },
              { icon: CheckCircle, text: "GDPR Compliant" },
              { icon: Star, text: "4.9/5 on G2 (320+ reviews)" },
              { icon: Zap, text: "99.9% Uptime SLA" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-[#00C9A7]" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="container max-w-2xl mx-auto">
          <h2 className="text-3xl font-extrabold text-[#1C1C1E] text-center mb-10" style={{ fontFamily: 'Sora, sans-serif' }}>
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <button
                  className="w-full text-left px-5 py-4 flex items-center justify-between font-medium text-[#1C1C1E] text-sm"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  {faq.q}
                  <span className={`text-[#00C9A7] transition-transform ${openFaq === i ? "rotate-45" : ""}`}>+</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-gray-500 leading-relaxed border-t border-gray-50">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-[#1C1C1E] text-center">
        <div className="container">
          <h2 className="text-3xl font-extrabold text-white mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>
            Start your free trial today.
          </h2>
          <p className="text-gray-400 mb-6">14 days free. No credit card. Cancel anytime.</p>
          <Button
            size="lg"
            className="gradient-teal text-white border-0 hover:opacity-90 px-10 py-6 text-base"
            onClick={() => navigate("/dashboard")}
          >
            Get Started Free
          </Button>
        </div>
      </section>
    </div>
  );
}
