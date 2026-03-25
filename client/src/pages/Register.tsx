import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, KeyRound, ArrowLeft } from "lucide-react";

const LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/logo-r1_d9d437c8.png";

export default function Register() {
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
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
          Create your account
        </h1>
        <p className="text-center mb-8" style={{ fontSize: "0.9rem", color: "rgba(245,240,232,0.45)" }}>
          An invite code is required to register
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Invite Code */}
          <div>
            <label
              htmlFor="inviteCode"
              className="flex items-center gap-1.5 text-sm font-semibold mb-1.5"
              style={{ color: "rgba(245,240,232,0.70)" }}
            >
              <KeyRound size={13} style={{ color: "#E8A020" }} />
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
              style={{ color: "rgba(245,240,232,0.70)" }}
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
              className="form-input"
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold mb-1.5"
              style={{ color: "rgba(245,240,232,0.70)" }}
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
                style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(245,240,232,0.35)", padding: 0, minHeight: "auto", minWidth: "auto" }}
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
              style={{ color: "rgba(245,240,232,0.70)" }}
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
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg, #E8A020, #F5C842)",
              color: "#141414",
              fontFamily: "Space Grotesk, sans-serif",
              fontSize: "0.9375rem",
              border: "none",
              cursor: isSubmitDisabled ? "not-allowed" : "pointer",
            }}
          >
            {registerMutation.isPending ? (
              <><Loader2 size={16} className="animate-spin" /> Creating account…</>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <p className="text-center mt-6 text-sm" style={{ color: "rgba(245,240,232,0.40)" }}>
          Already have an account?{" "}
          <button
            onClick={() => navigate("/login")}
            className="font-semibold transition-colors hover:opacity-80"
            style={{ color: "#E8A020", background: "none", border: "none", cursor: "pointer", padding: 0, minHeight: "auto", minWidth: "auto" }}
          >
            Sign in
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
