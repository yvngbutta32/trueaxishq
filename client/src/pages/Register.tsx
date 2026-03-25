import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, KeyRound } from "lucide-react";

const LOGO_URL = "https://cdn.manus.im/projects/iPfgoMEqzDCjDqvRPrVro9/static/logo-r1.png";

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

  const isSubmitDisabled =
    registerMutation.isPending ||
    !name ||
    !email ||
    !password ||
    !confirmPassword ||
    !inviteCode ||
    password !== confirmPassword;

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
          Create your account
        </h1>
        <p
          style={{
            fontSize: "0.875rem",
            color: "rgba(245,240,232,0.45)",
            textAlign: "center",
            marginBottom: "2rem",
          }}
        >
          An invite code is required to register
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Invite Code — first and prominent */}
          <div>
            <Label htmlFor="inviteCode" style={labelStyle}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <KeyRound size={14} style={{ color: "#E8A020" }} />
                Invite Code
              </span>
            </Label>
            <Input
              id="inviteCode"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX"
              required
              autoComplete="off"
              spellCheck={false}
              style={{
                ...inputStyle,
                fontFamily: "monospace",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            />
          </div>

          <div>
            <Label htmlFor="name" style={labelStyle}>Full Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              required
              autoComplete="name"
              style={inputStyle}
            />
          </div>

          <div>
            <Label htmlFor="email" style={labelStyle}>Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              style={inputStyle}
            />
          </div>

          <div>
            <Label htmlFor="password" style={labelStyle}>Password</Label>
            <div style={{ position: "relative" }}>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
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
          </div>

          <div>
            <Label htmlFor="confirmPassword" style={labelStyle}>Confirm Password</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              required
              autoComplete="new-password"
              style={{
                ...inputStyle,
                borderColor:
                  confirmPassword && confirmPassword !== password
                    ? "rgba(239,68,68,0.5)"
                    : "rgba(232,160,32,0.2)",
              }}
            />
            {confirmPassword && confirmPassword !== password && (
              <p style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                Passwords do not match
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isSubmitDisabled}
            style={{
              background: isSubmitDisabled
                ? "rgba(232,160,32,0.3)"
                : "linear-gradient(135deg, #E8A020, #F5C842)",
              color: "#141414",
              fontFamily: "Space Grotesk, sans-serif",
              fontWeight: 700,
              borderRadius: "8px",
              border: "none",
              padding: "0.75rem",
              fontSize: "0.95rem",
              cursor: isSubmitDisabled ? "not-allowed" : "pointer",
              width: "100%",
            }}
          >
            {registerMutation.isPending ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                <Loader2 size={16} className="animate-spin" /> Creating account…
              </span>
            ) : (
              "Create Account"
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
          Already have an account?{" "}
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
