/* ProposalSign — Public proposal signing page
 * Route: /proposal/:token
 * No auth required — accessible by the client via a secure token link
 */
import { useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PublicRecoveryState } from "@/components/PublicRecoveryState";
import { getProposalPackageSubtotal, parseProposalPackages } from "@shared/proposalPackages";
import {
  CheckCircle, FileText, AlertCircle, Loader2,
  PenLine, Calendar, DollarSign, User, Shield,
  Clock, ArrowRight, ThumbsUp
} from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    draft:    { label: "Draft",    color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
    sent:     { label: "Sent",     color: "#60a5fa", bg: "rgba(96,165,250,0.1)"  },
    viewed:   { label: "Viewed",   color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
    signed:   { label: "Signed",   color: "#22c55e", bg: "rgba(34,197,94,0.1)"   },
    declined: { label: "Declined", color: "#ef4444", bg: "rgba(239,68,68,0.1)"   },
  };
  const s = map[status] ?? map.draft;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.color}30` }}
    >
      {status === "signed" && <CheckCircle className="w-3 h-3" />}
      {s.label}
    </span>
  );
}

export default function ProposalSign() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const [signatureName, setSignatureName] = useState("");
  const [signed, setSigned] = useState(false);
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);

  const { data: proposal, isLoading, error } = trpc.proposals.getPublic.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const signMutation = trpc.proposals.sign.useMutation({
    onSuccess: () => {
      setSigned(true);
      toast.success("Proposal signed successfully!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to sign proposal. Please try again.");
    },
  });

  const handleSign = () => {
    if (!signatureName.trim()) {
      toast.error("Please enter your full name to sign.");
      return;
    }
    if (!agreementChecked) {
      toast.error("Please confirm you agree to the terms.");
      return;
    }
    if (proposalPackages.length && !selectedPackageId) {
      toast.error("Choose one proposal option before signing.");
      return;
    }
    signMutation.mutate({ token, signatureName: signatureName.trim(), selectedPackageId: selectedPackageId ?? undefined });
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F2F0EC] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 text-[#D4922A] animate-spin mx-auto" />
          <p className="text-[rgba(26,26,26,0.55)] text-sm">Loading proposal…</p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !proposal) {
    return <PublicRecoveryState eyebrow="TrueAxis HQ proposal" title="This proposal link is unavailable" description="It may be expired, replaced, or copied incorrectly. Contact the sender to request a new secure link." privacyNote="For privacy, unavailable proposal links cannot be restored from this page." />;
  }

  // ── Already Signed ─────────────────────────────────────────────────────────
  if (signed || proposal.status === "signed") {
    return (
      <div className="min-h-screen bg-[#F2F0EC] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
            <ThumbsUp className="w-10 h-10 text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A] mb-2">Proposal Signed!</h1>
            <p className="text-[rgba(26,26,26,0.55)] text-sm">
              {proposal.status === "signed" && proposal.signatureName
                ? `Signed by ${proposal.signatureName}`
                : "You have successfully signed this proposal."}
            </p>
            {proposal.signedAt && (
              <p className="text-[rgba(26,26,26,0.35)] text-xs mt-1">
                {new Date(proposal.signedAt).toLocaleString()}
              </p>
            )}
          </div>
          <div className="p-4 rounded-xl bg-white/4 border border-[#DDDBD7] text-left space-y-2">
            <p className="text-xs text-[rgba(26,26,26,0.40)] font-semibold uppercase tracking-wider">Proposal Summary</p>
            <p className="text-[#1A1A1A] font-semibold">{proposal.title}</p>
            <p className="text-[#D4922A] font-bold text-lg">
              {proposal.currency} {parseFloat(String(proposal.total)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <p className="text-[rgba(26,26,26,0.35)] text-xs">
            The sender has been notified. They will be in touch shortly.
          </p>
        </div>
      </div>
    );
  }

  // ── Declined ───────────────────────────────────────────────────────────────
  if (proposal.status === "declined") {
    return (
      <div className="min-h-screen bg-[#F2F0EC] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-[#1A1A1A]">Proposal Declined</h1>
          <p className="text-[rgba(26,26,26,0.55)] text-sm">
            This proposal has been declined. Please contact the sender if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  // ── Parse line items ───────────────────────────────────────────────────────
  let lineItems: { id: string; name: string; description?: string; qty: number; unitPrice: number; total: number }[] = [];
  try { lineItems = JSON.parse(proposal.lineItems || "[]"); } catch { lineItems = []; }
  const proposalPackages = parseProposalPackages(proposal.packageOptions);

  const subtotal = parseFloat(String(proposal.subtotal || "0"));
  const taxRate = parseFloat(String(proposal.taxRate || "0"));
  const total = parseFloat(String(proposal.total || "0"));
  const taxAmount = subtotal * (taxRate / 100);

  // ── Main view ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F2F0EC] text-[#1A1A1A]">
      {/* Header */}
      <div className="border-b border-[#DDDBD7] bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#D4922A]/20 border border-[#D4922A]/30 flex items-center justify-center">
              <FileText className="w-4 h-4 text-[#D4922A]" />
            </div>
            <div>
              <p className="text-xs text-[rgba(26,26,26,0.40)] font-medium">Proposal from TrueAxis HQ</p>
              <p className="text-sm font-semibold text-[#1A1A1A] truncate max-w-[200px] sm:max-w-none">{proposal.title}</p>
            </div>
          </div>
          <StatusBadge status={proposal.status} />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Client greeting */}
        <div className="p-5 rounded-2xl bg-white border border-[#DDDBD7]">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-[#D4922A]/15 border border-[#D4922A]/25 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-[#D4922A]" />
            </div>
            <div>
              <p className="text-[#1A1A1A] font-semibold text-lg">Hi {proposal.clientName},</p>
              <p className="text-[rgba(26,26,26,0.55)] text-sm mt-1">
                Please review the proposal below. Once you're ready, sign at the bottom to get started.
              </p>
            </div>
          </div>
        </div>

        {/* Meta row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { icon: DollarSign, label: "Total Value", value: proposalPackages.length ? "Choose an option" : `${proposal.currency} ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, color: "#D4922A" },
            { icon: Calendar, label: "Valid Until", value: proposal.validUntil ? new Date(proposal.validUntil + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Open", color: "#60a5fa" },
            { icon: Clock, label: "Status", value: proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1), color: "#22c55e" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="p-3 rounded-xl bg-white border border-[#DDDBD7]">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-3.5 h-3.5" style={{ color }} />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(26,26,26,0.35)]">{label}</span>
              </div>
              <p className="text-sm font-bold text-[#1A1A1A]">{value}</p>
            </div>
          ))}
        </div>

        {/* Scope of Work */}
        {proposal.scope && (
          <div className="p-5 rounded-2xl bg-white border border-[#DDDBD7] space-y-3">
            <h2 className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wider">Scope of Work</h2>
            <div className="prose prose-sm prose-invert max-w-none">
              <p className="text-[rgba(26,26,26,0.70)] text-sm leading-relaxed whitespace-pre-wrap">{proposal.scope}</p>
            </div>
          </div>
        )}

        {proposalPackages.length > 0 && (
          <section className="rounded-2xl border border-violet-200 bg-violet-50/55 p-5">
            <div className="flex items-start gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-200 bg-violet-100"><FileText className="h-4 w-4 text-violet-700" /></div><div><h2 className="text-sm font-bold uppercase tracking-wider text-violet-950">Choose your proposal option</h2><p className="mt-1 text-sm text-violet-950/70">Select one option to review and sign. Selection is recorded with your signature.</p></div></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{proposalPackages.map(option => { const optionSubtotal = getProposalPackageSubtotal(option); const optionTax = optionSubtotal * (taxRate / 100); const optionTotal = optionSubtotal + optionTax; const selected = selectedPackageId === option.id; return <button key={option.id} type="button" onClick={() => setSelectedPackageId(option.id)} aria-pressed={selected} className={`rounded-xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-violet-400 ${selected ? "border-violet-500 bg-white shadow-sm" : "border-violet-200 bg-white/70 hover:border-violet-300"}`}><div className="flex items-start justify-between gap-3"><p className="font-semibold text-[#1A1A1A]">{option.name}</p><span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${selected ? "border-violet-600 bg-violet-600 shadow-[inset_0_0_0_2px_white]" : "border-violet-300"}`} aria-hidden="true" /></div>{option.description && <p className="mt-2 text-xs leading-5 text-[rgba(26,26,26,0.62)]">{option.description}</p>}<ul className="mt-3 space-y-1.5 border-t border-violet-100 pt-3">{option.lineItems.map(item => <li key={item.id} className="flex justify-between gap-3 text-xs text-[rgba(26,26,26,0.72)]"><span>{item.name}{item.qty > 1 ? ` × ${item.qty}` : ""}</span><span>{proposal.currency} {item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></li>)}</ul><div className="mt-3 flex justify-between border-t border-violet-100 pt-3 text-sm font-bold text-violet-950"><span>Total{taxRate > 0 ? ` incl. ${taxRate}% tax` : ""}</span><span>{proposal.currency} {optionTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div></button>; })}</div>
          </section>
        )}

        {/* Line Items */}
        {lineItems.length > 0 && (
          <div className="rounded-2xl bg-white border border-[#DDDBD7] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#DDDBD7]">
              <h2 className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wider">Deliverables & Pricing</h2>
            </div>
            <div className="divide-y divide-white/5">
              {lineItems.map((li) => (
                <div key={li.id} className="px-5 py-3 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1A1A1A]">{li.name}</p>
                    {li.description && <p className="text-xs text-[rgba(26,26,26,0.45)] mt-0.5">{li.description}</p>}
                    <p className="text-xs text-[rgba(26,26,26,0.35)] mt-0.5">{li.qty} × {proposal.currency} {li.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <p className="text-sm font-bold text-[#1A1A1A] shrink-0">
                    {proposal.currency} {li.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            </div>
            {/* Totals */}
            <div className="px-5 py-4 border-t border-[#DDDBD7] space-y-2 bg-white/2">
              <div className="flex justify-between text-sm text-[rgba(26,26,26,0.55)]">
                <span>Subtotal</span>
                <span>{proposal.currency} {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between text-sm text-[rgba(26,26,26,0.55)]">
                  <span>Tax ({taxRate}%)</span>
                  <span>{proposal.currency} {taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-[#1A1A1A] pt-2 border-t border-[#DDDBD7]">
                <span>Total</span>
                <span className="text-[#D4922A]">{proposal.currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {proposal.notes && (
          <div className="p-5 rounded-2xl bg-white border border-[#DDDBD7] space-y-2">
            <h2 className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wider">Additional Notes</h2>
            <p className="text-[rgba(26,26,26,0.60)] text-sm leading-relaxed whitespace-pre-wrap">{proposal.notes}</p>
          </div>
        )}

        {/* Signature Section */}
        <div className="p-5 rounded-2xl bg-white border border-[#D4922A]/25 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#D4922A]/15 border border-[#D4922A]/25 flex items-center justify-center">
              <PenLine className="w-4 h-4 text-[#D4922A]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1A1A1A]">Electronic Signature</h2>
              <p className="text-xs text-[rgba(26,26,26,0.45)]">Type your full legal name to sign this proposal</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[rgba(26,26,26,0.55)] mb-2">Full Name *</label>
            <input
              type="text"
              value={signatureName}
              onChange={e => setSignatureName(e.target.value)}
              placeholder="e.g. Jane Smith"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-[#DDDBD7] text-[#1A1A1A] placeholder-[rgba(26,26,26,0.25)] text-sm focus:outline-none focus:border-[#D4922A]/60 focus:ring-1 focus:ring-[#D4922A]/30 transition-all"
              onKeyDown={e => { if (e.key === "Enter") handleSign(); }}
            />
            {signatureName.trim() && (
              <p className="mt-2 text-[#D4922A] font-serif text-xl italic pl-1">{signatureName}</p>
            )}
          </div>

          <label className="flex items-start gap-3 cursor-pointer group">
            <div
              onClick={() => setAgreementChecked(v => !v)}
              className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                agreementChecked
                  ? "bg-[#D4922A] border-[#D4922A]"
                  : "border-white/20 bg-white/5 group-hover:border-[#D4922A]/50"
              }`}
            >
              {agreementChecked && <CheckCircle className="w-3 h-3 text-white" />}
            </div>
            <span className="text-xs text-[rgba(26,26,26,0.55)] leading-relaxed">
              I have read and agree to the scope of work and pricing outlined in this proposal. I understand that signing constitutes a legally binding agreement.
            </span>
          </label>

          <Button
            onClick={handleSign}
            disabled={signMutation.isPending || !signatureName.trim() || !agreementChecked || (proposalPackages.length > 0 && !selectedPackageId)}
            className="w-full py-3 rounded-xl font-bold text-sm gap-2 transition-all"
            style={{
              background: signatureName.trim() && agreementChecked && (!proposalPackages.length || selectedPackageId) ? "linear-gradient(135deg, #D4922A, #F0A830)" : undefined,
              opacity: signatureName.trim() && agreementChecked && (!proposalPackages.length || selectedPackageId) ? 1 : 0.5,
            }}
          >
            {signMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Signing…</>
            ) : (
              <><PenLine className="w-4 h-4" /> Sign & Accept Proposal <ArrowRight className="w-4 h-4" /></>
            )}
          </Button>
        </div>

        {/* Trust footer */}
        <div className="flex items-center justify-center gap-2 text-[rgba(26,26,26,0.30)] text-xs pb-8">
          <Shield className="w-3.5 h-3.5" />
          <span>Secured by TrueAxis HQ · Electronic signatures are legally binding</span>
        </div>
      </div>
    </div>
  );
}
