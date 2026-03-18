import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Zap, Target, Heart, Shield, Users, TrendingUp, ArrowLeft, CheckCircle } from "lucide-react";

export default function About() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-[#1C1C1E] text-white">
      {/* Nav */}
      <nav className="border-b border-white/10 px-4 sm:px-6 py-4 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-[#00C9A7] hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#00C9A7] rounded px-2 py-1">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Home</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00C9A7] to-[#00A88A] flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold" style={{ fontFamily: "Sora, sans-serif" }}>TrueAxis HQ</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 sm:py-28 px-4 text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-[#00C9A7] opacity-8 blur-3xl pointer-events-none" />
        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-[#00C9A7]/15 text-[#00C9A7] border border-[#00C9A7]/30 rounded-full px-4 py-1.5 text-xs font-semibold mb-6">
            <Heart className="w-3 h-3" />
            Built for Freelancers, by People Who Get It
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6" style={{ fontFamily: "Sora, sans-serif" }}>
            We built the platform<br /><span className="text-[#00C9A7]">we always needed.</span>
          </h1>
          <p className="text-lg text-gray-300 leading-relaxed max-w-2xl mx-auto">
            TrueAxis HQ was born out of frustration. We watched talented freelancers — coaches, consultants, designers, developers — spend more time on admin work than on the craft they loved. We decided to fix that.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 px-4 bg-white/3">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
          {[
            { icon: Target, title: "Our Mission", body: "To give every freelancer and solo service provider the same operational leverage that enterprise companies have — without the enterprise price tag or complexity." },
            { icon: Heart, title: "Our Values", body: "We believe your time is your most valuable asset. Every feature we build is designed to give you more of it. We are obsessively focused on simplicity, reliability, and real business impact." },
            { icon: Shield, title: "Our Promise", body: "We will never sell your data. We will never lock you in. Your client data, your invoices, your business — they belong to you. Always. We are just the engine that makes it run." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="w-10 h-10 rounded-xl bg-[#00C9A7]/15 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-[#00C9A7]" />
              </div>
              <h2 className="text-lg font-bold mb-3" style={{ fontFamily: "Sora, sans-serif" }}>{title}</h2>
              <p className="text-sm text-gray-400 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Story */}
      <section className="py-16 sm:py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-extrabold mb-8 text-center" style={{ fontFamily: "Sora, sans-serif" }}>The Story</h2>
          <div className="space-y-5 text-gray-300 leading-relaxed text-base">
            <p>In 2024, the average freelancer in the United States was juggling five or more separate tools just to run their business: a scheduling app, an invoicing tool, a CRM, an email client, and a spreadsheet for everything else. They were paying $200–$400 per month for tools that didn't talk to each other — and spending 15–20 hours per week on admin work instead of billable work.</p>
            <p>TrueAxis HQ was built to collapse all of that into one intelligent platform. We combined AI-powered automation with the core workflows every service provider needs: client management, scheduling, invoicing, follow-ups, and analytics. The result is a platform that doesn't just organize your business — it actively runs it.</p>
            <p>Today, TrueAxis HQ serves thousands of freelancers across coaching, consulting, design, development, fitness, legal, and more. Our users report saving an average of 12 hours per week and increasing their revenue by 34% within their first six months.</p>
            <p>We are a small, focused team. We don't have a massive marketing budget or a flashy office. What we have is a deep commitment to building software that actually works — software that makes your business feel effortless.</p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-4 bg-white/3">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: "4,200+", label: "Active Users" },
            { value: "12 hrs", label: "Saved Per Week" },
            { value: "34%", label: "Avg Revenue Increase" },
            { value: "99.9%", label: "Uptime SLA" },
          ].map(({ value, label }) => (
            <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <p className="text-3xl font-extrabold text-[#00C9A7] mb-1" style={{ fontFamily: "Sora, sans-serif" }}>{value}</p>
              <p className="text-sm text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What we believe */}
      <section className="py-16 sm:py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-extrabold mb-8 text-center" style={{ fontFamily: "Sora, sans-serif" }}>What We Believe</h2>
          <ul className="space-y-4">
            {[
              "Freelancers deserve enterprise-grade tools at freelancer-friendly prices.",
              "Automation should feel invisible — it should just work, without you having to think about it.",
              "Your data is yours. We are stewards of it, not owners.",
              "Good software should make you feel calm, not anxious.",
              "The best businesses are built on trust — with clients, with tools, and with each other.",
            ].map(belief => (
              <li key={belief} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                <CheckCircle className="w-5 h-5 text-[#00C9A7] mt-0.5 flex-shrink-0" />
                <span className="text-gray-300 text-sm leading-relaxed">{belief}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 text-center bg-gradient-to-b from-transparent to-black/30">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-extrabold mb-4" style={{ fontFamily: "Sora, sans-serif" }}>Ready to join us?</h2>
          <p className="text-gray-400 mb-8">Start your free 14-day trial. No credit card required.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => navigate("/dashboard")} className="bg-[#00C9A7] hover:bg-[#00A88A] text-white border-0 px-8 py-3 text-sm font-semibold rounded-xl min-h-[48px]">
              Start Free Trial
            </Button>
            <Button onClick={() => navigate("/pricing")} variant="outline" className="border-white/20 text-white hover:bg-white/10 px-8 py-3 text-sm rounded-xl min-h-[48px]">
              View Pricing
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-4 text-center text-xs text-gray-600">
        <p>© {new Date().getFullYear()} TrueAxis HQ. All rights reserved.</p>
      </footer>
    </div>
  );
}
