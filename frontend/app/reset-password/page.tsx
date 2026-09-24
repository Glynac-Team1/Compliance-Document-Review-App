"use client";

import { Suspense, useState, FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Eye, EyeOff, LockKeyhole, ArrowRight, CheckCircle2 } from "lucide-react";
import { getApiBaseUrl, formatApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const tokenParam = searchParams.get("token") || "";
  const [token, setToken] = useState(tokenParam);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isLengthValid = password.length >= 8;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanToken = token.trim();
    if (!cleanToken) {
      const msg = "Please enter or provide a valid reset token.";
      setError(msg);
      toast.error("Missing Token", msg);
      return;
    }

    if (password.length < 8) {
      const msg = "Password must be at least 8 characters long.";
      setError(msg);
      toast.error("Weak Password", msg);
      return;
    }

    if (password !== confirmPassword) {
      const msg = "Passwords do not match.";
      setError(msg);
      toast.error("Mismatch", msg);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: cleanToken, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(formatApiError(data.detail, "Failed to reset password."));
      }

      toast.success("Password Updated", "Your password has been reset. Please sign in with your new password.");
      router.push("/login");
    } catch (err: any) {
      const message = err.message || "Failed to reset password.";
      setError(message);
      toast.error("Reset Failed", message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative isolate min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden">
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-7 sm:p-9 shadow-xl shadow-primary/[0.03]">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-foreground leading-none">
                Northstar Compliance
              </p>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mt-1">
                Account Security
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Set New Password
            </h1>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Enter a new secure password for your account.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-xs font-medium text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {!tokenParam && (
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                Reset Token
                <input
                  required
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste your reset token"
                  className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-xs font-mono font-normal text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </label>
            )}

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
              New Password
              <div className="relative">
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="h-11 w-full rounded-xl border border-input bg-background px-3.5 pr-10 text-xs font-normal text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
              Confirm New Password
              <div className="relative">
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="h-11 w-full rounded-xl border border-input bg-background px-3.5 pr-10 text-xs font-normal text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>
            </label>

            {password.length > 0 && (
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                <span className={isLengthValid ? "text-emerald-600 font-medium" : ""}>
                  • 8+ characters
                </span>
                <span className={passwordsMatch ? "text-emerald-600 font-medium" : ""}>
                  • Passwords match
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !isLengthValid || !passwordsMatch}
              className="mt-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              ) : (
                <>
                  <span>Update Password</span>
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-border text-center text-xs">
            <Link href="/login" className="text-muted-foreground hover:text-foreground transition font-medium">
              Return to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
