import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, CheckCircle, Zap, Shield, TrendingUp } from "lucide-react";

const LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/logo-r1_d9d437c8.png";

const features = [
  { icon: Zap, text: "AI-powered client management & follow-ups" },
  { icon: TrendingUp, text: "Live analytics: MRR, ARR, booking trends" },
  { icon: Shield, text: "Client Pulse AI™ — detect churn before it happens" },
  { icon: CheckCircle, text: "Automated invoicing with overdue alerts" },
];

export default function Login() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      toast.success("Welcome back!");
      navigate("/dashboard");
    },
    onError: (err) => {
      toast.error(err.message || "Login failed. Please check your credentials.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    loginMutation.mutate({ email: email.trim(), password });
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#141414" }}>
      {/* Left panel — branding & features */}
      <div
        className="hidden lg:flex flex-col justify-between w-[45%] p-12 relative overflow-hidden"
        style={{ background: "#1C1C1E", borderRight: "1px solid rgba(232,160,32,0.12)" }}
      >
        {/* Subtle background grid */}
        <div className="absolute inset-0 retro-grid opacity-30 pointer-events-none" />

        {/* Logo */}
        <button
          onClick={() => navigate("/")}
          className="relative z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A020] rounded-lg self-start"
          aria-label="Go to homepage"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <img src={LOGO_URL} alt="TrueAxis HQ" className="h-10 w-auto object-contain" />
        </button>

        {/* Main copy */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2
              className="text-4xl font-extrabold leading-tight mb-4"
              style={{ fontFamily: "Space Grotesk, sans-serif", color: "#F5F0E8" }}
            >
              Your business,<br />
              <span style={{ color: "#E8A020" }}>running itself.</span>
            </h2>
            <p className="text-base leading-relaxed" style={{ color: "rgba(245,240,232,0.55)" }}>
              Join 4,200+ freelancers who automated their client work with TrueAxis HQ.
            </p>
          </div>

          <ul className="space-y-4">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "rgba(232,160,32,0.12)" }}
                >
                  <Icon className="w-4 h-4" style={{ color: "#E8A020" }} />
                </div>
                <span className="text-sm leading-relaxed" style={{ color: "rgba(245,240,232,0.70)" }}>
                  {text}
                </span>
              </li>
            ))}
          </ul>

          {/* Testimonial */}
          <div
            className="rounded-xl p-5"
            style={{ background: "rgba(232,160,32,0.06)", border: "1px solid rgba(232,160,32,0.15)" }}
          >
            <p className="text-sm italic leading-relaxed mb-3" style={{ color: "rgba(245,240,232,0.65)" }}>
              "I used to spend 3 hours every Monday on admin. Now it's zero. TrueAxis HQ paid for itself in the first week."
            </p>
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "#E8A020", color: "#141414" }}
              >
                S
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: "#F5F0E8" }}>Sarah Chen</p>
                <p className="text-xs" style={{ color: "rgba(245,240,232,0.40)" }}>Life Coach · +$2,400/mo</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="relative z-10 text-xs" style={{ color: "rgba(245,240,232,0.25)" }}>
          © 2026 TrueAxis HQ. All rights reserved.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-16">
        {/* Mobile logo */}
        <button
          onClick={() => navigate("/")}
          className="lg:hidden mb-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A020] rounded-lg"
          aria-label="Go to homepage"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <img src={LOGO_URL} alt="TrueAxis HQ" className="h-10 w-auto object-contain" />
        </button>

        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1
              className="mb-2"
              style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "1.75rem", color: "#F5F0E8" }}
            >
              Welcome back
            </h1>
            <p style={{ fontSize: "0.9rem", color: "rgba(245,240,232,0.45)" }}>
              Sign in to access your dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold mb-1.5"
                style={{ color: "rgba(245,240,232,0.70)" }}
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                autoFocus
                className="form-input"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="text-sm font-semibold"
                  style={{ color: "rgba(245,240,232,0.70)" }}
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-xs font-medium transition-colors hover:opacity-80"
                  style={{ color: "#E8A020", background: "none", border: "none", cursor: "pointer", padding: 0, minHeight: "auto", minWidth: "auto" }}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="form-input pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:opacity-80"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(245,240,232,0.35)", padding: 0, minHeight: "auto", minWidth: "auto" }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #E8A020, #F5C842)",
                color: "#141414",
                fontFamily: "Space Grotesk, sans-serif",
                fontSize: "0.9375rem",
                border: "none",
                cursor: loginMutation.isPending ? "not-allowed" : "pointer",
              }}
            >
              {loginMutation.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Signing in…</>
              ) : (
                "Sign In →"
              )}
            </button>
          </form>

          <p className="mt-6 text-sm" style={{ color: "rgba(245,240,232,0.40)" }}>
            Don't have an account?{" "}
            <button
              onClick={() => navigate("/register")}
              className="font-semibold transition-colors hover:opacity-80"
              style={{ color: "#E8A020", background: "none", border: "none", cursor: "pointer", padding: 0, minHeight: "auto", minWidth: "auto" }}
            >
              Request an invite
            </button>
          </p>

          <div className="mt-8 pt-6" style={{ borderTop: "1px solid rgba(245,240,232,0.08)" }}>
            <button
              onClick={() => navigate("/")}
              className="text-sm transition-colors hover:opacity-70 flex items-center gap-1.5"
              style={{ color: "rgba(245,240,232,0.65)", background: "none", border: "none", cursor: "pointer", minHeight: "auto", minWidth: "auto" }}
            >
              ← Back to homepage
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
