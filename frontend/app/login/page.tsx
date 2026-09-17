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
  User,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getApiBaseUrl } from "@/lib/api";

function BrandMark() {
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

interface ActiveSession {
  name: string;
  email: string;
  role: string;
  slug: string;
  workspace_name?: string;
  workspace_slug?: string;
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
      if (data.role) localStorage.setItem("user_role", data.role);
      if (data.slug) localStorage.setItem("user_slug", data.slug);
      if (data.workspace_slug) localStorage.setItem("last_workspace_slug", data.workspace_slug);
      if (data.workspace_name) localStorage.setItem("workspace_name", data.workspace_name);

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

  return (
    <div className="flex min-h-screen flex-col justify-center bg-muted/30 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        {/* Top Header with Brand */}
        <div className="mb-6 flex items-center justify-between">
          <BrandMark />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to Home
          </Link>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xl shadow-primary/[0.03] sm:p-8">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Workspace Portal
              </span>
              {/* Workspace Badge */}
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs text-foreground">
                <Building2 className="size-3 text-primary" />
                <span className="font-semibold truncate max-w-[150px]">{workspaceName}</span>
              </div>
            </div>

            <h1 className="mt-3 text-xl font-bold tracking-tight text-foreground">
              {mode === "login" ? "Sign in to your account" : "Create an advisor account"}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {mode === "login"
                ? `Enter your credentials for workspace '${workspaceSlug}'.`
                : "Register as a Financial Advisor to submit client documents."}
            </p>
          </div>

          {/* Active Session Prompt */}
          {activeSession && (
            <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs">
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
                    setToast("Signed out successfully");
                  }}
                  className="font-semibold text-destructive hover:underline"
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
                  const target = `/${activeSession.role === "officer" ? "compliance-officer" : "advisor"}/${activeSession.slug || "workspace"}`;
                  router.push(target);
                }}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                <span>Continue to Dashboard ({activeSession.slug})</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="mb-6 flex rounded-xl bg-muted p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setToast("");
              }}
              className={`flex-1 rounded-lg py-2 transition ${
                mode === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setToast("");
              }}
              className={`flex-1 rounded-lg py-2 transition ${
                mode === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Register
            </button>
          </div>

          {toast && (
            <div className="mb-5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive">
              {toast}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Full Name</label>
                <input
                  required
                  name="name"
                  type="text"
                  placeholder="Jordan Davis, CFA"
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Corporate Email</label>
              <input
                required
                name="email"
                type="email"
                placeholder="you@company.com"
                className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-foreground">Password</label>
                {mode === "login" && (
                  <button type="button" className="text-[11px] font-semibold text-primary hover:underline">
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
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 pr-10 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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

            {mode === "signup" && (
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold text-foreground">Role Selection</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setRole("Financial Advisor")}
                    className={`rounded-xl border p-2.5 text-left transition ${
                      role === "Financial Advisor"
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <div className="font-semibold text-foreground">Advisor</div>
                    <div className="text-[10px] text-muted-foreground">Self-registration allowed</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole("Compliance Officer")}
                    className={`rounded-xl border p-2.5 text-left transition ${
                      role === "Compliance Officer"
                        ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <div className="font-semibold text-foreground">Officer</div>
                    <div className="text-[10px] text-muted-foreground">Invite only</div>
                  </button>
                </div>

                {role === "Compliance Officer" && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="size-4 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">
                        <strong>Administrator Invitation Required:</strong> Compliance Officers cannot self-register to ensure strict segregation of duties. If you were invited, please{" "}
                        <Link href="/accept-invite" className="font-bold underline">
                          accept your invitation here
                        </Link>.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Workspace Switcher */}
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <Building2 className="size-3.5 text-primary" />
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
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                Switch
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-50"
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

          <div className="mt-6 border-t border-border/60 pt-4 text-center text-xs text-muted-foreground">
            <p>
              Received an invitation link?{" "}
              <Link href="/accept-invite" className="font-semibold text-primary hover:underline">
                Accept Invite
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Northstar Compliance Systems • Encrypted & Audit-Ready
        </div>
      </div>
    </div>
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
