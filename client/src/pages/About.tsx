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
            { icon: Target, title: "Our Mission", body: "To provide independent professionals with a focused workspace for client management, owner-reviewed workflows, and decision-support context." },
            { icon: Heart, title: "Our Values", body: "Clarity over complexity. We design features to reduce avoidable administrative friction while keeping owner decisions visible." },
            { icon: Shield, title: "Our Product Boundary", body: "Available workflows use workspace-scoped access and owner-controlled sharing. Data practices remain subject to the reviewed public privacy policy before launch." },
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
            <p>Independent professionals can encounter fragmented workflows across scheduling, invoicing, client records, follow-ups, and spreadsheets. TrueAxis HQ is designed to bring relevant workflow context into one workspace.</p>
            <p>The name reflects the product’s intent: a <em>true axis</em> is a reference point. TrueAxis HQ provides an owner-controlled place to review clients, bookings, invoices, job progress, and follow-up drafts without representing that those tools act on their own.</p>
            <p>The product is built around three principles. AI-assisted tools can help draft and summarize where enabled; owner-visible signals can support review; and operational records should remain understandable rather than hidden behind automation. Owners remain responsible for decisions and should verify outcomes in their own workspace.</p>
            <p>TrueAxis HQ is designed for coaches, consultants, designers, developers, fitness professionals, and other independent service businesses that want a clearer way to manage client work. The product brings workflow information into one workspace so owners can make decisions from their own data.</p>
          </div>
        </div>
      </section>

      {/* Product principles */}
      <section className="py-12 px-4" style={{ background: "#F2F0EC" }}>
        <div className="container max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-px rounded-xl overflow-hidden" style={{ background: "rgba(232,160,32,0.08)" }}>
          {[
            { icon: Users, value: "Clients", label: "Relationships in context" },
            { icon: Clock, value: "Jobs", label: "Work organized by status" },
            { icon: TrendingUp, value: "Insights", label: "Signals for owner decisions" },
            { icon: Shield, value: "Privacy", label: "Workspace-scoped access" },
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
              "Independent professionals can use focused workflows to review client, job, and billing context in one workspace.",
              "AI-assisted tools can help draft and organize where enabled; owners remain responsible for reviewing decisions and outcomes.",
              "Workspace records are designed to be owner-scoped. Data practices and ownership terms require reviewed public policies before launch.",
              "A clear workspace can make operational context easier to review without promising a particular business outcome.",
              "Clarity is a feature. Available numbers, alerts, and suggestions are intended to help owners review their own information.",
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
          <p className="mt-3 mb-8" style={{ color: "rgba(26,26,26,0.75)" }}>Create an account to explore the TrueAxis HQ workspace.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => isAuthenticated ? navigate("/dashboard") : navigate("/register")} className="btn-amber" style={{ fontSize: "0.9375rem" }}>
              Create Account
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
