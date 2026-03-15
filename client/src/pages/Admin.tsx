import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Users, DollarSign, TrendingUp, Crown, Shield, Search,
  Bell, BarChart3, ChevronRight, AlertCircle, RefreshCw,
  Megaphone, CheckCircle, XCircle, Clock, Mail, Download,
  Settings, Activity, Trash2, Edit2, Save, X, ToggleLeft,
  ToggleRight, Globe, Phone, Twitter, Linkedin, Instagram,
  Youtube, Zap, Database, Server, Lock, Unlock, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <article className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <p className="text-3xl font-extrabold text-gray-900" style={{ fontFamily: "Sora, sans-serif" }}>{value}</p>
      <p className="text-sm font-semibold text-gray-700 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </article>
  );
}

// ─── Plan Badge ───────────────────────────────────────────────────────────────
function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    agency: "bg-purple-100 text-purple-800",
    pro: "bg-teal-100 text-teal-800",
    starter: "bg-blue-100 text-blue-800",
    free: "bg-gray-100 text-gray-600",
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
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C9A7] ${value ? "bg-[#00C9A7]" : "bg-gray-200"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────
type AdminTab = "overview" | "users" | "leads" | "broadcast" | "settings" | "health";

export default function Admin() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
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
  const statsQuery = trpc.admin.revenueStats.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const usersQuery = trpc.admin.listUsers.useQuery(
    { search: search || undefined, page, limit: 20 },
    { enabled: isAuthenticated && user?.role === "admin" }
  );
  const leadsQuery = trpc.admin.listLeads.useQuery(
    { page: leadsPage, limit: 50 },
    { enabled: isAuthenticated && user?.role === "admin" && activeTab === "leads" }
  );
  const settingsQuery = trpc.admin.getSettings.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin" && activeTab === "settings",
    onSuccess: (data: any) => {
      if (!settingsDirty) setSettingsForm(data);
    },
  } as any);
  const healthQuery = trpc.admin.getSystemHealth.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin" && activeTab === "health",
    refetchInterval: 30_000,
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

  const updateField = (key: string, value: any) => {
    setSettingsForm((prev: any) => ({ ...prev, [key]: value }));
    setSettingsDirty(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-[#00C9A7] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading admin panel…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Sign in required</h1>
          <p className="text-gray-500 text-sm mb-6">You need to be signed in to access the admin panel.</p>
          <Button className="gradient-teal text-white border-0" onClick={() => window.location.href = getLoginUrl()}>Sign In</Button>
        </div>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500 text-sm mb-6">This area is restricted to administrators only.</p>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const stats = statsQuery.data;
  const health = healthQuery.data;

  const tabs: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "users", label: "Users", icon: Users },
    { id: "leads", label: "Leads", icon: Mail },
    { id: "broadcast", label: "Broadcast", icon: Megaphone },
    { id: "settings", label: "Site Settings", icon: Settings },
    { id: "health", label: "System Health", icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Header */}
      <header className="bg-[#1C1C1E] text-white px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-teal flex items-center justify-center">
            <Crown className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold" style={{ fontFamily: "Sora, sans-serif" }}>
              SkillBridge AI <span className="text-[#00C9A7]">Admin</span>
            </h1>
            <p className="text-xs text-gray-400">Owner Control Panel</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white hover:bg-white/10" onClick={() => navigate("/dashboard")}>
            Dashboard
          </Button>
          <div className="w-8 h-8 rounded-full bg-[#00C9A7]/20 flex items-center justify-center text-[#00C9A7] text-sm font-bold">
            {user?.name?.[0]?.toUpperCase() ?? "A"}
          </div>
        </div>
      </header>

      {/* Tab Nav */}
      <nav aria-label="Admin sections" className="bg-white border-b border-gray-100 px-2 sm:px-6 overflow-x-auto">
        <div className="flex gap-1 max-w-7xl mx-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`flex items-center gap-2 px-3 sm:px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] ${
                activeTab === tab.id ? "border-[#00C9A7] text-[#007A65]" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* ── Overview Tab ──────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <section aria-label="Revenue overview">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "Sora, sans-serif" }}>Revenue Overview</h2>
              <Button variant="outline" size="sm" onClick={() => statsQuery.refetch()} disabled={statsQuery.isFetching}>
                <RefreshCw className={`w-4 h-4 mr-2 ${statsQuery.isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {statsQuery.isLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard icon={Users} label="Total Users" value={stats?.totalUsers ?? 0} color="bg-blue-500" />
                <StatCard icon={Crown} label="Paid Subscribers" value={stats?.paidUsers ?? 0} sub={`${stats?.totalUsers ? Math.round((stats.paidUsers / stats.totalUsers) * 100) : 0}% conversion`} color="bg-[#00C9A7]" />
                <StatCard icon={DollarSign} label="MRR" value={`$${(stats?.mrr ?? 0).toLocaleString()}`} sub="Monthly recurring revenue" color="bg-purple-500" />
                <StatCard icon={TrendingUp} label="ARR" value={`$${(stats?.arr ?? 0).toLocaleString()}`} sub="Annual run rate" color="bg-orange-500" />
              </div>
            )}

            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-base font-bold text-gray-900 mb-5">Plan Distribution</h3>
              <div className="space-y-4">
                {[
                  { id: "agency", label: "Agency ($199/mo)", color: "bg-purple-500" },
                  { id: "pro", label: "Pro ($99/mo)", color: "bg-[#00C9A7]" },
                  { id: "starter", label: "Starter ($49/mo)", color: "bg-blue-500" },
                  { id: "free", label: "Free", color: "bg-gray-300" },
                ].map(plan => {
                  const count = (stats?.byPlan as Record<string, number> | undefined)?.[plan.id] ?? 0;
                  const total = stats?.totalUsers ?? 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={plan.id} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 w-36 flex-shrink-0">{plan.label}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                        <div className={`h-2.5 rounded-full ${plan.color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-sm font-semibold text-gray-700 w-16 text-right">{count} ({pct}%)</span>
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
              <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "Sora, sans-serif" }}>User Management</h2>
              <p className="text-sm text-gray-500">{usersQuery.data?.total ?? 0} total users</p>
            </div>

            <div className="relative mb-5">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by name or email…"
                className="form-input pl-10"
              />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
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
                        <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                          <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          <p>No users found</p>
                        </td>
                      </tr>
                    ) : (
                      usersQuery.data?.users.map(u => (
                        <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#00C9A7]/15 flex items-center justify-center text-[#007A65] text-xs font-bold flex-shrink-0">
                                {u.name?.[0]?.toUpperCase() ?? "?"}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{u.name ?? "Unknown"}</p>
                                <p className="text-xs text-gray-400">{u.email ?? "No email"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            {editingPlanUserId === u.id ? (
                              <div className="flex items-center gap-2">
                                <select
                                  value={editPlanId}
                                  onChange={e => setEditPlanId(e.target.value)}
                                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#00C9A7]"
                                >
                                  <option value="free">Free</option>
                                  <option value="starter">Starter</option>
                                  <option value="pro">Pro</option>
                                  <option value="agency">Agency</option>
                                </select>
                                <select
                                  value={editSubStatus}
                                  onChange={e => setEditSubStatus(e.target.value)}
                                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#00C9A7]"
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
                                <button onClick={() => setEditingPlanUserId(null)} className="p-1 text-gray-400 hover:text-gray-600" title="Cancel">
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
                                  className="p-0.5 text-gray-300 hover:text-gray-500"
                                  title="Override plan"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4"><StatusBadge status={u.subscriptionStatus ?? "free"} /></td>
                          <td className="px-5 py-4 text-gray-500 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${u.role === "admin" ? "text-purple-700" : "text-gray-500"}`}>
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
                <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
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
                <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "Sora, sans-serif" }}>Email Leads</h2>
                <p className="text-sm text-gray-500 mt-0.5">{leadsQuery.data?.total ?? 0} leads captured from the landing page</p>
              </div>
              <Button
                variant="outline" size="sm"
                onClick={() => {
                  const leads = leadsQuery.data?.leads ?? [];
                  if (leads.length === 0) { toast.error("No leads to export."); return; }
                  const csv = ["Name,Email,Source,Date", ...leads.map(l => `"${l.name ?? ""}","${l.email}","${l.source ?? ""}","${new Date(l.createdAt).toLocaleDateString()}"`)].join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = "skillbridge-leads.csv"; a.click(); URL.revokeObjectURL(url);
                  toast.success(`Exported ${leads.length} leads as CSV`);
                }}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="hidden sm:grid grid-cols-4 gap-4 px-6 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <span>Name</span><span>Email</span><span>Source</span><span>Date</span>
              </div>
              {leadsQuery.isLoading ? (
                <div className="p-6 text-center text-gray-400">
                  <div className="w-8 h-8 border-2 border-[#00C9A7] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm">Loading leads…</p>
                </div>
              ) : !leadsQuery.data?.leads || leadsQuery.data.leads.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium text-gray-500">No leads captured yet</p>
                  <p className="text-xs mt-1">Email sign-ups from the landing page will appear here.</p>
                </div>
              ) : leadsQuery.data.leads.map((lead, i) => (
                <div key={lead.id} className={`grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4 px-6 py-4 ${i > 0 ? "border-t border-gray-50" : ""} hover:bg-gray-50`}>
                  <p className="text-sm font-medium text-gray-900">{lead.name || <span className="text-gray-400 italic">No name</span>}</p>
                  <p className="text-sm text-gray-600 truncate">{lead.email}</p>
                  <span className="inline-flex items-center w-fit px-2 py-0.5 rounded-full text-xs font-medium bg-[#00C9A7]/10 text-[#007A65]">{lead.source ?? "landing_page"}</span>
                  <p className="text-sm text-gray-400">{new Date(lead.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
            {(leadsQuery.data?.total ?? 0) > 50 && (
              <div className="flex items-center justify-between mt-4">
                <Button variant="outline" size="sm" onClick={() => setLeadsPage(p => Math.max(1, p - 1))} disabled={leadsPage === 1}>Previous</Button>
                <span className="text-sm text-gray-500">Page {leadsPage} of {Math.ceil((leadsQuery.data?.total ?? 0) / 50)}</span>
                <Button variant="outline" size="sm" onClick={() => setLeadsPage(p => p + 1)} disabled={leadsPage >= Math.ceil((leadsQuery.data?.total ?? 0) / 50)}>Next</Button>
              </div>
            )}
          </section>
        )}

        {/* ── Broadcast Tab ─────────────────────────────────────────────── */}
        {activeTab === "broadcast" && (
          <section aria-label="Broadcast notification">
            <h2 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: "Sora, sans-serif" }}>Send Broadcast</h2>
            <p className="text-sm text-gray-500 mb-6">Send an owner notification — useful for tracking important events or reminders.</p>
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm max-w-xl">
              <form onSubmit={e => { e.preventDefault(); if (!broadcastTitle.trim() || !broadcastContent.trim()) { toast.error("Please fill in both fields"); return; } broadcastMutation.mutate({ title: broadcastTitle, content: broadcastContent }); }} noValidate>
                <div className="mb-4">
                  <label htmlFor="broadcast-title" className="form-label">Title *</label>
                  <input id="broadcast-title" type="text" value={broadcastTitle} onChange={e => setBroadcastTitle(e.target.value)} placeholder="e.g. New feature launched" className="form-input" required maxLength={200} />
                </div>
                <div className="mb-6">
                  <label htmlFor="broadcast-content" className="form-label">Message *</label>
                  <textarea id="broadcast-content" value={broadcastContent} onChange={e => setBroadcastContent(e.target.value)} placeholder="Write your message here…" rows={5} className="form-input resize-none" required maxLength={2000} />
                  <p className="form-hint">{broadcastContent.length}/2000 characters</p>
                </div>
                <Button type="submit" className="gradient-teal text-white border-0 w-full gap-2" disabled={broadcastMutation.isPending}>
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
                <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "Sora, sans-serif" }}>Site Settings</h2>
                <p className="text-sm text-gray-500 mt-0.5">Control every aspect of the platform from here</p>
              </div>
              {settingsDirty && (
                <Button
                  className="gradient-teal text-white border-0 gap-2"
                  onClick={() => updateSettingsMutation.mutate(settingsForm as any)}
                  disabled={updateSettingsMutation.isPending}
                >
                  {updateSettingsMutation.isPending ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving…</> : <><Save className="w-4 h-4" />Save All Changes</>}
                </Button>
              )}
            </div>

            {settingsQuery.isLoading ? (
              <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}</div>
            ) : (
              <div className="space-y-6">

                {/* Site Identity */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <h3 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[#00C9A7]" />
                    Site Identity
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Site Name</label>
                      <input type="text" value={settingsForm.siteName ?? ""} onChange={e => updateField("siteName", e.target.value)} className="form-input" placeholder="SkillBridge AI" maxLength={255} />
                    </div>
                    <div>
                      <label className="form-label">Support Email</label>
                      <input type="email" value={settingsForm.supportEmail ?? ""} onChange={e => updateField("supportEmail", e.target.value)} className="form-input" placeholder="support@skillbridge.ai" maxLength={320} />
                    </div>
                    <div>
                      <label className="form-label">Support Phone</label>
                      <input type="tel" value={settingsForm.supportPhone ?? ""} onChange={e => updateField("supportPhone", e.target.value)} className="form-input" placeholder="+1 (555) 000-0000" maxLength={32} />
                    </div>
                    <div>
                      <label className="form-label">Free Trial Days</label>
                      <input type="number" value={settingsForm.freeTrialDays ?? 14} onChange={e => updateField("freeTrialDays", parseInt(e.target.value) || 0)} className="form-input" min={0} max={365} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="form-label">Site Tagline</label>
                      <input type="text" value={settingsForm.siteTagline ?? ""} onChange={e => updateField("siteTagline", e.target.value)} className="form-input" placeholder="The AI-powered business platform for freelancers & coaches" maxLength={512} />
                    </div>
                  </div>
                </div>

                {/* Announcement Banner */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-[#00C9A7]" />
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
                      <input type="text" value={settingsForm.announcementText ?? ""} onChange={e => updateField("announcementText", e.target.value)} className="form-input" placeholder="🎉 Limited early-bird pricing — 50% off for the first 3 months!" maxLength={512} />
                    </div>
                    <div>
                      <label className="form-label">Color</label>
                      <select value={settingsForm.announcementColor ?? "teal"} onChange={e => updateField("announcementColor", e.target.value)} className="form-input">
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
                      settingsForm.announcementColor === "purple" ? "bg-purple-100 text-purple-800" :
                      settingsForm.announcementColor === "yellow" ? "bg-yellow-100 text-yellow-800" :
                      settingsForm.announcementColor === "blue" ? "bg-blue-100 text-blue-800" :
                      "bg-[#00C9A7]/15 text-[#007A65]"
                    }`}>
                      Preview: {settingsForm.announcementText}
                    </div>
                  )}
                </div>

                {/* Social Links */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <h3 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[#00C9A7]" />
                    Social Media Links
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { key: "socialTwitter", label: "Twitter / X", icon: Twitter, placeholder: "https://twitter.com/skillbridgeai" },
                      { key: "socialLinkedin", label: "LinkedIn", icon: Linkedin, placeholder: "https://linkedin.com/company/skillbridge-ai" },
                      { key: "socialInstagram", label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/skillbridgeai" },
                      { key: "socialYoutube", label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/@skillbridgeai" },
                    ].map(({ key, label, icon: Icon, placeholder }) => (
                      <div key={key}>
                        <label className="form-label flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5" />
                          {label}
                        </label>
                        <input type="url" value={(settingsForm as any)[key] ?? ""} onChange={e => updateField(key, e.target.value)} className="form-input" placeholder={placeholder} maxLength={255} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Feature Flags */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <h3 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#00C9A7]" />
                    Feature Flags
                    <span className="text-xs font-normal text-gray-400 ml-1">— enable or disable platform features globally</span>
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
                      <div key={key} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
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
                <div className={`bg-white rounded-2xl p-6 border shadow-sm ${settingsForm.maintenanceMode ? "border-red-200 bg-red-50/30" : "border-gray-100"}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-red-500" />
                      Maintenance Mode
                      {settingsForm.maintenanceMode && <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">ACTIVE</span>}
                    </h3>
                    <Toggle
                      value={settingsForm.maintenanceMode ?? false}
                      onChange={v => updateField("maintenanceMode", v)}
                      label="Toggle maintenance mode"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mb-4">When enabled, all non-admin users will see a maintenance page instead of the app.</p>
                  <div>
                    <label className="form-label">Maintenance Message</label>
                    <input type="text" value={settingsForm.maintenanceMessage ?? ""} onChange={e => updateField("maintenanceMessage", e.target.value)} className="form-input" placeholder="We're performing scheduled maintenance. Back in 30 minutes!" maxLength={512} />
                  </div>
                </div>

                {/* Save button at bottom */}
                {settingsDirty && (
                  <div className="flex justify-end">
                    <Button
                      className="gradient-teal text-white border-0 gap-2 px-8"
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
                <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "Sora, sans-serif" }}>System Health</h2>
                <p className="text-sm text-gray-500 mt-0.5">Live platform diagnostics — auto-refreshes every 30 seconds</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => healthQuery.refetch()} disabled={healthQuery.isFetching}>
                <RefreshCw className={`w-4 h-4 mr-2 ${healthQuery.isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {healthQuery.isLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>
            ) : health ? (
              <div className="space-y-6">
                {/* Status indicators */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${health.dbStatus === "healthy" ? "bg-emerald-100" : "bg-red-100"}`}>
                        <Database className={`w-5 h-5 ${health.dbStatus === "healthy" ? "text-emerald-600" : "text-red-600"}`} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">Database</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <HealthDot ok={health.dbStatus === "healthy"} />
                          <span className={`text-xs font-semibold ${health.dbStatus === "healthy" ? "text-emerald-600" : "text-red-600"}`}>
                            {health.dbStatus === "healthy" ? "Healthy" : "Error"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                        <Server className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">Server Uptime</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {health.uptimeSeconds < 3600
                            ? `${Math.floor(health.uptimeSeconds / 60)}m ${health.uptimeSeconds % 60}s`
                            : `${Math.floor(health.uptimeSeconds / 3600)}h ${Math.floor((health.uptimeSeconds % 3600) / 60)}m`}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">New Signups (7d)</p>
                        <p className="text-xs text-gray-500 mt-0.5">{health.recentSignups} new users this week</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Data counts */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <h3 className="text-base font-bold text-gray-900 mb-5">Platform Data</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    {[
                      { label: "Total Users", value: health.totalUsers, sub: `${health.paidUsers} paid` },
                      { label: "Total Leads", value: health.totalLeads, sub: "Email captures" },
                      { label: "Total Clients", value: health.totalClients, sub: "Across all users" },
                      { label: "Total Invoices", value: health.totalInvoices, sub: `${health.paidInvoices} paid` },
                      { label: "Total Bookings", value: health.totalBookings, sub: `${health.completedBookings} completed` },
                      { label: "Checked At", value: new Date(health.checkedAt).toLocaleTimeString(), sub: "Last check" },
                    ].map(({ label, value, sub }) => (
                      <div key={label} className="text-center p-4 bg-gray-50 rounded-xl">
                        <p className="text-2xl font-extrabold text-gray-900" style={{ fontFamily: "Sora, sans-serif" }}>{value}</p>
                        <p className="text-xs font-semibold text-gray-700 mt-1">{label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick actions */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <h3 className="text-base font-bold text-gray-900 mb-4">Quick Actions</h3>
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
              <div className="text-center py-16 text-gray-400">
                <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Could not load health data. Try refreshing.</p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
