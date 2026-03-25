import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";

const LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/logo-r1_d9d437c8.png";

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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: "#141414" }}>
      {/* Logo */}
      <button
        onClick={() => navigate("/")}
        className="mb-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A020] rounded-lg"
        aria-label="Go to homepage"
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        <img src={LOGO_URL} alt="TrueAxis HQ" className="h-12 w-auto object-contain" />
      </button>

      {/* Card */}
      <div
        className="w-full max-w-md rounded-2xl p-8 sm:p-10"
        style={{ background: "#1C1C1E", border: "1px solid rgba(232,160,32,0.15)" }}
      >
        <h1
          className="text-center mb-2"
          style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "1.625rem", color: "#F5F0E8" }}
        >
          Sign in to TrueAxis HQ
        </h1>
        <p className="text-center mb-8" style={{ fontSize: "0.9rem", color: "rgba(245,240,232,0.45)" }}>
          Enter your credentials to access your dashboard
        </p>

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
            disabled={loginMutation.isPending || !email || !password}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
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
              "Sign In"
            )}
          </button>
        </form>

        <p className="text-center mt-6 text-sm" style={{ color: "rgba(245,240,232,0.40)" }}>
          Don't have an account?{" "}
          <button
            onClick={() => navigate("/register")}
            className="font-semibold transition-colors hover:opacity-80"
            style={{ color: "#E8A020", background: "none", border: "none", cursor: "pointer", padding: 0, minHeight: "auto", minWidth: "auto" }}
          >
            Create one
          </button>
        </p>
      </div>

      {/* Back link */}
      <button
        onClick={() => navigate("/")}
        className="mt-6 flex items-center gap-1.5 text-sm transition-colors hover:opacity-70"
        style={{ color: "rgba(245,240,232,0.30)", background: "none", border: "none", cursor: "pointer", minHeight: "auto", minWidth: "auto" }}
      >
        <ArrowLeft size={14} />
        Back to homepage
      </button>
    </div>
  );
}
