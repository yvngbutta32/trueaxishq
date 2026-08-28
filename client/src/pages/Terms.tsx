import { TRUEAXIS_LOGO_URL } from "@shared/const";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Zap, FileText } from "lucide-react";

const REVIEW_STATUS = "Draft reviewed: August 28, 2026";

const sections = [
  {
    title: "1. Acceptance of Terms",
    content: `This is a product-policy draft for TrueAxis HQ. It is not presented as legally complete, enforceable, or suitable for every jurisdiction or use case.

Access, acceptance, versioning, notice, and effective-date terms require qualified legal review before public launch.`,
  },
  {
    title: "2. Description of Service",
    content: `TrueAxis HQ is a service-business workspace with client, scheduling, invoice, job, and owner-reviewed workflow tools. Available functionality can depend on account configuration and release status.

Public subscription, availability, suspension, and change-management terms require commercial and legal review before launch.`,
  },
  {
    title: "3. Account Registration and Security",
    content: `To use the Platform, you must create an account. You agree to:

- Provide accurate, current, and complete information during registration
- Maintain and promptly update your account information
- Keep your password confidential and not share it with third parties
- Notify us immediately at security@trueaxishq.com if you suspect unauthorized access to your account
- Accept responsibility for all activity that occurs under your account

You must be at least 18 years old to create an account. By registering, you represent that you meet this requirement.`,
  },
  {
    title: "4. Subscriptions and Billing",
    content: `Pricing displays product-plan information for review. It does not establish an active trial, payment method, checkout, renewal, cancellation, refund, tax, or price-change policy.

Payment-provider configuration, commercial terms, and customer notices require controlled provider testing and qualified legal review before public launch.`,
  },
  {
    title: "5. Acceptable Use",
    content: `You agree not to use the Platform to:

- Violate any applicable law, regulation, or third-party rights
- Upload, transmit, or distribute malware, viruses, or harmful code
- Attempt to gain unauthorized access to our systems or other users' accounts
- Use automated tools to scrape, crawl, or extract data from the Platform without permission
- Send spam, unsolicited commercial messages, or harassing communications
- Impersonate any person or entity or misrepresent your affiliation
- Use the Platform to process illegal transactions or facilitate fraud
- Interfere with or disrupt the integrity or performance of the Platform

We reserve the right to suspend or terminate accounts that violate these terms without notice.`,
  },
  {
    title: "6. Your Data and Content",
    content: `The platform is designed to associate workspace records with their owner. Ownership, licensing, acceptable content, export, recovery, retention, and backup terms require qualified legal and operational review before launch.

Maintain your own copies of critical business records until reviewed export and recovery procedures are published.`,
  },
  {
    title: "7. Intellectual Property",
    content: `The Platform, including its software, design, trademarks, and content created by us, is owned by TrueAxis HQ and protected by intellectual property laws. You may not copy, modify, distribute, sell, or lease any part of the Platform without our written permission.

The TrueAxis HQ name, logo, and all related marks are trademarks of TrueAxis HQ. You may not use our trademarks without prior written consent.`,
  },
  {
    title: "8. Third-Party Services",
    content: `Some platform workflows may be configured with third-party services. Their availability, scopes, terms, data handling, and error behavior require provider-specific review and controlled testing.

This draft does not establish an active integration, provider performance, or responsibility allocation.`,
  },
  {
    title: "9. Disclaimers and Limitation of Liability",
    content: `TrueAxis HQ does not represent uninterrupted, error-free, secure, provider-backed, or outcome-guaranteed operation in this product-policy draft.

Any disclaimer, limitation, remedy, or allocation of liability requires qualified legal review before publication.`,
  },
  {
    title: "10. Termination",
    content: `Account closure, suspension, termination, access, retention, deletion, and notice procedures require qualified legal and operational review before public launch. No particular deletion or access timeline is represented here.`,
  },
  {
    title: "11. Governing Law and Disputes",
    content: `Governing law, venue, dispute resolution, arbitration, waiver, and class-action terms require qualified legal review for the applicable jurisdiction before publication.`,
  },
  {
    title: "12. Contact",
    content: `For questions about these Terms, please contact us at:

**Email:** legal@trueaxishq.com

This contact channel does not represent legal advice or a response-time commitment.`,
  },
];

export default function Terms() {
  const [, navigate] = useLocation();
  useEffect(() => { document.title = "Terms of Service — TrueAxis HQ"; }, []);
  return (
    <div className="min-h-screen bg-[#F2F0EC] text-[#1A1A1A]">
      <nav className="border-b border-[#DDDBD7] px-4 sm:px-6 py-4 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-[#D4922A] hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#D4922A] rounded px-2 py-1">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Home</span>
        </button>
        <div className="flex items-center">
          <img
            src={TRUEAXIS_LOGO_URL}
            alt="TrueAxis HQ"
            className="h-8 w-auto object-contain"
          />
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-16 sm:py-20">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#D4922A]/15 flex items-center justify-center">
            <FileText className="w-5 h-5 text-[#D4922A]" />
          </div>
          <span className="text-xs font-semibold text-[#D4922A] uppercase tracking-wider">Legal</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-3 text-[#1A1A1A]">Terms of Service</h1>
        <p className="text-sm text-[rgba(26,26,26,0.55)] mb-12">{REVIEW_STATUS}</p>

        <p className="text-[rgba(26,26,26,0.80)] leading-relaxed mb-10 text-base">
          Please read these Terms of Service carefully before using the TrueAxis HQ platform. They describe the platform policies intended to govern access and use. The owner should obtain qualified legal review before relying on any terms for a particular jurisdiction or use case.
        </p>

        <div className="space-y-10">
          {sections.map(({ title, content }) => (
            <section key={title}>
              <h2 className="text-xl font-bold mb-4 text-[#1A1A1A]">{title}</h2>
              <div className="text-[rgba(26,26,26,0.75)] text-sm leading-relaxed space-y-3">
                {content.split("\n\n").map((para, i) => (
                  <p key={i} dangerouslySetInnerHTML={{
                    __html: para
                      .replace(/\*\*(.+?)\*\*/g, "<strong class='text-[#1A1A1A]'>$1</strong>")
                      .replace(/^- (.+)$/gm, "<li class='ml-4 list-disc'>$1</li>")
                  }} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <footer className="border-t border-[#DDDBD7] py-8 px-4 text-center text-xs text-[rgba(26,26,26,0.45)]">
        <p>© {new Date().getFullYear()} TrueAxis HQ. All rights reserved.</p>
      </footer>
    </div>
  );
}
