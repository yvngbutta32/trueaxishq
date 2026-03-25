import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const LOGO_URL = "https://cdn.manus.im/projects/iPfgoMEqzDCjDqvRPrVro9/static/logo-r1.png";

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
          Sign in to TrueAxis HQ
        </h1>
        <p
          style={{
            fontSize: "0.875rem",
            color: "rgba(245,240,232,0.45)",
            textAlign: "center",
            marginBottom: "2rem",
          }}
        >
          Enter your email and password to continue
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <Label
              htmlFor="email"
              style={{ color: "rgba(245,240,232,0.7)", fontSize: "0.875rem", marginBottom: "0.5rem", display: "block" }}
            >
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              style={{
                background: "rgba(245,240,232,0.05)",
                border: "1px solid rgba(232,160,32,0.2)",
                color: "#F5F0E8",
                borderRadius: "8px",
              }}
            />
          </div>

          <div>
            <Label
              htmlFor="password"
              style={{ color: "rgba(245,240,232,0.7)", fontSize: "0.875rem", marginBottom: "0.5rem", display: "block" }}
            >
              Password
            </Label>
            <div style={{ position: "relative" }}>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={{
                  background: "rgba(245,240,232,0.05)",
                  border: "1px solid rgba(232,160,32,0.2)",
                  color: "#F5F0E8",
                  borderRadius: "8px",
                  paddingRight: "2.75rem",
                }}
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
          </div>

          {/* Forgot password link */}
          <div style={{ textAlign: "right", marginTop: "-0.5rem" }}>
            <button
              type="button"
              onClick={() => navigate("/forgot-password")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "rgba(232,160,32,0.7)",
                fontSize: "0.8rem",
                padding: 0,
                minHeight: "auto",
                minWidth: "auto",
              }}
            >
              Forgot password?
            </button>
          </div>

          <Button
            type="submit"
            disabled={loginMutation.isPending || !email || !password}
            style={{
              background: "linear-gradient(135deg, #E8A020, #F5C842)",
              color: "#141414",
              fontFamily: "Space Grotesk, sans-serif",
              fontWeight: 700,
              borderRadius: "8px",
              border: "none",
              padding: "0.75rem",
              fontSize: "0.95rem",
              cursor: loginMutation.isPending ? "not-allowed" : "pointer",
              opacity: loginMutation.isPending ? 0.7 : 1,
              width: "100%",
            }}
          >
            {loginMutation.isPending ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                <Loader2 size={16} className="animate-spin" /> Signing in…
              </span>
            ) : (
              "Sign In"
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
          Don't have an account?{" "}
          <button
            onClick={() => navigate("/register")}
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
            Create one
          </button>
        </p>
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
