import { useLocation } from "wouter";
import { ArrowLeft, Zap, FileText } from "lucide-react";

const LAST_UPDATED = "March 14, 2026";

const sections = [
  {
    title: "1. Acceptance of Terms",
    content: `By accessing or using TrueAxis HQ ("the Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Platform. These Terms apply to all users, including visitors, registered users, and subscribers.

We reserve the right to update these Terms at any time. We will notify you of material changes by email or by posting a notice on the Platform. Your continued use after changes take effect constitutes acceptance of the updated Terms.`,
  },
  {
    title: "2. Description of Service",
    content: `TrueAxis HQ is a cloud-based business management platform designed for freelancers and solo service providers. The Platform provides tools for client relationship management, scheduling, invoicing, AI-powered follow-up automation, analytics, and business settings management.

We offer three subscription tiers: Starter, Pro, and Agency. Features available to you depend on your subscription plan. We reserve the right to modify, suspend, or discontinue any feature at any time with reasonable notice.`,
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
    content: `**Free Trial:** New accounts receive a 14-day free trial with full access to Pro features. No credit card is required to start a trial.

**Subscription Plans:** After the trial period, continued use of paid features requires a subscription. Plans are billed monthly or annually as selected at checkout.

**Payment:** All payments are processed by Stripe. By subscribing, you authorize us to charge your payment method on a recurring basis until you cancel.

**Cancellation:** You may cancel your subscription at any time from your Billing settings. Cancellation takes effect at the end of the current billing period. We do not provide refunds for partial billing periods.

**Price Changes:** We may change subscription prices with 30 days' notice. Continued use after the effective date constitutes acceptance of the new price.

**Taxes:** You are responsible for all applicable taxes. We will collect taxes where required by law.`,
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
    content: `**Ownership:** You retain full ownership of all data and content you upload or create on the Platform, including client information, invoices, and business data.

**License to Us:** By using the Platform, you grant us a limited, non-exclusive license to store, process, and display your data solely for the purpose of providing the service to you. We do not claim ownership of your content.

**Responsibility:** You are solely responsible for the accuracy and legality of the data you enter into the Platform. You represent that you have the right to upload and use all data you provide.

**Backup:** While we maintain regular backups, you are responsible for maintaining your own backups of critical business data. We recommend exporting your data regularly.`,
  },
  {
    title: "7. Intellectual Property",
    content: `The Platform, including its software, design, trademarks, and content created by us, is owned by TrueAxis HQ and protected by intellectual property laws. You may not copy, modify, distribute, sell, or lease any part of the Platform without our written permission.

The TrueAxis HQ name, logo, and all related marks are trademarks of TrueAxis HQ. You may not use our trademarks without prior written consent.`,
  },
  {
    title: "8. Third-Party Services",
    content: `The Platform integrates with third-party services including Stripe for payment processing. Your use of these services is subject to their respective terms and privacy policies. We are not responsible for the practices or content of third-party services.

Links to external websites are provided for convenience. We do not endorse or assume responsibility for any third-party sites or services.`,
  },
  {
    title: "9. Disclaimers and Limitation of Liability",
    content: `**Disclaimer:** The Platform is provided "as is" and "as available" without warranties of any kind, express or implied. We do not warrant that the Platform will be uninterrupted, error-free, or free of harmful components.

**Limitation of Liability:** To the maximum extent permitted by law, TrueAxis HQ shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities, arising from your use of or inability to use the Platform.

Our total liability to you for any claim arising from these Terms or your use of the Platform shall not exceed the amount you paid us in the 12 months preceding the claim.`,
  },
  {
    title: "10. Termination",
    content: `Either party may terminate this agreement at any time. You may terminate by canceling your subscription and deleting your account. We may terminate your account if you violate these Terms, with or without notice depending on the severity of the violation.

Upon termination, your right to use the Platform ceases immediately. We will delete your data within 30 days of account deletion, except where retention is required by law.`,
  },
  {
    title: "11. Governing Law and Disputes",
    content: `These Terms are governed by the laws of the State of Texas, United States, without regard to conflict of law principles. Any disputes arising from these Terms or your use of the Platform shall be resolved through binding arbitration in Austin, Texas, except that either party may seek injunctive relief in a court of competent jurisdiction.

You waive any right to participate in a class action lawsuit or class-wide arbitration.`,
  },
  {
    title: "12. Contact",
    content: `For questions about these Terms, please contact us at:

**Email:** legal@trueaxishq.com
**Address:** TrueAxis HQ, Legal Department, 100 Innovation Drive, Suite 400, Austin, TX 78701`,
  },
];

export default function Terms() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <nav className="border-b border-white/10 px-4 sm:px-6 py-4 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-[#E8A020] hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#E8A020] rounded px-2 py-1">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Home</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#E8A020] to-[#F5C842] flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold" style={{ fontFamily: "Space Grotesk, sans-serif" }}>TrueAxis HQ</span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-16 sm:py-20">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#E8A020]/15 flex items-center justify-center">
            <FileText className="w-5 h-5 text-[#E8A020]" />
          </div>
          <span className="text-xs font-semibold text-[#E8A020] uppercase tracking-wider">Legal</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-3" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-12">Last updated: {LAST_UPDATED}</p>

        <p className="text-gray-300 leading-relaxed mb-10 text-base">
          Please read these Terms of Service carefully before using the TrueAxis HQ platform. These Terms constitute a legally binding agreement between you and TrueAxis HQ governing your access to and use of the platform.
        </p>

        <div className="space-y-10">
          {sections.map(({ title, content }) => (
            <section key={title}>
              <h2 className="text-xl font-bold mb-4 text-white" style={{ fontFamily: "Space Grotesk, sans-serif" }}>{title}</h2>
              <div className="text-gray-300 text-sm leading-relaxed space-y-3">
                {content.split("\n\n").map((para, i) => (
                  <p key={i} dangerouslySetInnerHTML={{
                    __html: para
                      .replace(/\*\*(.+?)\*\*/g, "<strong class='text-white'>$1</strong>")
                      .replace(/^- (.+)$/gm, "<li class='ml-4 list-disc'>$1</li>")
                  }} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <footer className="border-t border-white/10 py-8 px-4 text-center text-xs text-gray-600">
        <p>© {new Date().getFullYear()} TrueAxis HQ. All rights reserved.</p>
      </footer>
    </div>
  );
}
