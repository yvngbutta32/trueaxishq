import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef } from "react";
import { FileText, Calendar, DollarSign, CheckCircle, Clock, AlertCircle, CreditCard, User, Mail, Phone, Building2, Camera, X, ChevronLeft, ChevronRight, ImageOff, MessageCircle, Send, Upload, Loader2, BriefcaseBusiness, ClipboardCheck, Target } from "lucide-react";
import { toast } from "sonner";

// Normalize booking date strings: ISO "2026-08-01" → "Aug 1, 2026", already-formatted strings pass through
function formatBookingDate(d: string): string {
  if (!d) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  return d;
}
// Normalize booking time strings: 24h "14:00" → "2:00 PM", 12h strings pass through
function formatBookingTime(t: string): string {
  if (!t) return "—";
  const m24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    let h = parseInt(m24[1], 10);
    const min = m24[2];
    const ampm = h >= 12 ? "PM" : "AM";
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${h}:${min} ${ampm}`;
  }
  return t;
}

function formatPortalDate(value: Date | string | null | undefined, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, options);
}

function formatPortalTimestamp(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function isSafeImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (import.meta.env.DEV && url.protocol === "http:");
  } catch {
    return false;
  }
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; color: string }> = {
    draft:     { label: "Draft",     color: "bg-gray-100 text-gray-600" },
    sent:      { label: "Sent",      color: "bg-blue-100 text-blue-700" },
    paid:      { label: "Paid",      color: "bg-green-100 text-green-700" },
    overdue:   { label: "Overdue",   color: "bg-red-100 text-red-700" },
    scheduled: { label: "Scheduled", color: "bg-blue-100 text-blue-700" },
    completed: { label: "Completed", color: "bg-green-100 text-green-700" },
    cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-600" },
    no_show:   { label: "No Show",   color: "bg-orange-100 text-orange-700" },
    lead: { label: "Planning", color: "bg-slate-100 text-slate-700" },
    quoted: { label: "Quote Ready", color: "bg-violet-100 text-violet-700" },
    approved: { label: "Approved", color: "bg-blue-100 text-blue-700" },
    in_progress: { label: "In Progress", color: "bg-indigo-100 text-indigo-700" },
    awaiting_client: { label: "Your Input Needed", color: "bg-orange-100 text-orange-700" },
  };
  const s = map[status] ?? { label: status, color: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  );
}

type PhotoType = "estimate" | "wip" | "finished";
const PORTAL_RESCHEDULE_TIMES = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

export default function ClientPortal() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const [location] = useLocation();
  const [payingId, setPayingId] = useState<number | null>(null);
  const [photoTab, setPhotoTab] = useState<PhotoType>("estimate");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [portalPhotoUploading, setPortalPhotoUploading] = useState(false);
  const [manageBookingId, setManageBookingId] = useState<number | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const portalPhotoInputRef = useRef<HTMLInputElement>(null);

  // Check if redirected back from successful payment
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("paid") === "1") {
      toast.success("Payment successful! Your invoice has been marked as paid.");
      // Clean up the URL
      url.searchParams.delete("paid");
      window.history.replaceState({}, "", url.toString());
    }
  }, [location]);

  const { data, isLoading, error, refetch: refetchPortal } = trpc.portal.view.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const { data: photoData, refetch: refetchPhotos } = trpc.portal.getPhotos.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const { data: jobData } = trpc.portal.getJobs.useQuery(
    { token },
    { enabled: !!token, retry: false, refetchInterval: 60_000 }
  );

  const { data: bookingAvailability, refetch: refetchBookingAvailability } = trpc.portal.getBookingAvailability.useQuery(
    { token, bookingId: manageBookingId ?? 0 },
    { enabled: Boolean(token && manageBookingId), retry: false },
  );

  const { data: messages, refetch: refetchMessages } = trpc.portalMsg.listForPortal.useQuery(
    { token },
    { enabled: !!token, retry: false, refetchInterval: 30_000 }
  );

  const payInvoice = trpc.portal.payInvoice.useMutation({
    onSuccess: (result) => {
      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank");
        toast.success("Redirecting to secure payment...");
      }
      setPayingId(null);
    },
    onError: (err) => {
      toast.error(err.message || "Payment failed. Please try again.");
      setPayingId(null);
    },
  });

  const reschedulePortalBooking = trpc.portal.rescheduleBooking.useMutation({
    onSuccess: async () => {
      await refetchPortal();
      setManageBookingId(null);
      toast.success("Your appointment has been rescheduled.");
    },
    onError: err => toast.error(err.message || "Could not reschedule this appointment."),
  });

  const cancelPortalBooking = trpc.portal.cancelBooking.useMutation({
    onSuccess: async () => {
      await refetchPortal();
      setManageBookingId(null);
      toast.success("Your appointment has been cancelled.");
    },
    onError: err => toast.error(err.message || "Could not cancel this appointment."),
  });

  const sendPortalMessage = trpc.portalMsg.send.useMutation({
    onSuccess: async () => {
      setMessageDraft("");
      await refetchMessages();
      toast.success("Message sent to your provider.");
    },
    onError: (err) => toast.error(err.message || "Your message could not be sent. Please try again."),
  });

  const confirmClientPhoto = trpc.photos.confirmClientUpload.useMutation();

  useEffect(() => {
    if (bookingAvailability?.booking) {
      setRescheduleDate(bookingAvailability.booking.date);
      setRescheduleTime(bookingAvailability.booking.time);
    }
  }, [bookingAvailability?.booking]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const visiblePhotos = (photoData?.photos ?? []).filter(photo => photo.photoType === photoTab && isSafeImageUrl(photo.photoUrl));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxIndex(null);
      if (event.key === "ArrowLeft") setLightboxIndex(index => index !== null && index > 0 ? index - 1 : index);
      if (event.key === "ArrowRight") setLightboxIndex(index => index !== null && index < visiblePhotos.length - 1 ? index + 1 : index);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxIndex, photoData?.photos, photoTab]);

  const handlePortalPhotoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 16 * 1024 * 1024) {
      toast.error("Please choose a photo smaller than 16 MB.");
      return;
    }

    setPortalPhotoUploading(true);
    try {
      const payload = new FormData();
      payload.append("file", file);
      payload.append("photoType", "estimate");
      payload.append("portalToken", token);
      const response = await fetch("/api/photos/upload", { method: "POST", body: payload });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Photo upload failed.");
      }
      const { photoUrl, photoKey } = await response.json() as { photoUrl: string; photoKey: string };
      await confirmClientPhoto.mutateAsync({ photoUrl, photoKey, portalToken: token, caption: "Client estimate photo" });
      await refetchPhotos();
      setPhotoTab("estimate");
      toast.success("Estimate photo added for your provider to review.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Photo upload failed. Please try again.");
    } finally {
      setPortalPhotoUploading(false);
      if (portalPhotoInputRef.current) portalPhotoInputRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#D4922A] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-sm">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center px-4 py-10">
        <div className="relative max-w-md w-full overflow-hidden rounded-3xl border border-[#D4922A]/20 bg-white p-8 text-center shadow-xl shadow-[#1B2D4F]/10 sm:p-10">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-[#D4922A]" />
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-[#1B2D4F] px-3 py-1.5 text-xs font-bold text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D4922A]" /> TrueAxis HQ Client Portal
          </div>
          <div className="w-14 h-14 bg-[#FFF1F1] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-[#FF6B6B]" />
          </div>
          <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">This portal link is no longer active</h2>
          <p className="text-[rgba(26,26,26,0.62)] text-sm leading-relaxed">
            It may have expired, been replaced, or been copied incorrectly. Contact your service provider and ask them to send a fresh secure portal link.
          </p>
          <button type="button" onClick={() => { window.location.href = "/"; }} className="mt-6 min-h-11 rounded-xl bg-[#1B2D4F] px-5 text-sm font-bold text-white transition hover:bg-[#243A5E] focus:outline-none focus:ring-2 focus:ring-[#D4922A] focus:ring-offset-2">Return to TrueAxis HQ</button>
          <p className="mt-4 text-xs text-[rgba(26,26,26,0.45)]">For your privacy, expired links cannot be restored from this page.</p>
        </div>
      </div>
    );
  }

  const { freelancer, client, invoices, bookings } = data;
  const providerName = freelancer?.businessName || freelancer?.name || "Your Provider";
  const unpaidInvoices = invoices.filter(inv => inv.status === "sent" || inv.status === "overdue");
  const totalOutstanding = unpaidInvoices.reduce((sum, inv) => sum + parseFloat(String(inv.amount)), 0);

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isSafeImageUrl(freelancer?.avatarUrl) ? (
              <img src={freelancer.avatarUrl} alt={providerName} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#D4922A] flex items-center justify-center text-white font-bold text-sm">
                {providerName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-xs text-gray-600 leading-none">Client Portal</p>
              <p className="font-semibold text-gray-900 text-sm leading-tight">{providerName}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-600">Viewing as</p>
            <p className="font-medium text-gray-800 text-sm">{client.name}</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Outstanding Balance Banner */}
        {totalOutstanding > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-semibold text-amber-900 text-sm">Outstanding Balance</p>
                <p className="text-amber-700 text-xs">{unpaidInvoices.length} invoice{unpaidInvoices.length !== 1 ? "s" : ""} awaiting payment</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-amber-900">${totalOutstanding.toFixed(2)}</p>
          </div>
        )}

        {/* Client Info Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">Your Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-gray-600" />
              <div>
                <p className="text-xs text-gray-600">Name</p>
                <p className="text-sm font-medium text-gray-900">{client.name}</p>
              </div>
            </div>
            {client.email && (
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-gray-600" />
                <div>
                  <p className="text-xs text-gray-600">Email</p>
                  <p className="text-sm font-medium text-gray-900">{client.email}</p>
                </div>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gray-600" />
                <div>
                  <p className="text-xs text-gray-600">Phone</p>
                  <p className="text-sm font-medium text-gray-900">{client.phone}</p>
                </div>
              </div>
            )}
            {client.service && (
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 text-gray-600" />
                <div>
                  <p className="text-xs text-gray-600">Service</p>
                  <p className="text-sm font-medium text-gray-900">{client.service}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Invoices */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#D4922A]" />
            <h2 className="font-semibold text-gray-900">Invoices</h2>
            <span className="ml-auto text-xs text-gray-600">{invoices.length} total</span>
          </div>
          {invoices.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-600 text-sm">No invoices yet.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <div key={inv.id} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-gray-900 text-sm">{inv.invoiceNumber}</span>
                      {statusBadge(inv.status)}
                    </div>
                    <p className="text-xs text-gray-600 truncate">{inv.service || "Professional Services"}</p>
                    {inv.dueDate && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        Due {formatPortalDate(inv.dueDate)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-bold text-gray-900">${parseFloat(String(inv.amount)).toFixed(2)}</span>
                    {(inv.status === "sent" || inv.status === "overdue") && (
                      <button
                        onClick={() => {
                          setPayingId(inv.id);
                          payInvoice.mutate({
                            token,
                            invoiceId: inv.id,
                            origin: window.location.origin,
                          });
                        }}
                        disabled={payInvoice.isPending && payingId === inv.id}
                        className="flex items-center gap-1.5 bg-[#D4922A] hover:bg-[#d4911c] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                      >
                        <CreditCard className="w-3 h-3" />
                        {payInvoice.isPending && payingId === inv.id ? "..." : "Pay Now"}
                      </button>
                    )}
                    {inv.status === "paid" && (
                      <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Paid {formatPortalDate(inv.paidAt)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bookings */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#D4922A]" />
            <h2 className="font-semibold text-gray-900">Appointments</h2>
            <span className="ml-auto text-xs text-gray-600">{bookings.length} total</span>
          </div>
          {bookings.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-600 text-sm">No appointments yet.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {bookings.map((b) => (
                <div key={b.id} className="px-6 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-gray-900 text-sm">{b.service || "Appointment"}</span>
                        {statusBadge(b.status)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatBookingDate(b.date)} at {formatBookingTime(b.time)}
                        </span>
                        {b.duration && <span>{b.duration} min</span>}
                      </div>
                    </div>
                    {b.status === "scheduled" && (
                      <button
                        type="button"
                        onClick={() => { setManageBookingId(b.id); void refetchBookingAvailability(); }}
                        className="shrink-0 rounded-lg border border-[#D4922A]/35 px-3 py-1.5 text-xs font-semibold text-[#8a5a0b] transition-colors hover:bg-[#fff8ea] focus:outline-none focus:ring-2 focus:ring-[#D4922A] focus:ring-offset-2"
                      >
                        Manage
                      </button>
                    )}
                  </div>
                  {manageBookingId === b.id && (
                    <div className="mt-4 rounded-xl border border-[#D4922A]/25 bg-[#fffaf0] p-4" role="region" aria-label="Manage appointment">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="text-sm font-semibold text-gray-900">Manage your appointment</p><p className="mt-0.5 text-xs text-gray-600">Choose another available time or cancel this appointment.</p></div>
                        <button type="button" onClick={() => setManageBookingId(null)} className="rounded p-1 text-gray-500 hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4922A]" aria-label="Close appointment management"> <X className="h-4 w-4" /> </button>
                      </div>
                      {bookingAvailability ? (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <label className="text-xs font-semibold text-gray-700">New date
                            <input type="date" min={new Date().toISOString().slice(0, 10)} value={rescheduleDate} onChange={event => setRescheduleDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4922A] focus:outline-none focus:ring-2 focus:ring-[#D4922A]/30" />
                          </label>
                          <label className="text-xs font-semibold text-gray-700">Available time
                            <select value={rescheduleTime} onChange={event => setRescheduleTime(event.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4922A] focus:outline-none focus:ring-2 focus:ring-[#D4922A]/30">
                              {PORTAL_RESCHEDULE_TIMES.map(time => {
                                const unavailable = bookingAvailability.bookedSlots.some(slot => slot.date === rescheduleDate && slot.time === time);
                                return <option key={time} value={time} disabled={unavailable}>{formatBookingTime(time)}{unavailable ? " — unavailable" : ""}</option>;
                              })}
                            </select>
                          </label>
                          <div className="sm:col-span-2 flex flex-wrap gap-2 pt-1">
                            <button type="button" disabled={!rescheduleDate || !rescheduleTime || reschedulePortalBooking.isPending} onClick={() => reschedulePortalBooking.mutate({ token, bookingId: b.id, date: rescheduleDate, time: rescheduleTime })} className="rounded-lg bg-[#D4922A] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#b97812] disabled:cursor-not-allowed disabled:opacity-60">{reschedulePortalBooking.isPending ? "Saving…" : "Confirm new time"}</button>
                            <button type="button" disabled={cancelPortalBooking.isPending} onClick={() => { if (window.confirm("Cancel this appointment? This cannot be undone.")) cancelPortalBooking.mutate({ token, bookingId: b.id }); }} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60">{cancelPortalBooking.isPending ? "Cancelling…" : "Cancel appointment"}</button>
                          </div>
                        </div>
                      ) : <div className="mt-4 flex items-center gap-2 text-xs text-gray-600"><Loader2 className="h-4 w-4 animate-spin" /> Loading available times…</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Job Progress Center */}
        {(jobData?.jobs.length ?? 0) > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" aria-labelledby="job-progress-heading">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <BriefcaseBusiness className="w-4 h-4 text-[#D4922A]" />
              <div>
                <h2 id="job-progress-heading" className="font-semibold text-gray-900">Your Work Progress</h2>
                <p className="mt-0.5 text-xs text-gray-600">Milestones, provider updates, and proof of work in one place.</p>
              </div>
              <span className="ml-auto text-xs text-gray-500">{jobData?.jobs.length} active</span>
            </div>
            <div className="divide-y divide-gray-100">
              {jobData?.jobs.map(job => {
                const completed = job.tasks.filter(task => task.status === "done").length;
                const progress = job.tasks.length ? Math.round((completed / job.tasks.length) * 100) : 0;
                const recentActivity = job.activities.slice(0, 2);
                return (
                  <article key={job.id} className="p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-gray-900">{job.title}</p>{statusBadge(job.status)}</div>
                        <p className="mt-1 text-xs font-medium tracking-wide text-[#a46c10]">{job.jobNumber}</p>
                        {job.description && <p className="mt-2 text-sm text-gray-600">{job.description}</p>}
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        <p className="text-xs text-gray-500">Target completion</p>
                        <p className="mt-0.5 text-sm font-medium text-gray-800">{job.targetDate ? formatBookingDate(job.targetDate) : "To be confirmed"}</p>
                        {job.proposal && ["sent", "viewed"].includes(job.proposal.status) && job.proposal.token && (
                          <a href={`/proposal/${job.proposal.token}`} className="mt-2 inline-flex rounded-lg bg-[#1C2333] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#2B3446] focus:outline-none focus:ring-2 focus:ring-[#D4922A] focus:ring-offset-2">Review & approve</a>
                        )}
                        {job.proposal?.status === "signed" && <p className="mt-2 text-xs font-semibold text-emerald-700">Proposal approved</p>}
                      </div>
                    </div>
                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-lg bg-[#faf8f2] p-4">
                        <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700"><ClipboardCheck className="h-3.5 w-3.5 text-[#D4922A]" /> Milestones</span><span className="text-xs font-semibold text-[#8a5a0b]">{progress}% complete</span></div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e9e5db]"><div className="h-full rounded-full bg-[#D4922A] transition-all" style={{ width: `${progress}%` }} /></div>
                        {job.tasks.length ? <ul className="mt-3 space-y-2">{job.tasks.slice(0, 4).map(task => <li key={task.id} className="flex items-center gap-2 text-xs text-gray-700"><CheckCircle className={`h-3.5 w-3.5 shrink-0 ${task.status === "done" ? "text-emerald-600" : "text-gray-300"}`} /><span className={task.status === "done" ? "line-through text-gray-500" : ""}>{task.title}</span></li>)}</ul> : <p className="mt-3 text-xs text-gray-500">Your provider will add milestones as work is planned.</p>}
                      </div>
                      <div className="rounded-lg border border-gray-100 p-4">
                        <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700"><Target className="h-3.5 w-3.5 text-[#D4922A]" /> Latest updates</span>{job.photos.length > 0 && <span className="text-[11px] text-gray-500">{job.photos.length} proof photo{job.photos.length === 1 ? "" : "s"}</span>}</div>
                        {recentActivity.length ? <div className="mt-3 space-y-3">{recentActivity.map(activity => <div key={activity.id}><p className="text-xs text-gray-700">{activity.message}</p><p className="mt-0.5 text-[11px] text-gray-500">{formatPortalTimestamp(activity.createdAt)}</p></div>)}</div> : <p className="mt-3 text-xs text-gray-500">Your provider will post updates here as the job moves forward.</p>}
                      </div>
                    </div>
                    {job.photos.length > 0 && <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{job.photos.slice(0, 5).filter(photo => isSafeImageUrl(photo.photoUrl)).map(photo => <img key={photo.id} src={photo.photoUrl} alt={photo.caption || `${photo.photoType} work proof`} className="h-14 w-14 shrink-0 rounded-md object-cover ring-1 ring-gray-200" loading="lazy" />)}</div>}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* Job Photos Gallery */}
        {(() => {
          const allPhotos = photoData?.photos ?? [];
          const tabs: { key: PhotoType; label: string; icon: string }[] = [
            { key: "estimate", label: "Estimate", icon: "📋" },
            { key: "wip",      label: "In Progress", icon: "🔨" },
            { key: "finished", label: "Finished", icon: "✅" },
          ];
          const tabPhotos = allPhotos.filter(p => p.photoType === photoTab && isSafeImageUrl(p.photoUrl));
          const lightboxPhotos = tabPhotos;

          return (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#D4922A]" />
                <h2 className="font-semibold text-gray-900">Job Photos</h2>
                <span className="ml-auto text-xs text-gray-500 hidden sm:inline">{allPhotos.length} photo{allPhotos.length !== 1 ? "s" : ""}</span>
                <input
                  ref={portalPhotoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handlePortalPhotoUpload(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => portalPhotoInputRef.current?.click()}
                  disabled={portalPhotoUploading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#D4922A] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#b6781d] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {portalPhotoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {portalPhotoUploading ? "Uploading" : "Share a photo"}
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-100">
                {tabs.map(tab => {
                  const count = allPhotos.filter(p => p.photoType === tab.key).length;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setPhotoTab(tab.key)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-medium transition-colors relative ${
                        photoTab === tab.key
                          ? "text-[#D4922A] border-b-2 border-[#D4922A] -mb-px"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                      {count > 0 && (
                        <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          photoTab === tab.key ? "bg-[#D4922A] text-white" : "bg-gray-100 text-gray-600"
                        }`}>{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Grid */}
              <div className="p-4">
                {tabPhotos.length === 0 ? (
                  <div className="py-10 flex flex-col items-center gap-2 text-gray-400">
                    <ImageOff className="w-8 h-8" />
                    <p className="text-sm">
                      {photoTab === "estimate" && "No estimate photos yet. Share one to help your provider prepare an accurate estimate."}
                      {photoTab === "wip" && "No work-in-progress photos yet."}
                      {photoTab === "finished" && "No finished photos yet."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {tabPhotos.map((photo, idx) => (
                      <button
                        key={photo.id}
                        onClick={() => setLightboxIndex(idx)}
                        className="group relative aspect-square rounded-lg overflow-hidden bg-gray-100 hover:ring-2 hover:ring-[#D4922A] transition-all"
                      >
                        <img
                          src={photo.photoUrl}
                          alt={photo.caption || `${photoTab} photo`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />
                        {photo.caption && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                            <p className="text-white text-xs truncate">{photo.caption}</p>
                          </div>
                        )}
                        {photo.uploadedBy === "client" && (
                          <div className="absolute top-1.5 right-1.5 bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">You</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Lightbox */}
              {lightboxIndex !== null && lightboxPhotos.length > 0 && (
                <div
                  className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                  onClick={() => setLightboxIndex(null)}
                >
                  <button
                    className="absolute top-4 right-4 text-white/80 hover:text-white"
                    onClick={() => setLightboxIndex(null)}
                  >
                    <X className="w-7 h-7" />
                  </button>
                  {lightboxIndex > 0 && (
                    <button
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white"
                      onClick={(e) => { e.stopPropagation(); setLightboxIndex(i => (i ?? 1) - 1); }}
                    >
                      <ChevronLeft className="w-9 h-9" />
                    </button>
                  )}
                  {lightboxIndex < lightboxPhotos.length - 1 && (
                    <button
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white"
                      onClick={(e) => { e.stopPropagation(); setLightboxIndex(i => (i ?? 0) + 1); }}
                    >
                      <ChevronRight className="w-9 h-9" />
                    </button>
                  )}
                  <div className="max-w-3xl w-full" onClick={e => e.stopPropagation()}>
                    <img
                      src={lightboxPhotos[lightboxIndex].photoUrl}
                      alt={lightboxPhotos[lightboxIndex].caption || "Job photo"}
                      className="w-full max-h-[80vh] object-contain rounded-lg"
                    />
                    {lightboxPhotos[lightboxIndex].caption && (
                      <p className="text-white/80 text-sm text-center mt-3">{lightboxPhotos[lightboxIndex].caption}</p>
                    )}
                    <p className="text-white/50 text-xs text-center mt-1">
                      {lightboxIndex + 1} / {lightboxPhotos.length}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Secure Portal Messages */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" aria-labelledby="portal-messages-heading">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-[#D4922A]" />
            <h2 id="portal-messages-heading" className="font-semibold text-gray-900">Messages</h2>
            <span className="ml-auto text-xs text-gray-500">Private conversation with {providerName}</span>
          </div>
          <div className="max-h-80 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50/60" aria-live="polite">
            {!messages || messages.length === 0 ? (
              <div className="py-5 text-center text-sm text-gray-500">
                <MessageCircle className="w-7 h-7 mx-auto mb-2 text-gray-300" />
                Send a message if you have a question about your appointment, invoice, or job photos.
              </div>
            ) : (
              messages.map((message) => {
                const fromClient = message.senderRole === "client";
                return (
                  <div key={message.id} className={`flex ${fromClient ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${fromClient ? "bg-[#D4922A] text-white rounded-br-md" : "bg-white border border-gray-200 text-gray-800 rounded-bl-md"}`}>
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                      <p className={`mt-1 text-[10px] ${fromClient ? "text-white/75" : "text-gray-400"}`}>
                        {fromClient ? "You" : providerName} · {formatPortalTimestamp(message.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <form
            className="border-t border-gray-100 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              const body = messageDraft.trim();
              if (!body || sendPortalMessage.isPending) return;
              sendPortalMessage.mutate({ token, body });
            }}
          >
            <label htmlFor="portal-message" className="sr-only">Message your provider</label>
            <div className="flex items-end gap-2">
              <textarea
                id="portal-message"
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.target.value.slice(0, 4000))}
                maxLength={4000}
                rows={2}
                placeholder={`Message ${providerName}…`}
                className="min-h-[48px] flex-1 resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-[#D4922A] focus:ring-2 focus:ring-[#D4922A]/20"
              />
              <button
                type="submit"
                disabled={!messageDraft.trim() || sendPortalMessage.isPending}
                className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-[#D4922A] px-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#b6781d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendPortalMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="hidden sm:inline">Send</span>
              </button>
            </div>
            <p className="mt-1.5 text-right text-[11px] text-gray-400">{messageDraft.length}/4,000</p>
          </form>
        </section>

        {/* Provider Contact */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">Contact Your Provider</h2>
          <div className="flex items-center gap-4">
            {isSafeImageUrl(freelancer?.avatarUrl) ? (
              <img src={freelancer.avatarUrl} alt={providerName} className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#D4922A] flex items-center justify-center text-white font-bold">
                {providerName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-900">{providerName}</p>
              {freelancer?.email && (
                <a href={`mailto:${freelancer.email}`} className="text-sm text-[#D4922A] hover:underline flex items-center gap-1">
                  <Mail className="w-3 h-3" />{freelancer.email}
                </a>
              )}
              {freelancer?.phone && (
                <p className="text-sm text-gray-600 flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3" />{freelancer.phone}
                </p>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 pb-4">
          Powered by <span className="font-semibold text-gray-600">TrueAxis HQ</span>
        </p>
      </main>
    </div>
  );
}
