import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";

const LOGO_URL = "https://cdn.manus.im/projects/iPfgoMEqzDCjDqvRPrVro9/static/logo-r1.png";

export default function ForgotPassword() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const forgotMutation = trpc.auth.forgotPassword.useMutation({
    onSuccess: () => {
      setSent(true);
    },
    onError: (err) => {
      toast.error(err.message || "Something went wrong. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    forgotMutation.mutate({ email: email.trim() });
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
        {sent ? (
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
              Check your notifications
            </h1>
            <p
              style={{
                fontSize: "0.875rem",
                color: "rgba(245,240,232,0.55)",
                lineHeight: 1.6,
                marginBottom: "2rem",
              }}
            >
              If an account exists for <strong style={{ color: "#E8A020" }}>{email}</strong>, a
              password reset link has been sent to your Manus notification inbox. The link expires
              in 1 hour.
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
              Back to Sign In
            </Button>
          </div>
        ) : (
          /* Request form */
          <>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "rgba(232,160,32,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.5rem",
              }}
            >
              <Mail size={24} style={{ color: "#E8A020" }} />
            </div>
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
              Reset your password
            </h1>
            <p
              style={{
                fontSize: "0.875rem",
                color: "rgba(245,240,232,0.45)",
                textAlign: "center",
                marginBottom: "2rem",
              }}
            >
              Enter your email and we'll send you a reset link
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <Label htmlFor="email" style={labelStyle}>Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  autoComplete="email"
                  style={inputStyle}
                />
              </div>

              <Button
                type="submit"
                disabled={forgotMutation.isPending || !email.trim()}
                style={{
                  background:
                    forgotMutation.isPending || !email.trim()
                      ? "rgba(232,160,32,0.3)"
                      : "linear-gradient(135deg, #E8A020, #F5C842)",
                  color: "#141414",
                  fontFamily: "Space Grotesk, sans-serif",
                  fontWeight: 700,
                  borderRadius: "8px",
                  border: "none",
                  padding: "0.75rem",
                  fontSize: "0.95rem",
                  cursor: forgotMutation.isPending ? "not-allowed" : "pointer",
                  width: "100%",
                }}
              >
                {forgotMutation.isPending ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                    <Loader2 size={16} className="animate-spin" /> Sending…
                  </span>
                ) : (
                  "Send Reset Link"
                )}
              </Button>
            </form>

            <p
              style={{
                textAlign: "center",
                fontSize: "0.875rem",
                color: "rgba(245,240,232,0.4)",
                marginTop: "1.5rem",
              }}
            >
              Remember your password?{" "}
              <button
                onClick={() => navigate("/login")}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#E8A020",
                  fontWeight: 600,
                  padding: 0,
                  minHeight: "auto",
                  minWidth: "auto",
                }}
              >
                Sign in
              </button>
            </p>
          </>
        )}
      </div>

      {/* Back link */}
      <button
        onClick={() => navigate("/")}
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
        ← Back to homepage
      </button>
    </div>
  );
}
