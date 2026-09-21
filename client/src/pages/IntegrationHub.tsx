import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { TerminalSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Bell, CalendarDays, CheckCircle2, CreditCard, ExternalLink, Loader2, MessageSquare, PlugZap, ShieldCheck, XCircle } from "lucide-react";

type Provider = "google_calendar" | "outlook_calendar" | "quickbooks" | "gmail" | "outlook" | "slack" | "twilio" | "zapier" | "stripe";
type Category = "calendar" | "accounting" | "communications" | "automation" | "payments";

const categoryMeta: Record<Category, { label: string; icon: typeof CalendarDays }> = {
  calendar: { label: "Calendar", icon: CalendarDays },
  accounting: { label: "Accounting", icon: CreditCard },
  communications: { label: "Communications", icon: MessageSquare },
  automation: { label: "Automation", icon: PlugZap },
  payments: { label: "Payments", icon: ShieldCheck },
};

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function StripeConnectCard() {
  const utils = trpc.useUtils();
  const { data: status } = trpc.stripeConnect.status.useQuery();
  const start = trpc.stripeConnect.start.useMutation({
    onError: e => toast.error(e.message),
  });
  const disconnect = trpc.stripeConnect.disconnect.useMutation({
    onSuccess: () => { void utils.stripeConnect.status.invalidate(); toast.info("Your Stripe account is disconnected. Client payments are paused until you reconnect."); },
    onError: e => toast.error(e.message),
  });

  const account = status?.account ?? null;
  const platformConfigured = status?.platformConfigured ?? false;

  return <section className="rounded-2xl border border-[#D4922A]/25 bg-[#D4922A]/5 p-4">
    <div className="flex gap-3">
      <CreditCard className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#9A610A]" />
      <div className="flex-1">
        <h2 className="text-sm font-bold text-[#1A1A1A]">Client payments — your own Stripe account</h2>
        <p className="mt-1 text-xs leading-5 text-[rgba(26,26,26,0.65)]">Client money from invoices and booking deposits goes straight to <strong>your</strong> Stripe account, never through the platform. Connect once and payouts land in your bank.</p>
        <div className="mt-3 rounded-lg bg-white px-3 py-2">
          {!platformConfigured ? <p className="text-xs text-[rgba(26,26,26,0.62)]">Stripe is not configured on this deployment yet. You can mark invoices paid manually at any time; card checkout unlocks once the platform key is set.</p>
            : !account ? <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-[rgba(26,26,26,0.62)]">No Stripe account connected yet. Card checkout for clients stays off until you connect your own account.</p><Button size="sm" onClick={() => start.mutate(undefined, { onSuccess: r => { window.location.href = r.url; } })} disabled={start.isPending} className="bg-[#D4922A] text-white hover:bg-[#B87716]">{start.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect Stripe"}</Button></div>
            : <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-[#1A1A1A]">{account.id}</p>
                  <p className="text-xs text-[rgba(26,26,26,0.62)]">{account.chargesEnabled ? "Charges enabled — clients can pay by card." : account.detailsSubmitted ? "Charges pending — Stripe is finishing your account review." : "Onboarding not finished yet — complete it to accept client card payments."}</p>
                </div>
                <div className="flex gap-2">
                  {!account.chargesEnabled && <Button size="sm" onClick={() => start.mutate(undefined, { onSuccess: r => { window.location.href = r.url; } })} disabled={start.isPending} variant="outline" className="border-[#D4922A]/40 text-[#8A5A0B]">Continue onboarding</Button>}
                  <Button size="sm" variant="outline" onClick={() => disconnect.mutate()} disabled={disconnect.isPending} className="border-rose-200 text-rose-700 hover:bg-rose-50">Disconnect</Button>
                </div>
              </div>}
        </div>
      </div>
    </div>
  
  <section className="mt-2 rounded-2xl border border-[#1B2D4F]/15 bg-[#F8FBFB] p-4">
    <div className="flex gap-3">
      <TerminalSquare className="mt-0.5 h-5 w-5 shrink-0 text-[#007A68]" />
      <div className="flex-1">
        <h2 className="text-sm font-bold text-[#1A1A1A]">Card-present &amp; Tap to Pay (Stripe Terminal)</h2>
        <p className="mt-1 text-xs leading-5 text-[rgba(26,26,26,0.65)]">Take payments in person with a Stripe Terminal-compatible reader. Connection tokens are issued on <strong>your</strong> connected Stripe account, and any card-present payment can be recorded on an invoice — even from a reader you already own, at $0 fixed cost.</p>
        <div className="mt-3 rounded-lg bg-white px-3 py-2">
          <TerminalStatus />
        </div>
      </div>
    </div>
  </section>
</section>;
}

function PushNotificationsCard() {
  const utils = trpc.useUtils();
  const { data: pushStatus } = trpc.push.status.useQuery();
  const { data: vapid } = trpc.push.vapidPublicKey.useQuery();
  const subscribe = trpc.push.subscribe.useMutation({
    onSuccess: () => { void utils.push.status.invalidate(); toast.success("Push notifications enabled on this device."); },
    onError: e => toast.error(e.message),
  });
  const unsubscribe = trpc.push.unsubscribe.useMutation({
    onSuccess: () => { void utils.push.status.invalidate(); toast.info("Push notifications disabled on this device."); },
    onError: e => toast.error(e.message),
  });
  const sendTest = trpc.push.sendTest.useMutation({
    onSuccess: r => r.sent > 0 ? toast.success(`Test notification delivered to ${r.sent} device(s).`) : toast.error(`Not delivered: ${r.skippedBecause ?? "unknown reason"}`),
    onError: e => toast.error(e.message),
  });

  const supported = typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
  const subscribed = pushStatus?.subscribed ?? false;

  const handleSubscribe = async () => {
    try {
      if (!vapid?.publicKey) { toast.error("Push keys unavailable on the server. Contact support."); return; }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { toast.error("Notification permission was denied in your browser."); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) { toast.error("Browser returned an incomplete subscription."); return; }
      subscribe.mutate({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent: navigator.userAgent.slice(0, 255),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not enable push on this device.");
    }
  };

  const handleUnsubscribe = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribe.mutate({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      } else if (subscribed) {
        // Server knows a device this browser cannot see (e.g. re-installed);
        // it still prunes when delivery fails, so report honestly.
        toast.info("No active browser subscription found; stale entries clean themselves up.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not disable push.");
    }
  };

  return (
    <section className="mb-2">
      <div className="mb-3 flex items-center gap-2"><Bell className="h-4 w-4 text-[#D4922A]" /><h2 className="text-sm font-bold text-[#1A1A1A]">Notifications</h2></div>
      <article className="flex flex-col rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-[#1A1A1A]">Browser push notifications</h3>
            <p className="mt-1 text-xs leading-5 text-[rgba(26,26,26,0.58)]">
              Real-time alerts on any device with a browser — new bookings from your website and manually created bookings. Open protocol, no app store, no per-message fees.
            </p>
          </div>
          <StatusBadge status={subscribed ? "connected" : supported ? "needs_configuration" : "unavailable"} />
        </div>
        {!supported && <p className="mt-3 rounded-lg bg-[#F7F6F3] px-3 py-2 text-xs text-[rgba(26,26,26,0.62)]">This browser does not support web push. iOS/iPadOS requires the app installed to the Home Screen first.</p>}
        <div className="mt-auto flex gap-2 pt-4">
          {subscribed ? (
            <>
              <Button size="sm" variant="outline" onClick={() => sendTest.mutate()} disabled={sendTest.isPending} className="flex-1 border-[#D4922A]/40 text-[#8A5A0B]" aria-label="Send a test push notification to this device">Send test notification</Button>
              <Button size="sm" variant="outline" onClick={handleUnsubscribe} disabled={unsubscribe.isPending} className="border-rose-200 text-rose-700 hover:bg-rose-50" aria-label="Disable push notifications on this device">Disable</Button>
            </>
          ) : (
            <Button size="sm" onClick={handleSubscribe} disabled={!supported || subscribe.isPending} className="w-full bg-[#1C2333] text-white hover:bg-[#2B3446]" aria-label="Enable push notifications on this device">
              {supported ? "Enable on this device" : "Not supported in this browser"}
            </Button>
          )}
        </div>
      </article>
    </section>
  );
}

export default function IntegrationHub({ onOpenSettings }: { onOpenSettings: () => void }) {
  const utils = trpc.useUtils();
  const { data: connections = [], isLoading } = trpc.integrations.list.useQuery();
  const [selected, setSelected] = useState<Provider | null>(null);
  const [note, setNote] = useState("");
  const prepare = trpc.integrations.prepare.useMutation({
    onSuccess: () => { void utils.integrations.list.invalidate(); setSelected(null); setNote(""); toast.success("Connection readiness recorded. Provider authorization is still required."); },
    onError: error => toast.error(error.message),
  });
  const disconnect = trpc.integrations.disconnect.useMutation({
    onSuccess: () => { void utils.integrations.list.invalidate(); toast.success("Local connection state removed."); },
    onError: error => toast.error(error.message),
  });
  const smsStatus = trpc.sms.status.useQuery();
  const [smsTestOpen, setSmsTestOpen] = useState(false);
  const [smsTestTo, setSmsTestTo] = useState("");
  const smsTest = trpc.sms.sendTest.useMutation({
    onSuccess: result => {
      setSmsTestOpen(false);
      setSmsTestTo("");
      toast.success(result.mode === "twilio"
        ? `Test SMS sent via Twilio (sid ${result.id}). Check the phone.`
        : "SMS is in console mode — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER to send live messages. The test message was logged to the server console.");
    },
    onError: error => toast.error(error.message),
  });

  const selectedConnection = useMemo(() => connections.find(connection => connection.provider === selected), [connections, selected]);
  const groups = useMemo(() => Object.entries(connections.reduce<Record<string, typeof connections>>((result, connection) => {
    (result[connection.category] ??= []).push(connection);
    return result;
  }, {})), [connections]);

  if (isLoading) return <div className="h-[480px] rounded-2xl bg-slate-100 animate-pulse" />;

  return <div className="space-y-6">
    <header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4922A]">Ecosystem</p><h1 className="mt-1 text-2xl font-bold text-[#1A1A1A]">Integration Hub</h1><p className="mt-1 max-w-2xl text-sm text-[rgba(26,26,26,0.62)]">A single, truthful view of the tools around your business. A provider is marked connected only after an authorized integration path confirms it.</p></header>

    <section className="rounded-2xl border border-[#D4922A]/25 bg-[#D4922A]/5 p-4"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#9A610A]" /><div><h2 className="text-sm font-bold text-[#1A1A1A]">Connection-state integrity</h2><p className="mt-1 text-xs leading-5 text-[rgba(26,26,26,0.65)]">This hub never accepts a manual “connected” claim. Google Calendar is derived from its secure authorization record. Other entries remain in readiness states until their provider flow is implemented and verified with the owner’s account.</p></div></div></section>

    <PushNotificationsCard />
    <StripeConnectCard />

    <div className="space-y-6">{groups.map(([category, group]) => {
      const meta = categoryMeta[category as Category];
      const Icon = meta.icon;
      return <section key={category}><div className="mb-3 flex items-center gap-2"><Icon className="h-4 w-4 text-[#D4922A]" /><h2 className="text-sm font-bold text-[#1A1A1A]">{meta.label}</h2></div><div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">{group.map(connection => <article key={connection.provider} className="flex flex-col rounded-2xl border border-[rgba(26,26,26,0.1)] bg-white p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-[#1A1A1A]">{connection.name}</h3><p className="mt-1 text-xs leading-5 text-[rgba(26,26,26,0.58)]">{connection.description}</p></div><StatusBadge status={connection.status} /></div>{connection.configurationNote && <p className="mt-3 rounded-lg bg-[#F7F6F3] px-3 py-2 text-xs text-[rgba(26,26,26,0.62)]">Readiness note: {connection.configurationNote}</p>}{connection.provider === "twilio" && <div className="mt-3 rounded-lg bg-[#F7F6F3] px-3 py-2"><p className="text-xs text-[rgba(26,26,26,0.62)]">{smsStatus.data?.configured ? `SMS delivery: live via Twilio (${smsStatus.data.from})` : "SMS delivery: console mode — booking SMS is logged to the server until Twilio env vars are set."}</p><Button size="sm" variant="outline" onClick={() => setSmsTestOpen(true)} disabled={smsTest.isPending} className="mt-2 w-full border-[#D4922A]/40 text-[#8A5A0B]" aria-label="Send a test SMS to verify Twilio">Send test SMS</Button></div>}<div className="mt-auto pt-4">{connection.isProviderAuthorized ? <div className="flex gap-2"><Button size="sm" variant="outline" onClick={onOpenSettings} className="flex-1 border-[#D4922A]/40 text-[#8A5A0B]"><ExternalLink className="mr-1 h-3.5 w-3.5" /> Manage</Button><Button size="sm" variant="outline" onClick={() => disconnect.mutate({ provider: connection.provider as Provider })} disabled={disconnect.isPending} className="border-rose-200 text-rose-700 hover:bg-rose-50" aria-label={`Disconnect ${connection.name}`}><XCircle className="h-3.5 w-3.5" /></Button></div> : connection.provider === "google_calendar" && connection.availability === "available_now" ? <Button size="sm" onClick={onOpenSettings} className="w-full bg-[#1C2333] text-white hover:bg-[#2B3446]"><ExternalLink className="mr-1 h-3.5 w-3.5" /> Authorize in Settings</Button> : <Button size="sm" variant="outline" onClick={() => { setSelected(connection.provider as Provider); setNote(connection.configurationNote ?? ""); }} className="w-full border-[#D4922A]/40 text-[#8A5A0B]">{connection.status === "needs_configuration" ? "Update readiness" : "Prepare connection"}</Button>}</div></article>)}</div></section>;
    })}</div>

    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) { setSelected(null); setNote(""); } }}><DialogContent className="max-w-lg bg-white"><DialogHeader><DialogTitle className="text-[#1A1A1A]">Prepare {selectedConnection?.name} connection</DialogTitle></DialogHeader><div className="space-y-3 py-2"><p className="text-sm text-[rgba(26,26,26,0.64)]">Record internal readiness for this provider. This does not submit credentials, authorize the provider, or claim a live connection.</p><label className="block text-sm font-semibold text-[#1A1A1A]">Readiness note <span className="font-normal text-[rgba(26,26,26,0.48)]">(optional)</span><textarea value={note} onChange={event => setNote(event.target.value)} maxLength={1000} rows={4} placeholder="Example: account owner is deciding which workspace to authorize" className="mt-1.5 block w-full resize-none rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#D4922A]/35" /></label></div><DialogFooter><Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button><Button onClick={() => selected && prepare.mutate({ provider: selected, configurationNote: note.trim() || undefined })} disabled={prepare.isPending} className="bg-[#D4922A] text-white hover:bg-[#B87716]">{prepare.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save readiness"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={smsTestOpen} onOpenChange={open => { if (!open) setSmsTestOpen(false); }}><DialogContent className="max-w-sm bg-white"><DialogHeader><DialogTitle className="text-[#1A1A1A]">Send a test SMS</DialogTitle></DialogHeader><div className="space-y-3 py-2"><p className="text-sm text-[rgba(26,26,26,0.64)]">Enter your own phone number to verify SMS delivery end to end. In console mode the message is logged server-side instead of being sent.</p><label htmlFor="sms-test-to" className="block text-sm font-semibold text-[#1A1A1A]">Your phone number<input id="sms-test-to" type="tel" value={smsTestTo} onChange={event => setSmsTestTo(event.target.value)} placeholder="+1 512 555 0100" className="mt-1.5 block w-full rounded-lg border border-[rgba(26,26,26,0.16)] bg-white px-3 py-2 text-sm font-normal text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#D4922A]/35" /></label></div><DialogFooter><Button variant="outline" onClick={() => setSmsTestOpen(false)}>Cancel</Button><Button onClick={() => smsTestTo.trim() && smsTest.mutate({ to: smsTestTo.trim() })} disabled={smsTest.isPending || smsTestTo.trim().length < 7} className="bg-[#D4922A] text-white hover:bg-[#B87716]">{smsTest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send test"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = { connected: "bg-emerald-50 text-emerald-700", needs_configuration: "bg-amber-50 text-amber-800", provider_setup_required: "bg-amber-50 text-amber-800", error: "bg-rose-50 text-rose-700", not_connected: "bg-slate-100 text-slate-600" };
  const text: Record<string, string> = { connected: "Connected", needs_configuration: "Needs setup", provider_setup_required: "Needs setup", error: "Needs attention", not_connected: "Not connected" };
  return <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${styles[status] ?? styles.not_connected}`}>{text[status] ?? "Not connected"}</span>;
}

function TerminalStatus() {
  const { data: terminal } = trpc.terminal.status.useQuery();
  if (!terminal) return null;
  if (!terminal.connected) return <p className="text-xs text-[rgba(26,26,26,0.62)]">Connect your Stripe account in the card above first. Tap to Pay unlocks after your connected account is approved for Stripe Terminal.</p>;
  return <p className="text-xs text-[rgba(26,26,26,0.62)]">{terminal.chargesEnabled ? "Your connected account accepts charges. Register your reader in your Stripe dashboard (Terminal → Readers), then use in-person checkout from this workspace." : "Charges are pending on your connected account. Tap to Pay unlocks once Stripe finishes your account review."} {terminal.inAppReaderCheckout}</p>;
}
