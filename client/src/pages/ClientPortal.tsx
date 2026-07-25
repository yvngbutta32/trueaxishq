import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { FileText, Calendar, DollarSign, CheckCircle, Clock, AlertCircle, CreditCard, User, Mail, Phone, Building2, ExternalLink } from "lucide-react";
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
  };
  const s = map[status] ?? { label: status, color: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  );
}

export default function ClientPortal() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const [location] = useLocation();
  const [payingId, setPayingId] = useState<number | null>(null);

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

  const { data, isLoading, error } = trpc.portal.view.useQuery(
    { token },
    { enabled: !!token, retry: false }
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
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Portal Not Found</h2>
          <p className="text-gray-600 text-sm">
            This portal link is invalid or has expired. Please contact your service provider for a new link.
          </p>
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
            {freelancer?.avatarUrl ? (
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
                        Due {new Date(inv.dueDate).toLocaleDateString()}
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
                        Paid {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : ""}
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
                <div key={b.id} className="px-6 py-4 flex items-center justify-between gap-4">
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
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Provider Contact */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">Contact Your Provider</h2>
          <div className="flex items-center gap-4">
            {freelancer?.avatarUrl ? (
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
