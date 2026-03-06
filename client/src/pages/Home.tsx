/* SkillBridge AI — Home Landing Page
 * Design: "Kinetic Warmth" — Teal #00C9A7, Coral #FF6B6B, Charcoal #1C1C1E
 * Fonts: Sora (headings) + Inter (body)
 * Layout: Asymmetric hero, diagonal breaks, floating cards
 */

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Zap, Calendar, FileText, Mail, BarChart3, Users,
  ArrowRight, CheckCircle, Star, Menu, X, Sparkles,
  TrendingUp, Clock, DollarSign, Shield
} from "lucide-react";

// ─── Animated Counter ───────────────────────────────────────────────────────
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
          if (progress >= 1) clearInterval(timer);
        }, 16);
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ─── Navbar ─────────────────────────────────────────────────────────────────
function Navbar() {
  const [, navigate] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/95 backdrop-blur-md shadow-sm" : "bg-transparent"}`}>
      <div className="container flex items-center justify-between h-16">
        {/* Logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
          <div className="w-8 h-8 rounded-lg gradient-teal flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg" style={{ fontFamily: 'Sora, sans-serif', color: '#1C1C1E' }}>
            SkillBridge <span className="text-teal">AI</span>
          </span>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {["Features", "Pricing", "Testimonials"].map((item) => (
            <button
              key={item}
              onClick={() => item === "Pricing" ? navigate("/pricing") : document.getElementById(item.toLowerCase())?.scrollIntoView({ behavior: "smooth" })}
              className="text-sm font-medium text-gray-600 hover:text-[#00C9A7] transition-colors animated-underline"
            >
              {item}
            </button>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="text-gray-600">
            Sign In
          </Button>
          <Button size="sm" className="gradient-teal text-white border-0 hover:opacity-90 transition-opacity px-5" onClick={() => navigate("/dashboard")}>
            Start Free Trial
          </Button>
        </div>

        {/* Mobile Menu Toggle */}
        <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3">
          {["Features", "Pricing", "Testimonials"].map((item) => (
            <button key={item} className="block w-full text-left text-sm font-medium text-gray-600 py-2" onClick={() => { setMobileOpen(false); item === "Pricing" ? navigate("/pricing") : document.getElementById(item.toLowerCase())?.scrollIntoView({ behavior: "smooth" }); }}>
              {item}
            </button>
          ))}
          <Button className="w-full gradient-teal text-white border-0" onClick={() => navigate("/dashboard")}>
            Start Free Trial
          </Button>
        </div>
      )}
    </nav>
  );
}

