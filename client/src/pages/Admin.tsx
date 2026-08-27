import { TRUEAXIS_LOGO_URL } from "@shared/const";
import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Users, DollarSign, TrendingUp, Crown, Shield, Search,
  Bell, BarChart3, ChevronRight, AlertCircle, RefreshCw,
  Megaphone, CheckCircle, XCircle, Clock, Mail, Download,
  Settings, Activity, Trash2, Edit2, Save, X, ToggleLeft,
  ToggleRight, Globe, Phone, Twitter, Linkedin, Instagram,
  Youtube, Zap, Database, Server, Lock, Unlock, Eye, Key, Plus, Copy, Check, KeyRound, EyeOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <article className="bg-[#161B22] rounded-xl p-6 border border-white/8 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <p className="text-3xl font-extrabold text-[#F5EFE3]">{value}</p>
      <p className="text-sm font-semibold text-[rgba(245,239,227,0.70)] mt-1">{label}</p>
      {sub && <p className="text-xs text-[rgba(245,239,227,0.60)] mt-0.5">{sub}</p>}
    </article>
  );
}

// ─── Plan Badge ───────────────────────────────────────────────────────────────
function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    agency: "bg-purple-500/15 text-purple-400",
    pro: "bg-amber-900/30 text-amber-400",
    starter: "bg-blue-500/15 text-blue-400",
    free: "bg-[#243040] text-[rgba(245,239,227,0.60)]",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${colors[plan] ?? colors.free}`}>
      {plan}
    </span>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <span className="status-active">Active</span>;
  if (status === "past_due") return <span className="status-pending">Past Due</span>;
  if (status === "cancelled") return <span className="status-inactive">Cancelled</span>;
  return <span className="status-inactive">Free</span>;
}

// ─── Health Dot ───────────────────────────────────────────────────────────────
function HealthDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />
  );
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────
function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4922A] ${value ? "bg-[#D4922A]" : "bg-white/15"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-[#161B22] shadow transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────
type AdminTab = "overview" | "users" | "leads" | "broadcast" | "settings" | "health" | "security" | "invites" | "stripe_recovery";

export default function Admin() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  useEffect(() => { document.title = "Admin — TrueAxis HQ"; }, []);
  const [page, setPage] = useState(1);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastContent, setBroadcastContent] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [leadsPage, setLeadsPage] = useState(1);

  // User management state
  const [editingPlanUserId, setEditingPlanUserId] = useState<number | null>(null);
  const [editPlanId, setEditPlanId] = useState<string>("free");
  const [editSubStatus, setEditSubStatus] = useState<string>("free");

  // Settings state
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [settingsForm, setSettingsForm] = useState<Record<string, any>>({});

  // Queries
  const isOwner = (user as any)?.isOwner === true;
  const statsQuery = trpc.admin.revenueStats.useQuery(undefined, { enabled: isAuthenticated && isOwner });
  // Security queries & mutations
  const [blockIPInput, setBlockIPInput] = useState("");
  const [blockIPReason, setBlockIPReason] = useState("");
  const [unlockEmailInput, setUnlockEmailInput] = useState("");
  const [securityFilter, setSecurityFilter] = useState<"all" | "low" | "medium" | "high" | "critical">("all");
  const [showResolvedEvents, setShowResolvedEvents] = useState(false);

  // Change password state
  const [cpCurrent, setCpCurrent] = useState("");
  const [cpNew, setCpNew] = useState("");
  const [cpConfirm, setCpConfirm] = useState("");
  const [cpShowCurrent, setCpShowCurrent] = useState(false);
  const [cpShowNew, setCpShowNew] = useState(false);

  const securityEventsQuery = trpc.security.events.useQuery(
    { limit: 100, severity: securityFilter, resolved: showResolvedEvents ? undefined : false },
    { enabled: activeTab === "security", refetchInterval: 30_000 }
  );
  const securityStatsQuery = trpc.security.stats.useQuery(
    undefined,
    { enabled: activeTab === "security", refetchInterval: 15_000 }
  );
  const watchdogQuery = trpc.security.watchdog.useQuery(
    undefined,
    { enabled: activeTab === "security", refetchInterval: 60_000 }
  );
  const blockIPMutation = trpc.security.blockIP.useMutation({
    onSuccess: () => { toast.success("IP blocked successfully"); setBlockIPInput(""); setBlockIPReason(""); securityStatsQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const unblockIPMutation = trpc.security.unblockIP.useMutation({
    onSuccess: () => { toast.success("IP unblocked"); securityStatsQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const unlockAccountMutation = trpc.security.unlockAccount.useMutation({
    onSuccess: () => { toast.success("Account unlocked"); setUnlockEmailInput(""); securityStatsQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const resolveEventMutation = trpc.security.resolveEvent.useMutation({
    onSuccess: () => { securityEventsQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const resolveAllMutation = trpc.security.resolveAll.useMutation({
    onSuccess: () => { toast.success("All events resolved"); securityEventsQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const usersQuery = trpc.admin.listUsers.useQuery(
    { search: search || undefined, page, limit: 20 },
    { enabled: isAuthenticated && isOwner }
  );
  const leadsQuery = trpc.admin.listLeads.useQuery(
    { page: leadsPage, limit: 50 },
    { enabled: isAuthenticated && isOwner && activeTab === "leads" }
  );
  const [newInviteNote, setNewInviteNote] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const invitesQuery = trpc.admin.listInvites.useQuery(undefined, {
    enabled: isAuthenticated && isOwner && activeTab === "invites",
  });
  const createInviteMutation = trpc.admin.createInvite.useMutation({
    onSuccess: () => { invitesQuery.refetch(); toast.success("Invite code created!"); setNewInviteNote(""); },
    onError: (e) => toast.error(e.message),
  });
  const revokeInviteMutation = trpc.admin.revokeInvite.useMutation({
    onSuccess: () => { invitesQuery.refetch(); toast.success("Invite code revoked."); },
    onError: (e) => toast.error(e.message),
  });
  const settingsQuery = trpc.admin.getSettings.useQuery(undefined, {
    enabled: isAuthenticated && isOwner && activeTab === "settings",
  });
  useEffect(() => {
    if (settingsQuery.data && !settingsDirty) setSettingsForm(settingsQuery.data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsQuery.data]);
  const healthQuery = trpc.admin.getSystemHealth.useQuery(undefined, {
    enabled: isAuthenticated && isOwner && activeTab === "health",
    refetchInterval: 30_000,
  });
  const stripeRecoveryQuery = trpc.stripeRecovery.list.useQuery(undefined, {
    enabled: isAuthenticated && isOwner && activeTab === "stripe_recovery",
  });

  // Mutations
  const setRoleMutation = trpc.admin.setUserRole.useMutation({
    onSuccess: () => { usersQuery.refetch(); toast.success("Role updated"); },
    onError: (e) => toast.error(e.message),
  });
  const updatePlanMutation = trpc.admin.updateUserPlan.useMutation({
    onSuccess: () => {
      usersQuery.refetch();
      setEditingPlanUserId(null);
      toast.success("Plan updated successfully");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteUserMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: (data) => {
      usersQuery.refetch();
      toast.success(`User "${data.deletedName ?? "Unknown"}" and all their data deleted`);
    },
    onError: (e) => toast.error(e.message),
  });
  const broadcastMutation = trpc.admin.broadcast.useMutation({
    onSuccess: () => { toast.success("Broadcast sent!"); setBroadcastTitle(""); setBroadcastContent(""); },
    onError: (e) => toast.error(e.message),
  });
  const updateSettingsMutation = trpc.admin.updateSettings.useMutation({
    onSuccess: () => {
      settingsQuery.refetch();
      setSettingsDirty(false);
      toast.success("Settings saved successfully");
    },
    onError: (e) => toast.error(e.message),
  });
  const processDueStripeEventsMutation = trpc.stripeRecovery.processDue.useMutation({
    onSuccess: (summary) => {
      stripeRecoveryQuery.refetch();
      toast.success(`Recovery check completed: ${summary.processed} processed, ${summary.retryable} retryable, ${summary.terminal} terminal.`);
    },
    onError: (e) => toast.error(e.message),
  });

  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password changed successfully. You will be logged out.");
      setCpCurrent(""); setCpNew(""); setCpConfirm("");
      setTimeout(() => { window.location.href = "/admin-login"; }, 1500);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleChangePassword = () => {
    if (!cpCurrent || !cpNew || !cpConfirm) return toast.error("All password fields are required.");
    if (cpNew.length < 8) return toast.error("New password must be at least 8 characters.");
    if (cpNew !== cpConfirm) return toast.error("New passwords do not match.");
    changePasswordMutation.mutate({ currentPassword: cpCurrent, newPassword: cpNew });
  };

  const updateField = (key: string, value: unknown) => {
    setSettingsForm((prev) => ({ ...prev, [key]: value }));
    setSettingsDirty(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1C2333]">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-[#D4922A] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-[rgba(245,239,227,0.60)] text-sm">Loading admin panel…</p>
        </div>
      </div>
    );
  }

  // Redirect to admin login if not authenticated or not owner
  // Must be in useEffect — calling navigate() during render is a React anti-pattern
  useEffect(() => {
    if (!loading && (!isAuthenticated || !isOwner)) {
      navigate("/admin-login");
    }
  }, [loading, isAuthenticated, isOwner, navigate]);

  if (!loading && (!isAuthenticated || !isOwner)) return null;

  const stats = statsQuery.data;
  const health = healthQuery.data;

  const tabs: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "users", label: "Users", icon: Users },
    { id: "leads", label: "Leads", icon: Mail },
    { id: "invites", label: "Invite Codes", icon: Key },
    { id: "broadcast", label: "Broadcast", icon: Megaphone },
    { id: "settings", label: "Site Settings", icon: Settings },
    { id: "health", label: "System Health", icon: Activity },
    { id: "stripe_recovery", label: "Stripe Recovery", icon: RefreshCw },
    { id: "security", label: "Security", icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-[#1C2333] overflow-x-hidden">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Header */}
      <header className="bg-[#0D1117] text-white px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={TRUEAXIS_LOGO_URL}
            alt="TrueAxis HQ"
            className="h-8 w-auto object-contain"
          />
          <div className="hidden sm:block w-px h-6 bg-[#161B22]/10" />
          <div className="hidden sm:flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5 text-[#D4922A]" />
            <span className="text-sm font-semibold text-[rgba(245,239,227,0.70)]">Admin Panel</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-[rgba(245,239,227,0.65)] hover:text-white hover:bg-white/8 text-xs sm:text-sm" onClick={() => navigate("/dashboard")}>
            <span className="hidden sm:inline">← Dashboard</span>
            <span className="sm:hidden">← Back</span>
          </Button>
          <div className="w-8 h-8 rounded-full bg-[#D4922A]/20 flex items-center justify-center text-[#D4922A] text-sm font-bold">
            {user?.name?.[0]?.toUpperCase() ?? "A"}
          </div>
        </div>
      </header>

      {/* Tab Nav */}
      <nav aria-label="Admin sections" className="bg-[#161B22] border-b border-white/8 overflow-x-auto">
        <div className="flex max-w-7xl mx-auto px-2 sm:px-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`flex items-center gap-2 px-3 sm:px-4 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-h-[48px] ${
                activeTab === tab.id
                  ? "border-[#D4922A] text-[#D4922A]"
                  : "border-transparent text-[rgba(245,239,227,0.60)] hover:text-[rgba(245,239,227,0.70)] hover:border-white/10"
              }`}
            >
              <tab.icon className="w-4 h-4 flex-shrink-0" />
              <span className="hidden xs:inline sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-10 page-bottom">

        {/* ── Overview Tab ──────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <section aria-label="Revenue overview">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[#F5EFE3]">Revenue Overview</h2>
              <Button variant="outline" size="sm" onClick={() => statsQuery.refetch()} disabled={statsQuery.isFetching}>
                <RefreshCw className={`w-4 h-4 mr-2 ${statsQuery.isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {statsQuery.isLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <StatCard icon={Users} label="Total Users" value={stats?.totalUsers ?? 0} color="bg-blue-500" />
                <StatCard icon={Crown} label="Paid Subscribers" value={stats?.paidUsers ?? 0} sub={`${stats?.totalUsers ? Math.round((stats.paidUsers / stats.totalUsers) * 100) : 0}% conversion`} color="bg-[#D4922A]" />
                <StatCard icon={Mail} label="Email Leads" value={stats?.totalLeads ?? 0} sub="Landing page captures" color="bg-green-500" />
                <StatCard icon={DollarSign} label="MRR" value={`$${(stats?.mrr ?? 0).toLocaleString()}`} sub="Monthly recurring revenue" color="bg-purple-500" />
                <StatCard icon={TrendingUp} label="ARR" value={`$${(stats?.arr ?? 0).toLocaleString()}`} sub="Annual run rate" color="bg-orange-500" />
              </div>
            )}

            <div className="bg-[#161B22] rounded-xl p-6 border border-white/8 shadow-sm">
              <h3 className="text-base font-bold text-[#F5EFE3] mb-5">Plan Distribution</h3>
              <div className="space-y-4">
                {[
                  { id: "agency", label: "Agency ($199/mo)", color: "bg-purple-500" },
                  { id: "pro", label: "Pro ($99/mo)", color: "bg-[#D4922A]" },
                  { id: "starter", label: "Starter ($49/mo)", color: "bg-blue-500" },
                  { id: "free", label: "Free", color: "bg-gray-300" },
                ].map(plan => {
                  const count = (stats?.byPlan as Record<string, number> | undefined)?.[plan.id] ?? 0;
                  const total = stats?.totalUsers ?? 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={plan.id} className="flex items-center gap-3">
                      <span className="text-sm text-[rgba(245,239,227,0.60)] w-36 flex-shrink-0">{plan.label}</span>
                      <div className="flex-1 bg-[#243040] rounded-full h-2.5">
                        <div className={`h-2.5 rounded-full ${plan.color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-sm font-semibold text-[rgba(245,239,227,0.70)] w-16 text-right">{count} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── Users Tab ─────────────────────────────────────────────────── */}
        {activeTab === "users" && (
          <section aria-label="User management">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[#F5EFE3]">User Management</h2>
              <p className="text-sm text-[rgba(245,239,227,0.60)]">{usersQuery.data?.total ?? 0} total users</p>
            </div>

            <div className="relative mb-5">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgba(245,239,227,0.60)]" />
              <input
                type="search"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by name or email…"
                className="form-input-light pl-10"
              />
            </div>

            <div className="bg-[#161B22] rounded-xl border border-white/8 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8 bg-[#1C2333]">
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-[rgba(245,239,227,0.60)] uppercase tracking-wider">User</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-[rgba(245,239,227,0.60)] uppercase tracking-wider">Plan</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-[rgba(245,239,227,0.60)] uppercase tracking-wider">Status</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-[rgba(245,239,227,0.60)] uppercase tracking-wider">Joined</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-[rgba(245,239,227,0.60)] uppercase tracking-wider">Role</th>
                      <th className="text-right px-5 py-3.5 text-xs font-semibold text-[rgba(245,239,227,0.60)] uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersQuery.isLoading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          {[...Array(6)].map((_, j) => (
                            <td key={j} className="px-5 py-4"><div className="skeleton h-4 rounded w-3/4" /></td>
                          ))}
                        </tr>
                      ))
                    ) : usersQuery.data?.users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-[rgba(245,239,227,0.60)]">
                          <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          <p>No users found</p>
                        </td>
                      </tr>
                    ) : (
                      usersQuery.data?.users.map(u => (
                        <tr key={u.id} className="border-b border-white/5 hover:bg-[#1C2333] transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#D4922A]/15 flex items-center justify-center text-[#007A65] text-xs font-bold flex-shrink-0">
                                {u.name?.[0]?.toUpperCase() ?? "?"}
                              </div>
                              <div>
                                <p className="font-semibold text-[#F5EFE3]">{u.name ?? "Unknown"}</p>
                                <p className="text-xs text-[rgba(245,239,227,0.60)]">{u.email ?? "No email"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            {editingPlanUserId === u.id ? (
                              <div className="flex items-center gap-2">
                                <select
                                  value={editPlanId}
                                  onChange={e => setEditPlanId(e.target.value)}
                                  className="text-xs border border-white/10 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#D4922A]"
                                >
                                  <option value="free">Free</option>
                                  <option value="starter">Starter</option>
                                  <option value="pro">Pro</option>
                                  <option value="agency">Agency</option>
                                </select>
                                <select
                                  value={editSubStatus}
                                  onChange={e => setEditSubStatus(e.target.value)}
                                  className="text-xs border border-white/10 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#D4922A]"
                                >
                                  <option value="free">Free</option>
                                  <option value="active">Active</option>
                                  <option value="cancelled">Cancelled</option>
                                  <option value="past_due">Past Due</option>
                                </select>
                                <button
                                  onClick={() => updatePlanMutation.mutate({ userId: u.id, planId: editPlanId as any, subscriptionStatus: editSubStatus as any })}
                                  disabled={updatePlanMutation.isPending}
                                  className="p-1 text-emerald-600 hover:text-emerald-700"
                                  title="Save"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setEditingPlanUserId(null)} className="p-1 text-[rgba(245,239,227,0.60)] hover:text-[rgba(245,239,227,0.60)]" title="Cancel">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <PlanBadge plan={u.planId ?? "free"} />
                                <button
                                  onClick={() => {
                                    setEditingPlanUserId(u.id);
                                    setEditPlanId(u.planId ?? "free");
                                    setEditSubStatus(u.subscriptionStatus ?? "free");
                                  }}
                                  className="p-0.5 text-[rgba(245,239,227,0.50)] hover:text-[rgba(245,239,227,0.60)]"
                                  title="Override plan"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4"><StatusBadge status={u.subscriptionStatus ?? "free"} /></td>
                          <td className="px-5 py-4 text-[rgba(245,239,227,0.60)] text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${u.role === "admin" ? "text-purple-700" : "text-[rgba(245,239,227,0.60)]"}`}>
                              {u.role === "admin" ? <Shield className="w-3 h-3" /> : null}
                              {u.role}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {u.role !== "admin" ? (
                                <Button variant="outline" size="sm" onClick={() => { if (confirm(`Promote ${u.name ?? "this user"} to admin?`)) setRoleMutation.mutate({ userId: u.id, role: "admin" }); }} className="text-xs">
                                  Make Admin
                                </Button>
                              ) : (
                                <Button variant="outline" size="sm" onClick={() => { if (confirm(`Remove admin from ${u.name ?? "this user"}?`)) setRoleMutation.mutate({ userId: u.id, role: "user" }); }} className="text-xs text-red-600 hover:text-red-700">
                                  Remove Admin
                                </Button>
                              )}
                              {u.id !== user?.id && (
                                <button
                                  onClick={() => {
                                    if (confirm(`Permanently delete "${u.name ?? "this user"}" and ALL their data? This cannot be undone.`)) {
                                      deleteUserMutation.mutate({ userId: u.id });
                                    }
                                  }}
                                  disabled={deleteUserMutation.isPending}
                                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete user and all data"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {(usersQuery.data?.total ?? 0) > 20 && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-white/8">
                  <p className="text-sm text-[rgba(245,239,227,0.60)]">
                    Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, usersQuery.data?.total ?? 0)} of {usersQuery.data?.total} users
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * 20 >= (usersQuery.data?.total ?? 0)}>Next</Button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Leads Tab ─────────────────────────────────────────────────── */}
        {activeTab === "leads" && (
          <section aria-label="Leads management">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-[#F5EFE3]">Email Leads</h2>
                <p className="text-sm text-[rgba(245,239,227,0.60)] mt-0.5">{leadsQuery.data?.total ?? 0} leads captured from the landing page</p>
              </div>
              <Button
                variant="outline" size="sm"
                onClick={() => {
                  const leads = leadsQuery.data?.leads ?? [];
                  if (leads.length === 0) { toast.error("No leads to export."); return; }
                  const csv = ["Name,Email,Source,Date", ...leads.map(l => `"${l.name ?? ""}","${l.email}","${l.source ?? ""}","${new Date(l.createdAt).toLocaleDateString()}"`)].join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = "trueaxis-hq-leads.csv"; a.click(); URL.revokeObjectURL(url);
                  toast.success(`Exported ${leads.length} leads as CSV`);
                }}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            </div>
            <div className="bg-[#161B22] rounded-xl border border-white/8 overflow-hidden shadow-sm">
              <div className="hidden sm:grid grid-cols-4 gap-4 px-6 py-3 bg-[#1C2333] text-xs font-semibold text-[rgba(245,239,227,0.60)] uppercase tracking-wide">
                <span>Name</span><span>Email</span><span>Source</span><span>Date</span>
              </div>
              {leadsQuery.isLoading ? (
                <div className="p-6 text-center text-[rgba(245,239,227,0.60)]">
                  <div className="w-8 h-8 border-2 border-[#D4922A] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm">Loading leads…</p>
                </div>
              ) : !leadsQuery.data?.leads || leadsQuery.data.leads.length === 0 ? (
                <div className="py-16 text-center text-[rgba(245,239,227,0.60)]">
                  <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium text-[rgba(245,239,227,0.60)]">No leads captured yet</p>
                  <p className="text-xs mt-1">Email sign-ups from the landing page will appear here.</p>
                </div>
              ) : leadsQuery.data.leads.map((lead, i) => (
                <div key={lead.id} className={`grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4 px-6 py-4 ${i > 0 ? "border-t border-white/5" : ""} hover:bg-[#1C2333]`}>
                  <p className="text-sm font-medium text-[#F5EFE3]">{lead.name || <span className="text-[rgba(245,239,227,0.60)] italic">No name</span>}</p>
                  <p className="text-sm text-[rgba(245,239,227,0.60)] truncate">{lead.email}</p>
                  <span className="inline-flex items-center w-fit px-2 py-0.5 rounded-full text-xs font-medium bg-[#D4922A]/10 text-[#007A65]">{lead.source ?? "landing_page"}</span>
                  <p className="text-sm text-[rgba(245,239,227,0.60)]">{new Date(lead.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
            {(leadsQuery.data?.total ?? 0) > 50 && (
              <div className="flex items-center justify-between mt-4">
                <Button variant="outline" size="sm" onClick={() => setLeadsPage(p => Math.max(1, p - 1))} disabled={leadsPage === 1}>Previous</Button>
                <span className="text-sm text-[rgba(245,239,227,0.60)]">Page {leadsPage} of {Math.ceil((leadsQuery.data?.total ?? 0) / 50)}</span>
                <Button variant="outline" size="sm" onClick={() => setLeadsPage(p => p + 1)} disabled={leadsPage >= Math.ceil((leadsQuery.data?.total ?? 0) / 50)}>Next</Button>
              </div>
            )}
          </section>
        )}

        {/* ── Broadcast Tab ─────────────────────────────────────────────── */}
        {activeTab === "broadcast" && (
          <section aria-label="Broadcast notification">
            <h2 className="text-xl font-bold text-[#F5EFE3] mb-2">Send Broadcast</h2>
            <p className="text-sm text-[rgba(245,239,227,0.60)] mb-6">Send an owner notification — useful for tracking important events or reminders.</p>
            <div className="bg-[#161B22] rounded-xl p-6 border border-white/8 shadow-sm max-w-xl">
              <form onSubmit={e => { e.preventDefault(); if (!broadcastTitle.trim() || !broadcastContent.trim()) { toast.error("Please fill in both fields"); return; } broadcastMutation.mutate({ title: broadcastTitle, content: broadcastContent }); }} noValidate>
                <div className="mb-4">
                  <label htmlFor="broadcast-title" className="form-label">Title *</label>
                  <input id="broadcast-title" type="text" value={broadcastTitle} onChange={e => setBroadcastTitle(e.target.value)} placeholder="e.g. New feature launched" className="form-input-light" required maxLength={200} />
                </div>
                <div className="mb-6">
                  <label htmlFor="broadcast-content" className="form-label">Message *</label>
                  <textarea id="broadcast-content" value={broadcastContent} onChange={e => setBroadcastContent(e.target.value)} placeholder="Write your message here…" rows={5} className="form-input-light resize-none" required maxLength={2000} />
                  <p className="form-hint">{broadcastContent.length}/2000 characters</p>
                </div>
                <Button type="submit" className="gradient-amber text-white border-0 w-full gap-2" disabled={broadcastMutation.isPending}>
                  {broadcastMutation.isPending ? (
                    <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Sending…</>
                  ) : (
                    <><Bell className="w-4 h-4" />Send Notification</>
                  )}
                </Button>
              </form>
            </div>
          </section>
        )}

        {/* ── Site Settings Tab ─────────────────────────────────────────── */}
        {activeTab === "settings" && (
          <section aria-label="Site settings">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-[#F5EFE3]">Site Settings</h2>
                <p className="text-sm text-[rgba(245,239,227,0.60)] mt-0.5">Control every aspect of the platform from here</p>
              </div>
              {settingsDirty && (
                <Button
                  className="gradient-amber text-white border-0 gap-2"
                  onClick={() => updateSettingsMutation.mutate(settingsForm as any)}
                  disabled={updateSettingsMutation.isPending}
                >
                  {updateSettingsMutation.isPending ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving…</> : <><Save className="w-4 h-4" />Save All Changes</>}
                </Button>
              )}
            </div>

            {settingsQuery.isLoading ? (
              <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-32 rounded-xl" />)}</div>
            ) : (
              <div className="space-y-6">

                {/* Site Identity */}
                <div className="bg-[#161B22] rounded-xl p-6 border border-white/8 shadow-sm">
                  <h3 className="text-base font-bold text-[#F5EFE3] mb-5 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[#D4922A]" />
                    Site Identity
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Site Name</label>
                      <input type="text" value={settingsForm.siteName ?? ""} onChange={e => updateField("siteName", e.target.value)} className="form-input-light" placeholder="TrueAxis HQ" maxLength={255} />
                    </div>
                    <div>
                      <label className="form-label">Support Email</label>
                      <input type="email" value={settingsForm.supportEmail ?? ""} onChange={e => updateField("supportEmail", e.target.value)} className="form-input-light" placeholder="support@trueaxishq.com" maxLength={320} />
                    </div>
                    <div>
                      <label className="form-label">Support Phone</label>
                      <input type="tel" value={settingsForm.supportPhone ?? ""} onChange={e => updateField("supportPhone", e.target.value)} className="form-input-light" placeholder="+1 (555) 000-0000" maxLength={32} />
                    </div>
                    <div>
                      <label className="form-label">Free Trial Days</label>
                      <input type="number" value={settingsForm.freeTrialDays ?? 14} onChange={e => updateField("freeTrialDays", parseInt(e.target.value, 10) || 0)} className="form-input-light" min={0} max={365} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="form-label">Site Tagline</label>
                      <input type="text" value={settingsForm.siteTagline ?? ""} onChange={e => updateField("siteTagline", e.target.value)} className="form-input-light" placeholder="The AI-powered business platform for freelancers & coaches" maxLength={512} />
                    </div>
                  </div>
                </div>

                {/* Announcement Banner */}
                <div className="bg-[#161B22] rounded-xl p-6 border border-white/8 shadow-sm">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-base font-bold text-[#F5EFE3] flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-[#D4922A]" />
                      Announcement Banner
                    </h3>
                    <Toggle
                      value={settingsForm.announcementEnabled ?? false}
                      onChange={v => updateField("announcementEnabled", v)}
                      label="Toggle announcement banner"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="form-label">Banner Text</label>
                      <input type="text" value={settingsForm.announcementText ?? ""} onChange={e => updateField("announcementText", e.target.value)} className="form-input-light" placeholder="🎉 Limited early-bird pricing — 50% off for the first 3 months!" maxLength={512} />
                    </div>
                    <div>
                      <label className="form-label">Color</label>
                      <select value={settingsForm.announcementColor ?? "teal"} onChange={e => updateField("announcementColor", e.target.value)} className="form-input-light">
                        <option value="teal">Teal</option>
                        <option value="coral">Coral</option>
                        <option value="purple">Purple</option>
                        <option value="yellow">Yellow</option>
                        <option value="blue">Blue</option>
                      </select>
                    </div>
                  </div>
                  {settingsForm.announcementEnabled && settingsForm.announcementText && (
                    <div className={`mt-4 px-4 py-2.5 rounded-xl text-sm font-medium text-center ${
                      settingsForm.announcementColor === "coral" ? "bg-[#FF6B6B]/15 text-[#CC3333]" :
                      settingsForm.announcementColor === "purple" ? "bg-purple-500/15 text-purple-400" :
                      settingsForm.announcementColor === "yellow" ? "bg-yellow-500/15 text-yellow-400" :
                      settingsForm.announcementColor === "blue" ? "bg-blue-500/15 text-blue-400" :
                      "bg-[#D4922A]/15 text-[#007A65]"
                    }`}>
                      Preview: {settingsForm.announcementText}
                    </div>
                  )}
                </div>

                {/* Social Links */}
                <div className="bg-[#161B22] rounded-xl p-6 border border-white/8 shadow-sm">
                  <h3 className="text-base font-bold text-[#F5EFE3] mb-5 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[#D4922A]" />
                    Social Media Links
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { key: "socialTwitter", label: "Twitter / X", icon: Twitter, placeholder: "https://twitter.com/trueaxis-hq" },
                      { key: "socialLinkedin", label: "LinkedIn", icon: Linkedin, placeholder: "https://linkedin.com/company/trueaxis-hq" },
                      { key: "socialInstagram", label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/trueaxis-hq" },
                      { key: "socialYoutube", label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/@trueaxis-hq" },
                    ].map(({ key, label, icon: Icon, placeholder }) => (
                      <div key={key}>
                        <label className="form-label flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5" />
                          {label}
                        </label>
                        <input type="url" value={(settingsForm as any)[key] ?? ""} onChange={e => updateField(key, e.target.value)} className="form-input-light" placeholder={placeholder} maxLength={255} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Feature Flags */}
                <div className="bg-[#161B22] rounded-xl p-6 border border-white/8 shadow-sm">
                  <h3 className="text-base font-bold text-[#F5EFE3] mb-5 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#D4922A]" />
                    Feature Flags
                    <span className="text-xs font-normal text-[rgba(245,239,227,0.60)] ml-1">— enable or disable platform features globally</span>
                  </h3>
                  <div className="space-y-4">
                    {[
                      { key: "featureClientPulse", label: "Client Pulse AI", desc: "AI relationship intelligence engine with health scoring" },
                      { key: "featureBookingPage", label: "Public Booking Pages", desc: "Shareable /book/username pages for client self-booking" },
                      { key: "featureInvoicing", label: "Invoicing", desc: "Invoice creation, sending, and payment tracking" },
                      { key: "featureFollowUps", label: "AI Follow-Ups", desc: "AI-generated follow-up email drafts" },
                      { key: "featureAnalytics", label: "Analytics Dashboard", desc: "Revenue charts, booking stats, and growth metrics" },
                      { key: "featureAIAssistant", label: "AI Business Assistant", desc: "In-dashboard AI chat assistant" },
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                        <div>
                          <p className="text-sm font-semibold text-[#F5EFE3]">{label}</p>
                          <p className="text-xs text-[rgba(245,239,227,0.60)] mt-0.5">{desc}</p>
                        </div>
                        <Toggle
                          value={(settingsForm as any)[key] ?? true}
                          onChange={v => updateField(key, v)}
                          label={`Toggle ${label}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Maintenance Mode */}
                <div className={`bg-[#161B22] rounded-xl p-6 border shadow-sm ${settingsForm.maintenanceMode ? "border-red-200 bg-red-50/30" : "border-white/8"}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-[#F5EFE3] flex items-center gap-2">
                      <Lock className="w-4 h-4 text-red-500" />
                      Maintenance Mode
                      {settingsForm.maintenanceMode && <span className="text-xs font-semibold text-red-400 bg-red-500/15 px-2 py-0.5 rounded-full">ACTIVE</span>}
                    </h3>
                    <Toggle
                      value={settingsForm.maintenanceMode ?? false}
                      onChange={v => updateField("maintenanceMode", v)}
                      label="Toggle maintenance mode"
                    />
                  </div>
                  <p className="text-xs text-[rgba(245,239,227,0.60)] mb-4">When enabled, all non-admin users will see a maintenance page instead of the app.</p>
                  <div>
                    <label className="form-label">Maintenance Message</label>
                    <input type="text" value={settingsForm.maintenanceMessage ?? ""} onChange={e => updateField("maintenanceMessage", e.target.value)} className="form-input-light" placeholder="We're performing scheduled maintenance. Back in 30 minutes!" maxLength={512} />
                  </div>
                </div>

                {/* Change Admin Password */}
                <div className="bg-[#161B22] rounded-xl p-6 border border-white/8 shadow-sm">
                  <h3 className="text-base font-bold text-[#F5EFE3] mb-5 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-[#D4922A]" />
                    Change Admin Password
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="form-label">Current Password</label>
                      <div className="relative">
                        <input
                          type={cpShowCurrent ? "text" : "password"}
                          value={cpCurrent}
                          onChange={e => setCpCurrent(e.target.value)}
                          className="form-input-light pr-10"
                          placeholder="Current password"
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setCpShowCurrent(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(245,239,227,0.40)] hover:text-[rgba(245,239,227,0.60)]"
                          aria-label={cpShowCurrent ? "Hide password" : "Show password"}
                        >
                          {cpShowCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="form-label">New Password</label>
                      <div className="relative">
                        <input
                          type={cpShowNew ? "text" : "password"}
                          value={cpNew}
                          onChange={e => setCpNew(e.target.value)}
                          className="form-input-light pr-10"
                          placeholder="Min. 8 characters"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setCpShowNew(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(245,239,227,0.40)] hover:text-[rgba(245,239,227,0.60)]"
                          aria-label={cpShowNew ? "Hide password" : "Show password"}
                        >
                          {cpShowNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="form-label">Confirm New Password</label>
                      <div className="relative">
                        <input
                          type={cpShowNew ? "text" : "password"}
                          value={cpConfirm}
                          onChange={e => setCpConfirm(e.target.value)}
                          className="form-input-light"
                          placeholder="Repeat new password"
                          autoComplete="new-password"
                          onKeyDown={e => e.key === "Enter" && handleChangePassword()}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <Button
                      onClick={handleChangePassword}
                      disabled={changePasswordMutation.isPending || !cpCurrent || !cpNew || !cpConfirm}
                      className="gradient-amber text-white border-0 gap-2"
                    >
                      {changePasswordMutation.isPending
                        ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Updating…</>
                        : <><KeyRound className="w-4 h-4" />Update Password</>}
                    </Button>
                    <p className="text-xs text-[rgba(245,239,227,0.50)]">You will be redirected to log in again after changing your password.</p>
                  </div>
                </div>

                {/* Save button at bottom */}
                {settingsDirty && (
                  <div className="flex justify-end">
                    <Button
                      className="gradient-amber text-white border-0 gap-2 px-8"
                      onClick={() => updateSettingsMutation.mutate(settingsForm as any)}
                      disabled={updateSettingsMutation.isPending}
                    >
                      {updateSettingsMutation.isPending ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving…</> : <><Save className="w-4 h-4" />Save All Changes</>}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── System Health Tab ─────────────────────────────────────────── */}
        {activeTab === "health" && (
          <section aria-label="System health">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-[#F5EFE3]">System Health</h2>
                <p className="text-sm text-[rgba(245,239,227,0.60)] mt-0.5">Live platform diagnostics — auto-refreshes every 30 seconds</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => healthQuery.refetch()} disabled={healthQuery.isFetching}>
                <RefreshCw className={`w-4 h-4 mr-2 ${healthQuery.isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {healthQuery.isLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)}</div>
            ) : health ? (
              <div className="space-y-6">
                {/* Status indicators */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[#161B22] rounded-xl p-5 border border-white/8 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${health.dbStatus === "healthy" ? "bg-emerald-500/15" : "bg-red-500/15"}`}>
                        <Database className={`w-5 h-5 ${health.dbStatus === "healthy" ? "text-emerald-600" : "text-red-600"}`} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#F5EFE3]">Database</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <HealthDot ok={health.dbStatus === "healthy"} />
                          <span className={`text-xs font-semibold ${health.dbStatus === "healthy" ? "text-emerald-600" : "text-red-600"}`}>
                            {health.dbStatus === "healthy" ? "Healthy" : "Error"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#161B22] rounded-xl p-5 border border-white/8 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                        <Server className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#F5EFE3]">Server Uptime</p>
                        <p className="text-xs text-[rgba(245,239,227,0.60)] mt-0.5">
                          {health.uptimeSeconds < 3600
                            ? `${Math.floor(health.uptimeSeconds / 60)}m ${health.uptimeSeconds % 60}s`
                            : `${Math.floor(health.uptimeSeconds / 3600)}h ${Math.floor((health.uptimeSeconds % 3600) / 60)}m`}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#161B22] rounded-xl p-5 border border-white/8 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#F5EFE3]">New Signups (7d)</p>
                        <p className="text-xs text-[rgba(245,239,227,0.60)] mt-0.5">{health.recentSignups} new users this week</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Data counts */}
                <div className="bg-[#161B22] rounded-xl p-6 border border-white/8 shadow-sm">
                  <h3 className="text-base font-bold text-[#F5EFE3] mb-5">Platform Data</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    {[
                      { label: "Total Users", value: health.totalUsers, sub: `${health.paidUsers} paid` },
                      { label: "Total Leads", value: health.totalLeads, sub: "Email captures" },
                      { label: "Total Clients", value: health.totalClients, sub: "Across all users" },
                      { label: "Total Invoices", value: health.totalInvoices, sub: `${health.paidInvoices} paid` },
                      { label: "Total Bookings", value: health.totalBookings, sub: `${health.completedBookings} completed` },
                      { label: "Checked At", value: new Date(health.checkedAt).toLocaleTimeString(), sub: "Last check" },
                    ].map(({ label, value, sub }) => (
                      <div key={label} className="text-center p-4 bg-[#1C2333] rounded-xl">
                        <p className="text-2xl font-extrabold text-[#F5EFE3]">{value}</p>
                        <p className="text-xs font-semibold text-[rgba(245,239,227,0.70)] mt-1">{label}</p>
                        <p className="text-xs text-[rgba(245,239,227,0.60)] mt-0.5">{sub}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick actions */}
                <div className="bg-[#161B22] rounded-xl p-6 border border-white/8 shadow-sm">
                  <h3 className="text-base font-bold text-[#F5EFE3] mb-4">Quick Actions</h3>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => { healthQuery.refetch(); statsQuery.refetch(); toast.success("All data refreshed"); }}>
                      <RefreshCw className="w-4 h-4" />
                      Refresh All Data
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => setActiveTab("settings")}>
                      <Settings className="w-4 h-4" />
                      Go to Site Settings
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => setActiveTab("users")}>
                      <Users className="w-4 h-4" />
                      Manage Users
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-[rgba(245,239,227,0.60)]">
                <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Could not load health data. Try refreshing.</p>
              </div>
            )}
          </section>
        )}

        {/* ── Stripe Recovery Panel ───────────────────────────────────── */}
        {activeTab === "stripe_recovery" && (
          <section aria-label="Stripe event recovery" className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><h2 className="text-xl font-bold text-[#F5EFE3]">Stripe event recovery</h2><p className="mt-1 max-w-3xl text-sm text-[rgba(245,239,227,0.65)]">Owner-only processing evidence for signed payment events. The table excludes event payloads and does not establish that Stripe or a downstream system completed a business action.</p></div>
              <Button onClick={() => processDueStripeEventsMutation.mutate({ limit: 10 })} disabled={processDueStripeEventsMutation.isPending} className="bg-[#D4922A] text-white hover:bg-[#B87716]"><RefreshCw className={`mr-2 h-4 w-4 ${processDueStripeEventsMutation.isPending ? "animate-spin" : ""}`} />{processDueStripeEventsMutation.isPending ? "Processing…" : "Process due events"}</Button>
            </div>
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-[#F5EFE3]"><p className="font-semibold">Bounded recovery policy</p><p className="mt-1 text-xs leading-5 text-[rgba(245,239,227,0.72)]">TrueAxis HQ stores an encrypted event envelope before acknowledging a verified event. Failed processing can be retried up to five times with increasing delays; terminal events require owner review. A real-provider signed webhook walkthrough remains an external validation gate.</p></div>
            {stripeRecoveryQuery.isLoading ? <div className="h-52 animate-pulse rounded-xl bg-white/10" /> : stripeRecoveryQuery.isError ? <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">Recovery evidence could not be loaded. Refresh the page or review server logs.</div> : stripeRecoveryQuery.data?.length ? <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#161B22]"><table className="min-w-[760px] w-full text-left text-sm"><thead className="border-b border-white/10 text-xs uppercase tracking-wide text-[rgba(245,239,227,0.56)]"><tr><th className="px-4 py-3">Event</th><th className="px-4 py-3">State</th><th className="px-4 py-3">Attempts</th><th className="px-4 py-3">Next action</th><th className="px-4 py-3">Last issue</th></tr></thead><tbody>{stripeRecoveryQuery.data.map(event => <tr key={event.id} className="border-b border-white/5 last:border-0"><td className="px-4 py-3"><p className="font-semibold text-[#F5EFE3]">{event.eventType}</p><p className="mt-0.5 font-mono text-[11px] text-[rgba(245,239,227,0.52)]">{event.eventId}</p></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${event.status === "processed" ? "bg-emerald-400/15 text-emerald-200" : event.status === "terminal" ? "bg-rose-400/15 text-rose-200" : "bg-amber-400/15 text-amber-100"}`}>{event.status}</span></td><td className="px-4 py-3 text-[#F5EFE3]">{event.attemptCount}</td><td className="px-4 py-3 text-xs text-[rgba(245,239,227,0.7)]">{event.nextAttemptAt ? new Date(event.nextAttemptAt).toLocaleString() : event.completedAt ? `Completed ${new Date(event.completedAt).toLocaleString()}` : "No scheduled retry"}</td><td className="max-w-[260px] truncate px-4 py-3 text-xs text-[rgba(245,239,227,0.7)]">{event.lastError || "—"}</td></tr>)}</tbody></table></div> : <div className="rounded-xl border border-dashed border-white/15 bg-[#161B22] p-8 text-center text-sm text-[rgba(245,239,227,0.68)]">No Stripe processing evidence has been recorded yet.</div>}
          </section>
        )}

        {/* ── Security Panel ──────────────────────────────────────────── */}
        {activeTab === "security" && (
          <section id="security-content" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

            {/* Watchdog Status */}
            <div className={`rounded-xl p-6 border shadow-sm ${
              watchdogQuery.data?.healthy === false
                ? "bg-red-50 border-red-200"
                : watchdogQuery.data?.healthy === true
                ? "bg-green-50 border-green-200"
                : "bg-[#161B22] border-white/8"
            }`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    watchdogQuery.data?.healthy === false ? "bg-red-500 animate-pulse" :
                    watchdogQuery.data?.healthy === true ? "bg-green-500" : "bg-gray-300"
                  }`} />
                  <h2 className={`text-lg font-bold ${watchdogQuery.data?.healthy === false ? "text-red-950" : watchdogQuery.data?.healthy === true ? "text-green-950" : "text-[#F5EFE3]"}`}>Watchdog Status</h2>
                  {watchdogQuery.data?.checkedAt && (
                    <span className={`text-xs ${watchdogQuery.data?.healthy === false ? "text-red-800" : watchdogQuery.data?.healthy === true ? "text-green-800" : "text-[rgba(245,239,227,0.60)]"}`}>Last checked: {new Date(watchdogQuery.data.checkedAt).toLocaleTimeString()}</span>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => watchdogQuery.refetch()} disabled={watchdogQuery.isFetching}>
                  <RefreshCw className={`w-4 h-4 mr-1 ${watchdogQuery.isFetching ? "animate-spin" : ""}`} />
                  Run Check
                </Button>
              </div>
              {watchdogQuery.data ? (
                <div className="space-y-3">
                  {watchdogQuery.data.issues.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-red-400">Issues requiring attention:</p>
                      {watchdogQuery.data.issues.map((issue, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          {issue}
                        </div>
                      ))}
                    </div>
                  )}
                  {watchdogQuery.data.fixes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-green-400">Auto-fixes applied:</p>
                      {watchdogQuery.data.fixes.map((fix, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-green-400 bg-green-500/10 rounded-lg px-3 py-2">
                          <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          {fix}
                        </div>
                      ))}
                    </div>
                  )}
                  {watchdogQuery.data.issues.length === 0 && watchdogQuery.data.fixes.length === 0 && (
                    <p className="text-sm text-green-400 font-medium">All systems healthy. No issues detected.</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-[rgba(245,239,227,0.60)]">Running watchdog check...</p>
              )}
            </div>

            {/* Security Stats */}
            {securityStatsQuery.data && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Blocked IPs", value: securityStatsQuery.data.blockedIPs, color: "text-red-600", bg: "bg-red-50" },
                  { label: "Locked Accounts", value: securityStatsQuery.data.lockedAccounts.length, color: "text-amber-600", bg: "bg-amber-50" },
                  { label: "Rate Limited IPs", value: securityStatsQuery.data.activeWindows, color: "text-orange-600", bg: "bg-orange-50" },
                  { label: "Unresolved Events", value: securityEventsQuery.data?.length ?? 0, color: "text-purple-600", bg: "bg-purple-50" },
                ].map(stat => (
                  <div key={stat.label} className={`${stat.bg} rounded-xl p-5 border border-white shadow-sm`}>
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="text-xs text-[rgba(245,239,227,0.60)] mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* IP Management */}
            <div className="bg-[#161B22] rounded-xl p-6 border border-white/8 shadow-sm">
              <h3 className="text-base font-bold text-[#F5EFE3] mb-4">IP Management</h3>
              <div className="grid sm:grid-cols-2 gap-6">
                {/* Block IP */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-[rgba(245,239,227,0.70)]">Block an IP Address</p>
                  <input
                    type="text"
                    value={blockIPInput}
                    onChange={e => setBlockIPInput(e.target.value)}
                    placeholder="e.g. 192.168.1.1"
                    className="form-input-light w-full"
                  />
                  <input
                    type="text"
                    value={blockIPReason}
                    onChange={e => setBlockIPReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="form-input-light w-full"
                  />
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white w-full"
                    onClick={() => blockIPMutation.mutate({ ip: blockIPInput.trim(), reason: blockIPReason.trim() || undefined })}
                    disabled={!blockIPInput.trim() || blockIPMutation.isPending}
                  >
                    <Lock className="w-4 h-4 mr-1" />
                    Block IP
                  </Button>
                </div>
                {/* Unblock IP */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-[rgba(245,239,227,0.70)]">Unblock an IP Address</p>
                  <input
                    type="text"
                    value={blockIPInput}
                    onChange={e => setBlockIPInput(e.target.value)}
                    placeholder="e.g. 192.168.1.1"
                    className="form-input-light w-full"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => unblockIPMutation.mutate({ ip: blockIPInput.trim() })}
                    disabled={!blockIPInput.trim() || unblockIPMutation.isPending}
                  >
                    <Unlock className="w-4 h-4 mr-1" />
                    Unblock IP
                  </Button>

                  {/* Blocked IPs list */}
                  {securityStatsQuery.data?.permanentBlocklist && securityStatsQuery.data.permanentBlocklist > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-[rgba(245,239,227,0.60)] mb-2">{securityStatsQuery.data.permanentBlocklist} IP(s) in permanent blocklist</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Account Lockout Management */}
            <div className="bg-[#161B22] rounded-xl p-6 border border-white/8 shadow-sm">
              <h3 className="text-base font-bold text-[#F5EFE3] mb-4">Account Lockout Management</h3>
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-[rgba(245,239,227,0.70)]">Unlock a Locked Account</p>
                  <input
                    type="email"
                    value={unlockEmailInput}
                    onChange={e => setUnlockEmailInput(e.target.value)}
                    placeholder="user@example.com"
                    className="form-input-light w-full"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => unlockAccountMutation.mutate({ email: unlockEmailInput.trim() })}
                    disabled={!unlockEmailInput.trim() || unlockAccountMutation.isPending}
                  >
                    <Unlock className="w-4 h-4 mr-1" />
                    Unlock Account
                  </Button>
                </div>
                {securityStatsQuery.data?.lockedAccounts && securityStatsQuery.data.lockedAccounts.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[rgba(245,239,227,0.60)] mb-2">Currently Locked:</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {securityStatsQuery.data.lockedAccounts.map((acct) => (
                        <div key={acct.email} className="flex items-center justify-between bg-amber-500/8 rounded-lg px-3 py-1.5">
                          <span className="text-xs text-[rgba(245,239,227,0.55)]">{acct.email}</span>
                          <button
                            onClick={() => unlockAccountMutation.mutate({ email: acct.email })}
                            className="text-xs text-amber-600 hover:text-amber-800 transition-colors"
                          >
                            Unlock
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Security Events Log */}
            <div className="bg-[#161B22] rounded-xl p-6 border border-white/8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h3 className="text-base font-bold text-[#F5EFE3]">Security Event Log</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={securityFilter}
                    onChange={e => setSecurityFilter(e.target.value as any)}
                    className="form-input-light text-sm py-1.5 px-3"
                  >
                    <option value="all">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <label className="flex items-center gap-1.5 text-sm text-[rgba(245,239,227,0.60)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showResolvedEvents}
                      onChange={e => setShowResolvedEvents(e.target.checked)}
                      className="rounded"
                    />
                    Show resolved
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resolveAllMutation.mutate({ severity: securityFilter })}
                    disabled={resolveAllMutation.isPending || (securityEventsQuery.data?.length ?? 0) === 0}
                  >
                    Resolve All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const events = securityEventsQuery.data ?? [];
                      if (events.length === 0) { toast.error("No events to export."); return; }
                      const headers = "Date,Event,Severity,Status,IP,User Agent";
                      const rows = events.map((e) =>
                        `"${new Date(e.createdAt).toLocaleString()}","${e.eventType ?? ""}","${e.severity ?? ""}","${e.resolved ? "Resolved" : "Open"}","${e.ip ?? ""}","${(e.userAgent ?? "").replace(/"/g, "'")}"`
                      );
                      const csv = [headers, ...rows].join("\n");
                      const blob = new Blob([csv], { type: "text/csv" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `trueaxis-hq-security-log-${new Date().toISOString().split("T")[0]}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success(`Exported ${events.length} security events`);
                    }}
                    className="gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => securityEventsQuery.refetch()}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {securityEventsQuery.isLoading ? (
                <div className="py-8 text-center text-[rgba(245,239,227,0.60)] text-sm">Loading events...</div>
              ) : securityEventsQuery.data && securityEventsQuery.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/8">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-[rgba(245,239,227,0.60)]">Time</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-[rgba(245,239,227,0.60)]">Event</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-[rgba(245,239,227,0.60)]">Severity</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-[rgba(245,239,227,0.60)]">IP</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-[rgba(245,239,227,0.60)]">Details</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-[rgba(245,239,227,0.60)]">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {securityEventsQuery.data.map(event => (
                        <tr key={event.id} className={`hover:bg-[#1C2333] transition-colors ${event.resolved ? "opacity-50" : ""}`}>
                          <td className="py-2 px-3 text-xs text-[rgba(245,239,227,0.60)] whitespace-nowrap">
                            {new Date(event.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 font-mono text-xs text-[rgba(245,239,227,0.70)]">{event.eventType}</td>
                          <td className="py-2 px-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              event.severity === "critical" ? "bg-red-500/15 text-red-400" :
                              event.severity === "high" ? "bg-orange-100 text-orange-700" :
                              event.severity === "medium" ? "bg-amber-500/15 text-amber-400" :
                              "bg-[#243040] text-[rgba(245,239,227,0.60)]"
                            }`}>
                              {event.severity}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-xs text-[rgba(245,239,227,0.60)]">{event.ip ?? "—"}</td>
                          <td className="py-2 px-3 text-xs text-[rgba(245,239,227,0.60)] max-w-xs truncate">{event.details ?? event.email ?? "—"}</td>
                          <td className="py-2 px-3">
                            {!event.resolved && (
                              <button
                                onClick={() => resolveEventMutation.mutate({ id: event.id })}
                                className="text-xs text-teal-600 hover:text-teal-800 font-medium transition-colors"
                              >
                                Resolve
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-[rgba(245,239,227,0.60)]">
                  <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No security events found.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Invite Codes Tab */}
        {activeTab === "invites" && (
          <section aria-label="Invite Codes" className="space-y-6">
            <div className="bg-[#161B22] rounded-xl p-6 border border-white/8 shadow-sm">
              <h3 className="text-base font-bold text-[#F5EFE3] mb-4">Generate Invite Code</h3>
              <div className="flex gap-3">
                <input
                  value={newInviteNote}
                  onChange={e => setNewInviteNote(e.target.value)}
                  placeholder="Optional note (e.g. for Jane Smith)"
                  className="form-input-light flex-1"
                />
                <Button
                  className="bg-[#0D1117] text-white hover:bg-[#2C2C2E] gap-2"
                  onClick={() => createInviteMutation.mutate({ note: newInviteNote || undefined })}
                  disabled={createInviteMutation.isPending}
                >
                  <Plus className="w-4 h-4" />Generate Code
                </Button>
              </div>
            </div>
            <div className="bg-[#161B22] rounded-xl p-6 border border-white/8 shadow-sm">
              <h3 className="text-base font-bold text-[#F5EFE3] mb-4">Active Invite Codes</h3>
              {invitesQuery.isLoading ? (
                <div className="py-8 text-center text-[rgba(245,239,227,0.60)]">Loading...</div>
              ) : !invitesQuery.data?.length ? (
                <div className="py-8 text-center text-[rgba(245,239,227,0.60)]">
                  <Key className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No invite codes yet. Generate one above.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/8">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-[rgba(245,239,227,0.60)]">Code</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-[rgba(245,239,227,0.60)]">Note</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-[rgba(245,239,227,0.60)]">Status</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-[rgba(245,239,227,0.60)]">Created</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-[rgba(245,239,227,0.60)]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invitesQuery.data.map((inv) => (
                        <tr key={inv.id} className="border-b border-white/5 hover:bg-[#1C2333]">
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-[#0D1117]">{inv.code}</span>
                              <button
                                onClick={() => { navigator.clipboard.writeText(inv.code); setCopiedCode(inv.code); setTimeout(() => setCopiedCode(null), 2000); }}
                                className="p-1 rounded hover:bg-[#243040] text-[rgba(245,239,227,0.60)] hover:text-[rgba(245,239,227,0.60)]"
                              >
                                {copiedCode === inv.code ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-[rgba(245,239,227,0.60)]">{inv.note || "—"}</td>
                          <td className="py-2 px-3">
                            {inv.usedBy ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-[#243040] text-[rgba(245,239,227,0.60)]">Used</span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600">Available</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-[rgba(245,239,227,0.60)] text-xs">{new Date(inv.createdAt).toLocaleDateString()}</td>
                          <td className="py-2 px-3">
                            {!inv.usedBy && (
                              <button
                                onClick={() => revokeInviteMutation.mutate({ id: inv.id })}
                                className="text-xs text-red-500 hover:text-red-700 font-medium"
                              >
                                Revoke
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
