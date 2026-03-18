/**
 * TrueAxis HQ — Landing Page
 * Design: "Kinetic Warmth" — Teal #00C9A7, Coral #FF6B6B, Charcoal #1C1C1E
 * Fully accessible (WCAG AA), mobile-first, hardened interactions
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Zap, Calendar, FileText, Mail, BarChart3, Users,
  ArrowRight, CheckCircle, Star, Menu, X, Sparkles,
  TrendingUp, Clock, DollarSign, Shield, ChevronRight
} from "lucide-react";

// ─── Animated Counter ────────────────────────────────────────────────────────
function AnimatedCounter({ end, suffix = "", duration = 2000 }: { end: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (prefersReducedMotion) { setCount(end); return; }
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
  }, [end, duration, prefersReducedMotion]);

  return <span ref={ref} aria-label={`${end.toLocaleString()}${suffix}`}>{count.toLocaleString()}{suffix}</span>;
}

// ─── Onboarding Modal ─────────────────────────────────────────────────────────
function OnboardingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: "", email: "", business: "", service: "" });
  const firstFocusRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus first input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => firstFocusRef.current?.focus(), 50);
    }
  }, [open, step]);

  // Escape key + focus trap
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (step === 0) {
      if (!form.name.trim()) newErrors.name = "Your name is required";
      if (!form.email.trim()) newErrors.email = "Email address is required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = "Please enter a valid email address";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const steps = [
    {
      title: "Welcome to TrueAxis HQ 👋",
      subtitle: "Let's set up your account in 60 seconds.",
      content: (
        <div className="space-y-4">
          <div>
            <label htmlFor="ob-name" className="block text-xs font-semibold text-gray-600 mb-1.5">Your Name <span aria-hidden="true">*</span></label>
            <input
              id="ob-name"
              ref={firstFocusRef}
              value={form.name}
              onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setErrors(p => ({ ...p, name: "" })); }}
              placeholder="Jane Smith"
              autoComplete="name"
              aria-required="true"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "ob-name-error" : undefined}
              className={`w-full px-3 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00C9A7] transition-colors ${errors.name ? "border-red-400 bg-red-50" : "border-gray-200"}`}
            />
            {errors.name && <p id="ob-name-error" role="alert" className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="ob-email" className="block text-xs font-semibold text-gray-600 mb-1.5">Email Address <span aria-hidden="true">*</span></label>
            <input
              id="ob-email"
              type="email"
              value={form.email}
              onChange={e => { setForm(p => ({ ...p, email: e.target.value })); setErrors(p => ({ ...p, email: "" })); }}
              placeholder="jane@example.com"
              autoComplete="email"
              aria-required="true"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "ob-email-error" : undefined}
              className={`w-full px-3 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00C9A7] transition-colors ${errors.email ? "border-red-400 bg-red-50" : "border-gray-200"}`}
            />
            {errors.email && <p id="ob-email-error" role="alert" className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>
        </div>
      ),
    },
    {
      title: "Tell us about your business",
      subtitle: "We'll personalize your experience.",
      content: (
        <div className="space-y-4">
          <div>
            <label htmlFor="ob-business" className="block text-xs font-semibold text-gray-600 mb-1.5">Business Name</label>
            <input
              id="ob-business"
              ref={firstFocusRef}
              value={form.business}
              onChange={e => setForm(p => ({ ...p, business: e.target.value }))}
              placeholder="Jane's Coaching Studio"
              autoComplete="organization"
              className="w-full px-3 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00C9A7] transition-colors"
            />
          </div>
          <fieldset>
            <legend className="block text-xs font-semibold text-gray-600 mb-2">What service do you offer?</legend>
            <div className="grid grid-cols-2 gap-2">
              {["Life Coaching", "Business Consulting", "Freelance Design", "Tutoring", "Therapy / Counseling", "Other"].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, service: s }))}
                  aria-pressed={form.service === s}
                  className={`px-3 py-2.5 text-xs font-medium rounded-xl border transition-colors text-left focus:outline-none focus:ring-2 focus:ring-[#00C9A7] ${form.service === s ? "border-[#00C9A7] bg-[#00C9A7]/5 text-[#00C9A7]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      ),
    },
    {
      title: "You're all set! 🎉",
      subtitle: "Your free 14-day trial is ready.",
      content: (
        <div className="space-y-4">
          <div className="bg-[#00C9A7]/5 border border-[#00C9A7]/20 rounded-2xl p-5 space-y-3">
            {[
              "AI client intake forms — ready",
              "Smart scheduling — ready",
              "Automated invoicing — ready",
              "AI follow-up engine — ready",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle className="w-4 h-4 text-[#00C9A7] flex-shrink-0" aria-hidden="true" />
                <span className="text-sm text-gray-700">{item}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 text-center">No credit card required. Cancel anytime.</p>
        </div>
      ),
    },
  ];

  const current = steps[step];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div ref={modalRef} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-0">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? "w-8 bg-[#00C9A7]" : i < step ? "w-4 bg-[#00C9A7]/40" : "w-4 bg-gray-200"}`}
                aria-hidden="true"
              />
            ))}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#00C9A7]"
            aria-label="Close setup wizard"
          >
            <X className="w-4 h-4 text-gray-500" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <h2 id="onboarding-title" className="text-xl font-bold text-[#1C1C1E] mb-1" style={{ fontFamily: "Sora, sans-serif" }}>
            {current.title}
          </h2>
          <p className="text-sm text-gray-500 mb-6">{current.subtitle}</p>
          {current.content}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 pt-0 gap-3">
          {step > 0 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-[#00C9A7] rounded px-2 py-1"
            >
              Back
            </button>
          ) : (
            <div />
          )}
          <Button
            className="gradient-teal text-white border-0 hover:opacity-90 flex items-center gap-2 min-w-[140px] justify-center"
            onClick={() => {
              if (!validate()) return;
              if (step < steps.length - 1) {
                setStep(s => s + 1);
              } else {
                if (form.name) localStorage.setItem("sb_userName", JSON.stringify(form.name));
                if (form.email) localStorage.setItem("sb_userEmail", JSON.stringify(form.email));
                if (form.business) localStorage.setItem("sb_businessName", JSON.stringify(form.business));
                toast.success(`Welcome, ${form.name || "there"}! Your dashboard is ready.`);
                onClose();
                setTimeout(() => navigate("/dashboard"), 500);
              }
            }}
          >
            {step < steps.length - 1 ? "Continue" : "Go to Dashboard"}
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Navbar ──────────────────────────────────────────────────────────────────
function Navbar({ onCTA }: { onCTA: () => void }) {
  const [, navigate] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Close mobile menu on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        hamburgerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mobileOpen]);

  const scrollTo = useCallback((id: string) => {
    setMobileOpen(false);
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, []);

  const navItems = [
    { label: "Features", action: () => scrollTo("features") },
    { label: "How It Works", action: () => scrollTo("howitworks") },
    { label: "Testimonials", action: () => scrollTo("testimonials") },
    { label: "Pricing", action: () => { setMobileOpen(false); navigate("/pricing"); } },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/95 backdrop-blur-md shadow-sm" : "bg-transparent"}`}
      aria-label="Main navigation"
    >
      <div className="container flex items-center justify-between h-16">
        {/* Logo */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#00C9A7] rounded-lg p-1"
          aria-label="TrueAxis HQ — scroll to top"
        >
          <div className="w-8 h-8 rounded-lg gradient-teal flex items-center justify-center" aria-hidden="true">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg" style={{ fontFamily: "Sora, sans-serif", color: scrolled ? "#1C1C1E" : "white" }}>
            TrueAxis <span className="text-[#00C9A7]">HQ</span>
          </span>
        </button>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8" role="list">
          {navItems.map(item => (
            <button
              key={item.label}
              role="listitem"
              onClick={item.action}
              className={`text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#00C9A7] rounded px-1 py-0.5 ${scrolled ? "text-gray-600 hover:text-[#00C9A7]" : "text-white/80 hover:text-white"}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className={`focus:ring-2 focus:ring-[#00C9A7] ${scrolled ? "text-gray-600" : "text-white hover:bg-white/10"}`}
          >
            Sign In
          </Button>
          <Button
            size="sm"
            className="gradient-teal text-white border-0 hover:opacity-90 px-5 focus:ring-2 focus:ring-[#00C9A7] focus:ring-offset-2"
            onClick={onCTA}
          >
            Start Free Trial
          </Button>
        </div>

        {/* Mobile hamburger */}
        <button
          ref={hamburgerRef}
          className="md:hidden p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00C9A7] min-w-[44px] min-h-[44px] flex items-center justify-center"
          onClick={() => setMobileOpen(v => !v)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
        >
          {mobileOpen
            ? <X className={`w-5 h-5 ${scrolled ? "text-gray-700" : "text-white"}`} aria-hidden="true" />
            : <Menu className={`w-5 h-5 ${scrolled ? "text-gray-700" : "text-white"}`} aria-hidden="true" />
          }
        </button>
      </div>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        ref={mobileMenuRef}
        className={`md:hidden bg-white border-t border-gray-100 overflow-hidden transition-all duration-300 ${mobileOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}
        aria-hidden={!mobileOpen}
      >
        <div className="px-4 py-4 space-y-1">
          {navItems.map(item => (
            <button
              key={item.label}
              onClick={item.action}
              tabIndex={mobileOpen ? 0 : -1}
              className="block w-full text-left text-sm font-medium text-gray-700 py-3 px-3 rounded-xl hover:bg-gray-50 hover:text-[#00C9A7] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00C9A7] min-h-[44px]"
            >
              {item.label}
            </button>
          ))}
          <div className="pt-2 space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-700 min-h-[44px]"
              onClick={() => { setMobileOpen(false); navigate("/dashboard"); }}
              tabIndex={mobileOpen ? 0 : -1}
            >
              Sign In
            </Button>
            <Button
              className="w-full gradient-teal text-white border-0 min-h-[44px]"
              onClick={() => { setMobileOpen(false); onCTA(); }}
              tabIndex={mobileOpen ? 0 : -1}
            >
              Start Free Trial
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function HeroSection({ onCTA }: { onCTA: () => void }) {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const captureLead = trpc.leads.capture.useMutation();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    if (!email.trim()) { setEmailError("Please enter your email address"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError("Please enter a valid email address"); return; }
    try {
      await captureLead.mutateAsync({ email: email.trim(), source: "landing_page" });
      setSubmitted(true);
      toast.success(`🎉 You're on the list! We'll be in touch at ${email}.`);
      setEmail("");
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  };

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#1C1C1E]" aria-labelledby="hero-heading">
      {/* Background */}
      <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1C1C1E] via-[#1A2E2A] to-[#1C1C1E]" />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-[#00C9A7] opacity-10 blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-64 h-64 rounded-full bg-[#FF6B6B] opacity-8 blur-3xl" />
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      <div className="container relative z-10 pt-24 pb-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#00C9A7]/15 text-[#00C9A7] border border-[#00C9A7]/30 rounded-full px-4 py-1.5 text-xs font-semibold mb-6">
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              AI-Powered Business Automation for Freelancers
            </div>

            <h1 id="hero-heading" className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6" style={{ fontFamily: "Sora, sans-serif" }}>
              Run Your Business<br />
              <span className="text-[#00C9A7]">on Autopilot.</span>
            </h1>

            <p className="text-base sm:text-lg text-gray-300 leading-relaxed mb-8 max-w-lg">
              TrueAxis HQ handles your client intake, scheduling, invoicing, and follow-ups — so you can focus on the work you love and scale to <strong className="text-white">$100K/year</strong>.
            </p>

            {/* Email capture */}
            <form onSubmit={handleEmailSubmit} className="mb-6 max-w-md" noValidate>
              <label htmlFor="hero-email" className="sr-only">Email address for early access</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="hero-email"
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setEmailError(""); }}
                  placeholder="Enter your email address"
                  autoComplete="email"
                  aria-required="true"
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? "hero-email-error" : undefined}
                  className={`flex-1 px-4 py-3 text-sm bg-white/10 border rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00C9A7] transition-colors min-h-[48px] ${emailError ? "border-red-400" : "border-white/20"}`}
                />
                  <Button
                  type="submit"
                  disabled={captureLead.isPending || submitted}
                  className="gradient-teal text-white border-0 hover:opacity-90 px-5 py-3 whitespace-nowrap min-h-[48px] focus:ring-2 focus:ring-[#00C9A7] focus:ring-offset-2 focus:ring-offset-[#1C1C1E] disabled:opacity-60"
                >
                  {submitted ? "You're on the list! ✓" : captureLead.isPending ? "Saving..." : "Get Early Access"}
                </Button>
              </div>
              {emailError && <p id="hero-email-error" role="alert" className="text-xs text-red-400 mt-1.5">{emailError}</p>}
            </form>

            <button
              onClick={onCTA}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-8 focus:outline-none focus:ring-2 focus:ring-[#00C9A7] rounded px-1 py-0.5"
            >
              <ChevronRight className="w-4 h-4 text-[#00C9A7]" aria-hidden="true" />
              Or start your free trial now — no credit card required
            </button>

            {/* Social proof */}
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2" aria-hidden="true">
                {[
                  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=40&h=40&fit=crop",
                  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop",
                  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop",
                  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop",
                ].map((src, i) => (
                  <img key={i} src={src} alt="" className="w-9 h-9 rounded-full border-2 border-[#1C1C1E] object-cover" />
                ))}
              </div>
              <div>
                <div className="flex items-center gap-0.5" aria-label="5 out of 5 stars">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-[#FFB800] text-[#FFB800]" aria-hidden="true" />)}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Trusted by <strong className="text-white">4,200+</strong> freelancers</p>
              </div>
            </div>
          </div>

          {/* Hero image — hidden on mobile to save space */}
          <div className="relative hidden lg:block" aria-hidden="true">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/hero-dashboard-RyoEoGEjG4TEbwuTtryX27.webp"
              alt=""
              className="w-full rounded-2xl shadow-2xl glow-teal"
              loading="lazy"
            />
            <div className="absolute -left-8 top-1/4 bg-white rounded-xl p-3 shadow-xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#00C9A7]/15 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#00C9A7]" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs text-gray-500">This Month</p>
                <p className="text-sm font-bold text-gray-900">+$8,420</p>
              </div>
            </div>
            <div className="absolute -right-6 bottom-1/3 bg-white rounded-xl p-3 shadow-xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FF6B6B]/15 flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#FF6B6B]" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Time Saved</p>
                <p className="text-sm font-bold text-gray-900">14 hrs/week</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Wave divider */}
      <div className="absolute bottom-0 left-0 right-0" aria-hidden="true">
        <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
          <path d="M0 80L1440 0V80H0Z" fill="#FAFAF8" />
        </svg>
      </div>
    </section>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function StatsBar() {
  return (
    <section className="bg-[#FAFAF8] py-12 sm:py-16" aria-label="Key statistics">
      <div className="container">
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {[
            { end: 64, suffix: "M+", label: "Freelancers in the US" },
            { end: 14, suffix: " hrs", label: "Saved per week, avg" },
            { end: 4200, suffix: "+", label: "Active users" },
            { end: 98, suffix: "%", label: "Customer satisfaction" },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <dt className="text-3xl sm:text-4xl font-extrabold text-[#1C1C1E] mb-1" style={{ fontFamily: "Sora, sans-serif" }}>
                <AnimatedCounter end={stat.end} suffix={stat.suffix} />
              </dt>
              <dd className="text-xs sm:text-sm text-gray-500">{stat.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────
function FeaturesSection({ onCTA }: { onCTA: () => void }) {
  const features = [
    { icon: <Users className="w-6 h-6" aria-hidden="true" />, title: "AI Client Intake", description: "Smart intake forms that qualify leads automatically, ask the right questions, and book clients without any back-and-forth.", color: "#00C9A7" },
    { icon: <Calendar className="w-6 h-6" aria-hidden="true" />, title: "Smart Scheduling", description: "AI-powered calendar that handles bookings, sends reminders, and suggests the best meeting times based on your patterns.", color: "#FF6B6B" },
    { icon: <FileText className="w-6 h-6" aria-hidden="true" />, title: "Automated Invoicing", description: "Generate and send professional invoices instantly after every session. Track payments and send automated reminders.", color: "#00C9A7" },
    { icon: <Mail className="w-6 h-6" aria-hidden="true" />, title: "AI Follow-Up Engine", description: "Never lose a lead again. Automated email and SMS follow-ups that sound personal, not robotic — powered by AI.", color: "#FF6B6B" },
    { icon: <BarChart3 className="w-6 h-6" aria-hidden="true" />, title: "Analytics Dashboard", description: "See your revenue trends, client retention rates, and booking patterns at a glance. Know exactly where to focus.", color: "#00C9A7" },
    { icon: <Zap className="w-6 h-6" aria-hidden="true" />, title: "Booking Page Builder", description: "Your professional booking page is included — no extra tools needed. Share one link and let clients book instantly.", color: "#FF6B6B" },
    { icon: <TrendingUp className="w-6 h-6" aria-hidden="true" />, title: "Client Pulse AI", description: "The world's first AI relationship health engine. Detects churn risk, upsell opportunities, and silent clients before they disappear — then drafts the perfect outreach automatically.", color: "#6366F1", badge: "New" },
  ] as { icon: React.ReactNode; title: string; description: string; color: string; badge?: string }[];

  return (
    <section id="features" className="py-16 sm:py-24 bg-[#FAFAF8]" aria-labelledby="features-heading">
      <div className="container">
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 bg-[#00C9A7]/10 text-[#00C9A7] border border-[#00C9A7]/20 rounded-full px-4 py-1.5 text-xs font-semibold mb-4">
            <Zap className="w-3 h-3" aria-hidden="true" />Everything You Need
          </div>
          <h2 id="features-heading" className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1C1C1E] mb-4" style={{ fontFamily: "Sora, sans-serif" }}>
            Your entire business,<br /><span className="text-[#00C9A7]">automated.</span>
          </h2>
          <p className="text-base sm:text-lg text-gray-500 max-w-2xl mx-auto">
            Stop juggling five different tools. TrueAxis HQ replaces your scheduling app, invoicing software, CRM, and email tool — in one platform.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {features.map((f, i) => (
            <article key={i} className="relative bg-white rounded-2xl p-5 sm:p-6 card-lift border border-gray-100 group cursor-pointer" onClick={onCTA}>
              {f.badge && (
                <span className="absolute top-4 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: f.color }}>{f.badge}</span>
              )}
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-white transition-transform group-hover:scale-110" style={{ backgroundColor: f.color }}>
                {f.icon}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#1C1C1E] mb-2" style={{ fontFamily: "Sora, sans-serif" }}>{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              <div className="mt-4 flex items-center gap-1 text-xs font-semibold" style={{ color: f.color }}>
                Try it free <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────
function HowItWorksSection({ onCTA }: { onCTA: () => void }) {
  const steps = [
    { step: "01", title: "Sign Up in 2 Minutes", desc: "Create your account, set your services and pricing. No technical skills needed.", icon: <Zap className="w-5 h-5" aria-hidden="true" /> },
    { step: "02", title: "Share Your Link", desc: "Share your personalized booking page with clients. They book, you get notified.", icon: <Users className="w-5 h-5" aria-hidden="true" /> },
    { step: "03", title: "AI Does the Rest", desc: "Intake, scheduling, invoicing, and follow-ups all happen automatically.", icon: <Sparkles className="w-5 h-5" aria-hidden="true" /> },
    { step: "04", title: "Watch Revenue Grow", desc: "Focus on your craft. Watch your dashboard fill up with happy clients and paid invoices.", icon: <TrendingUp className="w-5 h-5" aria-hidden="true" /> },
  ];

  return (
    <section id="howitworks" className="py-16 sm:py-24 bg-[#1C1C1E]" aria-labelledby="howitworks-heading">
      <div className="container">
        <div className="text-center mb-12 sm:mb-16">
          <h2 id="howitworks-heading" className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4" style={{ fontFamily: "Sora, sans-serif" }}>
            Up and running in <span className="text-[#00C9A7]">10 minutes.</span>
          </h2>
          <p className="text-base sm:text-lg text-gray-400 max-w-xl mx-auto">No onboarding calls. No setup fees. Just sign up and start automating.</p>
        </div>

        <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6" aria-label="Setup steps">
          {steps.map((step, i) => (
            <li key={i} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-[#00C9A7]/40 to-transparent z-0" aria-hidden="true" />
              )}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 relative z-10 card-lift cursor-pointer h-full" onClick={onCTA}>
                <div className="text-4xl sm:text-5xl font-extrabold text-[#00C9A7]/20 mb-4" style={{ fontFamily: "Sora, sans-serif" }} aria-hidden="true">{step.step}</div>
                <div className="w-10 h-10 rounded-lg bg-[#00C9A7]/15 flex items-center justify-center text-[#00C9A7] mb-4">{step.icon}</div>
                <h3 className="text-sm sm:text-base font-bold text-white mb-2" style={{ fontFamily: "Sora, sans-serif" }}>{step.title}</h3>
                <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────
function TestimonialsSection() {
  const testimonials = [
    { name: "Sarah Chen", role: "Life Coach", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&h=60&fit=crop", quote: "I used to spend 3 hours every Monday on admin. Now it's zero. TrueAxis HQ paid for itself in the first week.", revenue: "+$2,400/mo" },
    { name: "Marcus Williams", role: "Freelance Designer", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop", quote: "The AI follow-up feature alone recovered 4 lost clients in my first month. Absolute game changer.", revenue: "+$3,100/mo" },
    { name: "Priya Patel", role: "Business Consultant", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop", quote: "Finally a tool that understands solo operators. The invoicing automation is flawless — clients pay faster now.", revenue: "+$5,800/mo" },
  ];

  return (
    <section id="testimonials" className="py-16 sm:py-24 bg-[#FAFAF8]" aria-labelledby="testimonials-heading">
      <div className="container">
        <div className="text-center mb-12 sm:mb-16">
          <h2 id="testimonials-heading" className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1C1C1E] mb-4" style={{ fontFamily: "Sora, sans-serif" }}>
            Real people, <span className="text-[#FF6B6B]">real results.</span>
          </h2>
          <p className="text-base sm:text-lg text-gray-500">Join thousands of freelancers who scaled their income with TrueAxis HQ.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {testimonials.map((t, i) => (
            <figure key={i} className="bg-white rounded-2xl p-5 sm:p-6 card-lift border border-gray-100">
              <div className="flex items-center gap-0.5 mb-4" aria-label="5 out of 5 stars">
                {[...Array(5)].map((_, j) => <Star key={j} className="w-4 h-4 fill-[#FFB800] text-[#FFB800]" aria-hidden="true" />)}
              </div>
              <blockquote className="text-sm sm:text-base text-gray-700 leading-relaxed mb-6 italic">"{t.quote}"</blockquote>
              <figcaption className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-3">
                  <img src={t.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <p className="text-sm font-semibold text-[#1C1C1E]">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.role}</p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 bg-[#00C9A7]/10 text-[#00C9A7] border border-[#00C9A7]/20 rounded-full px-3 py-1 text-xs font-semibold">
                  {t.revenue}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Client Pulse Showcase ──────────────────────────────────────────────────
function ClientPulseShowcase({ onCTA }: { onCTA: () => void }) {
  const signals = [
    { label: "Days since last contact", value: "14 days", risk: true },
    { label: "Bookings last 90 days", value: "0", risk: true },
    { label: "Outstanding invoices", value: "$1,200", risk: true },
    { label: "Revenue trend", value: "-40%", risk: true },
  ];
  return (
    <section className="py-16 sm:py-24 bg-[#1C1C1E] relative overflow-hidden" aria-labelledby="pulse-showcase-heading">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-0 w-72 h-72 rounded-full bg-[#6366F1] opacity-10 blur-3xl -translate-y-1/2" />
        <div className="absolute top-1/2 right-0 w-72 h-72 rounded-full bg-[#00C9A7] opacity-10 blur-3xl -translate-y-1/2" />
      </div>
      <div className="container relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left — copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-[#6366F1]/15 text-[#A5B4FC] border border-[#6366F1]/30 rounded-full px-4 py-1.5 text-xs font-semibold mb-6">
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              Exclusive to TrueAxis HQ
            </div>
            <h2 id="pulse-showcase-heading" className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-6" style={{ fontFamily: "Sora, sans-serif" }}>
              Know which clients are about to leave —
              <span className="text-[#6366F1]"> before they do.</span>
            </h2>
            <p className="text-base sm:text-lg text-gray-400 mb-8 leading-relaxed">
              Client Pulse AI is the world's first relationship health engine for freelancers. It analyzes 8 behavioral signals across your entire client base and surfaces churn risks, upsell opportunities, and silent clients — then writes the outreach for you.
            </p>
            <ul className="space-y-3 mb-8" aria-label="Client Pulse AI benefits">
              {[
                "Detects churn risk up to 30 days before a client goes silent",
                "Identifies upsell-ready clients based on booking and revenue patterns",
                "Drafts personalized re-engagement emails with one click",
                "Updates automatically as you add bookings, invoices, and follow-ups",
              ].map(item => (
                <li key={item} className="flex items-start gap-3 text-sm text-gray-300">
                  <CheckCircle className="w-4 h-4 text-[#6366F1] flex-shrink-0 mt-0.5" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={onCTA}
              className="inline-flex items-center gap-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold px-6 py-3 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:ring-offset-2 focus:ring-offset-[#1C1C1E]"
            >
              Try Client Pulse AI free <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          {/* Right — mock pulse card */}
          <div className="relative" aria-hidden="true">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF6B6B] to-[#FF8E53] flex items-center justify-center text-white text-sm font-bold">JD</div>
                  <div>
                    <p className="text-sm font-semibold text-white">Jessica Davis</p>
                    <p className="text-xs text-gray-400">Business Consultant</p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FF6B6B] animate-pulse" />
                    <span className="text-xs font-bold text-[#FF6B6B]">Churn Risk</span>
                  </div>
                  <div className="text-2xl font-extrabold text-white mt-0.5" style={{ fontFamily: "Sora, sans-serif" }}>24</div>
                  <div className="text-[10px] text-gray-500">Health Score</div>
                </div>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 mb-5">
                <div className="h-2 rounded-full bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53]" style={{ width: "24%" }} />
              </div>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {signals.map(s => (
                  <div key={s.label} className="bg-white/5 rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 mb-0.5">{s.label}</p>
                    <p className="text-sm font-bold text-[#FF6B6B]">{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="bg-[#6366F1]/10 border border-[#6366F1]/20 rounded-xl p-3 mb-4">
                <p className="text-xs text-[#A5B4FC] font-semibold mb-1">AI Insight</p>
                <p className="text-xs text-gray-300 leading-relaxed">Jessica has gone quiet after a strong Q3. Her last booking was 14 days ago and she has an unpaid invoice. High risk of churn — reach out now.</p>
              </div>
              <button className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-semibold py-2.5 rounded-xl transition-colors">
                Use AI Draft → Send to Follow-Ups
              </button>
            </div>
            {/* Floating badges */}
            <div className="absolute -top-4 -right-4 bg-white rounded-xl px-3 py-2 shadow-xl flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#00C9A7]/15 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-[#00C9A7]" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500">Upsell Ready</p>
                <p className="text-xs font-bold text-gray-900">3 clients</p>
              </div>
            </div>
            <div className="absolute -bottom-4 -left-4 bg-white rounded-xl px-3 py-2 shadow-xl flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#FF6B6B]/15 flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-[#FF6B6B]" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500">Churn Risk</p>
                <p className="text-xs font-bold text-gray-900">2 clients</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────────────────────────────
function CTASection({ onCTA }: { onCTA: () => void }) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const captureLead = trpc.leads.capture.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    if (!email.trim()) { setEmailError("Please enter your email address"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError("Please enter a valid email address"); return; }
    try {
      await captureLead.mutateAsync({ email: email.trim(), source: "footer" });
      setSubmitted(true);
      toast.success(`🎉 You're on the list! We'll be in touch at ${email}.`);
      setEmail("");
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  };

  return (
    <section className="py-16 sm:py-24 bg-[#1C1C1E] relative overflow-hidden" aria-labelledby="cta-heading">
      <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-[#00C9A7] opacity-10 blur-3xl" />
      </div>
      <div className="container relative z-10 text-center">
        <div className="inline-flex items-center gap-2 bg-[#00C9A7]/15 text-[#00C9A7] border border-[#00C9A7]/30 rounded-full px-4 py-1.5 text-xs font-semibold mb-6">
          <DollarSign className="w-3 h-3" aria-hidden="true" />Start Your Path to $1M
        </div>
        <h2 id="cta-heading" className="text-3xl sm:text-4xl lg:text-6xl font-extrabold text-white mb-6" style={{ fontFamily: "Sora, sans-serif" }}>
          Ready to stop trading<br /><span className="text-[#00C9A7]">time for money?</span>
        </h2>
        <p className="text-base sm:text-lg text-gray-400 max-w-xl mx-auto mb-8 sm:mb-10">
          Join 4,200+ freelancers who automated their business with TrueAxis HQ. 14-day free trial. No credit card required.
        </p>

        <form onSubmit={handleSubmit} className="max-w-md mx-auto mb-6" noValidate>
          <label htmlFor="cta-email" className="sr-only">Email address to get started</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="cta-email"
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setEmailError(""); }}
              placeholder="Enter your email address"
              autoComplete="email"
              aria-required="true"
              aria-invalid={!!emailError}
              aria-describedby={emailError ? "cta-email-error" : undefined}
              className={`flex-1 px-4 py-3.5 text-sm bg-white/10 border rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00C9A7] transition-colors min-h-[48px] ${emailError ? "border-red-400" : "border-white/20"}`}
            />
            <Button
              type="submit"
              disabled={captureLead.isPending || submitted}
              className="gradient-teal text-white border-0 hover:opacity-90 px-6 whitespace-nowrap min-h-[48px] focus:ring-2 focus:ring-[#00C9A7] focus:ring-offset-2 focus:ring-offset-[#1C1C1E] disabled:opacity-60"
            >
              {submitted ? "You're on the list! ✓" : captureLead.isPending ? "Saving..." : "Get Started"}
            </Button>
          </div>
          {emailError && <p id="cta-email-error" role="alert" className="text-xs text-red-400 mt-1.5 text-left">{emailError}</p>}
        </form>

        <button
          onClick={onCTA}
          className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 mx-auto focus:outline-none focus:ring-2 focus:ring-[#00C9A7] rounded px-2 py-1"
        >
          <ChevronRight className="w-4 h-4 text-[#00C9A7]" aria-hidden="true" />
          Start with a full account instead
        </button>

        <ul className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-8 text-sm text-gray-500 list-none" aria-label="Trial benefits">
          {["No credit card", "14-day free trial", "Cancel anytime"].map(item => (
            <li key={item} className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-[#00C9A7]" aria-hidden="true" />{item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  const [, navigate] = useLocation();

  return (
    <footer className="bg-[#111111] py-10 sm:py-12">
      <div className="container">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg gradient-teal flex items-center justify-center" aria-hidden="true">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-white" style={{ fontFamily: "Sora, sans-serif" }}>TrueAxis HQ</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">The all-in-one AI platform for freelancers and solo service providers.</p>
          </div>
          {[
            {
              title: "Product",
              links: [
                { label: "Features", action: () => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" }) },
                { label: "Pricing", action: () => navigate("/pricing") },
                { label: "Dashboard", action: () => navigate("/dashboard") },
              ],
            },
            {
              title: "Company",
              links: [
                { label: "About", action: () => navigate("/about") },
                { label: "Contact", action: () => navigate("/contact") },
                { label: "Careers", action: () => window.location.href = "mailto:careers@trueaxishq.com" },
              ],
            },
            {
              title: "Support",
              links: [
                { label: "Help Center", action: () => navigate("/help") },
                { label: "Privacy Policy", action: () => navigate("/privacy") },
                { label: "Terms of Service", action: () => navigate("/terms") },
              ],
            },
          ].map(col => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">{col.title}</h3>
              <ul className="space-y-2">
                {col.links.map(link => (
                  <li key={link.label}>
                    <button
                      className="text-sm text-gray-500 hover:text-[#00C9A7] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00C9A7] rounded px-0.5 min-h-[36px] text-left"
                      onClick={link.action}
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">© 2026 TrueAxis HQ. All rights reserved.</p>
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-[#00C9A7]" aria-hidden="true" />
            <span className="text-xs text-gray-600">SOC 2 Type II Certified · GDPR Compliant</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function Home() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  return (
    <div className="min-h-screen">
      <OnboardingModal open={showOnboarding} onClose={() => setShowOnboarding(false)} />
      <Navbar onCTA={() => setShowOnboarding(true)} />
      <HeroSection onCTA={() => setShowOnboarding(true)} />
      <StatsBar />
      <FeaturesSection onCTA={() => setShowOnboarding(true)} />
      <HowItWorksSection onCTA={() => setShowOnboarding(true)} />
      <TestimonialsSection />
      <ClientPulseShowcase onCTA={() => setShowOnboarding(true)} />
      <CTASection onCTA={() => setShowOnboarding(true)} />
      <Footer />
    </div>
  );
}
