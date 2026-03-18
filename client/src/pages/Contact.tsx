import { useState } from "react";
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

  const captureLead = trpc.leads.capture.useMutation();

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
      await captureLead.mutateAsync({ email: form.email, name: form.name, source: "landing_page" });
      setSubmitted(true);
      toast.success("Message sent! We'll be in touch within 4 hours.");
    } catch {
      toast.error("Something went wrong. Please email us directly at support@trueaxishq.com");
    }
  };

  const field = (id: keyof typeof form, label: string, type = "text", multiline = false) => (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-gray-400 mb-1.5">{label} *</label>
      {multiline ? (
        <textarea
          id={id}
          value={form[id]}
          onChange={e => { setForm(p => ({ ...p, [id]: e.target.value })); setErrors(p => ({ ...p, [id]: "" })); }}
          rows={5}
          className={`w-full px-4 py-3 bg-white/10 border rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C9A7] transition-colors resize-none ${errors[id] ? "border-red-400" : "border-white/20"}`}
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
          className={`w-full px-4 py-3 bg-white/10 border rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C9A7] transition-colors ${errors[id] ? "border-red-400" : "border-white/20"}`}
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
    <div className="min-h-screen bg-[#1C1C1E] text-white">
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

      <div className="max-w-5xl mx-auto px-4 py-16 sm:py-20">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 bg-[#00C9A7]/15 text-[#00C9A7] border border-[#00C9A7]/30 rounded-full px-4 py-1.5 text-xs font-semibold mb-6">
              <Mail className="w-3 h-3" />
              Get in Touch
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 leading-tight" style={{ fontFamily: "Sora, sans-serif" }}>
              We'd love to<br /><span className="text-[#00C9A7]">hear from you.</span>
            </h1>
            <p className="text-gray-400 leading-relaxed mb-10">
              Whether you have a question about features, pricing, need a demo, or just want to say hello — our team is here for you.
            </p>

            <div className="space-y-5">
              {[
                { icon: Mail, title: "Email Support", value: "support@trueaxishq.com", sub: "For general questions and account help" },
                { icon: Mail, title: "Billing", value: "billing@trueaxishq.com", sub: "For payment and subscription questions" },
                { icon: Clock, title: "Response Time", value: "Within 4 business hours", sub: "Monday – Friday, 9am – 6pm CT" },
              ].map(({ icon: Icon, title, value, sub }) => (
                <div key={title} className="flex items-start gap-4 bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="w-9 h-9 rounded-xl bg-[#00C9A7]/15 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-[#00C9A7]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 mb-0.5">{title}</p>
                    <p className="text-sm font-medium text-white">{value}</p>
                    <p className="text-xs text-gray-500">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Form */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8">
            {submitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-[#00C9A7]/15 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-[#00C9A7]" />
                </div>
                <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "Sora, sans-serif" }}>Message Received!</h2>
                <p className="text-gray-400 text-sm mb-6">Thank you for reaching out. We'll get back to you at <strong className="text-white">{form.email}</strong> within 4 business hours.</p>
                <Button onClick={() => navigate("/")} className="bg-[#00C9A7] hover:bg-[#00A88A] text-white border-0 px-6 py-2.5 rounded-xl text-sm">
                  Back to Home
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <h2 className="text-lg font-bold mb-1" style={{ fontFamily: "Sora, sans-serif" }}>Send us a message</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {field("name", "Full Name")}
                  {field("email", "Email Address", "email")}
                </div>
                {field("subject", "Subject")}
                {field("message", "Message", "text", true)}
                <Button
                  type="submit"
                  disabled={captureLead.isPending}
                  className="w-full bg-[#00C9A7] hover:bg-[#00A88A] text-white border-0 py-3 rounded-xl text-sm font-semibold min-h-[48px] flex items-center justify-center gap-2"
                >
                  {captureLead.isPending ? (
                    <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending...</span>
                  ) : (
                    <span className="flex items-center gap-2"><Send className="w-4 h-4" />Send Message</span>
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>

      <footer className="border-t border-white/10 py-8 px-4 text-center text-xs text-gray-600">
        <p>© {new Date().getFullYear()} TrueAxis HQ. All rights reserved.</p>
      </footer>
    </div>
  );
}
