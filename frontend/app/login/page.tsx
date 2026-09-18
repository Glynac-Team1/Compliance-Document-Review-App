"use client";

import { Suspense, FormEvent, useState, useEffect } from "react";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Building2,
  AlertCircle,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getApiBaseUrl } from "@/lib/api";

function LeftBrandedBrandMark() {
  return (
    <Link href="/" className="inline-flex items-center gap-3 transition hover:opacity-90">
      <div className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground/10 border border-primary-foreground/20 text-primary-foreground shadow-lg">
        <ShieldCheck className="size-5" strokeWidth={2.2} />
      </div>
      <div>
        <p className="text-sm font-bold tracking-tight text-primary-foreground">
          Northstar
        </p>
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-primary-foreground/60">
          Compliance
        </p>
      </div>
    </Link>
  );
}

function MobileBrandMark() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 transition hover:opacity-90">
      <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
        <ShieldCheck className="size-5" strokeWidth={2.2} />
      </div>
      <div>
        <p className="text-sm font-bold tracking-tight text-foreground">Northstar</p>
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Compliance</p>
      </div>
    </Link>
  );
}

function RoleOption({
  selected,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-start gap-3 rounded-xl border p-3 text-left transition ${
        selected ? "border-primary bg-primary/[0.06] shadow-sm" : "border-border bg-card hover:border-primary/40"
      }`}
      aria-pressed={selected}
    >
      <span
        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${
          selected ? "border-primary bg-primary" : "border-input"
        }`}
      >
        {selected && (
          <Check className="size-2.5 text-primary-foreground" strokeWidth={3} />
        )}
      </span>
      <span>
        <span className="block text-xs font-semibold text-foreground">
          {title}
        </span>
        <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  );
}

interface ActiveSession {
  name: string;
  email: string;
  role: string;
  slug: string;
  workspace_name?: string;
  workspace_slug?: string;
  is_admin?: boolean;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [role, setRole] = useState<"Financial Advisor" | "Compliance Officer">("Financial Advisor");
  const [workspaceSlug, setWorkspaceSlug] = useState("northstar");
  const [workspaceName, setWorkspaceName] = useState("Northstar Compliance");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [toast, setToast] = useState("");
  const [supportCopied, setSupportCopied] = useState(false);

