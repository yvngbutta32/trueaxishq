/* TrueAxis HQ — Landing Page
 * Design: "Dark Amber Retro-Modern" — Charcoal #141414, Amber #E8A020, Cream #F5F0E8
 * Fonts: Space Grotesk (headings) + DM Sans (body)
 * All functions intact: email capture, onboarding modal, smooth scroll, animated counters
 */

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Zap, Calendar, FileText, Mail, BarChart3, Users,
  ArrowRight, CheckCircle, Star, Menu, X, Sparkles,
  TrendingUp, Brain, Activity, Target
} from "lucide-react";

// ─── Animated Counter ────────────────────────────────────────────────────────
function AnimatedCounter({ end, suffix = "", duration = 2000 }: { end: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const startTime = Date.now();
        const timer = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setCount(Math.floor(eased * end));
          if (progress >= 1) { setCount(end); clearInterval(timer); }
        }, 16);
      }
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return <span ref={ref} aria-label={`${end.toLocaleString()}${suffix}`}>{count.toLocaleString()}{suffix}</span>;
}

// ─── Onboarding Modal ─────────────────────────────────────────────────────────
function OnboardingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: "", email: "", business: "", service: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const firstInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const captureLead = trpc.leads.capture.useMutation();

  useEffect(() => {
    if (open) setTimeout(() => firstInputRef.current?.focus(), 50);
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, input, select, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (step === 0) {
      if (!form.name.trim()) errs.name = "Name is required";
      if (!form.email.trim()) errs.email = "Email is required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Enter a valid email";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const steps = [
    {
      title: "Welcome to TrueAxis HQ",
      subtitle: "Your business command center. Set up in 60 seconds.",
      content: (
        <div className="space-y-4">
          <div>
            <label htmlFor="ob-name" className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#E8A020" }}>
              Your Name <span aria-hidden="true">*</span>
            </label>
            <input
              id="ob-name"
              ref={firstInputRef}
              value={form.name}
              onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setErrors(p => ({ ...p, name: "" })); }}
              placeholder="Alex Johnson"
              autoComplete="name"
              aria-required="true"
              aria-invalid={!!errors.name}
              className="form-input"
              style={errors.name ? { borderColor: "#C85A3A" } : {}}
            />
            {errors.name && <p role="alert" className="text-xs mt-1" style={{ color: "#C85A3A" }}>{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="ob-email" className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#E8A020" }}>
              Email Address <span aria-hidden="true">*</span>
            </label>
            <input
              id="ob-email"
              type="email"
              value={form.email}
              onChange={e => { setForm(p => ({ ...p, email: e.target.value })); setErrors(p => ({ ...p, email: "" })); }}
              placeholder="alex@yourcompany.com"
              autoComplete="email"
              aria-required="true"
              aria-invalid={!!errors.email}
              className="form-input"
              style={errors.email ? { borderColor: "#C85A3A" } : {}}
            />
            {errors.email && <p role="alert" className="text-xs mt-1" style={{ color: "#C85A3A" }}>{errors.email}</p>}
          </div>
        </div>
      ),
    },
    {
      title: "About Your Business",
      subtitle: "Help us personalize your experience.",
      content: (
        <div className="space-y-4">
          <div>
            <label htmlFor="ob-business" className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#E8A020" }}>
              Business Name
            </label>
            <input
              id="ob-business"
              ref={firstInputRef}
              value={form.business}
              onChange={e => setForm(p => ({ ...p, business: e.target.value }))}
              placeholder="Your Studio / Practice Name"
              autoComplete="organization"
              className="form-input"
            />
          </div>
          <div>
            <label htmlFor="ob-service" className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#E8A020" }}>
              What do you do?
            </label>
            <select
              id="ob-service"
              value={form.service}
              onChange={e => setForm(p => ({ ...p, service: e.target.value }))}
              className="form-input"
            >
              <option value="">Select your field</option>
              <option>Life / Business Coach</option>
              <option>Consultant</option>
              <option>Designer / Creative</option>
              <option>Developer / Engineer</option>
              <option>Fitness / Wellness</option>
              <option>Legal / Financial</option>
              <option>Photographer / Videographer</option>
              <option>Other</option>
            </select>
          </div>
        </div>
      ),
    },
    {
      title: "You're All Set",
      subtitle: "Your TrueAxis HQ command center is ready.",
      content: (
        <div className="text-center py-4 space-y-5">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(232,160,32,0.12)", border: "1px solid rgba(232,160,32,0.25)" }}>
            <CheckCircle className="w-8 h-8" style={{ color: "#E8A020" }} />
          </div>
          <div>
            <p className="font-bold text-lg" style={{ fontFamily: "Space Grotesk, sans-serif", color: "#F5F0E8" }}>
              Welcome{form.name ? `, ${form.name.split(" ")[0]}` : ""}!
            </p>
            <p className="text-sm mt-1" style={{ color: "rgba(245,240,232,0.45)" }}>
              14-day free trial · No credit card required
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {["Client CRM", "AI Scheduling", "Smart Invoices", "Client Pulse AI"].map(f => (
              <div key={f} className="rounded p-2 text-center flex items-center justify-center gap-1.5" style={{ background: "rgba(232,160,32,0.07)", border: "1px solid rgba(232,160,32,0.15)", color: "#E8A020" }}>
                <CheckCircle className="w-3 h-3" />
                {f}
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ];

  const current = steps[step];

  const handleNext = async () => {
    if (!validate()) return;
    if (step === 1 && form.email) {
      try { await captureLead.mutateAsync({ email: form.email, name: form.name, source: "onboarding-modal" }); }
      catch { /* silent */ }
    }
    if (step < steps.length - 1) {
      setStep(s => s + 1);
    } else {
      onClose();
      navigate("/dashboard");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="ob-title">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(8px)" }} onClick={onClose} aria-hidden="true" />
      <div ref={modalRef} className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl" style={{ background: "#1E1E1E", border: "1px solid rgba(232,160,32,0.20)", boxShadow: "0 32px 80px rgba(0,0,0,0.60)" }}>
        {/* Top accent line */}
        <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg, transparent, #E8A020, transparent)" }} />

        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-0">
          <div>
            <div className="section-label mb-2">Step {step + 1} of {steps.length}</div>
            <h2 id="ob-title" style={{ fontFamily: "Space Grotesk, sans-serif", color: "#F5F0E8", fontSize: "1.25rem", fontWeight: 700 }}>
              {current.title}
            </h2>
            <p className="text-sm mt-1" style={{ color: "rgba(245,240,232,0.45)" }}>{current.subtitle}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded" style={{ color: "rgba(245,240,232,0.35)", background: "none", border: "none", minHeight: "auto", minWidth: "auto" }} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 pt-4">
          <div className="h-1 rounded-full" style={{ background: "rgba(245,240,232,0.06)" }}>
            <div className="h-1 rounded-full transition-all duration-500" style={{ width: `${((step + 1) / steps.length) * 100}%`, background: "linear-gradient(90deg, #E8A020, #F5C842)" }} />
          </div>
        </div>

        {/* Body */}
        <div className="p-6">{current.content}</div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} className="btn-ghost flex-1" style={{ fontSize: "0.875rem" }}>
              Back
            </button>
          )}
          <button onClick={handleNext} className="btn-amber flex-1" style={{ fontSize: "0.875rem" }} disabled={captureLead.isPending}>
            {step < steps.length - 1 ? "Continue" : "Enter Dashboard"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav({ onCTA }: { onCTA: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const links = [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Pricing", href: "/pricing" },
    { label: "About", href: "/about" },
  ];

  const handleLink = (href: string) => {
    setMobileOpen(false);
    if (href.startsWith("#")) {
      document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate(href);
    }
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(10,10,10,0.96)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(232,160,32,0.12)" : "1px solid transparent",
      }}
      aria-label="Main navigation"
    >
      <div className="container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2"
            aria-label="TrueAxis HQ — home"
            style={{ background: "none", border: "none", minHeight: "auto", minWidth: "auto" }}
          >
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/logo-r1_d9d437c8.png"
              alt="TrueAxis HQ"
              className="h-9 w-auto object-contain"
            />
          </button>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6">
            {links.map(l => (
              <button
                key={l.label}
                onClick={() => handleLink(l.href)}
                className="animated-underline text-sm font-medium"
                style={{ color: "rgba(245,240,232,0.65)", background: "none", border: "none", minHeight: "auto", minWidth: "auto" }}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => navigate("/login")}
              className="text-sm font-medium"
              style={{ color: "rgba(245,240,232,0.50)", background: "none", border: "none", minHeight: "auto", minWidth: "auto" }}
            >
              Sign In
            </button>
            <button onClick={onCTA} className="btn-amber" style={{ padding: "0.5rem 1.25rem", fontSize: "0.875rem" }}>
              Start Free Trial
            </button>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 rounded"
            onClick={() => setMobileOpen(o => !o)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            style={{ color: "#F5F0E8", background: "none", border: "none" }}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu — animated slide-down */}
      <div
        style={{
          background: "rgba(10,10,10,0.98)",
          borderTop: mobileOpen ? "1px solid rgba(232,160,32,0.12)" : "none",
          maxHeight: mobileOpen ? "400px" : "0",
          overflow: "hidden",
          transition: "max-height 0.28s cubic-bezier(0.4,0,0.2,1), border-top 0.28s ease",
        }}
        aria-hidden={!mobileOpen}
      >
        <div className="container py-4 flex flex-col gap-1">
          {links.map(l => (
            <button
              key={l.label}
              onClick={() => handleLink(l.href)}
              className="text-left py-3 px-2 text-sm font-medium rounded"
              style={{ color: "rgba(245,240,232,0.75)", background: "none", border: "none", minHeight: "auto" }}
            >
              {l.label}
            </button>
          ))}
          <div className="pt-3 flex flex-col gap-2" style={{ borderTop: "1px solid rgba(232,160,32,0.10)" }}>
            <button onClick={() => { setMobileOpen(false); navigate("/login"); }} className="btn-ghost w-full" style={{ fontSize: "0.875rem" }}>
              Sign In
            </button>
            <button onClick={() => { setMobileOpen(false); onCTA(); }} className="btn-amber w-full" style={{ fontSize: "0.875rem" }}>
              Start Free Trial
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ onCTA }: { onCTA: () => void }) {
  const [, navigate] = useLocation();

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden retro-grid" style={{ paddingTop: "4rem" }} aria-labelledby="hero-heading">
      {/* Radial amber glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 60% at 65% 40%, rgba(232,160,32,0.09) 0%, transparent 70%)" }} />
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none" style={{ background: "linear-gradient(to bottom, transparent, #141414)" }} />

      <div className="container relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center py-20">
          {/* Left — copy */}
          <div>
            <div className="pill-retro mb-6 inline-flex">
              <Sparkles className="w-3 h-3" />
              AI-Powered Business OS for Freelancers
            </div>

            <h1
              id="hero-heading"
              className="mb-6"
              style={{
                fontFamily: "Space Grotesk, sans-serif",
                fontWeight: 800,
                fontSize: "clamp(2.4rem, 5vw, 3.75rem)",
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                color: "#F5F0E8",
              }}
            >
              Your Business,{" "}
              <span className="shimmer-text">Running Itself</span>
            </h1>

            <p className="mb-8 max-w-lg" style={{ fontSize: "1.125rem", color: "rgba(245,240,232,0.55)", lineHeight: 1.7 }}>
              TrueAxis HQ handles your client intake, scheduling, invoicing, and follow-ups — so you can focus on the work you love and scale to{" "}
              <strong style={{ color: "#F5F0E8" }}>$100K/year</strong>.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <button onClick={onCTA} className="btn-amber">
                Start Free — 14 Days
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => document.querySelector("#how-it-works")?.scrollIntoView({ behavior: "smooth" })}
                className="btn-ghost"
              >
                See How It Works
              </button>
            </div>

            {/* Social proof counter */}
            <div className="flex items-center gap-3 mb-6 p-3 rounded-xl" style={{ background: "rgba(232,160,32,0.06)", border: "1px solid rgba(232,160,32,0.14)" }}>
              <div className="flex -space-x-2">
                {["#6366F1", "#E8A020", "#5A9A7A", "#FF6B6B"].map((c, i) => (
                  <div key={i} className="w-7 h-7 rounded-full border-2 border-[#141414] flex items-center justify-center text-white text-[9px] font-bold" style={{ background: c }}>U{i + 1}</div>
                ))}
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: "#F5F0E8" }}>Trusted by 4,200+ freelancers</p>
                <p className="text-[10px]" style={{ color: "rgba(245,240,232,0.45)" }}>Coaches · Designers · Consultants · Developers</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: "rgba(245,240,232,0.35)" }}>
              {["No credit card required", "Cancel anytime", "30-day money-back guarantee"].map(t => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" style={{ color: "#E8A020" }} />
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right — dashboard preview */}
          <div className="relative hidden lg:block">
            <div className="absolute inset-0 rounded-2xl glow-amber opacity-30 blur-xl" />
            <div className="relative rounded-2xl overflow-hidden scanlines" style={{ background: "#1E1E1E", border: "1px solid rgba(232,160,32,0.22)", boxShadow: "0 32px 80px rgba(0,0,0,0.60)" }}>
              {/* Window bar */}
              <div className="flex items-center gap-2 px-4 py-3" style={{ background: "#272727", borderBottom: "1px solid rgba(232,160,32,0.10)" }}>
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#C85A3A" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#E8A020" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#7A9A8A" }} />
                <span className="ml-3 text-xs font-mono" style={{ color: "rgba(245,240,232,0.25)" }}>TrueAxis HQ — Dashboard</span>
              </div>

              <div className="p-5 space-y-4">
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "MRR", value: "$8,240", change: "+12%" },
                    { label: "Clients", value: "34", change: "+3 this mo" },
                    { label: "Pulse Score", value: "87", change: "Healthy" },
                  ].map(s => (
                    <div key={s.label} className="rounded-lg p-3" style={{ background: "#272727", border: "1px solid rgba(232,160,32,0.08)" }}>
                      <div className="text-xs mb-1" style={{ color: "rgba(245,240,232,0.35)" }}>{s.label}</div>
                      <div className="font-bold text-sm" style={{ fontFamily: "Space Grotesk, sans-serif", color: "#F5F0E8" }}>{s.value}</div>
                      <div className="text-xs mt-0.5" style={{ color: "#E8A020" }}>{s.change}</div>
                    </div>
                  ))}
                </div>

                {/* Pulse list */}
                <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(232,160,32,0.10)" }}>
                  <div className="px-3 py-2 flex items-center justify-between" style={{ background: "#272727", borderBottom: "1px solid rgba(232,160,32,0.08)" }}>
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(245,240,232,0.40)" }}>Client Pulse AI</span>
                    <span className="tag tag-amber">Live</span>
                  </div>
                  {[
                    { name: "Sarah Chen", score: 94, status: "Upsell Ready", color: "#E8A020" },
                    { name: "Marcus Lee", score: 62, status: "Going Silent", color: "#7A9A8A" },
                    { name: "Priya Patel", score: 28, status: "Churn Risk", color: "#C85A3A" },
                  ].map(c => (
                    <div key={c.name} className="px-3 py-2.5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(232,160,32,0.05)" }}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "rgba(232,160,32,0.12)", color: "#E8A020" }}>
                          {c.name[0]}
                        </div>
                        <span className="text-sm" style={{ color: "#F5F0E8" }}>{c.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold" style={{ color: c.color, fontFamily: "Space Grotesk, sans-serif" }}>{c.score}</span>
                        <span className="tag" style={{ background: `${c.color}18`, color: c.color, border: `1px solid ${c.color}28`, fontSize: "0.60rem" }}>{c.status}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* AI suggestion */}
                <div className="rounded-lg p-3 flex items-start gap-3" style={{ background: "rgba(232,160,32,0.05)", border: "1px solid rgba(232,160,32,0.14)" }}>
                  <Brain className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#E8A020" }} />
                  <div>
                    <div className="text-xs font-bold mb-0.5" style={{ color: "#E8A020" }}>AI Suggestion</div>
                    <div className="text-xs" style={{ color: "rgba(245,240,232,0.50)" }}>Priya hasn't booked in 47 days. Draft a re-engagement email?</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Ticker Bar ───────────────────────────────────────────────────────────────
function TickerBar() {
  const items = [
    "4,200+ Freelancers", "12 hrs saved/week", "$2.4M invoiced", "AI-Powered CRM",
    "Client Pulse™", "Zero-Overhead Billing", "Smart Follow-Ups", "Live Analytics",
    "14-Day Free Trial", "No Credit Card", "Cancel Anytime", "GDPR Compliant",
  ];
  const doubled = [...items, ...items];

  return (
    <div
      className="relative overflow-hidden py-3"
      style={{ background: "rgba(232,160,32,0.05)", borderTop: "1px solid rgba(232,160,32,0.10)", borderBottom: "1px solid rgba(232,160,32,0.10)" }}
      aria-hidden="true"
    >
      <div className="marquee-track">
        {doubled.map((item, i) => (
          <span key={i} className="flex items-center gap-3 px-6 whitespace-nowrap text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(232,160,32,0.60)" }}>
            <span style={{ color: "#E8A020" }}>◆</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────
function StatsBar() {
  const stats = [
    { label: "Freelancers Onboard", value: 4200, suffix: "+" },
    { label: "Hours Saved Weekly", value: 12, suffix: " hrs avg" },
    { label: "Invoices Processed", value: 2400000, suffix: "+" },
    { label: "Avg Revenue Increase", value: 34, suffix: "%" },
  ];

  return (
    <section className="py-12" style={{ background: "#0E0E0E" }}>
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-xl overflow-hidden" style={{ background: "rgba(232,160,32,0.08)" }}>
          {stats.map((s, i) => (
            <div key={i} className="flex flex-col items-center justify-center py-10 px-6 text-center" style={{ background: "#141414" }}>
              <div className="stat-number text-4xl md:text-5xl mb-2">
                <AnimatedCounter end={s.value} suffix={s.suffix} />
              </div>
              <div className="text-xs uppercase tracking-widest font-semibold" style={{ color: "rgba(245,240,232,0.35)" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────
function FeaturesSection() {
  const features = [
    { icon: Users, title: "Client CRM", description: "Full client profiles with notes, history, revenue tracking, and custom tags. Everything in one place.", tag: "Core", highlight: false },
    { icon: Calendar, title: "Smart Scheduling", description: "Public booking page, calendar management, and automated reminders. Clients book themselves.", tag: "Core", highlight: false },
    { icon: FileText, title: "Invoicing", description: "Create, send, and track invoices. Mark paid, export PDFs, and see overdue alerts instantly.", tag: "Core", highlight: false },
    { icon: Mail, title: "AI Follow-Ups", description: "LLM-generated personalized follow-up emails for every client. Review and send in one click.", tag: "AI", highlight: false },
    { icon: BarChart3, title: "Live Analytics", description: "MRR, ARR, booking trends, and revenue forecasts. Real-time charts from your actual data.", tag: "Core", highlight: false },
    { icon: Brain, title: "Client Pulse AI™", description: "Proprietary relationship health scoring. Detects churn risk, upsell signals, and going-silent clients before it's too late.", tag: "Exclusive", highlight: true },
  ];

  return (
    <section id="features" className="py-16" style={{ background: "#141414" }}>
      <div className="container">
        <div className="text-center mb-10">
          <div className="section-label mb-3">Platform Features</div>
          <h2 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 800, fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)", color: "#F5F0E8", letterSpacing: "-0.025em" }}>
            Stop juggling five different tools.
          </h2>
          <p className="mt-4 max-w-xl mx-auto" style={{ color: "rgba(245,240,232,0.45)", fontSize: "1.0625rem" }}>
            TrueAxis HQ replaces your scheduling app, invoicing software, CRM, and email tool — in one platform.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <div
              key={i}
              className={`retro-card card-lift p-6 ${f.highlight ? "glow-amber-sm" : ""}`}
              style={f.highlight ? { borderColor: "rgba(232,160,32,0.28)", background: "rgba(232,160,32,0.03)" } : {}}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded flex items-center justify-center" style={{ background: f.highlight ? "rgba(232,160,32,0.12)" : "rgba(245,240,232,0.05)", border: `1px solid ${f.highlight ? "rgba(232,160,32,0.22)" : "rgba(245,240,232,0.07)"}` }}>
                  <f.icon className="w-5 h-5" style={{ color: f.highlight ? "#E8A020" : "rgba(245,240,232,0.55)" }} />
                </div>
                <span
                  className="tag"
                  style={
                    f.tag === "Exclusive"
                      ? { background: "rgba(232,160,32,0.12)", color: "#E8A020", border: "1px solid rgba(232,160,32,0.25)" }
                      : f.tag === "AI"
                      ? { background: "rgba(90,122,106,0.12)", color: "#7A9A8A", border: "1px solid rgba(90,122,106,0.25)" }
                      : { background: "rgba(245,240,232,0.05)", color: "rgba(245,240,232,0.35)", border: "1px solid rgba(245,240,232,0.08)" }
                  }
                >
                  {f.tag}
                </span>
              </div>
              <h3 className="font-bold mb-2" style={{ fontFamily: "Space Grotesk, sans-serif", color: "#F5F0E8", fontSize: "1.0625rem" }}>
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(245,240,232,0.45)" }}>
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────
function HowItWorksSection() {
  const steps = [
    { number: "01", title: "Set Up in Minutes", description: "Create your profile, add your services, and configure your booking page. Your business is live in under 10 minutes.", icon: Zap },
    { number: "02", title: "Clients Book Themselves", description: "Share your TrueAxis booking link. Clients choose their service, pick a time, and confirm — no back-and-forth.", icon: Calendar },
    { number: "03", title: "AI Handles the Rest", description: "Invoices are generated automatically. Follow-ups are drafted by AI. Client Pulse monitors every relationship.", icon: Brain },
    { number: "04", title: "Watch Your Revenue Grow", description: "Analytics track MRR, booking trends, and client health. You get actionable insights, not just raw data.", icon: TrendingUp },
  ];

  return (
    <section id="how-it-works" className="py-16 relative" style={{ background: "#0E0E0E" }}>
      <div className="absolute inset-0 retro-grid opacity-40 pointer-events-none" />
      <div className="container relative z-10">
        <div className="text-center mb-10">
          <div className="section-label mb-3">How It Works</div>
          <h2 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 800, fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)", color: "#F5F0E8", letterSpacing: "-0.025em" }}>
            From signup to autopilot in 4 steps
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div key={i} className="retro-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 800, fontSize: "2rem", color: "rgba(232,160,32,0.18)", lineHeight: 1 }}>
                  {s.number}
                </span>
                <div className="w-9 h-9 rounded flex items-center justify-center" style={{ background: "rgba(232,160,32,0.08)", border: "1px solid rgba(232,160,32,0.18)" }}>
                  <s.icon className="w-4 h-4" style={{ color: "#E8A020" }} />
                </div>
              </div>
              <h3 className="font-bold mb-2" style={{ fontFamily: "Space Grotesk, sans-serif", color: "#F5F0E8", fontSize: "1rem" }}>
                {s.title}
              </h3>
              <p className="text-sm" style={{ color: "rgba(245,240,232,0.42)", lineHeight: 1.65 }}>
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Client Pulse Showcase ────────────────────────────────────────────────────
function ClientPulseShowcase() {
  const clients = [
    { name: "Sarah Chen", role: "Life Coach", score: 94, status: "Upsell Ready", color: "#E8A020", days: 2, revenue: "$3,200" },
    { name: "Marcus Lee", role: "Consultant", score: 62, status: "Going Silent", color: "#7A9A8A", days: 18, revenue: "$1,800" },
    { name: "Priya Patel", role: "Designer", score: 28, status: "Churn Risk", color: "#C85A3A", days: 47, revenue: "$950" },
    { name: "James Wu", role: "Developer", score: 81, status: "Healthy", color: "#5A9A7A", days: 5, revenue: "$4,100" },
  ];

  return (
    <section className="py-16" style={{ background: "#141414" }}>
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — copy */}
          <div>
            <div className="pill-retro mb-6 inline-flex">
              <Sparkles className="w-3 h-3" />
              Exclusive to TrueAxis HQ
            </div>
            <h2 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 800, fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)", color: "#F5F0E8", letterSpacing: "-0.025em", lineHeight: 1.1 }}>
              Client Pulse AI™
              <br />
              <span style={{ color: "#E8A020" }}>Know before they leave.</span>
            </h2>
            <p className="mt-4 mb-8" style={{ color: "rgba(245,240,232,0.50)", fontSize: "1.0625rem", lineHeight: 1.7 }}>
              Our proprietary AI engine scores every client relationship 0–100 in real time. It detects churn risk, identifies upsell opportunities, and drafts personalized re-engagement messages — automatically.
            </p>
            <div className="space-y-3">
              {[
                { icon: Activity, text: "8-signal health scoring: recency, bookings, revenue, response rate, and more" },
                { icon: Target, text: "Automatic risk classification: Churn Risk · Going Silent · Upsell Ready · Healthy" },
                { icon: Brain, text: "AI-drafted re-engagement emails queued in your Follow-Ups panel instantly" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(232,160,32,0.08)", border: "1px solid rgba(232,160,32,0.18)" }}>
                    <item.icon className="w-4 h-4" style={{ color: "#E8A020" }} />
                  </div>
                  <p className="text-sm" style={{ color: "rgba(245,240,232,0.55)", lineHeight: 1.65 }}>{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — live UI preview */}
          <div className="retro-card overflow-hidden" style={{ border: "1px solid rgba(232,160,32,0.18)" }}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ background: "#272727", borderBottom: "1px solid rgba(232,160,32,0.10)" }}>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" style={{ color: "#E8A020" }} />
                <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: "0.875rem", color: "#F5F0E8" }}>Client Pulse</span>
              </div>
              <span className="tag tag-amber">Live</span>
            </div>
            <div className="p-4 space-y-2">
              {clients.map((c, i) => (
                <div key={i} className="rounded-lg p-3 flex items-center gap-3" style={{ background: "#1E1E1E", border: "1px solid rgba(245,240,232,0.04)" }}>
                  {/* Score ring */}
                  <div className="relative w-10 h-10 flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(245,240,232,0.05)" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15" fill="none" stroke={c.color} strokeWidth="3" strokeDasharray={`${(c.score / 100) * 94.25} 94.25`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ fontFamily: "Space Grotesk, sans-serif", color: c.color }}>
                      {c.score}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm" style={{ fontFamily: "Space Grotesk, sans-serif", color: "#F5F0E8" }}>{c.name}</span>
                      <span className="tag" style={{ background: `${c.color}18`, color: c.color, border: `1px solid ${c.color}28`, fontSize: "0.58rem" }}>{c.status}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs" style={{ color: "rgba(245,240,232,0.30)" }}>{c.role}</span>
                      <span className="text-xs" style={{ color: "rgba(245,240,232,0.20)" }}>·</span>
                      <span className="text-xs" style={{ color: "rgba(245,240,232,0.30)" }}>{c.days}d ago</span>
                      <span className="text-xs" style={{ color: "rgba(245,240,232,0.20)" }}>·</span>
                      <span className="text-xs font-semibold" style={{ color: "#E8A020" }}>{c.revenue}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3" style={{ background: "rgba(232,160,32,0.03)", borderTop: "1px solid rgba(232,160,32,0.08)" }}>
              <div className="flex items-start gap-2">
                <Brain className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "#E8A020" }} />
                <p className="text-xs" style={{ color: "rgba(245,240,232,0.45)" }}>
                  <strong style={{ color: "#E8A020" }}>AI:</strong> Priya hasn't booked in 47 days. Her revenue is down 40%. Re-engagement email drafted and ready to send.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────
function TestimonialsSection() {
  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Life Coach",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&h=60&fit=crop",
      quote: "I used to spend 3 hours every Monday on admin. Now it's zero. TrueAxis HQ paid for itself in the first week.",
      revenue: "+$2,400/mo",
      stars: 5,
    },
    {
      name: "Marcus Thompson",
      role: "Business Consultant",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60&h=60&fit=crop",
      quote: "The Client Pulse feature is genuinely unlike anything I've seen. It told me a client was at risk before I even noticed.",
      revenue: "+$3,800/mo",
      stars: 5,
    },
    {
      name: "Priya Sharma",
      role: "UX Designer",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop",
      quote: "Invoicing used to be my least favorite part of freelancing. Now it takes 30 seconds. Clients actually pay faster too.",
      revenue: "+$1,900/mo",
      stars: 5,
    },
  ];

  return (
    <section className="py-12" style={{ background: "#0E0E0E" }}>
      <div className="container">
        <div className="text-center mb-8">
          <div className="section-label mb-3">What Freelancers Say</div>
          <h2 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 800, fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)", color: "#F5F0E8", letterSpacing: "-0.025em" }}>
            Join thousands who scaled with TrueAxis HQ.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className="retro-card card-lift p-6">
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-current" style={{ color: "#E8A020" }} />
                ))}
              </div>
              <blockquote className="text-sm leading-relaxed mb-5" style={{ color: "rgba(245,240,232,0.60)" }}>
                "{t.quote}"
              </blockquote>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={t.avatar} alt={t.name} className="w-9 h-9 rounded-full object-cover" style={{ border: "1px solid rgba(232,160,32,0.18)" }} />
                  <div>
                    <div className="text-sm font-semibold" style={{ fontFamily: "Space Grotesk, sans-serif", color: "#F5F0E8" }}>{t.name}</div>
                    <div className="text-xs" style={{ color: "rgba(245,240,232,0.35)" }}>{t.role}</div>
                  </div>
                </div>
                <span className="tag tag-amber">{t.revenue}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Email Capture / CTA ──────────────────────────────────────────────────────
function EmailCapture({ onCTA }: { onCTA: () => void }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const captureLead = trpc.leads.capture.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) { toast.error("Please enter a valid email address."); return; }
    try {
      await captureLead.mutateAsync({ email, source: "homepage-cta" });
      setSubmitted(true);
      toast.success("You're on the list! Check your inbox.");
    } catch {
      onCTA();
    }
  };

  return (
    <section className="py-12 relative overflow-hidden" style={{ background: "#141414" }}>
      <div className="absolute inset-0 retro-grid opacity-25 pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 80% at 50% 50%, rgba(232,160,32,0.06) 0%, transparent 70%)" }} />
      <div className="container relative z-10 text-center max-w-2xl mx-auto">
        <div className="section-label mb-4">Start Today</div>
        <h2 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 800, fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)", color: "#F5F0E8", letterSpacing: "-0.025em" }}>
          Your business command center is waiting.
        </h2>
        <p className="mt-4 mb-10" style={{ color: "rgba(245,240,232,0.45)", fontSize: "1.0625rem" }}>
          Join 4,200+ freelancers who automated their business with TrueAxis HQ. 14-day free trial. No credit card required.
        </p>

        {submitted ? (
          <div className="inline-flex items-center gap-3 px-6 py-4 rounded-lg" style={{ background: "rgba(232,160,32,0.08)", border: "1px solid rgba(232,160,32,0.22)" }}>
            <CheckCircle className="w-5 h-5" style={{ color: "#E8A020" }} />
            <span style={{ color: "#F5F0E8", fontFamily: "Space Grotesk, sans-serif", fontWeight: 600 }}>You're on the list — check your inbox!</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="form-input flex-1"
              aria-label="Email address"
              required
            />
            <button type="submit" className="btn-amber whitespace-nowrap" disabled={captureLead.isPending}>
              {captureLead.isPending ? "Saving…" : "Get Early Access"}
            </button>
          </form>
        )}

        <p className="mt-4 text-xs" style={{ color: "rgba(245,240,232,0.25)" }}>
          No spam. Unsubscribe anytime. We respect your privacy.
        </p>
      </div>
    </section>
  );
}

// ─── FAQ Section ─────────────────────────────────────────────────────────────
const HOME_FAQS = [
  { q: "Is TrueAxis HQ really free to start?", a: "Yes. The Free plan gives you unlimited clients, invoices, and bookings with no credit card required. You only upgrade when you need advanced features like AI automation, recurring invoices, and priority support." },
  { q: "How does the AI follow-up feature work?", a: "TrueAxis HQ analyzes each client's booking history, invoice activity, and engagement signals to generate a personalized follow-up email in one click. You review and send — the AI does the drafting." },
  { q: "Can I accept payments through TrueAxis HQ?", a: "Yes. Connect your Stripe account and your clients can pay invoices online via credit card. Payments are processed securely by Stripe — TrueAxis HQ never touches your funds." },
  { q: "Do I need to install anything?", a: "No. TrueAxis HQ is a fully web-based platform. It works on any device with a browser. You can also install it as a PWA (Progressive Web App) on your phone for a native app experience." },
  { q: "Can clients book appointments without creating an account?", a: "Yes. Your public booking page allows clients to schedule sessions without signing up. You get a unique URL (e.g. trueaxishq.com/book/yourname) to share on your website or social profiles." },
  { q: "What happens to my data if I cancel?", a: "Your data is always yours. You can export all clients, invoices, and bookings as CSV at any time. We retain your data for 30 days after cancellation in case you change your mind." },
];

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="py-20 px-6" style={{ background: "#141414" }}>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4" style={{ background: "rgba(232,160,32,0.12)", color: "#E8A020" }}>FAQ</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-3" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>Frequently Asked Questions</h2>
          <p className="text-gray-400 text-base">Everything you need to know before getting started.</p>
        </div>
        <div className="space-y-3">
          {HOME_FAQS.map((faq, i) => (
            <div key={i} className="rounded-2xl border overflow-hidden" style={{ borderColor: open === i ? "rgba(232,160,32,0.4)" : "rgba(255,255,255,0.08)", background: open === i ? "rgba(232,160,32,0.04)" : "rgba(255,255,255,0.03)" }}>
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                <span className="text-sm font-semibold text-white pr-4">{faq.q}</span>
                <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: open === i ? "#E8A020" : "rgba(255,255,255,0.1)" }}>
                  <span className="text-xs font-bold" style={{ color: open === i ? "#141414" : "#fff" }}>{open === i ? "−" : "+"}</span>
                </span>
              </button>
              {open === i && (
                <div className="px-5 pb-4">
                  <p className="text-sm text-gray-400 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-gray-500 mt-10">
          Still have questions? <a href="/contact" className="text-[#E8A020] hover:underline font-medium">Contact our team →</a>
        </p>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  const [, navigate] = useLocation();

  const sections = [
    {
      title: "Product",
      links: [
        { label: "Features", action: () => document.querySelector("#features")?.scrollIntoView({ behavior: "smooth" }) },
        { label: "Pricing", action: () => navigate("/pricing") },
        { label: "Dashboard", action: () => navigate("/dashboard") },
        { label: "Changelog", action: () => toast.info("Changelog coming soon") },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About", action: () => navigate("/about") },
        { label: "Contact", action: () => navigate("/contact") },
        { label: "Careers", action: () => { window.location.href = "mailto:careers@trueaxishq.com"; } },
        { label: "Press", action: () => { window.location.href = "mailto:press@trueaxishq.com"; } },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", action: () => navigate("/privacy") },
        { label: "Terms of Service", action: () => navigate("/terms") },
        { label: "Help Center", action: () => navigate("/help") },
        { label: "Security", action: () => toast.info("Security page coming soon") },
      ],
    },
  ];

  return (
    <footer style={{ background: "#0A0A0A", borderTop: "1px solid rgba(232,160,32,0.08)" }}>
      <div className="container py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-10 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center mb-4">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/logo-r1_d9d437c8.png"
                alt="TrueAxis HQ"
                className="h-9 w-auto object-contain"
              />
            </div>
            <p className="text-sm mb-4" style={{ color: "rgba(245,240,232,0.35)", lineHeight: 1.7 }}>
              The AI-powered business OS for freelancers and solo service professionals.
            </p>
            <div className="flex gap-2">
              {["T", "in", "IG"].map(s => (
                <button
                  key={s}
                  onClick={() => toast.info("Social links coming soon")}
                  className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold"
                  style={{ background: "rgba(245,240,232,0.05)", color: "rgba(245,240,232,0.35)", border: "1px solid rgba(245,240,232,0.07)", minHeight: "auto", minWidth: "auto" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {sections.map(sec => (
            <div key={sec.title}>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgba(245,240,232,0.25)" }}>
                {sec.title}
              </h4>
              <ul className="space-y-2.5">
                {sec.links.map(l => (
                  <li key={l.label}>
                    <button
                      onClick={l.action}
                      className="text-sm animated-underline"
                      style={{ color: "rgba(245,240,232,0.45)", background: "none", border: "none", minHeight: "auto", minWidth: "auto" }}
                    >
                      {l.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="amber-line mb-6" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" style={{ color: "rgba(245,240,232,0.22)" }}>
          <p>© {new Date().getFullYear()} TrueAxis HQ. All rights reserved.</p>
          <p>Built for the independent professional.</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div style={{ background: "#141414", minHeight: "100vh" }}>
      <Nav onCTA={() => setModalOpen(true)} />
      <Hero onCTA={() => setModalOpen(true)} />
      <TickerBar />
      <StatsBar />
      <FeaturesSection />
      <HowItWorksSection />
      <ClientPulseShowcase />
      <TestimonialsSection />
      <EmailCapture onCTA={() => setModalOpen(true)} />
      <FAQSection />
      <Footer />
      <OnboardingModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
