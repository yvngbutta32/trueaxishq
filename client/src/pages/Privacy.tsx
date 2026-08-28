import { TRUEAXIS_LOGO_URL } from "@shared/const";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Zap, Shield } from "lucide-react";

const REVIEW_STATUS = "Draft reviewed: August 28, 2026";

const sections = [
  {
    title: "1. Information We Collect",
    content: `We collect information you provide directly to us when you create an account, use our services, or contact us for support.

**Account Information:** When you register, we collect your name, email address, and securely hashed authentication credentials needed to operate your account.

**Business Data:** We collect the data you enter into TrueAxis HQ, including client names and contact information, invoice details, booking records, follow-up messages, and business settings, to provide workspace functionality.

**Payment Information:** Payment functionality may involve a configured payment provider. Provider processing and payment-data handling must be reviewed against the applicable provider terms before public launch.

**Usage Data:** Platform operation may produce technical logs or analytics events. Their collection, retention, and use require operational review before public launch.

**Device and Technical Data:** Requests can include technical information such as an IP address and browser characteristics. Any collection and retention policy requires operational review before public launch.`,
  },
  {
    title: "2. How We Use Your Information",
    content: `We use the information we collect to:

- Provide, operate, and maintain the TrueAxis HQ platform
- Provide and maintain the workspace features you choose to use
- Support configured account, billing, and communication workflows where they are available
- Investigate operational and security reports where appropriate
- Meet validated legal and operational obligations

This draft does not establish a final data-sharing policy, legal basis, provider list, or notice process. Obtain qualified privacy review before relying on it.`,
  },
  {
    title: "3. Data Storage and Security",
    content: `TrueAxis HQ includes application-level controls such as authentication, input validation, workspace ownership checks, and rate-limiting logic. These implementation details are not a security certification, guarantee, or independent assurance result.

Hosting, encryption, access-management, incident-response, logging, backup, and security-testing practices require an independent technical and legal review before public launch. Use a strong, unique password and enable any available account security option.`,
  },
  {
    title: "4. Data Retention",
    content: `Retention, deletion, recovery, export, and backup practices have not been finalized for public launch. Do not rely on a particular retention or deletion timeline from this draft.

Before launch, publish reviewed retention and deletion procedures and provide an appropriate data-export path.`,
  },
  {
    title: "5. Sharing Your Information",
    content: `Third-party processors, integrations, disclosures, and provider responsibilities must be identified and reviewed before public launch.

This draft does not make a final commitment about sharing, legal disclosure, business transfers, advertising, or notice practices.`,
  },
  {
    title: "6. Your Rights and Choices",
    content: `Some workspace records can be viewed or exported through available product controls. Availability varies by feature and account state.

Data-subject rights, account-deletion requests, portability processes, marketing preferences, and jurisdiction-specific obligations require qualified legal and privacy review before launch.`,
  },
  {
    title: "7. Cookies and Tracking",
    content: `Session cookies may be used for account access. Analytics, consent, preference, and third-party tracking practices require a reviewed public policy before launch.

This draft does not establish cookie-consent, advertising, or opt-out commitments.`,
  },
  {
    title: "8. Children's Privacy",
    content: `Age, children’s privacy, and parental-consent requirements require qualified legal review before launch.`,
  },
  {
    title: "9. Changes to This Policy",
    content: `Policy versioning and any notice process will be established after legal and operational review. Do not rely on a particular email, timing, or acceptance mechanism from this draft.`,
  },
  {
    title: "10. Contact Us",
    content: `If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:

**Email:** privacy@trueaxishq.com

This contact channel is provided for policy questions. No response-time commitment is represented here.`,
  },
];

export default function Privacy() {
  const [, navigate] = useLocation();
  useEffect(() => { document.title = "Privacy Policy — TrueAxis HQ"; }, []);
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
            <Shield className="w-5 h-5 text-[#D4922A]" />
          </div>
          <span className="text-xs font-semibold text-[#D4922A] uppercase tracking-wider">Legal</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-3 text-[#1A1A1A]">Privacy Policy</h1>
        <p className="text-sm text-[rgba(26,26,26,0.55)] mb-12">{REVIEW_STATUS}</p>

        <p className="text-[rgba(26,26,26,0.80)] leading-relaxed mb-10 text-base">
          This pre-launch Privacy Policy draft describes intended data-practice boundaries and current product patterns. It is not a final privacy notice, compliance statement, or substitute for qualified legal and privacy review. Do not rely on it for a particular jurisdiction or use case.
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
