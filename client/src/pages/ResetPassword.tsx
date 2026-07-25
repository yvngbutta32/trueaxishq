import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowLeft, ShieldCheck } from "lucide-react";

const LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/logo-r1_d9d437c8.png";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    setToken(t);
  }, []);

  const resetMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setDone(true);
      toast.success("Password reset successfully!");
    },
    onError: (err) => {
      toast.error(err.message || "Reset failed. Please request a new link.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error("Invalid reset link. Please request a new one.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    resetMutation.mutate({ token, newPassword });
  };

  const isDisabled =
    resetMutation.isPending ||
    !newPassword ||
    !confirmPassword ||
    newPassword !== confirmPassword ||
    newPassword.length < 8;

  const passwordMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: "#F2F0EC" }}>
      {/* Logo */}
      <button
        onClick={() => navigate("/")}
        className="mb-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4922A] rounded-lg"
        aria-label="Go to homepage"
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        <img src={LOGO_URL} alt="TrueAxis HQ" className="h-12 w-auto object-contain" />
      </button>

      {/* Card */}
      <div
        className="w-full max-w-md rounded-xl p-8 sm:p-10"
        style={{ background: "#F2F0EC", border: "1px solid rgba(232,160,32,0.15)" }}
      >
        {/* No token */}
        {!token ? (
          <div className="text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.20)" }}
            >
              <AlertCircle size={26} style={{ color: "#ef4444" }} />
            </div>
            <h1
              className="mb-3"
              style={{ fontWeight: 700, fontSize: "1.5rem", color: "#1A1A1A" }}
            >
              Invalid reset link
            </h1>
            <p className="mb-8 leading-relaxed" style={{ fontSize: "0.9rem", color: "rgba(26,26,26,0.50)" }}>
              This link is missing a reset token. Please request a new password reset.
            </p>
            <button
              onClick={() => navigate("/forgot-password")}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
              style={{
                background: "linear-gradient(135deg, #D4922A, #F5C842)",
                color: "#0D1117",
                fontSize: "0.9375rem",
                border: "none",
                cursor: "pointer",
              }}
            >
              Request New Link
            </button>
          </div>
        ) : done ? (
          /* Success state */
          <div className="text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: "rgba(232,160,32,0.10)", border: "1px solid rgba(232,160,32,0.20)" }}
            >
              <CheckCircle2 size={32} style={{ color: "#D4922A" }} />
            </div>
            <h1
              className="mb-3"
              style={{ fontWeight: 700, fontSize: "1.5rem", color: "#1A1A1A" }}
            >
              Password updated!
            </h1>
            <p className="mb-8 leading-relaxed" style={{ fontSize: "0.9rem", color: "rgba(26,26,26,0.55)" }}>
              Your password has been changed successfully. You can now sign in with your new password.
            </p>
            <button
              onClick={() => navigate("/login")}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
              style={{
                background: "linear-gradient(135deg, #D4922A, #F5C842)",
                color: "#0D1117",
                fontSize: "0.9375rem",
                border: "none",
                cursor: "pointer",
              }}
            >
              Sign In
            </button>
          </div>
        ) : (
          /* Reset form */
          <>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: "rgba(232,160,32,0.10)", border: "1px solid rgba(232,160,32,0.20)" }}
            >
              <ShieldCheck size={24} style={{ color: "#D4922A" }} />
            </div>
            <h1
              className="text-center mb-2"
              style={{ fontWeight: 700, fontSize: "1.625rem", color: "#1A1A1A" }}
            >
              Set new password
            </h1>
            <p className="text-center mb-8" style={{ fontSize: "0.9rem", color: "rgba(26,26,26,0.75)" }}>
              Choose a strong password for your account
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* New Password */}
              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-semibold mb-1.5"
                  style={{ color: "rgba(26,26,26,0.70)" }}
                >
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    autoFocus
                    autoComplete="new-password"
                    className="form-input pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:opacity-80"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(26,26,26,0.65)", padding: 0, minHeight: "auto", minWidth: "auto" }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {newPassword && newPassword.length < 8 && (
                  <p className="text-xs mt-1" style={{ color: "#ef4444" }}>
                    Password must be at least 8 characters
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-semibold mb-1.5"
                  style={{ color: "rgba(26,26,26,0.70)" }}
                >
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
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
                disabled={isDisabled}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "linear-gradient(135deg, #D4922A, #F5C842)",
                  color: "#0D1117",
                  fontSize: "0.9375rem",
                  border: "none",
                  cursor: isDisabled ? "not-allowed" : "pointer",
                }}
              >
                {resetMutation.isPending ? (
                  <><Loader2 size={16} className="animate-spin" /> Updating…</>
                ) : (
                  "Update Password"
                )}
              </button>
            </form>
          </>
        )}
      </div>

      {/* Back link */}
      <button
        onClick={() => navigate("/login")}
        className="mt-6 flex items-center gap-1.5 text-sm transition-colors hover:opacity-70"
        style={{ color: "rgba(26,26,26,0.65)", background: "none", border: "none", cursor: "pointer", minHeight: "auto", minWidth: "auto" }}
      >
        <ArrowLeft size={14} />
        Back to Sign In
      </button>
    </div>
  );
}
