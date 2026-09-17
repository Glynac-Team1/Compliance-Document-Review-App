"use client";

import { Suspense, useEffect, useState, FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  User,
  Building2,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

interface InvitationData {
  valid: boolean;
  email: string;
  role: string;
  workspace_name: string;
  workspace_slug: string;
}

interface PasswordChecks {
  length: boolean;
  upper: boolean;
  lower: boolean;
  number: boolean;
  symbol: boolean;
}

function calculatePasswordStrength(pass: string): {
  score: number;
  checks: PasswordChecks;
} {
  const checks: PasswordChecks = {
    length: pass.length >= 8,
    upper: /[A-Z]/.test(pass),
    lower: /[a-z]/.test(pass),
    number: /\d/.test(pass),
    symbol: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]/.test(pass),
  };

  const score = Object.values(checks).filter(Boolean).length;
  return { score, checks };
}

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [verifying, setVerifying] = useState(true);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { score, checks } = calculatePasswordStrength(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isFormValid = score === 5 && passwordsMatch && name.trim().length > 0;

  useEffect(() => {
    if (!token) {
      setError("No invitation token provided. Please check the link from your email.");
      setVerifying(false);
      return;
    }

    async function verifyToken() {
      try {
        const res = await fetch(`${getApiBaseUrl()}/invitations/verify/${token}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.detail || "Invalid or expired invitation link.");
        }

        setInvitation(data);
        // Pre-fill a readable name from email local part
        if (data.email) {
          const defaultName = data.email.split("@")[0].replace(/[^a-zA-Z0-9]/g, " ");
          const capitalized = defaultName
            .split(" ")
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
          setName(capitalized);
        }
      } catch (err: any) {
        setError(err.message || "Failed to verify invitation.");
      } finally {
        setVerifying(false);
      }
    }

    verifyToken();
  }, [token]);

  async function handleAccept(e: FormEvent) {
    e.preventDefault();
    if (!isFormValid || submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`${getApiBaseUrl()}/invitations/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: name.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to accept invitation.");
      }

      // Store credentials & active workspace
      localStorage.setItem("auth_token", data.token);
      if (data.role) localStorage.setItem("user_role", data.role);
      if (data.slug) localStorage.setItem("user_slug", data.slug);
      if (data.workspace_slug) {
        localStorage.setItem("last_workspace_slug", data.workspace_slug);
        localStorage.setItem("workspace_name", data.workspace_name);
      }

      // Route directly to user workspace
      const targetSlug = data.slug || "workspace";
      if (data.role === "advisor") {
        router.push(`/advisor/${targetSlug}`);
      } else {
        router.push(`/compliance-officer/${targetSlug}`);
      }
    } catch (err: any) {
      setSubmitError(err.message || "An error occurred while setting up your account.");
      setSubmitting(false);
    }
  }

  // Loading state
  if (verifying) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="size-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <h2 className="text-lg font-semibold text-foreground">Verifying Invitation Link...</h2>
          <p className="text-sm text-muted-foreground">Checking credentials and workspace assignment</p>
        </div>
      </div>
    );
  }

  // Error state (invalid / expired)
  if (error || !invitation) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-destructive/20 bg-card p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-7" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Invitation Link Expired or Invalid</h2>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            {error || "This invitation cannot be verified. It may have expired or already been accepted."}
          </p>
          <div className="mt-6">
            <button
              onClick={() => router.push("/")}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Return to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isOfficer = invitation.role.toLowerCase() === "officer";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 shadow-xl">
        {/* Workspace Brand Header */}
        <div className="mb-6 flex items-center justify-between border-b border-border/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <p className="text-base font-bold tracking-tight text-foreground">{invitation.workspace_name}</p>
              <p className="text-xs text-muted-foreground">Official Workspace Invitation</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            Verified Invite
          </div>
        </div>

        {/* Assigned Details Card */}
        <div className="mb-6 rounded-xl border border-border/80 bg-muted/40 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground font-medium block">Invited Email</span>
              <span className="font-semibold text-foreground break-all">{invitation.email}</span>
            </div>
            <div>
              <span className="text-muted-foreground font-medium block">Assigned Role</span>
              <span
                className={`inline-flex items-center gap-1.5 font-semibold mt-0.5 px-2.5 py-0.5 rounded-full text-xs ${
                  isOfficer
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                }`}
              >
                {isOfficer ? <ShieldCheck className="size-3.5" /> : <User className="size-3.5" />}
                {isOfficer ? "Compliance Officer" : "Financial Advisor"}
              </span>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground/80 leading-normal border-t border-border/40 pt-2">
            🛡️ Your role was pre-configured by your compliance administrator. No self-appointment is required.
          </p>
        </div>

        {/* Setup Form */}
        <form onSubmit={handleAccept} className="space-y-4">
          {submitError && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive font-medium">
              {submitError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jordan Davis, CFA"
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Create Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a strong enterprise password"
                className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground pr-10 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Password Strength Meter */}
          {password.length > 0 && (
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Password Strength:</span>
                <span
                  className={`font-bold ${
                    score <= 2
                      ? "text-red-500"
                      : score <= 4
                      ? "text-amber-500"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {score <= 2 ? "Weak" : score <= 4 ? "Moderate" : "Strong & Compliant"}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-all duration-300 ${
                    score <= 2
                      ? "bg-red-500"
                      : score <= 4
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${(score / 5) * 100}%` }}
                />
              </div>

              {/* Rules Checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px]">
                <div className={`flex items-center gap-1.5 ${checks.length ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground"}`}>
                  {checks.length ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                  At least 8 characters
                </div>
                <div className={`flex items-center gap-1.5 ${checks.upper ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground"}`}>
                  {checks.upper ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                  Uppercase letter (A-Z)
                </div>
                <div className={`flex items-center gap-1.5 ${checks.lower ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground"}`}>
                  {checks.lower ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                  Lowercase letter (a-z)
                </div>
                <div className={`flex items-center gap-1.5 ${checks.number ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground"}`}>
                  {checks.number ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                  At least one number (0-9)
                </div>
                <div className={`flex items-center gap-1.5 ${checks.symbol ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground"}`}>
                  {checks.symbol ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                  Special symbol (!@#$%...)
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Confirm Password</label>
            <input
              type={showPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="mt-1 text-[11px] text-destructive">Passwords do not match.</p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={!isFormValid || submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span>Activating Account...</span>
              ) : (
                <>
                  <span>Activate Account & Enter Workspace</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
