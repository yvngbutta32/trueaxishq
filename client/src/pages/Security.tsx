import { TRUEAXIS_LOGO_URL } from "@shared/const";
import { ArrowLeft, ShieldCheck, KeyRound, Eye, Server, FileCheck, Lock } from "lucide-react";
import { useLocation } from "wouter";

/* Security posture page (Tier 3 item 17). Every claim below is backed by
 * shipped code in this repository — no certification claims we haven't
 * earned. When the security surface changes, update this page with it. */

const sections = [
  {
    icon: KeyRound,
    title: "Your account",
    points: [
      "Two-factor authentication (TOTP) with generated backup codes — enabled in Settings, one screen, no enterprise plan required.",
      "See every active session on your account and revoke any of them instantly.",
      "Brute-force protection: repeated failed logins lock the account and alert the owner; password reset requests are rate-limited per IP.",
    ],
  },
  {
    icon: Eye,
    title: "Your data",
    points: [
      "Workspace-scoped data: every query is bound to your account. Client portals, calendars, and public photo uploads each use their own revocable, scope-limited tokens — never your password.",
      "API keys are shown once at creation, stored only as SHA-256 hashes, compared in constant time, and can be revoked in one click. Expired and revoked keys fail closed.",
      "A security event log records suspicious activity (lockouts, blocked IPs, revoked sessions) alongside a general audit trail of sensitive actions.",
    ],
  },
  {
    icon: Server,
    title: "Our infrastructure",
    points: [
      "Hardened HTTP headers on every response: Content-Security-Policy, HSTS, X-Frame-Options SAMEORIGIN, X-Content-Type-Options, Referrer-Policy.",
      "Layered rate limiting: global request caps on API routes plus a per-key 600 req/min limit with transparent X-RateLimit headers.",
      "Automatic IP blocklisting for abusive traffic; graceful server shutdown and a non-root containerized runtime.",
    ],
  },
  {
    icon: FileCheck,
    title: "Transparency",
    points: [
      "Dependency vulnerabilities are audited continuously — 12 known CVEs were patched in our September 2026 audit pass, and the shipped changelog is public.",
      "System status and incident history are published at the status page — including incidents that make us look bad.",
      "We publish what we have and don't pretend to have more: independent compliance certifications (SOC 2, ISO 27001) are not yet in place. When they are, this page will say so.",
    ],
  },
];

export default function Security() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-[#FBFAF8]" style={{ color: "#1A1A1A" }}>
      <div className="container max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-[#6B6B6B] hover:text-[#1A1A1A]" aria-label="Back to home">
            <ArrowLeft className="w-4 h-4" /> <img src={TRUEAXIS_LOGO_URL} alt="TrueAxis HQ" className="h-7 w-auto object-contain" />
          </button>
          <button onClick={() => navigate("/status")} className="text-xs text-[#6B6B6B] hover:text-[#1A1A1A]">System status →</button>
        </div>

        <h1 className="text-2xl font-bold flex items-center gap-2"><Lock className="w-6 h-6 text-[#D4922A]" /> Security</h1>
        <p className="mt-2 text-sm text-[#6B6B6B]">
          Everything below describes features that are shipped and running — not a roadmap. Field-service software holds your
          clients' addresses, your pricing, and your money; here's exactly how that's protected.
        </p>

        <div className="mt-6 space-y-4">
          {sections.map(section => (
            <section key={section.title} className="rounded-xl border border-[#EFEEE9] bg-white p-5">
              <h2 className="text-sm font-bold flex items-center gap-2"><section.icon className="w-4 h-4 text-[#D4922A]" /> {section.title}</h2>
              <ul className="mt-3 space-y-2">
                {section.points.map(point => (
                  <li key={point.slice(0, 40)} className="flex gap-2 text-sm text-[#4A4A4A] leading-6">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-1" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <section className="mt-6 rounded-xl border border-[#D4922A]/25 bg-[#fffaf0] p-5">
          <h2 className="text-sm font-bold">Found a vulnerability?</h2>
          <p className="mt-1 text-sm text-[#4A4A4A] leading-6">
            Email <a href="mailto:security@trueaxishq.com" className="text-[#D4922A] hover:underline">security@trueaxishq.com</a> with
            the details. We investigate every credible report and fix confirmed issues fast — disclosures are welcome and appreciated.
          </p>
        </section>
      </div>
    </div>
  );
}
