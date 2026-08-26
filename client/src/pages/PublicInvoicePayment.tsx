import { useEffect, useRef, useState } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { CheckCircle2, CreditCard, FileText, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { PublicRecoveryState } from "@/components/PublicRecoveryState";

const money = (value: string | number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));

export default function PublicInvoicePayment() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const search = useSearch();
  const [startingCheckout, setStartingCheckout] = useState(false);
  const handledPaymentReturn = useRef(false);
  const payment = trpc.invoices.payByToken.useQuery({ token: token ?? "" }, { enabled: Boolean(token), retry: false });
  const createCheckout = trpc.invoices.createStripePaymentForToken.useMutation({
    onError: error => { setStartingCheckout(false); toast.error(error.message || "Unable to start secure payment."); },
  });

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("payment_returned") !== "1" || handledPaymentReturn.current) return;
    handledPaymentReturn.current = true;
    toast.success("Payment submitted. Refreshing the webhook-confirmed invoice status…");
    void payment.refetch();
    params.delete("payment_returned");
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [search, payment]);

  const beginPayment = async () => {
    if (!token || payment.data?.alreadyPaid) return;
    setStartingCheckout(true);
    const result = await createCheckout.mutateAsync({ token, origin: window.location.origin });
    if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
  };

  if (payment.isLoading) return <main className="flex min-h-[100dvh] items-center justify-center bg-[#F7F6F3] p-5" role="status" aria-label="Loading invoice"><Loader2 className="h-9 w-9 animate-spin text-[#007A68]" aria-hidden="true" /></main>;
  if (payment.isError || !payment.data) return <PublicRecoveryState eyebrow="TrueAxis HQ payment" title="This payment link is unavailable" description="It may be expired, replaced, or copied incorrectly. Contact the sender for a current secure invoice link." privacyNote="For privacy, unavailable payment links cannot be restored from this page." />;

  const { invoice, alreadyPaid } = payment.data;
  return <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#F7F6F3] px-5 py-10" aria-labelledby="invoice-payment-heading">
    <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 88% 12%, rgba(0,168,143,0.14), transparent 31%), radial-gradient(circle at 8% 88%, rgba(255,107,107,0.09), transparent 28%)" }} />
    <section className="relative w-full max-w-lg overflow-hidden rounded-[1.5rem] border border-[rgba(27,45,79,0.12)] bg-white shadow-[0_24px_70px_rgba(27,45,79,0.14)]">
      <div className="h-1.5 bg-[linear-gradient(90deg,#00A88F,#FF6B6B,#1B2D4F)]" />
      <div className="p-7 sm:p-9">
        <div className="flex items-start justify-between gap-4"><div><p className="inline-flex items-center gap-2 rounded-full bg-[#1B2D4F] px-3 py-1.5 text-xs font-bold text-white"><span className="h-1.5 w-1.5 rounded-full bg-[#00C9A7]" aria-hidden="true" />TrueAxis HQ secure invoice</p><h1 id="invoice-payment-heading" className="mt-5 text-2xl font-extrabold tracking-[-0.03em] text-[#1A1A1A]">{alreadyPaid ? "This invoice is paid" : "Review your invoice"}</h1><p className="mt-2 text-sm leading-6 text-[#525252]">Invoice {invoice.invoiceNumber} for {invoice.clientName}</p></div><div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${alreadyPaid ? "bg-emerald-50 text-emerald-700" : "bg-teal-50 text-teal-800"}`}><FileText className="h-6 w-6" aria-hidden="true" /></div></div>
        <div className="mt-7 rounded-2xl border border-[#E7E5E4] bg-[#FCFCFB] p-5"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#6B6B6B]">Amount due</p><p className="mt-1 text-3xl font-extrabold tracking-[-0.04em] text-[#1A1A1A]">{money(invoice.amount)}</p></div>{invoice.status && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${alreadyPaid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{alreadyPaid ? "Paid" : invoice.status}</span>}</div>{invoice.service && <p className="mt-4 border-t border-[#E7E5E4] pt-4 text-sm text-[#3D3D3D]">{invoice.service}</p>}{invoice.dueDate && <p className="mt-3 text-xs text-[#666]">Due date: {invoice.dueDate}</p>}{invoice.notes && <p className="mt-3 rounded-lg bg-white p-3 text-xs leading-5 text-[#525252]">{invoice.notes}</p>}</div>
        {alreadyPaid ? <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-950"><div className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" /><p>This invoice is recorded as paid. No further payment is needed.</p></div></div> : <><button type="button" onClick={() => void beginPayment()} disabled={startingCheckout || createCheckout.isPending} className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1B2D4F] px-5 text-sm font-bold text-white transition hover:bg-[#243D6B] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00A88F] focus-visible:ring-offset-2">{startingCheckout ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CreditCard className="h-4 w-4" aria-hidden="true" />}{startingCheckout ? "Opening secure checkout…" : "Continue to secure payment"}</button><p className="mt-4 flex gap-2 text-xs leading-5 text-[#666]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#007A68]" aria-hidden="true" />Payment status changes only after the payment provider’s verified webhook is processed. This page does not mark an invoice paid by itself.</p></>}
        <button type="button" onClick={() => navigate("/")} className="mt-6 text-xs font-semibold text-[#007A68] underline underline-offset-4">Return to TrueAxis HQ</button>
      </div>
    </section>
  </main>;
}
