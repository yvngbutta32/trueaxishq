import { TRUEAXIS_LOGO_URL } from "@shared/const";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { Target, Heart, Shield, CheckCircle, ArrowLeft, TrendingUp, Users, Clock } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function About() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  useEffect(() => { document.title = "About — TrueAxis HQ"; }, []);

  return (
    <div style={{ background: "#F7F6F3", minHeight: "100vh", color: "#1A1A1A" }}>
      {/* Nav */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-4"
        style={{ background: "rgba(247,246,243,0.97)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(221,219,215,0.80)" }}
      >
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm font-medium animated-underline"
          style={{ color: "rgba(26,26,26,0.70)", background: "rgba(26,26,26,0.05)", border: "1px solid rgba(26,26,26,0.12)", borderRadius: "0.5rem", padding: "0.35rem 0.75rem", cursor: "pointer", minHeight: "auto", minWidth: "auto" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", minHeight: "auto", minWidth: "auto" }} aria-label="Go to homepage">
          <img
            src={TRUEAXIS_LOGO_URL}
            alt="TrueAxis HQ"
            className="h-8 w-auto object-contain"
          />
        </button>
        <button onClick={() => navigate("/pricing")} className="btn-amber" style={{ padding: "0.4rem 1rem", fontSize: "0.8125rem" }}>
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
            The Operating System for Independent Professionals
          </div>
          <h1 style={{ fontWeight: 800, fontSize: "clamp(2rem, 4.5vw, 3.5rem)", letterSpacing: "-0.03em", color: "#1A1A1A", lineHeight: 1.1 }}>
            Your business deserves<br />
            <span style={{ color: "#D4922A" }}>a true axis.</span>
          </h1>
          <p className="mt-6 text-lg max-w-2xl mx-auto" style={{ color: "rgba(26,26,26,0.50)", lineHeight: 1.7 }}>
            TrueAxis HQ is the command center built for freelancers, coaches, and consultants who are serious about running a real business — not just surviving one project at a time.
          </p>
        </div>
      </section>

      {/* Mission / Values / Promise */}
      <section className="py-12 px-4" style={{ background: "#F2F0EC" }}>
        <div className="container max-w-5xl mx-auto grid md:grid-cols-3 gap-5">
          {[
            { icon: Target, title: "Our Mission", body: "To give every independent professional the operational backbone of a full agency — AI-powered automation, smart client management, and real-time business intelligence — in a single, focused platform." },
            { icon: Heart, title: "Our Values", body: "Clarity over complexity. Speed over ceremony. We build every feature with one question in mind: does this give our users more time to do the work they actually love?" },
            { icon: Shield, title: "Our Promise", body: "Your data is yours — full stop. We will never sell it, share it, or hold it hostage. TrueAxis HQ is the engine under your business. You own the business." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="retro-card p-6">
              <div className="w-10 h-10 rounded flex items-center justify-center mb-4" style={{ background: "rgba(232,160,32,0.08)", border: "1px solid rgba(232,160,32,0.18)" }}>
                <Icon className="w-5 h-5" style={{ color: "#D4922A" }} />
              </div>
              <h2 style={{ fontWeight: 700, fontSize: "1.0625rem", color: "#1A1A1A", marginBottom: "0.5rem" }}>{title}</h2>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(26,26,26,0.75)" }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Story */}
      <section className="py-14 px-4" style={{ background: "#F7F6F3" }}>
        <div className="container max-w-3xl mx-auto">
          <div className="section-label mb-3 text-center">The Story</div>
          <h2 style={{ fontWeight: 800, fontSize: "clamp(1.6rem, 3vw, 2.25rem)", color: "#1A1A1A", letterSpacing: "-0.025em", textAlign: "center", marginBottom: "2rem" }}>
            Why TrueAxis HQ exists
          </h2>
          <div className="space-y-5 text-base leading-relaxed" style={{ color: "rgba(26,26,26,0.85)" }}>
            <p>Most freelancers and independent professionals are running their business on a stack of disconnected tools — a scheduling app here, an invoicing tool there, a CRM they barely use, and a spreadsheet holding everything together with duct tape. They're paying for five platforms that don't talk to each other, and spending 15 to 20 hours a week on admin work that should take minutes.</p>
            <p>TrueAxis HQ was built to end that. The name says it all: a <em>true axis</em> is the fixed center point everything else rotates around. That's what your business needs — one intelligent hub where clients, bookings, invoices, follow-ups, and analytics all live and work together automatically.</p>
            <p>We built the platform around three convictions. First, that AI should do the grunt work — drafting follow-up emails, flagging at-risk clients, detecting overdue invoices — so you never have to think about it. Second, that your business data should give you real insight, not just raw numbers. And third, that the best software feels invisible: it runs in the background, keeps everything moving, and only surfaces when you need it.</p>
            <p>TrueAxis HQ is used by coaches, consultants, designers, developers, fitness professionals, and legal practitioners who are serious about building a sustainable independent business. Our users consistently report reclaiming 10 to 15 hours a week and growing their revenue within the first few months — not because they worked harder, but because their business finally started working for them.</p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-4" style={{ background: "#F2F0EC" }}>
        <div className="container max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-px rounded-xl overflow-hidden" style={{ background: "rgba(232,160,32,0.08)" }}>
          {[
            { icon: Users, value: "4,200+", label: "Active Users" },
            { icon: Clock, value: "12 hrs", label: "Saved Per Week" },
            { icon: TrendingUp, value: "34%", label: "Avg Revenue Increase" },
            { icon: Shield, value: "99.9%", label: "Uptime SLA" },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex flex-col items-center justify-center py-10 px-6 text-center" style={{ background: "#F7F6F3" }}>
              <Icon className="w-5 h-5 mb-3" style={{ color: "rgba(232,160,32,0.50)" }} />
              <p className="stat-number text-3xl mb-1">{value}</p>
              <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "rgba(26,26,26,0.65)" }}>{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What We Believe */}
      <section className="py-14 px-4" style={{ background: "#F7F6F3" }}>
        <div className="container max-w-3xl mx-auto">
          <div className="section-label mb-3 text-center">Our Principles</div>
          <h2 style={{ fontWeight: 800, fontSize: "clamp(1.6rem, 3vw, 2.25rem)", color: "#1A1A1A", letterSpacing: "-0.025em", textAlign: "center", marginBottom: "2rem" }}>
            What we believe
          </h2>
          <ul className="space-y-3">
            {[
              "Independent professionals deserve the same operational leverage as a 10-person agency — at a price that makes sense for a solo business.",
              "AI should handle the repetitive work. You should handle the relationships and the craft.",
              "Your data belongs to you. We are the engine, not the owner.",
              "A great platform should make your business feel calm and in control — not like another thing to manage.",
              "Clarity is a feature. Every number, every alert, every suggestion in TrueAxis HQ exists to help you make a better decision faster.",
            ].map(belief => (
              <li key={belief} className="retro-card flex items-start gap-3 p-4">
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#D4922A" }} />
                <span className="text-sm leading-relaxed" style={{ color: "rgba(26,26,26,0.60)" }}>{belief}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 px-4 text-center relative overflow-hidden" style={{ background: "#F2F0EC" }}>
        <div className="absolute inset-0 retro-grid opacity-25 pointer-events-none" />
        <div className="container relative z-10 max-w-xl mx-auto">
          <h2 style={{ fontWeight: 800, fontSize: "clamp(1.6rem, 3vw, 2.25rem)", color: "#1A1A1A", letterSpacing: "-0.025em" }}>
            Ready to join us?
          </h2>
          <p className="mt-3 mb-8" style={{ color: "rgba(26,26,26,0.75)" }}>Start your free 14-day trial. No credit card required.</p>
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
      <footer className="py-8 px-4 text-center text-xs" style={{ borderTop: "1px solid rgba(232,160,32,0.08)", color: "rgba(26,26,26,0.20)" }}>
        <p>© {new Date().getFullYear()} TrueAxis HQ. All rights reserved.</p>
      </footer>
    </div>
  );
}
