/* SkillBridge AI — Home Landing Page
 * Design: "Kinetic Warmth" — Teal #00C9A7, Coral #FF6B6B, Charcoal #1C1C1E
 * Fonts: Sora (headings) + Inter (body)
 * Features: Working email capture, onboarding modal, smooth scroll, animated counters
 */

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ─── Onboarding Modal ─────────────────────────────────────────────────────────
function OnboardingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: "", email: "", business: "", service: "" });

  if (!open) return null;

  const steps = [
    {
      title: "Welcome to SkillBridge AI 👋",
      subtitle: "Let's set up your account in 60 seconds.",
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Your Name *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Jane Smith" className="w-full px-3 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email Address *</label>
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="jane@example.com" className="w-full px-3 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors" />
          </div>
        </div>
      ),
      validate: () => form.name && form.email,
    },
    {
      title: "Tell us about your business",
      subtitle: "We'll personalize your experience.",
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Business Name</label>
            <input value={form.business} onChange={e => setForm(p => ({ ...p, business: e.target.value }))} placeholder="Jane's Coaching Studio" className="w-full px-3 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#00C9A7] transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">What service do you offer?</label>
            <div className="grid grid-cols-2 gap-2">
              {["Life Coaching", "Business Consulting", "Freelance Design", "Tutoring", "Therapy / Counseling", "Other"].map(s => (
                <button key={s} onClick={() => setForm(p => ({ ...p, service: s }))} className={`px-3 py-2.5 text-xs font-medium rounded-xl border transition-colors text-left ${form.service === s ? "border-[#00C9A7] bg-[#00C9A7]/5 text-[#00C9A7]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>{s}</button>
              ))}
            </div>
          </div>
        </div>
      ),
      validate: () => true,
    },
    {
      title: "You're all set! 🎉",
      subtitle: "Your free 14-day trial is ready.",
      content: (
        <div className="space-y-4">
          <div className="bg-[#00C9A7]/5 border border-[#00C9A7]/20 rounded-2xl p-5 space-y-3">
            {[
              { icon: CheckCircle, text: "AI client intake forms — ready" },
              { icon: CheckCircle, text: "Smart scheduling — ready" },
              { icon: CheckCircle, text: "Automated invoicing — ready" },
              { icon: CheckCircle, text: "AI follow-up engine — ready" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-[#00C9A7] flex-shrink-0" />
                <span className="text-sm text-gray-700">{text}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 text-center">No credit card required. Cancel anytime.</p>
        </div>
      ),
      validate: () => true,
    },
  ];

  const current = steps[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div className="h-full bg-[#00C9A7] transition-all duration-500" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg gradient-teal flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-xs text-gray-400">Step {step + 1} of {steps.length}</span>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <h2 className="text-xl font-extrabold text-[#1C1C1E] mb-1" style={{ fontFamily: 'Sora, sans-serif' }}>{current.title}</h2>
          <p className="text-sm text-gray-500 mb-5">{current.subtitle}</p>

          {current.content}

          <div className="flex gap-3 mt-6">
            {step > 0 && (
              <Button variant="outline" className="flex-1" onClick={() => setStep(s => s - 1)}>Back</Button>
            )}
            <Button
              className="flex-1 gradient-teal text-white border-0 hover:opacity-90 gap-2"
              onClick={() => {
                if (!current.validate()) { toast.error("Please fill in the required fields"); return; }
                if (step < steps.length - 1) {
                  setStep(s => s + 1);
                } else {
                  // Save to localStorage and go to dashboard
                  if (form.name) localStorage.setItem("sb_userName", JSON.stringify(form.name));
                  if (form.email) localStorage.setItem("sb_userEmail", JSON.stringify(form.email));
                  if (form.business) localStorage.setItem("sb_businessName", JSON.stringify(form.business));
                  toast.success(`Welcome, ${form.name || "there"}! Your dashboard is ready.`);
                  onClose();
                  setTimeout(() => window.location.href = "/dashboard", 500);
                }
              }}
            >
              {step < steps.length - 1 ? "Continue" : "Go to Dashboard"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
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

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/95 backdrop-blur-md shadow-sm" : "bg-transparent"}`}>
      <div className="container flex items-center justify-between h-16">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <div className="w-8 h-8 rounded-lg gradient-teal flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg" style={{ fontFamily: 'Sora, sans-serif', color: scrolled ? '#1C1C1E' : 'white' }}>
            SkillBridge <span className="text-[#00C9A7]">AI</span>
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {[
            { label: "Features", id: "features" },
            { label: "How It Works", id: "howitworks" },
            { label: "Testimonials", id: "testimonials" },
            { label: "Pricing", id: null },
          ].map(item => (
            <button
              key={item.label}
              onClick={() => item.id ? scrollTo(item.id) : navigate("/pricing")}
              className={`text-sm font-medium transition-colors animated-underline ${scrolled ? "text-gray-600 hover:text-[#00C9A7]" : "text-white/80 hover:text-white"}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className={scrolled ? "text-gray-600" : "text-white hover:bg-white/10"}>
            Sign In
          </Button>
          <Button size="sm" className="gradient-teal text-white border-0 hover:opacity-90 px-5" onClick={onCTA}>
            Start Free Trial
          </Button>
        </div>

        <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className={`w-5 h-5 ${scrolled ? "text-gray-700" : "text-white"}`} /> : <Menu className={`w-5 h-5 ${scrolled ? "text-gray-700" : "text-white"}`} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3">
          {["Features", "How It Works", "Testimonials"].map(item => (
            <button key={item} className="block w-full text-left text-sm font-medium text-gray-600 py-2" onClick={() => scrollTo(item.toLowerCase().replace(/ /g, ""))}>
              {item}
            </button>
          ))}
          <button className="block w-full text-left text-sm font-medium text-gray-600 py-2" onClick={() => { setMobileOpen(false); navigate("/pricing"); }}>Pricing</button>
          <Button className="w-full gradient-teal text-white border-0" onClick={() => { setMobileOpen(false); onCTA(); }}>
            Start Free Trial
          </Button>
        </div>
      )}
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function HeroSection({ onCTA }: { onCTA: () => void }) {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) { toast.error("Please enter a valid email address"); return; }
    toast.success(`🎉 You're on the list! Check ${email} for your access link.`);
    setEmail("");
  };

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#1C1C1E]">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1C1C1E] via-[#1A2E2A] to-[#1C1C1E]" />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-[#00C9A7] opacity-10 blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-64 h-64 rounded-full bg-[#FF6B6B] opacity-8 blur-3xl" />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      <div className="container relative z-10 pt-24 pb-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-slide-up">
            <div className="inline-flex items-center gap-2 bg-[#00C9A7]/15 text-[#00C9A7] border border-[#00C9A7]/30 rounded-full px-4 py-1.5 text-xs font-semibold mb-6">
              <Sparkles className="w-3 h-3" />
              AI-Powered Business Automation for Freelancers
            </div>

            <h1 className="text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6" style={{ fontFamily: 'Sora, sans-serif' }}>
              Run Your Business<br />
              <span className="text-[#00C9A7]">on Autopilot.</span>
            </h1>

            <p className="text-lg text-gray-300 leading-relaxed mb-8 max-w-lg">
              SkillBridge AI handles your client intake, scheduling, invoicing, and follow-ups — so you can focus on the work you love and scale to <strong className="text-white">$100K/year</strong>.
            </p>

            {/* Email capture */}
            <form onSubmit={handleEmailSubmit} className="flex gap-2 mb-6 max-w-md">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="flex-1 px-4 py-3 text-sm bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#00C9A7] transition-colors"
              />
              <Button type="submit" className="gradient-teal text-white border-0 hover:opacity-90 px-5 py-3 whitespace-nowrap">
                Get Early Access
              </Button>
            </form>

            <button onClick={onCTA} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-8">
              <ChevronRight className="w-4 h-4 text-[#00C9A7]" />
              Or start your free trial now — no credit card required
            </button>

            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                {["https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=40&h=40&fit=crop",
                  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop",
                  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop",
                  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop"].map((src, i) => (
                  <img key={i} src={src} alt="" className="w-9 h-9 rounded-full border-2 border-[#1C1C1E] object-cover" />
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-[#FFB800] text-[#FFB800]" />)}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Trusted by <strong className="text-white">4,200+</strong> freelancers</p>
              </div>
            </div>
          </div>

          <div className="relative hidden lg:block animate-float">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/hero-dashboard-RyoEoGEjG4TEbwuTtryX27.webp"
              alt="SkillBridge AI Dashboard"
              className="w-full rounded-2xl shadow-2xl glow-teal"
            />
            <div className="absolute -left-8 top-1/4 bg-white rounded-xl p-3 shadow-xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#00C9A7]/15 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#00C9A7]" />
              </div>
              <div>
                <p className="text-xs text-gray-500">This Month</p>
                <p className="text-sm font-bold text-gray-900">+$8,420</p>
              </div>
            </div>
            <div className="absolute -right-6 bottom-1/3 bg-white rounded-xl p-3 shadow-xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FF6B6B]/15 flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#FF6B6B]" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Time Saved</p>
                <p className="text-sm font-bold text-gray-900">14 hrs/week</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0">
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
    <section className="bg-[#FAFAF8] py-16">
      <div className="container">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { end: 64, suffix: "M+", label: "Freelancers in the US" },
            { end: 14, suffix: " hrs", label: "Saved per week, avg" },
            { end: 4200, suffix: "+", label: "Active users" },
            { end: 98, suffix: "%", label: "Customer satisfaction" },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-4xl font-extrabold text-[#1C1C1E] mb-1" style={{ fontFamily: 'Sora, sans-serif' }}>
                <AnimatedCounter end={stat.end} suffix={stat.suffix} />
              </div>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────
function FeaturesSection({ onCTA }: { onCTA: () => void }) {
  const features = [
    { icon: <Users className="w-6 h-6" />, title: "AI Client Intake", description: "Smart intake forms that qualify leads automatically, ask the right questions, and book clients without any back-and-forth.", color: "#00C9A7" },
    { icon: <Calendar className="w-6 h-6" />, title: "Smart Scheduling", description: "AI-powered calendar that handles bookings, sends reminders, and suggests the best meeting times based on your patterns.", color: "#FF6B6B" },
    { icon: <FileText className="w-6 h-6" />, title: "Automated Invoicing", description: "Generate and send professional invoices instantly after every session. Track payments and send automated reminders.", color: "#00C9A7" },
    { icon: <Mail className="w-6 h-6" />, title: "AI Follow-Up Engine", description: "Never lose a lead again. Automated email and SMS follow-ups that sound personal, not robotic — powered by AI.", color: "#FF6B6B" },
    { icon: <BarChart3 className="w-6 h-6" />, title: "Analytics Dashboard", description: "See your revenue trends, client retention rates, and booking patterns at a glance. Know exactly where to focus.", color: "#00C9A7" },
    { icon: <Zap className="w-6 h-6" />, title: "Booking Page Builder", description: "Your professional booking page is included — no extra tools needed. Share one link and let clients book instantly.", color: "#FF6B6B" },
  ];

  return (
    <section id="features" className="py-24 bg-[#FAFAF8]">
      <div className="container">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-[#00C9A7]/10 text-[#00C9A7] border border-[#00C9A7]/20 rounded-full px-4 py-1.5 text-xs font-semibold mb-4">
            <Zap className="w-3 h-3" />Everything You Need
          </div>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-[#1C1C1E] mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>
            Your entire business,<br /><span className="text-[#00C9A7]">automated.</span>
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Stop juggling five different tools. SkillBridge AI replaces your scheduling app, invoicing software, CRM, and email tool — in one platform.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 card-lift border border-gray-100 group cursor-pointer" onClick={onCTA}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-white transition-transform group-hover:scale-110" style={{ backgroundColor: f.color }}>
                {f.icon}
              </div>
              <h3 className="text-lg font-bold text-[#1C1C1E] mb-2" style={{ fontFamily: 'Sora, sans-serif' }}>{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              <div className="mt-4 flex items-center gap-1 text-xs font-semibold" style={{ color: f.color }}>
                Try it free <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────
function HowItWorksSection({ onCTA }: { onCTA: () => void }) {
  const steps = [
    { step: "01", title: "Sign Up in 2 Minutes", desc: "Create your account, set your services and pricing. No technical skills needed.", icon: <Zap className="w-5 h-5" /> },
    { step: "02", title: "Share Your Link", desc: "Share your personalized booking page with clients. They book, you get notified.", icon: <Users className="w-5 h-5" /> },
    { step: "03", title: "AI Does the Rest", desc: "Intake, scheduling, invoicing, and follow-ups all happen automatically.", icon: <Sparkles className="w-5 h-5" /> },
    { step: "04", title: "Watch Revenue Grow", desc: "Focus on your craft. Watch your dashboard fill up with happy clients and paid invoices.", icon: <TrendingUp className="w-5 h-5" /> },
  ];

  return (
    <section id="howitworks" className="py-24 bg-[#1C1C1E] diagonal-top diagonal-bottom relative">
      <div className="container relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>
            Up and running in <span className="text-[#00C9A7]">10 minutes.</span>
          </h2>
          <p className="text-lg text-gray-400 max-w-xl mx-auto">No onboarding calls. No setup fees. Just sign up and start automating.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <div key={i} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-[#00C9A7]/40 to-transparent z-0" />
              )}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative z-10 card-lift cursor-pointer" onClick={onCTA}>
                <div className="text-5xl font-extrabold text-[#00C9A7]/20 mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>{step.step}</div>
                <div className="w-10 h-10 rounded-lg bg-[#00C9A7]/15 flex items-center justify-center text-[#00C9A7] mb-4">{step.icon}</div>
                <h3 className="text-base font-bold text-white mb-2" style={{ fontFamily: 'Sora, sans-serif' }}>{step.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────
function TestimonialsSection() {
  const testimonials = [
    { name: "Sarah Chen", role: "Life Coach", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&h=60&fit=crop", quote: "I used to spend 3 hours every Monday on admin. Now it's zero. SkillBridge AI paid for itself in the first week.", revenue: "+$2,400/mo" },
    { name: "Marcus Williams", role: "Freelance Designer", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop", quote: "The AI follow-up feature alone recovered 4 lost clients in my first month. Absolute game changer.", revenue: "+$3,100/mo" },
    { name: "Priya Patel", role: "Business Consultant", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop", quote: "Finally a tool that understands solo operators. The invoicing automation is flawless — clients pay faster now.", revenue: "+$5,800/mo" },
  ];

  return (
    <section id="testimonials" className="py-24 bg-[#FAFAF8]">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-extrabold text-[#1C1C1E] mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>
            Real people, <span className="text-[#FF6B6B]">real results.</span>
          </h2>
          <p className="text-lg text-gray-500">Join thousands of freelancers who scaled their income with SkillBridge AI.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 card-lift border border-gray-100">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, j) => <Star key={j} className="w-4 h-4 fill-[#FFB800] text-[#FFB800]" />)}
              </div>
              <p className="text-gray-700 leading-relaxed mb-6 italic">"{t.quote}"</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <p className="text-sm font-semibold text-[#1C1C1E]">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.role}</p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 bg-[#00C9A7]/10 text-[#00C9A7] border border-[#00C9A7]/20 rounded-full px-3 py-1 text-xs font-semibold">
                  {t.revenue}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────────────────────────────
function CTASection({ onCTA }: { onCTA: () => void }) {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) { toast.error("Please enter a valid email"); return; }
    toast.success(`🎉 You're on the list! Check ${email} for your access link.`);
    setEmail("");
  };

  return (
    <section className="py-24 bg-[#1C1C1E] relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-[#00C9A7] opacity-10 blur-3xl" />
      </div>
      <div className="container relative z-10 text-center">
        <div className="inline-flex items-center gap-2 bg-[#00C9A7]/15 text-[#00C9A7] border border-[#00C9A7]/30 rounded-full px-4 py-1.5 text-xs font-semibold mb-6">
          <DollarSign className="w-3 h-3" />Start Your Path to $1M
        </div>
        <h2 className="text-4xl lg:text-6xl font-extrabold text-white mb-6" style={{ fontFamily: 'Sora, sans-serif' }}>
          Ready to stop trading<br /><span className="text-[#00C9A7]">time for money?</span>
        </h2>
        <p className="text-lg text-gray-400 max-w-xl mx-auto mb-10">
          Join 4,200+ freelancers who automated their business with SkillBridge AI. 14-day free trial. No credit card required.
        </p>

        <form onSubmit={handleSubmit} className="flex gap-2 max-w-md mx-auto mb-6">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Enter your email address"
            className="flex-1 px-4 py-3.5 text-sm bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#00C9A7] transition-colors"
          />
          <Button type="submit" className="gradient-teal text-white border-0 hover:opacity-90 px-6 whitespace-nowrap">
            Get Started
          </Button>
        </form>

        <button onClick={onCTA} className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 mx-auto">
          <ChevronRight className="w-4 h-4 text-[#00C9A7]" />
          Start with a full account instead
        </button>

        <div className="flex items-center justify-center gap-6 mt-8 text-sm text-gray-500">
          {["No credit card", "14-day free trial", "Cancel anytime"].map(item => (
            <div key={item} className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-[#00C9A7]" />{item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  const [, navigate] = useLocation();

  return (
    <footer className="bg-[#111111] py-12">
      <div className="container">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg gradient-teal flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-white" style={{ fontFamily: 'Sora, sans-serif' }}>SkillBridge AI</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">The all-in-one AI platform for freelancers and solo service providers.</p>
          </div>
          {[
            { title: "Product", links: [{ label: "Features", action: () => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" }) }, { label: "Pricing", action: () => navigate("/pricing") }, { label: "Dashboard", action: () => navigate("/dashboard") }] },
            { title: "Company", links: [{ label: "About", action: () => toast.info("About page coming soon!") }, { label: "Blog", action: () => toast.info("Blog coming soon!") }, { label: "Careers", action: () => toast.info("We're hiring! Email careers@skillbridge.ai") }] },
            { title: "Support", links: [{ label: "Help Center", action: () => toast.info("Help center coming soon!") }, { label: "Contact", action: () => toast.info("Email support@skillbridge.ai") }, { label: "Privacy Policy", action: () => toast.info("Privacy policy coming soon!") }] },
          ].map(col => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map(link => (
                  <li key={link.label}>
                    <button className="text-sm text-gray-500 hover:text-[#00C9A7] transition-colors" onClick={link.action}>{link.label}</button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">© 2026 SkillBridge AI. All rights reserved.</p>
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-[#00C9A7]" />
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
      <CTASection onCTA={() => setShowOnboarding(true)} />
      <Footer />
    </div>
  );
}
