import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";

const LOGO_URL = "https://cdn.manus.im/projects/iPfgoMEqzDCjDqvRPrVro9/static/logo-r1.png";

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

  const inputStyle = {
    background: "rgba(245,240,232,0.05)",
    border: "1px solid rgba(232,160,32,0.2)",
    color: "#F5F0E8",
    borderRadius: "8px",
  };

  const labelStyle = {
    color: "rgba(245,240,232,0.7)",
    fontSize: "0.875rem",
    marginBottom: "0.5rem",
    display: "block",
  };

  const isDisabled =
    resetMutation.isPending ||
    !newPassword ||
    !confirmPassword ||
    newPassword !== confirmPassword;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#141414",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
      }}
    >
      {/* Logo */}
      <button
        onClick={() => navigate("/")}
        style={{ background: "none", border: "none", cursor: "pointer", marginBottom: "2rem" }}
        aria-label="Go to homepage"
      >
        <img src={LOGO_URL} alt="TrueAxis HQ" style={{ height: "48px", objectFit: "contain" }} />
      </button>

      {/* Card */}
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#1C1C1E",
          border: "1px solid rgba(232,160,32,0.15)",
          borderRadius: "16px",
          padding: "2.5rem 2rem",
        }}
      >
        {/* No token */}
        {!token ? (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "rgba(239,68,68,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.5rem",
              }}
            >
              <AlertCircle size={28} style={{ color: "#ef4444" }} />
            </div>
            <h1
              style={{
                fontFamily: "Space Grotesk, sans-serif",
                fontWeight: 700,
                fontSize: "1.4rem",
                color: "#F5F0E8",
                marginBottom: "0.75rem",
              }}
            >
              Invalid reset link
            </h1>
            <p style={{ fontSize: "0.875rem", color: "rgba(245,240,232,0.5)", marginBottom: "2rem" }}>
              This link is missing a reset token. Please request a new password reset.
            </p>
            <Button
              onClick={() => navigate("/forgot-password")}
              style={{
                background: "linear-gradient(135deg, #E8A020, #F5C842)",
                color: "#141414",
                fontFamily: "Space Grotesk, sans-serif",
                fontWeight: 700,
                borderRadius: "8px",
                border: "none",
                width: "100%",
              }}
            >
              Request New Link
            </Button>
          </div>
        ) : done ? (
          /* Success state */
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "rgba(0,201,167,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.5rem",
              }}
            >
              <CheckCircle2 size={32} style={{ color: "#00C9A7" }} />
            </div>
            <h1
              style={{
                fontFamily: "Space Grotesk, sans-serif",
                fontWeight: 700,
                fontSize: "1.4rem",
                color: "#F5F0E8",
                marginBottom: "0.75rem",
              }}
            >
              Password updated!
            </h1>
            <p style={{ fontSize: "0.875rem", color: "rgba(245,240,232,0.5)", marginBottom: "2rem" }}>
              Your password has been changed successfully. You can now sign in with your new password.
            </p>
            <Button
              onClick={() => navigate("/login")}
              style={{
                background: "linear-gradient(135deg, #E8A020, #F5C842)",
                color: "#141414",
                fontFamily: "Space Grotesk, sans-serif",
                fontWeight: 700,
                borderRadius: "8px",
                border: "none",
                width: "100%",
              }}
            >
              Sign In
            </Button>
          </div>
        ) : (
          /* Reset form */
          <>
            <h1
              style={{
                fontFamily: "Space Grotesk, sans-serif",
                fontWeight: 700,
                fontSize: "1.5rem",
                color: "#F5F0E8",
                marginBottom: "0.5rem",
                textAlign: "center",
              }}
            >
              Set new password
            </h1>
            <p
              style={{
                fontSize: "0.875rem",
                color: "rgba(245,240,232,0.45)",
                textAlign: "center",
                marginBottom: "2rem",
              }}
            >
              Choose a strong password for your account
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <Label htmlFor="newPassword" style={labelStyle}>New Password</Label>
                <div style={{ position: "relative" }}>
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    autoFocus
                    autoComplete="new-password"
                    style={{ ...inputStyle, paddingRight: "2.75rem" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    style={{
                      position: "absolute",
                      right: "0.75rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "rgba(245,240,232,0.4)",
                      padding: 0,
                      minHeight: "auto",
                      minWidth: "auto",
                    }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {/* Password strength hint */}
                {newPassword && newPassword.length < 8 && (
                  <p style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                    Password must be at least 8 characters
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="confirmPassword" style={labelStyle}>Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  autoComplete="new-password"
                  style={{
                    ...inputStyle,
                    borderColor:
                      confirmPassword && confirmPassword !== newPassword
                        ? "rgba(239,68,68,0.5)"
                        : "rgba(232,160,32,0.2)",
                  }}
                />
                {confirmPassword && confirmPassword !== newPassword && (
                  <p style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                    Passwords do not match
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isDisabled}
                style={{
                  background: isDisabled
                    ? "rgba(232,160,32,0.3)"
                    : "linear-gradient(135deg, #E8A020, #F5C842)",
                  color: "#141414",
                  fontFamily: "Space Grotesk, sans-serif",
                  fontWeight: 700,
                  borderRadius: "8px",
                  border: "none",
                  padding: "0.75rem",
                  fontSize: "0.95rem",
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  width: "100%",
                }}
              >
                {resetMutation.isPending ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                    <Loader2 size={16} className="animate-spin" /> Updating…
                  </span>
                ) : (
                  "Update Password"
                )}
              </Button>
            </form>
          </>
        )}
      </div>

      {/* Back link */}
      <button
        onClick={() => navigate("/login")}
        style={{
          marginTop: "1.5rem",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "rgba(245,240,232,0.3)",
          fontSize: "0.8rem",
          minHeight: "auto",
          minWidth: "auto",
        }}
      >
        ← Back to Sign In
      </button>
    </div>
  );
}
