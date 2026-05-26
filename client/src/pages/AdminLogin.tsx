import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Shield, Eye, EyeOff, Loader2, Lock, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const utils = trpc.useUtils();
  const { user, loading } = useAuth();

  useEffect(() => {
    document.title = "Admin Login — TrueAxis HQ";
  }, []);

  // Already authenticated as owner — go straight to admin
  useEffect(() => {
    if (!loading && (user as any)?.isOwner) {
      navigate("/admin");
    }
  }, [loading, user, navigate]);

  const adminLogin = trpc.auth.adminLogin.useMutation({
    onSuccess: async () => {
      toast.success("Welcome back, Owner.");
      // Hard navigation ensures session cookie is fully committed before
      // the Admin page mounts and checks isOwner.
      window.location.href = "/admin";
    },
    onError: (err) => {
      toast.error(err.message ?? "Login failed.");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    adminLogin.mutate({ email: email.trim(), password });
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #0D1117 50%, #1a1a1a 100%)" }}
    >
      {/* Back to site */}
      <a
        href="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to site
      </a>

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-xl p-8 space-y-6"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(232,160,32,0.15)", border: "1px solid rgba(232,160,32,0.3)" }}
          >
            <Shield className="w-6 h-6 text-[#D4922A]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Admin Access</h1>
            <p className="text-sm text-gray-500 mt-1">Owner credentials required</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@example.com"
              required
              autoComplete="email"
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(232,160,32,0.5)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 pr-11 rounded-xl text-sm text-white placeholder-gray-600 outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(232,160,32,0.5)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={adminLogin.isPending || !email.trim() || !password}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #D4922A 0%, #d4901a 100%)" }}
          >
            {adminLogin.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Sign In to Admin
              </>
            )}
          </button>
        </form>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-600">
          This page is restricted to the site owner only.
          <br />
          All access attempts are logged.
        </p>
      </div>
    </div>
  );
}
