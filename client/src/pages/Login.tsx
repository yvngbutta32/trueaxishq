import { TRUEAXIS_LOGO_URL } from "@shared/const";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, CheckCircle, Zap, Shield, TrendingUp } from "lucide-react";



const features = [
  { icon: Zap, text: "AI-powered client management & follow-ups" },
  { icon: TrendingUp, text: "Analytics workspace for revenue and booking context" },
  { icon: Shield, text: "Client Pulse AI™ — owner-reviewed relationship signals" },
  { icon: CheckCircle, text: "Invoice and overdue-status workspace" },
];

export default function Login() {
  const [, navigate] = useLocation();
  useEffect(() => { document.title = "Sign In — TrueAxis HQ"; }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [mode, setMode] = useState<"password" | "sms">("password");
  const [phone, setPhone] = useState("");
  const [smsCodeSent, setSmsCodeSent] = useState(false);
  const [smsCode, setSmsCode] = useState("");
  const [smsNeedsTwoFactor, setSmsNeedsTwoFactor] = useState(false);
  const utils = trpc.useUtils();

  // SMS login is only offered when Twilio is actually configured.
  const smsStatus = trpc.sms.status.useQuery();
  const smsAvailable = smsStatus.data?.configured === true;

  const smsRequestMutation = trpc.auth.smsRequest.useMutation({
    onSuccess: () => {
      setSmsCodeSent(true);
      toast.success("Code sent — check your phone.");
    },
    onError: (err) => {
      if (err.message === "SMS_LOGIN_NOT_CONFIGURED") {
        toast.error("SMS sign-in isn't active yet. Use your email and password.");
        setMode("password");
        return;
      }
      toast.error(err.message || "We couldn't send the code right now.");
    },
  });

  const smsVerifyMutation = trpc.auth.smsVerify.useMutation({
    onSuccess: (data) => {
      if (data.user) utils.auth.me.setData(undefined, data.user as any);
      toast.success("Welcome back!");
      navigate("/dashboard");
    },
    onError: (err) => {
      if (err.message === "TWO_FACTOR_CODE_REQUIRED") {
        setSmsNeedsTwoFactor(true);
        toast.info("Enter the 6-digit code from your authenticator app.");
        return;
      }
      toast.error(err.message || "That code didn't work. Please try again.");
    },
  });

  const handleSmsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsCodeSent) {
      if (phone.trim().length < 7) return;
      smsRequestMutation.mutate({ phone: phone.trim() });
      return;
    }
    if (!/^\d{6}$/.test(smsCode)) return;
    smsVerifyMutation.mutate({
      phone: phone.trim(),
      code: smsCode,
      twoFactorCode: smsNeedsTwoFactor && twoFactorCode.trim() ? twoFactorCode.trim() : undefined,
    });
  };

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      // Immediately populate the auth.me cache so Dashboard sees an authenticated user
      // before the page even renders — prevents the stale-cache redirect loop
      if (data.user) {
        utils.auth.me.setData(undefined, data.user as any);
      }
      toast.success("Welcome back!");
      navigate("/dashboard");
    },
    onError: (err) => {
      if (err.message === "TWO_FACTOR_CODE_REQUIRED") {
        setNeedsTwoFactor(true);
        toast.info("Enter the 6-digit code from your authenticator app.");
        return;
      }
      toast.error(err.message || "Login failed. Please check your credentials.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    if (needsTwoFactor && !twoFactorCode.trim()) return;
    loginMutation.mutate({
      email: email.trim(),
      password,
      twoFactorCode: needsTwoFactor ? twoFactorCode.trim() : undefined,
    });
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#F2F0EC" }}>
      {/* Left panel — branding & features */}
      <div
        className="hidden lg:flex flex-col justify-between w-[45%] p-12 relative overflow-hidden"
        style={{ background: "#EEECEA", borderRight: "1px solid rgba(232,160,32,0.12)" }}
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
          <img src={TRUEAXIS_LOGO_URL} alt="TrueAxis HQ" className="h-10 w-auto object-contain" />
        </button>

        {/* Main copy */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2
              className="text-4xl font-extrabold leading-tight mb-4"
              style={{ color: "#1A1A1A" }}
            >
              Your business,<br />
              <span style={{ color: "#D4922A" }}>moving with clarity.</span>
            </h2>
            <p className="text-base leading-relaxed" style={{ color: "rgba(26,26,26,0.75)" }}>
              Bring client intake, scheduling, billing, job progress, and follow-ups into one focused workspace.
            </p>
          </div>

          <ul className="space-y-4">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "rgba(232,160,32,0.12)" }}
                >
                  <Icon className="w-4 h-4" style={{ color: "#D4922A" }} />
                </div>
                <span className="text-sm leading-relaxed" style={{ color: "rgba(26,26,26,0.80)" }}>
                  {text}
                </span>
              </li>
            ))}
          </ul>

          <div
            className="rounded-xl p-5"
            style={{ background: "rgba(232,160,32,0.06)", border: "1px solid rgba(232,160,32,0.15)" }}
          >
            <p className="text-sm font-semibold leading-relaxed" style={{ color: "rgba(26,26,26,0.85)" }}>
              Built for the operational handoffs that keep service work moving.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "#D4922A", color: "#161B22" }}
              >
                ✓
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: "#1A1A1A" }}>Clear client handoffs</p>
                <p className="text-xs" style={{ color: "rgba(26,26,26,0.65)" }}>Bookings, proof, payments, and next steps in context.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer note */}
          <p className="relative z-10 text-xs" style={{ color: "rgba(26,26,26,0.50)" }}>
          © 2026 TrueAxis HQ. All rights reserved.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-16 page-bottom">
        {/* Mobile logo */}
        <button
          onClick={() => navigate("/")}
          className="lg:hidden mb-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4922A] rounded-lg"
          aria-label="Go to homepage"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <img src={TRUEAXIS_LOGO_URL} alt="TrueAxis HQ" className="h-10 w-auto object-contain" />
        </button>

        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1
              className="mb-2"
              style={{ fontWeight: 700, fontSize: "1.75rem", color: "#1A1A1A" }}
            >
              Welcome back
            </h1>
            <p style={{ fontSize: "0.9rem", color: "rgba(26,26,26,0.65)" }}>
              Sign in to access your dashboard
            </p>
          </div>

          {smsAvailable && (
            <div className="mb-6 flex rounded-xl" style={{ background: "rgba(26,26,26,0.05)" }} role="tablist" aria-label="Sign-in method">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "password"}
                onClick={() => setMode("password")}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={mode === "password"
                  ? { background: "#1A1A1A", color: "#F2F0EC", border: "none", cursor: "pointer", minHeight: "auto", minWidth: "auto" }
                  : { background: "none", color: "rgba(26,26,26,0.65)", border: "none", cursor: "pointer", minHeight: "auto", minWidth: "auto" }}
              >
                Password
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "sms"}
                onClick={() => { setMode("sms"); setSmsCodeSent(false); setSmsCode(""); setSmsNeedsTwoFactor(false); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={mode === "sms"
                  ? { background: "#1A1A1A", color: "#F2F0EC", border: "none", cursor: "pointer", minHeight: "auto", minWidth: "auto" }
                  : { background: "none", color: "rgba(26,26,26,0.65)", border: "none", cursor: "pointer", minHeight: "auto", minWidth: "auto" }}
              >
                Text me a code
              </button>
            </div>
          )}

          {mode === "sms" ? (
          <form onSubmit={handleSmsSubmit} className="space-y-5">
            {/* Phone */}
            <div>
              <label
                htmlFor="login-phone"
                className="block text-sm font-semibold mb-1.5"
                style={{ color: "rgba(26,26,26,0.85)" }}
              >
                Phone number
              </label>
              <input
                id="login-phone"
                type="tel"
                maxLength={32}
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setSmsCodeSent(false); }}
                placeholder="+1 512 555 0100"
                required
                autoComplete="tel"
                autoFocus
                disabled={smsCodeSent}
                className="form-input"
              />
              {smsCodeSent && (
                <button
                  type="button"
                  onClick={() => { setSmsCodeSent(false); setSmsCode(""); }}
                  className="mt-1.5 text-xs font-medium"
                  style={{ color: "#D4922A", background: "none", border: "none", cursor: "pointer", padding: 0, minHeight: "auto", minWidth: "auto" }}
                >
                  Use a different number
                </button>
              )}
            </div>

            {/* Code */}
            {smsCodeSent && (
              <div>
                <label
                  htmlFor="sms-code"
                  className="text-sm font-semibold block mb-1.5"
                  style={{ color: "rgba(26,26,26,0.85)" }}
                >
                  6-digit code
                </label>
                <input
                  id="sms-code"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                  autoComplete="one-time-code"
                  className="form-input tracking-[0.35em] text-center"
                />
                <p className="text-xs mt-1.5" style={{ color: "rgba(26,26,26,0.55)" }}>
                  Expires in 10 minutes. Didn't get it?{" "}
                  <button
                    type="button"
                    onClick={() => smsRequestMutation.mutate({ phone: phone.trim() })}
                    disabled={smsRequestMutation.isPending}
                    className="font-medium"
                    style={{ color: "#D4922A", background: "none", border: "none", cursor: smsRequestMutation.isPending ? "not-allowed" : "pointer", padding: 0, minHeight: "auto", minWidth: "auto" }}
                  >
                    Resend
                  </button>
                </p>
              </div>
            )}

            {/* 2FA after SMS code (only when the server asks) */}
            {smsNeedsTwoFactor && (
              <div>
                <label
                  htmlFor="sms-twoFactorCode"
                  className="text-sm font-semibold block mb-1.5"
                  style={{ color: "rgba(26,26,26,0.85)" }}
                >
                  Authenticator code
                </label>
                <input
                  id="sms-twoFactorCode"
                  type="text"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.toUpperCase())}
                  placeholder="123456 or backup code"
                  maxLength={14}
                  autoFocus
                  autoComplete="one-time-code"
                  className="form-input tracking-[0.15em] text-center"
                />
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              aria-label={smsCodeSent ? (smsVerifyMutation.isPending ? "Verifying" : "Verify and sign in") : (smsRequestMutation.isPending ? "Sending code" : "Send code")}
              disabled={smsVerifyMutation.isPending || smsRequestMutation.isPending || (smsCodeSent && !/^\d{6}$/.test(smsCode))}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #D4922A, #F5C842)",
                color: "#161B22", fontSize: "0.9375rem",
                border: "none",
                cursor: "pointer",
              }}
            >
              {(smsRequestMutation.isPending || smsVerifyMutation.isPending) ? (
                <><Loader2 size={16} className="animate-spin" /> {smsCodeSent ? "Verifying…" : "Sending…"}</>
              ) : smsCodeSent ? (
                "Verify & Sign In →"
              ) : (
                "Send Code →"
              )}
            </button>
          </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold mb-1.5"
                style={{ color: "rgba(26,26,26,0.85)" }}
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                  maxLength={320}
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
                  style={{ color: "rgba(26,26,26,0.85)" }}
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-xs font-medium transition-colors hover:opacity-80"
                  style={{ color: "#D4922A", background: "none", border: "none", cursor: "pointer", padding: 0, minHeight: "auto", minWidth: "auto" }}
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
                  style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(26,26,26,0.60)", padding: 0, minHeight: "auto", minWidth: "auto" }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Two-factor code (shown only after the server asks for it) */}
            {needsTwoFactor && (
              <div>
                <label
                  htmlFor="twoFactorCode"
                  className="text-sm font-semibold block mb-1.5"
                  style={{ color: "rgba(26,26,26,0.85)" }}
                >
                  Authenticator code
                </label>
                <input
                  id="twoFactorCode"
                  type="text"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.toUpperCase())}
                  placeholder="123456 or backup code"
                  maxLength={14}
                  autoFocus
                  autoComplete="one-time-code"
                  className="form-input tracking-[0.15em] text-center"
                />
                <p className="text-xs mt-1.5" style={{ color: "rgba(26,26,26,0.55)" }}>
                  Lost your phone? Enter one of your saved backup codes instead (letters and dashes).
                </p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              aria-label={loginMutation.isPending ? "Signing in" : "Sign in"}
              disabled={loginMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #D4922A, #F5C842)",
                color: "#161B22", fontSize: "0.9375rem",
                border: "none",
                cursor: loginMutation.isPending ? "not-allowed" : "pointer",
              }}
            >
              {loginMutation.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Signing in…</>
              ) : needsTwoFactor ? (
                "Verify & Sign In →"
              ) : (
                "Sign In →"
              )}
            </button>
          </form>
          )}

          <p className="mt-6 text-sm" style={{ color: "rgba(26,26,26,0.80)" }}>
            Don't have an account?{" "}
            <button
              onClick={() => navigate("/register")}
              className="font-semibold transition-colors hover:opacity-80"
              style={{ color: "#D4922A", background: "none", border: "none", cursor: "pointer", padding: 0, minHeight: "auto", minWidth: "auto" }}
            >
              Request an invite
            </button>
          </p>

          <div className="mt-8 pt-6" style={{ borderTop: "1px solid rgba(26,26,26,0.08)" }}>
            <button
              onClick={() => navigate("/")}
              className="text-sm font-medium transition-all hover:opacity-90 flex items-center gap-1.5 px-3 py-2 rounded-lg"
              style={{ color: "rgba(26,26,26,0.85)", background: "rgba(26,26,26,0.05)", border: "1px solid rgba(26,26,26,0.12)", cursor: "pointer", minHeight: "auto", minWidth: "auto" }}
            >
              ← Back to homepage
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
