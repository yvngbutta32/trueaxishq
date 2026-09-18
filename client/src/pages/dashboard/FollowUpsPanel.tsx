import { TRUEAXIS_LOGO_URL } from "@shared/const";
import { DEFAULT_PUBLIC_BOOKING_SCHEDULE, getPublishedBookingServiceCatalog, PUBLIC_BOOKING_TIME_SLOTS, type PublicBookingService } from "@shared/publicBookingRules";
/* TrueAxis HQ — Full Dashboard (DB-backed)
 * All panels connected to real tRPC/database procedures
 * Design: "Kinetic Warmth" — Dark sidebar (#1C2333), Teal (#D4922A), Coral (#FF6B6B)
 */

import { useState, useEffect, useRef, useLayoutEffect, useCallback, memo, useMemo, useId, lazy, Suspense } from "react";
import { useFormFields } from "@/hooks/useFormFields";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { ActionCards } from "@/components/ActionCards";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AIAssistant from "@/components/AIAssistant";
import { HealthMonitor } from "@/components/HealthMonitor";
import { PanelErrorBoundary } from "@/components/PanelErrorBoundary";
import GlobalSearch from "@/components/GlobalSearch";
import { PanelTabs } from "@/components/PanelTabs";
import {
  LayoutDashboard, Users, Calendar, FileText, Mail,
  BarChart3, Settings, Zap, Plus, TrendingUp,
  DollarSign, Clock, CheckCircle, ArrowUpRight,
  ChevronRight, LogOut, X, Edit2, Trash2, Send,
  Download, Phone, AlertCircle, RefreshCw, User,
  Building, Save, Bot, CreditCard,
  ExternalLink, Bell, Search, ChevronDown, Loader2, Link,
  Globe, ToggleLeft, ToggleRight, Printer, Eye, EyeOff,
  Copy, Check, Star, Activity, HeartPulse, MoreHorizontal, Camera, FileSignature, Sparkles, Upload,
  Home, Crown, ArrowRight, Shield, Inbox, MessageSquare, Tag, ThumbsUp, CalendarX, Link2, Wifi, WifiOff,
  Package, Receipt, Smartphone, Rocket, UsersRound, MapPin, PlugZap, Webhook
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
  PieChart, Pie, Cell
} from "recharts";

import { type ActivePanel, type ConfirmState, type LineItem, Field, FREQUENCY_LABELS, FREQUENCY_COLORS, defaultConfirm, LEGACY_PANEL_REDIRECTS, getGreeting, formatCurrency, formatDate, formatBookingDate, formatBookingTime, Skeleton, Modal, useFormField, LineItemRow } from "./shared";

