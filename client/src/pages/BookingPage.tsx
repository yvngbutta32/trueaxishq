import { useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Calendar, Clock, User, Mail, MessageSquare, Briefcase,
  CheckCircle, Zap, ArrowLeft, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";

const SERVICES = [
  "Life Coaching", "Business Consulting", "Freelance Design",
  "Tutoring", "Therapy / Counseling", "Web Development",
  "Photography", "Marketing", "Legal Advice", "Other",
];

const TIME_SLOTS = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM",
  "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM",
];

function getNextDays(count: number) {
  const days = [];
  const today = new Date();
  for (let i = 1; i <= count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (d.getDay() !== 0 && d.getDay() !== 6) { // skip weekends
      days.push(d);
    }
  }
  return days.slice(0, count);
}

export default function BookingPage() {
  const params = useParams<{ username: string }>();
  const username = params.username ?? "";

  const [step, setStep] = useState<"details" | "datetime" | "confirm" | "success">("details");
  const [form, setForm] = useState({
    clientName: "",
    clientEmail: "",
    service: "",
    message: "",
    preferredDate: "",
    preferredTime: "",
  });

  const pageQuery = trpc.booking.getPage.useQuery({ username }, { enabled: !!username });
  const submitMutation = trpc.booking.submit.useMutation({
    onSuccess: () => setStep("success"),
    onError: (e) => toast.error("Booking failed: " + e.message),
  });

  const availableDays = getNextDays(14);

  const handleSubmit = () => {
    submitMutation.mutate({
      hostUsername: username,
      clientName: form.clientName,
      clientEmail: form.clientEmail,
      service: form.service,
      message: form.message || undefined,
      preferredDate: form.preferredDate,
      preferredTime: form.preferredTime,
    });
  };

  // Loading state
  if (pageQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center" role="status" aria-label="Loading booking page">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-[#E8A020] animate-spin mx-auto mb-3" aria-hidden="true" />
          <p className="text-gray-500 text-sm">Loading booking page…</p>
        </div>
      </div>
    );
  }

  // Not found
  if (!pageQuery.data) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4" aria-hidden="true">
            <User className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Page Not Found</h1>
          <p className="text-gray-500 text-sm">The booking page for <strong>@{username}</strong> doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const host = pageQuery.data;

  // Success screen
  if (step === "success") {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-lg border border-gray-100">
          <div className="w-16 h-16 rounded-full bg-[#E8A020]/15 flex items-center justify-center mx-auto mb-5" aria-hidden="true">
            <CheckCircle className="w-8 h-8 text-[#E8A020]" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
            Booking Request Sent!
          </h1>
          <p className="text-gray-500 mb-6">
            Your request has been sent to <strong>{host.name}</strong>. They'll reach out to confirm your appointment at <strong>{form.preferredTime}</strong> on <strong>{form.preferredDate}</strong>.
          </p>
          <div className="bg-gray-50 rounded-2xl p-4 text-left space-y-2 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Service</span>
              <span className="font-semibold text-gray-900">{form.service}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Date</span>
              <span className="font-semibold text-gray-900">{form.preferredDate}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Time</span>
              <span className="font-semibold text-gray-900">{form.preferredTime}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400">A confirmation will be sent to <strong>{form.clientEmail}</strong></p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414]">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4" role="banner">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-amber flex items-center justify-center flex-shrink-0" aria-hidden="true">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Booking with</p>
            <h1 className="text-base font-bold text-gray-900" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              {host.name}
            </h1>
          </div>
          <div className="ml-auto">
            <span className="text-xs bg-[#E8A020]/10 text-[#007A65] border border-[#E8A020]/20 rounded-full px-3 py-1 font-semibold">
              Powered by TrueAxis HQ
            </span>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="bg-white border-b border-gray-100" role="navigation" aria-label="Booking progress">
        <div className="max-w-xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2" role="list">
            {[
              { id: "details", label: "Your Details" },
              { id: "datetime", label: "Date & Time" },
              { id: "confirm", label: "Confirm" },
            ].map((s, i) => {
              const steps = ["details", "datetime", "confirm"];
              const currentIdx = steps.indexOf(step);
              const stepIdx = steps.indexOf(s.id);
              const isDone = stepIdx < currentIdx;
              const isCurrent = stepIdx === currentIdx;
              return (
                <div key={s.id} role="listitem" className="flex items-center gap-2 flex-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isDone ? "gradient-amber text-white" :
                        isCurrent ? "bg-[#E8A020]/15 text-[#007A65] border-2 border-[#E8A020]" :
                        "bg-gray-100 text-gray-400"
                      }`}
                      aria-current={isCurrent ? "step" : undefined}
                    >
                      {isDone ? <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" /> : i + 1}
                    </div>
                    <span className={`text-xs font-medium hidden sm:block ${isCurrent ? "text-[#007A65]" : isDone ? "text-gray-700" : "text-gray-400"}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < 2 && <div className="flex-1 h-px bg-gray-200 mx-1" aria-hidden="true" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main */}
      <main id="main-content" className="max-w-xl mx-auto px-4 py-8">

        {/* Step 1: Details */}
        {step === "details" && (
          <section aria-label="Your contact details">
            <h2 className="text-xl font-bold text-gray-900 mb-1" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              Tell us about yourself
            </h2>
            <p className="text-sm text-gray-500 mb-6">We'll share this with {host.name} to prepare for your session.</p>

            <div className="space-y-4">
              <div>
                <label htmlFor="client-name" className="form-label">
                  Full Name <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                  <input
                    id="client-name"
                    type="text"
                    value={form.clientName}
                    onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))}
                    placeholder="Jane Smith"
                    className="form-input pl-10"
                    required
                    aria-required="true"
                    autoComplete="name"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="client-email" className="form-label">
                  Email Address <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                  <input
                    id="client-email"
                    type="email"
                    value={form.clientEmail}
                    onChange={e => setForm(p => ({ ...p, clientEmail: e.target.value }))}
                    placeholder="jane@example.com"
                    className="form-input pl-10"
                    required
                    aria-required="true"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="service-select" className="form-label">
                  Service Needed <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                  <select
                    id="service-select"
                    value={form.service}
                    onChange={e => setForm(p => ({ ...p, service: e.target.value }))}
                    className="form-input pl-10 appearance-none"
                    required
                    aria-required="true"
                  >
                    <option value="">Select a service…</option>
                    {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="client-message" className="form-label">
                  Message <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <MessageSquare className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" aria-hidden="true" />
                  <textarea
                    id="client-message"
                    value={form.message}
                    onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                    placeholder="Briefly describe what you'd like to work on…"
                    rows={3}
                    className="form-input pl-10 resize-none"
                    maxLength={500}
                  />
                </div>
                <p className="form-hint">{form.message.length}/500</p>
              </div>
            </div>

            <Button
              className="w-full gradient-amber text-white border-0 mt-6 h-12 text-base"
              onClick={() => {
                if (!form.clientName.trim()) { toast.error("Please enter your name"); return; }
                if (!form.clientEmail.includes("@")) { toast.error("Please enter a valid email"); return; }
                if (!form.service) { toast.error("Please select a service"); return; }
                setStep("datetime");
              }}
              aria-label="Continue to date and time selection"
            >
              Continue
            </Button>
          </section>
        )}

        {/* Step 2: Date & Time */}
        {step === "datetime" && (
          <section aria-label="Select date and time">
            <button
              onClick={() => setStep("details")}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 min-h-[44px]"
              aria-label="Back to your details"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back
            </button>

            <h2 className="text-xl font-bold text-gray-900 mb-1" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              Choose a date & time
            </h2>
            <p className="text-sm text-gray-500 mb-6">All times are shown in your local timezone.</p>

            {/* Date picker */}
            <fieldset className="mb-6">
              <legend className="form-label mb-3">Select a date</legend>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" role="group" aria-label="Available dates">
                {availableDays.map(day => {
                  const dateStr = day.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                  const dayName = day.toLocaleDateString("en-US", { weekday: "short" });
                  const dayNum = day.getDate();
                  const isSelected = form.preferredDate === dateStr;
                  return (
                    <button
                      key={dateStr}
                      onClick={() => setForm(p => ({ ...p, preferredDate: dateStr }))}
                      aria-pressed={isSelected}
                      aria-label={`${dayName} ${dateStr}`}
                      className={`p-3 rounded-xl border-2 text-center transition-all min-h-[64px] focus-visible:outline-[3px] focus-visible:outline-[#E8A020] focus-visible:outline-offset-2 ${
                        isSelected
                          ? "border-[#E8A020] bg-[#E8A020]/5 text-[#007A65]"
                          : "border-gray-200 hover:border-gray-300 text-gray-700"
                      }`}
                    >
                      <p className="text-xs text-gray-400">{dayName}</p>
                      <p className="text-lg font-bold">{dayNum}</p>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Time picker */}
            {form.preferredDate && (
              <fieldset className="mb-6">
                <legend className="form-label mb-3">Select a time</legend>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" role="group" aria-label="Available time slots">
                  {TIME_SLOTS.map(time => {
                    const isSelected = form.preferredTime === time;
                    return (
                      <button
                        key={time}
                        onClick={() => setForm(p => ({ ...p, preferredTime: time }))}
                        aria-pressed={isSelected}
                        aria-label={`${time}`}
                        className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all min-h-[44px] focus-visible:outline-[3px] focus-visible:outline-[#E8A020] focus-visible:outline-offset-2 ${
                          isSelected
                            ? "border-[#E8A020] bg-[#E8A020]/5 text-[#007A65]"
                            : "border-gray-200 hover:border-gray-300 text-gray-700"
                        }`}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <Button
              className="w-full gradient-amber text-white border-0 h-12 text-base"
              onClick={() => {
                if (!form.preferredDate) { toast.error("Please select a date"); return; }
                if (!form.preferredTime) { toast.error("Please select a time"); return; }
                setStep("confirm");
              }}
              disabled={!form.preferredDate || !form.preferredTime}
              aria-label="Continue to confirmation"
            >
              Continue
            </Button>
          </section>
        )}

        {/* Step 3: Confirm */}
        {step === "confirm" && (
          <section aria-label="Confirm your booking">
            <button
              onClick={() => setStep("datetime")}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 min-h-[44px]"
              aria-label="Back to date and time selection"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back
            </button>

            <h2 className="text-xl font-bold text-gray-900 mb-1" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              Confirm your booking
            </h2>
            <p className="text-sm text-gray-500 mb-6">Please review the details below before submitting.</p>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 mb-6">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 rounded-xl gradient-amber flex items-center justify-center flex-shrink-0" aria-hidden="true">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">{host.name}</p>
                  <p className="text-xs text-gray-400">Your service provider</p>
                </div>
              </div>

              {[
                { icon: User, label: "Your Name", value: form.clientName },
                { icon: Mail, label: "Email", value: form.clientEmail },
                { icon: Briefcase, label: "Service", value: form.service },
                { icon: Calendar, label: "Date", value: form.preferredDate },
                { icon: Clock, label: "Time", value: form.preferredTime },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                    <Icon className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="text-sm font-semibold text-gray-900">{value}</p>
                  </div>
                </div>
              ))}

              {form.message && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5" aria-hidden="true">
                    <MessageSquare className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Message</p>
                    <p className="text-sm text-gray-700">{form.message}</p>
                  </div>
                </div>
              )}
            </div>

            <Button
              className="w-full gradient-amber text-white border-0 h-12 text-base gap-2"
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              aria-label="Submit booking request"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Sending Request…
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" aria-hidden="true" />
                  Confirm Booking
                </>
              )}
            </Button>

            <p className="text-xs text-gray-400 text-center mt-3">
              By booking, you agree that {host.name} will contact you to confirm the appointment.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