// ─── Hero Section ────────────────────────────────────────────────────────────
function HeroSection() {
  const [, navigate] = useLocation();

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#1C1C1E]">
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src="https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/hero-bg-abstract-WLrPm9ocJQZ9dNvNk6guuo.webp"
          alt=""
          className="w-full h-full object-cover opacity-10"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#1C1C1E] via-[#1A2E2A] to-[#1C1C1E]" />
        {/* Teal glow orb */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-[#00C9A7] opacity-10 blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-64 h-64 rounded-full bg-[#FF6B6B] opacity-8 blur-3xl" />
      </div>

      <div className="container relative z-10 pt-24 pb-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Copy */}
          <div className="animate-slide-up">
            <div className="pill-badge bg-[#00C9A7]/15 text-[#00C9A7] border border-[#00C9A7]/30 mb-6 w-fit">
              <Sparkles className="w-3 h-3" />
              AI-Powered Business Automation
            </div>

            <h1 className="text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6" style={{ fontFamily: 'Sora, sans-serif' }}>
              Run Your Business
              <br />
              <span className="text-[#00C9A7]">on Autopilot.</span>
            </h1>

            <p className="text-lg text-gray-300 leading-relaxed mb-8 max-w-lg">
              SkillBridge AI handles your client intake, scheduling, invoicing, and follow-ups — so you can focus on the work you love and scale to <strong className="text-white">$100K/year</strong>.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-10">
              <Button
                size="lg"
                className="gradient-teal text-white border-0 hover:opacity-90 text-base px-8 py-6 animate-pulse-glow"
                onClick={() => navigate("/dashboard")}
              >
                Start Free — No Credit Card
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10 text-base px-8 py-6 bg-transparent"
                onClick={() => navigate("/pricing")}
              >
                View Pricing
              </Button>
            </div>

            {/* Social proof */}
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

          {/* Right: Dashboard Preview */}
          <div className="relative hidden lg:block animate-float">
            <div className="relative">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/hero-dashboard-RyoEoGEjG4TEbwuTtryX27.webp"
                alt="SkillBridge AI Dashboard"
                className="w-full rounded-2xl shadow-2xl glow-teal"
              />
              {/* Floating stat cards */}
              <div className="absolute -left-8 top-1/4 bg-white rounded-xl p-3 shadow-xl flex items-center gap-3 animate-slide-up" style={{ animationDelay: '0.3s' }}>
                <div className="w-10 h-10 rounded-lg bg-[#00C9A7]/15 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-[#00C9A7]" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">This Month</p>
                  <p className="text-sm font-bold text-gray-900">+$8,420</p>
                </div>
              </div>
              <div className="absolute -right-6 bottom-1/3 bg-white rounded-xl p-3 shadow-xl flex items-center gap-3 animate-slide-up" style={{ animationDelay: '0.5s' }}>
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
      </div>

      {/* Diagonal break */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
          <path d="M0 80L1440 0V80H0Z" fill="#FAFAF8" />
        </svg>
      </div>
    </section>
  );
}

// ─── Stats Bar ───────────────────────────────────────────────────────────────
function StatsBar() {
  const stats = [
    { value: 64, suffix: "M+", label: "Freelancers in the US" },
    { value: 14, suffix: " hrs", label: "Saved per week, avg" },
    { value: 4200, suffix: "+", label: "Active users" },
    { value: 98, suffix: "%", label: "Customer satisfaction" },
  ];

  return (
    <section className="bg-[#FAFAF8] py-16">
      <div className="container">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-4xl font-extrabold text-[#1C1C1E] mb-1" style={{ fontFamily: 'Sora, sans-serif' }}>
                <AnimatedCounter end={stat.value} suffix={stat.suffix} />
              </div>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features Section ────────────────────────────────────────────────────────
function FeaturesSection() {
  const features = [
    {
      icon: <Users className="w-6 h-6" />,
      title: "AI Client Intake",
      description: "Smart intake forms that qualify leads automatically, ask the right questions, and book clients without any back-and-forth.",
      image: "https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/feature-ai-intake-GxzdtEsn25xor7Pr3NdtcF.webp",
      color: "#00C9A7",
    },
    {
      icon: <Calendar className="w-6 h-6" />,
      title: "Smart Scheduling",
      description: "AI-powered calendar that handles bookings, sends reminders, and even suggests the best meeting times based on your patterns.",
      image: "https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/feature-scheduling-7wvNcj9DXjQYaYU4DcvcoX.webp",
      color: "#FF6B6B",
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: "Automated Invoicing",
      description: "Generate and send professional invoices instantly after every session. Track payments and send automated reminders.",
      image: "https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/feature-invoicing-3YZ6LLn8paEsRnWxkPvpMb.webp",
      color: "#00C9A7",
    },
    {
      icon: <Mail className="w-6 h-6" />,
      title: "AI Follow-Up Engine",
      description: "Never lose a lead again. Automated email and SMS follow-ups that sound personal, not robotic — powered by AI.",
      image: null,
      color: "#FF6B6B",
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Analytics Dashboard",
      description: "See your revenue trends, client retention rates, and booking patterns at a glance. Know exactly where to focus.",
      image: null,
      color: "#00C9A7",
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Mini Website Builder",
      description: "Your professional booking page is included — no extra tools needed. Share one link and let clients book instantly.",
      image: null,
      color: "#FF6B6B",
    },
  ];

  return (
    <section id="features" className="py-24 bg-[#FAFAF8]">
      <div className="container">
        <div className="text-center mb-16">
          <div className="pill-badge bg-[#00C9A7]/10 text-[#00C9A7] border border-[#00C9A7]/20 mb-4 mx-auto w-fit">
            <Zap className="w-3 h-3" />
            Everything You Need
          </div>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-[#1C1C1E] mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>
            Your entire business,<br />
            <span className="text-[#00C9A7]">automated.</span>
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Stop juggling five different tools. SkillBridge AI replaces your scheduling app, invoicing software, CRM, and email tool — in one beautiful platform.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-6 card-lift border border-gray-100 overflow-hidden"
            >
              {feature.image && (
                <div className="mb-4 rounded-xl overflow-hidden h-40">
                  <img src={feature.image} alt={feature.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-white"
                style={{ backgroundColor: feature.color }}
              >
                {feature.icon}
              </div>
              <h3 className="text-lg font-bold text-[#1C1C1E] mb-2" style={{ fontFamily: 'Sora, sans-serif' }}>
                {feature.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ────────────────────────────────────────────────────────────
function HowItWorksSection() {
  const steps = [
    { step: "01", title: "Sign Up in 2 Minutes", desc: "Create your account, set your services and pricing. No technical skills needed.", icon: <Zap className="w-5 h-5" /> },
    { step: "02", title: "Share Your Link", desc: "Share your personalized booking page with clients. They book, you get notified.", icon: <Users className="w-5 h-5" /> },
    { step: "03", title: "AI Does the Rest", desc: "Intake, scheduling, invoicing, and follow-ups all happen automatically.", icon: <Sparkles className="w-5 h-5" /> },
    { step: "04", title: "Watch Revenue Grow", desc: "Focus on your craft. Watch your dashboard fill up with happy clients and paid invoices.", icon: <TrendingUp className="w-5 h-5" /> },
  ];

  return (
    <section className="py-24 bg-[#1C1C1E] diagonal-top diagonal-bottom relative">
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
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative z-10 card-lift">
                <div className="text-5xl font-extrabold text-[#00C9A7]/20 mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>{step.step}</div>
                <div className="w-10 h-10 rounded-lg bg-[#00C9A7]/15 flex items-center justify-center text-[#00C9A7] mb-4">
                  {step.icon}
                </div>
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

// ─── Testimonials ────────────────────────────────────────────────────────────
function TestimonialsSection() {
  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Life Coach",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&h=60&fit=crop",
      quote: "I used to spend 3 hours every Monday on admin. Now it's zero. SkillBridge AI paid for itself in the first week.",
      revenue: "+$2,400/mo",
    },
    {
      name: "Marcus Williams",
      role: "Freelance Designer",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop",
      quote: "The AI follow-up feature alone recovered 4 lost clients in my first month. Absolute game changer.",
      revenue: "+$3,100/mo",
    },
    {
      name: "Priya Patel",
      role: "Business Consultant",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop",
      quote: "Finally a tool that understands solo operators. The invoicing automation is flawless — clients pay faster now.",
      revenue: "+$5,800/mo",
    },
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
                <div className="pill-badge bg-[#00C9A7]/10 text-[#00C9A7] border border-[#00C9A7]/20 text-xs">
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

// ─── CTA Section ─────────────────────────────────────────────────────────────
function CTASection() {
  const [, navigate] = useLocation();

  return (
    <section className="py-24 bg-[#1C1C1E] relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-[#00C9A7] opacity-10 blur-3xl" />
      </div>
      <div className="container relative z-10 text-center">
        <div className="pill-badge bg-[#00C9A7]/15 text-[#00C9A7] border border-[#00C9A7]/30 mb-6 mx-auto w-fit">
          <DollarSign className="w-3 h-3" />
          Start Your Path to $1M
        </div>
        <h2 className="text-4xl lg:text-6xl font-extrabold text-white mb-6" style={{ fontFamily: 'Sora, sans-serif' }}>
          Ready to stop trading<br />
          <span className="text-[#00C9A7]">time for money?</span>
        </h2>
        <p className="text-lg text-gray-400 max-w-xl mx-auto mb-10">
          Join 4,200+ freelancers who automated their business with SkillBridge AI. 14-day free trial. No credit card required.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            className="gradient-teal text-white border-0 hover:opacity-90 text-base px-10 py-6 animate-pulse-glow"
            onClick={() => navigate("/dashboard")}
          >
            Get Started Free
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10 text-base px-10 py-6 bg-transparent"
            onClick={() => navigate("/pricing")}
          >
            See All Plans
          </Button>
        </div>
        <div className="flex items-center justify-center gap-6 mt-8 text-sm text-gray-500">
          {["No credit card", "14-day free trial", "Cancel anytime"].map((item) => (
            <div key={item} className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-[#00C9A7]" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────
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
            { title: "Product", links: ["Features", "Pricing", "Dashboard", "Integrations"] },
            { title: "Company", links: ["About", "Blog", "Careers", "Press"] },
            { title: "Support", links: ["Help Center", "Contact", "Privacy Policy", "Terms"] },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link}>
                    <button
                      className="text-sm text-gray-500 hover:text-[#00C9A7] transition-colors"
                      onClick={() => link === "Pricing" ? navigate("/pricing") : link === "Dashboard" ? navigate("/dashboard") : undefined}
                    >
                      {link}
                    </button>
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

// ─── Main Export ─────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <StatsBar />
      <FeaturesSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <CTASection />
      <Footer />
    </div>
  );
}
