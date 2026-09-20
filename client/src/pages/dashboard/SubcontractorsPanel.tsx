/* TrueAxis HQ — Subcontractors Panel
 * Zero-install subcontractor workflow: the owner keeps a sub roster and invites
 * subs per job with a token-gated link. Subs work entirely from that link — no
 * account, no app. SMS is attempted when Twilio is configured; otherwise the
 * owner copies the link and sends it any way they like. Nothing here ever
 * exposes sub or client data beyond what the owner explicitly shares.
 */
import { useMemo, useState } from "react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  HardHat, Plus, Link2, Copy, RefreshCw, Ban, CheckCircle2, XCircle, Clock3, Send, UserRound,
} from "lucide-react";
import { Field, Modal, Skeleton } from "./shared";

type SubRow = RouterOutputs["subcontractors"]["list"][number];
type InviteRow = RouterOutputs["subcontractors"]["listInvitations"][number];
interface JobOption { id: number; title: string; jobNumber: string; status: string }

const STATUS_STYLES: Record<InviteRow["status"], { label: string; cls: string }> = {
  invited: { label: "Invited", cls: "bg-amber-100 text-amber-800" },
  accepted: { label: "Accepted", cls: "bg-emerald-100 text-emerald-800" },
  declined: { label: "Declined", cls: "bg-red-100 text-red-700" },
  completed: { label: "Completed", cls: "bg-sky-100 text-sky-800" },
};

