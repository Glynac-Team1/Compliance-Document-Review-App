"use client";

import { Suspense, useEffect, useState, FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  Mail,
  Lock,
  Building2,
  KeyRound,
  Shield,
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
    symbol: /[^A-Za-z0-9]/.test(pass),
  };

  const score = Object.values(checks).filter(Boolean).length;
  return { score, checks };
}

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [verifying, setVerifying] = useState(Boolean(token));
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Manual token input state when arriving without a token
  const [manualToken, setManualToken] = useState("");

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
      <div className="relative isolate flex min-h-screen flex-col items-center justify-center bg-background px-4 overflow-hidden">
        {/* Transparent Blue Circle Accent */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-96 rounded-full bg-blue-500/10 blur-3xl"
        />
        <div className="flex flex-col items-center space-y-4 text-center z-10">
          <div className="size-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <h2 className="text-lg font-semibold text-foreground">Verifying Invitation Token...</h2>
          <p className="text-xs text-muted-foreground">Checking institutional credentials and pre-assigned role</p>
        </div>
      </div>
    );
  }

  // No Token State: Explaining that onboarding is invite-only via email
  if (!token) {
    return (
      <div className="relative isolate flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 overflow-hidden">
        {/* Transparent Blue Circle Accent */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 size-96 rounded-full bg-blue-500/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 right-1/4 size-80 rounded-full bg-sky-500/10 blur-3xl"
        />

        <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-xl">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
            <Mail className="size-7" />
          </div>

          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary mb-3">
              <Shield className="size-3.5" />
              <span>Invitation Link Required</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Check Your Work Email for Invitation
            </h1>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              Northstar Compliance operates under an enterprise zero-trust protocol. Onboarding invitations are dispatched directly via email by your workspace administrator.
            </p>
          </div>

          <div className="mt-6 rounded-xl border border-border/80 bg-muted/30 p-4 text-xs space-y-2.5">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
              <span className="text-muted-foreground">
                <strong className="text-foreground">Step 1:</strong> Open your corporate inbox and locate the invitation email sent by your administrator.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
              <span className="text-muted-foreground">
                <strong className="text-foreground">Step 2:</strong> Click the secure link inside the email to accept your invitation and protect your account with a master password.
              </span>
            </div>
          </div>

          {/* Manual Token Paste Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              let cleaned = manualToken.trim();
              if (!cleaned) return;
              if (cleaned.includes("token=")) {
                try {
                  const url = new URL(cleaned, window.location.origin);
                  cleaned = url.searchParams.get("token") || cleaned;
                } catch {
                  const match = cleaned.match(/token=([a-zA-Z0-9_-]+)/);
                  if (match) cleaned = match[1];
                }
              }
              router.push(`/accept-invite?token=${encodeURIComponent(cleaned)}`);
            }}
            className="mt-6 border-t border-border/60 pt-5 space-y-3"
          >
            <label className="block text-xs font-medium text-foreground">
              Have an invitation link or token?
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Paste invitation URL or token here..."
                className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
              <button
                type="submit"
                disabled={!manualToken.trim()}
                className="rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition cursor-pointer"
              >
                Verify
              </button>
            </div>
          </form>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/60 pt-4 text-xs">
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Already have an account? Sign In
            </Link>
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              Return to Landing Page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Error state (invalid / expired)
  if (error || !invitation) {
    return (
      <div className="relative isolate flex min-h-screen flex-col items-center justify-center bg-background px-4 overflow-hidden">
        {/* Transparent Blue Circle Accent */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-96 rounded-full bg-destructive/10 blur-3xl"
        />
        <div className="relative z-10 w-full max-w-md rounded-2xl border border-destructive/20 bg-card p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-7" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Invitation Link Expired or Invalid</h2>
          <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
            {error || "This invitation cannot be verified. It may have expired or already been accepted."}
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition"
            >
              <span>Go to Sign In</span>
              <ArrowRight className="size-3.5" />
            </Link>
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition"
            >
              <span>Return to Homepage</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isOfficer = invitation.role.toLowerCase() === "officer";

  return (
    <div className="relative isolate flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 overflow-hidden">
      {/* Transparent Blue Circular Accents */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-96 rounded-full bg-blue-500/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 right-1/4 size-96 rounded-full bg-sky-500/10 blur-3xl"
      />

      <div className="relative z-10 w-full max-w-xl rounded-2xl border border-border bg-card p-8 shadow-xl">
        {/* Workspace Brand Header */}
        <div className="mb-6 flex items-center justify-between border-b border-border/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <p className="text-base font-bold tracking-tight text-foreground">{invitation.workspace_name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Building2 className="size-3 text-primary" />
                <span>Enterprise Workspace Onboarding</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Sparkles className="size-3.5" />
            <span>Verified Token</span>
          </div>
        </div>

        {/* Accepted Invitation Callout */}
        <div className="mb-6 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm shrink-0 mt-0.5">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-emerald-950 dark:text-emerald-300">
                Invitation Accepted!
              </h2>
              <p className="text-xs text-emerald-900/85 dark:text-emerald-400 mt-1 leading-relaxed">
                You have accepted the onboarding invitation for <strong>{invitation.workspace_name}</strong>. Please protect your account with a master password to complete your account activation.
              </p>
            </div>
          </div>
        </div>

        {/* Locked Role & Identity Verification Details */}
        <div className="mb-6 rounded-xl border border-border/80 bg-muted/40 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground font-medium block">Invited Email</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Lock className="size-3 text-muted-foreground" />
                <span className="font-semibold text-foreground break-all">{invitation.email}</span>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground font-medium block">Pre-Assigned Role</span>
              <span
                className={`inline-flex items-center gap-1.5 font-semibold mt-0.5 px-2.5 py-0.5 rounded-full text-xs ${
                  isOfficer
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                    : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20"
                }`}
              >
                {isOfficer ? <ShieldCheck className="size-3.5" /> : <User className="size-3.5" />}
                {isOfficer ? "Compliance Officer" : "Financial Advisor"}
              </span>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground/80 leading-normal border-t border-border/40 pt-2 flex items-center gap-1.5">
            <KeyRound className="size-3.5 text-primary shrink-0" />
            <span>
              {isOfficer
                ? "Authorized for review queues, compliance sign-offs, and FINRA/SEC audit log inspection."
                : "Authorized for client document drafting, AI policy screening, and revision workflows."}
            </span>
          </p>
        </div>

        {/* Account Protection Form */}
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
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Create Master Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a compliant master password"
                className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs text-foreground pr-10 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Password Strength Meter */}
          {password.length > 0 && (
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Password Security:</span>
                <span
                  className={`font-bold text-[11px] ${
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
                  Special symbol (!@#$...)
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Confirm Master Password</label>
            <input
              type={showPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your master password"
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="mt-1 text-[11px] text-destructive">Passwords do not match.</p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={!isFormValid || submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? (
                <span>Protecting Account & Entering Workspace...</span>
              ) : (
                <>
                  <span>
                    Protect Account & Enter Workspace as {isOfficer ? "Compliance Officer" : "Financial Advisor"}
                  </span>
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
