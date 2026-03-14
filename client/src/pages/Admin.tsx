import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Users, DollarSign, TrendingUp, Crown, Shield, Search,
  Bell, BarChart3, ChevronRight, AlertCircle, RefreshCw,
  Megaphone, CheckCircle, XCircle, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <article className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm" aria-label={`${label}: ${value}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" aria-hidden="true" />
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
  if (status === "active") return (
    <span className="status-active" role="status" aria-label="Active subscription">
      Active
    </span>
  );
  if (status === "past_due") return (
    <span className="status-pending" role="status" aria-label="Payment past due">
      Past Due
    </span>
  );
  if (status === "cancelled") return (
    <span className="status-inactive" role="status" aria-label="Cancelled">
      Cancelled
    </span>
  );
  return (
    <span className="status-inactive" role="status" aria-label="Free plan">
      Free
    </span>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────
export default function Admin() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastContent, setBroadcastContent] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "broadcast">("overview");

  const statsQuery = trpc.admin.revenueStats.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const usersQuery = trpc.admin.listUsers.useQuery(
    { search: search || undefined, page, limit: 20 },
    { enabled: isAuthenticated && user?.role === "admin" }
  );
  const setRoleMutation = trpc.admin.setUserRole.useMutation({
    onSuccess: () => { usersQuery.refetch(); toast.success("Role updated"); },
    onError: (e) => toast.error(e.message),
  });
  const broadcastMutation = trpc.admin.broadcast.useMutation({
    onSuccess: () => { toast.success("Broadcast sent!"); setBroadcastTitle(""); setBroadcastContent(""); },
    onError: (e) => toast.error(e.message),
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" role="status" aria-label="Loading">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-[#00C9A7] border-t-transparent animate-spin mx-auto mb-4" aria-hidden="true" />
          <p className="text-gray-500 text-sm">Loading admin panel…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" aria-hidden="true" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Sign in required</h1>
          <p className="text-gray-500 text-sm mb-6">You need to be signed in to access the admin panel.</p>
          <Button className="gradient-teal text-white border-0" onClick={() => window.location.href = getLoginUrl()}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" aria-hidden="true" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500 text-sm mb-6">This area is restricted to administrators only.</p>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const stats = statsQuery.data;

  return (
    <div className="min-h-screen bg-gray-50">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Header */}
      <header className="bg-[#1C1C1E] text-white px-4 sm:px-6 py-4 flex items-center justify-between" role="banner">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-teal flex items-center justify-center" aria-hidden="true">
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
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-300 hover:text-white hover:bg-white/10"
            onClick={() => navigate("/dashboard")}
            aria-label="Go to user dashboard"
          >
            Dashboard
          </Button>
          <div className="w-8 h-8 rounded-full bg-[#00C9A7]/20 flex items-center justify-center text-[#00C9A7] text-sm font-bold" aria-hidden="true">
            {user?.name?.[0]?.toUpperCase() ?? "A"}
          </div>
        </div>
      </header>

      {/* Tab Nav */}
      <nav aria-label="Admin sections" className="bg-white border-b border-gray-100 px-2 sm:px-6 overflow-x-auto">
        <div className="flex gap-1 max-w-6xl mx-auto">
          {([
            { id: "overview", label: "Overview", icon: BarChart3 },
            { id: "users", label: "Users", icon: Users },
            { id: "broadcast", label: "Broadcast", icon: Megaphone },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors min-h-[44px] ${
                activeTab === tab.id
                  ? "border-[#00C9A7] text-[#007A65]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <tab.icon className="w-4 h-4" aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main id="main-content" className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* ── Overview Tab ──────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <section aria-label="Revenue overview">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "Sora, sans-serif" }}>Revenue Overview</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => statsQuery.refetch()}
                disabled={statsQuery.isFetching}
                aria-label="Refresh revenue stats"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${statsQuery.isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
                Refresh
              </Button>
            </div>

            {statsQuery.isLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8" aria-busy="true" aria-label="Loading stats">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="skeleton h-32 rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard icon={Users} label="Total Users" value={stats?.totalUsers ?? 0} color="bg-blue-500" />
                <StatCard icon={Crown} label="Paid Subscribers" value={stats?.paidUsers ?? 0} sub={`${stats?.totalUsers ? Math.round((stats.paidUsers / stats.totalUsers) * 100) : 0}% conversion`} color="bg-[#00C9A7]" />
                <StatCard icon={DollarSign} label="MRR" value={`$${(stats?.mrr ?? 0).toLocaleString()}`} sub="Monthly recurring revenue" color="bg-purple-500" />
                <StatCard icon={TrendingUp} label="ARR" value={`$${(stats?.arr ?? 0).toLocaleString()}`} sub="Annual run rate" color="bg-orange-500" />
              </div>
            )}

            {/* Plan distribution */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-base font-bold text-gray-900 mb-5">Plan Distribution</h3>
              <div className="space-y-3" role="list" aria-label="Subscribers by plan">
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
                    <div key={plan.id} role="listitem" className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 w-36 flex-shrink-0">{plan.label}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2.5" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${plan.label}: ${pct}%`}>
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

            {/* Search */}
            <div className="relative mb-5">
              <label htmlFor="user-search" className="sr-only">Search users by name or email</label>
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
              <input
                id="user-search"
                type="search"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by name or email…"
                className="form-input pl-10"
                aria-label="Search users"
              />
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table" aria-label="User list">
                  <caption className="sr-only">List of all registered users with their plan and subscription status</caption>
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th scope="col" className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                      <th scope="col" className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
                      <th scope="col" className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th scope="col" className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                      <th scope="col" className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                      <th scope="col" className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersQuery.isLoading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          {[...Array(6)].map((_, j) => (
                            <td key={j} className="px-5 py-4">
                              <div className="skeleton h-4 rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : usersQuery.data?.users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                          <Users className="w-8 h-8 mx-auto mb-2 opacity-40" aria-hidden="true" />
                          <p>No users found</p>
                        </td>
                      </tr>
                    ) : (
                      usersQuery.data?.users.map(u => (
                        <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#00C9A7]/15 flex items-center justify-center text-[#007A65] text-xs font-bold flex-shrink-0" aria-hidden="true">
                                {u.name?.[0]?.toUpperCase() ?? "?"}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{u.name ?? "Unknown"}</p>
                                <p className="text-xs text-gray-400">{u.email ?? "No email"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4"><PlanBadge plan={u.planId ?? "free"} /></td>
                          <td className="px-5 py-4"><StatusBadge status={u.subscriptionStatus ?? "free"} /></td>
                          <td className="px-5 py-4 text-gray-500 text-xs">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${u.role === "admin" ? "text-purple-700" : "text-gray-500"}`}>
                              {u.role === "admin" ? <Shield className="w-3 h-3" aria-hidden="true" /> : null}
                              {u.role}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            {u.role !== "admin" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (confirm(`Promote ${u.name ?? "this user"} to admin?`)) {
                                    setRoleMutation.mutate({ userId: u.id, role: "admin" });
                                  }
                                }}
                                aria-label={`Promote ${u.name ?? "user"} to admin`}
                                className="text-xs"
                              >
                                Make Admin
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (confirm(`Remove admin from ${u.name ?? "this user"}?`)) {
                                    setRoleMutation.mutate({ userId: u.id, role: "user" });
                                  }
                                }}
                                aria-label={`Remove admin from ${u.name ?? "user"}`}
                                className="text-xs text-red-600 hover:text-red-700"
                              >
                                Remove Admin
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {(usersQuery.data?.total ?? 0) > 20 && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, usersQuery.data?.total ?? 0)} of {usersQuery.data?.total} users
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page">
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * 20 >= (usersQuery.data?.total ?? 0)} aria-label="Next page">
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Broadcast Tab ─────────────────────────────────────────────── */}
        {activeTab === "broadcast" && (
          <section aria-label="Broadcast message to owner">
            <h2 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: "Sora, sans-serif" }}>Send Broadcast</h2>
            <p className="text-sm text-gray-500 mb-6">Send an owner notification — useful for tracking important events or reminders.</p>

            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm max-w-xl">
              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (!broadcastTitle.trim() || !broadcastContent.trim()) {
                    toast.error("Please fill in both fields");
                    return;
                  }
                  broadcastMutation.mutate({ title: broadcastTitle, content: broadcastContent });
                }}
                noValidate
                aria-label="Broadcast notification form"
              >
                <div className="mb-4">
                  <label htmlFor="broadcast-title" className="form-label">
                    Title <span aria-hidden="true" className="text-red-500">*</span>
                    <span className="sr-only">(required)</span>
                  </label>
                  <input
                    id="broadcast-title"
                    type="text"
                    value={broadcastTitle}
                    onChange={e => setBroadcastTitle(e.target.value)}
                    placeholder="e.g. New feature launched"
                    className="form-input"
                    required
                    aria-required="true"
                    maxLength={200}
                  />
                </div>
                <div className="mb-6">
                  <label htmlFor="broadcast-content" className="form-label">
                    Message <span aria-hidden="true" className="text-red-500">*</span>
                    <span className="sr-only">(required)</span>
                  </label>
                  <textarea
                    id="broadcast-content"
                    value={broadcastContent}
                    onChange={e => setBroadcastContent(e.target.value)}
                    placeholder="Write your message here…"
                    rows={5}
                    className="form-input resize-none"
                    required
                    aria-required="true"
                    maxLength={2000}
                  />
                  <p className="form-hint">{broadcastContent.length}/2000 characters</p>
                </div>
                <Button
                  type="submit"
                  className="gradient-teal text-white border-0 w-full gap-2"
                  disabled={broadcastMutation.isPending}
                  aria-label="Send broadcast notification"
                >
                  {broadcastMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden="true" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Bell className="w-4 h-4" aria-hidden="true" />
                      Send Notification
                    </>
                  )}
                </Button>
              </form>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
