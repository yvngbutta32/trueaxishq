import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Zap, Mail, Clock, CheckCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function Contact() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { document.title = "Contact — SkillBridge AI"; }, []);

  const submitContact = trpc.contact.submit.useMutation();

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email";
    if (!form.subject.trim()) e.subject = "Subject is required";
    if (!form.message.trim()) e.message = "Message is required";
    else if (form.message.trim().length < 20) e.message = "Please provide more detail (at least 20 characters)";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    try {
      await submitContact.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      setSubmitted(true);
      toast.success("Message sent! We'll be in touch within 4 hours.");
    } catch {
      toast.error("Something went wrong. Please email us directly at support@skillbridge-ai.com");
    }
  };

  const field = (id: keyof typeof form, label: string, type = "text", multiline = false) => (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-[#3D3D3D] mb-1.5">{label} *</label>
      {multiline ? (
        <textarea
              maxLength={5000}
          id={id}
          value={form[id]}
          onChange={e => { setForm(p => ({ ...p, [id]: e.target.value })); setErrors(p => ({ ...p, [id]: "" })); }}
          rows={5}
          className={`w-full px-4 py-3 bg-white border border-[#DDDBD7] rounded-xl text-[#1A1A1A] placeholder-[#9B9B9B] text-sm focus:outline-none focus:ring-2 focus:ring-[#D4922A] transition-colors resize-none ${errors[id] ? "border-red-400" : "border-[#DDDBD7]"}`}
          placeholder={`Your ${label.toLowerCase()}...`}
          aria-invalid={!!errors[id]}
          aria-describedby={errors[id] ? `${id}-error` : undefined}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={form[id]}
          onChange={e => { setForm(p => ({ ...p, [id]: e.target.value })); setErrors(p => ({ ...p, [id]: "" })); }}
          className={`w-full px-4 py-3 bg-white border border-[#DDDBD7] rounded-xl text-[#1A1A1A] placeholder-[#9B9B9B] text-sm focus:outline-none focus:ring-2 focus:ring-[#D4922A] transition-colors ${errors[id] ? "border-red-400" : "border-[#DDDBD7]"}`}
          placeholder={`Your ${label.toLowerCase()}`}
          autoComplete={id === "email" ? "email" : id === "name" ? "name" : undefined}
          aria-invalid={!!errors[id]}
          aria-describedby={errors[id] ? `${id}-error` : undefined}
        />
      )}
      {errors[id] && <p id={`${id}-error`} role="alert" className="text-xs text-red-400 mt-1">{errors[id]}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F2F0EC] text-[#1A1A1A]">
      <nav className="border-b border-[#DDDBD7] px-4 sm:px-6 py-4 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-[#D4922A] hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#D4922A] rounded px-2 py-1">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Home</span>
        </button>
        <div className="flex items-center">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/logo-r1_d9d437c8.png"
            alt="SkillBridge AI"
            className="h-8 w-auto object-contain"
          />
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-10 sm:py-14">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 bg-[#D4922A]/15 text-[#D4922A] border border-[#D4922A]/30 rounded-full px-4 py-1.5 text-xs font-semibold mb-6">
              <Mail className="w-3 h-3" />
              Get in Touch
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 leading-tight">
              We'd love to<br /><span className="text-[#D4922A]">hear from you.</span>
            </h1>
            <p className="text-[#3D3D3D] leading-relaxed mb-10">
              Whether you have a question about features, pricing, need a demo, or just want to say hello — our team is here for you.
            </p>

            <div className="space-y-5">
              {[
                { icon: Mail, title: "Email Support", value: "support@skillbridge-ai.com", sub: "For general questions and account help" },
                { icon: Mail, title: "Billing", value: "billing@skillbridge-ai.com", sub: "For payment and subscription questions" },
                { icon: Clock, title: "Response Time", value: "Within 4 business hours", sub: "Monday – Friday, 9am – 6pm CT" },
              ].map(({ icon: Icon, title, value, sub }) => (
                <div key={title} className="flex items-start gap-4 bg-white border border-[#DDDBD7] rounded-xl p-4">
                  <div className="w-9 h-9 rounded-xl bg-[#D4922A]/15 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-[#D4922A]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#3D3D3D] mb-0.5">{title}</p>
                    <p className="text-sm font-medium text-[#1A1A1A]">{value}</p>
                    <p className="text-xs text-[#6B6B6B]">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Form */}
          <div className="bg-white border border-[#DDDBD7] rounded-xl p-6 sm:p-8">
            {submitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-[#D4922A]/15 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-[#D4922A]" />
                </div>
                <h2 className="text-xl font-bold mb-2">Message Received!</h2>
                <p className="text-[#3D3D3D] text-sm mb-6">Thank you for reaching out. We'll get back to you at <strong className="text-[#1A1A1A]">{form.email}</strong> within 4 business hours.</p>
                <Button onClick={() => navigate("/")} className="bg-[#D4922A] hover:bg-[#D4911A] text-white border-0 px-6 py-2.5 rounded-xl text-sm">
                  Back to Home
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <h2 className="text-lg font-bold mb-1">Send us a message</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {field("name", "Full Name")}
                  {field("email", "Email Address", "email")}
                </div>
                {field("subject", "Subject")}
                {field("message", "Message", "text", true)}
                <Button
                  type="submit"
                  disabled={submitContact.isPending}
                  className="w-full bg-[#D4922A] hover:bg-[#D4911A] text-white border-0 py-3 rounded-xl text-sm font-semibold min-h-[48px] flex items-center justify-center gap-2"
                >
                  {submitContact.isPending ? (
                    <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-[#D4922A]/30 border-t-[#D4922A] rounded-full animate-spin" />Sending...</span>
                  ) : (
                    <span className="flex items-center gap-2"><Send className="w-4 h-4" />Send Message</span>
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>

      <footer className="border-t border-[#DDDBD7] py-8 px-4 text-center text-xs text-gray-600">
        <p>© {new Date().getFullYear()} SkillBridge AI. All rights reserved.</p>
      </footer>
    </div>
  );
}
