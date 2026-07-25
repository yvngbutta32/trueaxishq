/* SkillBridge AI — Landing Page
 * Design: Dark Navy + Amber — #0D1117 base, #D4922A amber, #F5EFE3 cream
 * Font: Inter (single family, variable)
 * All functions intact: email capture, onboarding modal, smooth scroll, animated counters
 */

import { useState, useEffect, useRef, useLayoutEffect } from "react";
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

  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
      title: "Welcome to SkillBridge AI",
      subtitle: "Your business command center. Set up in 60 seconds.",
      content: (
        <div className="space-y-4">
          <div>
            <label htmlFor="ob-name" className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#D4922A" }}>
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
            <label htmlFor="ob-email" className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#D4922A" }}>
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
            <label htmlFor="ob-business" className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#D4922A" }}>
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
            <label htmlFor="ob-service" className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#D4922A" }}>
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
      subtitle: "Your SkillBridge AI command center is ready.",
      content: (
        <div className="text-center py-4 space-y-5">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(232,160,32,0.12)", border: "1px solid rgba(232,160,32,0.25)" }}>
            <CheckCircle className="w-8 h-8" style={{ color: "#D4922A" }} />
          </div>
          <div>
            <p className="font-bold text-lg" style={{ color: "#1A1A1A" }}>
              Welcome{form.name ? `, ${form.name.split(" ")[0]}` : ""}!
            </p>
            <p className="text-sm mt-1" style={{ color: "rgba(26,26,26,0.75)" }}>
              14-day free trial · No credit card required
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {["Client CRM", "AI Scheduling", "Smart Invoices", "Client Pulse AI"].map(f => (
              <div key={f} className="rounded p-2 text-center flex items-center justify-center gap-1.5" style={{ background: "rgba(232,160,32,0.07)", border: "1px solid rgba(232,160,32,0.15)", color: "#D4922A" }}>
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
      // Redirect to register so users can create an account; they'll land on dashboard after auth
      navigate("/register");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="ob-title">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(8px)" }} onClick={onClose} aria-hidden="true" />
      <div ref={modalRef} className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl" style={{ background: "#F7F6F3", border: "1px solid rgba(232,160,32,0.20)", boxShadow: "0 32px 80px rgba(0,0,0,0.60)" }}>
        {/* Top accent line */}
        <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg, transparent, #D4922A, transparent)" }} />

        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-0">
          <div>
            <div className="section-label mb-2">Step {step + 1} of {steps.length}</div>
            <h2 id="ob-title" style={{ color: "#1A1A1A", fontSize: "1.25rem", fontWeight: 700 }}>
              {current.title}
            </h2>
            <p className="text-sm mt-1" style={{ color: "rgba(26,26,26,0.75)" }}>{current.subtitle}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded" style={{ color: "rgba(26,26,26,0.35)", background: "none", border: "none", minHeight: "auto", minWidth: "auto" }} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 pt-4">
          <div className="h-1 rounded-full" style={{ background: "rgba(26,26,26,0.06)" }}>
            <div className="h-1 rounded-full transition-all duration-500" style={{ width: `${((step + 1) / steps.length) * 100}%`, background: "linear-gradient(90deg, #D4922A, #F5C842)" }} />
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
        background: scrolled ? "rgba(27,45,79,0.96)" : "transparent",
        backdropFilter: scrolled ? "saturate(180%) blur(20px)" : "none",
        WebkitBackdropFilter: scrolled ? "saturate(180%) blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(212,146,42,0.14)" : "1px solid transparent",
        boxShadow: scrolled ? "0 1px 0 rgba(212,146,42,0.06)" : "none",
      }}
      aria-label="Main navigation"
    >
      <div className="container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2"
            aria-label="SkillBridge AI — home"
            style={{ background: "none", border: "none", minHeight: "auto", minWidth: "auto" }}
          >
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/logo-r1_d9d437c8.png"
              alt="SkillBridge AI"
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
                style={{ color: scrolled ? "rgba(255,255,255,0.80)" : "rgba(26,26,26,0.65)", background: "none", border: "none", minHeight: "auto", minWidth: "auto" }}
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
              style={{ color: "rgba(26,26,26,0.50)", background: "none", border: "none", minHeight: "auto", minWidth: "auto" }}
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
            style={{ color: "#1A1A1A", background: "none", border: "none" }}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu — animated slide-down */}
      <div
        style={{
          background: "rgba(247,246,243,0.98)",
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
              style={{ color: "rgba(26,26,26,0.70)", background: "none", border: "none", minHeight: "auto" }}
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
      <div className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none" style={{ background: "linear-gradient(to bottom, transparent, #F7F6F3)" }} />

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
                fontWeight: 800,
                fontSize: "clamp(2.4rem, 5vw, 3.75rem)",
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                color: "#1A1A1A",
              }}
            >
              Your Business,{" "}
              <span style={{ color: "#D4922A" }}>Running Itself</span>
            </h1>

            <p className="mb-8 max-w-lg" style={{ fontSize: "1.125rem", color: "rgba(26,26,26,0.55)", lineHeight: 1.7 }}>
              SkillBridge AI handles your client intake, scheduling, invoicing, and follow-ups — so you can focus on the work you love and scale to{" "}
              <strong style={{ color: "#1A1A1A" }}>$100K/year</strong>.
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
                {["#6366F1", "#D4922A", "#5A9A7A", "#FF6B6B"].map((c, i) => (
                  <div key={i} className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-[9px] font-bold" style={{ background: c }}>U{i + 1}</div>
                ))}
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: "#1A1A1A" }}>Trusted by 4,200+ freelancers</p>
                <p className="text-[10px]" style={{ color: "rgba(26,26,26,0.65)" }}>Coaches · Designers · Consultants · Developers</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: "rgba(26,26,26,0.65)" }}>
              {["No credit card required", "Cancel anytime", "30-day money-back guarantee"].map(t => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" style={{ color: "#D4922A" }} />
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right — dashboard preview */}
          <div className="relative hidden lg:block">
            <div className="absolute inset-0 rounded-xl glow-amber opacity-30 blur-xl" />
            <div className="relative rounded-xl overflow-hidden" style={{ background: "#F7F6F3", border: "1px solid rgba(212,146,42,0.20)", boxShadow: "0 24px 60px rgba(0,0,0,0.55)" }}>
              {/* Window bar */}
              <div className="flex items-center gap-2 px-4 py-3" style={{ background: "#EEECEA", borderBottom: "1px solid rgba(232,160,32,0.10)" }}>
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#C85A3A" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#D4922A" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#7A9A8A" }} />
                <span className="ml-3 text-xs font-mono" style={{ color: "rgba(26,26,26,0.55)" }}>SkillBridge AI — Dashboard</span>
              </div>

              <div className="p-4 space-y-3">
                {/* Revenue sparkline + stats row */}
                <div className="rounded-lg p-3" style={{ background: "#EEECEA", border: "1px solid rgba(212,146,42,0.10)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-xs" style={{ color: "rgba(26,26,26,0.55)" }}>Monthly Revenue</div>
                      <div className="font-bold text-base" style={{ color: "#1A1A1A", letterSpacing: "-0.02em" }}>$8,240</div>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: "rgba(30,107,69,0.15)", color: "#4ADE80" }}>↑ 12%</span>
                  </div>
                  {/* SVG sparkline */}
                  <svg viewBox="0 0 160 36" className="w-full" style={{ height: 36 }} aria-hidden="true">
                    <defs>
                      <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#D4922A" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#D4922A" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0 28 L20 24 L40 26 L60 18 L80 20 L100 12 L120 14 L140 8 L160 4" fill="none" stroke="#D4922A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M0 28 L20 24 L40 26 L60 18 L80 20 L100 12 L120 14 L140 8 L160 4 L160 36 L0 36 Z" fill="url(#spark-fill)" />
                  </svg>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Clients", value: "34", change: "+3" },
                    { label: "Invoiced", value: "$12.4k", change: "this mo" },
                    { label: "Pulse", value: "87", change: "Healthy" },
                  ].map(s => (
                    <div key={s.label} className="rounded-lg p-2.5" style={{ background: "#EEECEA", border: "1px solid rgba(212,146,42,0.08)" }}>
                      <div className="text-[10px] mb-0.5" style={{ color: "rgba(26,26,26,0.55)" }}>{s.label}</div>
                      <div className="font-bold text-sm" style={{ color: "#1A1A1A" }}>{s.value}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: "#D4922A" }}>{s.change}</div>
                    </div>
                  ))}
                </div>

                {/* Upcoming booking */}
                <div className="rounded-lg p-3 flex items-center gap-3" style={{ background: "#EEECEA", border: "1px solid rgba(212,146,42,0.10)" }}>
                  <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: "rgba(27,45,79,0.60)", border: "1px solid rgba(212,146,42,0.18)" }}>
                    <Calendar className="w-4 h-4" style={{ color: "#D4922A" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold" style={{ color: "#1A1A1A" }}>Strategy Session — Sarah Chen</div>
                    <div className="text-[10px] mt-0.5" style={{ color: "rgba(26,26,26,0.50)" }}>Today · 2:00 PM · 60 min</div>
                  </div>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(30,107,69,0.15)", color: "#4ADE80" }}>Confirmed</span>
                </div>

                {/* Recent invoice */}
                <div className="rounded-lg p-3 flex items-center gap-3" style={{ background: "#EEECEA", border: "1px solid rgba(212,146,42,0.10)" }}>
                  <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: "rgba(27,45,79,0.60)", border: "1px solid rgba(212,146,42,0.18)" }}>
                    <FileText className="w-4 h-4" style={{ color: "#D4922A" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold" style={{ color: "#1A1A1A" }}>INV-0042 · Marcus Thompson</div>
                    <div className="text-[10px] mt-0.5" style={{ color: "rgba(26,26,26,0.50)" }}>$1,800 · Due in 3 days</div>
                  </div>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(212,146,42,0.12)", color: "#D4922A" }}>Pending</span>
                </div>

                {/* AI suggestion */}
                <div className="rounded-lg p-3 flex items-start gap-2.5" style={{ background: "rgba(212,146,42,0.05)", border: "1px solid rgba(212,146,42,0.14)" }}>
                  <Brain className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "#D4922A" }} />
                  <div>
                    <div className="text-[10px] font-bold mb-0.5" style={{ color: "#D4922A" }}>AI Suggestion</div>
                    <div className="text-[10px]" style={{ color: "rgba(26,26,26,0.50)" }}>Priya hasn't booked in 47 days. Draft a re-engagement email?</div>
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
            <span style={{ color: "#D4922A" }}>◆</span>
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
    <section className="py-12" style={{ background: "#F2F0EC" }}>
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-xl overflow-hidden" style={{ background: "rgba(232,160,32,0.08)" }}>
          {stats.map((s, i) => (
            <div key={i} className="flex flex-col items-center justify-center py-10 px-6 text-center" style={{ background: "#F7F6F3" }}>
              <div className="stat-number text-4xl md:text-5xl mb-2">
                <AnimatedCounter end={s.value} suffix={s.suffix} />
              </div>
              <div className="text-xs uppercase tracking-widest font-semibold" style={{ color: "rgba(26,26,26,0.65)" }}>
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
    <section id="features" className="py-16" style={{ background: "#F7F6F3" }}>
      <div className="container">
        <div className="text-center mb-10">
          <div className="section-label mb-3">Platform Features</div>
          <h2 style={{ fontWeight: 800, fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)", color: "#1A1A1A", letterSpacing: "-0.025em" }}>
            Stop juggling five different tools.
          </h2>
          <p className="mt-4 max-w-xl mx-auto" style={{ color: "rgba(26,26,26,0.75)", fontSize: "1.0625rem" }}>
            SkillBridge AI replaces your scheduling app, invoicing software, CRM, and email tool — in one platform.
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
                <div className="w-10 h-10 rounded flex items-center justify-center" style={{ background: f.highlight ? "rgba(232,160,32,0.12)" : "rgba(26,26,26,0.05)", border: `1px solid ${f.highlight ? "rgba(232,160,32,0.22)" : "rgba(26,26,26,0.08)"}` }}>
                  <f.icon className="w-5 h-5" style={{ color: f.highlight ? "#D4922A" : "rgba(26,26,26,0.55)" }} />
                </div>
                <span
                  className="tag"
                  style={
                    f.tag === "Exclusive"
                      ? { background: "rgba(232,160,32,0.12)", color: "#D4922A", border: "1px solid rgba(232,160,32,0.25)" }
                      : f.tag === "AI"
                      ? { background: "rgba(90,122,106,0.12)", color: "#7A9A8A", border: "1px solid rgba(90,122,106,0.25)" }
                      : { background: "rgba(26,26,26,0.05)", color: "rgba(26,26,26,0.65)", border: "1px solid rgba(26,26,26,0.10)" }
                  }
                >
                  {f.tag}
                </span>
              </div>
              <h3 className="font-bold mb-2" style={{ color: "#1A1A1A", fontSize: "1.0625rem" }}>
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(26,26,26,0.75)" }}>
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works / Product Demo ─────────────────────────────────────────────
function HowItWorksSection() {
  const TAB_COUNT = 4;
  const [activeTab, setActiveTab] = useState(0);
  const [progress, setProgress] = useState(0);
  const INTERVAL = 4000;

  useEffect(() => {
    setProgress(0);
    const start = Date.now();
    const raf = requestAnimationFrame(function tick() {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / INTERVAL) * 100, 100);
      setProgress(pct);
      if (pct < 100) requestAnimationFrame(tick);
    });
    const timer = setTimeout(() => {
      setActiveTab(t => (t + 1) % TAB_COUNT);
    }, INTERVAL);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [activeTab]);

  const tabs = [
    {
      icon: Calendar,
      label: "Smart Booking",
      heading: "Clients book themselves.",
      body: "Share your booking link. Clients pick a service, choose a time, and confirm — no back-and-forth emails, no scheduling tools to manage.",
      panel: (
        <div className="space-y-3">
          <div className="rounded-lg p-3" style={{ background: "#EEECEA", border: "1px solid rgba(212,146,42,0.12)" }}>
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(26,26,26,0.45)" }}>This Week</div>
            {[
              { day: "Mon", time: "10:00 AM", client: "Sarah Chen", service: "Strategy Session", status: "Confirmed", statusColor: "#4ADE80" },
              { day: "Wed", time: "2:00 PM", client: "Marcus Lee", service: "Consulting Call", status: "Pending", statusColor: "#D4922A" },
              { day: "Fri", time: "11:30 AM", client: "Priya Patel", service: "Design Review", status: "Confirmed", statusColor: "#4ADE80" },
            ].map((b, i) => (
              <div key={i} className="flex items-center gap-3 py-2" style={{ borderBottom: i < 2 ? "1px solid rgba(212,146,42,0.06)" : "none" }}>
                <div className="w-10 text-center">
                  <div className="text-[10px]" style={{ color: "rgba(26,26,26,0.40)" }}>{b.day}</div>
                  <div className="text-xs font-bold" style={{ color: "#D4922A" }}>{b.time.split(" ")[0]}</div>
                  <div className="text-[9px]" style={{ color: "rgba(26,26,26,0.40)" }}>{b.time.split(" ")[1]}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold" style={{ color: "#1A1A1A" }}>{b.client}</div>
                  <div className="text-[10px]" style={{ color: "rgba(26,26,26,0.50)" }}>{b.service}</div>
                </div>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${b.statusColor}18`, color: b.statusColor }}>{b.status}</span>
              </div>
            ))}
          </div>
          <div className="rounded-lg p-3 flex items-center gap-3" style={{ background: "rgba(212,146,42,0.05)", border: "1px solid rgba(212,146,42,0.14)" }}>
            <Zap className="w-4 h-4 flex-shrink-0" style={{ color: "#D4922A" }} />
            <span className="text-xs" style={{ color: "rgba(26,26,26,0.65)" }}>Auto-confirmation emails sent to all 3 clients</span>
          </div>
        </div>
      ),
    },
    {
      icon: FileText,
      label: "Auto Invoicing",
      heading: "Invoices write themselves.",
      body: "Every completed session generates a professional invoice automatically. Send, track, and follow up on payments without lifting a finger.",
      panel: (
        <div className="space-y-3">
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(212,146,42,0.12)" }}>
            <div className="px-3 py-2 flex items-center justify-between" style={{ background: "#EEECEA", borderBottom: "1px solid rgba(212,146,42,0.08)" }}>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "rgba(26,26,26,0.45)" }}>Recent Invoices</span>
              <span className="text-[10px] font-bold" style={{ color: "#4ADE80" }}>$12,400 this month</span>
            </div>
            {[
              { id: "INV-0044", client: "Sarah Chen", amount: "$2,400", status: "Paid", color: "#4ADE80" },
              { id: "INV-0043", client: "James Wu", amount: "$3,200", status: "Paid", color: "#4ADE80" },
              { id: "INV-0042", client: "Marcus Lee", amount: "$1,800", status: "Overdue", color: "#C85A3A" },
              { id: "INV-0041", client: "Priya Patel", amount: "$950", status: "Sent", color: "#D4922A" },
            ].map((inv, i) => (
              <div key={i} className="px-3 py-2.5 flex items-center gap-3" style={{ borderBottom: i < 3 ? "1px solid rgba(212,146,42,0.06)" : "none" }}>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold" style={{ color: "#1A1A1A" }}>{inv.id} · {inv.client}</div>
                </div>
                <span className="text-xs font-bold" style={{ color: "#1A1A1A" }}>{inv.amount}</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${inv.color}18`, color: inv.color }}>{inv.status}</span>
              </div>
            ))}
          </div>
          <div className="rounded-lg p-3 flex items-center gap-3" style={{ background: "rgba(212,146,42,0.05)", border: "1px solid rgba(212,146,42,0.14)" }}>
            <Brain className="w-4 h-4 flex-shrink-0" style={{ color: "#D4922A" }} />
            <span className="text-xs" style={{ color: "rgba(26,26,26,0.65)" }}>AI drafted a payment reminder for Marcus Lee</span>
          </div>
        </div>
      ),
    },
    {
      icon: Mail,
      label: "AI Follow-Ups",
      heading: "Follow-ups that actually land.",
      body: "AI drafts personalized follow-up emails for every client based on their history, tone, and relationship stage. Review and send in one click.",
      panel: (
        <div className="space-y-3">
          <div className="rounded-lg p-3" style={{ background: "#EEECEA", border: "1px solid rgba(212,146,42,0.12)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "rgba(26,26,26,0.45)" }}>AI Draft — Marcus Lee</span>
              <span className="tag" style={{ background: "rgba(212,146,42,0.12)", color: "#D4922A", border: "1px solid rgba(212,146,42,0.25)", fontSize: "0.6rem" }}>Ready to Send</span>
            </div>
            <div className="text-xs mb-1 font-semibold" style={{ color: "rgba(26,26,26,0.65)" }}>Subject: Checking in — your Q2 strategy</div>
            <div className="text-[11px] leading-relaxed" style={{ color: "rgba(26,26,26,0.55)" }}>
              Hi Marcus, I wanted to check in after our last session. Given the goals we discussed around Q2 growth, I think now would be a great time to schedule a follow-up...
            </div>
            <div className="flex gap-2 mt-3">
              <button className="btn-amber text-[10px]" style={{ padding: "0.3rem 0.75rem" }}>Send Now</button>
              <button className="text-[10px] px-3 py-1 rounded" style={{ background: "rgba(26,26,26,0.06)", color: "rgba(26,26,26,0.60)", border: "1px solid rgba(26,26,26,0.10)" }}>Edit</button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Drafts Ready", value: "5", color: "#D4922A" },
              { label: "Sent This Mo", value: "18", color: "#4ADE80" },
              { label: "Response Rate", value: "74%", color: "#7A9A8A" },
            ].map(s => (
              <div key={s.label} className="rounded-lg p-2.5 text-center" style={{ background: "#EEECEA", border: "1px solid rgba(212,146,42,0.08)" }}>
                <div className="font-bold text-sm" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[9px] mt-0.5" style={{ color: "rgba(26,26,26,0.45)" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      icon: BarChart3,
      label: "Live Analytics",
      heading: "Insights, not just numbers.",
      body: "Track MRR, client acquisition, booking trends, and revenue forecasts in real time. Know exactly where your business is heading.",
      panel: (
        <div className="space-y-3">
          <div className="rounded-lg p-3" style={{ background: "#EEECEA", border: "1px solid rgba(212,146,42,0.12)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "rgba(26,26,26,0.45)" }}>Revenue — Last 6 Months</span>
            </div>
            <svg viewBox="0 0 240 60" className="w-full" style={{ height: 60 }} aria-hidden="true">
              <defs>
                <linearGradient id="bar-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D4922A" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#D4922A" stopOpacity="0.15" />
                </linearGradient>
              </defs>
              {[28, 36, 32, 44, 40, 56].map((h, i) => (
                <rect key={i} x={i * 40 + 4} y={60 - h} width="28" height={h} rx="3" fill="url(#bar-fill)" />
              ))}
              {["Jan","Feb","Mar","Apr","May","Jun"].map((m, i) => (
                <text key={i} x={i * 40 + 18} y={60} textAnchor="middle" style={{ fontSize: 7, fill: "rgba(26,26,26,0.35)" }}>{m}</text>
              ))}
            </svg>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "MRR", value: "$8,240", change: "+12%", up: true },
              { label: "Avg Session", value: "$242", change: "+8%", up: true },
              { label: "Churn Rate", value: "2.1%", change: "-0.4%", up: false },
              { label: "LTV", value: "$4,800", change: "+19%", up: true },
            ].map(s => (
              <div key={s.label} className="rounded-lg p-2.5" style={{ background: "#EEECEA", border: "1px solid rgba(212,146,42,0.08)" }}>
                <div className="text-[9px]" style={{ color: "rgba(26,26,26,0.45)" }}>{s.label}</div>
                <div className="font-bold text-sm" style={{ color: "#1A1A1A" }}>{s.value}</div>
                <div className="text-[9px]" style={{ color: s.up ? "#4ADE80" : "#C85A3A" }}>{s.change}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ];

  const active = tabs[activeTab];

  return (
    <section id="how-it-works" className="py-20" style={{ background: "#F2F0EC" }}>
      <div className="container">
        <div className="text-center mb-12">
          <div className="section-label mb-3">Product Demo</div>
          <h2 style={{ fontWeight: 800, fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)", color: "#1A1A1A", letterSpacing: "-0.025em" }}>
            Everything your freelance business needs
          </h2>
          <p className="mt-3 mx-auto" style={{ color: "rgba(26,26,26,0.60)", fontSize: "1.0625rem", maxWidth: 480 }}>
            One platform. Four core systems. Zero overhead.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_420px] gap-10 items-start">
          {/* Left — tab list + copy */}
          <div>
            <div className="space-y-2 mb-8">
              {tabs.map((tab, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTab(i)}
                  className="w-full text-left rounded-xl p-4 transition-all duration-200"
                  style={{
                    background: activeTab === i ? "rgba(212,146,42,0.08)" : "transparent",
                    border: activeTab === i ? "1px solid rgba(212,146,42,0.22)" : "1px solid transparent",
                    cursor: "pointer",
                  }}
                  aria-pressed={activeTab === i}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: activeTab === i ? "rgba(212,146,42,0.10)" : "rgba(26,26,26,0.04)",
                        border: activeTab === i ? "1px solid rgba(212,146,42,0.30)" : "1px solid rgba(26,26,26,0.10)",
                      }}
                    >
                      <tab.icon className="w-4 h-4" style={{ color: activeTab === i ? "#D4922A" : "rgba(26,26,26,0.45)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm" style={{ color: activeTab === i ? "#1A1A1A" : "rgba(26,26,26,0.55)" }}>
                        {tab.label}
                      </div>
                      {activeTab === i && (
                        <div className="text-xs mt-0.5" style={{ color: "rgba(26,26,26,0.55)" }}>
                          {tab.body}
                        </div>
                      )}
                    </div>
                    {activeTab === i && (
                      <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: "rgba(212,146,42,0.15)" }}>
                        <div
                          className="w-full rounded-full"
                          style={{ height: `${progress}%`, background: "#D4922A", transition: "height 0.1s linear" }}
                        />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Step numbers */}
            <div className="hidden lg:flex items-center gap-4 pt-2" style={{ borderTop: "1px solid rgba(26,26,26,0.06)" }}>
              {["01 Set up in minutes", "02 Clients self-book", "03 AI automates", "04 Revenue grows"].map((s, i) => (
                <div key={i} className="text-[10px] font-semibold" style={{ color: "rgba(26,26,26,0.30)" }}>{s}</div>
              ))}
            </div>
          </div>

          {/* Right — animated UI panel */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: "#F7F6F3", border: "1px solid rgba(212,146,42,0.18)", boxShadow: "0 20px 50px rgba(0,0,0,0.45)" }}
          >
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3" style={{ background: "#EEECEA", borderBottom: "1px solid rgba(212,146,42,0.10)" }}>
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#C85A3A" }} />
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#D4922A" }} />
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#7A9A8A" }} />
              <div className="flex items-center gap-1.5 ml-3">
                <active.icon className="w-3 h-3" style={{ color: "#D4922A" }} />
                <span className="text-xs font-mono" style={{ color: "rgba(26,26,26,0.55)" }}>SkillBridge AI — {active.label}</span>
              </div>
            </div>
            <div className="p-4">
              {active.panel}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Client Pulse Showcase ────────────────────────────────────────────────────
function ClientPulseShowcase() {
  const clients = [
    { name: "Sarah Chen", role: "Life Coach", score: 94, status: "Upsell Ready", color: "#D4922A", days: 2, revenue: "$3,200" },
    { name: "Marcus Lee", role: "Consultant", score: 62, status: "Going Silent", color: "#7A9A8A", days: 18, revenue: "$1,800" },
    { name: "Priya Patel", role: "Designer", score: 28, status: "Churn Risk", color: "#C0392B", days: 47, revenue: "$950" },
    { name: "James Wu", role: "Developer", score: 81, status: "Healthy", color: "#1E6B45", days: 5, revenue: "$4,100" },
  ];

  return (
    <section className="py-16" style={{ background: "#F2F0EC" }}>
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — copy */}
          <div>
            <div className="pill-retro mb-6 inline-flex">
              <Sparkles className="w-3 h-3" />
              Exclusive to SkillBridge AI
            </div>
            <h2 style={{ fontWeight: 800, fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)", color: "#1A1A1A", letterSpacing: "-0.025em", lineHeight: 1.1 }}>
              Client Pulse AI™
              <br />
              <span style={{ color: "#D4922A" }}>Know before they leave.</span>
            </h2>
            <p className="mt-4 mb-8" style={{ color: "rgba(26,26,26,0.75)", fontSize: "1.0625rem", lineHeight: 1.7 }}>
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
                    <item.icon className="w-4 h-4" style={{ color: "#D4922A" }} />
                  </div>
                  <p className="text-sm" style={{ color: "rgba(26,26,26,0.80)", lineHeight: 1.65 }}>{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — live UI preview */}
          <div className="retro-card overflow-hidden" style={{ border: "1px solid rgba(232,160,32,0.18)" }}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ background: "#EEECEA", borderBottom: "1px solid rgba(232,160,32,0.10)" }}>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" style={{ color: "#D4922A" }} />
                <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "#1A1A1A" }}>Client Pulse</span>
              </div>
              <span className="tag tag-amber">Live</span>
            </div>
            <div className="p-4 space-y-2">
              {clients.map((c, i) => (
                <div key={i} className="rounded-lg p-3 flex items-center gap-3" style={{ background: "#F7F6F3", border: "1px solid rgba(26,26,26,0.04)" }}>
                  {/* Score ring */}
                  <div className="relative w-10 h-10 flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(26,26,26,0.05)" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15" fill="none" stroke={c.color} strokeWidth="3" strokeDasharray={`${(c.score / 100) * 94.25} 94.25`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color: c.color }}>
                      {c.score}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm" style={{ color: "#1A1A1A" }}>{c.name}</span>
                      <span className="tag" style={{ background: `${c.color}18`, color: c.color, border: `1px solid ${c.color}28`, fontSize: "0.58rem" }}>{c.status}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs" style={{ color: "rgba(26,26,26,0.60)" }}>{c.role}</span>
                      <span className="text-xs" style={{ color: "rgba(26,26,26,0.55)" }}>·</span>
                      <span className="text-xs" style={{ color: "rgba(26,26,26,0.60)" }}>{c.days}d ago</span>
                      <span className="text-xs" style={{ color: "rgba(26,26,26,0.55)" }}>·</span>
                      <span className="text-xs font-semibold" style={{ color: "#D4922A" }}>{c.revenue}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3" style={{ background: "rgba(232,160,32,0.03)", borderTop: "1px solid rgba(232,160,32,0.08)" }}>
              <div className="flex items-start gap-2">
                <Brain className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "#D4922A" }} />
                <p className="text-xs" style={{ color: "rgba(26,26,26,0.75)" }}>
                  <strong style={{ color: "#D4922A" }}>AI:</strong> Priya hasn't booked in 47 days. Her revenue is down 40%. Re-engagement email drafted and ready to send.
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
      quote: "I used to spend 3 hours every Monday on admin. Now it's zero. SkillBridge AI paid for itself in the first week.",
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
    <section className="py-16" style={{ background: "#F7F6F3" }}>
      <div className="container">
        <div className="text-center mb-8">
          <div className="section-label mb-3">What Freelancers Say</div>
          <h2 style={{ fontWeight: 800, fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)", color: "#1A1A1A", letterSpacing: "-0.025em" }}>
            Join thousands who scaled with SkillBridge AI.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className="retro-card card-lift p-6">
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-current" style={{ color: "#D4922A" }} />
                ))}
              </div>
              <blockquote className="text-sm leading-relaxed mb-5" style={{ color: "rgba(26,26,26,0.80)" }}>
                "{t.quote}"
              </blockquote>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={t.avatar} alt={t.name} className="w-9 h-9 rounded-full object-cover" style={{ border: "1px solid rgba(232,160,32,0.18)" }} />
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>{t.name}</div>
                    <div className="text-xs" style={{ color: "rgba(26,26,26,0.65)" }}>{t.role}</div>
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
    <section className="py-16" style={{ background: "#1B2D4F" }}>
      <div className="container text-center max-w-2xl mx-auto">
        <div className="section-label mb-4">Start Today</div>
          <h2 style={{ fontWeight: 800, fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)", color: "#1A1A1A", letterSpacing: "-0.025em" }}>
          Your business command center is waiting.
        </h2>
        <p className="mt-4 mb-10" style={{ color: "rgba(26,26,26,0.75)", fontSize: "1.0625rem" }}>
          Join 4,200+ freelancers who automated their business with SkillBridge AI. 14-day free trial. No credit card required.
        </p>

        {submitted ? (
          <div className="inline-flex items-center gap-3 px-6 py-4 rounded-lg" style={{ background: "rgba(232,160,32,0.08)", border: "1px solid rgba(232,160,32,0.22)" }}>
            <CheckCircle className="w-5 h-5" style={{ color: "#D4922A" }} />
            <span style={{ color: "#1A1A1A", fontWeight: 600 }}>You're on the list — check your inbox!</span>
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

        <p className="mt-4 text-xs" style={{ color: "rgba(26,26,26,0.55)" }}>
          No spam. Unsubscribe anytime. We respect your privacy.
        </p>
      </div>
    </section>
  );
}

// ─── FAQ Section ─────────────────────────────────────────────────────────────
const HOME_FAQS = [
  { q: "Is SkillBridge AI really free to start?", a: "Yes. The Free plan gives you unlimited clients, invoices, and bookings with no credit card required. You only upgrade when you need advanced features like AI automation, recurring invoices, and priority support." },
  { q: "How does the AI follow-up feature work?", a: "SkillBridge AI analyzes each client's booking history, invoice activity, and engagement signals to generate a personalized follow-up email in one click. You review and send — the AI does the drafting." },
  { q: "Can I accept payments through SkillBridge AI?", a: "Yes. Connect your Stripe account and your clients can pay invoices online via credit card. Payments are processed securely by Stripe — SkillBridge AI never touches your funds." },
  { q: "Do I need to install anything?", a: "No. SkillBridge AI is a fully web-based platform. It works on any device with a browser. You can also install it as a PWA (Progressive Web App) on your phone for a native app experience." },
  { q: "Can clients book appointments without creating an account?", a: "Yes. Your public booking page allows clients to schedule sessions without signing up. You get a unique URL (e.g. skillbridge-ai.com/book/yourname) to share on your website or social profiles." },
  { q: "What happens to my data if I cancel?", a: "Your data is always yours. You can export all clients, invoices, and bookings as CSV at any time. We retain your data for 30 days after cancellation in case you change your mind." },
];

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="py-20 px-6" style={{ background: "#F2F0EC" }}>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4" style={{ background: "rgba(232,160,32,0.12)", color: "#D4922A" }}>FAQ</span>
          <h2 className="text-3xl md:text-4xl font-extrabold mb-3" style={{ color: "#1A1A1A", letterSpacing: "-0.02em" }}>Frequently Asked Questions</h2>
          <p className="text-[#3D3D3D] text-base">Everything you need to know before getting started.</p>
        </div>
        <div className="space-y-3">
          {HOME_FAQS.map((faq, i) => (
            <div key={i} className="rounded-xl border overflow-hidden" style={{ borderColor: open === i ? "rgba(232,160,32,0.4)" : "rgba(221,219,215,0.80)", background: open === i ? "rgba(232,160,32,0.04)" : "#FFFFFF" }}>
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                <span className="text-sm font-semibold text-[#1A1A1A] pr-4">{faq.q}</span>
                <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: open === i ? "#D4922A" : "rgba(26,26,26,0.10)" }}>
                  <span className="text-xs font-bold" style={{ color: open === i ? "#FFFFFF" : "#1A1A1A" }}>{open === i ? "−" : "+"}</span>
                </span>
              </button>
              {open === i && (
                <div className="px-5 pb-4">
                  <p className="text-sm text-[#3D3D3D] leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-[#6B6B6B] mt-10">
          Still have questions? <a href="/contact" className="text-[#D4922A] hover:underline font-medium">Contact our team →</a>
        </p>
      </div>
    </section>
  );
}
// ─── Footer ────────────────────────────────────────────────────────────────────────────────
function Footer({ onChangelogOpen }: { onChangelogOpen?: () => void }) {
  const [, navigate] = useLocation();

  const sections = [
    {
      title: "Product",
      links: [
        { label: "Features", action: () => document.querySelector("#features")?.scrollIntoView({ behavior: "smooth" }) },
        { label: "Pricing", action: () => navigate("/pricing") },
        { label: "Dashboard", action: () => navigate("/dashboard") },
        { label: "Changelog", action: () => onChangelogOpen?.() },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About", action: () => navigate("/about") },
        { label: "Contact", action: () => navigate("/contact") },
        { label: "Careers", action: () => { window.location.href = "mailto:careers@skillbridge-ai.com"; } },
        { label: "Press", action: () => { window.location.href = "mailto:press@skillbridge-ai.com"; } },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", action: () => navigate("/privacy") },
        { label: "Terms of Service", action: () => navigate("/terms") },
        { label: "Help Center", action: () => navigate("/help") },
        { label: "Security", action: () => navigate("/help") },
      ],
    },
  ];
  return (
    <footer style={{ background: "#F2F0EC", borderTop: "1px solid rgba(212,146,42,0.12)" }}>
      <div className="container pt-16 pb-10 page-bottom">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-10 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center mb-4">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/logo-r1_d9d437c8.png"
                alt="SkillBridge AI"
                className="h-9 w-auto object-contain"
              />
            </div>
            <p className="text-sm mb-4" style={{ color: "rgba(26,26,26,0.65)", lineHeight: 1.7 }}>
              The AI-powered business OS for freelancers and solo service professionals.
            </p>
            <div className="flex gap-2">
              {([
                { label: "X", href: "https://x.com" },
                { label: "in", href: "https://linkedin.com" },
                { label: "IG", href: "https://instagram.com" },
              ] as { label: string; href: string }[]).map(s => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`SkillBridge AI on ${s.label}`}
                  className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold"
                  style={{ background: "rgba(26,26,26,0.08)", color: "rgba(26,26,26,0.65)", border: "1px solid rgba(26,26,26,0.10)", textDecoration: "none" }}
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {sections.map(sec => (
            <div key={sec.title}>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgba(26,26,26,0.55)" }}>
                {sec.title}
              </h4>
              <ul className="space-y-2.5">
                {sec.links.map(l => (
                  <li key={l.label}>
                    <button
                      onClick={l.action}
                      className="text-sm animated-underline"
                      style={{ color: "rgba(26,26,26,0.75)", background: "none", border: "none", minHeight: "auto", minWidth: "auto" }}
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" style={{ color: "rgba(26,26,26,0.55)" }}>
          <p>© {new Date().getFullYear()} SkillBridge AI. All rights reserved.</p>
          <p>Built for the independent professional.</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [, navigate] = useLocation();

  // If the user is already authenticated, skip the landing page and go straight to the dashboard
   const meQuery = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  useEffect(() => {
    document.title = "SkillBridge AI — AI Business Platform for Freelancers";
  }, []);
  useEffect(() => {
    if (!meQuery.isLoading && meQuery.data) {
      // User is logged in — redirect to dashboard
      navigate("/dashboard");
    }
  }, [meQuery.isLoading, meQuery.data, navigate]);

  // While checking auth, show a minimal dark loader so there's no flash of the landing page
  if (meQuery.isLoading) {
    return (
          <div style={{ background: "#F2F0EC", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}
        role="status"
        aria-label="Loading"
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(232,160,32,0.10)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite" }}>
              <circle cx="12" cy="12" r="10" stroke="#D4922A" strokeWidth="2" strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round" />
            </svg>
          </div>
          <p style={{ color: "rgba(26,26,26,0.65)", fontSize: 13 }}>Loading…</p>
        </div>
      </div>
    );
  }

  // If user is authenticated, render nothing (redirect is in flight)
  if (meQuery.data) return null;

  return (
    <div style={{ background: "#F2F0EC", minHeight: "100vh", overflowX: "hidden" }}>
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
      <Footer onChangelogOpen={() => setChangelogOpen(true)} />
      <OnboardingModal open={modalOpen} onClose={() => setModalOpen(false)} />
      {changelogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Changelog">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setChangelogOpen(false)} aria-hidden="true" />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ border: "1px solid rgba(232,160,32,0.20)" }}>
            <div className="flex items-center justify-between p-5 border-b border-[#EEECEA]">
              <div>
                <h2 className="font-bold text-[#1A1A1A] text-base">What's New</h2>
                <p className="text-xs text-[#6B6B6B] mt-0.5">SkillBridge AI — Latest Updates</p>
              </div>
              <button onClick={() => setChangelogOpen(false)} className="p-1.5 rounded-lg hover:bg-[#F0EEE9] transition-colors" aria-label="Close">
                <X className="w-4 h-4 text-[#6B6B6B]" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {([
                { emoji: "🔔", title: "Live Notifications", desc: "Real-time bell with unread badge — never miss an important event." },
                { emoji: "⏱", title: "Time Tracking", desc: "Start/stop timer, log billable hours, and see summary stats per client." },
                { emoji: "🔁", title: "Recurring Invoices", desc: "Set weekly, monthly, or custom billing schedules — invoices generate automatically." },
                { emoji: "📄", title: "Contracts & Proposals", desc: "Write, send, and convert proposals to invoices with one click." },
                { emoji: "🌐", title: "Client Portal", desc: "Clients can view their invoices and bookings via a secure token link." },
                { emoji: "📅", title: "iCal Export", desc: "Share your booking calendar with any calendar app via a live iCal feed." },
                { emoji: "💳", title: "Stripe Pay Now", desc: "Clients can pay invoices instantly — webhooks auto-mark them paid." },
                { emoji: "🤖", title: "Background Automation", desc: "Overdue detection and recurring invoice generation run every 5 minutes, hands-free." },
              ] as { emoji: string; title: string; desc: string }[]).map(item => (
                <div key={item.title} className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">{item.emoji}</span>
                  <div>
                    <p className="text-sm font-bold text-[#1A1A1A]">{item.title}</p>
                    <p className="text-xs text-[#6B6B6B] mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 pb-5">
              <button onClick={() => setChangelogOpen(false)} className="w-full gradient-amber text-white font-semibold py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity">
                Got it, let's go! 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
