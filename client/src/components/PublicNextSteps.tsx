/**
 * Shared "next steps" continuation cards for the public client journey.
 * Used on the proposal signed screen and the invoice paid screen so a client
 * can always reach the next step — pay the invoice, or self-schedule service —
 * instead of dead-ending after a signature or payment.
 */
export function PublicNextSteps({
  payUrl,
  paid,
  invoiceNumber,
  bookingUrl,
}: {
  payUrl: string | null;
  paid?: boolean;
  invoiceNumber?: string | null;
  bookingUrl: string | null;
}) {
  if (!payUrl && !bookingUrl) return null;

  return (
    <div className="space-y-2 text-left">
      <p className="text-xs text-[rgba(26,26,26,0.40)] font-semibold uppercase tracking-wider">Next steps</p>
      {payUrl && !paid && (
        <a href={payUrl} className="flex items-center justify-between rounded-xl border border-[#D4922A]/30 bg-white px-4 py-3 transition hover:border-[#D4922A]/60">
          <span className="text-sm font-semibold text-[#1A1A1A]">{invoiceNumber ? `Pay invoice ${invoiceNumber}` : "Pay your invoice"}</span>
          <span className="text-sm font-bold text-[#D4922A]">Pay now →</span>
        </a>
      )}
      {paid && (
        <div className="flex items-center justify-between rounded-xl border border-green-500/30 bg-green-50 px-4 py-3">
          <span className="text-sm font-semibold text-[#1A1A1A]">{invoiceNumber ? `Invoice ${invoiceNumber} is paid` : "Invoice paid"}</span>
          <span className="text-sm font-bold text-green-600">Paid ✓</span>
        </div>
      )}
      {bookingUrl && (
        <a href={bookingUrl} className="flex items-center justify-between rounded-xl border border-[#DDDBD7] bg-white px-4 py-3 transition hover:border-[#D4922A]/60">
          <span className="text-sm font-semibold text-[#1A1A1A]">Schedule your service</span>
          <span className="text-sm font-bold text-[#D4922A]">Book a time →</span>
        </a>
      )}
    </div>
  );
}
