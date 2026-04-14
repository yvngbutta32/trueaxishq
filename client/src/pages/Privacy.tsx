import { useLocation } from "wouter";
import { ArrowLeft, Zap, Shield } from "lucide-react";

const LAST_UPDATED = "March 14, 2026";

const sections = [
  {
    title: "1. Information We Collect",
    content: `We collect information you provide directly to us when you create an account, use our services, or contact us for support.

**Account Information:** When you register, we collect your name, email address, and authentication credentials. If you sign in via OAuth, we receive your name and email from the identity provider.

**Business Data:** We collect the data you enter into TrueAxis HQ, including client names and contact information, invoice details, booking records, follow-up messages, and business settings. This data belongs to you and is stored securely on our servers.

**Payment Information:** When you subscribe to a paid plan, payment is processed by Stripe. We do not store your full credit card number, CVV, or expiration date. We store only your Stripe Customer ID and subscription status to manage your account.

**Usage Data:** We automatically collect information about how you interact with our platform, including pages visited, features used, session duration, and error logs. This data is used to improve the product and diagnose issues.

**Device and Technical Data:** We collect your IP address, browser type, operating system, and referring URLs for security monitoring and fraud prevention.`,
  },
  {
    title: "2. How We Use Your Information",
    content: `We use the information we collect to:

- Provide, operate, and maintain the TrueAxis HQ platform
- Process transactions and send related billing information
- Send you technical notices, updates, and security alerts
- Respond to your comments and questions and provide customer support
- Monitor and analyze usage patterns to improve our services
- Detect, investigate, and prevent fraudulent transactions and other illegal activities
- Comply with legal obligations

We do not sell, rent, or share your personal information with third parties for their marketing purposes.`,
  },
  {
    title: "3. Data Storage and Security",
    content: `Your data is stored on secure servers hosted in the United States. We implement industry-standard security measures including:

- TLS/SSL encryption for all data in transit
- AES-256 encryption for sensitive data at rest
- Regular security audits and penetration testing
- Role-based access controls limiting employee access to your data
- Automated threat detection and IP-based rate limiting

While we take these measures seriously, no method of transmission over the internet is 100% secure. We encourage you to use a strong, unique password for your account and to enable any available two-factor authentication.`,
  },
  {
    title: "4. Data Retention",
    content: `We retain your account data for as long as your account is active or as needed to provide you services. If you delete your account, we will delete or anonymize your personal data within 30 days, except where we are required to retain it for legal, tax, or fraud prevention purposes.

Business data you have entered (clients, invoices, bookings) will be permanently deleted within 30 days of account deletion. We recommend exporting your data before deleting your account.`,
  },
  {
    title: "5. Sharing Your Information",
    content: `We share your information only in the following circumstances:

**Service Providers:** We share data with third-party vendors who help us operate our platform, including Stripe (payment processing), AWS (cloud infrastructure), and analytics providers. These vendors are contractually obligated to protect your data.

**Legal Requirements:** We may disclose your information if required by law, subpoena, or other legal process, or if we believe disclosure is necessary to protect our rights, your safety, or the safety of others.

**Business Transfers:** If TrueAxis HQ is acquired or merges with another company, your data may be transferred as part of that transaction. We will notify you before your data is transferred and becomes subject to a different privacy policy.

We do not sell your personal data to data brokers, advertisers, or any third party.`,
  },
  {
    title: "6. Your Rights and Choices",
    content: `You have the following rights regarding your personal data:

**Access:** You can access and download your data at any time from your account settings.

**Correction:** You can update your profile information and business settings at any time within the platform.

**Deletion:** You can request deletion of your account and all associated data by contacting us at privacy@trueaxishq.com.

**Portability:** You can export your client list, invoices, and booking history in standard formats from your dashboard.

**Opt-Out:** You can opt out of non-essential communications by updating your notification preferences in your account settings.

If you are located in the European Economic Area, you have additional rights under GDPR, including the right to lodge a complaint with your local data protection authority.`,
  },
  {
    title: "7. Cookies and Tracking",
    content: `We use cookies and similar tracking technologies to operate our platform. Specifically:

**Essential Cookies:** Required for authentication and session management. These cannot be disabled without breaking the platform.

**Analytics Cookies:** Used to understand how users interact with our platform. You can opt out of analytics tracking in your account settings.

We do not use third-party advertising cookies or sell data to advertising networks.`,
  },
  {
    title: "8. Children's Privacy",
    content: `TrueAxis HQ is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such information, please contact us immediately at privacy@trueaxishq.com and we will delete it promptly.`,
  },
  {
    title: "9. Changes to This Policy",
    content: `We may update this Privacy Policy from time to time. We will notify you of material changes by email or by posting a prominent notice on our platform at least 30 days before the changes take effect. Your continued use of TrueAxis HQ after the effective date constitutes your acceptance of the updated policy.`,
  },
  {
    title: "10. Contact Us",
    content: `If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:

**Email:** privacy@trueaxishq.com
**Mailing Address:** TrueAxis HQ, Privacy Team, 100 Innovation Drive, Suite 400, Austin, TX 78701

We will respond to all privacy-related inquiries within 5 business days.`,
  },
];

export default function Privacy() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <nav className="border-b border-white/10 px-4 sm:px-6 py-4 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-[#E8A020] hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#E8A020] rounded px-2 py-1">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Home</span>
        </button>
        <div className="flex items-center">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/logo-r1_d9d437c8.png"
            alt="TrueAxis HQ"
            className="h-8 w-auto object-contain"
          />
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-16 sm:py-20">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#E8A020]/15 flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#E8A020]" />
          </div>
          <span className="text-xs font-semibold text-[#E8A020] uppercase tracking-wider">Legal</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-3" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-12">Last updated: {LAST_UPDATED}</p>

        <p className="text-gray-300 leading-relaxed mb-10 text-base">
          TrueAxis HQ ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform. Please read this policy carefully. If you disagree with its terms, please discontinue use of the platform.
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

      <footer className="border-t border-white/10 py-8 px-4 text-center text-xs text-gray-400">
        <p>© {new Date().getFullYear()} TrueAxis HQ. All rights reserved.</p>
      </footer>
    </div>
  );
}