  useEffect(() => {
    // Detect workspace from URL param or localStorage
    const paramSlug = searchParams.get("workspace");
    const savedSlug = localStorage.getItem("last_workspace_slug");
    const resolvedSlug = paramSlug || savedSlug || "northstar";
    setWorkspaceSlug(resolvedSlug);

    const savedName = localStorage.getItem("workspace_name");
    if (savedName && resolvedSlug === savedSlug) {
      setWorkspaceName(savedName);
    } else if (resolvedSlug === "northstar") {
      setWorkspaceName("Northstar Compliance");
    } else {
      setWorkspaceName(resolvedSlug.replace(/-/g, " ").toUpperCase());
    }

    async function checkExistingSession() {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        setActiveSession(null);
        return;
      }

      try {
        const res = await fetch(`${getApiBaseUrl()}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.is_admin) localStorage.setItem("is_admin", "true");
          if (data.role) localStorage.setItem("user_role", data.role);
          if (data.slug) localStorage.setItem("user_slug", data.slug);
          if (data.workspace_slug) {
            localStorage.setItem("last_workspace_slug", data.workspace_slug);
            setWorkspaceSlug(data.workspace_slug);
          }
          if (data.workspace_name) {
            localStorage.setItem("workspace_name", data.workspace_name);
            setWorkspaceName(data.workspace_name);
          }
          setActiveSession(data);
        } else {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("is_admin");
          localStorage.removeItem("user_role");
          localStorage.removeItem("user_slug");
          setActiveSession(null);
        }
      } catch (err) {
        console.error("Session check error", err);
      }
    }

    checkExistingSession();
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setToast("");

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email");
    const password = formData.get("password");
    const name = formData.get("name") || "New User";

    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/signup";

      const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name,
          role: role === "Financial Advisor" ? "advisor" : "officer",
          workspace_slug: workspaceSlug,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Authentication failed");
      }

      localStorage.setItem("auth_token", data.token);
      if (data.is_admin) localStorage.setItem("is_admin", "true");
      if (data.role) localStorage.setItem("user_role", data.role);
      if (data.slug) localStorage.setItem("user_slug", data.slug);
      if (data.workspace_slug) localStorage.setItem("last_workspace_slug", data.workspace_slug);
      if (data.workspace_name) localStorage.setItem("workspace_name", data.workspace_name);

      if (data.is_admin) {
        router.push("/admin");
        return;
      }

      const targetSlug = data.slug || "workspace";
      if (data.role === "advisor") {
        router.push(`/advisor/${targetSlug}`);
      } else {
        router.push(`/compliance-officer/${targetSlug}`);
      }
    } catch (error: any) {
      setToast(error.message || "An error occurred during authentication");
    } finally {
      setLoading(false);
    }
  }

  function handleCopySupport() {
    navigator.clipboard.writeText("support@northstarcompliance.com");
    setSupportCopied(true);
    setTimeout(() => setSupportCopied(false), 2500);
  }

  return (
    <main className="flex min-h-screen w-full flex-col lg:flex-row bg-background">
      {/* Left Branded Section with Immersed Circles (Visible on lg and up) */}
      <section className="relative hidden min-h-screen flex-1 flex-col justify-between overflow-hidden bg-primary p-8 text-primary-foreground lg:flex xl:p-12 selection:bg-white/20">
        {/* Immersed Background Grid & Concentric Orbital Circles */}
        <div className="hero-grid pointer-events-none absolute inset-0 opacity-25" />
        <div className="hero-orbit pointer-events-none absolute -right-20 top-1/4 size-96 rounded-full border border-primary-foreground/15" />
        <div className="hero-orbit hero-orbit-delay pointer-events-none absolute -right-4 top-[32%] size-64 rounded-full border border-primary-foreground/15" />
        <div className="pointer-events-none absolute top-1/3 -right-10 size-80 rounded-full bg-blue-500/20 blur-3xl animate-pulse-glow" />
        <div className="pointer-events-none absolute bottom-12 left-10 size-72 rounded-full bg-indigo-500/15 blur-2xl animate-float-slow" />

        {/* Top Branding */}
        <div className="relative z-10">
          <LeftBrandedBrandMark />
        </div>

        {/* Central Narrative */}
        <div className="relative z-10 max-w-xl pb-8 xl:pb-16">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary-foreground/15 bg-primary-foreground/[0.07] px-3 py-1.5 text-[11px] font-medium text-primary-foreground/80">
            <Sparkles className="size-3.5" />
            Intelligent review, built for trust
          </div>
          <h1 className="max-w-lg text-balance text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.08] tracking-[-0.04em]">
            Secure compliance review,{" "}
            <span className="text-primary-foreground/55">
              without the blind spots.
            </span>
          </h1>
          <p className="mt-7 max-w-md text-sm leading-relaxed text-primary-foreground/70">
            Northstar helps financial teams review documents with clarity,
            consistency, and an audit trail you can stand behind.
          </p>
          <div className="mt-9 flex flex-col gap-3 text-xs text-primary-foreground/75">
            <div className="flex items-center gap-2.5">
              <Check className="size-4 text-emerald-400 shrink-0" strokeWidth={2.5} />
              <span>AI-assisted heuristics & risk scoring</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Check className="size-4 text-emerald-400 shrink-0" strokeWidth={2.5} />
              <span>Decision-ready compliance audit trails</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Check className="size-4 text-emerald-400 shrink-0" strokeWidth={2.5} />
              <span>Strict role segregation & single-use invitations</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between text-[11px] text-primary-foreground/45">
          <p>© {new Date().getFullYear()} Northstar Compliance Systems</p>
          <p>Institutional Grade Assurance</p>
        </div>
      </section>

      {/* Right Form Section (Responsive on all screen sizes) */}
      <section className="flex min-h-screen w-full flex-1 items-center justify-center bg-muted/40 px-5 py-10 sm:px-8 lg:w-[48%] lg:min-w-[500px] xl:w-[46%] overflow-y-auto">
        <div className="w-full max-w-[430px] py-4">
          {/* Mobile Brand Mark Header (Visible when left column is hidden) */}
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <MobileBrandMark />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              <span>Home</span>
            </Link>
          </div>

          {/* Desktop Back Link */}
          <div className="mb-4 hidden items-center justify-between lg:flex">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Home</span>
            </Link>
          </div>

          {/* Authentication Card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xl shadow-primary/[0.04] sm:p-9">
            {/* Header & Workspace Indicator */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Welcome to Northstar
                </p>
                {/* Active Workspace Pill */}
                <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs text-foreground">
                  <Building2 className="size-3 text-primary shrink-0" />
                  <span className="font-semibold truncate max-w-[130px]">{workspaceName}</span>
                </div>
              </div>

              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                {mode === "login"
                  ? "Sign in to your workspace"
                  : "Create your workspace account"}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {mode === "login"
                  ? `Enter your credentials for workspace '${workspaceSlug}'.`
                  : "Register as a Financial Advisor to submit client documents."}
              </p>
            </div>

            {/* Active Session Detected Banner */}
            {activeSession && (
              <div className="mb-6 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                    Active Session Detected
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem("auth_token");
                      localStorage.removeItem("user_role");
                      localStorage.removeItem("user_slug");
                      setActiveSession(null);
                      setToast("Signed out successfully.");
                    }}
                    className="font-semibold text-destructive hover:underline cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
                <p className="mt-1.5 font-medium text-foreground">
                  Signed in as <strong>{activeSession.name}</strong> ({activeSession.email})
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (activeSession.is_admin) {
                      router.push("/admin");
                    } else {
                      const target = `/${activeSession.role === "officer" ? "compliance-officer" : "advisor"}/${activeSession.slug || "workspace"}`;
                      router.push(target);
                    }
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 cursor-pointer"
                >
                  <span>
                    {activeSession.is_admin
                      ? "Continue to Admin Console"
                      : `Continue to Workspace (${activeSession.slug})`}
                  </span>
                  <ArrowRight className="size-3.5" />
                </button>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  Or sign in to a different account below:
                </p>
              </div>
            )}

            {/* Mode Switcher Tabs */}
            <div
              className="mb-6 flex rounded-lg bg-muted p-1"
              role="tablist"
              aria-label="Authentication mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                onClick={() => {
                  setMode("login");
                  setToast("");
                }}
                className={`flex-1 rounded-md py-2 text-xs font-semibold transition cursor-pointer ${
                  mode === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                onClick={() => {
                  setMode("signup");
                  setToast("");
                }}
                className={`flex-1 rounded-md py-2 text-xs font-semibold transition cursor-pointer ${
                  mode === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign Up
              </button>
            </div>

            {/* Error / Status Toast */}
            {toast && (
              <div className="mb-5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive">
                {toast}
              </div>
            )}

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
              key={mode}
            >
              {mode === "signup" && (
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                  Full name
                  <input
                    required
                    name="name"
                    type="text"
                    placeholder="Jordan Davis, CFA"
                    className="h-11 rounded-xl border border-input bg-background px-3.5 text-xs font-normal text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </label>
              )}

              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                Corporate email address
                <input
                  required
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  className="h-11 rounded-xl border border-input bg-background px-3.5 text-xs font-normal text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                <div className="flex items-center justify-between">
                  <span>Password</span>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() =>
                        setToast("Please contact your workspace administrator to reset or update your password.")
                      }
                      className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    required
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    className="h-11 w-full rounded-xl border border-input bg-background px-3.5 pr-10 text-xs font-normal text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </label>

              {mode === "signup" && (
                <fieldset className="flex flex-col gap-2 pt-1">
                  <legend className="text-xs font-semibold text-foreground">Your role</legend>
                  <div className="flex gap-2">
                    <RoleOption
                      selected={role === "Financial Advisor"}
                      title="Financial Advisor"
                      description="Manage client materials"
                      onClick={() => setRole("Financial Advisor")}
                    />
                    <RoleOption
                      selected={role === "Compliance Officer"}
                      title="Compliance Officer"
                      description="Review and approve"
                      onClick={() => setRole("Compliance Officer")}
                    />
                  </div>

                  {role === "Compliance Officer" && (
                    <div className="mt-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="size-4 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">
                          <strong>Admin Invite Required:</strong> To maintain strict regulatory security, Compliance Officers cannot self-register. Please click the invitation link sent to your work email by your administrator.
                        </span>
                      </div>
                    </div>
                  )}
                </fieldset>
              )}

              {/* Workspace Switcher */}
              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-xs mt-1">
                <div className="flex items-center gap-2">
                  <Building2 className="size-3.5 text-primary shrink-0" />
                  <span className="text-muted-foreground">Workspace:</span>
                  <span className="font-semibold text-foreground font-mono">{workspaceSlug}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newSlug = window.prompt("Enter company workspace slug:", workspaceSlug);
                    if (newSlug && newSlug.trim()) {
                      const clean = newSlug.trim().toLowerCase();
                      setWorkspaceSlug(clean);
                      setWorkspaceName(clean.replace(/-/g, " ").toUpperCase());
                    }
                  }}
                  className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                >
                  Switch
                </button>
              </div>

              <button
                disabled={loading}
                type="submit"
                className="mt-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-md shadow-primary/15 transition hover:bg-primary/90 disabled:cursor-wait disabled:opacity-80 cursor-pointer"
              >
                {loading ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                ) : (
                  <>
                    <span>{mode === "login" ? "Sign In" : "Create Advisor Account"}</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </form>

            {/* Navigation Footers */}
            <div className="mt-6 border-t border-border/60 pt-4 flex flex-col items-center gap-2 text-center text-xs text-muted-foreground">
              <p>
                Received an onboarding invitation email?{" "}
                <Link
                  href="/accept-invite"
                  className="font-semibold text-primary hover:underline"
                >
                  Enter Setup Link
                </Link>
              </p>
              <p>
                Workspace Administrator?{" "}
                <Link
                  href="/admin"
                  className="font-semibold text-primary hover:underline"
                >
                  Admin Console
                </Link>
              </p>
            </div>

            <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
              <LockKeyhole className="size-3.5 text-primary" />
              Your data is encrypted and protected
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Need help?{" "}
            <button
              type="button"
              onClick={handleCopySupport}
              className="font-semibold text-primary hover:underline cursor-pointer"
            >
              {supportCopied ? "Email copied (support@northstarcompliance.com)" : "Contact support"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
