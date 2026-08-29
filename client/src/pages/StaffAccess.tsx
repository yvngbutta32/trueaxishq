import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, ShieldCheck, UsersRound } from "lucide-react";

function getInviteToken() {
  return new URLSearchParams(window.location.search).get("token")?.trim() ?? "";
}

export default function StaffAccess() {
  const [, navigate] = useLocation();
  const { user, loading } = useAuth();
  const token = useMemo(getInviteToken, []);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const utils = trpc.useUtils();
  const inviteQuery = trpc.staffAccess.getInvite.useQuery({ token }, { enabled: token.length === 64, retry: false });
  const register = trpc.staffAccess.register.useMutation({
    onSuccess: data => {
      utils.auth.me.setData(undefined, data.user as any);
      toast.success("Staff access activated.");
      navigate("/staff");
    },
    onError: error => toast.error(error.message),
  });
  const accept = trpc.staffAccess.accept.useMutation({
    onSuccess: () => { toast.success("Staff access activated."); navigate("/staff"); },
    onError: error => toast.error(error.message),
  });

  if (!token || token.length !== 64) return <Recovery title="Staff access link unavailable" detail="Use the private link shared by the workspace owner." />;
  if (inviteQuery.isLoading || loading) return <div className="grid min-h-screen place-items-center bg-[#F7F6F3]"><Loader2 className="h-7 w-7 animate-spin text-[#D4922A]" /></div>;
  if (inviteQuery.isError || !inviteQuery.data) return <Recovery title="Staff access link unavailable" detail="This link may have expired, been replaced, or already been used. Ask the workspace owner for a new link." />;
  const invite = inviteQuery.data;
  const signedInAccountMismatches = Boolean(user) && invite.canAcceptWithSignedInEmail === false;

  return (
    <main className="min-h-screen bg-[#F7F6F3] px-4 py-10">
      <section className="mx-auto max-w-lg rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-6 shadow-sm">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D4922A]/15 text-[#8A5A0B]"><UsersRound className="h-5 w-5" /></div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#D4922A]">Private staff access</p>
        <h1 className="mt-1 text-2xl font-bold text-[#1A1A1A]">Join {invite.teamMemberName}&apos;s assigned work</h1>
        <p className="mt-2 text-sm leading-6 text-[rgba(26,26,26,0.65)]">This access is limited to the work assigned to you. It does not grant owner finance, private CRM, or dispatch-note access. The link expires {new Date(invite.expiresAt).toLocaleString()}.</p>

        {user ? (
          <div className="mt-6 rounded-xl bg-[#F7F6F3] p-4">
            <p className="text-sm font-semibold text-[#1A1A1A]">Signed in as {user.email}</p>
            {signedInAccountMismatches ? (
              <div role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
                <p className="font-semibold">This private link is not available for the signed-in account.</p>
                <p className="mt-1">Sign in with the invited account, then reopen the link. No access has been activated.</p>
              </div>
            ) : (
              <button type="button" onClick={() => accept.mutate({ token })} disabled={accept.isPending} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#D4922A] px-4 py-2.5 text-sm font-bold text-white transition-transform duration-150 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A5A0B] focus-visible:ring-offset-2 disabled:opacity-50">
                {accept.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Accept staff access
              </button>
            )}
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={event => {
              event.preventDefault();
              register.mutate({ token, name: name.trim(), email: email.trim(), password });
            }}
          >
            <p className="rounded-xl bg-[#F7F6F3] p-3 text-xs text-[rgba(26,26,26,0.62)]">Create an account with the same email address the owner invited. If you already have an account, sign in first and reopen this private link.</p>
            <Field label="Full name" value={name} setValue={setName} autoComplete="name" />
            <Field label="Invited email" value={email} setValue={setEmail} type="email" autoComplete="email" />
            <Field label="Password" value={password} setValue={setPassword} type="password" autoComplete="new-password" />
            <button type="submit" disabled={!name.trim() || !email.trim() || password.length < 8 || register.isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#D4922A] px-4 py-3 text-sm font-bold text-white transition-transform duration-150 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A5A0B] focus-visible:ring-offset-2 disabled:opacity-50">
              {register.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create account and accept access
            </button>
          </form>
        )}

        <p className="mt-5 flex items-start gap-2 text-xs text-[rgba(26,26,26,0.52)]"><ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />The workspace owner can revoke this access at any time.</p>
      </section>
    </main>
  );
}

function Field({ label, value, setValue, type = "text", autoComplete }: { label: string; value: string; setValue: (value: string) => void; type?: string; autoComplete?: string }) {
  return <label className="block text-sm font-semibold text-[#1A1A1A]">{label}<input required type={type} value={value} onChange={event => setValue(event.target.value)} autoComplete={autoComplete} className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A5A0B] focus-visible:ring-offset-2" /></label>;
}

function Recovery({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#F7F6F3] p-4"><section className="max-w-md rounded-2xl bg-white p-7 text-center shadow-sm"><h1 className="text-xl font-bold text-[#1A1A1A]">{title}</h1><p className="mt-2 text-sm leading-6 text-[rgba(26,26,26,0.62)]">{detail}</p></section></main>;
}
