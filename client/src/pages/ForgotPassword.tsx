import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Mail, CheckCircle2, ArrowLeft } from "lucide-react";

const LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663405218930/gipzWtYeMsnYWyzsuU8sxR/logo-r1_d9d437c8.png";

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
    forgotMutation.mutate({ email: email.trim(), origin: window.location.origin });
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
        {sent ? (
          /* Success state */
          <div className="text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: "rgba(232,160,32,0.10)", border: "1px solid rgba(232,160,32,0.20)" }}
            >
              <CheckCircle2 size={32} style={{ color: "#E8A020" }} />
            </div>
            <h1
              className="mb-3"
              style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "1.5rem", color: "#F5F0E8" }}
            >
              Reset link sent
            </h1>
            <p className="mb-8 leading-relaxed" style={{ fontSize: "0.9rem", color: "rgba(245,240,232,0.55)" }}>
              If an account exists for{" "}
              <strong style={{ color: "#E8A020" }}>{email}</strong>, a password reset link has been
              delivered to the account owner's notification inbox. The link expires in 1 hour.
            </p>
            <button
              onClick={() => navigate("/login")}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
              style={{
                background: "linear-gradient(135deg, #E8A020, #F5C842)",
                color: "#141414",
                fontFamily: "Space Grotesk, sans-serif",
                fontSize: "0.9375rem",
                border: "none",
                cursor: "pointer",
              }}
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          /* Request form */
          <>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: "rgba(232,160,32,0.10)", border: "1px solid rgba(232,160,32,0.20)" }}
            >
              <Mail size={24} style={{ color: "#E8A020" }} />
            </div>
            <h1
              className="text-center mb-2"
              style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "1.625rem", color: "#F5F0E8" }}
            >
              Reset your password
            </h1>
            <p className="text-center mb-8" style={{ fontSize: "0.9rem", color: "rgba(245,240,232,0.45)" }}>
              Enter your email and we'll send you a reset link
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
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
                  autoFocus
                  autoComplete="email"
                  className="form-input"
                />
              </div>

              <button
                type="submit"
                disabled={forgotMutation.isPending || !email.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "linear-gradient(135deg, #E8A020, #F5C842)",
                  color: "#141414",
                  fontFamily: "Space Grotesk, sans-serif",
                  fontSize: "0.9375rem",
                  border: "none",
                  cursor: forgotMutation.isPending ? "not-allowed" : "pointer",
                }}
              >
                {forgotMutation.isPending ? (
                  <><Loader2 size={16} className="animate-spin" /> Sending…</>
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </form>

            <p className="text-center mt-6 text-sm" style={{ color: "rgba(245,240,232,0.40)" }}>
              Remember your password?{" "}
              <button
                onClick={() => navigate("/login")}
                className="font-semibold transition-colors hover:opacity-80"
                style={{ color: "#E8A020", background: "none", border: "none", cursor: "pointer", padding: 0, minHeight: "auto", minWidth: "auto" }}
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
        className="mt-6 flex items-center gap-1.5 text-sm transition-colors hover:opacity-70"
        style={{ color: "rgba(245,240,232,0.30)", background: "none", border: "none", cursor: "pointer", minHeight: "auto", minWidth: "auto" }}
      >
        <ArrowLeft size={14} />
        Back to homepage
      </button>
    </div>
  );
}
