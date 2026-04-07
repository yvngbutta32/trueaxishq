import { useLocation } from "wouter";
import { Target, Heart, Shield, CheckCircle, ArrowLeft, TrendingUp, Users, Clock } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function About() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  return (
    <div style={{ background: "#141414", minHeight: "100vh", color: "#F5F0E8" }}>
      {/* Nav */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-4"
        style={{ background: "rgba(10,10,10,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(232,160,32,0.10)" }}
      >
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm font-medium animated-underline"
          style={{ color: "rgba(245,240,232,0.55)", background: "none", border: "none", minHeight: "auto", minWidth: "auto" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
        <div className="flex items-center">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/logo-r1_d9d437c8.png"
            alt="TrueAxis HQ"
            className="h-8 w-auto object-contain"
          />
        </div>
        <button onClick={() => navigate("/pricing")} className="btn-ghost" style={{ padding: "0.4rem 1rem", fontSize: "0.8125rem" }}>
          View Pricing
        </button>
      </nav>

      {/* Hero */}
      <section className="py-10 sm:py-14 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 retro-grid opacity-30 pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 60% at 50% 40%, rgba(232,160,32,0.07) 0%, transparent 70%)" }} />
        <div className="relative max-w-3xl mx-auto">
          <div className="pill-retro mb-6 inline-flex">
            <Heart className="w-3 h-3" />
            Built for Freelancers, by People Who Get It
          </div>
          <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 800, fontSize: "clamp(2rem, 4.5vw, 3.5rem)", letterSpacing: "-0.03em", color: "#F5F0E8", lineHeight: 1.1 }}>
            We built the platform<br />
            <span style={{ color: "#E8A020" }}>we always needed.</span>
          </h1>
          <p className="mt-6 text-lg max-w-2xl mx-auto" style={{ color: "rgba(245,240,232,0.50)", lineHeight: 1.7 }}>
            TrueAxis HQ was born out of frustration. We watched talented freelancers — coaches, consultants, designers, developers — spend more time on admin work than on the craft they loved. We decided to fix that.
          </p>
        </div>
      </section>

      {/* Mission / Values / Promise */}
      <section className="py-12 px-4" style={{ background: "#0E0E0E" }}>
        <div className="container max-w-5xl mx-auto grid md:grid-cols-3 gap-5">
          {[
            { icon: Target, title: "Our Mission", body: "To give every freelancer and solo service provider the same operational leverage that enterprise companies have — without the enterprise price tag or complexity." },
            { icon: Heart, title: "Our Values", body: "We believe your time is your most valuable asset. Every feature we build is designed to give you more of it. We are obsessively focused on simplicity, reliability, and real business impact." },
            { icon: Shield, title: "Our Promise", body: "We will never sell your data. We will never lock you in. Your client data, your invoices, your business — they belong to you. Always. We are just the engine that makes it run." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="retro-card p-6">
              <div className="w-10 h-10 rounded flex items-center justify-center mb-4" style={{ background: "rgba(232,160,32,0.08)", border: "1px solid rgba(232,160,32,0.18)" }}>
                <Icon className="w-5 h-5" style={{ color: "#E8A020" }} />
              </div>
              <h2 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "1.0625rem", color: "#F5F0E8", marginBottom: "0.5rem" }}>{title}</h2>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(245,240,232,0.45)" }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Story */}
      <section className="py-14 px-4" style={{ background: "#141414" }}>
        <div className="container max-w-3xl mx-auto">
          <div className="section-label mb-3 text-center">The Story</div>
          <h2 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 800, fontSize: "clamp(1.6rem, 3vw, 2.25rem)", color: "#F5F0E8", letterSpacing: "-0.025em", textAlign: "center", marginBottom: "2rem" }}>
            Why TrueAxis HQ exists
          </h2>
          <div className="space-y-5 text-base leading-relaxed" style={{ color: "rgba(245,240,232,0.55)" }}>
            <p>In 2024, the average freelancer in the United States was juggling five or more separate tools just to run their business: a scheduling app, an invoicing tool, a CRM, an email client, and a spreadsheet for everything else. They were paying $200–$400 per month for tools that didn't talk to each other — and spending 15–20 hours per week on admin work instead of billable work.</p>
            <p>TrueAxis HQ was built to collapse all of that into one intelligent platform. We combined AI-powered automation with the core workflows every service provider needs: client management, scheduling, invoicing, follow-ups, and analytics. The result is a platform that doesn't just organize your business — it actively runs it.</p>
            <p>Today, TrueAxis HQ serves thousands of freelancers across coaching, consulting, design, development, fitness, legal, and more. Our users report saving an average of 12 hours per week and increasing their revenue by 34% within their first six months.</p>
            <p>We are a small, focused team. We don't have a massive marketing budget or a flashy office. What we have is a deep commitment to building software that actually works — software that makes your business feel effortless.</p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-4" style={{ background: "#0E0E0E" }}>
        <div className="container max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-px rounded-xl overflow-hidden" style={{ background: "rgba(232,160,32,0.08)" }}>
          {[
            { icon: Users, value: "4,200+", label: "Active Users" },
            { icon: Clock, value: "12 hrs", label: "Saved Per Week" },
            { icon: TrendingUp, value: "34%", label: "Avg Revenue Increase" },
            { icon: Shield, value: "99.9%", label: "Uptime SLA" },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex flex-col items-center justify-center py-10 px-6 text-center" style={{ background: "#141414" }}>
              <Icon className="w-5 h-5 mb-3" style={{ color: "rgba(232,160,32,0.50)" }} />
              <p className="stat-number text-3xl mb-1">{value}</p>
              <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "rgba(245,240,232,0.30)" }}>{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What We Believe */}
      <section className="py-14 px-4" style={{ background: "#141414" }}>
        <div className="container max-w-3xl mx-auto">
          <div className="section-label mb-3 text-center">Our Principles</div>
          <h2 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 800, fontSize: "clamp(1.6rem, 3vw, 2.25rem)", color: "#F5F0E8", letterSpacing: "-0.025em", textAlign: "center", marginBottom: "2rem" }}>
            What we believe
          </h2>
          <ul className="space-y-3">
            {[
              "Freelancers deserve enterprise-grade tools at freelancer-friendly prices.",
              "Automation should feel invisible — it should just work, without you having to think about it.",
              "Your data is yours. We are stewards of it, not owners.",
              "Good software should make you feel calm, not anxious.",
              "The best businesses are built on trust — with clients, with tools, and with each other.",
            ].map(belief => (
              <li key={belief} className="retro-card flex items-start gap-3 p-4">
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#E8A020" }} />
                <span className="text-sm leading-relaxed" style={{ color: "rgba(245,240,232,0.60)" }}>{belief}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 px-4 text-center relative overflow-hidden" style={{ background: "#0E0E0E" }}>
        <div className="absolute inset-0 retro-grid opacity-25 pointer-events-none" />
        <div className="container relative z-10 max-w-xl mx-auto">
          <h2 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 800, fontSize: "clamp(1.6rem, 3vw, 2.25rem)", color: "#F5F0E8", letterSpacing: "-0.025em" }}>
            Ready to join us?
          </h2>
          <p className="mt-3 mb-8" style={{ color: "rgba(245,240,232,0.40)" }}>Start your free 14-day trial. No credit card required.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => isAuthenticated ? navigate("/dashboard") : navigate("/register")} className="btn-amber" style={{ fontSize: "0.9375rem" }}>
              Start Free Trial
            </button>
            <button onClick={() => navigate("/pricing")} className="btn-ghost" style={{ fontSize: "0.9375rem" }}>
              View Pricing
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 text-center text-xs" style={{ borderTop: "1px solid rgba(232,160,32,0.08)", color: "rgba(245,240,232,0.20)" }}>
        <p>© {new Date().getFullYear()} TrueAxis HQ. All rights reserved.</p>
      </footer>
    </div>
  );
}
