import { useState } from "react";
import { Building2, CheckCircle2, Loader2, PauseCircle, PlayCircle, Plus, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { FeatureLock } from "@/components/FeatureLock";
import { subAccountLimitFor } from "@shared/plans";

interface SubAccount {
  id: number;
  name: string | null;
  email: string | null;
  businessName: string | null;
  subSuspended: boolean;
  createdAt: string | Date;
  lastSignedIn: string | Date;
  clients: number;
  jobs: number;
  invoices: number;
}

function StrongPasswordHint() {
  return (
    <p className="text-xs text-[rgba(26,26,26,0.55)]">
      Share the password with the workspace owner privately — they can change it from their own Settings, and you can always reset it here.
    </p>
  );
}

export default function SubAccountsPanel() {
  return (
    <FeatureLock feature="subAccounts" label="Managed client workspaces (sub-accounts)">
      <SubAccountsInner />
    </FeatureLock>
  );
}

function SubAccountsInner() {
  const utils = trpc.useUtils();
  const subsQuery = trpc.agency.listSubAccounts.useQuery(undefined, { refetchOnMount: "always" });
  const [form, setForm] = useState({ businessName: "", email: "", password: "" });
  const [resetFor, setResetFor] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const createSub = trpc.agency.createSubAccount.useMutation({
    onSuccess: async () => {
      setForm({ businessName: "", email: "", password: "" });
      setActionError(null);
      await utils.invalidate();
    },
    onError: (err) => setActionError(err.message),
  });
  const setStatus = trpc.agency.setSubAccountStatus.useMutation({
    onSuccess: async () => { setActionError(null); await utils.invalidate(); },
    onError: (err) => setActionError(err.message),
  });
  const resetPassword = trpc.agency.resetSubAccountPassword.useMutation({
    onSuccess: async () => { setResetFor(null); setNewPassword(""); setActionError(null); await utils.invalidate(); },
    onError: (err) => setActionError(err.message),
  });

  const subs = (subsQuery.data?.subs ?? []) as SubAccount[];
  const limit = subsQuery.data?.limit ?? subAccountLimitFor("agency");
  const busy = createSub.isPending || setStatus.isPending || resetPassword.isPending;

  return (
    <div className="space-y-6 fade-in-up">
      <section className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[#1A1A1A]">
          <Building2 className="h-5 w-5" /> Managed client workspaces
        </h2>
        <p className="mt-1 text-sm text-[rgba(26,26,26,0.7)]">
          Run a separate, fully-isolated workspace for each of your crews, locations, or managed client businesses.
          Each workspace signs in with its own email, sees only its own clients and jobs, and carries the full Pro feature set under your Agency plan.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-[#D4922A]/10 px-3 py-1 font-bold text-[#8A5A0B]">
            {subs.length} of {limit} workspaces in use
          </span>
          <span className="flex items-center gap-1 text-xs text-[rgba(26,26,26,0.55)]">
            <ShieldCheck className="h-3.5 w-3.5" /> Data isolation is enforced server-side on every query.
          </span>
        </div>
      </section>

      {actionError && (
        <p className="rounded-2xl border border-[#B42318]/30 bg-[#B42318]/5 px-4 py-3 text-sm font-bold text-[#B42318]">{actionError}</p>
      )}

      {subs.length === 0 ? (
        <section className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-[#FAFAF8] p-6 text-center">
          <p className="text-sm text-[rgba(26,26,26,0.65)]">
            No workspaces yet. Create your first one below — the client business signs in and works in it independently.
          </p>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {subs.map(sub => (
            <div key={sub.id} className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-[#1A1A1A]">{sub.businessName || sub.name || "Workspace"}</h3>
                  <p className="text-xs text-[rgba(26,26,26,0.55)]">{sub.email}</p>
                </div>
                {sub.subSuspended ? (
                  <span className="rounded-full bg-[#B42318]/10 px-2.5 py-1 text-xs font-bold text-[#B42318]">Suspended</span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Active
                  </span>
                )}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-[#FAFAF8] p-2">
                  <p className="text-lg font-bold text-[#1A1A1A]">{sub.clients}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#6B6B6B]">Clients</p>
                </div>
                <div className="rounded-xl bg-[#FAFAF8] p-2">
                  <p className="text-lg font-bold text-[#1A1A1A]">{sub.jobs}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#6B6B6B]">Jobs</p>
                </div>
                <div className="rounded-xl bg-[#FAFAF8] p-2">
                  <p className="text-lg font-bold text-[#1A1A1A]">{sub.invoices}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#6B6B6B]">Invoices</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-[rgba(26,26,26,0.5)]">
                Created {new Date(sub.createdAt).toLocaleDateString()} · Last signed in {new Date(sub.lastSignedIn).toLocaleDateString()}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStatus.mutate({ id: sub.id, suspended: !sub.subSuspended })}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold disabled:opacity-60 ${
                    sub.subSuspended
                      ? "bg-[#1A3C2E] text-white hover:bg-[#143024]"
                      : "border border-[#B42318]/40 text-[#B42318] hover:bg-[#B42318]/10"
                  }`}
                >
                  {sub.subSuspended ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
                  {sub.subSuspended ? "Reactivate" : "Suspend"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { setResetFor(resetFor === sub.id ? null : sub.id); setActionError(null); }}
                  className="rounded-xl border border-[rgba(26,26,26,0.15)] px-3 py-1.5 text-xs font-bold text-[#1A1A1A] hover:bg-[#F0EEE9] disabled:opacity-60"
                >
                  Reset password
                </button>
              </div>
              {resetFor === sub.id && (
                <div className="mt-3 rounded-xl bg-[#FAFAF8] p-3">
                  <label className="text-xs font-bold text-[#1A1A1A]" htmlFor={`newpass-${sub.id}`}>New password for {sub.email}</label>
                  <div className="mt-1 flex gap-2">
                    <input
                      id={`newpass-${sub.id}`}
                      type="text"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="New strong password"
                      className="flex-1 rounded-lg border border-[rgba(26,26,26,0.15)] bg-white px-3 py-2 text-sm"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      disabled={busy || newPassword.length < 8}
                      onClick={() => resetPassword.mutate({ id: sub.id, password: newPassword })}
                      className="rounded-lg bg-[#1B2D4F] px-3 py-2 text-xs font-bold text-white hover:bg-[#132343] disabled:opacity-60"
                    >
                      {resetPassword.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set password"}
                    </button>
                  </div>
                  <div className="mt-2"><StrongPasswordHint /></div>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      <section className="rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-5">
        <h3 className="flex items-center gap-2 font-bold text-[#1A1A1A]"><Plus className="h-4 w-4" /> Create a new workspace</h3>
        {subs.length >= limit ? (
          <p className="mt-2 text-sm text-[rgba(26,26,26,0.65)]">
            You've reached your plan's {limit}-workspace limit. Suspend a workspace to free a slot, or contact support about larger agency arrangements.
          </p>
        ) : (
          <form
            className="mt-3 grid gap-3 sm:grid-cols-3"
            onSubmit={e => { e.preventDefault(); createSub.mutate({ businessName: form.businessName, email: form.email, password: form.password }); }}
          >
            <div>
              <label className="text-xs font-bold text-[#1A1A1A]" htmlFor="sub-biz">Business name</label>
              <input
                id="sub-biz" required maxLength={255} value={form.businessName}
                onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                placeholder="Riverside Lawn Crew"
                className="mt-1 w-full rounded-xl border border-[rgba(26,26,26,0.15)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#1A1A1A]" htmlFor="sub-email">Workspace email</label>
              <input
                id="sub-email" required type="email" maxLength={320} value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="crew@example.com"
                className="mt-1 w-full rounded-xl border border-[rgba(26,26,26,0.15)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#1A1A1A]" htmlFor="sub-pass">Password</label>
              <input
                id="sub-pass" required type="text" value={form.password} minLength={8}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Strong password (8+ chars)"
                className="mt-1 w-full rounded-xl border border-[rgba(26,26,26,0.15)] bg-white px-3 py-2 text-sm"
                autoComplete="off"
              />
            </div>
            <div className="sm:col-span-3">
              <StrongPasswordHint />
              <button
                type="submit"
                disabled={busy || !form.businessName || !form.email || form.password.length < 8}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#D4922A] px-4 py-2 text-sm font-bold text-white hover:bg-[#B87716] disabled:opacity-60"
              >
                {createSub.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create workspace
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