// ─── Follow-Ups Panel ─────────────────────────────────────────────────────────
function FollowUpsPanel() {
  const utils = trpc.useUtils();
  const [fuTab, setFuTab] = useState<"emails" | "sequences">("emails");
  const [showGenerate, setShowGenerate] = useState(false);
  const [previewFollowUp, setPreviewFollowUp] = useState<any>(null);
  const [form, setForm] = useState({ clientName: "", clientEmail: "", service: "", context: "", tone: "professional" as "professional" | "friendly" | "motivational" });
  const setFollowFormField = useFormFields(setForm);
  const setFollowClientName  = setFollowFormField("clientName");
  const setFollowClientEmail = setFollowFormField("clientEmail");
  const setFollowService     = setFollowFormField("service");
  const setFollowContext     = setFollowFormField("context");
  const [fuConfirm, setFuConfirm] = useState<ConfirmState>(defaultConfirm);
  // Sequences
  const [showAddRule, setShowAddRule] = useState(false);
  const [ruleForm, setRuleForm] = useState({ triggerDays: 30, tone: "friendly" as "professional" | "friendly" | "motivational", context: "" });
  const setRuleFormField = useFormFields(setRuleForm);
  const setRuleContext = setRuleFormField("context");
  const { data: rules = [], isLoading: rulesLoading } = trpc.followUpRules.list.useQuery(undefined, { retry: 1 });
  const addRule = trpc.followUpRules.create.useMutation({ onSuccess: () => { utils.followUpRules.list.invalidate(); setShowAddRule(false); toast.success("Sequence rule created!"); } });
  const deleteRule = trpc.followUpRules.delete.useMutation({ onSuccess: () => { utils.followUpRules.list.invalidate(); toast.success("Rule deleted."); } });
  const toggleRule = trpc.followUpRules.update.useMutation({ onSuccess: () => utils.followUpRules.list.invalidate() });

  const { data: followUpList, isLoading } = trpc.followUps.list.useQuery(undefined, { retry: 1 });
  const { data: clientList } = trpc.clients.list.useQuery({ search: "", status: "all" });

  const generate = trpc.followUps.generate.useMutation({
    onSuccess: (data) => {
      utils.followUps.list.invalidate();
      setPreviewFollowUp(data);
      setShowGenerate(false);
      toast.success("AI follow-up email generated!");
    },
    onError: (e) => toast.error(e.message),
  });
  const markSent = trpc.followUps.markSent.useMutation({
    onSuccess: () => { utils.followUps.list.invalidate(); toast.success("Follow-up marked as sent."); },
    onError: (e) => toast.error(e.message),
  });
  const deleteFollowUp = trpc.followUps.delete.useMutation({
    onSuccess: () => { utils.followUps.list.invalidate(); toast.success("Follow-up deleted."); },
    onError: (e) => toast.error(e.message),
  });
  const sendEmailMut = trpc.followUps.sendEmail.useMutation({
    onSuccess: (data) => { utils.followUps.list.invalidate(); setPreviewFollowUp(null); data.emailSent ? toast.success("Follow-up email was accepted by configured SMTP.") : toast.info("Follow-up retained as a draft; no configured SMTP acceptance was recorded."); },
    onError: (e) => toast.error(e.message),
  });

  const [copied, setCopied] = useState(false);
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#1A1A1A]">AI Follow-Ups</h2>
          <p className="text-sm text-[#6B6B6B]">Let AI write personalized follow-up emails for your clients</p>
        </div>
        {fuTab === "emails" ? (
          <Button size="sm" className="gradient-amber text-white border-0 hover:opacity-90 gap-1.5" onClick={() => setShowGenerate(true)}>
            <Zap className="w-3.5 h-3.5" />Generate Email
          </Button>
        ) : (
          <Button size="sm" className="gradient-amber text-white border-0 hover:opacity-90 gap-1.5" onClick={() => setShowAddRule(true)}>
            <Plus className="w-3.5 h-3.5" />New Rule
          </Button>
        )}
      </div>
      {/* Tab Bar */}
      <div className="flex gap-1 bg-[#EEECEA] rounded-xl p-1">
        {(["emails", "sequences"] as const).map(t => (
          <button key={t} onClick={() => setFuTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
              fuTab === t ? "bg-[#D4922A]/20 text-[#D4922A] shadow-sm" : "text-[#3D3D3D] hover:text-[#2A2A2A]"
            }`}>
            {t === "sequences" ? "Auto-Sequences" : "AI Emails"}
          </button>
        ))}
      </div>

      {fuTab === "sequences" && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-[#6366F1]/10 to-[#D4922A]/10 border border-[#6366F1]/20 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#6366F1] flex items-center justify-center text-white flex-shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[#1A1A1A] text-sm">Automated Follow-Up Rules</h3>
                <p className="text-xs text-[#6B6B6B] mt-1 leading-relaxed">
                  Set a rule once and the system automatically generates and queues a follow-up email when a client hasn't booked in X days. Rules run daily — passive revenue recovery while you sleep.
                </p>
              </div>
            </div>
          </div>
          {rulesLoading ? (
            [...Array(2)].map((_, i) => <Skeleton key={i} className="h-16" />)
          ) : rules.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#DDDBD7] text-center py-12 text-[#6B6B6B]">
              <Zap className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No automation rules yet</p>
              <p className="text-xs mt-1">Create your first rule to start automating follow-ups.</p>
            </div>
          ) : (rules as Array<{ id: number; name: string; triggerDays: number; emailSubject: string; active: boolean }>).map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-[#DDDBD7] p-4 flex items-center gap-3">
              <div className={`w-2 h-10 rounded-full flex-shrink-0 ${r.active ? "bg-green-400" : "bg-gray-200"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#1A1A1A]">{r.name}</p>
                <p className="text-xs text-[#6B6B6B] mt-0.5">Triggers after <span className="font-semibold text-[#D4922A]">{r.triggerDays} days</span> of no booking · {r.emailSubject}</p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => toggleRule.mutate({ id: r.id, active: !r.active })} className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${r.active ? "bg-green-500/15 text-green-400 hover:bg-green-500/25" : "bg-[#EEECEA] text-[#3D3D3D] hover:bg-white/12"}`}>
                  {r.active ? "Active" : "Paused"}
                </button>
                <button onClick={() => deleteRule.mutate({ id: r.id })} className="p-2 rounded-lg hover:bg-red-500/100/10 text-[#3D3D3D] hover:text-red-500 transition-colors" aria-label="Delete rule">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {/* Add Rule Modal */}
          <Modal open={showAddRule} onClose={() => setShowAddRule(false)} title="New Automation Rule">
            <div className="space-y-4">
              <Field label="Rule Name *" value={ruleForm.context} onChange={setRuleContext} placeholder="e.g. 30-Day Re-engagement" required />
              <div>
                <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Trigger: No booking in</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={1} max={365} value={ruleForm.triggerDays} onChange={e => setRuleForm(p => ({ ...p, triggerDays: parseInt(e.target.value) || 30 }))}
                    className="form-input-light w-24 text-center" />
                  <span className="text-sm text-[#6B6B6B]">days</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Email Tone</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["professional", "friendly", "motivational"] as const).map(t => (
                    <button key={t} onClick={() => setRuleForm(p => ({ ...p, tone: t }))}
                      className={`py-2 px-3 text-xs font-semibold rounded-xl border-2 transition-all capitalize ${ruleForm.tone === t ? "border-[#D4922A] bg-[#D4922A]/10 text-[#D4922A]" : "border-[#DDDBD7] text-[#6B6B6B] hover:border-[#C8C5BF]"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowAddRule(false)}>Cancel</Button>
                <Button className="flex-1 gradient-amber text-white border-0 hover:opacity-90" onClick={() => addRule.mutate({ name: ruleForm.context || `${ruleForm.triggerDays}-Day Rule`, triggerDays: ruleForm.triggerDays, emailSubject: `Checking in — let's reconnect`, emailBody: `Hi {{clientName}}, I noticed it's been a while since we last connected. I'd love to catch up and see how things are going. Would you like to schedule a session?` })} disabled={addRule.isPending}>
                  {addRule.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Rule"}
                </Button>
              </div>
            </div>
          </Modal>
        </div>
      )}
      {fuTab === "emails" && <>
      {/* Info Card */}
      <div className="bg-gradient-to-r from-[#D4922A]/10 to-[#6366F1]/10 border border-[#D4922A]/20 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl gradient-amber flex items-center justify-center text-white flex-shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-[#1A1A1A] text-sm">How AI Follow-Ups Work</h3>
            <p className="text-xs text-[#6B6B6B] mt-1 leading-relaxed">
              Select a client, choose a tone, and our AI writes a personalized follow-up email in seconds. The email checks in on their progress, encourages rebooking, and sounds like it came directly from you. Copy the email and send it from your preferred email client.
            </p>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)
        ) : !followUpList || followUpList.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#DDDBD7] text-center py-16 text-[#6B6B6B]">
            <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium text-[#6B6B6B]">No follow-ups generated yet</p>
            <p className="text-xs mt-1">Generate your first AI follow-up email above.</p>
          </div>
        ) : followUpList.map(f => (
          <div key={f.id} className="bg-white rounded-xl border border-[#DDDBD7] p-4 hover:border-[#D4922A]/30 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-[#1A1A1A]">{f.clientName}</p>
                  <Badge className={`text-xs border-0 ${f.status === "sent" ? "bg-green-500/10 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>
                    {f.status}
                  </Badge>
                </div>
                <p className="text-xs text-[#6B6B6B] mt-0.5 font-medium">{f.subject}</p>
                <p className="text-xs text-[#6B6B6B] mt-1 line-clamp-2">{f.body}</p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => copyToClipboard(f.body)} className="p-2 rounded-lg hover:bg-[#D4922A]/10 text-[#6B6B6B] hover:text-[#D4922A] transition-colors" aria-label="Copy email body to clipboard" title="Copy email body">
                  <Copy className="w-4 h-4" />
                </button>
                <button onClick={() => setPreviewFollowUp(f)} className="p-2 rounded-lg hover:bg-[#EEECEA] text-[#6B6B6B] hover:text-[#6B6B6B] transition-colors" aria-label="Preview email">
                  <Eye className="w-4 h-4" />
                </button>
                {f.status === "draft" && (
                  <button onClick={() => markSent.mutate({ id: f.id })} className="p-2 rounded-lg hover:bg-green-500/10 text-[#6B6B6B] hover:text-green-600 transition-colors" aria-label="Mark as sent">
                    <Send className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => setFuConfirm({ open: true, title: "Delete Follow-Up?", description: "Delete this follow-up email? This cannot be undone.", onConfirm: () => deleteFollowUp.mutate({ id: f.id }) })} className="p-2 rounded-lg hover:bg-red-500/100/10 text-[#3D3D3D] hover:text-red-500 transition-colors" aria-label="Delete follow-up">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Generate Modal */}
      <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate AI Follow-Up Email">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Select Client</label>
            <select onChange={e => { const pid = parseInt(e.target.value, 10); const c = !isNaN(pid) ? clientList?.find(c => c.id === pid) : undefined; if (c) setForm(p => ({ ...p, clientName: c.name, clientEmail: c.email || "", service: c.service || "" })); }} className="form-input-light">
              <option value="">— Or enter manually below —</option>
              {clientList?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Field label="Client Name *" value={form.clientName} onChange={setFollowClientName} placeholder="Jane Smith" required autoComplete="name" enterKeyHint="next" />
          <Field label="Client Email" value={form.clientEmail} onChange={setFollowClientEmail} placeholder="jane@example.com" type="email" autoComplete="email" enterKeyHint="next" />
          <Field label="Service / Context" value={form.service} onChange={setFollowService} placeholder="Business coaching, web design..." autoComplete="off" enterKeyHint="next" />
          <Field label="Additional Context (optional)" value={form.context} onChange={setFollowContext} placeholder="Last session was about goal-setting, they struggled with time management..." textarea enterKeyHint="done" />
          <div>
            <label className="block text-xs font-semibold text-[#6B6B6B] mb-1.5">Email Tone</label>
            <div className="grid grid-cols-3 gap-2">
              {(["professional", "friendly", "motivational"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setForm(p => ({ ...p, tone: t }))}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border-2 transition-all capitalize ${form.tone === t ? "border-[#D4922A] bg-[#D4922A]/10 text-[#D4922A]" : "border-[#DDDBD7] text-[#6B6B6B] hover:border-[#C8C5BF]"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowGenerate(false)}>Cancel</Button>
            <Button className="flex-1 gradient-amber text-white border-0 hover:opacity-90 gap-2" onClick={() => generate.mutate(form)} disabled={generate.isPending}>
              {generate.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</> : <><Zap className="w-4 h-4" />Generate</>}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Email Preview Modal */}
      <Modal open={!!previewFollowUp} onClose={() => setPreviewFollowUp(null)} title="Email Preview" wide>
        {previewFollowUp && (
          <div className="font-sans">
            {/* Email client header */}
            <div className="bg-[#F7F6F3] border border-[#DDDBD7] rounded-xl mb-4 overflow-hidden">
              <div className="px-4 py-2 border-b border-[#DDDBD7] flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#3D3D3D] uppercase tracking-wide w-14">From</span>
                <span className="text-sm text-[#2A2A2A]">TrueAxis HQ &lt;noreply@trueaxishq.com&gt;</span>
              </div>
              <div className="px-4 py-2 border-b border-[#DDDBD7] flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#3D3D3D] uppercase tracking-wide w-14">To</span>
                <span className="text-sm text-[#2A2A2A]">{previewFollowUp.clientEmail || previewFollowUp.clientName}</span>
              </div>
              <div className="px-4 py-2 flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#3D3D3D] uppercase tracking-wide w-14">Subject</span>
                <span className="text-sm font-semibold text-[#1A1A1A]">{previewFollowUp.subject}</span>
              </div>
            </div>

            {/* Email body — rendered as it will appear */}
            <div className="bg-white rounded-xl p-4 mb-4">
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {/* Top accent bar */}
                <div className="h-1 bg-[#D4922A]" />
                {/* Brand header */}
                <div className="px-5 py-4 border-b border-[#DDDBD7] flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[#D4922A] flex items-center justify-center">
                    <span className="text-white font-black text-xs">T</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#1A1A1A] leading-none">TrueAxis HQ</p>
                    <p className="text-[10px] text-[#3D3D3D] mt-0.5">AI-Powered Business OS for Freelancers</p>
                  </div>
                </div>
                {/* Body */}
                <div className="px-5 py-5">
                  <h2 className="text-base font-bold text-[#1A1A1A] mb-2">{previewFollowUp.subject}</h2>
                  <p className="text-sm text-[#3D3D3D] mb-3">Hi {previewFollowUp.clientName},</p>
                  {previewFollowUp.body.split("\n").filter((l: string) => l.trim()).map((line: string, i: number) => (
                    <p key={i} className="text-sm text-[#6B6B6B] leading-relaxed mb-2">{line}</p>
                  ))}
                </div>
                {/* Footer */}
                <div className="px-5 py-3 bg-[#F7F6F3] border-t border-[#DDDBD7]">
                  <p className="text-[10px] text-[#3D3D3D] text-center">&copy; {new Date().getFullYear()} TrueAxis HQ &mdash; <span className="text-[#D4922A]">Unsubscribe</span></p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button className="flex-1 bg-[#D4922A] hover:bg-[#D4911A] text-white gap-2" onClick={() => copyToClipboard(previewFollowUp.body)}>
                {copied ? <><Check className="w-4 h-4" />Copied!</> : <><Copy className="w-4 h-4" />Copy Body</>}
              </Button>
              {previewFollowUp.clientEmail && previewFollowUp.status === "draft" && previewFollowUp.id && (
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2" onClick={() => sendEmailMut.mutate({ id: previewFollowUp.id })} disabled={sendEmailMut.isPending}>
                  {sendEmailMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" />Send Email</>}
                </Button>
              )}
              {(!previewFollowUp.clientEmail || previewFollowUp.status !== "draft") && previewFollowUp.id && previewFollowUp.status === "draft" && (
                <Button variant="outline" className="flex-1 gap-2" onClick={() => { markSent.mutate({ id: previewFollowUp.id }); setPreviewFollowUp(null); }}>
                  <Send className="w-4 h-4" />Mark Sent
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
      </>
      }
      <ConfirmDialog
        open={fuConfirm.open}
        onOpenChange={(open) => !open && setFuConfirm(defaultConfirm)}
        title={fuConfirm.title}
        description={fuConfirm.description}
        onConfirm={() => { fuConfirm.onConfirm(); setFuConfirm(defaultConfirm); }}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  );
}


export { FollowUpsPanel };