export default function SubcontractorsPanel() {
  const utils = trpc.useUtils();
  const subs = trpc.subcontractors.list.useQuery();
  const invitations = trpc.subcontractors.listInvitations.useQuery({});
  const jobs = trpc.jobs.list.useQuery(undefined, {
    select: data => data.filter(j => !["completed", "cancelled"].includes(j.status))
      .map(j => ({ id: j.id, title: j.title, jobNumber: j.jobNumber, status: j.status })),
  });

  const invalidate = () => {
    void utils.subcontractors.list.invalidate();
    void utils.subcontractors.listInvitations.invalidate();
  };

  const [subModal, setSubModal] = useState(false);
  const [editing, setEditing] = useState<SubRow | null>(null);
  const [subForm, setSubForm] = useState({ name: "", phone: "", trade: "", email: "", notes: "" });
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ subId: 0, jobId: 0, scopeNote: "", shareClientContact: false });
  const [shareTarget, setShareTarget] = useState<{ inviteUrl: string; smsDelivered: boolean } | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<InviteRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SubRow | null>(null);

  const createSub = trpc.subcontractors.create.useMutation({
    onSuccess: () => { invalidate(); setSubModal(false); setSubForm({ name: "", phone: "", trade: "", email: "", notes: "" }); toast.success("Subcontractor added"); },
    onError: e => toast.error(e.message),
  });
  const updateSub = trpc.subcontractors.update.useMutation({
    onSuccess: () => { invalidate(); setSubModal(false); setEditing(null); toast.success("Subcontractor updated"); },
    onError: e => toast.error(e.message),
  });
  const deleteSub = trpc.subcontractors.delete.useMutation({
    onSuccess: r => { invalidate(); setConfirmDelete(null); toast.success(r.softDeleted ? "Subcontractor deactivated (history kept)" : "Subcontractor removed"); },
    onError: e => toast.error(e.message),
  });
  const inviteToJob = trpc.subcontractors.inviteToJob.useMutation({
    onSuccess: r => {
      invalidate();
      setInviteModal(false);
      setInviteForm({ subId: 0, jobId: 0, scopeNote: "", shareClientContact: false });
      setShareTarget({ inviteUrl: `${window.location.origin}${r.inviteUrl}`, smsDelivered: r.smsDelivered });
    },
    onError: e => toast.error(e.message),
  });
  const resend = trpc.subcontractors.resend.useMutation({
    onSuccess: r => {
      invalidate();
      setShareTarget({ inviteUrl: `${window.location.origin}${r.inviteUrl}`, smsDelivered: r.smsDelivered });
    },
    onError: e => toast.error(e.message),
  });
  const revoke = trpc.subcontractors.revoke.useMutation({
    onSuccess: () => { invalidate(); setConfirmRevoke(null); toast.success("Job link revoked"); },
    onError: e => toast.error(e.message),
  });

  const openAdd = () => { setEditing(null); setSubForm({ name: "", phone: "", trade: "", email: "", notes: "" }); setSubModal(true); };
  const openEdit = (sub: SubRow) => {
    setEditing(sub);
    setSubForm({ name: sub.name, phone: sub.phone, trade: sub.trade ?? "", email: sub.email ?? "", notes: sub.notes ?? "" });
    setSubModal(true);
  };
  const submitSub = () => {
    if (!subForm.name.trim() || !subForm.phone.trim()) { toast.error("Name and phone are required"); return; }
    const payload = {
      name: subForm.name.trim(), phone: subForm.phone.trim(),
      trade: subForm.trade.trim() || null, email: subForm.email.trim() || null,
      notes: subForm.notes.trim() || null,
    };
    if (editing) void updateSub.mutate({ id: editing.id, ...payload });
    else void createSub.mutate(payload);
  };
  const submitInvite = () => {
    if (!inviteForm.subId || !inviteForm.jobId) { toast.error("Pick a subcontractor and a job"); return; }
    void inviteToJob.mutate({
      subId: inviteForm.subId, jobId: inviteForm.jobId,
      scopeNote: inviteForm.scopeNote.trim() || null,
      shareClientContact: inviteForm.shareClientContact,
    });
  };
  const copyLink = async (url: string) => {
    try { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    catch { toast.error("Couldn't copy — select the link text manually"); }
  };

  const activeSubs = useMemo(() => (subs.data ?? []).filter(s => s.active), [subs.data]);
  const liveInvites = useMemo(() => (invitations.data ?? []).filter(i => i.active && !i.revokedAt && new Date(i.expiresAt).getTime() > Date.now()), [invitations.data]);

  return (
    <div className="space-y-8">
      {/* ── Roster ─────────────────────────────────────────────── */}
      <section aria-labelledby="subs-roster">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="subs-roster" className="flex items-center gap-2 text-base font-bold text-[#1A1A1A]"><HardHat className="h-5 w-5 text-[#D4922A]" /> Subcontractor roster</h2>
            <p className="mt-1 text-sm text-[rgba(26,26,26,0.6)]">Your trusted subs. They never need an account — invite them per job with a private link.</p>
          </div>
          <Button onClick={openAdd}><Plus className="mr-1.5 h-4 w-4" /> Add subcontractor</Button>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[rgba(26,26,26,0.08)] bg-white">
          {subs.isLoading ? (
            <div className="p-5"><Skeleton /></div>
          ) : activeSubs.length === 0 ? (
            <div className="p-10 text-center">
              <UserRound className="mx-auto h-8 w-8 text-[rgba(26,26,26,0.25)]" />
              <p className="mt-2 text-sm text-[rgba(26,26,26,0.6)]">No subcontractors yet. Add your first sub to invite them to jobs.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[rgba(26,26,26,0.06)]">
              {activeSubs.map(sub => (
                <li key={sub.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#1A1A1A]">{sub.name}{sub.trade && <span className="ml-2 rounded-full bg-[rgba(26,26,26,0.06)] px-2 py-0.5 text-xs font-semibold text-[rgba(26,26,26,0.65)]">{sub.trade}</span>}</p>
                    <p className="mt-0.5 text-sm text-[rgba(26,26,26,0.6)]">{sub.phone}{sub.email ? ` · ${sub.email}` : ""}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(sub)}>Edit</Button>
                    <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => setConfirmDelete(sub)}>Remove</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ── Invitations ────────────────────────────────────────── */}
      <section aria-labelledby="subs-invites">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="subs-invites" className="flex items-center gap-2 text-base font-bold text-[#1A1A1A"><Link2 className="h-5 w-5 text-[#D4922A]" /> Job invitations</h2>
            <p className="mt-1 text-sm text-[rgba(26,26,26,0.6)]">Each invitation is a private link your sub opens on their phone — no app, no signup. Revoke anytime.</p>
          </div>
          <Button onClick={() => setInviteModal(true)} disabled={activeSubs.length === 0 || (jobs.data ?? []).length === 0}>
            <Send className="mr-1.5 h-4 w-4" /> Invite to job
          </Button>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[rgba(26,26,26,0.08)] bg-white">
          {invitations.isLoading ? (
            <div className="p-5"><Skeleton /></div>
          ) : liveInvites.length === 0 ? (
            <div className="p-10 text-center">
              <Clock3 className="mx-auto h-8 w-8 text-[rgba(26,26,26,0.25)]" />
              <p className="mt-2 text-sm text-[rgba(26,26,26,0.6)]">No live invitations. Invite a sub to a job and they'll get a private link that works instantly.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[rgba(26,26,26,0.06)]">
              {liveInvites.map(inv => {
                const st = STATUS_STYLES[inv.status];
                return (
                  <li key={inv.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-[#1A1A1A]">
                          {inv.subName}
                          <span className="ml-2 text-sm font-normal text-[rgba(26,26,26,0.55)]">→ {inv.jobTitle} (#{inv.jobNumber})</span>
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[rgba(26,26,26,0.6)]">
                          <span className={`rounded-full px-2 py-0.5 font-semibold ${st.cls}`}>
                            {inv.status === "accepted" || inv.status === "declined" ? (inv.status === "accepted" ? <CheckCircle2 className="mr-1 inline h-3 w-3" /> : <XCircle className="mr-1 inline h-3 w-3" />) : null}
                            {st.label}
                          </span>
                          {inv.noteCount > 0 && <span>{inv.noteCount} note{inv.noteCount === 1 ? "" : "s"}</span>}
                          {inv.shareClientContact && <span>Client contact shared</span>}
                          <span>Expires {new Date(inv.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => void resend.mutate({ assignmentId: inv.id })}><RefreshCw className="mr-1 h-3.5 w-3.5" /> Resend</Button>
                        <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => setConfirmRevoke(inv)}><Ban className="mr-1 h-3.5 w-3.5" /> Revoke</Button>
                      </div>
                    </div>
                    {inv.scopeNote && <p className="mt-2 line-clamp-2 text-xs text-[rgba(26,26,26,0.5)]">{inv.scopeNote}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ── Add/Edit sub modal ─────────────────────────────────── */}
      <Modal open={subModal} title={editing ? "Edit subcontractor" : "Add subcontractor"} onClose={() => setSubModal(false)}>
        <div className="space-y-4">
          <Field label="Name" value={subForm.name} onChange={v => setSubForm(f => ({ ...f, name: v }))} placeholder="e.g. Redline Electrical" required />
          <Field label="Phone" value={subForm.phone} onChange={v => setSubForm(f => ({ ...f, phone: v }))} placeholder="+1 512 555 0100" required autoComplete="tel" />
          <Field label="Trade (optional)" value={subForm.trade} onChange={v => setSubForm(f => ({ ...f, trade: v }))} placeholder="e.g. Electrical" />
          <Field label="Email (optional)" value={subForm.email} onChange={v => setSubForm(f => ({ ...f, email: v }))} placeholder="sub@company.com" type="email" autoComplete="email" />
          <Field label="Notes (optional)" value={subForm.notes} onChange={v => setSubForm(f => ({ ...f, notes: v }))} placeholder="Licensing, insurance, rates…" textarea rows={2} maxLen={1000} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setSubModal(false)}>Cancel</Button>
            <Button onClick={submitSub} disabled={createSub.isPending || updateSub.isPending}>{editing ? "Save changes" : "Add subcontractor"}</Button>
          </div>
        </div>
      </Modal>

      {/* ── Invite to job modal ────────────────────────────────── */}
      <Modal open={inviteModal} title="Invite subcontractor to a job" onClose={() => setInviteModal(false)}>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-[#1A1A1A]">Subcontractor</label>
            <select value={inviteForm.subId} onChange={e => setInviteForm(f => ({ ...f, subId: Number(e.target.value) }))} className="mt-1.5 w-full form-input-light">
              <option value={0}>Choose a sub…</option>
              {activeSubs.map(s => <option key={s.id} value={s.id}>{s.name}{s.trade ? ` — ${s.trade}` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-[#1A1A1A]">Job</label>
            <select value={inviteForm.jobId} onChange={e => setInviteForm(f => ({ ...f, jobId: Number(e.target.value) }))} className="mt-1.5 w-full form-input-light">
              <option value={0}>Choose a job…</option>
              {(jobs.data ?? []).map(j => <option key={j.id} value={j.id}>#{j.jobNumber} — {j.title}</option>)}
            </select>
          </div>
          <div>
            <Field label="Scope & site details" value={inviteForm.scopeNote} onChange={v => setInviteForm(f => ({ ...f, scopeNote: v }))} placeholder="What the sub needs: scope, site address, gate codes, materials, timing…" textarea rows={4} maxLen={2000} />
            <p className="mt-1 text-xs text-[rgba(26,26,26,0.55)]">This is what your sub sees. Put site details here — nothing else about the job is shared.</p>
          </div>
          <label className="flex items-start gap-2.5 text-sm text-[rgba(26,26,26,0.75)]">
            <input type="checkbox" checked={inviteForm.shareClientContact} onChange={e => setInviteForm(f => ({ ...f, shareClientContact: e.target.checked }))} className="mt-0.5 h-4 w-4 accent-[#D4922A]" />
            <span>Share the client's name and phone with this sub</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setInviteModal(false)}>Cancel</Button>
            <Button onClick={submitInvite} disabled={inviteToJob.isPending}>Send invitation</Button>
          </div>
        </div>
      </Modal>

      {/* ── Share link modal ───────────────────────────────────── */}
      <Modal open={shareTarget !== null} title="Invitation link ready" onClose={() => setShareTarget(null)}>
        {shareTarget && (
          <div className="space-y-4">
            <p className="text-sm text-[rgba(26,26,26,0.75)]">
              {shareTarget.smsDelivered
                ? "We texted the invitation to your sub. You can also copy the link below."
                : "Twilio isn't configured yet, so we couldn't text it automatically. Copy the link and send it to your sub however you like — it works the same either way."}
            </p>
            <div className="rounded-xl border border-[rgba(26,26,26,0.12)] bg-[rgba(26,26,26,0.03)] p-3">
              <p className="break-all text-xs text-[rgba(26,26,26,0.7)]">{shareTarget.inviteUrl}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => void copyLink(shareTarget.inviteUrl)}><Copy className="mr-1.5 h-4 w-4" /> Copy link</Button>
              <Button onClick={() => setShareTarget(null)}>Done</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmRevoke !== null}
        onOpenChange={(open) => { if (!open) setConfirmRevoke(null); }}
        title="Revoke this job link?"
        description={confirmRevoke ? `The invitation for ${confirmRevoke.subName} will stop working immediately, even if it hasn't expired.` : ""}
        confirmLabel="Revoke link"
        variant="destructive"
        onConfirm={() => confirmRevoke && void revoke.mutate({ assignmentId: confirmRevoke.id })}
      />
      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title={confirmDelete ? `Remove ${confirmDelete.name}?` : ""}
        description="If they have job history, they'll be deactivated instead so records stay intact."
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => confirmDelete && void deleteSub.mutate({ id: confirmDelete.id })}
      />
    </div>
  );
}
