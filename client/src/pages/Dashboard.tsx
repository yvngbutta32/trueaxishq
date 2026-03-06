/* SkillBridge AI — Dashboard Page
 * Design: "Kinetic Warmth" — Dark sidebar (#1C1C1E), Teal accents (#00C9A7), Coral highlights (#FF6B6B)
 * Fonts: Sora (headings) + Inter (body)
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  LayoutDashboard, Users, Calendar, FileText, Mail,
  BarChart3, Settings, Zap, Bell, Search, Plus,
  TrendingUp, DollarSign, Clock, CheckCircle,
  ArrowUpRight, MoreHorizontal, ChevronRight, LogOut
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from "recharts";

// ─── Mock Data ───────────────────────────────────────────────────────────────
const revenueData = [
  { month: "Sep", revenue: 3200 },
  { month: "Oct", revenue: 4100 },
  { month: "Nov", revenue: 3800 },
  { month: "Dec", revenue: 5200 },
  { month: "Jan", revenue: 4900 },
  { month: "Feb", revenue: 6800 },
  { month: "Mar", revenue: 8420 },
];

const bookingsData = [
  { day: "Mon", bookings: 4 },
  { day: "Tue", bookings: 7 },
  { day: "Wed", bookings: 5 },
  { day: "Thu", bookings: 9 },
  { day: "Fri", bookings: 6 },
  { day: "Sat", bookings: 2 },
  { day: "Sun", bookings: 1 },
];

const recentClients = [
  { name: "Alex Thompson", service: "Business Coaching", amount: "$350", status: "paid", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop", time: "2h ago" },
  { name: "Maria Garcia", service: "Brand Consulting", amount: "$520", status: "pending", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop", time: "4h ago" },
  { name: "James Kim", service: "SEO Strategy", amount: "$280", status: "paid", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop", time: "Yesterday" },
  { name: "Priya Sharma", service: "Life Coaching", amount: "$420", status: "overdue", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=40&h=40&fit=crop", time: "2 days ago" },
];

const upcomingBookings = [
  { client: "Sarah Lee", service: "Strategy Session", time: "Today, 2:00 PM", duration: "60 min" },
  { client: "Tom Rivera", service: "Brand Review", time: "Today, 4:30 PM", duration: "45 min" },
  { client: "Emma Wilson", service: "Coaching Call", time: "Tomorrow, 10:00 AM", duration: "60 min" },
  { client: "David Park", service: "Consulting", time: "Tomorrow, 2:00 PM", duration: "90 min" },
];

// ─── Sidebar ─────────────────────────────────────────────────────────────────
const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: Users, label: "Clients" },
  { icon: Calendar, label: "Scheduling" },
  { icon: FileText, label: "Invoices" },
  { icon: Mail, label: "Follow-Ups" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Settings, label: "Settings" },
];

function Sidebar({ collapsed, setCollapsed }: { collapsed: boolean; setCollapsed: (v: boolean) => void }) {
  const [, navigate] = useLocation();

  return (
    <aside className={`fixed left-0 top-0 h-full bg-[#1C1C1E] flex flex-col transition-all duration-300 z-40 ${collapsed ? "w-16" : "w-60"}`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg gradient-teal flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="font-bold text-white text-sm" style={{ fontFamily: 'Sora, sans-serif' }}>
            SkillBridge <span className="text-[#00C9A7]">AI</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => !item.active && toast.info(`${item.label} — coming soon!`)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              item.active
                ? "bg-[#00C9A7]/15 text-[#00C9A7]"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
            {!collapsed && item.active && <ChevronRight className="w-3 h-3 ml-auto" />}
          </button>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-white/10 space-y-2">
        {!collapsed && (
          <div className="bg-[#00C9A7]/10 border border-[#00C9A7]/20 rounded-xl p-3">
            <p className="text-xs font-semibold text-[#00C9A7] mb-1">Pro Trial</p>
            <p className="text-xs text-gray-400">11 days remaining</p>
            <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-[#00C9A7] rounded-full" style={{ width: "79%" }} />
            </div>
          </div>
        )}
        <button
          onClick={() => navigate("/")}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Back to Site</span>}
        </button>
      </div>
    </aside>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ title, value, change, icon: Icon, color }: {
  title: string; value: string; change: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 card-lift">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: color }}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center gap-1">
          <ArrowUpRight className="w-3 h-3" />
          {change}
        </span>
      </div>
      <p className="text-2xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: 'Sora, sans-serif' }}>{value}</p>
      <p className="text-sm text-gray-500 mt-1">{title}</p>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${collapsed ? "ml-16" : "ml-60"}`}>
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <LayoutDashboard className="w-4 h-4 text-gray-500" />
            </button>
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search clients, invoices..."
                className="pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl w-64 focus:outline-none focus:border-[#00C9A7] transition-colors"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors"
              onClick={() => toast.info("Notifications — coming soon!")}
            >
              <Bell className="w-4 h-4 text-gray-500" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FF6B6B] rounded-full" />
            </button>
            <Button
              size="sm"
              className="gradient-teal text-white border-0 hover:opacity-90 gap-1.5"
              onClick={() => toast.success("New client intake form created!")}
            >
              <Plus className="w-3.5 h-3.5" />
              New Client
            </Button>
            <img
              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop"
              alt="User"
              className="w-8 h-8 rounded-full object-cover border-2 border-[#00C9A7]/30 cursor-pointer"
              onClick={() => toast.info("Profile settings — coming soon!")}
            />
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-6 space-y-6">
          {/* Welcome */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-[#1C1C1E]" style={{ fontFamily: 'Sora, sans-serif' }}>
                Good morning, Alex 👋
              </h1>
              <p className="text-sm text-gray-500 mt-1">Here's what's happening with your business today.</p>
            </div>
            <Badge className="bg-[#00C9A7]/10 text-[#00C9A7] border border-[#00C9A7]/20 text-xs px-3 py-1">
              Pro Trial — 11 days left
            </Badge>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Revenue This Month" value="$8,420" change="+23%" icon={DollarSign} color="#00C9A7" />
            <StatCard title="Active Clients" value="34" change="+8%" icon={Users} color="#FF6B6B" />
            <StatCard title="Bookings This Week" value="12" change="+15%" icon={Calendar} color="#00C9A7" />
            <StatCard title="Hours Saved" value="14 hrs" change="+5%" icon={Clock} color="#FF6B6B" />
          </div>

          {/* Charts Row */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Revenue Chart */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-gray-100">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-[#1C1C1E] text-sm" style={{ fontFamily: 'Sora, sans-serif' }}>Revenue Trend</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Last 7 months</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                  <TrendingUp className="w-3 h-3" />
                  +163% YTD
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="tealGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00C9A7" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#00C9A7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '12px' }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#00C9A7" strokeWidth={2.5} fill="url(#tealGradient)" dot={{ fill: '#00C9A7', strokeWidth: 0, r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Bookings Chart */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <div className="mb-5">
                <h3 className="font-bold text-[#1C1C1E] text-sm" style={{ fontFamily: 'Sora, sans-serif' }}>Bookings This Week</h3>
                <p className="text-xs text-gray-400 mt-0.5">34 total bookings</p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={bookingsData} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '12px' }}
                    formatter={(value: number) => [value, 'Bookings']}
                  />
                  <Bar dataKey="bookings" fill="#FF6B6B" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Recent Clients */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-[#1C1C1E] text-sm" style={{ fontFamily: 'Sora, sans-serif' }}>Recent Clients</h3>
                <button className="text-xs text-[#00C9A7] font-medium hover:underline" onClick={() => toast.info("Client list — coming soon!")}>View all</button>
              </div>
              <div className="space-y-3">
                {recentClients.map((client, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => toast.info(`${client.name}'s profile — coming soon!`)}>
                    <img src={client.avatar} alt={client.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1C1C1E] truncate">{client.name}</p>
                      <p className="text-xs text-gray-400 truncate">{client.service}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-[#1C1C1E]">{client.amount}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        client.status === 'paid' ? 'bg-green-50 text-green-600' :
                        client.status === 'pending' ? 'bg-yellow-50 text-yellow-600' :
                        'bg-red-50 text-red-500'
                      }`}>
                        {client.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming Bookings */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-[#1C1C1E] text-sm" style={{ fontFamily: 'Sora, sans-serif' }}>Upcoming Bookings</h3>
                <button className="text-xs text-[#00C9A7] font-medium hover:underline" onClick={() => toast.info("Full calendar — coming soon!")}>View calendar</button>
              </div>
              <div className="space-y-3">
                {upcomingBookings.map((booking, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => toast.info(`${booking.client}'s booking — coming soon!`)}>
                    <div className="w-9 h-9 rounded-xl bg-[#00C9A7]/10 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-[#00C9A7]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1C1C1E] truncate">{booking.client}</p>
                      <p className="text-xs text-gray-400 truncate">{booking.service}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-medium text-[#1C1C1E]">{booking.time}</p>
                      <p className="text-xs text-gray-400">{booking.duration}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* AI Suggestions Banner */}
          <div className="bg-gradient-to-r from-[#1C1C1E] to-[#1A2E2A] rounded-2xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#00C9A7]/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-[#00C9A7]" />
              </div>
              <div>
                <p className="text-sm font-bold text-white" style={{ fontFamily: 'Sora, sans-serif' }}>AI Insight: 3 leads haven't heard from you in 7+ days</p>
                <p className="text-xs text-gray-400 mt-0.5">Send an automated follow-up to recover potential $1,240 in revenue.</p>
              </div>
            </div>
            <Button
              size="sm"
              className="gradient-teal text-white border-0 hover:opacity-90 flex-shrink-0"
              onClick={() => toast.success("Follow-up emails sent to 3 leads!")}
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
              Send Now
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
