import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Calendar, Clock, User, Mail, MessageSquare, Briefcase,
  CheckCircle, Zap, ArrowLeft, Loader2, Download, ExternalLink,
  CalendarDays, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── .ics calendar file generator ────────────────────────────────────────────
function generateICS({
  title, description, date, time, durationMins, organizerName, organizerEmail, attendeeEmail, attendeeName,
}: {
  title: string; description: string; date: string; time: string;
  durationMins: number; organizerName: string; organizerEmail: string;
  attendeeEmail: string; attendeeName: string;
}): string {
  // Parse date (YYYY-MM-DD or "Mon Apr 14, 2026") and time ("2:00 PM")
  const parseDateTime = (dateStr: string, timeStr: string): Date => {
    // Try ISO format first
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      const t = parseTime12(timeStr);
      return new Date(`${y}-${m}-${d}T${t}:00`);
    }
    // Try "Mon Apr 14, 2026" format
    const parsed = new Date(`${dateStr} ${timeStr}`);
    if (!isNaN(parsed.getTime())) return parsed;
    // Fallback: tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow;
  };

  const parseTime12 = (t: string): string => {
    const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return "09:00";
    let h = parseInt(m[1], 10);
    const min = m[2];
    const ampm = m[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${min}`;
  };

  const formatICSDate = (d: Date): string => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  };

  const start = parseDateTime(date, time);
  const end = new Date(start.getTime() + durationMins * 60 * 1000);
  const now = new Date();
  const uid = `booking-${Date.now()}@trueaxis-hq.com`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TrueAxis HQ//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatICSDate(now)}`,
    `DTSTART:${formatICSDate(start)}`,
    `DTEND:${formatICSDate(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
    `ORGANIZER;CN=${organizerName}:mailto:${organizerEmail}`,
    `ATTENDEE;CN=${attendeeName};RSVP=TRUE:mailto:${attendeeEmail}`,
    "STATUS:TENTATIVE",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:Reminder: ${title} in 1 hour`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadICS(icsContent: string, filename: string) {
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildGoogleCalendarUrl({
  title, description, date, time, durationMins,
}: { title: string; description: string; date: string; time: string; durationMins: number }): string {
  const parseDateTime = (dateStr: string, timeStr: string): Date => {
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      const t = parseTime12(timeStr);
      return new Date(`${y}-${m}-${d}T${t}:00`);
    }
    const parsed = new Date(`${dateStr} ${timeStr}`);
    if (!isNaN(parsed.getTime())) return parsed;
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(9, 0, 0, 0); return tomorrow;
  };
  const parseTime12 = (t: string): string => {
    const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return "09:00";
    let h = parseInt(m[1], 10); const min = m[2]; const ampm = m[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${min}`;
  };
  const formatGCal = (d: Date): string => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  };
  const start = parseDateTime(date, time);
  const end = new Date(start.getTime() + durationMins * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    details: description,
    dates: `${formatGCal(start)}/${formatGCal(end)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Services are loaded dynamically from the booking page owner's configuration

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
  useEffect(() => { document.title = username ? `Book with @${username} — TrueAxis HQ` : "Book a Session — TrueAxis HQ"; }, [username]);

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
      <div className="min-h-screen bg-white flex items-center justify-center" role="status" aria-label="Loading booking page">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-[#D4922A] animate-spin mx-auto mb-3" aria-hidden="true" />
          <p className="text-gray-600 text-sm">Loading booking page…</p>
        </div>
      </div>
    );
  }

  // Not found
  if (!pageQuery.data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-4" aria-hidden="true">
            <User className="w-8 h-8 text-gray-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Page Not Found</h1>
          <p className="text-gray-600 text-sm">The booking page for <strong>@{username}</strong> doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const host = pageQuery.data;

  // Success / Confirmation screen
  if (step === "success") {
    const icsTitle = `${form.service} with ${host.name}`;
    const icsDescription = `Service: ${form.service}\nClient: ${form.clientName}\nEmail: ${form.clientEmail}${form.message ? `\nMessage: ${form.message}` : ""}\n\nBooked via TrueAxis HQ`;
    const icsContent = generateICS({
      title: icsTitle,
      description: icsDescription,
      date: form.preferredDate,
      time: form.preferredTime,
      durationMins: 60,
      organizerName: host.name ?? "Your Host",
      organizerEmail: "noreply@trueaxis-hq.com",
      attendeeEmail: form.clientEmail,
      attendeeName: form.clientName,
    });
    const googleUrl = buildGoogleCalendarUrl({
      title: icsTitle,
      description: icsDescription,
      date: form.preferredDate,
      time: form.preferredTime,
      durationMins: 60,
    });

    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="bg-[#F7F6F3] border-b border-[#DDDBD7] px-4 py-3.5">
          <div className="max-w-xl mx-auto flex items-center gap-3">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/logo-r1_d9d437c8.png"
              alt="TrueAxis HQ"
              className="h-7 w-auto object-contain flex-shrink-0"
            />
          </div>
        </header>

        <div className="max-w-lg mx-auto px-4 pt-10 pb-16 page-bottom">
          {/* Animated checkmark */}
          <div className="text-center mb-8">
            <div className="relative inline-flex items-center justify-center w-20 h-20 mx-auto mb-5">
              <div className="absolute inset-0 rounded-full bg-[#D4922A]/15 animate-ping opacity-40" />
              <div className="relative w-20 h-20 rounded-full bg-[#D4922A]/15 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-[#D4922A]" />
              </div>
            </div>
            <h1 className="text-3xl font-extrabold text-[#1A1A1A] mb-2">
              You're Booked!
            </h1>
            <p className="text-[#3D3D3D] text-sm max-w-sm mx-auto">
              Your request has been sent to <strong className="text-[#1A1A1A]">{host.name}</strong>. They'll confirm your appointment shortly.
            </p>
          </div>

          {/* Booking summary card */}
          <div className="bg-[#F7F6F3] border border-[#DDDBD7] rounded-xl p-5 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="w-4 h-4 text-[#D4922A]" />
              <span className="text-xs font-bold text-[#D4922A] uppercase tracking-wider">Booking Summary</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#3D3D3D] flex items-center gap-2"><Briefcase className="w-3.5 h-3.5" />Service</span>
                <span className="text-sm font-semibold text-[#1A1A1A]">{form.service}</span>
              </div>
              <div className="h-px bg-[#F7F6F3]" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#3D3D3D] flex items-center gap-2"><Calendar className="w-3.5 h-3.5" />Date</span>
                <span className="text-sm font-semibold text-[#1A1A1A]">{(() => { const d = new Date(form.preferredDate + 'T12:00:00'); return isNaN(d.getTime()) ? form.preferredDate : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); })()}</span>
              </div>
              <div className="h-px bg-[#F7F6F3]" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#3D3D3D] flex items-center gap-2"><Clock className="w-3.5 h-3.5" />Time</span>
                <span className="text-sm font-semibold text-[#1A1A1A]">{form.preferredTime}</span>
              </div>
              <div className="h-px bg-[#F7F6F3]" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#3D3D3D] flex items-center gap-2"><User className="w-3.5 h-3.5" />With</span>
                <span className="text-sm font-semibold text-[#1A1A1A]">{host.name}</span>
              </div>
            </div>
          </div>

          {/* Calendar add section */}
          <div className="bg-[#F7F6F3] border border-[#DDDBD7] rounded-xl p-5 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-[#D4922A]" />
              <span className="text-xs font-bold text-[#D4922A] uppercase tracking-wider">Add to Your Calendar</span>
            </div>
            <p className="text-xs text-[#3D3D3D] mb-4">Save this appointment so you never miss it. Includes a 1-hour reminder.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Download .ics */}
              <button
                onClick={() => {
                  downloadICS(icsContent, `booking-${form.preferredDate}.ics`);
                  toast.success("Calendar file downloaded!");
                }}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-[#C8C5BF] bg-[#F7F6F3] hover:bg-[#EEECEA] transition-colors text-sm font-semibold text-[#1A1A1A]"
              >
                <Download className="w-4 h-4 text-[#D4922A]" />
                Download .ics
              </button>

              {/* Google Calendar */}
              <a
                href={googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-[#C8C5BF] bg-[#F7F6F3] hover:bg-[#EEECEA] transition-colors text-sm font-semibold text-[#1A1A1A]"
              >
                <ExternalLink className="w-4 h-4 text-[#4285F4]" />
                Google Calendar
              </a>

              {/* Apple Calendar (same .ics, just labelled differently) */}
              <button
                onClick={() => {
                  downloadICS(icsContent, `booking-${form.preferredDate}.ics`);
                  toast.success("Calendar file downloaded — open it to add to Apple Calendar!");
                }}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-[#C8C5BF] bg-[#F7F6F3] hover:bg-[#EEECEA] transition-colors text-sm font-semibold text-[#1A1A1A]"
              >
                <CalendarDays className="w-4 h-4 text-[#A2AAAD]" />
                Apple Calendar
              </button>
            </div>
          </div>

          {/* Email note */}
          <div className="flex items-start gap-3 bg-[#D4922A]/8 border border-[#D4922A]/20 rounded-xl p-4 mb-6">
            <Mail className="w-4 h-4 text-[#D4922A] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#3D3D3D]">
              A confirmation has been sent to <strong className="text-[#1A1A1A]">{form.clientEmail}</strong>. Check your spam folder if you don't see it within a few minutes.
            </p>
          </div>

          {/* Book another */}
          <div className="text-center">
            <button
              onClick={() => {
                setStep("details");
                setForm({ clientName: "", clientEmail: "", service: "", message: "", preferredDate: "", preferredTime: "" });
              }}
              className="text-sm text-[#3D3D3D] hover:text-[#1A1A1A] underline underline-offset-2 transition-colors"
            >
              Book another appointment
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Header */}
      <header className="bg-[#F7F6F3] border-b border-[#DDDBD7] px-4 py-3.5" role="banner">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/logo-r1_d9d437c8.png"
            alt="TrueAxis HQ"
            className="h-7 w-auto object-contain flex-shrink-0"
          />
          <div className="w-px h-5 bg-white/15 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="text-xs text-[#6B6B6B]">Booking with</p>
            <h1 className="text-sm font-bold text-[#1A1A1A]">
              {host.name}
            </h1>
          </div>
          <div className="ml-auto">
            <span className="text-xs bg-[#D4922A]/15 text-[#D4922A] border border-[#D4922A]/25 rounded-full px-3 py-1 font-semibold">
              Secure Booking
            </span>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="bg-[#F7F6F3] border-b border-[#DDDBD7]" role="navigation" aria-label="Booking progress">
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
                        isDone ? "bg-[#D4922A] text-[#1A1A1A]" :
                        isCurrent ? "bg-[#D4922A]/20 text-[#D4922A] border-2 border-[#D4922A]" :
                        "bg-[#EEECEA] text-gray-600"
                      }`}
                      aria-current={isCurrent ? "step" : undefined}
                    >
                      {isDone ? <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" /> : i + 1}
                    </div>
                    <span className={`text-xs font-medium hidden sm:block ${
                      isCurrent ? "text-[#D4922A]" : isDone ? "text-[#6B6B6B]" : "text-gray-500"
                    }`}>
                      {s.label}
                    </span>
                  </div>
                  {i < 2 && <div className="flex-1 h-px bg-[#EEECEA] mx-1" aria-hidden="true" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main */}
      <main id="main-content" className="max-w-xl mx-auto px-4 pt-8 pb-10 page-bottom">

        {/* Step 1: Details */}
        {step === "details" && (
          <section aria-label="Your contact details">
            <h2 className="text-xl font-bold text-[#1A1A1A] mb-1">
              Tell us about yourself
            </h2>
            <p className="text-sm text-[#6B6B6B] mb-6">We'll share this with {host.name} to prepare for your session.</p>

            <div className="space-y-4">
              <div>
                <label htmlFor="client-name" className="form-label">
                  Full Name <span aria-hidden="true" className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" aria-hidden="true" />
                  <input
                    id="client-name"
                    type="text"
                    value={form.clientName}
                    onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))}
                    placeholder="Jane Smith"
                    className="form-input-light pl-10"
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
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" aria-hidden="true" />
                  <input
                    id="client-email"
                    type="email"
                    value={form.clientEmail}
                    onChange={e => setForm(p => ({ ...p, clientEmail: e.target.value }))}
                    placeholder="jane@example.com"
                    className="form-input-light pl-10"
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
                  <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" aria-hidden="true" />
                  <select
                    id="service-select"
                    value={form.service}
                    onChange={e => setForm(p => ({ ...p, service: e.target.value }))}
                    className="form-input-light pl-10 appearance-none"
                    required
                    aria-required="true"
                  >
                    <option value="">Select a service…</option>
                    {(host.bookingServices && host.bookingServices.length > 0
                      ? host.bookingServices
                      : ["Coaching Session", "Strategy Call", "Consultation"]
                    ).map((s: string) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="client-message" className="form-label">
                  Message <span className="text-[#6B6B6B] font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <MessageSquare className="absolute left-3.5 top-3 w-4 h-4 text-[#6B6B6B]" aria-hidden="true" />
                  <textarea
                    id="client-message"
                    value={form.message}
                    onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                    placeholder="Briefly describe what you'd like to work on…"
                    rows={3}
                    className="form-input-light pl-10 resize-none"
                    maxLength={500}
                  />
                </div>
                <p className="form-hint">{form.message.length}/500</p>
              </div>
            </div>

            <Button
              className="w-full gradient-amber text-[#1A1A1A] border-0 mt-6 h-12 text-base"
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
              className="flex items-center gap-1.5 text-sm text-[#6B6B6B] hover:text-gray-200 mb-5 min-h-[44px] transition-colors"
              aria-label="Back to your details"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back
            </button>

            <h2 className="text-xl font-bold text-[#1A1A1A] mb-1">
              Choose a date & time
            </h2>
            <p className="text-sm text-gray-600 mb-6">All times are shown in your local timezone.</p>

            {/* Date picker */}
            <fieldset className="mb-6">
              <legend className="form-label mb-3">Select a date</legend>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" role="group" aria-label="Available dates">
                {availableDays.map(day => {
                  // Store as ISO YYYY-MM-DD for consistent server-side handling
                  const isoDate = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                  const dateStr = day.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                  const dayName = day.toLocaleDateString("en-US", { weekday: "short" });
                  const dayNum = day.getDate();
                  const isSelected = form.preferredDate === isoDate;
                  return (
                    <button
                      key={isoDate}
                      onClick={() => setForm(p => ({ ...p, preferredDate: isoDate }))}
                      aria-pressed={isSelected}
                      aria-label={`${dayName} ${dateStr}`}
                      className={`p-3 rounded-xl border-2 text-center transition-all min-h-[64px] focus-visible:outline-[3px] focus-visible:outline-[#D4922A] focus-visible:outline-offset-2 ${
                        isSelected
                          ? "border-[#D4922A] bg-[#D4922A]/10 text-[#D4922A]"
                          : "border-[#C8C5BF] bg-[#F7F6F3] hover:border-white/25 text-[#3D3D3D]"
                      }`}
                    >
                      <p className="text-xs text-[#6B6B6B]">{dayName}</p>
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
                        className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all min-h-[44px] focus-visible:outline-[3px] focus-visible:outline-[#D4922A] focus-visible:outline-offset-2 ${
                          isSelected
                            ? "border-[#D4922A] bg-[#D4922A]/10 text-[#D4922A]"
                            : "border-[#C8C5BF] bg-[#F7F6F3] hover:border-white/25 text-[#3D3D3D]"
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
              className="w-full gradient-amber text-[#1A1A1A] border-0 h-12 text-base"
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
              className="flex items-center gap-1.5 text-sm text-[#6B6B6B] hover:text-gray-200 mb-5 min-h-[44px] transition-colors"
              aria-label="Back to date and time selection"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back
            </button>

            <h2 className="text-xl font-bold text-[#1A1A1A] mb-1">
              Confirm your booking
            </h2>
            <p className="text-sm text-[#6B6B6B] mb-6">Please review the details below before submitting.</p>

            <div className="bg-[#F7F6F3] rounded-xl border border-[#DDDBD7] p-5 space-y-4 mb-6">
              <div className="flex items-center gap-3 pb-4 border-b border-[#DDDBD7]">
                <div className="w-10 h-10 rounded-xl bg-[#D4922A]/15 border border-[#D4922A]/25 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                  <User className="w-5 h-5 text-[#D4922A]" />
                </div>
                <div>
                  <p className="font-bold text-[#1A1A1A]">{host.name}</p>
                  <p className="text-xs text-[#6B6B6B]">Your service provider</p>
                </div>
              </div>

              {[
                { icon: User, label: "Your Name", value: form.clientName },
                { icon: Mail, label: "Email", value: form.clientEmail },
                { icon: Briefcase, label: "Service", value: form.service },
                { icon: Calendar, label: "Date", value: (() => { const d = new Date(form.preferredDate + 'T12:00:00'); return isNaN(d.getTime()) ? form.preferredDate : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); })() },
                { icon: Clock, label: "Time", value: form.preferredTime },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F7F6F3] border border-[#DDDBD7] flex items-center justify-center flex-shrink-0" aria-hidden="true">
                    <Icon className="w-4 h-4 text-[#6B6B6B]" />
                  </div>
                  <div>
                    <p className="text-xs text-[#6B6B6B]">{label}</p>
                    <p className="text-sm font-semibold text-[#1A1A1A]">{value}</p>
                  </div>
                </div>
              ))}

              {form.message && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F7F6F3] border border-[#DDDBD7] flex items-center justify-center flex-shrink-0 mt-0.5" aria-hidden="true">
                    <MessageSquare className="w-4 h-4 text-[#6B6B6B]" />
                  </div>
                  <div>
                    <p className="text-xs text-[#6B6B6B]">Message</p>
                    <p className="text-sm text-[#3D3D3D]">{form.message}</p>
                  </div>
                </div>
              )}
            </div>

            <Button
              className="w-full gradient-amber text-[#1A1A1A] border-0 h-12 text-base gap-2"
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

            <p className="text-xs text-gray-600 text-center mt-3">
              By booking, you agree that {host.name} will contact you to confirm the appointment.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
