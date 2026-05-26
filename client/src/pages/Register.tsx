import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, KeyRound, CheckCircle, Users, Star, Lock } from "lucide-react";

const LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/logo-r1_d9d437c8.png";

const perks = [
  { icon: Star, text: "14-day free trial — no credit card required" },
  { icon: Users, text: "Join 4,200+ freelancers already on the platform" },
  { icon: CheckCircle, text: "Full access to all features from day one" },
  { icon: Lock, text: "Your data is yours. We never sell it." },
];

export default function Register() {
  const [, navigate] = useLocation();
  useEffect(() => { document.title = "Create Account — TrueAxis HQ"; }, []);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const utils = trpc.useUtils();

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      // Immediately populate the auth.me cache so Dashboard sees an authenticated user
      // before the page even renders — prevents the stale-cache redirect loop
      if (data.user) {
        utils.auth.me.setData(undefined, data.user as any);
      }
      toast.success("Account created! Welcome to TrueAxis HQ.");
      navigate("/dashboard");
    },
    onError: (err) => {
      toast.error(err.message || "Registration failed. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (!inviteCode.trim()) {
      toast.error("An invite code is required to register.");
      return;
    }
    registerMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      password,
      inviteCode: inviteCode.trim(),
    });
  };

  const isSubmitDisabled =
    registerMutation.isPending ||
    !name ||
    !email ||
    !password ||
    !confirmPassword ||
    !inviteCode ||
    password !== confirmPassword;

  const passwordMismatch = confirmPassword.length > 0 && confirmPassword !== password;

  return (
    <div className="min-h-screen flex" style={{ background: "#161B22" }}>
      {/* Left panel — branding & perks */}
      <div
        className="hidden lg:flex flex-col justify-between w-[45%] p-12 relative overflow-hidden"
        style={{ background: "#1C2333", borderRight: "1px solid rgba(232,160,32,0.12)" }}
      >
        {/* Subtle background grid */}
        <div className="absolute inset-0 retro-grid opacity-30 pointer-events-none" />

        {/* Logo */}
        <button
          onClick={() => navigate("/")}
          className="relative z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4922A] rounded-lg self-start"
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
              style={{ fontFamily: "Inter, sans-serif", color: "#F5F0E8" }}
            >
              Start your free<br />
              <span style={{ color: "#D4922A" }}>14-day trial.</span>
            </h2>
            <p className="text-base leading-relaxed" style={{ color: "rgba(245,240,232,0.80)" }}>
              Everything you need to run your freelance business — in one place.
            </p>
          </div>

          <ul className="space-y-4">
            {perks.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "rgba(232,160,32,0.12)" }}
                >
                  <Icon className="w-4 h-4" style={{ color: "#D4922A" }} />
                </div>
                <span className="text-sm leading-relaxed" style={{ color: "rgba(245,240,232,0.88)" }}>
                  {text}
                </span>
              </li>
            ))}
          </ul>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: "4,200+", label: "Active users" },
              { value: "12 hrs", label: "Saved/week" },
              { value: "34%", label: "Revenue lift" },
            ].map(({ value, label }) => (
              <div
                key={label}
                className="rounded-xl p-4 text-center"
                style={{ background: "rgba(232,160,32,0.06)", border: "1px solid rgba(232,160,32,0.12)" }}
              >
                <p className="text-lg font-extrabold mb-0.5" style={{ color: "#D4922A", fontFamily: "Inter, sans-serif" }}>
                  {value}
                </p>
                <p className="text-xs" style={{ color: "rgba(245,240,232,0.70)" }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <p className="relative z-10 text-xs" style={{ color: "rgba(245,240,232,0.50)" }}>
          © 2026 TrueAxis HQ. All rights reserved.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-16 overflow-y-auto page-bottom">
        {/* Mobile logo */}
        <button
          onClick={() => navigate("/")}
          className="lg:hidden mb-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4922A] rounded-lg"
          aria-label="Go to homepage"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <img src={LOGO_URL} alt="TrueAxis HQ" className="h-10 w-auto object-contain" />
        </button>

        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1
              className="mb-2"
              style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "1.75rem", color: "#F5F0E8" }}
            >
              Create your account
            </h1>
            <p style={{ fontSize: "0.9rem", color: "rgba(245,240,232,0.75)" }}>
              An invite code is required to get started
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Invite Code */}
            <div>
              <label
                htmlFor="inviteCode"
                className="flex items-center gap-1.5 text-sm font-semibold mb-1.5"
                style={{ color: "rgba(245,240,232,0.90)" }}
              >
                <KeyRound size={13} style={{ color: "#D4922A" }} />
                Invite Code
              </label>
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX"
                required
                autoComplete="off"
                spellCheck={false}
                autoFocus
                className="form-input font-mono tracking-widest uppercase"
              />
            </div>

            {/* Full Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-semibold mb-1.5"
                style={{ color: "rgba(245,240,232,0.90)" }}
              >
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                required
                autoComplete="name"
                className="form-input"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold mb-1.5"
                style={{ color: "rgba(245,240,232,0.90)" }}
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
                className="form-input"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold mb-1.5"
                style={{ color: "rgba(245,240,232,0.90)" }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  autoComplete="new-password"
                  className="form-input pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:opacity-80"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(245,240,232,0.60)", padding: 0, minHeight: "auto", minWidth: "auto" }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-semibold mb-1.5"
                style={{ color: "rgba(245,240,232,0.90)" }}
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
                autoComplete="new-password"
                className="form-input"
                style={passwordMismatch ? { borderColor: "rgba(239,68,68,0.55)", boxShadow: "0 0 0 3px rgba(239,68,68,0.10)" } : {}}
              />
              {passwordMismatch && (
                <p className="text-xs mt-1" style={{ color: "#ef4444" }}>Passwords do not match</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-opacity disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              style={{
                background: "linear-gradient(135deg, #D4922A, #F5C842)",
                color: "#161B22",
                fontFamily: "Inter, sans-serif",
                fontSize: "0.9375rem",
                border: "none",
                cursor: isSubmitDisabled ? "not-allowed" : "pointer",
              }}
            >
              {registerMutation.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Creating account…</>
              ) : (
                "Create Account →"
              )}
            </button>
          </form>

          <p className="mt-6 text-sm" style={{ color: "rgba(245,240,232,0.88)" }}>
            Already have an account?{" "}
            <button
              onClick={() => navigate("/login")}
              className="font-semibold transition-colors hover:opacity-80"
              style={{ color: "#D4922A", background: "none", border: "none", cursor: "pointer", padding: 0, minHeight: "auto", minWidth: "auto" }}
            >
              Sign in
            </button>
          </p>

          <div className="mt-8 pt-6" style={{ borderTop: "1px solid rgba(245,240,232,0.08)" }}>
            <button
              onClick={() => navigate("/")}
              className="text-sm font-medium transition-all hover:opacity-90 flex items-center gap-1.5 px-3 py-2 rounded-lg"
              style={{ color: "rgba(245,240,232,0.85)", background: "rgba(245,240,232,0.06)", border: "1px solid rgba(245,240,232,0.15)", cursor: "pointer", minHeight: "auto", minWidth: "auto" }}
            >
              ← Back to homepage
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
